import { Color4, ImageProcessingConfiguration } from '@babylonjs/core';
import {
  DEFAULT_VIEWER_REFLECTION_CONFIG,
  type ViewerReflectionConfig
} from './viewer-reflections';

export type ViewerRenderApi = 'webgl' | 'webgpu';
export type RgbaTuple = [number, number, number, number];
export type RgbTuple = [number, number, number];

export interface ViewerSceneConfig {
  ui: {
    showViewerTools: boolean;
  };
  engine: {
    preferredApi: ViewerRenderApi;
    allowRuntimeApiSwitch: boolean;
    antialias: boolean;
    useHighPrecisionMatrix: boolean;
    premultipliedAlpha: boolean;
    preserveDrawingBuffer: boolean;
    adaptToDeviceRatio: boolean;
    hardwareScalingLevel: number;
    powerPreference: 'default' | 'high-performance' | 'low-power';
  };
  scene: {
    clearColorDark: RgbaTuple;
    clearColorLight: RgbaTuple;
    toneMappingEnabled: boolean;
    toneMappingType: number;
  };
  performance: {
    skipFrustumClipping: boolean;
  };
  camera: {
    alpha: number;
    beta: number;
    initialRadius: number;
    lowerRadiusFactor: number;
    upperRadiusFactor: number;
    minZFactor: number;
    maxZFactor: number;
    wheelDeltaPercentage: number;
    pinchDeltaPercentage: number;
    panningSensibilityFactor: number;
    speedFactor: number;
  };
  ground: {
    enabled: boolean;
    minSize: number;
    sizeFromBoundsMultiplier: number;
    offsetFromRadiusFactor: number;
    minOffset: number;
  };
  grid: {
    enabled: boolean;
    majorUnitFrequency: number;
    minorUnitVisibility: number;
    gridRatioFromBoundsDivisor: number;
    minGridRatio: number;
    opacity: number;
    mainColor: RgbTuple;
    lineColor: RgbTuple;
  };
  selection: {
    overlayColor: RgbTuple;
    outlineColor: RgbTuple;
  };
  environment: {
    reflections: ViewerReflectionConfig;
  };
}

export const DEFAULT_VIEWER_SCENE_CONFIG: ViewerSceneConfig = {
  ui: {
    showViewerTools: true
  },
  engine: {
    preferredApi: 'webgl',
    allowRuntimeApiSwitch: true,
    antialias: true,
    useHighPrecisionMatrix: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    adaptToDeviceRatio: true,
    hardwareScalingLevel: 1,
    powerPreference: 'high-performance'
  },
  scene: {
    clearColorDark: [0.145, 0.145, 0.145, 1],
    clearColorLight: [0.9, 0.96, 1, 1],
    toneMappingEnabled: true,
    toneMappingType: ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL
  },
  performance: {
    skipFrustumClipping: true
  },
  camera: {
    alpha: Math.PI / 4,
    beta: Math.PI / 3,
    initialRadius: 8,
    lowerRadiusFactor: 0.01,
    upperRadiusFactor: 5,
    minZFactor: 0.001,
    maxZFactor: 1000,
    wheelDeltaPercentage: 0.01,
    pinchDeltaPercentage: 0.01,
    panningSensibilityFactor: 5000,
    speedFactor: 0.2
  },
  ground: {
    enabled: true,
    minSize: 20,
    sizeFromBoundsMultiplier: 2,
    offsetFromRadiusFactor: 0.01,
    minOffset: 0.001
  },
  grid: {
    enabled: true,
    majorUnitFrequency: 5,
    minorUnitVisibility: 0.45,
    gridRatioFromBoundsDivisor: 40,
    minGridRatio: 0.02,
    opacity: 0.85,
    mainColor: [1, 1, 1],
    lineColor: [0.7, 0.7, 0.7]
  },
  selection: {
    overlayColor: [0.31, 0.86, 0.45],
    outlineColor: [1, 0.5, 0]
  },
  environment: {
    reflections: DEFAULT_VIEWER_REFLECTION_CONFIG
  }
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseRenderApi(value: unknown, fallback: ViewerRenderApi): ViewerRenderApi {
  return value === 'webgpu' || value === 'webgl' ? value : fallback;
}

function parsePowerPreference(
  value: unknown,
  fallback: ViewerSceneConfig['engine']['powerPreference']
): ViewerSceneConfig['engine']['powerPreference'] {
  return value === 'default' || value === 'high-performance' || value === 'low-power'
    ? value
    : fallback;
}

function parseRgbTuple(value: unknown, fallback: RgbTuple): RgbTuple {
  if (!Array.isArray(value) || value.length !== 3) {
    return fallback;
  }

  return [
    clamp(parseNumber(value[0], fallback[0]), 0, 1),
    clamp(parseNumber(value[1], fallback[1]), 0, 1),
    clamp(parseNumber(value[2], fallback[2]), 0, 1)
  ];
}

function parseRgbaTuple(value: unknown, fallback: RgbaTuple): RgbaTuple {
  if (!Array.isArray(value) || value.length !== 4) {
    return fallback;
  }

  return [
    clamp(parseNumber(value[0], fallback[0]), 0, 1),
    clamp(parseNumber(value[1], fallback[1]), 0, 1),
    clamp(parseNumber(value[2], fallback[2]), 0, 1),
    clamp(parseNumber(value[3], fallback[3]), 0, 1)
  ];
}

export function toColor4(value: RgbaTuple): Color4 {
  return new Color4(value[0], value[1], value[2], value[3]);
}

export function rgbTupleToHex(value: RgbTuple): string {
  const channels = value.map(channel => Math.round(clamp(channel, 0, 1) * 255));
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function parseHexColor(hex: string, fallback: RgbTuple): RgbTuple {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) {
    return fallback;
  }

  const raw = match[1];
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function parseReflectionConfig(input: unknown): ViewerReflectionConfig {
  const defaults = DEFAULT_VIEWER_REFLECTION_CONFIG;
  if (!input || typeof input !== 'object') {
    return defaults;
  }

  const raw = input as Record<string, unknown>;
  return {
    enabled: parseBoolean(raw['enabled'], defaults.enabled),
    environmentTextureUrl:
      typeof raw['environmentTextureUrl'] === 'string' && raw['environmentTextureUrl'].length > 0
        ? raw['environmentTextureUrl']
        : defaults.environmentTextureUrl,
    sceneEnvironmentIntensity: parseNumber(raw['sceneEnvironmentIntensity'], defaults.sceneEnvironmentIntensity),
    materialEnvironmentIntensity: parseNumber(raw['materialEnvironmentIntensity'], defaults.materialEnvironmentIntensity),
    applyToStandardMaterial: parseBoolean(raw['applyToStandardMaterial'], defaults.applyToStandardMaterial),
    standardReflectionLevel: parseNumber(raw['standardReflectionLevel'], defaults.standardReflectionLevel),
    exposure: parseNumber(raw['exposure'], defaults.exposure),
    contrast: parseNumber(raw['contrast'], defaults.contrast)
  };
}

export function parseViewerSceneConfig(input: unknown): ViewerSceneConfig {
  const defaults = DEFAULT_VIEWER_SCENE_CONFIG;
  if (!input || typeof input !== 'object') {
    return defaults;
  }

  const raw = input as Record<string, unknown>;
  const rawUi = (raw['ui'] as Record<string, unknown> | undefined) ?? {};
  const rawEngine = (raw['engine'] as Record<string, unknown> | undefined) ?? {};
  const rawScene = (raw['scene'] as Record<string, unknown> | undefined) ?? {};
  const rawPerformance = (raw['performance'] as Record<string, unknown> | undefined) ?? {};
  const rawCamera = (raw['camera'] as Record<string, unknown> | undefined) ?? {};
  const rawGround = (raw['ground'] as Record<string, unknown> | undefined) ?? {};
  const rawGrid = (raw['grid'] as Record<string, unknown> | undefined) ?? {};
  const rawSelection = (raw['selection'] as Record<string, unknown> | undefined) ?? {};
  const rawEnvironment = (raw['environment'] as Record<string, unknown> | undefined) ?? {};
  const rawReflections = (rawEnvironment['reflections'] as Record<string, unknown> | undefined) ?? {};

  return {
    ui: {
      showViewerTools: parseBoolean(rawUi['showViewerTools'], defaults.ui.showViewerTools)
    },
    engine: {
      preferredApi: parseRenderApi(rawEngine['preferredApi'], defaults.engine.preferredApi),
      allowRuntimeApiSwitch: parseBoolean(rawEngine['allowRuntimeApiSwitch'], defaults.engine.allowRuntimeApiSwitch),
      antialias: parseBoolean(rawEngine['antialias'], defaults.engine.antialias),
      useHighPrecisionMatrix: parseBoolean(rawEngine['useHighPrecisionMatrix'], defaults.engine.useHighPrecisionMatrix),
      premultipliedAlpha: parseBoolean(rawEngine['premultipliedAlpha'], defaults.engine.premultipliedAlpha),
      preserveDrawingBuffer: parseBoolean(rawEngine['preserveDrawingBuffer'], defaults.engine.preserveDrawingBuffer),
      adaptToDeviceRatio: parseBoolean(rawEngine['adaptToDeviceRatio'], defaults.engine.adaptToDeviceRatio),
      hardwareScalingLevel: clamp(parseNumber(rawEngine['hardwareScalingLevel'], defaults.engine.hardwareScalingLevel), 0.25, 4),
      powerPreference: parsePowerPreference(rawEngine['powerPreference'], defaults.engine.powerPreference)
    },
    scene: {
      clearColorDark: parseRgbaTuple(rawScene['clearColorDark'], defaults.scene.clearColorDark),
      clearColorLight: parseRgbaTuple(rawScene['clearColorLight'], defaults.scene.clearColorLight),
      toneMappingEnabled: parseBoolean(rawScene['toneMappingEnabled'], defaults.scene.toneMappingEnabled),
      toneMappingType: parseNumber(rawScene['toneMappingType'], defaults.scene.toneMappingType)
    },
    performance: {
      skipFrustumClipping: parseBoolean(rawPerformance['skipFrustumClipping'], defaults.performance.skipFrustumClipping)
    },
    camera: {
      alpha: parseNumber(rawCamera['alpha'], defaults.camera.alpha),
      beta: parseNumber(rawCamera['beta'], defaults.camera.beta),
      initialRadius: parseNumber(rawCamera['initialRadius'], defaults.camera.initialRadius),
      lowerRadiusFactor: clamp(parseNumber(rawCamera['lowerRadiusFactor'], defaults.camera.lowerRadiusFactor), 0.001, 1),
      upperRadiusFactor: parseNumber(rawCamera['upperRadiusFactor'], defaults.camera.upperRadiusFactor),
      minZFactor: parseNumber(rawCamera['minZFactor'], defaults.camera.minZFactor),
      maxZFactor: parseNumber(rawCamera['maxZFactor'], defaults.camera.maxZFactor),
      wheelDeltaPercentage: parseNumber(rawCamera['wheelDeltaPercentage'], defaults.camera.wheelDeltaPercentage),
      pinchDeltaPercentage: parseNumber(rawCamera['pinchDeltaPercentage'], defaults.camera.pinchDeltaPercentage),
      panningSensibilityFactor: parseNumber(rawCamera['panningSensibilityFactor'], defaults.camera.panningSensibilityFactor),
      speedFactor: parseNumber(rawCamera['speedFactor'], defaults.camera.speedFactor)
    },
    ground: {
      enabled: parseBoolean(rawGround['enabled'], defaults.ground.enabled),
      minSize: parseNumber(rawGround['minSize'], defaults.ground.minSize),
      sizeFromBoundsMultiplier: parseNumber(rawGround['sizeFromBoundsMultiplier'], defaults.ground.sizeFromBoundsMultiplier),
      offsetFromRadiusFactor: parseNumber(rawGround['offsetFromRadiusFactor'], defaults.ground.offsetFromRadiusFactor),
      minOffset: parseNumber(rawGround['minOffset'], defaults.ground.minOffset)
    },
    grid: {
      enabled: parseBoolean(rawGrid['enabled'], defaults.grid.enabled),
      majorUnitFrequency: parseNumber(rawGrid['majorUnitFrequency'], defaults.grid.majorUnitFrequency),
      minorUnitVisibility: clamp(parseNumber(rawGrid['minorUnitVisibility'], defaults.grid.minorUnitVisibility), 0, 1),
      gridRatioFromBoundsDivisor: Math.max(parseNumber(rawGrid['gridRatioFromBoundsDivisor'], defaults.grid.gridRatioFromBoundsDivisor), 0.0001),
      minGridRatio: parseNumber(rawGrid['minGridRatio'], defaults.grid.minGridRatio),
      opacity: clamp(parseNumber(rawGrid['opacity'], defaults.grid.opacity), 0, 1),
      mainColor: parseRgbTuple(rawGrid['mainColor'], defaults.grid.mainColor),
      lineColor: parseRgbTuple(rawGrid['lineColor'], defaults.grid.lineColor)
    },
    selection: {
      overlayColor: parseRgbTuple(rawSelection['overlayColor'], defaults.selection.overlayColor),
      outlineColor: parseRgbTuple(rawSelection['outlineColor'], defaults.selection.outlineColor)
    },
    environment: {
      reflections: parseReflectionConfig(rawReflections)
    }
  };
}