'use client';

// 国内三方登录(微信/QQ/支付宝)浏览器端:授权码重定向流。
// state 由服务端签名(内含 provider/intent/exp/签名),嵌进授权 URL、回调时原样回来,服务端验签做 CSRF。
// **不依赖 sessionStorage**:手机唤起支付宝 App 授权后,回调常落到另一浏览器上下文(系统浏览器 /
// App 内置浏览器),sessionStorage 会丢 → 校验必须无状态。sessionStorage 只留 returnUrl(同上下文回来时
// 用来跳回原页,丢了就回首页,不影响登录成败)。

import { fetchSocialAuthorizeUrl, type SocialProvider } from './account-api';

// 回跳目标页(best-effort;跨浏览器上下文丢失时回调兜底回首页)。
export const SOCIAL_RETURN_KEY = 'social_oauth_return';

/** 发起三方登录/绑定。intent='login' 未登录时登录;'link' 已登录时把该身份加到当前账号。
 *  先拿 URL(失败即抛,给调用方在弹层里显错),成功再跳转。 */
export async function startSocialLogin(provider: SocialProvider, intent: 'login' | 'link'): Promise<void> {
  if (typeof window === 'undefined') return;
  const url = await fetchSocialAuthorizeUrl(provider, intent);
  try { sessionStorage.setItem(SOCIAL_RETURN_KEY, window.location.href); } catch { /* 隐私模式忽略 */ }
  window.location.href = alipayMobileWakeUrl(provider, url);
}

/** 手机端把支付宝授权页包进 `alipays://` scheme,直接唤起支付宝 App 授权(而非 PC 扫码页)。
 *  appId=20000067 是支付宝内置 H5 容器;授权完成后仍按 redirect_uri 回跳。
 *  - 非支付宝 provider:原样返回(微信/QQ 唤起机制不同)。
 *  - 桌面端:保留 https 授权页(扫码是 PC 正解)。
 *  - 已在支付宝 App 内置浏览器(AlipayClient):直接用 https,容器自身能处理,避免 scheme 套娃。 */
export function alipayMobileWakeUrl(provider: SocialProvider, url: string): string {
  if (provider !== 'alipay') return url;
  const ua = navigator.userAgent || '';
  if (/AlipayClient/i.test(ua)) return url;
  const isMobile = /android|iphone|ipad|ipod|harmony|mobile/i.test(ua);
  if (!isMobile) return url;
  return `alipays://platformapi/startapp?appId=20000067&url=${encodeURIComponent(url)}`;
}
