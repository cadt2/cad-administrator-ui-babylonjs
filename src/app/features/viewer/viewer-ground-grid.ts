import { Color3, Mesh, MeshBuilder, Scene } from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import { type ModelBounds } from './model-bounds';
import { type ViewerSceneConfig } from './viewer-scene.config';

export interface ViewerGroundGridFeature {
  ground: Mesh;
  gridMaterial: GridMaterial;
  updateFromBounds: (bounds: ModelBounds) => void;
  dispose: () => void;
}

export function createViewerGroundGrid(
  scene: Scene,
  sceneConfig: ViewerSceneConfig
): ViewerGroundGridFeature {
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

  const updateFromBounds = (bounds: ModelBounds): void => {
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
    ground.isPickable = ground.isVisible;
  };

  return {
    ground,
    gridMaterial,
    updateFromBounds,
    dispose: () => {
      gridMaterial.dispose();
      ground.dispose();
    }
  };
}