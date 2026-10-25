'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppReleaseRequest, AppReleaseStatus, ReleasePlatform } from '@cuberoot/shared/android-release';
import { tr } from '@/i18n/tr';
import { fetchAppReleaseStatus, publishAppRelease } from '@/lib/app-release-api';

/** Mounted only for administrators; the API independently enforces the same permission. */
export default function ReleaseManager({ onPublished }: { onPublished: () => void }) {
  const [data, setData] = useState<AppReleaseStatus | null>(null);
  const [platform, setPlatform] = useState<ReleasePlatform>('both');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef<AppReleaseRequest | null>(null);
  const sending = useRef(false);
  const published = useRef('');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const status = await fetchAppReleaseStatus(signal);
      if (signal?.aborted) return;
      setData(status); setError('');
      if (pending.current && status.runs.some(run => run.requestId === pending.current?.requestId)) {
        pending.current = null; setUncertain(false);
      }
      const complete = status.runs.filter(r => r.status === 'completed').map(r => `${r.id}:${r.conclusion}`).join();
      if (complete !== published.current) { published.current = complete; onPublished(); }
    } catch {
      if (!signal?.aborted) setError(tr({ zh: '无法读取发布状态，请刷新重试。', en: 'Unable to load release status. Refresh to retry.' }));
    }
  }, [onPublished]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 15_000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);
  const active = data?.pending || data?.runs.some(r => r.status !== 'completed');
  async function publish() {
    if (sending.current || !data?.commit || !notes.trim() || active) return;
    sending.current = true; setBusy(true); setError(''); setNotice('');
    // Retain the same request after an ambiguous client/network failure.
    pending.current ??= { requestId: crypto.randomUUID(), commit: data.commit, platform, notes: notes.trim() };
    try {
      const receipt = await publishAppRelease(pending.current);
      if (receipt.state === 'rejected') {
        pending.current = null;
        setUncertain(false);
        setNotice(tr({ zh: '发布服务拒绝了请求，请检查发布配置。', en: 'The release provider rejected the request. Check its configuration.' }));
      } else {
        setNotice(tr({ zh: '请求已记录，请查看下方发布状态。', en: 'Request recorded. Follow its status below.' }));
        setUncertain(receipt.state === 'unknown');
        if (receipt.state !== 'unknown') pending.current = null;
      }
      await refresh();
    } catch (cause) {
      const rejected = [400, 401, 403, 409, 415, 503].includes((cause as { status?: number }).status ?? 0);
      if (rejected) pending.current = null;
      setUncertain(!rejected);
      await refresh();
      setError(rejected ? tr({ zh: '请求未提交，请核对最新状态后重试。', en: 'Request rejected. Check the latest status before retrying.' })
        : tr({ zh: '请求未确认。请先刷新状态，避免重复发布。', en: 'Request not confirmed. Refresh status before trying again.' }));
    } finally { sending.current = false; setBusy(false); }
  }
  return <section className="download-release-manager" aria-label={tr({ zh: '版本管理', en: 'Release management' })}>
    <div className="download-actions">
      <button type="button" className="download-button" disabled={busy} onClick={() => void refresh()}>{tr({ zh: '刷新状态', en: 'Refresh status' })}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {data && !data.configured && <p>{tr({ zh: '发布服务尚未配置。', en: 'The release service is not configured.' })}</p>}
    {data?.configured && <>
      <p>{tr({ zh: '待发布提交', en: 'Source commit' })}: <code>{data.commit?.slice(0, 12)}</code></p>
      <label>{tr({ zh: '平台', en: 'Platform' })}
        <select className="download-release-platform" value={platform} disabled={busy || uncertain || Boolean(active)} onChange={e => setPlatform(e.target.value as ReleasePlatform)}>
          <option value="both">Android + Windows</option><option value="android">Android</option><option value="windows">Windows</option>
        </select>
      </label>
      <label>{tr({ zh: '更新说明', en: 'Release notes' })}
        <textarea className="download-release-notes" value={notes} maxLength={4000} rows={4} disabled={busy || uncertain || Boolean(active)} onChange={e => setNotes(e.target.value)} />
      </label>
      <p>{tr({ zh: '发布时自动递增版本号。Windows 安装版与免安装版使用同一版本。', en: 'Publishing assigns the next version. Both Windows downloads share that version.' })}</p>
      <button type="button" className="download-button" disabled={busy || Boolean(active) || !notes.trim() || !data.commit} onClick={() => void publish()}>
        {busy ? tr({ zh: '正在提交…', en: 'Submitting…' }) : tr({ zh: '发布新版本', en: 'Publish release' })}
      </button>
      {data.pending && <p role="status">{tr({ zh: '请求已保存，等待构建服务确认。', en: 'Request saved; waiting for the build service.' })} <code>{data.pending.requestId}</code></p>}
      <ul>{data.runs.map(run => <li key={run.id}>
        <a href={run.url} target="_blank" rel="noopener noreferrer">{run.versionName}</a>{' · '}
        {run.status !== 'completed' ? tr({ zh: '等待或发布中', en: 'Queued or publishing' })
          : run.conclusion === 'success' ? tr({ zh: '发布完成', en: 'Published' })
          : tr({ zh: '未全部完成，查看详情', en: 'Incomplete — view details' })}
      </li>)}</ul>
    </>}
  </section>;
}
