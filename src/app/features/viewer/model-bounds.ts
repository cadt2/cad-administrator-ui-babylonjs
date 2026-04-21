import { Vector3 } from '@babylonjs/core';

export interface BoundingBoxLike {
  minimumWorld: Vector3;
  maximumWorld: Vector3;
}

export interface BoundingInfoLike {
  boundingBox: BoundingBoxLike;
}

export interface MeshBoundsLike {
  isDisposed?: () => boolean;
  getBoundingInfo: () => BoundingInfoLike;
}

export interface ComputeModelBoundsOptions {
  refreshBounds?: boolean;
}

export interface ModelBounds {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  size: Vector3;
  diagonal: number;
  radius: number;
}

function createEmptyBounds(): { min: Vector3; max: Vector3 } {
  return {
    min: new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
    max: new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
  };
}

function expandBoundsWithMesh(bounds: { min: Vector3; max: Vector3 }, mesh: MeshBoundsLike): void {
  try {
    const box = mesh.getBoundingInfo().boundingBox;
    const meshMin = box.minimumWorld;
    const meshMax = box.maximumWorld;

    bounds.min.x = Math.min(bounds.min.x, meshMin.x);
    bounds.min.y = Math.min(bounds.min.y, meshMin.y);
    bounds.min.z = Math.min(bounds.min.z, meshMin.z);

    bounds.max.x = Math.max(bounds.max.x, meshMax.x);
    bounds.max.y = Math.max(bounds.max.y, meshMax.y);
    bounds.max.z = Math.max(bounds.max.z, meshMax.z);
  } catch {
    // Ignore invalid mesh bounds and keep processing remaining meshes.
  }
}

export function computeModelBounds(
  meshes: ReadonlyArray<MeshBoundsLike>,
  options: ComputeModelBoundsOptions = {}
): ModelBounds | null {
  const { refreshBounds = false } = options;
  const bounds = createEmptyBounds();

  for (const mesh of meshes) {
    if (!mesh || mesh.isDisposed?.()) {
      continue;
    }

    if (refreshBounds) {
      try {
        const refreshable = mesh as {
          computeWorldMatrix?: (...args: any[]) => unknown;
          refreshBoundingInfo?: (...args: any[]) => unknown;
        };
        refreshable.computeWorldMatrix?.(true);
        refreshable.refreshBoundingInfo?.(true, true);
      } catch {
        // Keep using current bounds when refresh fails.
      }
    }

    expandBoundsWithMesh(bounds, mesh);
  }

  if (!Number.isFinite(bounds.min.x) || !Number.isFinite(bounds.max.x)) {
    return null;
  }

  const center = new Vector3(
    (bounds.min.x + bounds.max.x) * 0.5,
    (bounds.min.y + bounds.max.y) * 0.5,
    (bounds.min.z + bounds.max.z) * 0.5
  );
  const size = bounds.max.subtract(bounds.min);
  const diagonal = size.length();
  const radius = Math.max(diagonal * 0.5, 0.0001);

  return {
    min: bounds.min,
    max: bounds.max,
    center,
    size,
    diagonal,
    radius
  };
}