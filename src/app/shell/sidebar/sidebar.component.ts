import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  output,
  viewChild
} from '@angular/core';
import { Sidebar } from 'dhx-suite';
import { ENVIRONMENTS } from '../../core/config/environments.config';
import { DEFAULT_ENVIRONMENT, type EnvironmentId } from '../../core/models/environment.model';

@Component({
  selector: 'app-shell-sidebar',
  template: '<div #sidebarHost class="sidebar-host"></div>',
  styles: `
    :host {
      display: block;
      width: fit-content;
      height: 100%;
      overflow: hidden;
    }

    .sidebar-host {
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements AfterViewInit, OnDestroy {
  readonly environmentChange = output<EnvironmentId>();

  private readonly defaultEnvironmentId: EnvironmentId = DEFAULT_ENVIRONMENT;
  private readonly environmentIds = new Set<EnvironmentId>(ENVIRONMENTS.map((item) => item.id));
  private selectedEnvironmentId = this.defaultEnvironmentId;
  private readonly sidebarHost = viewChild.required<ElementRef<HTMLElement>>('sidebarHost');
  private sidebar?: Sidebar;

  ngAfterViewInit(): void {
    this.sidebar = new Sidebar(this.sidebarHost().nativeElement, {
      width: 180, // ancho expandido preferido
      minWidth: 56, // ancho colapsado (valor típico DHTMLX)
      css: 'dhx_widget--border_right',
      data: [
        { id: 'toggle', icon: 'mdi mdi-backburger' },
        // User profile block immediately after toggle
        {
          type: 'customHTML',
          id: 'userInfo',
          css: 'user-info-item',
          html:
            "<div class='user-info-container'>" +
            "<img class='user-info-avatar' src='https://snippet.dhtmlx.com/codebase/data/common/img/02/avatar_62.jpg' alt='Gloria McKinney'/>" +
            "<div class='user-info-title'>Gloria McKinney</div>" +
            "<div class='user-info-contact'>@gmckinney</div>" +
            '</div>'
        },
        { type: 'separator' },
        ...ENVIRONMENTS.map((environment) => ({
          id: environment.id,
          value: environment.label,
          icon: environment.icon
        })),
        { type: 'spacer' },
        {
          id: 'notification',
          value: 'Notification',
          count: 25,
          countColor: 'primary',
          icon: 'mdi mdi-bell'
        },
        {
          id: 'settings',
          value: 'Settings',
          icon: 'mdi mdi-cog',
          items: [
            {
              id: 'myAccount',
              value: 'My Account',
              icon: 'mdi mdi-account-settings'
            },
            {
              id: 'general',
              value: 'General Configuration',
              icon: 'mdi mdi-tune'
            }
          ]
        }
      ]
    });

    this.sidebar.select(this.defaultEnvironmentId, true);
    this.environmentChange.emit(this.defaultEnvironmentId);

    this.sidebar.events.on('click', (id) => {
      if (!this.sidebar) {
        return;
      }

      const clickedId = String(id);

      if (clickedId === 'toggle') {
        this.sidebar.toggle();
        this.sidebar.unselect('toggle');
        this.sidebar.select(this.selectedEnvironmentId, true);
        this.sidebar.data.update('toggle', {
          icon: this.sidebar.config.collapsed ? 'mdi mdi-menu' : 'mdi mdi-backburger'
        });
        return;
      }

      if (this.environmentIds.has(clickedId as EnvironmentId)) {
        const environmentId = clickedId as EnvironmentId;
        this.selectedEnvironmentId = environmentId;
        this.sidebar.select(environmentId, true);
        this.environmentChange.emit(environmentId);
      }
    });
  }

  ngOnDestroy(): void {
    this.sidebar?.destructor();
  }
}
