'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { ArrowDown, ArrowUp, Copy, Download, Pencil } from 'lucide-react';
import AppLink from '@/components/AppLink';
import SearchInput from '@/components/SearchInput';
import { useT } from '@/hooks/useT';
import { qrAdminRequest, type QrAdminPage, type QrStats, type QrTemplate } from '@/lib/platform-qr-admin';
import { qrCardPublicUrl, qrCodeSvgUrl } from '@/lib/platform-qr-card';
import { QR_PROMPT_DIMENSIONS, QR_PROMPT_PREAMBLE } from '@/lib/platform-qr-prompt';
import { PlatformState } from './PlatformState';
import styles from './PlatformQrAdmin.module.css';
import '@/components/sticky-table.css';

type Mode = 'manage' | 'stats' | 'prompts';
export function PlatformQrAdmin({ mode }: { mode: Mode }) {
  const t = useT();
  return <div className={styles.root}>
    <nav className={styles.actions} aria-label={t('二维码管理功能', 'QR administration')}>
      <AppLink href="/platform/admin/qr" prefetch={false}>{t('二维码列表', 'QR codes')}</AppLink>
      <AppLink href="/platform/admin/qr/cards" prefetch={false}>{t('设计与批量打印', 'Design and print')}</AppLink>
      <AppLink href="/platform/admin/qr/prompts" prefetch={false}>{t('提示词工坊', 'Prompt library')}</AppLink>
      <AppLink href="/platform/admin/qr/stats" prefetch={false}>{t('扫码统计', 'Scan analytics')}</AppLink>
    </nav>
    {mode === 'manage' ? <QrManager /> : mode === 'stats' ? <QrAnalytics /> : <QrPrompts />}
  </div>;
}

function QrManager() {
  const t = useT();
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault(''));
  const [result, setResult] = useState<QrAdminPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setError(''); setResult(null);
    const params = new URLSearchParams({ q: query, page: String(Math.max(1, page)), pageSize: '50', status });
    void qrAdminRequest<QrAdminPage>(`?${params}`, { signal: controller.signal }).then(setResult).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [query, page, status, version]);
  const mutate = async (path: string, method: string, body?: unknown) => {
    setBusy(true); setError(''); setMessage('');
    try { await qrAdminRequest(path, { method, body }); setVersion(v => v + 1); setMessage(t('已保存。', 'Saved.')); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const targetValue = String(data.get('target') || '/').trim();
    await mutate('', 'POST', { count: Number(data.get('count')), prefix: String(data.get('prefix') || 'qr'), label: data.get('label'), type: data.get('type'), targetKind: targetValue.startsWith('/') ? 'internal_path' : 'external_url', targetValue, links: [] });
    void setPage(1);
  };
  return <>
    <form className="platform-domain-form" onSubmit={create} data-site-surface="panel">
      <h2>{t('批量生成二维码', 'Create QR codes')}</h2>
      <div className="platform-form-grid">
        <label>{t('批次标签', 'Batch label')}<input className="platform-field-control" name="label" required maxLength={160} /></label>
        <label>{t('前缀', 'Prefix')}<input className="platform-field-control" name="prefix" defaultValue="qr" pattern="[a-z0-9][a-z0-9_-]{0,47}" /></label>
        <label>{t('数量', 'Quantity')}<input className="platform-field-control" type="number" name="count" min={1} max={500} defaultValue={1} required /></label>
        <label>{t('扫码行为', 'Scan behavior')}<select className="platform-field-control" name="type"><option value="redirect">{t('直接跳转', 'Redirect')}</option><option value="landing">{t('多链接落地页', 'Landing page')}</option></select></label>
        <label>{t('目标路径或网址', 'Destination path or URL')}<input className="platform-field-control" name="target" defaultValue="/" required /></label>
      </div>
      <button className="platform-button platform-button-primary" disabled={busy}>{t('生成', 'Create')}</button>
    </form>
    <div className={styles.actions}>
      <SearchInput value={query} onChange={value => { void setQuery(value); void setPage(1); }} placeholder={t('搜索编码、批次或标题', 'Search code, batch or title')} ariaLabel={t('搜索二维码', 'Search QR codes')} />
      <label>{t('状态', 'Status')} <select value={status} onChange={event => { void setStatus(event.target.value); void setPage(1); }}><option value="">{t('全部', 'All')}</option><option value="active">{t('启用', 'Active')}</option><option value="disabled">{t('停用', 'Disabled')}</option><option value="archived">{t('归档', 'Archived')}</option></select></label>
    </div>
    {error ? <PlatformState kind="error" message={error} onRetry={() => setVersion(v => v + 1)} /> : null}
    {message ? <p role="status">{message}</p> : null}
    {!result && !error ? <PlatformState kind="loading" /> : result ? <>
      <div className="sticky-scroll"><table className={`sticky-thead ${styles.table}`}><thead><tr>
        {[t('编码 / 标题', 'Code / title'), t('批次', 'Batch'), t('目标', 'Destination'), t('扫码', 'Scans'), t('创建时间', 'Created'), t('操作', 'Actions')].map(label => <th key={label}>{label}</th>)}
      </tr></thead><tbody>{result.items.map(row => <tr key={row.id}>
        <td><AppLink href={`/platform/admin/qr/${row.code}`} prefetch={false}>{row.title}<br /><code>{row.code}</code></AppLink><small>{row.status === 'active' ? t('启用', 'Active') : row.status === 'disabled' ? t('停用', 'Disabled') : t('归档', 'Archived')}</small></td>
        <td>{row.label}</td><td>{row.type === 'landing' ? t('多链接落地页', 'Landing page') : row.targetValue}</td><td>{row.scanCount}</td><td>{row.createdAt?.slice(0, 10)}</td>
        <td><div className={styles.actions}>
          <AppLink href={`/platform/admin/qr/cards?codes=${row.code}&edit=${row.code}`} prefetch={false}><Pencil size={16} />{t('设计', 'Design')}</AppLink>
          {row.status !== 'archived' ? <><a href={qrCodeSvgUrl(row.code)} download={`qr-${row.code}.svg`}><Download size={16} />{t('二维码', 'QR')}</a><a href={qrCardPublicUrl(row.code, 'press', 0)}>{t('卡片 SVG', 'Card SVG')}</a></> : null}
          <button type="button" disabled={busy} onClick={() => { void mutate(`/${row.id}/duplicate`, 'POST', {}); }}><Copy size={16} />{t('复制', 'Duplicate')}</button>
          {row.status !== 'archived' ? <><button type="button" disabled={busy} onClick={() => { void mutate(`/${row.id}/disabled`, 'PATCH', { disabled: row.status !== 'disabled' }); }}>{row.status === 'disabled' ? t('启用', 'Enable') : t('停用', 'Disable')}</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(t('归档后不能恢复，印刷卡片将失效。临时关闭请用停用。确认归档？', 'Archiving is permanent and printed cards will stop working. Use Disable for a temporary pause. Archive?'))) void mutate(`/${row.id}`, 'DELETE'); }}>{t('归档', 'Archive')}</button></> : null}
        </div></td>
      </tr>)}</tbody></table></div>
      {!result.items.length ? <PlatformState kind="empty" /> : null}
      <div className={styles.actions}><button type="button" disabled={page <= 1} onClick={() => { void setPage(Math.max(1, page - 1)); }}>{t('上一页', 'Previous')}</button><span>{t(`第 ${page} 页，共 ${result.total} 个`, `Page ${page}, ${result.total} codes`)}</span><button type="button" disabled={page * result.pageSize >= result.total} onClick={() => { void setPage(page + 1); }}>{t('下一页', 'Next')}</button></div>
    </> : null}
  </>;
}

function QrAnalytics() {
  const t = useT(); const [data, setData] = useState<QrStats | null>(null); const [error, setError] = useState(''); const [days, setDays] = useState(30);
  useEffect(() => { const controller = new AbortController(); setError(''); void qrAdminRequest<QrStats>(`/stats?days=${days}`, { signal: controller.signal }).then(setData).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [days]);
  if (error) return <PlatformState kind="error" message={error} />;
  if (!data) return <PlatformState kind="loading" />;
  const max = Math.max(1, ...data.items.map(row => Number(row.scanCount)));
  return <>
    <div className={styles.metrics}>{[[t('二维码', 'QR codes'), data.summary.totalCodes], [t('累计扫码', 'Lifetime scans'), data.summary.totalScans], [t('独立访客标识', 'Unique visitor identifiers'), data.summary.uniqueVisitors]].map(([label, value]) => <section key={label} data-site-surface="panel"><span>{label}</span><strong>{value}</strong></section>)}</div>
    <section data-site-surface="panel"><h2>{t('每日扫码趋势', 'Daily scans')}</h2><label>{t('时间范围', 'Period')} <select value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map(value => <option key={value} value={value}>{t(`${value} 天`, `${value} days`)}</option>)}</select></label>
      <p>{t('按 UTC 日期统计。独立访客按网络与浏览器标识去重，不代表实际人数。每日明细从新统计启用后开始，旧累计数据无法还原到每天。', 'Days use UTC. Visitors are deduplicated network/browser identifiers, not a count of people. Daily records begin with the new collector; earlier lifetime totals cannot be reconstructed by day.')}{data.coverage.dailySince ? ` ${data.coverage.dailySince}` : ''}</p>
      <div className={styles.trend}>{data.items.map(row => <div key={row.day} title={`${row.day}: ${row.scanCount}`}><span style={{ height: `${Number(row.scanCount) / max * 120}px` }} /><small>{row.day.slice(5)}</small><strong>{row.scanCount}</strong></div>)}</div>
      {!data.items.length ? <PlatformState kind="empty" /> : null}
    </section>
    <section><h2>{t('按批次', 'By batch')}</h2><div className="sticky-scroll"><table className={`sticky-thead ${styles.table}`}><thead><tr>{[t('批次', 'Batch'), t('码数', 'Codes'), t('扫码', 'Scans'), t('独立访客', 'Visitors')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.byBatch.map(row => <tr key={row.label}><td>{row.label || '—'}</td><td>{row.codes}</td><td>{row.scanCount}</td><td>{row.uniqueVisitors}</td></tr>)}</tbody></table></div></section>
    <section><h2>{t('每码明细', 'By code')}</h2><div className="sticky-scroll"><table className={`sticky-thead ${styles.table}`}><thead><tr>{[t('编码', 'Code'), t('批次', 'Batch'), t('扫码', 'Scans'), t('独立访客', 'Visitors'), t('最后扫码', 'Last scan')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.byCode.map(row => <tr key={row.id}><td><AppLink href={`/platform/admin/qr/${row.code}`} prefetch={false}>{row.code}</AppLink></td><td>{row.label}</td><td>{row.scanCount}</td><td>{row.uniqueVisitors}</td><td>{row.lastScanAt?.replace('T', ' ').slice(0, 19) || '—'}</td></tr>)}</tbody></table></div></section>
  </>;
}

function QrPromptForm({ item, busy, save }: { item?: QrTemplate; busy: boolean; save: (item: QrTemplate | undefined, data: Record<string, unknown>) => Promise<void> }) {
  const t = useT();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const dimension = String(data.get('dimension') || '');
    await save(item, { nameZh: data.get('nameZh'), nameEn: data.get('nameEn'), template: { body: data.get('body'), ...(dimension ? { dimension } : { category: data.get('category') }) }, ...(item ? {} : { templateKey: `prompt-${crypto.randomUUID()}` }) });
  };
  return <form className="platform-domain-form" onSubmit={submit}>
    <div className="platform-form-grid">
      <label>{t('中文名称', 'Chinese name')}<input className="platform-field-control" name="nameZh" defaultValue={item?.nameZh} required maxLength={160} /></label>
      <label>{t('英文名称（可选）', 'English name (optional)')}<input className="platform-field-control" name="nameEn" defaultValue={item?.nameEn} maxLength={160} /></label>
      <label>{t('用途 / 维度', 'Kind / dimension')}<select className="platform-field-control" name="dimension" defaultValue={item?.template.dimension || ''}><option value="">{t('整套模板', 'Complete preset')}</option>{QR_PROMPT_DIMENSIONS.map(d => <option key={d.key} value={d.key}>{t(d.zh, d.en)}</option>)}</select></label>
      <label>{t('分组（整套模板）', 'Category (presets)')}<input className="platform-field-control" name="category" defaultValue={item?.template.category} /></label>
    </div>
    <label>{t('画面描述', 'Image description')}<textarea className="platform-field-control platform-field-textarea" name="body" rows={5} defaultValue={item?.template.body} required maxLength={3600} /></label>
    <button className="platform-button" disabled={busy}>{item ? t('保存修改', 'Save changes') : t('添加提示词', 'Add prompt')}</button>
  </form>;
}

function QrPrompts() {
  const t = useT(); const [items, setItems] = useState<QrTemplate[]>([]); const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [version, setVersion] = useState(0);
  useEffect(() => { const controller = new AbortController(); void qrAdminRequest<{ items: QrTemplate[] }>('/prompts?includeArchived=true', { signal: controller.signal }).then(data => { setItems(data.items); setLoaded(true); }).catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [version]);
  const mutate = async (path: string, method: string, body?: unknown) => { setBusy(true); setError(''); try { await qrAdminRequest(path, { method, body }); setVersion(v => v + 1); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const groups = [{ key: '', label: t('整套模板', 'Complete presets') }, ...QR_PROMPT_DIMENSIONS.map(d => ({ key: d.key, label: t(d.zh, d.en) }))];
  const move = async (group: QrTemplate[], index: number, delta: number) => {
    const active = items.filter(item => item.status !== 'archived'); const first = active.findIndex(item => item.id === group[index].id); const second = active.findIndex(item => item.id === group[index + delta].id);
    [active[first], active[second]] = [active[second], active[first]];
    await mutate('/prompts/reorder', 'POST', { items: active.map((item, sortOrder) => ({ id: item.id, sortOrder })) });
  };
  const archived = items.filter(item => item.status === 'archived');
  return <>
    <details><summary>{t('每条提示词自动加入的通用要求', 'Shared prompt requirements')}</summary><pre className={styles.preamble}>{QR_PROMPT_PREAMBLE}</pre></details>
    <section data-site-surface="panel"><h2>{t('新增模板或积木', 'Add a preset or building block')}</h2><QrPromptForm busy={busy} save={(_, body) => mutate('/prompts', 'POST', body)} /></section>
    {error ? <PlatformState kind="error" message={error} onRetry={() => setVersion(v => v + 1)} /> : null}
    {!loaded && !error ? <PlatformState kind="loading" /> : null}
    {groups.map(group => { const rows = items.filter(item => item.status !== 'archived' && (item.template.dimension || '') === group.key); return <section key={group.key} data-site-surface="panel"><h2>{group.label}</h2>{!rows.length ? <p>{t('暂无提示词。', 'No prompts yet.')}</p> : rows.map((item, index) => <article className={styles.prompt} key={item.id}><div className={styles.actions}><strong>{t(item.nameZh || item.nameEn, item.nameEn || item.nameZh)}</strong><span>{item.template.category}</span><button type="button" disabled={busy || index === 0} aria-label={t('上移', 'Move up')} onClick={() => { void move(rows, index, -1); }}><ArrowUp size={16} /></button><button type="button" disabled={busy || index === rows.length - 1} aria-label={t('下移', 'Move down')} onClick={() => { void move(rows, index, 1); }}><ArrowDown size={16} /></button><button type="button" disabled={busy} onClick={() => { void mutate(`/prompts/${item.id}`, 'DELETE'); }}>{t('移到回收站', 'Move to trash')}</button></div><p>{item.template.body}</p><details><summary>{t('编辑', 'Edit')}</summary><QrPromptForm item={item} busy={busy} save={(row, body) => mutate(`/prompts/${row!.id}`, 'PATCH', body)} /></details></article>)}</section>; })}
    <section data-site-surface="panel"><h2>{t('回收站', 'Trash')}</h2>{!archived.length ? <p>{t('回收站为空。', 'Trash is empty.')}</p> : archived.map(item => <article className={styles.prompt} key={item.id}><strong>{t(item.nameZh || item.nameEn, item.nameEn || item.nameZh)}</strong><div className={styles.actions}><button type="button" disabled={busy} onClick={() => { void mutate(`/prompts/${item.id}/restore`, 'POST', {}); }}>{t('恢复', 'Restore')}</button><button type="button" disabled={busy} onClick={() => { if (window.confirm(t('永久删除这条提示词？', 'Permanently delete this prompt?'))) void mutate(`/prompts/${item.id}/purge`, 'DELETE'); }}>{t('永久删除', 'Delete permanently')}</button></div></article>)}</section>
  </>;
}
