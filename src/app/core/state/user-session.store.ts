import { Injectable, computed, signal } from '@angular/core';
import { MOCK_USER_SESSION, type UserSession } from '../models/user-session.model';

@Injectable({ providedIn: 'root' })
export class UserSessionStore {
  readonly session = signal<UserSession | null>(MOCK_USER_SESSION);
  readonly currentUser = computed(() => this.session());

  setSession(session: UserSession | null): void {
    this.session.set(session);
  }
}