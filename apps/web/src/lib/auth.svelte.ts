import { apiRequest, clearToken, getToken, setToken } from './api.js';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

class AuthStore {
  user: AuthUser | undefined = $state();
  status: AuthStatus = $state('checking');
}

export const auth = new AuthStore();

export async function checkSession(): Promise<void> {
  if (!getToken()) {
    auth.status = 'unauthenticated';
    return;
  }

  try {
    auth.user = await apiRequest<AuthUser>('/auth/me');
    auth.status = 'authenticated';
  } catch {
    clearToken();
    auth.status = 'unauthenticated';
  }
}

export async function login(identifier: string, password: string): Promise<void> {
  const { token } = await apiRequest<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  setToken(token);
  await checkSession();
}

export async function register(username: string, email: string, password: string): Promise<void> {
  const { token } = await apiRequest<{ token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  setToken(token);
  await checkSession();
}

export function logout(): void {
  clearToken();
  auth.user = undefined;
  auth.status = 'unauthenticated';
}
