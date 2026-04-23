import {
  ArcRotateCamera,
  Mesh,
  Scene,
  SceneLoader,
  type Material,
  type MultiMaterial
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import { computeModelBounds, type MeshBoundsLike } from './model-bounds';
import {
  applyEnvironmentReflectionsToMaterials
} from './viewer-reflections';
import {
  type ViewerSceneConfig
} from './viewer-scene.config';

export interface RenderableMeshLike extends MeshBoundsLike {
  material?: Material | MultiMaterial | null;
  getTotalVertices: () => number;
}

export interface ViewerModelLoadedEvent {
  assemblyName: string;
  renderableMeshes: RenderableMeshLike[];
}

export interface ViewerModelLoadOptions {
  scene: Scene;
  camera: ArcRotateCamera;
  ground: Mesh;
  gridMaterial: GridMaterial;
  sceneConfig: ViewerSceneConfig;
  modelRootUrl: string;
  modelFileName: string;
  shouldAbort: () => boolean;
  onModelLoaded: (event: ViewerModelLoadedEvent) => void;
  onModelRadiusUpdated: (radius: number) => void;
}

function asRenderableMesh(mesh: unknown): RenderableMeshLike | null {
  if (!mesh || typeof mesh !== 'object') {
    return null;
  }

  const candidate = mesh as Partial<RenderableMeshLike>;
  if (typeof candidate.getTotalVertices !== 'function') {
    return null;
  }

  if (candidate.getTotalVertices() <= 0) {
    return null;
  }

  if (typeof candidate.getBoundingInfo !== 'function') {
    return null;
  }

  return candidate as RenderableMeshLike;
}

export function loadViewerModel(options: ViewerModelLoadOptions): void {
  const {
    scene,
    camera,
    ground,
    gridMaterial,
    sceneConfig,
    modelRootUrl,
    modelFileName,
    shouldAbort,
    onModelLoaded,
    onModelRadiusUpdated
  } = options;

  const assemblyName = modelFileName.replace(/\.[^/.]+$/, '') || 'assembly';

  SceneLoader.ImportMesh('', modelRootUrl, modelFileName, scene, meshes => {
    if (shouldAbort()) {
      return;
    }

    const renderableMeshes = meshes
      .map(asRenderableMesh)
      .filter((mesh): mesh is RenderableMeshLike => mesh !== null);

    onModelLoaded({
      assemblyName,
      renderableMeshes
    });

    const bounds = computeModelBounds(renderableMeshes, { refreshBounds: true });
    if (!bounds) {
      console.warn('No valid renderable bounds found for model');
      return;
    }

    applyEnvironmentReflectionsToMaterials(scene, renderableMeshes, sceneConfig.environment.reflections);

    camera.setTarget(bounds.center);
    onModelRadiusUpdated(bounds.radius);
    camera.lowerRadiusLimit = Math.max(bounds.radius * sceneConfig.camera.lowerRadiusFactor, 0.01);
    camera.upperRadiusLimit = bounds.radius * sceneConfig.camera.upperRadiusFactor;
    camera.radius = Math.max(bounds.radius * 2.2, camera.lowerRadiusLimit + 0.1);
    camera.minZ = Math.max(bounds.radius * sceneConfig.camera.minZFactor, 0.001);
    camera.maxZ = bounds.radius * sceneConfig.camera.maxZFactor;
    camera.wheelDeltaPercentage = sceneConfig.camera.wheelDeltaPercentage;
    camera.pinchDeltaPercentage = sceneConfig.camera.pinchDeltaPercentage;

    scene.skipFrustumClipping = sceneConfig.performance.skipFrustumClipping;

    const groundSize = Math.max(
      bounds.diagonal * sceneConfig.ground.sizeFromBoundsMultiplier,
      sceneConfig.ground.minSize
    );
    const gridRatio = Math.max(
      bounds.diagonal / sceneConfig.grid.gridRatioFromBoundsDivisor,
      sceneConfig.grid.minGridRatio
    );
    const groundOffset = Math.max(
      bounds.radius * sceneConfig.ground.offsetFromRadiusFactor,
      sceneConfig.ground.minOffset
    );

    ground.position.x = bounds.center.x;
    ground.position.z = bounds.center.z;
    ground.position.y = bounds.min.y - groundOffset;
    ground.scaling.x = groundSize / 20;
    ground.scaling.z = groundSize / 20;

    gridMaterial.gridRatio = gridRatio;
    gridMaterial.majorUnitFrequency = sceneConfig.grid.majorUnitFrequency;
    gridMaterial.minorUnitVisibility = sceneConfig.grid.minorUnitVisibility;
    ground.isVisible = sceneConfig.grid.enabled && sceneConfig.ground.enabled;
    scene.environmentIntensity = sceneConfig.environment.reflections.sceneEnvironmentIntensity;
  });
}