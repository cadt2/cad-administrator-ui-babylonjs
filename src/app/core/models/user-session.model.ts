export interface UserSession {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  lastLoginAt: string;
  isAuthenticated: boolean;
}

export const MOCK_USER_SESSION: UserSession = {
  id: 'usr-001',
  fullName: 'Alex Morgan',
  email: 'alex.morgan@core-space.com',
  role: 'Operations Lead',
  lastLoginAt: '2026-04-20T21:30:00.000Z',
  isAuthenticated: true
};