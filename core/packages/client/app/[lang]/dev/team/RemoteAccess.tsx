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
  const requestGroups = Object.groupBy(data?.requests ?? [], r => JSON.stringify([r.user_id, r.device]));
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
    `帮我一次完成 CubeRoot 远程连接。此任务已授权检查本机、整理指定密钥、配置该 SSH 别名、核验并保存匹配的主机公钥、验证连接和添加 App 项目；不要逐步问是否继续。先读已有对话与配置，复用已完成步骤；本人已经确认该申请“已生效”时不重复询问。只在缺少必要文件、指纹不符、实际权限不足、本人登录或无法自行判断的配置冲突时一次列出具体阻塞。我已在入门页申请，私钥文件 ${filename} 已下载到这台电脑。先确认下载成功，把该文件安全移入本机 ~/.ssh，设置仅本人可读的权限（Windows 用当前用户 ACL），保留其他密钥和配置；不上传、打印或发送私钥。入门页固定为 https://cuberoot.me/zh/admin/team?section=onboarding，不要向我询问网址，也不要使用 localhost 或负责人电脑的本地地址。配置完成后，用可用的浏览器工具打开这个网址，由我使用申请时的账号登录；在“远程连接”中核对这台设备的申请状态，不代替负责人审批。显示“等待批准”时，告诉我请负责人在同一网址找到我的申请并点“批准”；显示“已批准，等待 Mac 生效”时刷新等待同步，不能当作已生效；被拒绝或撤销时停止并说明状态，不重复申请。显示“已生效，可以连接”后继续完成下面的连接验证，不停在“等待确认”。若无法操作浏览器，直接给出上述网址并只请我反馈这台设备的状态，不能猜测或声称已经批准。新增独立 SSH 别名 cuberoot-remote，主机 ${REMOTE_CONNECTION.host}、端口 ${REMOTE_CONNECTION.port}、用户 ${REMOTE_CONNECTION.user}，IdentityFile 使用这把密钥，IdentitiesOnly yes。首次连接先用 ssh-keyscan -p ${REMOTE_CONNECTION.port} -t ed25519 ${REMOTE_CONNECTION.host} 获取候选主机公钥，用 ssh-keygen -lf 候选文件 -E sha256 计算指纹，必须与 ${REMOTE_CONNECTION.fingerprint} 完全一致；扫描结果本身不是可信依据。不符就停止，不跳过验证。完全匹配后直接将对应 [${REMOTE_CONNECTION.host}]:${REMOTE_CONNECTION.port} 条目追加到当前 SSH 客户端实际使用的 known_hosts，保留其他条目；已有一致条目则复用，已有冲突条目则停止，不删除或覆盖。保持 StrictHostKeyChecking yes。首次缺少 known_hosts 条目是本任务需要完成的正常步骤，不再请求确认。Windows 核对终端和 App 使用的 SSH 程序、用户目录和配置文件一致，不把 Git SSH 与系统 OpenSSH 的配置混用。验证 SSH 和目录 ${REMOTE_CONNECTION.project} 可读、远端登录 shell 可运行 codex；再在 App 设置→连接→SSH 添加该别名并打开项目。目录已存在，不创建空目录。已有同名别名时先核对，不覆盖。远程权限为 eula 账号权限。SSH 使用 BatchMode 和连接超时，分别验证登录身份、目录、codex 与 App 实际打开项目；若仅 App 失败，检查所选连接和其使用的 SSH 配置，不重新生成密钥、不重新申请、不创建空项目。缺少 App 操作工具时明确只剩哪一步手动操作，不能把 SSH 成功当作 App 已连接。完成一个步骤后直接继续下一步，最后只报告已验证结果和真正未完成项，不推送或部署。`,
    `Complete CubeRoot remote access in one pass. This task authorizes local inspection, handling the specified key, configuring the SSH alias, verifying and saving a matching host key, testing the connection and adding the app project. Do not ask for confirmation at each step. Reuse completed work and prior context; do not ask again if I already confirmed this request is active. Ask only for missing files, a fingerprint mismatch, unavailable permissions, personal sign-in or a configuration conflict you cannot resolve; batch concrete blockers. I applied on the onboarding page and downloaded ${filename} on this computer. Confirm the download exists; move it securely into ~/.ssh with owner-only access (current-user ACL on Windows). Preserve other keys/configuration; never print, upload or send the private key. The onboarding URL is https://cuberoot.me/zh/admin/team?section=onboarding. Do not ask me for it or use localhost. After local setup, open that URL with available browser tools and let me sign in with the account used for the request. Check this device under Remote access; never approve on behalf of the lead. If awaiting approval, tell me to ask the lead to approve my request at the same URL. If approved but waiting for the Mac, refresh and wait for host synchronization; this is not active access yet. Stop if declined or revoked, without submitting another request. Once Ready to connect appears, continue with the connection checks below instead of asking for another confirmation. If browser tools are unavailable, give me the URL and ask only for this device’s displayed status. Never infer or fabricate approval. Add a separate cuberoot-remote SSH alias: host ${REMOTE_CONNECTION.host}, port ${REMOTE_CONNECTION.port}, user ${REMOTE_CONNECTION.user}, IdentityFile this key, IdentitiesOnly yes. For first-time setup, obtain the candidate host key using ssh-keyscan -p ${REMOTE_CONNECTION.port} -t ed25519 ${REMOTE_CONNECTION.host}, then compute its SHA256 fingerprint with ssh-keygen -lf on the candidate file and -E sha256. It must exactly match ${REMOTE_CONNECTION.fingerprint}; scanning alone is not a trust source. Stop on mismatch. Once matched, append the [${REMOTE_CONNECTION.host}]:${REMOTE_CONNECTION.port} entry to the known_hosts used by the actual SSH client, preserving other entries. Reuse an identical entry; stop on an existing conflict without deleting or overwriting it. Keep StrictHostKeyChecking yes. A missing first-use known_hosts entry is an expected setup step and requires no additional confirmation. On Windows, check that the terminal and app use the same SSH executable, user directory and configuration; do not mix Git SSH and Windows OpenSSH configurations. Verify SSH, read access to ${REMOTE_CONNECTION.project}, and codex in the remote login shell. Add the alias in the app’s Settings → Connections → SSH and open the project. Do not create an empty directory. Check any existing alias before changing it. Remote access uses eula’s account permissions. Use BatchMode and a connection timeout. Verify identity, directory access, codex and the app actually opening the project separately. If only the app fails, inspect its selected connection and SSH configuration; do not regenerate keys, reapply or create an empty project. If app automation is unavailable, name the remaining manual step; SSH success does not prove the app connected. Continue between steps without asking again. Finish with verified results and actual remaining work only; do not push or deploy.`);
  return <section className="staff-start-development">
    <h3>{t('远程连接', 'Remote access')}</h3>
    {!uid ? <p>{t('请先在右侧注册或登录。', 'Register or sign in in the other card first.')}</p> : <>
      {failed && <p role="alert">{t('暂时无法完成，请稍后重试；浏览器需支持 Ed25519。', 'Unable to complete. Retry later; your browser must support Ed25519.')}</p>}
      {data && !data.enabled && <p>{t('负责人尚未启用远程申请。', 'The host owner has not enabled enrollment yet.')}</p>}
      {data?.enabled && <>
        <button type="button" className="staff-start-action" disabled={busy} onClick={() => void request()}>{t('申请连接', 'Apply')}</button>
        {!data.hostOnline && <p>{t('Mac 暂未同步，批准后需等待生效。', 'The Mac is not syncing. Approved requests will wait.')}</p>}
      </>}
      {bundle && <>
        <p>{t('密钥文件仅保存在本机，别发给其他人。', 'Keep the key file on this computer; do not send it to others.')}</p>
        <button type="button" className="staff-start-inline-action" onClick={() => download(bundle)}>{t('重新下载密钥', 'Download key again')}</button>{' '}
        <button type="button" className="staff-start-action" onClick={() => copy(setupFor(bundle.filename), 'remote-setup')}>{copiedKey === 'remote-setup' ? t('已复制', 'Copied') : t('复制给 AI 配置', 'Copy setup for AI')}</button>
      </>}
      <ul className="staff-start-steps">{Object.entries(requestGroups).map(([key, requests]) => requests && <li key={key}>
        <details>
          <summary><span className="staff-start-device-label"><strong>{requests[0].user_name}</strong><span className="staff-start-device-detail">ID {requests[0].user_id}</span><span>{requests[0].device}</span></span></summary>
          <ul className="staff-start-steps">{requests.map(r => <li key={r.id}>
        <p>{r.status === 'revoked' && !r.removed_at ? t('已申请撤销，等待 Mac 移除密钥', 'Revocation requested; waiting for the Mac') : labels[r.status]}</p>
        {Number(r.user_id) === uid && ['pending', 'approved', 'active'].includes(r.status) && <p><button type="button" className="staff-start-inline-action" onClick={() => copy(setupFor(remoteKeyFilename(r.public_key)), r.id)}>{copiedKey === r.id ? t('已复制', 'Copied') : t('复制给 AI 配置', 'Copy setup for AI')}</button></p>}
        {data?.canApprove && <>
          {r.status === 'pending' && <><button type="button" className="staff-start-action" disabled={busy} onClick={() => void decide(r.id, 'approved')}>{t('批准', 'Approve')}</button>{' '}<button type="button" className="staff-start-action" disabled={busy} onClick={() => void decide(r.id, 'rejected')}>{t('拒绝', 'Decline')}</button></>}
          {['approved', 'active'].includes(r.status) && <button type="button" className="staff-start-inline-action" disabled={busy} onClick={() => void decide(r.id, 'revoked')}>{t('撤销新连接权限', 'Revoke new connections')}</button>}
        </>}
      </li>)}</ul>
        </details>
      </li>)}</ul>
    </>}
  </section>;
}
