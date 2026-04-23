import { ArcRotateCamera, Mesh, Scene, Vector3 } from '@babylonjs/core';
import { createOrbitFeature, OrbitModifierKey } from './orbit-controls';
import { createPanFeature, type ViewerPointerEngine } from './pan-controls';

export interface ViewerInteractionControlsConfig {
  scene: Scene;
  engine: ViewerPointerEngine;
  canvas: HTMLCanvasElement;
  camera: ArcRotateCamera;
  ground: Mesh;
  getCurrentRadius: () => number;
  orbitSensitivity: number;
  orbitModifierKey?: OrbitModifierKey;
  radiusSensitivityExponent?: number;
  minRadiusForSensitivity?: number;
  onInteraction?: () => void;
}

export interface ViewerInteractionControls {
  dispose: () => void;
}

interface PointerRenderCoordinates {
  x: number;
  y: number;
}

export function attachViewerInteractionControls(config: ViewerInteractionControlsConfig): ViewerInteractionControls {
  const {
    scene,
    engine,
    canvas,
    camera,
    ground,
    getCurrentRadius,
    orbitSensitivity,
    orbitModifierKey = 'shift',
    radiusSensitivityExponent = 1 / 3,
    minRadiusForSensitivity = 0.0001,
    onInteraction
  } = config;

  const pointerInput = camera.inputs?.attached?.['pointers'];
  if (pointerInput && 'buttons' in pointerInput) {
    const typedPointerInput = pointerInput as { buttons: number[] };
    typedPointerInput.buttons = [];
  }

  const orbitFeature = createOrbitFeature({
    camera,
    getCurrentRadius,
    orbitSensitivity,
    orbitModifierKey,
    radiusSensitivityExponent,
    minRadiusForSensitivity
  });

  const panFeature = createPanFeature({
    scene,
    engine,
    camera,
    ground
  });

  let middleMouseDown = false;
  let isOrbitMode = false;
  let panStartGroundPoint: Vector3 | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const requestInteractionRender = (): void => {
    onInteraction?.();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 1) {
      return;
    }

    middleMouseDown = true;
    isOrbitMode = orbitFeature.isModifierActive(event);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    panStartGroundPoint = isOrbitMode ? null : panFeature.pickGroundPoint(event);

    requestInteractionRender();
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!middleMouseDown) {
      return;
    }

    if (orbitFeature.isModifierActive(event) !== isOrbitMode) {
      isOrbitMode = orbitFeature.isModifierActive(event);
      panStartGroundPoint = isOrbitMode ? null : panFeature.pickGroundPoint(event);
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    }

    if (isOrbitMode) {
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      orbitFeature.applyOrbitDrag(dx, dy);
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      requestInteractionRender();
      event.preventDefault();
      return;
    }

    const currentGroundPoint = panFeature.pickGroundPoint(event);
    if (!panStartGroundPoint || !currentGroundPoint) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      requestInteractionRender();
      event.preventDefault();
      return;
    }

    panFeature.applyPanDelta(panStartGroundPoint, currentGroundPoint);

    panStartGroundPoint = panFeature.pickGroundPoint(event);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    requestInteractionRender();
    event.preventDefault();
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 1) {
      return;
    }

    middleMouseDown = false;
    isOrbitMode = false;
    panStartGroundPoint = null;

    requestInteractionRender();
    event.preventDefault();
  };

  const onPointerLeave = (): void => {
    middleMouseDown = false;
    isOrbitMode = false;
    panStartGroundPoint = null;
  };

  const onAuxClick = (event: MouseEvent): void => {
    if (event.button === 1) {
      event.preventDefault();
    }
  };

  const onWheel = (): void => {
    requestInteractionRender();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointercancel', onPointerLeave);
  canvas.addEventListener('auxclick', onAuxClick);
  canvas.addEventListener('wheel', onWheel);

  return {
    dispose: () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerLeave);
      canvas.removeEventListener('auxclick', onAuxClick);
      canvas.removeEventListener('wheel', onWheel);
    }
  };
}
