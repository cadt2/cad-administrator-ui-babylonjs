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
import { AuthService } from '../../core/state/auth.service';
import { Inject } from '@angular/core';

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

    :host-context([data-dhx-theme='light']) ::ng-deep .shell-top-toolbar {
      background-color: var(--dhx-background-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopMenuComponent implements AfterViewInit, OnDestroy {
  readonly activeEnvironment = input<string>('env-3d-viewer');

  private readonly topMenuHost = viewChild.required<ElementRef<HTMLElement>>('topMenuHost');
  private readonly themeItemId = 'theme-select';
  private topMenu?: Toolbar;

  constructor(@Inject(AuthService) private authService: AuthService) {}

  ngOnInit() {
    // Example: Check if the user has permission to view the top menu
    const hasAccess = this.authService.hasPermission(['admin', 'viewer']);
    if (!hasAccess) {
      console.warn('User does not have access to the top menu');
    }
  }

  ngAfterViewInit(): void {
    this.topMenu = new Toolbar(this.topMenuHost().nativeElement, {
      css: 'shell-top-toolbar',
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
