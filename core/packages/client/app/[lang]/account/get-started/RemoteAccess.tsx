'use client';

import { useEffect, useState } from 'react';
import { REMOTE_CONNECTION, remoteKeyFilename, type RemoteAccessList, type RemoteAccessStatus } from '@cuberoot/shared/remote-access';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import { useAuthUser } from '@/lib/auth-store';
import { useT } from '@/hooks/useT';
import { useCopy } from '@/hooks/useCopy';
import { createRemoteAccessKey } from '@/lib/remote-access-key';

async function loadRequests(): Promise<RemoteAccessList> {
  const result = await sessionFetch(apiUrl('/v1/remote-access/requests'), { headers: authHeaders(false), cache: 'no-store' });
  // Local-only frontend work may precede the separately authorized API release.
  if (result.status === 404) return { enabled: false, canApprove: false, hostOnline: false, requests: [] };
  return handleApi<RemoteAccessList>(result);
}

export default function RemoteAccess() {
  const t = useT(), user = useAuthUser();
  const [data, setData] = useState<RemoteAccessList | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof createRemoteAccessKey>> | null>(null);
  const { copy, copiedKey } = useCopy();
  const uid = user?.uid;
  const refresh = async () => {
    setData(await loadRequests());
  };
  useEffect(() => {
    setData(null); setBundle(null); setFailed(false);
    if (!uid) return;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await loadRequests();
        if (!cancelled) { setData(next); setFailed(false); }
      } catch { if (!cancelled) setFailed(true); }
    };
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [uid]);
  const download = (key: NonNullable<typeof bundle>) => {
    const url = URL.createObjectURL(new Blob([key.privateKey], { type: 'application/octet-stream' }));
    const a = document.createElement('a'); a.href = url; a.download = key.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const request = async () => {
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      const key = bundle ?? await createRemoteAccessKey();
      setBundle(key);
      download(key);
      const device = /Windows/.test(navigator.userAgent) ? 'Windows' : /Macintosh/.test(navigator.userAgent) ? 'Mac' : 'Computer';
      await handleApi(await sessionFetch(apiUrl('/v1/remote-access/requests'), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ publicKey: key.publicKey, device }),
      }));
      await refresh();
    } catch { setFailed(true); } finally { setBusy(false); }
  };
  const decide = async (id: string, decision: 'approved' | 'rejected' | 'revoked') => {
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      await handleApi(await sessionFetch(apiUrl(`/v1/remote-access/requests/${id}/decision`), {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ decision }),
      }));
      await refresh();
    } catch { setFailed(true); } finally { setBusy(false); }
  };
  const labels: Record<RemoteAccessStatus, string> = {
    pending: t('等待批准', 'Awaiting approval'), approved: t('已批准，等待 Mac 生效', 'Approved; waiting for the Mac'),
    active: t('已生效，可以连接', 'Ready to connect'), rejected: t('未批准', 'Declined'), revoked: t('密钥已移除', 'Key removed'),
  };
  const setupFor = (filename: string) => t(
    `帮我配置 CubeRoot 远程连接。我已在入门页申请，私钥文件 ${filename} 已下载到这台电脑。先确认下载成功，把该文件安全移入本机 ~/.ssh，设置仅本人可读的权限（Windows 用当前用户 ACL），保留其他密钥和配置；不上传、打印或发送私钥。等待入门页显示“已生效”再连接。新增独立 SSH 别名 cuberoot-remote，主机 ${REMOTE_CONNECTION.host}、端口 ${REMOTE_CONNECTION.port}、用户 ${REMOTE_CONNECTION.user}，IdentityFile 使用这把密钥，IdentitiesOnly yes。先核验主机 Ed25519 指纹 ${REMOTE_CONNECTION.fingerprint}，不符就停止，不跳过验证。验证 SSH 和目录 ${REMOTE_CONNECTION.project} 可读、远端登录 shell 可运行 codex；再在 App 设置→连接→SSH 添加该别名并打开项目。目录已存在，不创建空目录。已有同名别名时先核对，不覆盖。远程权限为 eula 账号权限。最后报告真实验证结果，不推送或部署。`,
    `Configure CubeRoot remote access. I applied on the onboarding page and downloaded ${filename} on this computer. Confirm the download exists; move it securely into ~/.ssh with owner-only access (current-user ACL on Windows). Preserve other keys/configuration; never print, upload or send the private key. Wait for “Ready to connect” on the page. Add a separate cuberoot-remote SSH alias: host ${REMOTE_CONNECTION.host}, port ${REMOTE_CONNECTION.port}, user ${REMOTE_CONNECTION.user}, IdentityFile this key, IdentitiesOnly yes. Verify the Ed25519 host fingerprint ${REMOTE_CONNECTION.fingerprint}; stop on mismatch, never bypass verification. Verify SSH, read access to ${REMOTE_CONNECTION.project}, and codex in the remote login shell. Add the alias in the app’s Settings → Connections → SSH and open the project. Do not create an empty directory. Check any existing alias before changing it. Remote access uses eula’s account permissions. Report verified results only; do not push or deploy.`);
  return <section className="staff-start-development">
    <h3>{t('申请远程连接', 'Request remote access')}</h3>
    <p>{t('点击申请会下载本机专用密钥。负责人批准后，把配置指令交给 AI 完成连接。', 'Apply to download a key for this computer. After approval, give the setup instructions to AI.')}</p>
    {!uid ? <p>{t('请先在右侧注册或登录。', 'Register or sign in in the other card first.')}</p> : <>
      {failed && <p role="alert">{t('暂时无法完成，请稍后重试；浏览器需支持 Ed25519。', 'Unable to complete. Retry later; your browser must support Ed25519.')}</p>}
      {data && !data.enabled && <p>{t('负责人尚未启用远程申请。', 'The host owner has not enabled enrollment yet.')}</p>}
      {data?.enabled && <>
        <button type="button" className="staff-start-action" disabled={busy} onClick={() => void request()}>{t('申请连接', 'Apply')}</button>
        {!data.hostOnline && <p>{t('Mac 暂未同步，批准后需等待生效。', 'The Mac is not syncing. Approved requests will wait.')}</p>}
      </>}
      {bundle && <>
        <p>{t('密钥文件仅保存在本机，别发给其他人。', 'Keep the key file on this computer; do not send it to others.')}</p>
        <button type="button" onClick={() => download(bundle)}>{t('重新下载密钥', 'Download key again')}</button>{' '}
        <button type="button" className="staff-start-action" onClick={() => copy(setupFor(bundle.filename), 'remote-setup')}>{copiedKey === 'remote-setup' ? t('已复制', 'Copied') : t('复制给 AI 配置', 'Copy setup for AI')}</button>
      </>}
      {data?.canApprove && <p>{t('批准将授予这台 Mac 的 eula 账号访问权，仅批准认识的同事。', 'Approval grants access as eula on this Mac. Approve only colleagues you recognize.')}</p>}
      <ul className="staff-start-steps">{data?.requests.map(r => <li key={r.id}>
        <strong>{r.user_name} · ID {r.user_id} · {r.device}</strong>
        <p>{r.status === 'revoked' && !r.removed_at ? t('已申请撤销，等待 Mac 移除密钥', 'Revocation requested; waiting for the Mac') : labels[r.status]}</p>
        <small>{r.created_at.slice(0, 19).replace('T', ' ')} UTC</small>
        {Number(r.user_id) === uid && ['pending', 'approved', 'active'].includes(r.status) && <p><button type="button" onClick={() => copy(setupFor(remoteKeyFilename(r.public_key)), r.id)}>{copiedKey === r.id ? t('已复制', 'Copied') : t('复制给 AI 配置', 'Copy setup for AI')}</button></p>}
        {data.canApprove && <>
          <details><summary>{t('设备指纹', 'Device fingerprint')}</summary><code>{r.fingerprint}</code></details>
          {r.status === 'pending' && <><button type="button" className="staff-start-action" disabled={busy} onClick={() => void decide(r.id, 'approved')}>{t('批准', 'Approve')}</button>{' '}<button type="button" disabled={busy} onClick={() => void decide(r.id, 'rejected')}>{t('拒绝', 'Decline')}</button></>}
          {['approved', 'active'].includes(r.status) && <button type="button" disabled={busy} onClick={() => void decide(r.id, 'revoked')}>{t('撤销新连接权限', 'Revoke new connections')}</button>}
        </>}
      </li>)}</ul>
    </>}
  </section>;
}
