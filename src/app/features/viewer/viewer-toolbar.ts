import { Toolbar } from 'dhx-suite';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewerToolbarActionId = 'isolate';

export interface ViewerToolbarConfig {
  onAction: (id: ViewerToolbarActionId) => void;
}

export interface ViewerToolbarFeature {
  toolbar: Toolbar;
  /** Set the pressed/active state of the isolate toggle button. */
  setIsolateState: (active: boolean) => void;
  /** Enable or disable the isolate button (disabled when no selection). */
  setIsolateEnabled: (enabled: boolean) => void;
  attach: (cell: { attach: (component: unknown) => void }) => void;
  dispose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildIsolateButtonData(active: boolean): Record<string, unknown> {
  return {
    id: 'isolate',
    type: 'button',
    icon: active ? 'mdi mdi-cube-scan' : 'mdi mdi-cube-outline',
    tooltip: active ? 'Exit Isolate' : 'Isolate Selection',
    view: 'link',
    size: 'medium',
    css: active ? 'viewer-toolbar-btn viewer-toolbar-btn--active' : 'viewer-toolbar-btn'
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createViewerToolbar(config: ViewerToolbarConfig): ViewerToolbarFeature {
  const { onAction } = config;

  const toolbar = new Toolbar(null as unknown as HTMLElement, {
    css: 'viewer-toolbar',
    data: [
      buildIsolateButtonData(false)
    ]
  });

  // Isolate is disabled until a selection exists
  toolbar.disable('isolate');

  toolbar.events.on('click', (id: string | number) => {
    if (String(id) === 'isolate') {
      onAction('isolate');
    }
  });

  const setIsolateState = (active: boolean): void => {
    toolbar.data.update('isolate', buildIsolateButtonData(active));
  };

  const setIsolateEnabled = (enabled: boolean): void => {
    if (enabled) {
      toolbar.enable('isolate');
    } else {
      // Reset toggle visual before disabling
      setIsolateState(false);
      toolbar.disable('isolate');
    }
  };

  const attach = (cell: { attach: (component: unknown) => void }): void => {
    cell.attach(toolbar);
  };

  return {
    toolbar,
    setIsolateState,
    setIsolateEnabled,
    attach,
    dispose: () => toolbar.destructor()
  };
}
