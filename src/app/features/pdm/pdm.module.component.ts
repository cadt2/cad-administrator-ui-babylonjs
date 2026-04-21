import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  viewChild
} from '@angular/core';
import { Grid } from 'dhx-suite';

@Component({
  selector: 'app-pdm-module',
  template: '<div #pdmHost class="module-host"></div>',
  styles: `
    :host {
      display: block;
      flex: 1;
      min-width: 0;
      min-height: 0;
      padding: 12px;
    }

    .module-host {
      width: 100%;
      height: 100%;
      border: var(--dhx-border);
      background: var(--dhx-background-primary);
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PdmModuleComponent implements AfterViewInit, OnDestroy {
  private readonly pdmHost = viewChild.required<ElementRef<HTMLElement>>('pdmHost');
  private grid?: Grid;

  ngAfterViewInit(): void {
    this.grid = new Grid(this.pdmHost().nativeElement, {
      autoWidth: true,
      columns: [
        { id: 'partId', header: [{ text: 'Part ID' }] },
        { id: 'revision', header: [{ text: 'Revision' }] },
        { id: 'state', header: [{ text: 'State' }] },
        { id: 'owner', header: [{ text: 'Owner' }] }
      ],
      data: [
        { id: '1', partId: 'PRT-1001', revision: 'A', state: 'Released', owner: 'Design Team' },
        { id: '2', partId: 'ASM-4003', revision: 'C', state: 'In Review', owner: 'PDM Office' },
        { id: '3', partId: 'DRW-9011', revision: 'B', state: 'Draft', owner: 'Manufacturing' }
      ]
    });
  }

  ngOnDestroy(): void {
    this.grid?.destructor();
  }
}
