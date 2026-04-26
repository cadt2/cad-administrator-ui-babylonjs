import {
  ArcRotateCamera,
  Scene,
  SceneLoader,
  type Material,
  type MultiMaterial
} from '@babylonjs/core';
import { computeModelBounds, type MeshBoundsLike, type ModelBounds } from './model-bounds';
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
  sceneConfig: ViewerSceneConfig;
  modelRootUrl: string;
  modelFileName: string;
  shouldAbort: () => boolean;
  onModelLoaded: (event: ViewerModelLoadedEvent) => void;
  onModelRadiusUpdated: (radius: number) => void;
  onModelBoundsUpdated?: (bounds: ModelBounds) => void;
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
    sceneConfig,
    modelRootUrl,
    modelFileName,
    shouldAbort,
    onModelLoaded,
    onModelRadiusUpdated,
    onModelBoundsUpdated
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
    onModelBoundsUpdated?.(bounds);
    onModelRadiusUpdated(bounds.radius);
    camera.lowerRadiusLimit = Math.max(bounds.radius * sceneConfig.camera.lowerRadiusFactor, 0.01);
    camera.upperRadiusLimit = bounds.radius * sceneConfig.camera.upperRadiusFactor;
    camera.radius = Math.max(bounds.radius * 2.2, camera.lowerRadiusLimit + 0.1);
    camera.minZ = Math.max(bounds.radius * sceneConfig.camera.minZFactor, 0.001);
    camera.maxZ = bounds.radius * sceneConfig.camera.maxZFactor;
    camera.wheelDeltaPercentage = sceneConfig.camera.wheelDeltaPercentage;
    camera.pinchDeltaPercentage = sceneConfig.camera.pinchDeltaPercentage;

    scene.skipFrustumClipping = sceneConfig.performance.skipFrustumClipping;
    scene.environmentIntensity = sceneConfig.environment.reflections.sceneEnvironmentIntensity;
  });
}