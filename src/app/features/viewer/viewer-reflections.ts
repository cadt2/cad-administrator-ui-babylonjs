import {
  CubeTexture,
  Material,
  MultiMaterial,
  PBRBaseMaterial,
  Scene,
  StandardMaterial
} from '@babylonjs/core';

export interface ViewerReflectionConfig {
  enabled: boolean;
  environmentTextureUrl: string;
  sceneEnvironmentIntensity: number;
  materialEnvironmentIntensity: number;
  applyToStandardMaterial: boolean;
  standardReflectionLevel: number;
  exposure: number;
  contrast: number;
}

export const DEFAULT_VIEWER_REFLECTION_CONFIG: ViewerReflectionConfig = {
  enabled: true,
  environmentTextureUrl: 'https://assets.babylonjs.com/environments/environmentSpecular.env',
  sceneEnvironmentIntensity: 1,
  materialEnvironmentIntensity: 1,
  applyToStandardMaterial: true,
  standardReflectionLevel: 0.35,
  exposure: 1,
  contrast: 1
};

export function initializeReflectionEnvironment(scene: Scene, config: ViewerReflectionConfig): void {
  if (!config.enabled) {
    return;
  }

  try {
    const environmentTexture = CubeTexture.CreateFromPrefilteredData(config.environmentTextureUrl, scene);

    scene.environmentTexture = environmentTexture;
    scene.environmentIntensity = config.sceneEnvironmentIntensity;

    if (scene.imageProcessingConfiguration) {
      scene.imageProcessingConfiguration.exposure = config.exposure;
      scene.imageProcessingConfiguration.contrast = config.contrast;
    }
  } catch (error) {
    console.warn('Could not initialize reflection environment', error);
  }
}

export function applyEnvironmentReflectionsToMaterials(
  scene: Scene,
  meshes: Array<{ material?: Material | MultiMaterial | null }>,
  config: ViewerReflectionConfig
): void {
  if (!config.enabled || !scene.environmentTexture) {
    return;
  }

  const materials = new Set<Material>();

  for (const mesh of meshes) {
    const meshMaterial = mesh.material;
    if (!meshMaterial) {
      continue;
    }

    if (meshMaterial instanceof MultiMaterial) {
      for (const subMaterial of meshMaterial.subMaterials) {
        if (subMaterial) {
          materials.add(subMaterial);
        }
      }
      continue;
    }

    materials.add(meshMaterial);
  }

  for (const material of materials) {
    if (material instanceof PBRBaseMaterial) {
      const pbrLike = material as PBRBaseMaterial & {
        reflectionTexture?: unknown;
        environmentIntensity?: number;
      };

      if (!pbrLike.reflectionTexture) {
        pbrLike.reflectionTexture = scene.environmentTexture;
      }

      if (typeof pbrLike.environmentIntensity === 'number') {
        pbrLike.environmentIntensity = config.materialEnvironmentIntensity;
      }
      continue;
    }

    if (config.applyToStandardMaterial && material instanceof StandardMaterial) {
      if (!material.reflectionTexture) {
        material.reflectionTexture = scene.environmentTexture;
      }

      if (material.reflectionTexture) {
        material.reflectionTexture.level = config.standardReflectionLevel;
      }
    }
  }
}