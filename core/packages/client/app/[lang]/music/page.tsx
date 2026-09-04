'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Disc3, Download, ImagePlus, ListMusic, Music2, Pause, Pencil, Play, Repeat, Repeat1,
  Shuffle, SkipBack, SkipForward, Trash2, Upload, Volume2,
} from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import HeaderToggles from '@/components/HeaderToggles';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import SearchInput from '@/components/SearchInput';
import { useMembership } from '@/hooks/useMembership';
import { tr, useLang } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import {
  createMusicTrack, deleteAdminMusicTrack, fetchMusicTrackDownload, putMusicTrackCover,
  type MusicApiTrack, type MusicMetadataDraft,
} from '@/lib/music-api';
import {
  cycleMusicRepeat, loadMusicLibrary, loadTrackLyrics, nextMusic,
  playMusic, previousMusic, seekMusic, setMusicVolume, toggleMusic,
  toggleMusicShuffle, useMusicPlayer, type LyricLine, type MusicTrack,
  musicAssetUrl,
} from '@/lib/music-player';
import './music.css';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function categoryLabel(value: string): string {
  const labels: Record<string, { zh: string; en: string }> = {
    'film-tv-soundtrack': { zh: '影视原声', en: 'Film & TV scores' },
    'sound-effects': { zh: '音效', en: 'Sound effects' },
    jazz: { zh: '爵士', en: 'Jazz' },
    'piano-classical': { zh: '钢琴与古典', en: 'Piano & classical' },
    electronic: { zh: '电子', en: 'Electronic' },
    'pop-rock': { zh: '流行与摇滚', en: 'Pop & rock' },
    'bgm-assets': { zh: 'BGM 与素材', en: 'BGM & production' },
    'ambient-instrumental': { zh: '轻音乐与纯音乐', en: 'Ambient & instrumental' },
    unclassified: { zh: '未分类', en: 'Unclassified' },
  };
  return labels[value] ? tr(labels[value]) : value;
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

function MusicUploadDialog({ onClose, onUploaded }: {
  onClose: () => void;
  onUploaded: (track: MusicApiTrack, coverFailed?: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<MusicMetadataDraft>({ title: '', artist: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!audioFile || !draft.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let track = await createMusicTrack(audioFile, cleanDraft(draft));
      if (coverFile) {
        try {
          track = await putMusicTrackCover(track.id, coverFile);
        } catch {
          onUploaded(track, true);
          return;
        }
      }
      onUploaded(track);
      ref.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr({ zh: '上传失败', en: 'Upload failed' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="music-dialog"
      aria-labelledby="music-upload-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}
    >
      <div className="music-dialog-heading">
        <div>
          <h2 id="music-upload-title">{tr({ zh: '上传音乐', en: 'Upload music' })}</h2>
          <p>{tr({ zh: '提交后由管理员审核，发布前可以修改信息。', en: 'An administrator will review it. You can edit details before publication.' })}</p>
        </div>
        <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭上传窗口', en: 'Close upload dialog' })} onClick={() => ref.current?.close()} />
      </div>
      <form className="music-editor" onSubmit={submit}>
        <label className="music-file-picker">
          <Upload aria-hidden="true" />
          <span>{audioFile?.name ?? tr({ zh: '选择音频文件', en: 'Choose an audio file' })}</span>
          <input
            className="music-file-input"
            type="file"
            accept=".flac,.mp3,.m4a,.wav,audio/flac,audio/mpeg,audio/mp4,audio/wav,audio/x-wav"
            required
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setAudioFile(file);
              if (file && !draft.title) setDraft((current) => ({ ...current, title: file.name.replace(/\.[^.]+$/, '') }));
            }}
          />
        </label>
        <div className="music-editor-grid">
          <label><span>{tr({ zh: '歌曲名', en: 'Title' })}</span><input className="music-editor-control" value={draft.title} required onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label><span>{tr({ zh: '艺术家（可选）', en: 'Artist (optional)' })}</span><input className="music-editor-control" value={draft.artist} onChange={(event) => setDraft({ ...draft, artist: event.target.value })} /></label>
          <label><span>{tr({ zh: '专辑', en: 'Album' })}</span><input className="music-editor-control" value={draft.album ?? ''} onChange={(event) => setDraft({ ...draft, album: event.target.value })} /></label>
          <label><span>{tr({ zh: '分类', en: 'Category' })}</span><input className="music-editor-control" value={draft.genre ?? ''} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
        </div>
        <label><span>{tr({ zh: 'LRC 歌词', en: 'LRC lyrics' })}</span><textarea className="music-editor-control" rows={6} value={draft.lyricsLrc ?? ''} onChange={(event) => setDraft({ ...draft, lyricsLrc: event.target.value })} /></label>
        <label className="music-file-picker is-secondary">
          <ImagePlus aria-hidden="true" />
          <span>{coverFile?.name ?? tr({ zh: '添加封面（可选）', en: 'Add cover art (optional)' })}</span>
          <input className="music-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="music-form-error" role="alert">{error}</p>}
        <div className="music-dialog-actions">
          <button type="button" className="music-text-button" onClick={() => ref.current?.close()}>{tr({ zh: '取消', en: 'Cancel' })}</button>
          <button type="submit" className="music-primary-button" disabled={busy || !audioFile}>
            {busy ? tr({ zh: '正在上传…', en: 'Uploading…' }) : tr({ zh: '提交审核', en: 'Submit for review' })}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Cover({ track, small = false }: { track: MusicTrack | null; small?: boolean }) {
  if (track?.cover) {
    return <img className={small ? 'music-cover is-small' : 'music-cover'} src={musicAssetUrl(track.cover)} alt={track.title} />;
  }
  return (
    <span className={small ? 'music-cover-placeholder is-small' : 'music-cover-placeholder'} aria-hidden="true">
      <Disc3 />
    </span>
  );
}

function SyncedLyrics({ track, time }: { track: MusicTrack | null; time: number }) {
  const [lines, setLines] = useState<LyricLine[]>([]);
  const activeIndex = useMemo(() => {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (time >= lines[index].time) return index;
    }
    return -1;
  }, [lines, time]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLines([]);
    if (track) void loadTrackLyrics(track).then((next) => { if (active) setLines(next); });
    return () => { active = false; };
  }, [track]);

  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
  }, [activeIndex]);

  if (!track) return <div className="music-lyrics-empty"><Music2 aria-hidden="true" /></div>;
  if (lines.length === 0) {
    return (
      <div className="music-lyrics-empty">
        <span>{tr({ zh: '这首歌暂时没有同步歌词', en: 'No synced lyrics for this track' })}</span>
      </div>
    );
  }
  return (
    <div ref={scroller} className="music-lyrics-lines" aria-label={tr({ zh: '同步歌词', en: 'Synced lyrics' })}>
      {lines.map((line, index) => (
        <button
          key={`${line.time}-${index}`}
          type="button"
          className="music-lyric-line"
          aria-current={index === activeIndex ? 'true' : undefined}
          onClick={() => seekMusic(line.time)}
        >
          {line.text}
        </button>
      ))}
    </div>
  );
}

export default function MusicPage() {
  useLang();
  const player = useMusicPlayer();
  const { isMember, loading: membershipLoading } = useMembership();
  const isAdmin = useIsAdmin();
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [genre, setGenre] = useQueryState('genre', parseAsString.withDefault(''));
  const [dialog, setDialog] = useState<'upload' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<'uploaded' | 'uploadedWithoutCover' | 'downloaded' | 'deleted' | 'error' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const current = player.tracks.find((track) => track.id === player.currentId) ?? null;

  useEffect(() => { void loadMusicLibrary(); }, []);

  const genres = useMemo(
    () => [...new Set(player.tracks.map((track) => track.genre).filter((value): value is string => Boolean(value)))].sort(),
    [player.tracks],
  );
  const visibleTracks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return player.tracks.filter((track) => {
      if (genre && track.genre !== genre) return false;
      if (!needle) return true;
      return `${track.title}\n${track.artist}\n${track.album ?? ''}`.toLocaleLowerCase().includes(needle);
    });
  }, [genre, player.tracks, query]);

  const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;
  const repeatLabel = player.repeat === 'off'
    ? tr({ zh: '循环关闭', en: 'Repeat off' })
    : player.repeat === 'all'
      ? tr({ zh: '列表循环', en: 'Repeat all' })
      : tr({ zh: '单曲循环', en: 'Repeat one' });

  const downloadCurrent = async () => {
    if (!current?.databaseId || downloading) return;
    setDownloading(true);
    setActionMessage(null);
    setActionError(null);
    try {
      const blob = await fetchMusicTrackDownload(current.databaseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = current.downloadFilename || current.title;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setActionMessage('downloaded');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : tr({ zh: '下载失败', en: 'Download failed' }));
      setActionMessage('error');
    } finally {
      setDownloading(false);
    }
  };

  const deleteCurrent = async () => {
    if (!isAdmin || !current?.databaseId || deleting || !window.confirm(tr({
      zh: `永久删除“${current.title}”？此操作无法撤销。`,
      en: `Permanently delete “${current.title}”? This cannot be undone.`,
    }))) return;
    setDeleting(true);
    setActionMessage(null);
    setActionError(null);
    try {
      await deleteAdminMusicTrack(current.databaseId);
      await loadMusicLibrary(true);
      setActionMessage('deleted');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : tr({ zh: '删除失败', en: 'Delete failed' }));
      setActionMessage('error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="music-page">
      <header className="music-header">
        <div>
          <span className="music-kicker">{tr({ zh: 'CUBEROOT 音频', en: 'CUBEROOT AUDIO' })}</span>
          <h1>{tr({ zh: '音乐', en: 'Music' })}</h1>
          <p>{tr({ zh: '听歌、看同步歌词，也能随时切回节拍训练。', en: 'Listen, follow synced lyrics, or switch back to tempo training.' })}</p>
          <AppLink href="/about" className="music-credits-link">
            {tr({ zh: '开源项目与致谢', en: 'Open-source references and credits' })}<span aria-hidden="true">→</span>
          </AppLink>
        </div>
        <HeaderToggles />
      </header>

      <div className="music-workspace">
        <section className="music-library" aria-labelledby="music-library-title">
          <div className="music-section-heading">
            <div>
              <span className="music-kicker">{tr({ zh: '曲库', en: 'LIBRARY' })}</span>
              <h2 id="music-library-title">{tr({ zh: '曲库与队列', en: 'Library & queue' })}</h2>
            </div>
            <span>{player.tracks.length}</span>
          </div>
          <div className="music-filters">
            <SearchInput
              value={query}
              onChange={(value) => { void setQuery(value || null); }}
              placeholder={tr({ zh: '搜索歌曲、歌手、专辑', en: 'Search songs, artists, albums' })}
              className="music-search"
              inputClassName="music-search-input"
              type="search"
            />
            {genres.length > 0 && (
              <select
                className="music-genre-select"
                value={genre}
                onChange={(event) => { void setGenre(event.target.value || null); }}
                aria-label={tr({ zh: '音乐分类', en: 'Music category' })}
              >
                <option value="">{tr({ zh: '全部分类', en: 'All categories' })}</option>
                {genres.map((value) => <option key={value} value={value}>{categoryLabel(value)}</option>)}
              </select>
            )}
          </div>
          {!membershipLoading && (
            <div className="music-library-actions">
              {isMember ? (
                <>
                  <button type="button" className="music-primary-button" onClick={() => setDialog('upload')}>
                    <Upload aria-hidden="true" />{tr({ zh: '上传音乐', en: 'Upload music' })}
                  </button>
                  <AppLink href="/music/manage" prefetch={false} className="music-text-button">
                    <ListMusic aria-hidden="true" />
                    {isAdmin ? tr({ zh: '审核与管理', en: 'Review & manage' }) : tr({ zh: '我的上传', en: 'My uploads' })}
                  </AppLink>
                </>
              ) : (
                <AppLink href="/membership" className="music-membership-link">
                  {tr({ zh: '会员可以上传和下载音乐', en: 'Members can upload and download music' })}<span aria-hidden="true">→</span>
                </AppLink>
              )}
            </div>
          )}
          {actionMessage && (
            <p className={actionMessage === 'error' ? 'music-form-error music-action-message' : 'music-form-success music-action-message'} role="status">
              {actionMessage === 'uploaded' && tr({ zh: '已提交审核，可在“我的上传”查看进度。', en: 'Submitted for review. Follow its progress in My uploads.' })}
              {actionMessage === 'uploadedWithoutCover' && tr({ zh: '音乐已提交审核，但封面上传失败，可在“我的上传”中补传。', en: 'The track was submitted, but its cover failed to upload. Add it from My uploads.' })}
              {actionMessage === 'downloaded' && tr({ zh: '下载已开始', en: 'Download started' })}
              {actionMessage === 'deleted' && tr({ zh: '音乐已删除', en: 'Track deleted' })}
              {actionMessage === 'error' && (actionError ?? tr({ zh: '操作失败，请稍后重试。', en: 'The action failed. Try again later.' }))}
            </p>
          )}
          <div className="music-track-list">
            {player.status === 'loading' && <p className="music-state">{tr({ zh: '正在载入曲库…', en: 'Loading library…' })}</p>}
            {player.status === 'error' && (
              <p className="music-state">{tr({ zh: '曲库尚未发布。播放器界面已就绪。', en: 'The library is not published yet. The player is ready.' })}</p>
            )}
            {player.status === 'ready' && player.error && (
              <p className="music-state">{tr({ zh: '这首歌无法播放，请尝试其他歌曲。', en: 'This track could not be played. Try another track.' })}</p>
            )}
            {player.status === 'ready' && visibleTracks.length === 0 && (
              <p className="music-state">{tr({ zh: '没有匹配的歌曲', en: 'No matching tracks' })}</p>
            )}
            {visibleTracks.map((track, index) => {
              const isCurrent = track.id === current?.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  className={isCurrent ? 'music-track is-current' : 'music-track'}
                  onClick={() => { void playMusic(track.id); }}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span className="music-track-index">{isCurrent && player.playing ? <Music2 size={14} /> : index + 1}</span>
                  <Cover track={track} small />
                  <span className="music-track-copy">
                    <strong>{track.title}</strong>
                    <span>{track.artist || tr({ zh: '未知艺术家', en: 'Unknown artist' })}{track.album ? ` — ${track.album}` : ''}</span>
                  </span>
                  <span className="music-track-duration">{track.duration ? formatTime(track.duration) : ''}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="music-now" aria-labelledby="music-now-title">
          <div className="music-artwork-wrap"><Cover track={current} /></div>
          <div className="music-now-copy" aria-live="polite">
            <span className="music-kicker">{tr({ zh: '正在播放', en: 'NOW PLAYING' })}</span>
            <h2 id="music-now-title">{current?.title ?? tr({ zh: '选择一首歌', en: 'Choose a track' })}</h2>
            <p>{current ? (current.artist || tr({ zh: '未知艺术家', en: 'Unknown artist' })) : tr({ zh: '你的 CubeRoot 曲库', en: 'Your CubeRoot library' })}</p>
            {current?.album && <span>{current.album}</span>}
          </div>

          {current?.databaseId && (
            <div className="music-current-actions">
              {isMember && (
                <button type="button" className="music-text-button" onClick={() => { void downloadCurrent(); }} disabled={downloading}>
                  <Download aria-hidden="true" />
                  {downloading ? tr({ zh: '正在下载…', en: 'Downloading…' }) : tr({ zh: '下载', en: 'Download' })}
                </button>
              )}
              {!membershipLoading && !isMember && (
                <AppLink href="/membership" className="music-membership-link">
                  {tr({ zh: '开通会员后下载', en: 'Join to download' })}<span aria-hidden="true">→</span>
                </AppLink>
              )}
              {isAdmin && (
                <>
                  <AppLink href={`/music/manage?track=${encodeURIComponent(current.databaseId)}`} prefetch={false} className="music-text-button">
                    <Pencil aria-hidden="true" />{tr({ zh: '编辑', en: 'Edit' })}
                  </AppLink>
                  <button type="button" className="music-danger-button" onClick={() => { void deleteCurrent(); }} disabled={deleting}>
                    <Trash2 aria-hidden="true" />{deleting ? tr({ zh: '正在删除…', en: 'Deleting…' }) : tr({ zh: '删除', en: 'Delete' })}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="music-progress">
            <input
              className="music-progress-input"
              type="range" min={0} max={Math.max(1, player.duration)} step={0.1}
              value={Math.min(player.currentTime, Math.max(1, player.duration))}
              onChange={(event) => seekMusic(Number(event.target.value))}
              aria-label={tr({ zh: '播放进度', en: 'Playback progress' })}
              disabled={!current}
            />
            <div><span>{formatTime(player.currentTime)}</span><span>{formatTime(player.duration)}</span></div>
          </div>

          <div className="music-transport">
            <button type="button" className={player.shuffle ? 'music-transport-button is-active' : 'music-transport-button'} onClick={toggleMusicShuffle}
              aria-pressed={player.shuffle} aria-label={tr({ zh: '随机播放', en: 'Shuffle' })}>
              <Shuffle size={18} />
            </button>
            <button type="button" className="music-transport-button" onClick={() => { void previousMusic(); }} aria-label={tr({ zh: '上一首', en: 'Previous track' })}>
              <SkipBack size={22} fill="currentColor" />
            </button>
            <button type="button" className="music-transport-button music-main-play" onClick={toggleMusic} disabled={!current}
              aria-label={player.playing ? tr({ zh: '暂停', en: 'Pause' }) : tr({ zh: '播放', en: 'Play' })}>
              {player.playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <button type="button" className="music-transport-button" onClick={() => { void nextMusic(); }} aria-label={tr({ zh: '下一首', en: 'Next track' })}>
              <SkipForward size={22} fill="currentColor" />
            </button>
            <button type="button" className={player.repeat === 'off' ? 'music-transport-button' : 'music-transport-button is-active'} onClick={cycleMusicRepeat}
              aria-label={repeatLabel} title={repeatLabel}>
              <RepeatIcon size={18} />
            </button>
          </div>

          <label className="music-volume">
            <Volume2 size={17} aria-hidden="true" />
            <span className="sr-only">{tr({ zh: '音量', en: 'Volume' })}</span>
            <input className="music-volume-input" type="range" min={0} max={1} step={0.01} value={player.volume}
              onChange={(event) => setMusicVolume(Number(event.target.value))} />
          </label>
        </section>

        <section className="music-lyrics" aria-labelledby="music-lyrics-title">
          <div className="music-section-heading">
            <div>
              <span className="music-kicker">{tr({ zh: '歌词', en: 'LYRICS' })}</span>
              <h2 id="music-lyrics-title">{tr({ zh: '歌词', en: 'Lyrics' })}</h2>
            </div>
            <ListMusic aria-hidden="true" />
          </div>
          <SyncedLyrics track={current} time={player.currentTime} />
        </section>
      </div>
      {dialog === 'upload' && (
        <MusicUploadDialog
          onClose={() => setDialog(null)}
          onUploaded={(_track, coverFailed) => {
            setActionMessage(coverFailed ? 'uploadedWithoutCover' : 'uploaded');
            setDialog(null);
          }}
        />
      )}
    </main>
  );
}
