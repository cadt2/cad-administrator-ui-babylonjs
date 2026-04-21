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
  selector: 'app-inventory-module',
  template: '<div #inventoryHost class="module-host"></div>',
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
export class InventoryModuleComponent implements AfterViewInit, OnDestroy {
  private readonly inventoryHost = viewChild.required<ElementRef<HTMLElement>>('inventoryHost');
  private grid?: Grid;

  ngAfterViewInit(): void {
    this.grid = new Grid(this.inventoryHost().nativeElement, {
      autoWidth: true,
      columns: [
        { id: 'sku', header: [{ text: 'SKU' }] },
        { id: 'description', header: [{ text: 'Description' }] },
        { id: 'stock', header: [{ text: 'Stock' }], type: 'number' },
        { id: 'location', header: [{ text: 'Location' }] }
      ],
      data: [
        { id: '1', sku: 'INV-5521', description: 'Servo Kit', stock: 32, location: 'A-14' },
        { id: '2', sku: 'INV-1183', description: 'Drive Shaft', stock: 7, location: 'B-02' },
        { id: '3', sku: 'INV-7600', description: 'Controller Board', stock: 19, location: 'C-09' }
      ]
    });
  }

  ngOnDestroy(): void {
    this.grid?.destructor();
  }
}
