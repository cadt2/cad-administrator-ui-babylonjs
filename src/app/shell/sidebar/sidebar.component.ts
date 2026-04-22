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
import { AuthService } from '../../core/state/auth.service';
import { Inject } from '@angular/core';

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

    :host-context([data-dhx-theme='light']) ::ng-deep .shell-sidebar {
      background-color: var(--dhx-background-secondary);
    }

    :host-context([data-dhx-theme='light']) ::ng-deep .shell-sidebar .dhx_sidebar-button--active {
      background-color: hsl(var(--dhx-h-background), var(--dhx-s-background), calc(var(--dhx-l-background) - 7%));
    }

    :host-context([data-dhx-theme='light']) ::ng-deep .shell-sidebar .dhx_sidebar-button--active:hover {
      background-color: hsl(var(--dhx-h-background), var(--dhx-s-background), calc(var(--dhx-l-background) - 12%));
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

  constructor(@Inject(AuthService) private authService: AuthService) {}

  ngAfterViewInit(): void {
    this.sidebar = new Sidebar(this.sidebarHost().nativeElement, {
      width: 180, // preferred expanded width
      minWidth: 56, // preferred collapsed width
      css: 'dhx_widget--border_right shell-sidebar',
      data: []
    });

    // Simulated server config load: these values can come from a DB-backed settings endpoint.
    this.sidebar.data.load('/config/sidebar.data.json').then(() => {
      this.sidebar?.select(this.defaultEnvironmentId, true);
      this.environmentChange.emit(this.defaultEnvironmentId);
    });

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
