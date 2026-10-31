'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useLinkStatus } from 'next/link';
import { useEffectiveTheme } from '@/lib/theme';
import { tr, type Msg } from '@/i18n/tr';

const DEFAULT_SLOW_LOAD_MS = 20_000;

const COPY = {
  loading: { zh: '正在加载…', en: 'Loading…' },
  slowTitle: { zh: '页面加载时间过长', en: 'This page is taking too long to load' },
  slowMessage: {
    zh: '请检查网络后重试。如果仍然失败，请升级浏览器或在系统浏览器中打开。',
    en: 'Check your connection and retry. If it still fails, update your browser or open the page in your system browser.',
  },
  failedTitle: { zh: '页面未能启动', en: 'Page failed to start' },
  failedMessage: {
    zh: '请重新加载。如果仍然失败，请检查网络并升级浏览器。',
    en: 'Reload the page. If it still fails, check your connection and update your browser.',
  },
  diagnosticCode: { zh: '诊断编号', en: 'Diagnostic code' },
  retry: { zh: '重试', en: 'Retry' },
} as const;

interface AppFailureProps {
  diagnosticCode?: string;
  message?: Msg;
  onRetry?: () => void;
  overlay?: boolean;
  title?: Msg;
}

export function AppFailure({
  diagnosticCode,
  message = COPY.failedMessage,
  onRetry = () => window.location.reload(),
  overlay = false,
  title = COPY.failedTitle,
}: AppFailureProps) {
  return (
    <div
      className={`app-startup app-startup-error${overlay ? ' app-startup-overlay' : ' app-startup-page'}`}
      role="alert"
    >
      <h1 className="app-startup-title">{tr(title)}</h1>
      <p className="app-startup-message">{tr(message)}</p>
      {diagnosticCode && (
        <p className="app-startup-diagnostic">
          <span>{tr(COPY.diagnosticCode)}</span>
          <code>{diagnosticCode}</code>
        </p>
      )}
      <div className="app-startup-actions">
        <button type="button" className="app-startup-button app-startup-button-primary" onClick={onRetry}>
          {tr(COPY.retry)}
        </button>
      </div>
    </div>
  );
}

interface ClientLoadStatusProps {
  label?: Msg;
  timeoutMs?: number;
}

/** Visible fallback for a route-critical `next/dynamic({ ssr: false })` chunk. */
export function ClientLoadStatus({
  label = COPY.loading,
  timeoutMs = DEFAULT_SLOW_LOAD_MS,
}: ClientLoadStatusProps) {
  const [slow, setSlow] = useState(false);
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_SLOW_LOAD_MS;

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), safeTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [safeTimeoutMs]);

  if (slow) {
    return <AppFailure title={COPY.slowTitle} message={COPY.slowMessage} />;
  }

  return (
    <div className="app-startup app-startup-loading app-startup-page" role="status" aria-live="polite">
      <LoadingBrandMark />
      <p>{tr(label)}</p>
    </div>
  );
}

/** Reuse the original SVG without duplicating or modifying its brand geometry. */
export function LoadingBrandMark() {
  const theme = useEffectiveTheme();
  const src = theme === 'dark' ? '/icons/CubeRoot-mark-dark.svg' : '/icons/CubeRoot-mark.svg';
  return <span className="loading-brand-mark" aria-hidden="true">
    <img src={src} alt="" width={144} height={82} />
    <img className="loading-brand-colours" src={src} alt="" width={144} height={82} />
  </span>;
}

/** Shared by actual navigation and the component gallery preview. */
export function NavigationLoadOverlay({ pending }: { pending: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending && !visible) return;
    const timer = window.setTimeout(() => setVisible(pending), pending ? 250 : 180);
    return () => window.clearTimeout(timer);
  }, [pending, visible]);
  if (!visible) return null;
  return createPortal(
    <div className={`app-navigation-loading${pending ? '' : ' is-leaving'}`} role="status" aria-live="polite">
      <LoadingBrandMark />
      <span className="sr-only">{tr(COPY.loading)}</span>
    </div>,
    document.body,
  );
}

const pendingLinks = new Set<symbol>();
const navigationListeners = new Set<() => void>();
const notifyNavigation = () => navigationListeners.forEach(listener => listener());
const subscribeNavigation = (listener: () => void) => {
  navigationListeners.add(listener);
  return () => { navigationListeners.delete(listener); };
};
const navigationSnapshot = () => pendingLinks.size > 0;
const serverNavigationSnapshot = () => false;

/** A single layout-owned portal survives the outgoing link unmounting so it can fade out. */
export function NavigationLoadingHost() {
  const pending = useSyncExternalStore(subscribeNavigation, navigationSnapshot, serverNavigationSnapshot);
  return <NavigationLoadOverlay pending={pending} />;
}

/** Lives under NextLink so cancellation, errors and completion follow Next's transition. */
export function LinkPendingIndicator() {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    const token = Symbol();
    pendingLinks.add(token);
    notifyNavigation();
    return () => {
      pendingLinks.delete(token);
      notifyNavigation();
    };
  }, [pending]);
  return null;
}
