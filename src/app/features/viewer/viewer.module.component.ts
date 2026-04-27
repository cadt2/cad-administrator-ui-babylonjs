import {
  AbstractMesh,
  ArcRotateCamera,
  Scene
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { ContextMenu, Layout, Tree } from 'dhx-suite';
import { createViewerGroundGrid, type ViewerGroundGridFeature } from './viewer-ground-grid';
import { createViewerIsolateSelectionFeature, type ViewerIsolateSelectionFeature } from './viewer-isolate-selection';
import { createViewerToolbar, type ViewerToolbarFeature } from './viewer-toolbar';
import { attachViewerInteractionControls, ViewerInteractionControls } from './viewer-interaction-controls';
import { computeModelBounds, type MeshBoundsLike } from './model-bounds';
import {
  loadViewerModel,
  type RenderableMeshLike
} from './viewer-model-loader';
import {
  createViewerSceneSelectionFeature,
  type ViewerSceneSelectionFeature
} from './viewer-scene-selection';
import {
  createViewerBaseScene,
  createViewerEngine,
  type ViewerEngine
} from './viewer-scene-bootstrap';
import {
  DEFAULT_VIEWER_SCENE_CONFIG,
  parseViewerSceneConfig,
  toColor4,
  type ViewerSceneConfig
} from './viewer-scene.config';

// ─── Model Browser Tree ────────────────────────────────────────────────────

interface SceneNodeLike {
  uniqueId: number;
  id: string;
  name?: string;
  parent?: SceneNodeLike | null;
  metadata?: Record<string, unknown>;
  getClassName?: () => string;
  getChildren?: () => SceneNodeLike[];
  getTotalVertices?: () => number;
}

interface ModelBrowserTreeNodeData {
  uniqueId?: number;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  isPart?: boolean;
  isAssemblyRoot?: boolean;
  assemblyName?: string;
}

interface ModelBrowserTreeNode {
  id: string;
  value: string;
  open?: boolean;
  css?: string;
  icon?:
    | string
    | {
      file?: string;
      folder?: string;
      openFolder?: string;
    };
  data?: ModelBrowserTreeNodeData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function isHelperNode(node: SceneNodeLike | null | undefined): boolean {
  if (!node) return false;
  if (node.metadata?.['viewerHelper'] === true) return true;
  const name = (node.name || '').toLowerCase();
  const className = typeof node.getClassName === 'function' ? node.getClassName() : '';
  if (!name || name.startsWith('__root')) return true;
  if (name.includes('viewcube') || name.includes('groundmarker') || name.includes('ground')) return true;
  if (
    className === 'Camera' || className === 'FreeCamera' || className === 'ArcRotateCamera' ||
    className === 'HemisphericLight' || className === 'DirectionalLight'
  ) return true;
  return false;
}

function shouldIncludeSceneNode(node: SceneNodeLike | null | undefined): node is SceneNodeLike {
  if (!node || isHelperNode(node)) return false;
  const className = typeof node.getClassName === 'function' ? node.getClassName() : '';
  return className === 'TransformNode' || className === 'Mesh' || className === 'InstancedMesh';
}

function getIncludedChildren(node: SceneNodeLike): SceneNodeLike[] {
  return typeof node.getChildren === 'function'
    ? node.getChildren().filter(c => shouldIncludeSceneNode(c))
    : [];
}

function hasGeometry(node: SceneNodeLike): boolean {
  return !!(typeof node.getTotalVertices === 'function' && node.getTotalVertices() > 0);
}

function buildTreeNode(node: SceneNodeLike): ModelBrowserTreeNode {
  let children = getIncludedChildren(node);
  const isPartNode = hasGeometry(node);

  // Promote single-child intermediate nodes that have no geometry
  if (children.length === 1 && !isPartNode) {
    children = getIncludedChildren(children[0]);
  }

  const treeNode: ModelBrowserTreeNode = {
    id: `node_${node.uniqueId}`,
    value: node.name?.length ? node.name : `Unnamed_${node.uniqueId}`,
    css: isPartNode ? 'tree-node-child' : 'tree-node-assembly',
    data: {
      uniqueId: node.uniqueId,
      nodeId: node.id,
      nodeName: node.name || `node_${node.uniqueId}`,
      nodeType: typeof node.getClassName === 'function' ? node.getClassName() : 'Unknown',
      isPart: isPartNode
    }
  };

  const items = children.flatMap(c => (shouldIncludeSceneNode(c) ? [buildTreeNode(c)] : []));
  if (items.length > 0) {
    treeNode['items'] = items;
    treeNode.open = true;
  }

  return treeNode;
}

function getEffectiveRootNodes(scene: Scene): SceneNodeLike[] {
  if (!Array.isArray(scene.rootNodes)) return [];
  const roots = scene.rootNodes as SceneNodeLike[];

  const out: SceneNodeLike[] = [];
  for (const root of roots) {
    if (!root) continue;
    if ((root.name || '').toLowerCase().startsWith('__root')) {
      const children = typeof root.getChildren === 'function' ? root.getChildren() : [];
      for (const child of children) {
        if (!isHelperNode(child)) out.push(child);
      }
    } else if (!isHelperNode(root)) {
      out.push(root);
    }
  }
  return out;
}

function buildModelBrowserTreeData(scene: Scene, assemblyName: string): ModelBrowserTreeNode[] {
  const name = assemblyName || 'assembly';
  const items = getEffectiveRootNodes(scene)
    .filter(n => shouldIncludeSceneNode(n))
    .map(n => buildTreeNode(n));

  return [{
    id: `node_root_${name}`,
    value: name,
    open: true,
    css: 'tree-node-root',
    data: { isAssemblyRoot: true, assemblyName: name },
    items
  }];
}

// ─── Viewer Controls Config ─────────────────────────────────────────────────

interface ViewerControlsConfig {
  orbitSensitivity: number;
  orbitModifierKey: 'shift' | 'ctrl' | 'alt' | 'meta';
  radiusSensitivityExponent: number;
  minRadiusForSensitivity: number;
}

const DEFAULT_VIEWER_CONTROLS_CONFIG: ViewerControlsConfig = {
  orbitSensitivity: 0.0025,
  orbitModifierKey: 'shift',
  radiusSensitivityExponent: 1 / 3,
  minRadiusForSensitivity: 0.0001
};

function isModifierKey(value: unknown): value is ViewerControlsConfig['orbitModifierKey'] {
  return value === 'shift' || value === 'ctrl' || value === 'alt' || value === 'meta';
}

function parseViewerControlsConfig(input: unknown): ViewerControlsConfig {
  if (!input || typeof input !== 'object') {
    return DEFAULT_VIEWER_CONTROLS_CONFIG;
  }

  const raw = input as Record<string, unknown>;
  return {
    orbitSensitivity:
      typeof raw['orbitSensitivity'] === 'number'
        ? raw['orbitSensitivity']
        : DEFAULT_VIEWER_CONTROLS_CONFIG.orbitSensitivity,
    orbitModifierKey: isModifierKey(raw['orbitModifierKey'])
      ? raw['orbitModifierKey']
      : DEFAULT_VIEWER_CONTROLS_CONFIG.orbitModifierKey,
    radiusSensitivityExponent:
      typeof raw['radiusSensitivityExponent'] === 'number'
        ? raw['radiusSensitivityExponent']
        : DEFAULT_VIEWER_CONTROLS_CONFIG.radiusSensitivityExponent,
    minRadiusForSensitivity:
      typeof raw['minRadiusForSensitivity'] === 'number'
        ? raw['minRadiusForSensitivity']
        : DEFAULT_VIEWER_CONTROLS_CONFIG.minRadiusForSensitivity
  };
}

@Component({
  selector: 'app-viewer-module',
  template: `
    <div #layoutHost class="viewer-layout-host" style="height:100%;width:100%;"></div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }
    .viewer-layout-host {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    :host ::ng-deep .parts-tree .tree-node-root .dhx_tree-list-item__text,
    :host ::ng-deep .parts-tree .tree-node-root.dhx_tree-list-item .dhx_tree-list-item__text {
      color: #1f9d55;
      font-weight: 600;
    }

    :host ::ng-deep .parts-tree .tree-node-root .dhx_tree-list-item__icon,
    :host ::ng-deep .parts-tree .tree-node-root.dhx_tree-list-item .dhx_tree-list-item__icon {
      color: #1f9d55;
    }

    :host ::ng-deep .parts-tree .tree-node-assembly .dhx_tree-list-item__text,
    :host ::ng-deep .parts-tree .tree-node-assembly.dhx_tree-list-item .dhx_tree-list-item__text {
      color: #6b7280;
      font-weight: 500;
    }

    :host ::ng-deep .parts-tree .tree-node-assembly .dhx_tree-list-item__icon,
    :host ::ng-deep .parts-tree .tree-node-assembly.dhx_tree-list-item .dhx_tree-list-item__icon {
      color: #6b7280;
    }

    :host ::ng-deep .parts-tree .tree-node-child .dhx_tree-list-item__text,
    :host ::ng-deep .parts-tree .tree-node-child.dhx_tree-list-item .dhx_tree-list-item__text {
      color: #6b7280;
    }

    :host ::ng-deep .parts-tree .tree-node-child .dhx_tree-list-item__icon,
    :host ::ng-deep .parts-tree .tree-node-child.dhx_tree-list-item .dhx_tree-list-item__icon {
      color: #6b7280;
    }

    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-assembly .dhx_tree-list-item__text,
    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-assembly.dhx_tree-list-item .dhx_tree-list-item__text,
    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-child .dhx_tree-list-item__text,
    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-child.dhx_tree-list-item .dhx_tree-list-item__text {
      color: #b8c0cc;
    }

    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-assembly .dhx_tree-list-item__icon,
    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-assembly.dhx_tree-list-item .dhx_tree-list-item__icon,
    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-child .dhx_tree-list-item__icon,
    :host-context(body[data-dhx-theme='dark']) ::ng-deep .parts-tree .tree-node-child.dhx_tree-list-item .dhx_tree-list-item__icon {
      color: #b8c0cc;
    }

    :host ::ng-deep .parts-tree .dhx_tree-list-item__icon.fa-solid,
    :host ::ng-deep .parts-tree .dhx_tree-list-item__icon.fa-regular {
      width: 18px;
      min-width: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }

    :host ::ng-deep .parts-tree .dhx_tree-list-item__content {
      gap: 4px;
    }

    /* Model browser locked state during isolation */
    .viewer-layout-host.viewer--isolation-active ::ng-deep .dhx_cell[data-dhx-item="model-browser"] {
      opacity: 0.45;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewerModuleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('layoutHost', { static: true }) layoutHost!: ElementRef<HTMLElement>;

  private layout?: Layout;
  private modelBrowserTree?: Tree;
  private modelBrowserTreeData: ModelBrowserTreeNode[] = [];
  private engine?: ViewerEngine;
  private scene?: Scene;
  private camera?: ArcRotateCamera;
  private viewerGroundGrid?: ViewerGroundGridFeature;
  private themeObserver?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private resizeRafId: number | null = null;
  private readonly onResize = () => this.engine?.resize();
  private readonly onLayoutInvalidated = () => this.refreshSceneViewport();
  private viewerInteractionControls?: ViewerInteractionControls;
  private viewerSceneSelection?: ViewerSceneSelectionFeature;
  private viewerIsolateSelection?: ViewerIsolateSelectionFeature;
  private viewerToolbar?: ViewerToolbarFeature;
  private viewerContextMenu?: ContextMenu;
  private canvasContextMenuHandler?: (event: MouseEvent) => void;
  private contextMenuCanvas?: HTMLCanvasElement;
  private currentModelRadius = 1;
  private currentSelectedTreeNodeIds = new Set<string>();
  private controlsConfig: ViewerControlsConfig = DEFAULT_VIEWER_CONTROLS_CONFIG;
  private sceneConfig: ViewerSceneConfig = DEFAULT_VIEWER_SCENE_CONFIG;
  private isDestroyed = false;
  private viewerInitToken = 0;

  ngAfterViewInit(): void {
    this.isDestroyed = false;
    void this.initializeLayout();
  }

  private async initializeLayout(): Promise<void> {
    const initToken = ++this.viewerInitToken;

    const [layoutResponse, controlsResponse, sceneResponse] = await Promise.allSettled([
      fetch('/config/viewer-layout.config.json'),
      fetch('/config/viewer-controls.config.json'),
      fetch('/config/viewer-scene.config.json')
    ]);

    if (this.isDestroyed || initToken !== this.viewerInitToken) {
      return;
    }

    if (controlsResponse.status === 'fulfilled') {
      try {
        this.controlsConfig = parseViewerControlsConfig(await controlsResponse.value.json());
      } catch {
        this.controlsConfig = DEFAULT_VIEWER_CONTROLS_CONFIG;
      }
    } else {
      this.controlsConfig = DEFAULT_VIEWER_CONTROLS_CONFIG;
    }

    if (sceneResponse.status === 'fulfilled') {
      try {
        this.sceneConfig = parseViewerSceneConfig(await sceneResponse.value.json());
      } catch {
        this.sceneConfig = DEFAULT_VIEWER_SCENE_CONFIG;
      }
    } else {
      this.sceneConfig = DEFAULT_VIEWER_SCENE_CONFIG;
    }

    if (layoutResponse.status !== 'fulfilled') {
      throw new Error('Could not load /config/viewer-layout.config.json');
    }

    this.disposeLayoutResources();

    const layoutConfig = (await layoutResponse.value.json()) as ConstructorParameters<typeof Layout>[1];
    this.layout = new Layout(this.layoutHost.nativeElement, layoutConfig);

    this.bindLayoutRefreshEvents();
    this.mountModelBrowserTree();
    this.mountViewerToolbar();
    this.mountViewerInMainArea(initToken);
  }

  private mountViewerToolbar(): void {
    const cell = this.layout?.getCell('viewer-tools') as
      | { attach?: (component: unknown) => void }
      | undefined;

    if (!cell?.attach) {
      console.error('Viewer tools cell not found in layout');
      return;
    }

    this.viewerToolbar?.dispose();
    this.viewerToolbar = createViewerToolbar({
      onAction: (id) => {
        if (id === 'isolate') {
          const nextActive = this.viewerIsolateSelection?.toggle();
          this.viewerToolbar?.setIsolateState(!!nextActive);
          return;
        }

        if (id === 'fit-view') {
          this.fitView();
        }
      }
    });
    this.viewerToolbar.attach(cell as { attach: (component: unknown) => void });
  }

  private mountViewerContextMenu(canvas: HTMLCanvasElement): void {
    this.disposeViewerContextMenu();

    this.viewerContextMenu = new ContextMenu(undefined, {
      css: 'viewer-context-menu',
      data: [
        {
          id: 'isolate',
          type: 'menuItem',
          icon: 'mdi mdi-cube-outline',
          value: 'Isolate Selection'
        },
        {
          type: 'separator'
        },
        {
          id: 'fit-view',
          type: 'menuItem',
          icon: 'mdi mdi-fit-to-screen-outline',
          value: 'Fit View'
        }
      ]
    });

    this.viewerContextMenu.events.on('click', (id: string | number) => {
      const actionId = String(id);
      if (actionId === 'isolate') {
        const nextActive = this.viewerIsolateSelection?.toggle();
        this.viewerToolbar?.setIsolateState(!!nextActive);
        return;
      }

      if (actionId === 'fit-view') {
        this.fitView();
      }
    });

    this.viewerContextMenu.disable('isolate');

    this.canvasContextMenuHandler = (event: MouseEvent) => {
      event.preventDefault();
      this.viewerContextMenu?.showAt(event);
    };
    this.contextMenuCanvas = canvas;
    canvas.addEventListener('contextmenu', this.canvasContextMenuHandler);
  }

  private disposeViewerContextMenu(): void {
    if (this.contextMenuCanvas && this.canvasContextMenuHandler) {
      this.contextMenuCanvas.removeEventListener('contextmenu', this.canvasContextMenuHandler);
    }
    this.canvasContextMenuHandler = undefined;
    this.contextMenuCanvas = undefined;
    this.viewerContextMenu?.destructor();
    this.viewerContextMenu = undefined;
  }

  private setIsolateActionEnabled(enabled: boolean): void {
    this.viewerToolbar?.setIsolateEnabled(enabled);
    if (!this.viewerContextMenu) {
      return;
    }

    if (enabled) {
      this.viewerContextMenu.enable('isolate');
    } else {
      this.viewerContextMenu.disable('isolate');
    }
  }

  private mountModelBrowserTree(): void {
    const cell = this.layout?.getCell('model-browser') as
      | { attach?: (component: unknown) => void }
      | undefined;

    if (!cell?.attach) {
      console.error('Model Browser cell not found in layout');
      return;
    }

    this.modelBrowserTree?.destructor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.modelBrowserTree = new Tree(null as any, {
      css: 'parts-tree',
      multiselection: true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    cell.attach(this.modelBrowserTree);

    this.modelBrowserTree.events.on('itemClick', (id: string, event: MouseEvent) => {
      // Assembly root nodes are not selectable in the scene — check via DHTMLX data API
      const item = this.modelBrowserTree?.data?.getItem?.(id) as ModelBrowserTreeNode | undefined;
      if (item?.data?.isAssemblyRoot) return;
      // Tree is locked while isolation is active — prevent selection changes
      if (this.viewerIsolateSelection?.isActive()) return;
      const additive = event?.shiftKey ?? false;
      // suppressEvent=true: tree is already updated by the click, skip re-selecting in tree
      this.viewerSceneSelection?.selectByTreeNodeId(id, true, additive);
    });
  }

  private refreshModelBrowserTree(): void {
    if (!this.modelBrowserTree) return;
    this.modelBrowserTree.data.removeAll();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.modelBrowserTree.data.parse(this.modelBrowserTreeData as any);
    for (const item of this.modelBrowserTreeData) {
      if (item?.['id'] && Array.isArray(item['items']) && item['items'].length > 0) {
        this.modelBrowserTree.expand(item['id']);
      }
    }
  }

  private bindLayoutRefreshEvents(): void {
    const events = (this.layout as unknown as { events?: { on?: (event: string, cb: () => void) => void } })?.events;
    if (!events?.on) {
      return;
    }

    events.on('afterCollapse', this.onLayoutInvalidated);
    events.on('afterExpand', this.onLayoutInvalidated);
    events.on('resize', this.onLayoutInvalidated);
    events.on('afterResizeEnd', this.onLayoutInvalidated);
  }

  private refreshSceneViewport(): void {
    if (!this.engine || !this.scene) {
      return;
    }

    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
    }

    // Run after layout repaint to avoid stale canvas dimensions.
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      this.engine?.resize();
      this.scene?.render();
    });
  }

  private getCurrentTheme(): 'dark' | 'light' {
    return document.body.getAttribute('data-dhx-theme') === 'dark' ? 'dark' : 'light';
  }

  private applySceneThemeColor(): void {
    if (!this.scene) {
      return;
    }

    const theme = this.getCurrentTheme();
    this.scene.clearColor = theme === 'dark'
      ? toColor4(this.sceneConfig.scene.clearColorDark)
      : toColor4(this.sceneConfig.scene.clearColorLight);
    if (this.scene.activeCamera) {
      this.scene.render();
    }
  }

  private bindThemeObserver(): void {
    this.themeObserver?.disconnect();
    this.themeObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-dhx-theme') {
          this.applySceneThemeColor();
          break;
        }
      }
    });

    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-dhx-theme']
    });
  }

  private mountViewerInMainArea(initToken: number): void {
    const mainAreaCell = this.layout?.getCell('main-viewer-area') as
      | { attachHTML?: (html: string) => void }
      | undefined;

    if (!mainAreaCell) {
      console.error('Main Viewer Area cell not found in layout');
      return;
    }

    const viewerRootId = 'main-viewer-root';
    mainAreaCell.attachHTML?.(`<div id="${viewerRootId}" style="width:100%;height:100%;"></div>`);

    requestAnimationFrame(() => {
      if (this.isDestroyed || this.viewerInitToken !== initToken) {
        return;
      }

      const container = document.getElementById(viewerRootId);
      if (!container) {
        console.error('Main Viewer Area container not found after layout mount');
        return;
      }

      this.initializeBabylonScene(container, initToken);
    });
  }

  private async initializeBabylonScene(container: HTMLElement, initToken: number): Promise<void> {
    this.disposeViewerResources();

    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.border = '0';
    canvas.style.outline = 'none';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.mountViewerContextMenu(canvas);

    const engineResult = await createViewerEngine(canvas, this.sceneConfig);
    if (this.isDestroyed || this.viewerInitToken !== initToken) {
      engineResult.engine.dispose();
      return;
    }

    this.engine = engineResult.engine;
    const baseScene = createViewerBaseScene(this.engine, canvas, this.sceneConfig);
    this.scene = baseScene.scene;
    this.camera = baseScene.camera;
    this.viewerGroundGrid = createViewerGroundGrid(this.scene, this.sceneConfig);

    this.applySceneThemeColor();
    this.bindThemeObserver();

    const scene = this.scene;
    const camera = baseScene.camera;
    const ground = this.viewerGroundGrid.ground;

    this.viewerInteractionControls = attachViewerInteractionControls({
      scene,
      engine: this.engine,
      canvas,
      camera,
      ground,
      getCurrentRadius: () => this.currentModelRadius,
      orbitSensitivity: this.controlsConfig.orbitSensitivity,
      orbitModifierKey: this.controlsConfig.orbitModifierKey,
      radiusSensitivityExponent: this.controlsConfig.radiusSensitivityExponent,
      minRadiusForSensitivity: this.controlsConfig.minRadiusForSensitivity,
      onInteraction: () => this.scene?.render()
    });

    this.viewerSceneSelection = createViewerSceneSelectionFeature({
      scene,
      ground,
      selectionColors: {
        overlayColor: this.sceneConfig.selection.overlayColor,
        outlineColor: this.sceneConfig.selection.outlineColor
      },
      isIsolationActive: () => this.viewerIsolateSelection?.isActive() ?? false,
      onSelectionChanged: (selections) => {
        if (!this.modelBrowserTree) return;

        if (!selections.length) {
          // Clear all
          this.currentSelectedTreeNodeIds.clear();
          this.modelBrowserTree.selection.remove();
          this.viewerIsolateSelection?.reset();
          this.setIsolateActionEnabled(false);
        } else {
          // Sync tree: remove deselected, add newly selected
          const nextIds = new Set(selections.map(s => s.treeNodeId));

          // Remove nodes that are no longer selected
          for (const prevId of this.currentSelectedTreeNodeIds) {
            if (!nextIds.has(prevId)) {
              this.modelBrowserTree.selection.remove(prevId);
            }
          }
          // Add nodes that are newly selected
          for (const sel of selections) {
            if (!this.currentSelectedTreeNodeIds.has(sel.treeNodeId)) {
              this.modelBrowserTree.selection.add(sel.treeNodeId);
            }
          }
          // Focus the last selected item
          const last = selections[selections.length - 1];
          this.modelBrowserTree.focusItem(last.treeNodeId);

          this.currentSelectedTreeNodeIds = nextIds;
          this.setIsolateActionEnabled(true);
        }
      },
      onSelectionRendered: () => this.scene?.render()
    });

    this.viewerIsolateSelection = createViewerIsolateSelectionFeature({
      getAllModelMeshes: () => scene.meshes,
      getGroundMesh: () => ground,
      getSelectedMeshes: () => this.viewerSceneSelection?.getSelectedMeshes() ?? [],
      onIsolationChanged: (active) => {
        this.viewerToolbar?.setIsolateState(active);
        if (active) {
          // Remove selection highlights once isolation is active — selection purpose is fulfilled
          this.viewerSceneSelection?.clearHighlights();
          this.layoutHost.nativeElement.classList.add('viewer--isolation-active');
        } else {
          this.layoutHost.nativeElement.classList.remove('viewer--isolation-active');
        }
      },
      onRequestRender: () => this.scene?.render()
    });

    this.engine.runRenderLoop(() => {
      if (this.scene?.activeCamera) {
        const cam = this.scene.activeCamera as ArcRotateCamera;
        if (cam.radius) {
          cam.panningSensibility = this.sceneConfig.camera.panningSensibilityFactor / cam.radius;
          cam.speed = cam.radius * this.sceneConfig.camera.speedFactor;
        }
        this.scene.render();
      }
    });

    window.addEventListener('resize', this.onResize);
    this.bindContainerResizeObserver(container);

    const modelFileName = 'RDX.glb';

    loadViewerModel({
      scene,
      camera,
      sceneConfig: this.sceneConfig,
      modelRootUrl: '/models/',
      modelFileName,
      shouldAbort: () => this.isDestroyed || this.viewerInitToken !== initToken || scene !== this.scene,
      onModelLoaded: (event: { assemblyName: string; renderableMeshes: RenderableMeshLike[] }) => {
        this.viewerIsolateSelection?.reset();
        this.setIsolateActionEnabled(false);
        this.modelBrowserTreeData = buildModelBrowserTreeData(scene, event.assemblyName);
        this.refreshModelBrowserTree();
        this.viewerSceneSelection?.rebuildSelectableNodes();
      },
      onModelRadiusUpdated: (radius: number) => {
        this.currentModelRadius = radius;
      },
      onModelBoundsUpdated: bounds => {
        this.viewerGroundGrid?.updateFromBounds(bounds);
      }
    });
  }

  private bindContainerResizeObserver(container: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      this.refreshSceneViewport();
    });
    this.resizeObserver.observe(container);
  }

  private fitCameraToMeshes(meshes: AbstractMesh[]): void {
    if (!this.camera || !meshes.length) return;
    const bounds = computeModelBounds(meshes as unknown as MeshBoundsLike[], { refreshBounds: true });
    if (!bounds) return;
    const camera = this.camera;
    const sc = this.sceneConfig;
    camera.setTarget(bounds.center);
    camera.lowerRadiusLimit = Math.max(bounds.radius * sc.camera.lowerRadiusFactor, 0.01);
    camera.upperRadiusLimit = bounds.radius * sc.camera.upperRadiusFactor;
    camera.radius = Math.max(bounds.radius * 2.2, camera.lowerRadiusLimit + 0.1);
    camera.minZ = Math.max(bounds.radius * sc.camera.minZFactor, 0.001);
    camera.maxZ = bounds.radius * sc.camera.maxZFactor;
    this.scene?.render();
  }

  private getFitViewMeshes(): AbstractMesh[] {
    if (!this.scene) return [];

    const ground = this.viewerGroundGrid?.ground;
    const allModelMeshes = this.scene.meshes.filter(mesh => !mesh.isDisposed?.() && mesh !== ground);
    const visibleModelMeshes = allModelMeshes.filter(mesh => mesh.isVisible);

    // Prefer framing visible context (isolation mode), fallback to full model if all are hidden.
    return visibleModelMeshes.length ? visibleModelMeshes : allModelMeshes;
  }

  private fitView(): void {
    const meshes = this.getFitViewMeshes();
    this.fitCameraToMeshes(meshes);
  }

  private disposeViewerResources(): void {
    window.removeEventListener('resize', this.onResize);
    this.themeObserver?.disconnect();
    this.themeObserver = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }

    this.viewerInteractionControls?.dispose();
    this.viewerInteractionControls = undefined;
    this.disposeViewerContextMenu();
    this.viewerIsolateSelection?.dispose();
    this.viewerIsolateSelection = undefined;
    this.viewerSceneSelection?.dispose();
    this.viewerSceneSelection = undefined;
    this.currentSelectedTreeNodeIds.clear();
    this.viewerGroundGrid?.dispose();
    this.viewerGroundGrid = undefined;
    this.camera = undefined;

    this.engine?.stopRenderLoop();
    this.scene?.dispose();
    this.scene = undefined;
    this.engine?.dispose();
    this.engine = undefined;
  }

  private disposeLayoutResources(): void {
    this.viewerToolbar?.dispose();
    this.viewerToolbar = undefined;
    this.modelBrowserTree?.destructor();
    this.modelBrowserTree = undefined;
    this.layout?.destructor();
    this.layout = undefined;
    this.modelBrowserTreeData = [];
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.viewerInitToken++;
    this.disposeViewerResources();
    this.disposeLayoutResources();
  }
}
