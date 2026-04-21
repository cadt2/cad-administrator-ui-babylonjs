import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnDestroy,
  viewChild
} from '@angular/core';
import { setTheme, Toolbar } from 'dhx-suite';

@Component({
  selector: 'app-shell-top-menu',
  template: '<div #topMenuHost class="top-menu-host"></div>',
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }

    .top-menu-host {
      width: 100%;
      border-bottom: var(--dhx-border);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopMenuComponent implements AfterViewInit, OnDestroy {
  readonly activeEnvironment = input<string>('env-3d-viewer');

  private readonly topMenuHost = viewChild.required<ElementRef<HTMLElement>>('topMenuHost');
  private readonly themeItemId = 'theme-select';
  private topMenu?: Toolbar;

  ngAfterViewInit(): void {
    this.topMenu = new Toolbar(this.topMenuHost().nativeElement, {
      data: []
    });

    // Simulated server config load: labels and controls can be delivered by a settings service.
    this.topMenu.data.load('/config/top-menu.data.json');

    setTheme('light', document.body);

    this.topMenu.events.on('click', (id) => {
      if (!this.topMenu) {
        return;
      }

      const clickedId = String(id);

      if (clickedId === 'theme-light') {
        setTheme('light', document.body);
        this.topMenu.data.update(this.themeItemId, {
          value: 'Light',
          icon: 'mdi mdi-theme-light-dark'
        });
      }

      if (clickedId === 'theme-dark') {
        setTheme('dark', document.body);
        this.topMenu.data.update(this.themeItemId, {
          value: 'Dark',
          icon: 'mdi mdi-theme-light-dark'
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.topMenu?.destructor();
  }
}
