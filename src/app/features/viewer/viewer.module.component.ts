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
    this.layout = new Layout(this.layoutHost.nativeElement, {
      type: 'wide',
      cols: [
        {
          id: 'C1',
          width: 220,
          html: '<div style="height:100%;width:100%;display:flex;align-items:center;justify-content:center;">Assembly Browser</div>',
        },
        {
          type: 'line',
          rows: [
            {
              id: 'C2',
              height: 55,
              html: '<div style="height:100%;width:100%;display:flex;align-items:center;justify-content:center;">Viewer Tools</div>',
            },
            {
              id: 'C3',
              html: '<div style="height:100%;width:100%;display:flex;align-items:center;justify-content:center;">Panel 3 (Babylon Scene)</div>',
            },
          ]
        },
      ]
    });
  }

  ngOnDestroy(): void {
    this.layout?.destructor();
  }
}
