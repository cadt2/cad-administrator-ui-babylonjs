import { ArcRotateCamera, Mesh, Scene, Vector3 } from '@babylonjs/core';

export interface ViewerPointerEngine {
  getRenderingCanvasClientRect: () => DOMRect | null;
  getRenderingCanvas: () => HTMLCanvasElement | null;
  getRenderWidth: () => number;
  getRenderHeight: () => number;
}

export interface PanFeatureConfig {
  scene: Scene;
  engine: ViewerPointerEngine;
  camera: ArcRotateCamera;
  ground: Mesh;
}

export interface PanFeature {
  pickGroundPoint: (event: PointerEvent) => Vector3 | null;
  applyPanDelta: (startPoint: Vector3, currentPoint: Vector3) => void;
}

interface PointerRenderCoordinates {
  x: number;
  y: number;
}

function getPointerRenderCoordinates(event: PointerEvent, engine: ViewerPointerEngine): PointerRenderCoordinates {
  const canvasRect =
    engine.getRenderingCanvasClientRect() ??
    engine.getRenderingCanvas()?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
      width: 1,
      height: 1
    };

  const renderWidth = Math.max(engine.getRenderWidth(), 1);
  const renderHeight = Math.max(engine.getRenderHeight(), 1);
  const localX = event.clientX - canvasRect.left;
  const localY = event.clientY - canvasRect.top;
  const safeWidth = Math.max(canvasRect.width, 1);
  const safeHeight = Math.max(canvasRect.height, 1);

  return {
    x: (localX / safeWidth) * renderWidth,
    y: (localY / safeHeight) * renderHeight
  };
}

export function createPanFeature(config: PanFeatureConfig): PanFeature {
  const { scene, engine, camera, ground } = config;

  const pickGroundPoint = (event: PointerEvent): Vector3 | null => {
    const pointer = getPointerRenderCoordinates(event, engine);
    const pick = scene.pick(pointer.x, pointer.y, mesh => mesh === ground, false, camera);
    if (!pick?.hit || !pick.pickedPoint) {
      return null;
    }

    return pick.pickedPoint.clone();
  };

  const applyPanDelta = (startPoint: Vector3, currentPoint: Vector3): void => {
    const delta = startPoint.subtract(currentPoint);
    camera.target.addInPlace(delta);
  };

  return {
    pickGroundPoint,
    applyPanDelta
  };
}
