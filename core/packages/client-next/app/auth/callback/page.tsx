'use client';

// WCA OAuth Implicit Grant callback — ported from packages/client/src/pages/AuthCallbackPage.tsx.
// Reads access_token from URL hash, calls WCA /me, exchanges for long-lived JWT, then returns to wca_return_url.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';


const ME_URL = 'https://www.worldcubeassociation.org/api/v0/me';

// React StrictMode double-invokes useEffect in dev. Single-shot guard so OAuth state isn't consumed twice.
let callbackProcessed = false;

export default function AuthCallbackPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');
  const isZh = typeof navigator !== 'undefined' && navigator.language.startsWith('zh');

  useEffect(() => {

    if (callbackProcessed) return;
    callbackProcessed = true;
    void handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOAuthCallback() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setErrorMsg(isZh ? `授权被拒绝: ${error}` : `Authorization denied: ${error}`);
      return;
    }
    if (!accessToken) {
      setErrorMsg(isZh ? '未获取到 access_token' : 'No access_token received');
      return;
    }

    const savedState = sessionStorage.getItem('wca_oauth_state');
    if (!savedState || savedState !== state) {
      setErrorMsg(isZh ? 'OAuth state 不匹配，请重试' : 'OAuth state mismatch, please retry');
      return;
    }
    sessionStorage.removeItem('wca_oauth_state');

    try {
      const res = await fetch(ME_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`WCA /me failed: ${res.status}`);
      const data = await res.json();
      const me = data.me;

      const user = {
        wcaId: me.wca_id,
        name: me.name,
        avatar: me.avatar?.thumb_url || '',
        country: me.country_iso2 || '',
      };
      localStorage.setItem('wca_user', JSON.stringify(user));
      localStorage.setItem('wca_access_token', accessToken);

      // Best effort: exchange short-lived WCA token for long-lived (365d) JWT.
      try {
        const exchangeRes = await fetch(apiUrl('/v1/auth/exchange'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });
        if (exchangeRes.ok) {
          const { token: jwtToken } = await exchangeRes.json();
          localStorage.setItem('cuberoot_jwt', jwtToken);
        }
      } catch {
        // Non-fatal — fall back to raw WCA token (2h).
      }

      const returnUrl = sessionStorage.getItem('wca_return_url') || '/recon';
      sessionStorage.removeItem('wca_return_url');
      try {
        const u = new URL(returnUrl, window.location.href);
        router.replace(u.pathname + u.search + u.hash);
      } catch {
        router.replace('/recon');
      }
    } catch (err) {
      setErrorMsg(isZh ? `登录失败: ${(err as Error).message}` : `Login failed: ${(err as Error).message}`);
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
    color: '#e0e0e0',
    fontFamily: "'Inter', Arial, sans-serif",
  };

  return (
    <>
      <div style={overlayStyle}>
        {errorMsg ? (
          <div style={{ color: '#f87171', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <X size={18} /> {errorMsg}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-block', width: 24, height: 24,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: '#60a5fa', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', marginBottom: 12,
            }} />
            <div>{isZh ? '正在登录 WCA...' : 'Signing in to WCA...'}</div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
