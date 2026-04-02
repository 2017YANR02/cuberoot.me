/**
 * WCA OAuth 认证状态管理
 * NOTE: 使用 Implicit Grant 流程，token 通过 URL hash 直接返回，不需要后端参与
 * 复用根目录 /callback.html 处理回调，登录后自动跳回来源页
 */
import { create } from 'zustand';

// ── 类型 ──

export interface WcaUser {
  wcaId: string;
  name: string;
  avatar: string;   // 头像缩略图 URL
  country: string;  // ISO2 国家代码
}

interface AuthState {
  user: WcaUser | null;
}

interface AuthActions {
  /** 跳转 WCA 授权页开始登录 */
  login: () => void;
  /** 清除本地登录状态 */
  logout: () => void;
  /** 从 localStorage 刷新状态（跨 tab 同步用） */
  refresh: () => void;
}

// ── 常量 ──

// NOTE: WCA OAuth 配置（与 wca_auth.js 保持一致）
const WCA_CLIENT_ID = 'mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4';
const WCA_AUTHORIZE_URL = 'https://www.worldcubeassociation.org/oauth/authorize';
// NOTE: 回调地址使用 React 路由（/auth/callback），与 BrowserRouter basename 对齐
const REDIRECT_URI = window.location.origin + '/auth/callback';

const SESSION_KEY = 'wca_user';
const TOKEN_KEY = 'wca_access_token';
const STATE_KEY = 'wca_oauth_state';
const RETURN_URL_KEY = 'wca_return_url';

// NOTE: 管理员列表（前端仅控制 UI 显示，后端独立校验）
const ADMIN_WCA_IDS = ['2017YANR02'];

// ── 工具函数 ──

/** 从 localStorage 读取已缓存的用户信息 */
function readUser(): WcaUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Store ──

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  user: readUser(),

  login: () => {
    // NOTE: 生成随机 state 防 CSRF
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem(STATE_KEY, state);
    // NOTE: 记录当前页面 URL，回调后跳回
    sessionStorage.setItem(RETURN_URL_KEY, window.location.href);

    const params = [
      `client_id=${encodeURIComponent(WCA_CLIENT_ID)}`,
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
      'response_type=token',
      'scope=public',
      `state=${encodeURIComponent(state)}`,
    ].join('&');

    window.location.href = `${WCA_AUTHORIZE_URL}?${params}`;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('cuberoot_jwt');
    set({ user: null });
  },

  refresh: () => {
    set({ user: readUser() });
  },
}));

// ── 跨 tab 同步 ──

// NOTE: 监听 storage 事件——其他 tab 登录/登出时自动同步状态
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY || e.key === TOKEN_KEY) {
      useAuthStore.getState().refresh();
    }
  });
}

// ── 导出工具函数（供非组件代码使用） ──

/** 获取 WCA access token（用于 API 认证头） */
export function getWcaToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

/** 获取当前登录用户的 WCA ID */
export function getWcaId(): string {
  return useAuthStore.getState().user?.wcaId || '';
}

/** 判断当前用户是否为管理员 */
export function isAdmin(): boolean {
  const user = useAuthStore.getState().user;
  return user !== null && ADMIN_WCA_IDS.includes(user.wcaId);
}
