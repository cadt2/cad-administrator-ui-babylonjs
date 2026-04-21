export type EnvironmentId = 'env-3d-viewer' | 'env-pdm' | 'env-inventory';

export const DEFAULT_ENVIRONMENT: EnvironmentId = 'env-3d-viewer';

export interface EnvironmentDefinition {
  id: EnvironmentId;
  label: string;
  icon: string;
}
