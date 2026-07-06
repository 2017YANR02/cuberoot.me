'use client';

// 国内三方登录(微信/QQ/支付宝)浏览器端:授权码重定向流。
// 生成 state(CSRF)存 sessionStorage → 向服务端要授权页 URL(redirect_uri 服务端固定)→ 整页跳转。
// 回来落到 app/auth/social/callback,凭 state + provider + intent 决定登录/绑定。
// sessionStorage 跨整页跳转(离站再回)同标签同源仍在,与 WCA 流程同一套机制。

import { fetchSocialAuthorizeUrl, type SocialProvider } from './account-api';

export const SOCIAL_STATE_KEY = 'social_oauth_state';
export const SOCIAL_PROVIDER_KEY = 'social_oauth_provider';
export const SOCIAL_INTENT_KEY = 'social_oauth_intent';
export const SOCIAL_RETURN_KEY = 'social_oauth_return';

/** 发起三方登录/绑定。intent='login' 未登录时登录;'link' 已登录时把该身份加到当前账号。
 *  先拿 URL(失败即抛,给调用方在弹层里显错),成功再写 session + 跳转。 */
export async function startSocialLogin(provider: SocialProvider, intent: 'login' | 'link'): Promise<void> {
  if (typeof window === 'undefined') return;
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const url = await fetchSocialAuthorizeUrl(provider, state);
  sessionStorage.setItem(SOCIAL_STATE_KEY, state);
  sessionStorage.setItem(SOCIAL_PROVIDER_KEY, provider);
  sessionStorage.setItem(SOCIAL_INTENT_KEY, intent);
  sessionStorage.setItem(SOCIAL_RETURN_KEY, window.location.href);
  window.location.href = url;
}
