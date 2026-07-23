'use client';

// ⚠️ 永久休眠(2026-07 定论,勿再叫用户配 env / 认证)————————————————————————————
// 本站公众号「魔方根」是**个人主体订阅号**;微信 2014 年后对个人订阅号关闭了「微信认证」
// 通道,而 JS-SDK「分享接口」只对认证号开放(官方权限对照表:未认证列为空)。故本模块对本
// 账号**永远无法激活**:即便配了 WECHAT_MP_APPID/SECRET,jsapi_ticket 能拿到(属基础接口),
// 但 updateTimelineShareData / updateAppMessageShareData 会 permission denied,分享卡设不上。
// 唯一复活路 = 换成「企业主体的认证服务号」。代码全留着,仅为将来换号时即插即用。
// 背景全档见记忆 project_social_share_cards。桶一(og/SSR/SEO)与本模块无关,照常生效。
// ————————————————————————————————————————————————————————————————————————————
// 微信 JS-SDK 分享卡片(会话 + 朋友圈)。软降级链路:isInWeChat → 后端签名
// (/v1/wechat/jssdk-signature)→ 载 SDK → wx.config → wx.ready 里 set 会话 + 朋友圈 卡片。
// 非微信环境 / 后端 {disabled:true} / 签名 / SDK 加载失败 —— 一律静默 no-op,页面照常。

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
