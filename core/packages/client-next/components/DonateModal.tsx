'use client';

import { useEffect, useRef, useState } from 'react';
import { User, Mail, Copy, Check } from 'lucide-react';
import AppLink from '@/components/AppLink';
import './donate-modal.css';

interface Props {
  lang: 'zh' | 'en';
  onClose: () => void;
}

const ICON_SIZE = 14;

function YoutubeIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function BilibiliIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/>
    </svg>
  );
}

function WechatIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.158c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
    </svg>
  );
}

function QqIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.527 4.632 17.04 0 12 0S4.473 4.632 4.473 9.241c0 .274.013.804.014.836l-1.08 2.695a38.97 38.97 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673.54.065 2.103-2.472 2.103-2.472 0 1.469.756 3.387 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.482.189 1.6.18 7.14.389 7.483-.189.078-.132.132-.458-.301-.778-.483-.356-1.233-.646-1.846-.836 1.637-1.384 2.393-3.302 2.393-4.771 0 0 1.563 2.537 2.103 2.472.251-.03.581-1.39-.438-4.673z"/>
    </svg>
  );
}

function TiktokIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}

export default function DonateModal({ lang, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, [onClose]);

  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en);

  const copy = (key: string, text: string) => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    };
    const after = () => {
      setCopied(key);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(after, () => { fallback(); after(); });
    } else {
      fallback();
      after();
    }
  };

  return (
    <div className="donate-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="donate-modal" onClick={(e) => e.stopPropagation()}>
        <button className="donate-close" onClick={onClose} aria-label={t('关闭', 'Close')}>✕</button>
        <h2 className="donate-title">{t('支持 CubeRoot', 'Support CubeRoot')}</h2>

        <div className="donate-qr-row">
          <figure className="donate-qr">
            <img src="/donate/alipay.webp" alt="Alipay QR" width={600} height={899}
              loading="eager" decoding="async" fetchPriority="high" />
            <figcaption>{t('支付宝', 'Alipay')}</figcaption>
          </figure>
          <figure className="donate-qr">
            <img src="/donate/wechat.webp" alt="WeChat Pay QR" width={600} height={814}
              loading="eager" decoding="async" fetchPriority="high" />
            <figcaption>{t('微信支付', 'WeChat Pay')}</figcaption>
          </figure>
        </div>

        <dl className="donate-contact">
          <div className="donate-contact-row">
            <dt><span className="donate-contact-icon"><User size={ICON_SIZE} strokeWidth={1.8} /></span>{t('作者', 'Author')}</dt>
            <dd>{t('颜瑞民 (CubeRoot)', 'Ruimin Yan (CubeRoot)')}</dd>
          </div>
          <div className="donate-contact-row">
            <dt><span className="donate-contact-icon donate-icon-wechat"><WechatIcon /></span>{t('微信', 'WeChat')}</dt>
            <dd>
              <code>mofanggen</code>
              <button
                type="button"
                className="donate-copy-btn"
                onClick={() => copy('wechat', 'mofanggen')}
                title={copied === 'wechat' ? t('已复制', 'Copied') : t('复制', 'Copy')}
                aria-label={t('复制', 'Copy')}
              >
                {copied === 'wechat'
                  ? <Check size={ICON_SIZE} strokeWidth={2} />
                  : <Copy size={ICON_SIZE} strokeWidth={1.8} />}
              </button>
            </dd>
          </div>
          <div className="donate-contact-row">
            <dt><span className="donate-contact-icon donate-icon-qq"><QqIcon /></span>QQ</dt>
            <dd>
              <code>164422421</code>
              <button
                type="button"
                className="donate-copy-btn"
                onClick={() => copy('qq', '164422421')}
                title={copied === 'qq' ? t('已复制', 'Copied') : t('复制', 'Copy')}
                aria-label={t('复制', 'Copy')}
              >
                {copied === 'qq'
                  ? <Check size={ICON_SIZE} strokeWidth={2} />
                  : <Copy size={ICON_SIZE} strokeWidth={1.8} />}
              </button>
            </dd>
          </div>
          <div className="donate-contact-row">
            <dt><span className="donate-contact-icon"><Mail size={ICON_SIZE} strokeWidth={1.8} /></span>{t('邮箱', 'Email')}</dt>
            <dd>
              <a href="mailto:yrmfxc@gmail.com">yrmfxc@gmail.com</a>
              <button
                type="button"
                className="donate-copy-btn"
                onClick={() => copy('email', 'yrmfxc@gmail.com')}
                title={copied === 'email' ? t('已复制', 'Copied') : t('复制', 'Copy')}
                aria-label={t('复制', 'Copy')}
              >
                {copied === 'email'
                  ? <Check size={ICON_SIZE} strokeWidth={2} />
                  : <Copy size={ICON_SIZE} strokeWidth={1.8} />}
              </button>
            </dd>
          </div>
          <div className="donate-contact-row donate-contact-row-link-wrap">
            <a
              href="https://www.youtube.com/@cuberootme"
              target="_blank"
              rel="noopener noreferrer"
              className="donate-contact-link"
            >
              <span className="donate-contact-icon donate-icon-youtube"><YoutubeIcon /></span>
              <span>YouTube</span>
            </a>
          </div>
          <div className="donate-contact-row donate-contact-row-link-wrap">
            <a
              href="https://space.bilibili.com/432490072"
              target="_blank"
              rel="noopener noreferrer"
              className="donate-contact-link"
            >
              <span className="donate-contact-icon donate-icon-bilibili"><BilibiliIcon /></span>
              <span>{t('哔哩哔哩', 'Bilibili')}</span>
            </a>
          </div>
          <div className="donate-contact-row donate-contact-row-link-wrap">
            <a
              href="https://www.tiktok.com/@cuberoot_official"
              target="_blank"
              rel="noopener noreferrer"
              className="donate-contact-link"
            >
              <span className="donate-contact-icon donate-icon-tiktok"><TiktokIcon /></span>
              <span>TikTok</span>
            </a>
          </div>
        </dl>

        <div className="donate-credits">
          <AppLink href="/support" onClick={onClose}>{t('查看致谢名单 →', 'See our supporters →')}</AppLink>
        </div>

        <div className="donate-thanks">{t('谢谢你的支持 ♡', 'Thanks for your support ♡')}</div>
      </div>
    </div>
  );
}
