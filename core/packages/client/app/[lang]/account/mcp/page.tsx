'use client';

import { useEffect, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { hasAdminAccess, useAuthUser } from '@/lib/auth-store';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import './mcp.css';

interface Connection { id: string; created_at: string; expires_at: string }
export default function McpAccountPage() {
  const t = useT();
  const user = useAuthUser();
  const admin = hasAdminAccess(user);
  const [clientId] = useQueryState('client_id', parseAsString);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [loginNext, setLoginNext] = useState('/account/mcp');
  useEffect(() => {
    setReady(true);
    setLoginNext(window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    if (!admin) return;
    let active = true;
    fetch(apiUrl('/v1/mcp/oauth/connections'), { headers: authHeaders(false) })
      .then(handleApi<{ connections: Connection[] }>).then(data => { if (active) setConnections(data.connections); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [admin]);
  async function consent(approve: boolean) {
    setBusy(true); setError(false);
    try {
      const params = Object.fromEntries(new URLSearchParams(window.location.search));
      const result = await handleApi<{ redirect: string }>(await fetch(apiUrl('/v1/mcp/oauth/consent'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...params, approve }),
      }));
      // OAuth handoff follows a successfully submitted consent; not an internal navigation control.
      const target = new URL(result.redirect);
      if (target.origin !== 'https://chatgpt.com') throw new Error('Invalid handoff');
      window.location.assign(target.toString());
    } catch { setError(true); setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(false);
    try {
      await handleApi(await fetch(apiUrl('/v1/mcp/oauth/connections/revoke'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ id }),
      }));
      setConnections(items => items.filter(item => item.id !== id));
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <main className="mcp-account">
    <h1>{t('ChatGPT 只读连接', 'ChatGPT read-only connection')}</h1>
    <p>{t('允许 ChatGPT 读取账号增长、会员数量、数据库状态和数值诊断记录，用于分析 CubeRoot。仅管理员可以授权。', 'Allow ChatGPT to read registration trends, membership counts, database activity and numeric diagnostics to analyze CubeRoot. Only administrators may authorize access.')}</p>
    <p>{t('不开放个人资料、密码、支付明细或写入操作。每次调用检查管理员权限；连接最多保留 30 天，可随时撤销。', 'No personal profiles, passwords, payment records or write operations are exposed. Administrator access is checked on every call. Connections last up to 30 days and can be revoked at any time.')}</p>
    {!ready ? <p>{t('加载中…', 'Loading…')}</p> : !user ?
      <AppLink href={`/account?next=${encodeURIComponent(loginNext)}`} prefetch={false}>{t('登录 CubeRoot', 'Sign in to CubeRoot')}</AppLink> : !admin ?
        <p>{t('仅限管理员使用。', 'Administrators only.')}</p> : <>
          {clientId ? <div className="mcp-actions">
            <button className="mcp-action" disabled={busy} onClick={() => void consent(true)}>{t('授权 ChatGPT', 'Authorize ChatGPT')}</button>
            <button className="mcp-action" disabled={busy} onClick={() => void consent(false)}>{t('拒绝', 'Decline')}</button>
          </div> : <p>{t('在 ChatGPT 的应用设置中添加 MCP 地址，并选择 OAuth：', 'Add this MCP URL in ChatGPT app settings and choose OAuth:')}<br /><code>https://api.cuberoot.me/v1/mcp</code></p>}
          <h2>{t('我的连接', 'My connections')}</h2>
          {!connections.length && <p>{t('暂无有效连接。', 'No active connections.')}</p>}
          {connections.map(item => <div className="mcp-connection" key={item.id}>
            <span>ChatGPT<br />{t('到期：', 'Expires: ')}{item.expires_at.slice(0, 10)} UTC</span>
            <button className="mcp-action" disabled={busy} onClick={() => void revoke(item.id)}>{t('撤销连接', 'Revoke connection')}</button>
          </div>)}
        </>}
    {error && <p role="alert">{t('操作未完成。请刷新后重试；连接已满时，先撤销旧连接。', 'The operation could not be completed. Refresh and retry; revoke an old connection if the limit is reached.')}</p>}
  </main>;
}
