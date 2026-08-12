import { Capacitor } from '@capacitor/core';
import {
  DefaultAndroidWebViewOptions,
  DefaultiOSWebViewOptions,
  DefaultWebViewOptions,
  InAppBrowser,
} from '@capacitor/inappbrowser';
import { Network } from '@capacitor/network';
import { useCallback, useEffect, useRef, useState } from 'react';

const SITE_ORIGIN = 'https://cuberoot.me';

const COPY = {
  en: {
    checking: 'Checking connection',
    close: 'Close',
    error: 'Could not open CubeRoot. Check your connection and try again.',
    launch: 'Enter CubeRoot',
    launching: 'Opening CubeRoot',
    offline: 'Offline',
    offlineDetail: 'Reconnect to load the latest CubeRoot tools.',
    online: 'Online',
    onlineDetail: 'Website updates appear here automatically.',
    summary: 'The full CubeRoot toolkit, kept in step with the website.',
  },
  zh: {
    checking: '正在检查网络',
    close: '关闭',
    error: '未能打开 CubeRoot，请检查网络后重试。',
    launch: '进入 CubeRoot',
    launching: '正在打开 CubeRoot',
    offline: '当前离线',
    offlineDetail: '恢复网络后即可加载最新功能。',
    online: '已连接',
    onlineDetail: '网站更新会自动同步到这里。',
    summary: '完整的 CubeRoot 工具，始终与网站保持同步。',
  },
} as const;

type SupportedLanguage = keyof typeof COPY;
type ConnectionState = 'checking' | 'offline' | 'online';

function preferredLanguage(): SupportedLanguage {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function siteUrl(language: SupportedLanguage): string {
  return language === 'zh' ? `${SITE_ORIGIN}/zh` : `${SITE_ORIGIN}/`;
}

export function App() {
  const language = preferredLanguage();
  const copy = COPY[language];
  const isNative = Capacitor.isNativePlatform();
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState(false);
  const didAutoOpen = useRef(false);
  const url = siteUrl(language);

  useEffect(() => {
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;

    void Network.getStatus()
      .then(({ connected }) => {
        if (!disposed) {
          setConnection(connected ? 'online' : 'offline');
        }
      })
      .catch(() => {
        if (!disposed) {
          setConnection(navigator.onLine ? 'online' : 'offline');
        }
      });

    void Network.addListener('networkStatusChange', ({ connected }) => {
      if (!disposed) {
        setConnection(connected ? 'online' : 'offline');
        if (connected) {
          setOpenError(false);
        }
      }
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        removeListener = handle.remove;
      }
    });

    return () => {
      disposed = true;
      void removeListener?.();
    };
  }, []);

  const openSite = useCallback(async () => {
    if (connection === 'offline' || isOpening) {
      return;
    }

    setIsOpening(true);
    setOpenError(false);

    if (!isNative) {
      window.location.assign(url);
      return;
    }

    try {
      await InAppBrowser.openInWebView({
        url,
        options: {
          ...DefaultWebViewOptions,
          showURL: false,
          clearCache: false,
          clearSessionCache: false,
          closeButtonText: copy.close,
          android: {
            ...DefaultAndroidWebViewOptions,
            hardwareBack: true,
            isIsolated: true,
          },
          iOS: {
            ...DefaultiOSWebViewOptions,
            allowInLineMediaPlayback: true,
            allowsBackForwardNavigationGestures: true,
          },
        },
      });
    } catch {
      setOpenError(true);
    } finally {
      setIsOpening(false);
    }
  }, [connection, copy.close, isNative, isOpening, url]);

  useEffect(() => {
    if (!isNative || connection !== 'online' || didAutoOpen.current) {
      return;
    }

    didAutoOpen.current = true;
    void openSite();
  }, [connection, isNative, openSite]);

  const statusTitle = connection === 'checking'
    ? copy.checking
    : connection === 'online'
      ? copy.online
      : copy.offline;
  const statusDetail = connection === 'offline' ? copy.offlineDetail : copy.onlineDetail;
  const launchLabel = isOpening ? copy.launching : copy.launch;

  return (
    <main className="app-shell">
      <section className="gateway" aria-labelledby="app-title">
        <div className="cube-mark" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span className="cube-sticker" key={index} />
          ))}
        </div>

        <h1 id="app-title">CubeRoot</h1>
        <p className="summary">{copy.summary}</p>

        <a
          aria-disabled={connection !== 'online' || isOpening}
          className="launch-link"
          href={url}
          onClick={(event) => {
            if (isNative || connection !== 'online') {
              event.preventDefault();
            }
            void openSite();
          }}
        >
          <span>{launchLabel}</span>
          <span className="launch-arrow" aria-hidden="true">↗</span>
        </a>

        <div className="connection-status" aria-live="polite">
          <span className={`status-dot status-dot--${connection}`} aria-hidden="true" />
          <span>
            <strong>{statusTitle}</strong>
            <small>{openError ? copy.error : statusDetail}</small>
          </span>
        </div>
      </section>
    </main>
  );
}
