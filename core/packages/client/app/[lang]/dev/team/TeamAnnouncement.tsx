'use client';
import { useRef, useState } from 'react';
import { Megaphone, Pencil, Save } from 'lucide-react';
import { ErrorNotice, useResource, useWorkspace } from '@app-foundation/workspace-ui';
import { WorkspaceDialog } from '../../workspace/WorkspaceControls';
import { useT } from '@/hooks/useT';
import { announcementItems, numberAnnouncementLines } from '@/lib/numbered-announcement';

type Notice = { lines: string[]; version: number; updatedAt: number; canEdit: boolean };
export default function TeamAnnouncement() {
  const t = useT();
  const { api, Button } = useWorkspace();
  const resource = useResource<Notice>('announcement');
  const [saved, setSaved] = useState<Notice>();
  const notice = saved && saved.version > (resource.data?.version ?? -1) ? saved : resource.data;
  const [draft, setDraft] = useState<{ text: string; version: number }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const composing = useRef(false);
  const normalize = (input: HTMLTextAreaElement) => {
    const next = numberAnnouncementLines(input.value, input.selectionStart);
    setDraft(current => current && { ...current, text: next.text });
    requestAnimationFrame(() => input.setSelectionRange(next.caret, next.caret));
  };
  const save = async () => {
    if (!draft || busy) return;
    setBusy(true); setError('');
    try {
      const next = await api<Notice>('announcement', { lines: announcementItems(draft.text), version: draft.version });
      setSaved(next); setDraft(undefined); setPage(0); resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('保存失败，请重试', 'Save failed. Please retry.'));
    } finally { setBusy(false); }
  };
  return <section className="team-announcement" aria-labelledby="team-announcement-title">
    <div className="team-announcement-heading"><h3 id="team-announcement-title"><Megaphone size={24} aria-hidden />{t('团队公告', 'Team announcements')}</h3>
      {notice?.canEdit && <Button variant="secondary" aria-haspopup="dialog" onClick={() => { setDraft({ text: numberAnnouncementLines(notice.lines.join('\n')).text, version: notice.version }); setError(''); }}><Pencil size={18} aria-hidden />{t('编辑公告', 'Edit announcements')}</Button>}
    </div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.loading && !notice && <p role="status">{t('正在加载…', 'Loading…')}</p>}
    {draft && <WorkspaceDialog title={t('编辑团队公告', 'Edit team announcements')} onClose={() => { if (!busy) { setDraft(undefined); setError(''); } }} wide><form className="team-announcement-editor" aria-busy={busy} onSubmit={event => { event.preventDefault(); void save(); }}>
      <label htmlFor="team-announcement-input">{t('公告内容', 'Announcement content')}</label>
      <p>{t('每行一条，换行自动编号。所有管理员均可查看和编辑。', 'One item per line, numbered automatically. All administrators can view and edit.')}</p>
      <textarea name="announcement" id="team-announcement-input" value={draft.text} rows={7} maxLength={16000} disabled={busy} placeholder={t('输入第一条公告，换行自动编号', 'Write the first announcement. New lines are numbered automatically.')} onChange={event => {
        if (composing.current) setDraft({ ...draft, text: event.target.value }); else normalize(event.target);
      }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={event => { composing.current = false; normalize(event.currentTarget); }} />
      {error && <p role="alert">{error}</p>}
      <div className="staff-actions"><Button type="submit" disabled={busy}><Save size={18} aria-hidden />{busy ? t('保存中…', 'Saving…') : t('保存公告', 'Save announcements')}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => { setDraft(undefined); setError(''); }}>{t('取消', 'Cancel')}</Button></div>
    </form></WorkspaceDialog>}
    {notice && <>
      {notice.lines.length ? <ol start={page * 4 + 1}>{notice.lines.slice(page * 4, page * 4 + 4).map((line, index) => <li key={`${page}-${index}`}>{line}</li>)}</ol> : <p className="team-announcement-empty">{t('暂无公告', 'No announcements yet')}</p>}
      {notice.lines.length > 4 && <div className="staff-actions"><Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('上一页', 'Previous')}</Button><Button variant="secondary" disabled={(page + 1) * 4 >= notice.lines.length} onClick={() => setPage(page + 1)}>{t('下一页', 'Next')}</Button></div>}
    </>}
  </section>;
}
