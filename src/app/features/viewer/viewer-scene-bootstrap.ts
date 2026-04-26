import {
  ArcRotateCamera,
  Color3,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  Vector3
} from '@babylonjs/core';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import {
  initializeReflectionEnvironment
} from './viewer-reflections';
import {
  type ViewerRenderApi,
  type ViewerSceneConfig
} from './viewer-scene.config';

export type ViewerEngine = Engine | WebGPUEngine;

export interface ViewerEngineCreationResult {
  engine: ViewerEngine;
  activeApi: ViewerRenderApi;
}

export interface ViewerBaseScene {
  scene: Scene;
  camera: ArcRotateCamera;
  ground: Mesh;
  gridMaterial: GridMaterial;
}

export async function createViewerEngine(
  canvas: HTMLCanvasElement,
  sceneConfig: ViewerSceneConfig
): Promise<ViewerEngineCreationResult> {
  const options = {
    antialias: sceneConfig.engine.antialias,
    premultipliedAlpha: sceneConfig.engine.premultipliedAlpha,
    preserveDrawingBuffer: sceneConfig.engine.preserveDrawingBuffer,
    useHighPrecisionMatrix: sceneConfig.engine.useHighPrecisionMatrix,
    adaptToDeviceRatio: sceneConfig.engine.adaptToDeviceRatio,
    powerPreference: sceneConfig.engine.powerPreference
  };

  if (sceneConfig.engine.preferredApi === 'webgpu') {
    const webGpuSupported = await WebGPUEngine.IsSupportedAsync;
    if (webGpuSupported) {
      const webGpuEngine = new WebGPUEngine(canvas, options);
      await webGpuEngine.initAsync();
      return { engine: webGpuEngine, activeApi: 'webgpu' };
    }
    console.warn('WebGPU is not supported in this browser/context. Falling back to WebGL.');
  }

  const webGlEngine = new Engine(canvas, true, options);
  return { engine: webGlEngine, activeApi: 'webgl' };
}

export function createViewerBaseScene(
  engine: ViewerEngine,
  canvas: HTMLCanvasElement,
  sceneConfig: ViewerSceneConfig
): ViewerBaseScene {
  const scene = new Scene(engine);
  engine.setHardwareScalingLevel(sceneConfig.engine.hardwareScalingLevel);

  scene.imageProcessingConfiguration.toneMappingEnabled = sceneConfig.scene.toneMappingEnabled;
  scene.imageProcessingConfiguration.toneMappingType = sceneConfig.scene.toneMappingType;
  initializeReflectionEnvironment(scene, sceneConfig.environment.reflections);

  const camera = new ArcRotateCamera(
    'mainCamera',
    sceneConfig.camera.alpha,
    sceneConfig.camera.beta,
    sceneConfig.camera.initialRadius,
    Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);

  new HemisphericLight('mainLight', new Vector3(1, 1, 0), scene);

  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
  ground.isVisible = sceneConfig.grid.enabled && sceneConfig.ground.enabled;
  ground.isPickable = ground.isVisible;

  const gridMaterial = new GridMaterial('gridMaterial', scene);
  gridMaterial.majorUnitFrequency = sceneConfig.grid.majorUnitFrequency;
  gridMaterial.minorUnitVisibility = sceneConfig.grid.minorUnitVisibility;
  gridMaterial.gridRatio = 1;
  gridMaterial.backFaceCulling = false;
  gridMaterial.mainColor = new Color3(
    sceneConfig.grid.mainColor[0],
    sceneConfig.grid.mainColor[1],
    sceneConfig.grid.mainColor[2]
  );
  gridMaterial.lineColor = new Color3(
    sceneConfig.grid.lineColor[0],
    sceneConfig.grid.lineColor[1],
    sceneConfig.grid.lineColor[2]
  );
  gridMaterial.opacity = sceneConfig.grid.opacity;
  ground.material = gridMaterial;

  return {
    scene,
    camera,
    ground,
    gridMaterial
  };
}