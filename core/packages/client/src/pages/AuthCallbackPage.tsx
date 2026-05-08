/**
 * WCA OAuth 回调页——处理 Implicit Grant 返回的 access_token
 * NOTE: 从 URL hash 解析 token → 验证 state → 调用 /me → 存 localStorage → 跳回来源页
 * 替代根目录 callback.html，使 React 应用在所有环境下自包含处理 OAuth 回调
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { apiUrl } from '../utils/api_base';

const ME_URL = 'https://www.worldcubeassociation.org/api/v0/me';

// NOTE: 模块级守卫——React StrictMode 在开发模式下会让 useEffect 跑两次，
// 一次性的 OAuth state 会被第一次消费掉，第二次就误报"state mismatch"。
let callbackProcessed = false;

export default function AuthCallbackPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (callbackProcessed) return;
    callbackProcessed = true;
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
      setErrorMsg(isZh ? `授权被拒绝: ${error}` : `Authorization denied: ${error}`);
      return;
    }

    if (!accessToken) {
      setErrorMsg(isZh ? '未获取到 access_token' : 'No access_token received');
      return;
    }

    // NOTE: 验证 state 防 CSRF
    const savedState = sessionStorage.getItem('wca_oauth_state');
    if (!savedState || savedState !== state) {
      setErrorMsg(isZh ? 'OAuth state 不匹配，请重试' : 'OAuth state mismatch, please retry');
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

      // NOTE: 用 WCA access_token 换取长效 JWT（365 天有效期）
      // WCA token 2 小时过期，JWT 可以长期使用
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
        // NOTE: JWT 换取失败不阻塞登录流程，回退到 WCA token（2 小时有效）
      }

      // NOTE: 跳回登录前的页面，无记录时 fallback 到 /recon
      const returnUrl = sessionStorage.getItem('wca_return_url') || '/recon';
      sessionStorage.removeItem('wca_return_url');
      window.location.href = returnUrl;
    } catch (err) {
      setErrorMsg(isZh ? `登录失败: ${(err as Error).message}` : `Login failed: ${(err as Error).message}`);
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
          <div style={{ color: '#f87171', fontSize: '1.1rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}><X size={18} /> {errorMsg}</div>
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
        <div>{isZh ? '正在登录 WCA...' : 'Signing in to WCA...'}</div>
      </div>
    </div>
  );
}
