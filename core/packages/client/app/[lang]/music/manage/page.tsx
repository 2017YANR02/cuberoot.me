'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { useMembership } from '@/hooks/useMembership';
import { tr, useLang } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import {
  deleteAdminMusicStaticTrack, deleteAdminMusicTrack, listAdminMusicTracks,
  listMusicStaticOverrides, listMyMusicTracks, putMusicTrackCover,
  updateAdminMusicStaticTrack, updateAdminMusicTrack, updateMyMusicTrack,
  type MusicApiTrack, type MusicMetadataDraft, type MusicTrackStatus,
} from '@/lib/music-api';
import { loadMusicLibrary, loadStaticMusicManifest } from '@/lib/music-player';
import '../music.css';

type ManagedTrack = Pick<MusicApiTrack, 'id' | 'title' | 'artist' | 'album' | 'genre' | 'lyricsLrc' | 'status' | 'reviewNote'> & {
  source: 'static' | 'upload';
  staticId?: string;
  hidden?: boolean;
};

function statusLabel(track: ManagedTrack): string {
  if (track.source === 'static') return track.hidden
    ? tr({ zh: '已下架', en: 'Removed' })
    : tr({ zh: '静态曲库', en: 'Library' });
  if (track.status === 'published') return tr({ zh: '已发布', en: 'Published' });
  if (track.status === 'rejected') return tr({ zh: '未通过', en: 'Needs changes' });
  return tr({ zh: '待审核', en: 'Pending review' });
}

function cleanDraft(draft: MusicMetadataDraft): MusicMetadataDraft {
  return {
    title: draft.title.trim(), artist: draft.artist.trim(),
    album: draft.album?.trim() ?? '', genre: draft.genre?.trim() ?? '',
    lyricsLrc: draft.lyricsLrc?.trim() ?? '',
  };
}

export default function MusicManagePage() {
  useLang();
  const { isMember, loading: membershipLoading } = useMembership();
  const isAdmin = useIsAdmin();
  const [selectedId, setSelectedId] = useQueryState('track', parseAsString);
  const [tracks, setTracks] = useState<ManagedTrack[]>([]);
  const [draft, setDraft] = useState<MusicMetadataDraft>({ title: '', artist: '' });
  const [status, setStatus] = useState<MusicTrackStatus>('pending');
  const [reviewNote, setReviewNote] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const selected = tracks.find((track) => track.id === selectedId) ?? null;
  const canEdit = isAdmin || (selected?.source === 'upload' && selected.status === 'pending');

  useEffect(() => {
    if (membershipLoading || !isMember) return;
    let active = true;
    setLoading(true);
    const request = isAdmin
      ? Promise.all([listAdminMusicTracks(), loadStaticMusicManifest(), listMusicStaticOverrides()]).then(([uploads, manifest, overrides]) => {
        const byId = new Map(overrides.map((item) => [item.id, item]));
        const library: ManagedTrack[] = manifest.tracks.map((track) => {
          const override = byId.get(track.id);
          return {
            id: `static:${track.id}`, staticId: track.id, source: 'static',
            title: override?.title ?? track.title, artist: override?.artist ?? track.artist,
            album: override?.album === undefined ? (track.album ?? null) : override.album,
            genre: override?.genre === undefined ? (track.genre ?? null) : override.genre,
            lyricsLrc: null, status: 'published', reviewNote: null,
            hidden: override?.hidden ?? false,
          };
        });
        return [...library, ...uploads.map((track): ManagedTrack => ({ ...track, source: 'upload' }))];
      })
      : listMyMusicTracks().then((uploads) => uploads.map((track): ManagedTrack => ({ ...track, source: 'upload' })));
    request
      .then((next) => { if (active) { setTracks(next); setError(null); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : tr({ zh: '载入失败', en: 'Loading failed' })); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, isMember, membershipLoading]);

  useEffect(() => {
    if (loading) return;
    if (!tracks.length) {
      if (selectedId) void setSelectedId(null);
      return;
    }
    if (!tracks.some((track) => track.id === selectedId)) void setSelectedId(tracks[0].id);
  }, [loading, selectedId, setSelectedId, tracks]);

  useEffect(() => {
    if (!selected) return;
    setDraft({ title: selected.title, artist: selected.artist,
      ...(selected.album ? { album: selected.album } : {}),
      ...(selected.genre ? { genre: selected.genre } : {}),
      ...(selected.lyricsLrc ? { lyricsLrc: selected.lyricsLrc } : {}),
    });
    setStatus(selected.status);
    setReviewNote(selected.reviewNote ?? '');
    setCoverFile(null);
    setSaved(false);
    setError(null);
  }, [selected]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !canEdit || !draft.title.trim()) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      if (selected.source === 'static' && selected.staticId) {
        const updated = await updateAdminMusicStaticTrack(selected.staticId, { ...cleanDraft(draft), hidden: !!selected.hidden });
        setTracks((current) => current.map((track) => track.id === selected.id ? {
          ...track, title: updated.title ?? track.title, artist: updated.artist ?? track.artist,
          album: updated.album === undefined ? track.album : updated.album,
          genre: updated.genre === undefined ? track.genre : updated.genre,
        } : track));
      } else {
        let updated = isAdmin
          ? await updateAdminMusicTrack(selected.id, { ...cleanDraft(draft), status, reviewNote: reviewNote.trim() })
          : await updateMyMusicTrack(selected.id, cleanDraft(draft));
        if (coverFile) updated = await putMusicTrackCover(selected.id, coverFile);
        setTracks((current) => current.map((track) => track.id === updated.id ? { ...updated, source: 'upload' } : track));
      }
      setSaved(true);
      void loadMusicLibrary(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '保存失败', en: 'Save failed' }));
    } finally { setBusy(false); }
  };

  const toggleStatic = async () => {
    if (!selected?.staticId || selected.source !== 'static') return;
    if (!selected.hidden && !window.confirm(tr({
      zh: `从公开曲库移除“${selected.title}”？音频文件会保留，可随时恢复。`,
      en: `Remove “${selected.title}” from the public library? Its audio file will be retained for recovery.`,
    }))) return;
    setBusy(true); setError(null);
    try {
      const updated = selected.hidden
        ? await updateAdminMusicStaticTrack(selected.staticId, {
          title: selected.title, artist: selected.artist,
          album: selected.album ?? '', genre: selected.genre ?? '', hidden: false,
        })
        : await deleteAdminMusicStaticTrack(selected.staticId);
      setTracks((current) => current.map((track) => track.id === selected.id ? { ...track, hidden: updated.hidden } : track));
      void loadMusicLibrary(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '操作失败', en: 'Action failed' }));
    } finally { setBusy(false); }
  };

  const removeUpload = async () => {
    if (!selected || selected.source !== 'upload' || !isAdmin || !window.confirm(tr({
      zh: `永久删除“${selected.title}”？此操作无法撤销。`,
      en: `Permanently delete “${selected.title}”? This cannot be undone.`,
    }))) return;
    setBusy(true); setError(null);
    try {
      await deleteAdminMusicTrack(selected.id);
      const next = tracks.filter((track) => track.id !== selected.id);
      setTracks(next);
      void setSelectedId(next[0]?.id ?? null);
      void loadMusicLibrary(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '删除失败', en: 'Delete failed' }));
    } finally { setBusy(false); }
  };

  return <main className="music-page music-manage-page">
    <header className="music-header">
      <div>
        <span className="music-kicker">{tr({ zh: 'CUBEROOT 音频', en: 'CUBEROOT AUDIO' })}</span>
        <h1>{isAdmin ? tr({ zh: '审核与管理', en: 'Review & manage' }) : tr({ zh: '我的上传', en: 'My uploads' })}</h1>
        <p>{isAdmin ? tr({ zh: '管理静态曲库与会员上传内容。', en: 'Manage the library and member uploads.' }) : tr({ zh: '查看审核状态并修改待审核内容。', en: 'Check review status and edit pending uploads.' })}</p>
        <AppLink href="/music" className="music-credits-link">{tr({ zh: '打开音乐播放器', en: 'Open music player' })}<span aria-hidden="true">→</span></AppLink>
      </div>
      <HeaderToggles />
    </header>

    {membershipLoading ? <p className="music-state">{tr({ zh: '正在确认会员状态…', en: 'Checking membership…' })}</p>
      : !isMember ? <p className="music-state">{tr({ zh: '会员可以上传和管理音乐。', en: 'Members can upload and manage music.' })}{' '}<AppLink href="/membership">{tr({ zh: '查看会员', en: 'View membership' })}</AppLink></p>
        : loading ? <p className="music-state">{tr({ zh: '正在载入曲库…', en: 'Loading library…' })}</p>
          : <div className="music-manager-layout">
            <div className="music-manager-list" aria-label={tr({ zh: '曲库内容', en: 'Library content' })}>
              {!tracks.length && <p className="music-state">{tr({ zh: '曲库为空', en: 'The library is empty' })}</p>}
              {tracks.map((track) => <button key={track.id} type="button" className={track.id === selectedId ? 'music-manager-item is-selected' : 'music-manager-item'} onClick={() => { void setSelectedId(track.id); }}>
                <span>{track.title}</span><small data-status={track.hidden ? 'rejected' : track.status}>{statusLabel(track)}</small>
              </button>)}
            </div>
            {selected && <form className="music-editor" onSubmit={save}>
              <div className="music-editor-grid">
                <label><span>{tr({ zh: '歌曲名', en: 'Title' })}</span><input className="music-editor-control" value={draft.title} required readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
                <label><span>{tr({ zh: '艺术家', en: 'Artist' })}</span><input className="music-editor-control" value={draft.artist} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, artist: event.target.value })} /></label>
                <label><span>{tr({ zh: '专辑', en: 'Album' })}</span><input className="music-editor-control" value={draft.album ?? ''} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, album: event.target.value })} /></label>
                <label><span>{tr({ zh: '分类', en: 'Category' })}</span><input className="music-editor-control" value={draft.genre ?? ''} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
              </div>
              {selected.source === 'static' ? <p className="music-state">{tr({ zh: '静态曲库支持修改信息和可恢复下架；原音频文件不会被删除。', en: 'Library tracks support metadata editing and reversible removal; source audio is retained.' })}</p> : <>
                <label><span>{tr({ zh: 'LRC 歌词', en: 'LRC lyrics' })}</span><textarea className="music-editor-control" rows={5} value={draft.lyricsLrc ?? ''} readOnly={!canEdit} onChange={(event) => setDraft({ ...draft, lyricsLrc: event.target.value })} /></label>
                {isAdmin && <div className="music-editor-grid">
                  <label><span>{tr({ zh: '审核状态', en: 'Review status' })}</span><select className="music-editor-control" value={status} onChange={(event) => setStatus(event.target.value as MusicTrackStatus)}><option value="pending">{tr({ zh: '待审核', en: 'Pending review' })}</option><option value="published">{tr({ zh: '发布', en: 'Publish' })}</option><option value="rejected">{tr({ zh: '退回修改', en: 'Needs changes' })}</option></select></label>
                  <label><span>{tr({ zh: '审核说明', en: 'Review note' })}</span><input className="music-editor-control" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label>
                </div>}
                {selected.reviewNote && !isAdmin && <p className="music-review-note"><strong>{tr({ zh: '审核说明：', en: 'Review note: ' })}</strong>{selected.reviewNote}</p>}
                {canEdit && <label className="music-file-picker is-secondary"><ImagePlus aria-hidden="true" /><span>{coverFile?.name ?? tr({ zh: '更换封面（可选）', en: 'Replace cover art (optional)' })}</span><input className="music-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} /></label>}
              </>}
              {error && <p className="music-form-error" role="alert">{error}</p>}
              {saved && <p className="music-form-success" role="status">{tr({ zh: '更改已保存', en: 'Changes saved' })}</p>}
              <div className="music-dialog-actions">
                {isAdmin && selected.source === 'static' && <button type="button" className={selected.hidden ? 'music-text-button' : 'music-danger-button'} onClick={() => { void toggleStatic(); }} disabled={busy}>{selected.hidden ? <RotateCcw aria-hidden="true" /> : <Trash2 aria-hidden="true" />}{selected.hidden ? tr({ zh: '恢复上架', en: 'Restore' }) : tr({ zh: '从曲库移除', en: 'Remove from library' })}</button>}
                {isAdmin && selected.source === 'upload' && <button type="button" className="music-danger-button" onClick={() => { void removeUpload(); }} disabled={busy}><Trash2 aria-hidden="true" />{tr({ zh: '永久删除', en: 'Delete permanently' })}</button>}
                {canEdit && <button type="submit" className="music-primary-button" disabled={busy}>{busy ? tr({ zh: '正在保存…', en: 'Saving…' }) : tr({ zh: '保存更改', en: 'Save changes' })}</button>}
              </div>
            </form>}
          </div>}
    {!loading && error && !selected && <p className="music-form-error" role="alert">{error}</p>}
  </main>;
}
