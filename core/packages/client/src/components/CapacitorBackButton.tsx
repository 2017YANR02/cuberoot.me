/**
 * Capacitor Android 硬件 back 键 / iOS swipe gesture 默认走 webView.canGoBack(),
 * 只识别 page load 不识别 React Router pushState → SPA 里点 ◁ 直接 exitApp。
 * 这里改成: 不在 / 时 navigate(-1),在 / 时 App.exitApp()。
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function CapacitorBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let handle: { remove: () => Promise<void> } | undefined;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');
      handle = await App.addListener('backButton', () => {
        if (location.pathname === '/') {
          App.exitApp();
        } else {
          navigate(-1);
        }
      });
    })();
    return () => { handle?.remove?.(); };
  }, [location.pathname, navigate]);

  return null;
}
