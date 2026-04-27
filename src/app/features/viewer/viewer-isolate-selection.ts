import { type AbstractMesh } from '@babylonjs/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ViewerIsolateSelectionConfig {
  getAllModelMeshes: () => AbstractMesh[];
  getGroundMesh: () => AbstractMesh;
  getSelectedMeshes: () => AbstractMesh[];
  onIsolationChanged?: (active: boolean) => void;
  onRequestRender?: () => void;
}

export interface ViewerIsolateSelectionFeature {
  /** Toggle isolation on/off. Returns the new active state. */
  toggle: () => boolean;
  /** Returns true if isolation is currently active. */
  isActive: () => boolean;
  /** Called when a new model is loaded — resets isolation state. */
  reset: () => void;
  dispose: () => void;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createViewerIsolateSelectionFeature(
  config: ViewerIsolateSelectionConfig
): ViewerIsolateSelectionFeature {
  const { getAllModelMeshes, getGroundMesh, getSelectedMeshes, onIsolationChanged, onRequestRender } = config;

  let isolationActive = false;
  // Stores original isVisible state before isolation is applied
  const originalIsVisible = new Map<AbstractMesh, boolean>();
  const originalPickable = new Map<AbstractMesh, boolean>();

  const requestRender = (): void => {
    onRequestRender?.();
  };

  const restoreAll = (): void => {
    for (const [mesh, wasVisible] of originalIsVisible) {
      if (mesh.isDisposed?.()) continue;
      try { mesh.isVisible = wasVisible; } catch { /* no-op */ }
    }
    for (const [mesh, pickable] of originalPickable) {
      if (mesh.isDisposed?.()) continue;
      try { mesh.isPickable = pickable; } catch { /* no-op */ }
    }
    originalIsVisible.clear();
    originalPickable.clear();
  };

  const applyIsolation = (selectedMeshes: AbstractMesh[]): void => {
    const ground = getGroundMesh();
    const allMeshes = getAllModelMeshes();
    if (!allMeshes.length) return;

    const selSet = new Set(selectedMeshes.map(m => m.uniqueId));

    for (const mesh of allMeshes) {
      if (!mesh || mesh === ground || mesh.isDisposed?.()) continue;

      // Snapshot original state before first mutation
      if (!originalPickable.has(mesh)) {
        originalPickable.set(mesh, mesh.isPickable);
      }
      if (!originalIsVisible.has(mesh)) {
        originalIsVisible.set(mesh, mesh.isVisible);
      }

      if (selSet.has(mesh.uniqueId)) {
        // Selected meshes: visible + pickable
        try { mesh.isVisible = true; } catch { /* no-op */ }
        try { mesh.isPickable = true; } catch { /* no-op */ }
      } else {
        // Non-selected meshes: hidden + non-pickable
        try { mesh.isVisible = false; } catch { /* no-op */ }
        try { mesh.isPickable = false; } catch { /* no-op */ }
      }
    }
  };

  const toggle = (): boolean => {
    if (isolationActive) {
      // Exit isolation — restore all meshes
      restoreAll();
      isolationActive = false;
      onIsolationChanged?.(false);
      requestRender();
      return false;
    }

    // Enter isolation — requires an active selection
    const selectedMeshes = getSelectedMeshes();
    if (!selectedMeshes.length) {
      return false;
    }

    applyIsolation(selectedMeshes);
    isolationActive = true;
    onIsolationChanged?.(true);
    requestRender();
    return true;
  };

  const isActive = (): boolean => isolationActive;

  const reset = (): void => {
    if (isolationActive) {
      restoreAll();
      isolationActive = false;
      onIsolationChanged?.(false);
    }
    originalIsVisible.clear();
    originalPickable.clear();
  };

  return {
    toggle,
    isActive,
    reset,
    dispose: reset
  };
}
