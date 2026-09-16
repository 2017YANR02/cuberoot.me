'use client';

import { useEffect, useRef, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { ChevronRight, Folder, RefreshCw } from 'lucide-react';
import AppLink from '@/components/AppLink';
import StackedBar from '@/components/StackedBar/StackedBar';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/lib/auth-store';
import { fetchDiskReport, type DiskReport } from '@/lib/disk-api';
import '../admin.css';
import './disk.css';

const gib = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
const percent = (bytes: number, total: number) => total > 0 ? `${(100 * bytes / total).toFixed(1)}%` : '0%';

export default function AdminDiskPage() {
  const t = useT();
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  const [path] = useQueryState('path', parseAsString.withDefault('/'));
  const [report, setReport] = useState<DiskReport | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const forceRefresh = useRef(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !isAdmin) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setReport(null);
    setError(false);
    setLoading(true);
    const poll = async (force: boolean) => {
      const request = new AbortController();
      const cancel = () => request.abort();
      controller.signal.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, 12_000);
      try {
        const next = await fetchDiskReport(path, force, request.signal);
        if (controller.signal.aborted) return;
        setReport(next);
        setError(false);
        if (next.scanning || next.busy) timer = setTimeout(() => void poll(force && next.busy), 2500);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', cancel);
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    const force = forceRefresh.current;
    forceRefresh.current = false;
    void poll(force);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [mounted, isAdmin, path, refresh]);

  if (!mounted) return <main className="admin-hub" />;
  if (!isAdmin) return <main className="admin-hub"><h1>{t('磁盘空间', 'Disk space')}</h1>
    <p className="admin-hub__status">{t('只有管理员可以查看服务器磁盘。', 'Only administrators can view server disk usage.')}</p>
    <AppLink href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink></main>;

  const capacity = report?.capacity;
  const scan = report?.snapshot?.path === path ? report.snapshot : null;
  const running = loading || !!report?.scanning || !!report?.busy;
  const crumbs = path.split('/').filter(Boolean);
  const href = (directory: string) => `/admin/disk?path=${encodeURIComponent(directory)}`;
  const usage = capacity ? percent(capacity.usedBytes, capacity.totalBytes) : '';

  return <main className="admin-hub disk-page">
    <header className="admin-hub__heading">
      <p className="admin-hub__eyebrow">{t('管理', 'Administration')}</p>
      <h1>{t('磁盘空间', 'Disk space')}</h1>
      <p>{t('查看服务器总容量和目录占用，点击目录逐层查看。', 'Explore server capacity and disk usage by directory.')}</p>
    </header>

    {capacity && <section aria-label={t('磁盘总览', 'Disk overview')} className="disk-overview">
      <dl className="disk-totals">
        {[[t('总容量', 'Total'), capacity.totalBytes], [t('已使用', 'Used'), capacity.usedBytes],
          [t('可用空间', 'Available'), capacity.availableBytes], [t('系统预留', 'Reserved'), capacity.reservedBytes]].map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{gib(Number(value))}</dd></div>)}
      </dl>
      <StackedBar ariaLabel={`${t('已使用', 'Used')} ${usage}`} segments={[
        { key: 'used', weight: capacity.usedBytes, color: 'var(--accent)', label: usage },
        { key: 'reserved', weight: capacity.reservedBytes, color: 'var(--muted-foreground)' },
        { key: 'free', weight: capacity.availableBytes, color: 'var(--border-default)' },
      ]} />
      {capacity.availableBytes / capacity.totalBytes < .1 && <p className="disk-warning">{t('可用空间不足 10%，需要安排扩容或检查大目录。', 'Less than 10% is available. Plan more capacity or review large directories.')}</p>}
    </section>}

    <div className="disk-toolbar">
      <nav aria-label={t('目录路径', 'Directory path')} className="disk-breadcrumbs">
        <AppLink href={href('/')} prefetch={false}>/</AppLink>
        {crumbs.map((part, index) => <span key={index}><ChevronRight size={14} aria-hidden />
          <AppLink href={href(`/${crumbs.slice(0, index + 1).join('/')}`)} prefetch={false}>{part}</AppLink></span>)}
      </nav>
      <button type="button" className="disk-refresh" disabled={running} onClick={() => { forceRefresh.current = true; setRefresh(value => value + 1); }}>
        <RefreshCw size={15} aria-hidden />{t('刷新', 'Refresh')}
      </button>
    </div>

    <div className="disk-status" role="status" aria-live="polite">
      {running && <p>{report?.busy ? t('另一个目录正在扫描，请稍候…', 'Another directory is being scanned. Please wait…') : t('正在扫描目录…', 'Scanning directory…')}</p>}
      {(error || report?.error) && <p className="disk-warning">{t('无法完成读取。请确认目录存在及管理员登录有效，然后重试。', 'Could not finish reading. Check the directory and administrator session, then retry.')}</p>}
      {scan && <p>{t('扫描时间', 'Scanned at')}: <time dateTime={scan.scannedAt}>{new Date(scan.scannedAt).toLocaleString()}</time>
        {' / '}{t('当前目录', 'This directory')}: {gib(scan.bytes)}</p>}
      {scan?.partial && <p className="disk-warning">{t('已达到扫描限制，或部分目录无法读取。当前统计不完整，可以进入具体目录再查看。', 'The scan reached its limit or could not read some directories. Totals are incomplete; open a specific directory to explore further.')}</p>}
    </div>

    {scan && <section aria-label={t('目录占用', 'Directory usage')}>
      <div className="disk-list-heading"><span>{t('目录', 'Directory')}</span><span>{t('大小 / 占当前目录', 'Size / share of directory')}</span></div>
      <ul className="disk-directory-list">
        {scan.children.map(child => <li key={child.path}>
          <AppLink href={href(child.path)} prefetch={false} className="disk-directory">
            <span className="disk-directory-name"><Folder size={17} aria-hidden /><span>{child.path.slice(child.path.lastIndexOf('/') + 1)}</span><ChevronRight size={14} aria-hidden /></span>
            <span className="disk-directory-size">{gib(child.bytes)} <small>{percent(child.bytes, scan.bytes)}</small></span>
            <span className="disk-directory-track" aria-hidden><span style={{ width: percent(Math.min(child.bytes, scan.bytes), scan.bytes) }} /></span>
          </AppLink>
        </li>)}
      </ul>
      <p className="disk-note">{t('本层文件及目录元数据', 'Files at this level and directory metadata')}: {gib(scan.ownBytes)}</p>
      {scan.omittedCount > 0 && <p className="disk-note">{t('其余目录合计', 'Other directories combined')}: {gib(scan.omittedBytes)} ({scan.omittedCount})</p>}
      {scan.children.length === 0 && <p>{t('没有可展开的子目录。', 'No subdirectories to explore.')}</p>}
    </section>}
    <p className="disk-note">{t('目录按实际占用空间统计，仅扫描根磁盘，不跟随符号链接。总览还包含文件系统开销和已删除但仍被进程占用的文件，因此可能与目录合计不同。', 'Directory totals count allocated space on the root filesystem without following symlinks. The overview also includes filesystem overhead and deleted files still held open, so totals can differ.')}</p>
    <p className="disk-note">{t('扫描结果缓存 5 分钟，同一目录每分钟最多刷新一次。此页面只读。', 'Scans are cached for 5 minutes. Each directory can be refreshed once per minute. This page is read-only.')}</p>
  </main>;
}
