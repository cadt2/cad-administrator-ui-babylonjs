import {
  Color3,
  PointerEventTypes,
  type AbstractMesh,
  type Nullable,
  type Observer,
  type PointerInfo,
  SelectionOutlineLayer,
  type Scene
} from '@babylonjs/core';
import { type RgbTuple } from './viewer-scene.config';

const SELECTION_OVERLAY_ALPHA = 0.28;

interface SelectableSceneNodeLike {
  uniqueId: number;
  id: string;
  name?: string;
  parent?: SelectableSceneNodeLike | null;
  metadata?: Record<string, unknown>;
  renderOverlay?: boolean;
  overlayColor?: Color3;
  overlayAlpha?: number;
  isPickable?: boolean;
  isDisposed?: () => boolean;
  getClassName?: () => string;
  getChildren?: () => SelectableSceneNodeLike[];
  getTotalVertices?: () => number;
}

type SelectableSceneMeshLike = AbstractMesh & Required<Pick<SelectableSceneNodeLike, 'renderOverlay' | 'overlayColor' | 'overlayAlpha'>> & SelectableSceneNodeLike;

export interface ViewerSceneSelectionChange {
  uniqueId: number;
  nodeId: string;
  nodeName: string;
  treeNodeId: string;
}

export interface ViewerSceneSelectionFeatureConfig {
  scene: Scene;
  ground: AbstractMesh;
  selectionColors: {
    overlayColor: RgbTuple;
    outlineColor: RgbTuple;
  };
  /** Returns true when isolation is active — ground clicks should not deselect. */
  isIsolationActive?: () => boolean;
  onSelectionChanged?: (selections: ViewerSceneSelectionChange[]) => void;
  onSelectionRendered?: () => void;
}

export interface ViewerSceneSelectionFeature {
  rebuildSelectableNodes: () => void;
  clearSelection: () => void;
  /** Removes selection visuals (overlay + outline) without emitting onSelectionChanged. */
  clearHighlights: () => void;
  /** Returns the currently selected renderable meshes (empty if nothing selected). */
  getSelectedMeshes: () => AbstractMesh[];
  /** Select a scene node by its tree node ID. suppressEvent skips emitting onSelectionChanged. additive=true adds to current selection (Shift behavior). */
  selectByTreeNodeId: (treeNodeId: string, suppressEvent?: boolean, additive?: boolean) => void;
  /** Returns all effective-root selectable nodes with their renderable leaf meshes. */
  getAllSelectableNodes: () => Array<{ nodeUniqueId: number; meshes: AbstractMesh[] }>;
  /** Select multiple nodes by uniqueId, replacing or adding to current selection. */
  selectMultiple: (uniqueIds: number[], additive?: boolean) => void;
  /** Suppresses the next POINTERPICK event (used by marquee selection to prevent double-fire). */
  suppressNextPick: () => void;
  dispose: () => void;
}

function isHelperNode(node: SelectableSceneNodeLike | null | undefined): boolean {
  if (!node) {
    return false;
  }

  if (node.metadata?.['viewerHelper'] === true) {
    return true;
  }

  const name = (node.name || '').toLowerCase();
  const className = typeof node.getClassName === 'function' ? node.getClassName() : '';

  if (!name || name.startsWith('__root')) {
    return true;
  }

  if (name.includes('viewcube') || name.includes('groundmarker') || name.includes('ground')) {
    return true;
  }

  return className === 'Camera'
    || className === 'FreeCamera'
    || className === 'ArcRotateCamera'
    || className === 'HemisphericLight'
    || className === 'DirectionalLight';
}

function shouldIncludeSceneNode(node: SelectableSceneNodeLike | null | undefined): node is SelectableSceneNodeLike {
  if (!node || isHelperNode(node)) {
    return false;
  }

  const className = typeof node.getClassName === 'function' ? node.getClassName() : '';
  return className === 'TransformNode' || className === 'Mesh' || className === 'InstancedMesh';
}

function hasRenderableGeometry(node: SelectableSceneNodeLike): boolean {
  return !!(typeof node.getTotalVertices === 'function' && node.getTotalVertices() > 0);
}

function isRenderableMesh(node: SelectableSceneNodeLike): node is SelectableSceneMeshLike {
  return hasRenderableGeometry(node)
    && 'renderOverlay' in node
    && 'overlayColor' in node
    && 'overlayAlpha' in node;
}

function getRenderableMeshesFromNode(node: SelectableSceneNodeLike): SelectableSceneMeshLike[] {
  const renderableMeshes: SelectableSceneMeshLike[] = [];

  if (isRenderableMesh(node) && !node.isDisposed?.()) {
    renderableMeshes.push(node);
  }

  const children = typeof node.getChildren === 'function' ? node.getChildren() : [];
  for (const child of children) {
    if (shouldIncludeSceneNode(child)) {
      renderableMeshes.push(...getRenderableMeshesFromNode(child));
    }
  }

  return renderableMeshes;
}

function getEffectiveRootNodes(scene: Scene): SelectableSceneNodeLike[] {
  if (!Array.isArray(scene.rootNodes)) {
    return [];
  }

  const roots = scene.rootNodes as SelectableSceneNodeLike[];
  const effectiveRoots: SelectableSceneNodeLike[] = [];

  for (const root of roots) {
    if (!root) {
      continue;
    }

    const rootName = (root.name || '').toLowerCase();
    if (rootName.startsWith('__root')) {
      const children = typeof root.getChildren === 'function' ? root.getChildren() : [];
      for (const child of children) {
        if (!isHelperNode(child)) {
          effectiveRoots.push(child);
        }
      }
      continue;
    }

    if (!isHelperNode(root)) {
      effectiveRoots.push(root);
    }
  }

  return effectiveRoots;
}

export function createViewerSceneSelectionFeature(
  config: ViewerSceneSelectionFeatureConfig
): ViewerSceneSelectionFeature {
  const { scene, ground, selectionColors, isIsolationActive, onSelectionChanged, onSelectionRendered } = config;

  const nodeMap = new Map<number, SelectableSceneNodeLike>();
  let suppressPickCount = 0;

  const selectionOutlineLayer = new SelectionOutlineLayer('selection-outline', scene, {
    mainTextureRatio: 1.0
  });
  selectionOutlineLayer.outlineColor = Color3.FromArray(selectionColors.outlineColor);

  const selectionOverlayColor = Color3.FromArray(selectionColors.overlayColor);
  let effectiveRootIdSet = new Set<number>();
  // Multi-selection: map of selected nodes by uniqueId
  const selectedNodes = new Map<number, SelectableSceneNodeLike>();
  let selectedMeshes: SelectableSceneMeshLike[] = [];

  const requestRender = (): void => {
    onSelectionRendered?.();
  };

  const clearSelectionVisuals = (): void => {
    for (const mesh of selectedMeshes) {
      if (mesh.isDisposed?.()) {
        continue;
      }

      mesh.renderOverlay = false;
    }

    selectionOutlineLayer.clearSelection();
    selectedMeshes = [];
  };

  const clearSelection = (): void => {
    clearSelectionVisuals();
    selectedNodes.clear();
    onSelectionChanged?.([]);
    requestRender();
  };

  const getAllSelectableNodes = (): Array<{ nodeUniqueId: number; meshes: AbstractMesh[] }> => {
    const result: Array<{ nodeUniqueId: number; meshes: AbstractMesh[] }> = [];
    for (const uniqueId of effectiveRootIdSet) {
      const node = nodeMap.get(uniqueId);
      if (!node) continue;
      const meshes = getRenderableMeshesFromNode(node) as AbstractMesh[];
      if (meshes.length > 0) result.push({ nodeUniqueId: uniqueId, meshes });
    }
    return result;
  };

  const selectMultiple = (uniqueIds: number[], additive = false): void => {
    if (!additive) selectedNodes.clear();
    for (const id of uniqueIds) {
      const node = nodeMap.get(id);
      if (node) selectedNodes.set(id, node);
    }
    rebuildSelectionVisuals();
    onSelectionChanged?.(buildSelectionChanges());
    requestRender();
  };

  const buildSelectionChanges = (): ViewerSceneSelectionChange[] =>
    Array.from(selectedNodes.values()).map(node => ({
      uniqueId: node.uniqueId,
      nodeId: node.id,
      nodeName: node.name || `node_${node.uniqueId}`,
      treeNodeId: `node_${node.uniqueId}`
    }));

  const rebuildSelectionVisuals = (): void => {
    // Clear visuals then reapply for all selected nodes
    for (const mesh of selectedMeshes) {
      if (!mesh.isDisposed?.()) mesh.renderOverlay = false;
    }
    selectionOutlineLayer.clearSelection();
    selectedMeshes = [];

    for (const node of selectedNodes.values()) {
      const meshes = getRenderableMeshesFromNode(node);
      for (const mesh of meshes) {
        mesh.overlayColor = selectionOverlayColor;
        mesh.overlayAlpha = SELECTION_OVERLAY_ALPHA;
        mesh.renderOverlay = true;
      }
      if (meshes.length > 0) selectionOutlineLayer.addSelection(meshes);
      selectedMeshes.push(...meshes);
    }
  };

  const getSelectableAncestor = (node: SelectableSceneNodeLike | null | undefined): SelectableSceneNodeLike | null => {
    if (!node) {
      return null;
    }

    if (effectiveRootIdSet.has(node.uniqueId)) {
      return node;
    }

    let current: SelectableSceneNodeLike | null | undefined = node;
    while (current?.parent) {
      if (effectiveRootIdSet.has(current.parent.uniqueId)) {
        return current.parent;
      }
      current = current.parent;
    }

    return nodeMap.get(node.uniqueId) ?? null;
  };

  const selectNodeByUniqueId = (uniqueId: number, suppressEvent = false, additive = false): void => {
    const node = nodeMap.get(uniqueId);
    if (!node) {
      return;
    }

    if (additive) {
      // Toggle: if already selected, deselect it
      if (selectedNodes.has(uniqueId)) {
        selectedNodes.delete(uniqueId);
      } else {
        selectedNodes.set(uniqueId, node);
      }
    } else {
      // Replace selection
      selectedNodes.clear();
      selectedNodes.set(uniqueId, node);
    }

    rebuildSelectionVisuals();

    if (!suppressEvent) {
      onSelectionChanged?.(buildSelectionChanges());
    }
    requestRender();
  };

  const selectByTreeNodeId = (treeNodeId: string, suppressEvent = false, additive = false): void => {
    const numericId = parseInt(treeNodeId.replace(/^node_/, ''), 10);
    if (!isNaN(numericId) && nodeMap.has(numericId)) {
      selectNodeByUniqueId(numericId, suppressEvent, additive);
    }
  };

  const rebuildSelectableNodes = (): void => {
    nodeMap.clear();

    const effectiveRootNodes = getEffectiveRootNodes(scene).filter(node => shouldIncludeSceneNode(node));
    effectiveRootIdSet = new Set(effectiveRootNodes.map(node => node.uniqueId));

    for (const rootNode of effectiveRootNodes) {
      const stack: SelectableSceneNodeLike[] = [rootNode];
      while (stack.length > 0) {
        const currentNode = stack.pop();
        if (!currentNode) {
          continue;
        }

        nodeMap.set(currentNode.uniqueId, currentNode);

        const children = typeof currentNode.getChildren === 'function' ? currentNode.getChildren() : [];
        for (const child of children) {
          if (shouldIncludeSceneNode(child)) {
            stack.push(child);
          }
        }
      }
    }

    selectedNodes.clear();
    clearSelectionVisuals();
  };

  const pointerObserver: Nullable<Observer<PointerInfo>> = scene.onPointerObservable.add(pointerInfo => {
    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) {
      return;
    }

    if (!(pointerInfo.event instanceof PointerEvent) || pointerInfo.event.button !== 0) {
      return;
    }

    // Marquee selection may suppress the next pick to avoid double-fire
    if (suppressPickCount > 0) {
      suppressPickCount--;
      return;
    }


    // CAD-like picking policy:
    // 1) Always try model pick first, even if the grid/ground is in front from the current orbit angle.
    // 2) Use ground pick only as deselection fallback when no selectable model node is hit.
    // This prevents the grid from blocking part selection.
    const modelPick = scene.pick(
      scene.pointerX,
      scene.pointerY,
      mesh => mesh !== ground && nodeMap.has(mesh.uniqueId),
      false
    );

    const pickedModelMesh = modelPick?.pickedMesh as SelectableSceneNodeLike | null | undefined;
    if (pickedModelMesh) {
      const selectableNode = getSelectableAncestor(pickedModelMesh);
      if (selectableNode) {
        const additive = pointerInfo.event instanceof PointerEvent && pointerInfo.event.shiftKey;
        selectNodeByUniqueId(selectableNode.uniqueId, false, additive);
      }
      return;
    }

    const groundPick = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh === ground, false);
    if (groundPick?.hit && !isIsolationActive?.()) {
      clearSelection();
    }
  });

  return {
    rebuildSelectableNodes,
    clearSelection,
    clearHighlights: () => { clearSelectionVisuals(); requestRender(); },
    getSelectedMeshes: () => selectedMeshes as AbstractMesh[],
    selectByTreeNodeId,
    getAllSelectableNodes,
    selectMultiple,
    suppressNextPick: () => { suppressPickCount++; },
    dispose: () => {
      clearSelectionVisuals();
      if (pointerObserver) {
        scene.onPointerObservable.remove(pointerObserver);
      }
      selectionOutlineLayer.dispose();
    }
  };
}