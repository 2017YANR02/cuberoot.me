/**
 * WCA OAuth 回调页——处理 Implicit Grant 返回的 access_token
 * NOTE: 从 URL hash 解析 token → 验证 state → 调用 /me → 存 localStorage → 跳回来源页
 * 替代根目录 callback.html，使 React 应用在所有环境下自包含处理 OAuth 回调
 */
import { useEffect, useState } from 'react';

const ME_URL = 'https://www.worldcubeassociation.org/api/v0/me';

export default function AuthCallbackPage() {
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  async function handleOAuthCallback() {
    // NOTE: 解析 URL hash 中的参数（Implicit Grant 的 token 在 # 后面）
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setErrorMsg(`授权被拒绝: ${error}`);
      return;
    }

    if (!accessToken) {
      setErrorMsg('未获取到 access_token');
      return;
    }

    // NOTE: 验证 state 防 CSRF
    const savedState = sessionStorage.getItem('wca_oauth_state');
    if (!savedState || savedState !== state) {
      setErrorMsg('OAuth state 不匹配，请重试');
      return;
    }
    sessionStorage.removeItem('wca_oauth_state');

    try {
      // NOTE: 用 token 调 WCA /me API 获取用户信息
      const res = await fetch(ME_URL, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
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

      // NOTE: 存入 localStorage（与 wca_auth.js / auth_store 使用相同 key）
      localStorage.setItem('wca_user', JSON.stringify(user));
      localStorage.setItem('wca_access_token', accessToken);

      // NOTE: 跳回登录前的页面，无记录时 fallback 到 /app/recon
      const returnUrl = sessionStorage.getItem('wca_return_url') || '/app/recon';
      sessionStorage.removeItem('wca_return_url');
      window.location.href = returnUrl;
    } catch (err) {
      setErrorMsg(`登录失败: ${(err as Error).message}`);
    }
  }

  if (errorMsg) {
    return (
      <div style={{
        background: '#161616', color: '#e0e0e0', minHeight: '100vh',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontFamily: "'Inter', Arial, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#f87171', fontSize: '1.1rem' }}>❌ {errorMsg}</div>
          <div style={{ marginTop: 12 }}>
            <a href="/app/recon" style={{ color: '#60a5fa' }}>返回复盘</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#161616', color: '#e0e0e0', minHeight: '100vh',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      fontFamily: "'Inter', Arial, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', width: 24, height: 24,
          border: '3px solid rgba(255,255,255,0.2)',
          borderTopColor: '#60a5fa', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', marginBottom: 12,
        }} />
        <div>正在登录 WCA...</div>
      </div>
    </div>
  );
}
