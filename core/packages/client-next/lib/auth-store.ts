/**
 * WCA OAuth (Implicit Grant) auth state — ported from packages/client/src/stores/auth_store.ts.
 * No Capacitor branch here; web only. Redirect URI is window.location.origin + '/auth/callback'.
 */
'use client';

import { create } from 'zustand';
import { ADMIN_WCA_IDS, isAdminWcaId } from '@cuberoot/shared/admin';

export { ADMIN_WCA_IDS };

export interface WcaUser {
  wcaId: string;
  name: string;
  avatar: string;
  country: string;
}

interface AuthState {
  user: WcaUser | null;
}

interface AuthActions {
  login: () => void;
  logout: () => void;
  refresh: () => void;
}

const WCA_CLIENT_ID = 'mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4';
const WCA_AUTHORIZE_URL = 'https://www.worldcubeassociation.org/oauth/authorize';

const SESSION_KEY = 'wca_user';
const TOKEN_KEY = 'wca_access_token';
const STATE_KEY = 'wca_oauth_state';
const RETURN_URL_KEY = 'wca_return_url';

function readUser(): WcaUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: readUser(),

  login: () => {
    if (typeof window === 'undefined') return;
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(RETURN_URL_KEY, window.location.href);

    const redirectUri = window.location.origin + '/auth/callback';
    const params = [
      `client_id=${encodeURIComponent(WCA_CLIENT_ID)}`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      'response_type=token',
      'scope=public',
      `state=${encodeURIComponent(state)}`,
    ].join('&');

    window.location.href = `${WCA_AUTHORIZE_URL}?${params}`;
  },

  logout: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('cuberoot_jwt');
    set({ user: null });
  },

  refresh: () => {
    set({ user: readUser() });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY || e.key === TOKEN_KEY) {
      useAuthStore.getState().refresh();
    }
  });
}

export function getWcaToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function getWcaId(): string {
  return useAuthStore.getState().user?.wcaId || '';
}

export function isAdmin(): boolean {
  return isAdminWcaId(useAuthStore.getState().user?.wcaId);
}
