import { ArcRotateCamera } from '@babylonjs/core';

export type OrbitModifierKey = 'shift' | 'ctrl' | 'alt' | 'meta';

export interface OrbitFeatureConfig {
  camera: ArcRotateCamera;
  getCurrentRadius: () => number;
  orbitSensitivity: number;
  orbitModifierKey: OrbitModifierKey;
  radiusSensitivityExponent: number;
  minRadiusForSensitivity: number;
}

export interface OrbitFeature {
  isModifierActive: (event: PointerEvent) => boolean;
  applyOrbitDrag: (dx: number, dy: number) => void;
}

export function createOrbitFeature(config: OrbitFeatureConfig): OrbitFeature {
  const {
    camera,
    getCurrentRadius,
    orbitSensitivity,
    orbitModifierKey,
    radiusSensitivityExponent,
    minRadiusForSensitivity
  } = config;

  const isModifierActive = (event: PointerEvent): boolean => {
    switch (orbitModifierKey) {
      case 'ctrl':
        return !!event.ctrlKey;
      case 'alt':
        return !!event.altKey;
      case 'meta':
        return !!event.metaKey;
      case 'shift':
      default:
        return !!event.shiftKey;
    }
  };

  const computeOrbitSensitivity = (): number => {
    const radius = Math.max(getCurrentRadius(), minRadiusForSensitivity);
    const radiusFactor = Math.pow(radius, radiusSensitivityExponent);
    return orbitSensitivity / Math.max(radiusFactor, 0.000001);
  };

  const applyOrbitDrag = (dx: number, dy: number): void => {
    const sensitivity = computeOrbitSensitivity();
    camera.inertialAlphaOffset -= dx * sensitivity;
    camera.inertialBetaOffset -= dy * sensitivity;
  };

  return {
    isModifierActive,
    applyOrbitDrag
  };
}
