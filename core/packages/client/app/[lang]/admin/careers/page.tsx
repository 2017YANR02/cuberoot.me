'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import { useIsAdmin } from '@/lib/auth-store';
import '../admin.css';
import './careers-admin.css';

type Application = { id: string; position_id: string; city: string; applicant_name: string; phone: string; email: string; education: string; experience: string; channel: string; resume_name: string; photo_name: string | null; created_at: string };
export default function CareersAdmin() {
  const t = useT();
  const admin = useIsAdmin();
  const [applications, setApplications] = useState<Application[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [downloadError, setDownloadError] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    setStatus('loading');
    void sessionFetch(apiUrl(`/v1/career-applications?offset=${offset}`), { headers: authHeaders(false), cache: 'no-store', signal: controller.signal })
      .then(response => handleApi<{ applications: Application[]; hasMore: boolean }>(response))
      .then(data => { if (!controller.signal.aborted) { setApplications(data.applications); setHasMore(data.hasMore); setStatus('ready'); } })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [admin, offset, revision]);
  const download = async (id: string, kind: 'resume' | 'photo', filename: string) => {
    setDownloadError(false);
    try {
      const response = await sessionFetch(apiUrl(`/v1/career-applications/${encodeURIComponent(id)}/${kind}`), { headers: authHeaders(false), cache: 'no-store' });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = filename.toLowerCase().match(/\.(pdf|docx?|txt|jpe?g|png)$/)?.[1];
      link.download = extension ? `${kind}.${extension}` : kind;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setDownloadError(true); }
  };
  const remove = async (id: string) => {
    if (deleting || !window.confirm(t('永久删除这份申请及其简历和照片？此操作无法撤销。', 'Permanently delete this application, resume and photo? This cannot be undone.'))) return;
    setDeleteError(false);
    setDeleting(id);
    try {
      await handleApi(await sessionFetch(apiUrl(`/v1/career-applications/${encodeURIComponent(id)}`), { method: 'DELETE', headers: authHeaders(false), cache: 'no-store' }));
      if (applications.length === 1 && offset > 0) setOffset(value => Math.max(0, value - 50));
      else setRevision(value => value + 1);
    } catch { setDeleteError(true); }
    finally { setDeleting(null); }
  };
  return <main className="admin-hub careers-admin">
    <header className="admin-hub__heading"><h1>{t('招聘申请', 'Career applications')}</h1></header>
    {!admin ? <p>{t('请使用管理员账号登录后查看。', 'Sign in with an administrator account to view applications.')} <AppLink href="/account" prefetch={false}>{t('前往账号页', 'Go to account')}</AppLink></p>
      : status === 'loading' ? <p role="status">{t('正在读取…', 'Loading…')}</p>
      : status === 'error' ? <p role="alert">{t('读取失败，请检查管理员登录状态并刷新页面。', 'Unable to load applications. Check your administrator session and refresh.')}</p>
      : <>
        {downloadError && <p role="alert">{t('附件下载失败，请重试。', 'Could not download the attachment. Please try again.')}</p>}
        {deleteError && <p role="alert">{t('删除失败，请重试。', 'Could not delete the application. Please try again.')}</p>}
        {!applications.length && <p>{t('暂无申请。', 'No applications yet.')}</p>}
        {applications.map(item => <article key={item.id} className="careers-admin-item" data-site-surface="panel">
          <h2>{item.applicant_name}</h2><p>{item.position_id === 'engineering' ? t('全栈工程师', 'Full-stack engineer') : item.position_id === 'content-operations' ? t('内容运营与视频剪辑', 'Content operations and video editor') : item.position_id} · {item.city === 'shanghai' ? t('上海', 'Shanghai') : item.city} · <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></p>
          <dl><dt>{t('手机号码', 'Phone')}</dt><dd>{item.phone}</dd><dt>{t('邮箱', 'Email')}</dt><dd>{item.email}</dd>{item.education && <><dt>{t('最高学历', 'Education')}</dt><dd>{item.education}</dd></>}{item.experience && <><dt>{t('工作经历', 'Experience')}</dt><dd>{item.experience}</dd></>}{item.channel && <><dt>{t('招聘渠道', 'Source')}</dt><dd>{item.channel}</dd></>}</dl>
          <div className="careers-admin-files"><button className="careers-admin-action" type="button" onClick={() => void download(item.id, 'resume', item.resume_name)}>{t('下载简历', 'Download resume')}: {item.resume_name}</button>{item.photo_name && <button className="careers-admin-action" type="button" onClick={() => void download(item.id, 'photo', item.photo_name!)}>{t('下载照片', 'Download photo')}: {item.photo_name}</button>}<button type="button" className="careers-admin-action careers-admin-delete" disabled={deleting !== null} onClick={() => void remove(item.id)}>{deleting === item.id ? t('正在删除…', 'Deleting…') : t('删除申请', 'Delete application')}</button></div>
        </article>)}
        <nav className="careers-admin-pages" aria-label={t('申请分页', 'Application pages')}><button className="careers-admin-page-button" type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>{t('上一页', 'Previous')}</button><button className="careers-admin-page-button" type="button" disabled={!hasMore} onClick={() => setOffset(value => value + 50)}>{t('下一页', 'Next')}</button></nav>
      </>}
  </main>;
}
