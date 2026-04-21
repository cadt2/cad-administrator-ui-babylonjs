import { type EnvironmentDefinition } from '../models/environment.model';

export const ENVIRONMENTS: EnvironmentDefinition[] = [
  {
    id: 'env-3d-viewer',
    label: '3D VIEWER',
    icon: 'mdi mdi-cube-outline'
  }
];

export const ENVIRONMENT_LABELS = ENVIRONMENTS.reduce(
  (labels, environment) => {
    labels[environment.id] = environment.label;
    return labels;
  },
  {} as Record<(typeof ENVIRONMENTS)[number]['id'], string>
);
