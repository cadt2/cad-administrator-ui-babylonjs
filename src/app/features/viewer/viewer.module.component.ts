import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  SceneLoader,
  Vector3
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Layout } from 'dhx-suite';
import { computeModelBounds } from './model-bounds';
import {
  applyEnvironmentReflectionsToMaterials,
  DEFAULT_VIEWER_REFLECTION_CONFIG,
  initializeReflectionEnvironment
} from './viewer-reflections';

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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewerModuleComponent implements AfterViewInit, OnDestroy {
  @ViewChild('layoutHost', { static: true }) layoutHost!: ElementRef<HTMLElement>;

  private layout?: Layout;
  private engine?: Engine;
  private scene?: Scene;
  private resizeObserver?: ResizeObserver;
  private resizeRafId: number | null = null;
  private readonly onResize = () => this.engine?.resize();
  private readonly onLayoutInvalidated = () => this.refreshSceneViewport();

  private readonly reflectionConfig = DEFAULT_VIEWER_REFLECTION_CONFIG;

  ngAfterViewInit(): void {
    void this.initializeLayout();
  }

  private async initializeLayout(): Promise<void> {
    const response = await fetch('/config/viewer-layout.config.json');
    const layoutConfig = (await response.json()) as ConstructorParameters<typeof Layout>[1];
    this.layout = new Layout(this.layoutHost.nativeElement, layoutConfig);

    this.bindLayoutRefreshEvents();

    this.mountViewerInMainArea();
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

  private mountViewerInMainArea(): void {
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
      const container = document.getElementById(viewerRootId);
      if (!container) {
        console.error('Main Viewer Area container not found after layout mount');
        return;
      }

      this.initializeBabylonScene(container);
    });
  }

  private initializeBabylonScene(container: HTMLElement): void {
    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.border = '0';
    canvas.style.outline = 'none';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.9, 0.96, 1, 1);
    const scene = this.scene;
    initializeReflectionEnvironment(scene, this.reflectionConfig);

    const camera = new ArcRotateCamera('mainCamera', Math.PI / 4, Math.PI / 3, 8, Vector3.Zero(), this.scene);
    camera.attachControl(canvas, true);

    new HemisphericLight('mainLight', new Vector3(1, 1, 0), this.scene);

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

    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });

    window.addEventListener('resize', this.onResize);
    this.bindContainerResizeObserver(container);

    SceneLoader.ImportMesh('', '/models/', 'RDX.glb', scene, meshes => {
      const renderableMeshes = meshes.filter(
        mesh => typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() > 0
      );

      const bounds = computeModelBounds(renderableMeshes, { refreshBounds: true });
      if (!bounds) {
        console.warn('No valid renderable bounds found for model');
        return;
      }

      applyEnvironmentReflectionsToMaterials(scene, renderableMeshes, this.reflectionConfig);

      camera.setTarget(bounds.center);
      camera.lowerRadiusLimit = Math.max(bounds.radius * 0.05, 0.05);
      camera.upperRadiusLimit = Math.max(bounds.radius * 100, 10);
      camera.radius = Math.max(bounds.radius * 2.2, camera.lowerRadiusLimit + 0.1);
      camera.minZ = Math.max(bounds.radius * 0.001, 0.001);
      camera.wheelPrecision = Math.min(Math.max(bounds.radius * 70, 140), 800);

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

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }
    this.scene?.dispose();
    this.engine?.dispose();
    this.layout?.destructor();
  }
}
