import { Injectable, signal } from '@angular/core';
import { DEFAULT_ENVIRONMENT, type EnvironmentId } from '../models/environment.model';

@Injectable({ providedIn: 'root' })
export class ShellStore {
  readonly activeEnvironment = signal<EnvironmentId>(DEFAULT_ENVIRONMENT);

  setActiveEnvironment(environmentId: EnvironmentId): void {
    this.activeEnvironment.set(environmentId);
  }
}
