import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ShellStore } from '../core/state/shell.store';
import { ModuleHostComponent } from './module-host/module-host.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TopMenuComponent } from './top-menu/top-menu.component';

@Component({
  selector: 'app-shell',
  imports: [SidebarComponent, TopMenuComponent, ModuleHostComponent],
  template: `
    <div class="shell-layout">
      <app-shell-sidebar (environmentChange)="onEnvironmentChange($event)" />

      <section class="shell-main">
        <app-shell-top-menu [activeEnvironment]="store.activeEnvironment()" />
        <app-shell-module-host [activeEnvironment]="store.activeEnvironment()" />
      </section>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    .shell-layout {
      display: flex;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    .shell-main {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      width: auto;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent {
  protected readonly store = inject(ShellStore);

  protected onEnvironmentChange(environmentId: Parameters<ShellStore['setActiveEnvironment']>[0]): void {
    this.store.setActiveEnvironment(environmentId);
  }
}
