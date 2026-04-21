import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Layout } from 'dhx-suite';

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

  ngAfterViewInit(): void {
    void this.initializeLayout();
  }

  private async initializeLayout(): Promise<void> {
    // Simulated server config load: this layout payload can come from a DB-backed settings endpoint.
    const response = await fetch('/config/viewer-layout.config.json');
    const layoutConfig = (await response.json()) as ConstructorParameters<typeof Layout>[1];
    this.layout = new Layout(this.layoutHost.nativeElement, layoutConfig);
  }

  ngOnDestroy(): void {
    this.layout?.destructor();
  }
}
