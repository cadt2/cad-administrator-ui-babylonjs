import {
  Matrix,
  PointerEventTypes,
  Vector3,
  Viewport,
  type AbstractMesh,
  type Nullable,
  type Observer,
  type PointerInfo,
  type Scene
} from '@babylonjs/core';

const DRAG_THRESHOLD_PX = 5;
const WORLD_IDENTITY = Matrix.Identity();

export interface ViewerMarqueeSelectionConfig {
  scene: Scene;
  canvas: HTMLCanvasElement;
  /** Returns true when isolation is active — marquee should be disabled. */
  isIsolationActive?: () => boolean;
  /** Returns all currently selectable nodes with their renderable leaf meshes. */
  getSelectableNodes: () => Array<{ nodeUniqueId: number; meshes: AbstractMesh[] }>;
  /** Called when a marquee drag completes. additive=true when Shift is held. */
  onMarqueeSelection: (uniqueIds: number[], additive: boolean) => void;
  /** Called just before firing a marquee selection, so the click-pick handler can be suppressed. */
  onSuppressNextPick?: () => void;
}

export interface ViewerMarqueeSelectionFeature {
  dispose: () => void;
}

export function createViewerMarqueeSelectionFeature(
  config: ViewerMarqueeSelectionConfig
): ViewerMarqueeSelectionFeature {
  const { scene, canvas, isIsolationActive, getSelectableNodes, onMarqueeSelection, onSuppressNextPick } = config;

  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let isAdditiveMode = false;

  // ─── Overlay div ───────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:absolute',
    'pointer-events:none',
    'box-sizing:border-box',
    'border:1px solid rgba(255,255,255,0.85)',
    'background:rgba(100,160,255,0.07)',
    'display:none',
    'z-index:100'
  ].join(';');

  const canvasContainer = canvas.parentElement ?? document.body;
  if (window.getComputedStyle(canvasContainer).position === 'static') {
    canvasContainer.style.position = 'relative';
  }
  canvasContainer.appendChild(overlay);

  const updateOverlay = (endX: number, endY: number, strict: boolean): void => {
    const ox = canvas.offsetLeft;
    const oy = canvas.offsetTop;
    const x1 = ox + Math.min(startX, endX);
    const y1 = oy + Math.min(startY, endY);
    const x2 = ox + Math.max(startX, endX);
    const y2 = oy + Math.max(startY, endY);
    overlay.style.left = `${x1}px`;
    overlay.style.top = `${y1}px`;
    overlay.style.width = `${x2 - x1}px`;
    overlay.style.height = `${y2 - y1}px`;
    // Solid border = window selection (left→right); dashed = crossing (right→left)
    overlay.style.borderStyle = strict ? 'solid' : 'dashed';
    overlay.style.display = 'block';
  };

  const hideOverlay = (): void => {
    overlay.style.display = 'none';
  };

  // ─── Screen-space projection ───────────────────────────────────────────────
  /**
   * Projects a world-space point into CSS-pixel screen space.
   * Uses canvas.clientWidth/Height so coordinates match event.offsetX/Y.
   */
  const projectToScreen = (
    worldPos: Vector3,
    transformMatrix: Matrix,
    viewport: Viewport
  ): { x: number; y: number } => {
    const projected = Vector3.Project(worldPos, WORLD_IDENTITY, transformMatrix, viewport);
    return { x: projected.x, y: projected.y };
  };

  /**
   * Projects mesh world AABB to a 2D screen-space AABB.
   * Returns null when no finite coordinates can be computed.
   */
  const getMeshScreenBounds = (
    mesh: AbstractMesh,
    transformMatrix: Matrix,
    viewport: Viewport
  ): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    const { boundingBox } = mesh.getBoundingInfo();
    const projected = boundingBox.vectorsWorld.map(v => projectToScreen(v, transformMatrix, viewport));

    const finitePoints = projected.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!finitePoints.length) {
      return null;
    }

    let bMinX = Number.POSITIVE_INFINITY;
    let bMinY = Number.POSITIVE_INFINITY;
    let bMaxX = Number.NEGATIVE_INFINITY;
    let bMaxY = Number.NEGATIVE_INFINITY;

    for (const p of finitePoints) {
      if (p.x < bMinX) bMinX = p.x;
      if (p.y < bMinY) bMinY = p.y;
      if (p.x > bMaxX) bMaxX = p.x;
      if (p.y > bMaxY) bMaxY = p.y;
    }

    return { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY };
  };

  /**
   * Tests whether a mesh is inside the marquee rectangle.
   * Uses overlap/containment against the projected screen-space AABB.
   *
   * strict = true  (window, left→right): projected bounds fully inside the rect.
   * strict = false (crossing, right→left): projected bounds overlaps the rect.
   */
  const isMeshInRect = (
    mesh: AbstractMesh,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    strict: boolean,
    transformMatrix: Matrix,
    viewport: Viewport
  ): boolean => {
    const bounds = getMeshScreenBounds(mesh, transformMatrix, viewport);
    if (!bounds) {
      return false;
    }

    if (strict) {
      return bounds.minX >= minX && bounds.maxX <= maxX && bounds.minY >= minY && bounds.maxY <= maxY;
    }

    return bounds.maxX >= minX
      && bounds.minX <= maxX
      && bounds.maxY >= minY
      && bounds.minY <= maxY;
  };

  const isMeshSelectableCandidate = (mesh: AbstractMesh): boolean => {
    if (mesh.isDisposed?.()) return false;
    if (!mesh.isEnabled(true) || !mesh.isVisible) return false;
    if (mesh.isPickable === false) return false;
    return mesh.isInFrustum(scene.frustumPlanes);
  };

  // ─── Pointer events ────────────────────────────────────────────────────────
  const pointerObserver: Nullable<Observer<PointerInfo>> = scene.onPointerObservable.add(
    pointerInfo => {
      const event = pointerInfo.event as PointerEvent;

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (event.button !== 0) return;
        if (isIsolationActive?.()) return;
        startX = event.offsetX;
        startY = event.offsetY;
        isDragging = false;
        isAdditiveMode = event.shiftKey;
        return;
      }

      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        // Left button must be held
        if (!(event.buttons & 1)) return;
        if (isIsolationActive?.()) return;
        const dx = event.offsetX - startX;
        const dy = event.offsetY - startY;
        if (!isDragging && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        isDragging = true;
        // strict = left-to-right drag (endX > startX)
        updateOverlay(event.offsetX, event.offsetY, event.offsetX > startX);
        return;
      }

      if (pointerInfo.type === PointerEventTypes.POINTERUP) {
        if (event.button !== 0 || !isDragging) return;
        isDragging = false;
        hideOverlay();

        const endX = event.offsetX;
        const endY = event.offsetY;
        if (
          Math.abs(endX - startX) < DRAG_THRESHOLD_PX &&
          Math.abs(endY - startY) < DRAG_THRESHOLD_PX
        ) {
          return;
        }

        const strict = endX > startX;
        const minX = Math.min(startX, endX);
        const minY = Math.min(startY, endY);
        const maxX = Math.max(startX, endX);
        const maxY = Math.max(startY, endY);
        const viewport = new Viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
        const transformMatrix = scene.getTransformMatrix();

        const nodes = getSelectableNodes();
        const selectedIds: number[] = [];

        for (const { nodeUniqueId, meshes } of nodes) {
          const candidateMeshes = meshes.filter(isMeshSelectableCandidate);
          if (!candidateMeshes.length) {
            continue;
          }

          const hit = strict
            ? candidateMeshes.every(m => isMeshInRect(m, minX, minY, maxX, maxY, true, transformMatrix, viewport))
            : candidateMeshes.some(m => isMeshInRect(m, minX, minY, maxX, maxY, false, transformMatrix, viewport));
          if (hit) selectedIds.push(nodeUniqueId);
        }

        // Suppress the POINTERPICK that BabylonJS fires after POINTERUP
        // to prevent the click-select handler from overriding the marquee result.
        onSuppressNextPick?.();
        onMarqueeSelection(selectedIds, isAdditiveMode);
      }
    },
    PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERMOVE | PointerEventTypes.POINTERUP
  );

  return {
    dispose: () => {
      if (pointerObserver) {
        scene.onPointerObservable.remove(pointerObserver);
      }
      overlay.remove();
    }
  };
}
