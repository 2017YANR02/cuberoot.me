'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Images, LoaderCircle, MessageCircle } from 'lucide-react';
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
  if (code === 'sdk-timeout' || code === 'sdk-6') {
    return tr({ zh: '等待电脑微信响应超时，请确认微信已登录并解锁。', en: 'WeChat desktop did not respond. Make sure it is signed in and unlocked.' });
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
      setMessage(tr({ zh: '已交给电脑微信，请在微信窗口中完成分享。', en: 'Sent to WeChat desktop. Finish sharing in the WeChat window.' }));
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
          <button type="button" onClick={() => share('chat')} disabled={state === 'loading'}>
            {activeScene === 'chat' ? <LoaderCircle className="wechat-pc-share-spinner" aria-hidden /> : <MessageCircle aria-hidden />}
            <span>{tr({ zh: '发给微信朋友', en: 'Send to a friend' })}</span>
          </button>
          <button type="button" onClick={() => share('timeline')} disabled={state === 'loading'}>
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
