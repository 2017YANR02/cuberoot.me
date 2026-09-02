'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Disc3, ListMusic, Music2, Pause, Play, Repeat, Repeat1,
  Shuffle, SkipBack, SkipForward, Volume2,
} from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import HeaderToggles from '@/components/HeaderToggles';
import SearchInput from '@/components/SearchInput';
import { tr, useLang } from '@/i18n/tr';
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
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [genre, setGenre] = useQueryState('genre', parseAsString.withDefault(''));
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

  return (
    <main className="music-page">
      <header className="music-header">
        <div>
          <span className="music-kicker">{tr({ zh: 'CUBEROOT 音频', en: 'CUBEROOT AUDIO' })}</span>
          <h1>{tr({ zh: '音乐', en: 'Music' })}</h1>
          <p>{tr({ zh: '听歌、看同步歌词，也能随时切回节拍训练。', en: 'Listen, follow synced lyrics, or switch back to tempo training.' })}</p>
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
                value={genre}
                onChange={(event) => { void setGenre(event.target.value || null); }}
                aria-label={tr({ zh: '音乐分类', en: 'Music category' })}
              >
                <option value="">{tr({ zh: '全部分类', en: 'All categories' })}</option>
                {genres.map((value) => <option key={value} value={value}>{categoryLabel(value)}</option>)}
              </select>
            )}
          </div>
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

          <div className="music-progress">
            <input
              type="range" min={0} max={Math.max(1, player.duration)} step={0.1}
              value={Math.min(player.currentTime, Math.max(1, player.duration))}
              onChange={(event) => seekMusic(Number(event.target.value))}
              aria-label={tr({ zh: '播放进度', en: 'Playback progress' })}
              disabled={!current}
            />
            <div><span>{formatTime(player.currentTime)}</span><span>{formatTime(player.duration)}</span></div>
          </div>

          <div className="music-transport">
            <button type="button" className={player.shuffle ? 'is-active' : ''} onClick={toggleMusicShuffle}
              aria-pressed={player.shuffle} aria-label={tr({ zh: '随机播放', en: 'Shuffle' })}>
              <Shuffle size={18} />
            </button>
            <button type="button" onClick={() => { void previousMusic(); }} aria-label={tr({ zh: '上一首', en: 'Previous track' })}>
              <SkipBack size={22} fill="currentColor" />
            </button>
            <button type="button" className="music-main-play" onClick={toggleMusic} disabled={!current}
              aria-label={player.playing ? tr({ zh: '暂停', en: 'Pause' }) : tr({ zh: '播放', en: 'Play' })}>
              {player.playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <button type="button" onClick={() => { void nextMusic(); }} aria-label={tr({ zh: '下一首', en: 'Next track' })}>
              <SkipForward size={22} fill="currentColor" />
            </button>
            <button type="button" className={player.repeat === 'off' ? '' : 'is-active'} onClick={cycleMusicRepeat}
              aria-label={repeatLabel} title={repeatLabel}>
              <RepeatIcon size={18} />
            </button>
          </div>

          <label className="music-volume">
            <Volume2 size={17} aria-hidden="true" />
            <span className="sr-only">{tr({ zh: '音量', en: 'Volume' })}</span>
            <input type="range" min={0} max={1} step={0.01} value={player.volume}
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
    </main>
  );
}
