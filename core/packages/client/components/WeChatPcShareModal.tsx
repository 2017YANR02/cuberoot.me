'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Images, LoaderCircle, MessageCircle, Share2 } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { tr } from '@/i18n/tr';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { copyPageLink } from '@/lib/page-share';
import { isInWeChat } from '@/lib/wechat-share';
import { isMiniProgramWebView } from '@/lib/miniprogram-bridge';
import {
  shareCurrentPageToWeChat,
  WeChatPcShareError,
  type WeChatShareScene,
} from '@/lib/wechat-pc-opensdk';
import './wechat-pc-share-modal.css';

type ShareState = 'idle' | 'loading' | 'success' | 'error';

function errorText(error: unknown): string {
  const code = error instanceof WeChatPcShareError ? error.code : '';
  if (code === 'environment' || code === 'sdk-1') {
    return tr({ zh: '请在已登录且已解锁的电脑微信中使用。', en: 'Open this from a signed-in and unlocked WeChat desktop client.' });
  }
  if (code === 'https' || code === 'sdk--11033') {
    return tr({ zh: '当前页面不是安全的 HTTPS 页面，无法分享。', en: 'This page is not using secure HTTPS, so it cannot be shared.' });
  }
  if (code === 'disabled' || code === 'sdk--11034') {
    return tr({ zh: '当前网站应用尚未开通这项微信能力。', en: 'This WeChat capability is not enabled for the website app.' });
  }
  if (code === 'sdk--11032') {
    return tr({ zh: '当前页面不在已登记的业务域名下。', en: 'This page is outside the registered business domain.' });
  }
  if (code === 'sdk--11036') {
    return tr({ zh: '电脑微信版本过低，请升级后重试。', en: 'Update WeChat desktop and try again.' });
  }
  if (code === 'sdk-3' || code === 'sdk--11029' || code === 'ticket') {
    return tr({ zh: '微信分享凭证已失效，请重新点击分享。', en: 'The WeChat share ticket expired. Click share again.' });
  }
  if (code === 'rate-limit') {
    return tr({ zh: '操作过于频繁，请稍后再试。', en: 'Too many attempts. Please try again shortly.' });
  }
  if (code === 'sdk-2') {
    return tr({
      zh: '无法连接电脑微信。请在浏览器的网站权限中允许“本地网络访问”，并关闭全局代理后重试。',
      en: 'Cannot connect to WeChat desktop. Allow Local network access in this site\'s browser permissions and disable any global proxy, then try again.',
    });
  }
  if (code === 'sdk-timeout' || code === 'sdk-6') {
    return tr({
      zh: '电脑微信连接超时（即使微信已被唤起，也不代表分享连接成功）。最常见原因是系统或全局代理拦截了浏览器与微信的本机通信；请关闭代理，彻底退出并重启电脑微信后重试。',
      en: 'Connection to WeChat desktop timed out. Opening WeChat does not mean the share connection succeeded. A system or global proxy is the most common cause because it can block local communication between the browser and WeChat. Disable the proxy, fully quit and restart WeChat, then try again.',
    });
  }
  return tr({ zh: '暂时无法调用电脑微信，请稍后重试。', en: 'WeChat desktop is temporarily unavailable. Please try again.' });
}

export function PageShareModal({ share: page, onClose }: { share: { url: string; title: string }; onClose: () => void }) {
  const [state, setState] = useState<ShareState>('idle');
  const [activeScene, setActiveScene] = useState<WeChatShareScene | null>(null);
  const [message, setMessage] = useState('');
  const mountedRef = useRef(true);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const backdropProps = useModalDismiss(onClose, state === 'loading');
  const titleId = useId();
  const inContainer = isInWeChat() || isMiniProgramWebView();
  const desktop = !inContainer && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    && !window.matchMedia('(max-width: 768px)').matches;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const copyLink = async () => {
    const copied = await copyPageLink(page.url);
    if (mountedRef.current) setCopyState(copied ? 'success' : 'error');
  };

  const systemShare = async () => {
    try { await navigator.share(page); }
    catch (error) {
      if (mountedRef.current && !(error instanceof Error && error.name === 'AbortError')) {
        setState('error');
        setMessage(tr({ zh: '暂时无法打开系统分享，请复制链接。', en: 'System sharing is unavailable. Copy the link instead.' }));
      }
    }
  };

  const share = async (scene: WeChatShareScene) => {
    if (state === 'loading') return;
    setState('loading');
    setActiveScene(scene);
    setMessage('');
    try {
      await shareCurrentPageToWeChat(scene, page);
      if (!mountedRef.current) return;
      setState('success');
      setMessage(tr({
        zh: '微信分享调用已发起，请在电脑微信中查看并继续。',
        en: 'The WeChat share action was triggered. Continue in WeChat desktop.',
      }));
    } catch (error) {
      if (!mountedRef.current) return;
      setState('error');
      setMessage(errorText(error));
    } finally {
      if (mountedRef.current) setActiveScene(null);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="wechat-pc-share-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      {...backdropProps}
    >
      <div className="wechat-pc-share-modal" data-site-surface="panel">
        <ClearButton
          variant="standalone"
          className="wechat-pc-share-close"
          onClick={onClose}
          ariaLabel={tr({ zh: '关闭', en: 'Close' })}
        />
        <h2 id={titleId}>{tr({ zh: '分享当前页面', en: 'Share this page' })}</h2>
        <p>{page.title}</p>
        <button className="wechat-pc-share-action wechat-mobile-share-copy" type="button" onClick={copyLink}>
          {copyState === 'success' ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span>{copyState === 'success' ? tr({ zh: '链接已复制', en: 'Link copied' }) : tr({ zh: '复制链接', en: 'Copy link' })}</span>
        </button>
        {copyState === 'error' && <>
          <p className="wechat-pc-share-status is-error" role="alert">{tr({ zh: '复制失败，请长按或选中下方链接复制。', en: 'Copy failed. Select or press and hold the link below to copy it.' })}</p>
          <input className="page-share-url" readOnly value={page.url} onFocus={event => event.target.select()}
            aria-label={tr({ zh: '页面链接', en: 'Page link' })} />
        </>}
        {copyState === 'success' && <span className="sr-only" role="status">{tr({ zh: '链接已复制', en: 'Link copied' })}</span>}
        {inContainer && <ol className="wechat-mobile-share-steps">
          <li>{tr({ zh: '点右上角“…”', en: 'Tap “…” in the top-right corner' })}</li>
          <li>{tr({ zh: '选择“转发”或“发送给朋友”', en: 'Choose “Share” or “Send to a friend”' })}</li>
        </ol>}
        {!inContainer && typeof navigator.share === 'function' && <button className="wechat-pc-share-action wechat-mobile-share-copy" type="button" onClick={systemShare}>
          <Share2 aria-hidden /><span>{tr({ zh: '系统分享', en: 'System share' })}</span>
        </button>}
        {desktop && <div className="wechat-pc-share-actions">
          <button className="wechat-pc-share-action" type="button" onClick={() => share('chat')} disabled={state === 'loading'}>
            {activeScene === 'chat' ? <LoaderCircle className="wechat-pc-share-spinner" aria-hidden /> : <MessageCircle aria-hidden />}
            <span>{tr({ zh: '发给微信朋友', en: 'Send to a friend' })}</span>
          </button>
          <button className="wechat-pc-share-action" type="button" onClick={() => share('timeline')} disabled={state === 'loading'}>
            {activeScene === 'timeline' ? <LoaderCircle className="wechat-pc-share-spinner" aria-hidden /> : <Images aria-hidden />}
            <span>{tr({ zh: '分享到朋友圈', en: 'Share to Moments' })}</span>
          </button>
        </div>}
        {message && (
          <p className={`wechat-pc-share-status is-${state}`} role={state === 'error' ? 'alert' : 'status'}>
            {message}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
