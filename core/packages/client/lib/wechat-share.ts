'use client';

// 微信 JS-SDK 分享卡片(会话 + 朋友圈)。
//
// 全站被动 og 标签(app/layout.tsx)已让「微信会话内发链接 / Telegram / Twitter 等」
// 出卡片;但**朋友圈**更严,可靠出卡片基本要在微信内置浏览器里主动调 wx.config +
// updateTimelineShareData / updateAppMessageShareData。本模块封装这条链路:
//   isInWeChat → 拿当前页 URL 的签名(后端 /v1/wechat/jssdk-signature)→ 载 SDK →
//   wx.config → wx.ready 里 set 会话 + 朋友圈 卡片。
//
// 全部软降级:非微信环境、后端未配公众号({disabled:true})、签名/SDK 加载失败 —— 一律
// 静默 no-op,页面照常。公众号配好 WECHAT_MP_APPID/SECRET + JS 安全域名 + IP 白名单后自动点亮。

import { apiUrl } from './api-base';

// 自托管(遵守「自成一体」);见 public/vendor/jweixin-1.6.0.js。
const JWEIXIN_SRC = '/vendor/jweixin-1.6.0.js';

export interface WeChatShareData {
  title: string;
  desc?: string;
  link?: string;   // 默认 = 当前页 URL(去 hash)
  imgUrl?: string; // 默认 = 站点 logo(同源绝对地址)
}

interface WxSdk {
  config(o: Record<string, unknown>): void;
  ready(cb: () => void): void;
  error(cb: (e: unknown) => void): void;
  updateAppMessageShareData(o: Record<string, unknown>): void;
  updateTimelineShareData(o: Record<string, unknown>): void;
}
declare global {
  interface Window { wx?: WxSdk }
}

export function isInWeChat(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent || '');
}

let sdkPromise: Promise<WxSdk | null> | null = null;
function loadSdk(): Promise<WxSdk | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.wx) return Promise.resolve(window.wx);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = JWEIXIN_SRC;
    s.async = true;
    s.onload = () => resolve(window.wx ?? null);
    s.onerror = () => { sdkPromise = null; resolve(null); }; // 允许后续重试
    document.head.appendChild(s);
  });
  return sdkPromise;
}

interface SigResp {
  appId?: string; timestamp?: string; nonceStr?: string; signature?: string;
  disabled?: boolean; error?: string;
}

// 一旦确定本站未启用微信分享(后端 disabled,或签名路由尚未上线 → 404),本会话不再重试,
// 免得在微信里每次 SPA 导航都白打一发签名请求。仅对「确定性未启用」置位,瞬时网络错误不置位。
let sessionDisabled = false;

/** 用当前页 URL 配置微信分享卡片。非微信 / 后端未配置 / 加载失败 → 静默 no-op。 */
export async function configureWeChatShare(data: WeChatShareData): Promise<void> {
  if (sessionDisabled || !isInWeChat() || !data.title) return;
  // 签名的 URL 必须与前端 location.href.split('#')[0] 逐字节一致。
  const link = data.link || window.location.href.split('#')[0];
  const imgUrl = data.imgUrl || `${window.location.origin}/icons/CubeRoot.png`;

  let res: Response;
  try {
    res = await fetch(apiUrl(`/v1/wechat/jssdk-signature?url=${encodeURIComponent(link)}`));
  } catch {
    return; // 瞬时网络错误:不置 sessionDisabled,下次导航仍可重试
  }
  if (res.status === 404) { sessionDisabled = true; return; } // 签名路由未部署 → 本会话不再试
  if (!res.ok) return;
  let sig: SigResp;
  try {
    sig = (await res.json()) as SigResp;
  } catch {
    return;
  }
  if (sig?.disabled) { sessionDisabled = true; return; } // 未配公众号 → 本会话不再试
  if (!sig || !sig.signature || !sig.appId) return;

  const wx = await loadSdk();
  if (!wx) return;

  const share = { title: data.title, desc: data.desc || '', link, imgUrl };
  wx.config({
    debug: false,
    appId: sig.appId,
    timestamp: sig.timestamp,
    nonceStr: sig.nonceStr,
    signature: sig.signature,
    jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'],
  });
  wx.ready(() => {
    try { wx.updateAppMessageShareData(share); } catch { /* noop */ }
    try { wx.updateTimelineShareData(share); } catch { /* noop */ }
  });
  wx.error(() => { /* 签名过期 / 域名未加白:静默,卡片退回微信默认抓取 */ });
}
