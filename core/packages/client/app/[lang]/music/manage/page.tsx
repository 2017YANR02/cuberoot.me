'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { useMembership } from '@/hooks/useMembership';
import { tr, useLang } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import {
  deleteAdminMusicTrack, listAdminMusicTracks, listMyMusicTracks, putMusicTrackCover,
  updateAdminMusicTrack, updateMyMusicTrack,
  type MusicApiTrack, type MusicMetadataDraft, type MusicTrackStatus,
} from '@/lib/music-api';
import { loadMusicLibrary } from '@/lib/music-player';
import '../music.css';

function statusLabel(status: MusicTrackStatus): string {
  if (status === 'published') return tr({ zh: '已发布', en: 'Published' });
  if (status === 'rejected') return tr({ zh: '未通过', en: 'Needs changes' });
  return tr({ zh: '待审核', en: 'Pending review' });
}

function cleanDraft(draft: MusicMetadataDraft): MusicMetadataDraft {
  return {
    title: draft.title.trim(),
    artist: draft.artist.trim(),
    album: draft.album?.trim() ?? '',
    genre: draft.genre?.trim() ?? '',
    lyricsLrc: draft.lyricsLrc?.trim() ?? '',
  };
}

export default function MusicManagePage() {
  useLang();
  const { isMember, loading: membershipLoading } = useMembership();
  const isAdmin = useIsAdmin();
  const [selectedId, setSelectedId] = useQueryState('track', parseAsString);
  const [tracks, setTracks] = useState<MusicApiTrack[]>([]);
  const [draft, setDraft] = useState<MusicMetadataDraft>({ title: '', artist: '' });
  const [status, setStatus] = useState<MusicTrackStatus>('pending');
  const [reviewNote, setReviewNote] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const selected = tracks.find((track) => track.id === selectedId) ?? null;
  const canEdit = isAdmin || selected?.status === 'pending';

  useEffect(() => {
    if (membershipLoading || !isMember) return;
    let active = true;
    setLoading(true);
    (isAdmin ? listAdminMusicTracks() : listMyMusicTracks())
      .then((next) => {
        if (!active) return;
        setTracks(next);
        setError(null);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : tr({ zh: '载入失败', en: 'Loading failed' })); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, isMember, membershipLoading]);

  useEffect(() => {
    if (loading) return;
    if (tracks.length === 0) {
      if (selectedId) void setSelectedId(null);
      return;
    }
    if (!tracks.some((track) => track.id === selectedId)) void setSelectedId(tracks[0].id);
  }, [loading, selectedId, setSelectedId, tracks]);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      title: selected.title,
      artist: selected.artist,
      ...(selected.album ? { album: selected.album } : {}),
      ...(selected.genre ? { genre: selected.genre } : {}),
      ...(selected.lyricsLrc ? { lyricsLrc: selected.lyricsLrc } : {}),
    });
    setStatus(selected.status);
    setReviewNote(selected.reviewNote ?? '');
    setCoverFile(null);
    setSaved(false);
    setError(null);
  }, [selected?.id]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !canEdit || !draft.title.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let updated = isAdmin
        ? await updateAdminMusicTrack(selected.id, { ...cleanDraft(draft), status, reviewNote: reviewNote.trim() })
        : await updateMyMusicTrack(selected.id, cleanDraft(draft));
      if (coverFile) updated = await putMusicTrackCover(selected.id, coverFile);
      setTracks((current) => current.map((track) => track.id === updated.id ? updated : track));
      setSaved(true);
      if (isAdmin) void loadMusicLibrary(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '保存失败', en: 'Save failed' }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected || !isAdmin || !window.confirm(tr({
      zh: `永久删除“${selected.title}”？此操作无法撤销。`,
      en: `Permanently delete “${selected.title}”? This cannot be undone.`,
    }))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminMusicTrack(selected.id);
      const next = tracks.filter((track) => track.id !== selected.id);
      setTracks(next);
      void setSelectedId(next[0]?.id ?? null);
      void loadMusicLibrary(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '删除失败', en: 'Delete failed' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="music-page music-manage-page">
      <header className="music-header">
        <div>
          <span className="music-kicker">{tr({ zh: 'CUBEROOT 音频', en: 'CUBEROOT AUDIO' })}</span>
          <h1>{isAdmin ? tr({ zh: '审核与管理', en: 'Review & manage' }) : tr({ zh: '我的上传', en: 'My uploads' })}</h1>
          <p>{isAdmin ? tr({ zh: '编辑信息、审核发布或删除上传内容。', en: 'Edit details, review submissions, or remove uploads.' }) : tr({ zh: '查看审核状态并修改待审核内容。', en: 'Check review status and edit pending uploads.' })}</p>
          <AppLink href="/music" className="music-credits-link">
            {tr({ zh: '打开音乐播放器', en: 'Open music player' })}<span aria-hidden="true">→</span>
          </AppLink>
        </div>
        <HeaderToggles />
      </header>

      {membershipLoading ? (
        <p className="music-state">{tr({ zh: '正在确认会员状态…', en: 'Checking membership…' })}</p>
      ) : !isMember ? (
        <p className="music-state">
          {tr({ zh: '会员可以上传和管理音乐。', en: 'Members can upload and manage music.' })}{' '}
          <AppLink href="/membership">{tr({ zh: '查看会员', en: 'View membership' })}</AppLink>
        </p>
      ) : loading ? (
        <p className="music-state">{tr({ zh: '正在载入上传记录…', en: 'Loading uploads…' })}</p>
      ) : (
        <div className="music-manager-layout">
          <div className="music-manager-list" aria-label={tr({ zh: '上传记录', en: 'Uploads' })}>
            {tracks.length === 0 && <p className="music-state">{tr({ zh: '还没有上传记录', en: 'No uploads yet' })}</p>}
            {tracks.map((track) => (
              <button key={track.id} type="button" className={track.id === selectedId ? 'music-manager-item is-selected' : 'music-manager-item'} onClick={() => { void setSelectedId(track.id); }}>
                <span>{track.title}</span>
                <small data-status={track.status}>{statusLabel(track.status)}</small>
              </button>
            ))}
          </div>
          {selected && (
            <form className="music-editor" onSubmit={save}>
              <div className="music-editor-grid">
                <label><span>{tr({ zh: '歌曲名', en: 'Title' })}</span><input className="music-editor-control" value={draft.title} required readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
                <label><span>{tr({ zh: '艺术家（可选）', en: 'Artist (optional)' })}</span><input className="music-editor-control" value={draft.artist} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, artist: event.target.value })} /></label>
                <label><span>{tr({ zh: '专辑', en: 'Album' })}</span><input className="music-editor-control" value={draft.album ?? ''} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, album: event.target.value })} /></label>
                <label><span>{tr({ zh: '分类', en: 'Category' })}</span><input className="music-editor-control" value={draft.genre ?? ''} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
              </div>
              <label><span>{tr({ zh: 'LRC 歌词', en: 'LRC lyrics' })}</span><textarea className="music-editor-control" rows={5} value={draft.lyricsLrc ?? ''} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, lyricsLrc: event.target.value })} /></label>
              {isAdmin ? (
                <div className="music-editor-grid">
                  <label>
                    <span>{tr({ zh: '审核状态', en: 'Review status' })}</span>
                    <select className="music-editor-control" value={status} onChange={(event) => setStatus(event.target.value as MusicTrackStatus)}>
                      <option value="pending">{tr({ zh: '待审核', en: 'Pending review' })}</option>
                      <option value="published">{tr({ zh: '发布', en: 'Publish' })}</option>
                      <option value="rejected">{tr({ zh: '退回修改', en: 'Needs changes' })}</option>
                    </select>
                  </label>
                  <label><span>{tr({ zh: '审核说明', en: 'Review note' })}</span><input className="music-editor-control" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label>
                </div>
              ) : selected.reviewNote ? <p className="music-review-note"><strong>{tr({ zh: '审核说明：', en: 'Review note: ' })}</strong>{selected.reviewNote}</p> : null}
              {canEdit && (
                <label className="music-file-picker is-secondary">
                  <ImagePlus aria-hidden="true" />
                  <span>{coverFile?.name ?? tr({ zh: '更换封面（可选）', en: 'Replace cover art (optional)' })}</span>
                  <input className="music-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
                </label>
              )}
              {!canEdit && <p className="music-state">{tr({ zh: '已审核的内容不能自行修改。', en: 'Reviewed uploads cannot be edited.' })}</p>}
              {error && <p className="music-form-error" role="alert">{error}</p>}
              {saved && <p className="music-form-success" role="status">{tr({ zh: '更改已保存', en: 'Changes saved' })}</p>}
              <div className="music-dialog-actions">
                {isAdmin && <button type="button" className="music-danger-button" onClick={() => { void remove(); }} disabled={busy}><Trash2 aria-hidden="true" />{tr({ zh: '删除', en: 'Delete' })}</button>}
                {canEdit && <button type="submit" className="music-primary-button" disabled={busy}>{busy ? tr({ zh: '正在保存…', en: 'Saving…' }) : tr({ zh: '保存更改', en: 'Save changes' })}</button>}
              </div>
            </form>
          )}
        </div>
      )}
      {!loading && error && !selected && <p className="music-form-error" role="alert">{error}</p>}
    </main>
  );
}
