import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ViewerModuleComponent } from '../../features/viewer/viewer.module.component';
import { type EnvironmentId } from '../../core/models/environment.model';

@Component({
  selector: 'app-shell-module-host',
  imports: [ViewerModuleComponent],
  template: `
    <section class="module-stage">
      <app-viewer-module />
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    .module-stage {
      display: flex;
      width: 100%;
      min-width: 0;
      min-height: 0;
      flex: 1;
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModuleHostComponent {
  readonly activeEnvironment = input.required<EnvironmentId>();
}
