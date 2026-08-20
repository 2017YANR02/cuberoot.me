'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Images, LoaderCircle, MessageCircle } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { tr } from '@/i18n/tr';
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

export function WeChatPcShareModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<ShareState>('idle');
  const [activeScene, setActiveScene] = useState<WeChatShareScene | null>(null);
  const [message, setMessage] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state !== 'loading') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, state]);

  const share = async (scene: WeChatShareScene) => {
    if (state === 'loading') return;
    setState('loading');
    setActiveScene(scene);
    setMessage('');
    try {
      await shareCurrentPageToWeChat(scene);
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
      aria-labelledby="wechat-pc-share-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && state !== 'loading') onClose();
      }}
    >
      <div className="wechat-pc-share-modal">
        <ClearButton
          variant="standalone"
          className="wechat-pc-share-close"
          onClick={onClose}
          ariaLabel={tr({ zh: '关闭', en: 'Close' })}
        />
        <h2 id="wechat-pc-share-title">{tr({ zh: '微信分享', en: 'Share to WeChat' })}</h2>
        <p>{tr({
          zh: '调用电脑微信分享当前页面。请先登录并解锁电脑微信。',
          en: 'Share this page through WeChat desktop. Sign in and unlock WeChat first.',
        })}</p>
        <div className="wechat-pc-share-actions">
          <button className="wechat-pc-share-action" type="button" onClick={() => share('chat')} disabled={state === 'loading'}>
            {activeScene === 'chat' ? <LoaderCircle className="wechat-pc-share-spinner" aria-hidden /> : <MessageCircle aria-hidden />}
            <span>{tr({ zh: '发给微信朋友', en: 'Send to a friend' })}</span>
          </button>
          <button className="wechat-pc-share-action" type="button" onClick={() => share('timeline')} disabled={state === 'loading'}>
            {activeScene === 'timeline' ? <LoaderCircle className="wechat-pc-share-spinner" aria-hidden /> : <Images aria-hidden />}
            <span>{tr({ zh: '分享到朋友圈', en: 'Share to Moments' })}</span>
          </button>
        </div>
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

export function MobilePageShareModal({
  mode,
  onClose,
}: {
  mode: 'wechat' | 'browser';
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); } catch { /* Clipboard fallback unavailable. */ }
      textarea.remove();
    }
    setCopied(true);
  };

  if (typeof document === 'undefined') return null;
  const inWeChat = mode === 'wechat';
  return createPortal(
    <div
      className="wechat-pc-share-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-page-share-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="wechat-pc-share-modal">
        <ClearButton
          variant="standalone"
          className="wechat-pc-share-close"
          onClick={onClose}
          ariaLabel={tr({ zh: '关闭', en: 'Close' })}
        />
        <h2 id="mobile-page-share-title">{tr({ zh: '分享当前页面', en: 'Share this page' })}</h2>
        {inWeChat ? (
          <>
            <p>{tr({
              zh: '微信内置浏览器不允许网页直接弹出分享对象，请使用微信自己的菜单：',
              en: 'WeChat does not let a web page open the recipient picker directly. Use WeChat’s own menu:',
            })}</p>
            <ol className="wechat-mobile-share-steps">
              <li>{tr({ zh: '点右上角“…”', en: 'Tap “…” in the top-right corner' })}</li>
              <li>{tr({ zh: '选择“发送给朋友”或“分享到朋友圈”', en: 'Choose “Send to a friend” or “Share to Moments”' })}</li>
            </ol>
          </>
        ) : (
          <>
            <p>{tr({
              zh: '当前浏览器无法打开系统分享面板。复制链接后，可直接粘贴到微信发送。',
              en: 'This browser could not open the system share sheet. Copy the link and paste it into WeChat.',
            })}</p>
            <button className="wechat-pc-share-action wechat-mobile-share-copy" type="button" onClick={copyLink}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              <span>{copied ? tr({ zh: '链接已复制', en: 'Link copied' }) : tr({ zh: '复制页面链接', en: 'Copy page link' })}</span>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
