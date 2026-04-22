import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  MeshBuilder,
  Scene,
  SceneLoader,
  Vector3
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Layout, Tree } from 'dhx-suite';
import { computeModelBounds } from './model-bounds';
import { attachPanOrbitControls, PanOrbitControls } from './pan-orbit-controls';
import {
  applyEnvironmentReflectionsToMaterials,
  DEFAULT_VIEWER_REFLECTION_CONFIG,
  initializeReflectionEnvironment
} from './viewer-reflections';

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

const VIEWER_SCENE_COLORS = {
  dark: new Color4(0.145, 0.145, 0.145, 1),
  light: new Color4(0.9, 0.96, 1, 1)
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewerModuleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('layoutHost', { static: true }) layoutHost!: ElementRef<HTMLElement>;

  private layout?: Layout;
  private modelBrowserTree?: Tree;
  private modelBrowserTreeData: ModelBrowserTreeNode[] = [];
  private engine?: Engine;
  private scene?: Scene;
  private themeObserver?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private resizeRafId: number | null = null;
  private readonly onResize = () => this.engine?.resize();
  private readonly onLayoutInvalidated = () => this.refreshSceneViewport();
  private panOrbitControls?: PanOrbitControls;
  private currentModelRadius = 1;
  private controlsConfig: ViewerControlsConfig = DEFAULT_VIEWER_CONTROLS_CONFIG;
  private isDestroyed = false;
  private viewerInitToken = 0;

  private readonly reflectionConfig = DEFAULT_VIEWER_REFLECTION_CONFIG;

  ngAfterViewInit(): void {
    this.isDestroyed = false;
    void this.initializeLayout();
  }

  private async initializeLayout(): Promise<void> {
    const initToken = ++this.viewerInitToken;

    const [layoutResponse, controlsResponse] = await Promise.allSettled([
      fetch('/config/viewer-layout.config.json'),
      fetch('/config/viewer-controls.config.json')
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

    if (layoutResponse.status !== 'fulfilled') {
      throw new Error('Could not load /config/viewer-layout.config.json');
    }

    this.disposeLayoutResources();

    const layoutConfig = (await layoutResponse.value.json()) as ConstructorParameters<typeof Layout>[1];
    this.layout = new Layout(this.layoutHost.nativeElement, layoutConfig);

    this.bindLayoutRefreshEvents();
    this.mountModelBrowserTree();
    this.mountViewerInMainArea(initToken);
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
      css: 'parts-tree'
    });
    cell.attach(this.modelBrowserTree);
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
    this.scene.clearColor = theme === 'dark' ? VIEWER_SCENE_COLORS.dark : VIEWER_SCENE_COLORS.light;
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

  private initializeBabylonScene(container: HTMLElement, initToken: number): void {
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

    this.engine = new Engine(canvas, true, {
      useHighPrecisionMatrix: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: true
    });
    this.scene = new Scene(this.engine);
    this.applySceneThemeColor();
    this.bindThemeObserver();
    // Neutral KHR PBR tone mapping — same as sandbox default
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    const scene = this.scene;
    initializeReflectionEnvironment(scene, this.reflectionConfig);

    const camera = new ArcRotateCamera('mainCamera', Math.PI / 4, Math.PI / 3, 8, Vector3.Zero(), this.scene);
    camera.attachControl(canvas, true);

    new HemisphericLight('mainLight', new Vector3(1, 1, 0), this.scene);
    // Fallback light — active only when the model has no lights and no env texture.

    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, this.scene);
    ground.isPickable = false;

    const gridMaterial = new GridMaterial('gridMaterial', this.scene);
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.45;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new Color3(1, 1, 1);
    gridMaterial.lineColor = new Color3(0.7, 0.7, 0.7);
    gridMaterial.opacity = 0.85;
    ground.material = gridMaterial;

    this.panOrbitControls = attachPanOrbitControls({
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

    // On-demand rendering: only render when the scene is actually dirty (camera moved, model loaded, resize).
    // Sandbox pattern: adjust camera feel based on current radius every frame.
    this.engine.runRenderLoop(() => {
      if (this.scene?.activeCamera) {
        const cam = this.scene.activeCamera as ArcRotateCamera;
        if (cam.radius) {
          cam.panningSensibility = 5000 / cam.radius;
          cam.speed = cam.radius * 0.2;
        }
        this.scene.render();
      }
    });

    window.addEventListener('resize', this.onResize);
    this.bindContainerResizeObserver(container);

    const modelFileName = 'RDX.glb';
    const assemblyName = modelFileName.replace(/\.[^/.]+$/, '') || 'assembly';

    SceneLoader.ImportMesh('', '/models/', modelFileName, scene, meshes => {
      if (this.isDestroyed || this.viewerInitToken !== initToken || scene !== this.scene) {
        return;
      }

      const renderableMeshes = meshes.filter(
        mesh => typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() > 0
      );

      this.modelBrowserTreeData = buildModelBrowserTreeData(scene, assemblyName);
      this.refreshModelBrowserTree();

      const bounds = computeModelBounds(renderableMeshes, { refreshBounds: true });
      if (!bounds) {
        console.warn('No valid renderable bounds found for model');
        return;
      }

      applyEnvironmentReflectionsToMaterials(scene, renderableMeshes, this.reflectionConfig);

  // Sandbox camera framing pattern
  camera.setTarget(bounds.center);
  this.currentModelRadius = bounds.radius;
  camera.lowerRadiusLimit = Math.max(bounds.radius * 0.01, 0.01);
  camera.upperRadiusLimit = bounds.radius * 5;
  camera.radius = Math.max(bounds.radius * 2.2, camera.lowerRadiusLimit + 0.1);
  camera.minZ = Math.max(bounds.radius * 0.001, 0.001);
  camera.maxZ = bounds.radius * 1000;
  camera.wheelDeltaPercentage = 0.01;
  camera.pinchDeltaPercentage = 0.01;

  // Sandbox: skip CPU frustum clipping — GPU handles culling on complex models
  scene.skipFrustumClipping = true;

      const groundSize = Math.max(bounds.diagonal * 2, 20);
      const gridRatio = Math.max(bounds.diagonal / 40, 0.02);
      const groundOffset = Math.max(bounds.radius * 0.01, 0.001);

      ground.position.x = bounds.center.x;
      ground.position.z = bounds.center.z;
      ground.position.y = bounds.min.y - groundOffset;
      ground.scaling.x = groundSize / 20;
      ground.scaling.z = groundSize / 20;

      gridMaterial.gridRatio = gridRatio;
      gridMaterial.majorUnitFrequency = 5;
      gridMaterial.minorUnitVisibility = 0.35;
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

    this.panOrbitControls?.dispose();
    this.panOrbitControls = undefined;

    this.engine?.stopRenderLoop();
    this.scene?.dispose();
    this.scene = undefined;
    this.engine?.dispose();
    this.engine = undefined;
  }

  private disposeLayoutResources(): void {
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
