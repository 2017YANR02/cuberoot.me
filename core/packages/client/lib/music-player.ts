'use client';

import { useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import { staticUrl } from '@/lib/stats-base';

const MANIFEST_URL = '/music/library/manifest.v1.json';
const PREFS_KEY = 'cuberoot.music-player.v1';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  src: string;
  cover?: string;
  lyrics?: string;
  genre?: string;
  mood?: string;
  duration?: number;
}

export interface MusicManifest {
  version: 1;
  tracks: MusicTrack[];
}

export interface LyricLine {
  time: number;
  text: string;
}

export type RepeatMode = 'off' | 'all' | 'one';
type LibraryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface MusicPlayerState {
  status: LibraryStatus;
  tracks: MusicTrack[];
  currentId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
}

const DEFAULT_STATE: MusicPlayerState = {
  status: 'idle', tracks: [], currentId: null, playing: false,
  currentTime: 0, duration: 0, volume: 0.8, shuffle: false,
  repeat: 'off', error: null,
};

let state = DEFAULT_STATE;
let audioEl: HTMLAudioElement | null = null;
let loadPromise: Promise<void> | null = null;
let preferencesLoaded = false;
const listeners = new Set<() => void>();
const lyricCache = new Map<string, Promise<LyricLine[]>>();

function emit(patch: Partial<MusicPlayerState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getMusicPlayerState(): MusicPlayerState {
  return state;
}

export function useMusicPlayer(): MusicPlayerState {
  return useSyncExternalStore(subscribe, getMusicPlayerState, () => DEFAULT_STATE);
}

function mediaUrl(path: string): string {
  return /^(https?:|blob:|data:)/i.test(path) ? path : staticUrl(path.startsWith('/') ? path : `/${path}`);
}

export const musicAssetUrl = mediaUrl;

function loadPreferences(): void {
  if (preferencesLoaded) return;
  preferencesLoaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<MusicPlayerState>;
    emit({
      volume: typeof saved.volume === 'number' ? Math.max(0, Math.min(1, saved.volume)) : state.volume,
      shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : state.shuffle,
      repeat: saved.repeat === 'all' || saved.repeat === 'one' ? saved.repeat : 'off',
      currentId: typeof saved.currentId === 'string' ? saved.currentId : null,
    });
  } catch { /* Ignore corrupt local preferences. */ }
}

function savePreferences(): void {
  persistItem(PREFS_KEY, JSON.stringify({
    currentId: state.currentId,
    volume: state.volume,
    shuffle: state.shuffle,
    repeat: state.repeat,
  }));
}

function updateMediaSession(track: MusicTrack): void {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: track.cover ? [{ src: mediaUrl(track.cover) }] : undefined,
  });
}

function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  loadPreferences();
  audioEl = new Audio();
  audioEl.preload = 'metadata';
  audioEl.volume = state.volume;
  audioEl.addEventListener('play', () => emit({ playing: true, error: null }));
  audioEl.addEventListener('pause', () => emit({ playing: false }));
  audioEl.addEventListener('timeupdate', () => emit({ currentTime: audioEl?.currentTime ?? 0 }));
  audioEl.addEventListener('durationchange', () => emit({
    duration: Number.isFinite(audioEl?.duration) ? audioEl!.duration : 0,
  }));
  audioEl.addEventListener('error', () => emit({
    playing: false,
    error: 'Unable to play this track.',
  }));
  audioEl.addEventListener('ended', () => {
    if (state.repeat === 'one') {
      audioEl!.currentTime = 0;
      void audioEl!.play();
    } else {
      void stepTrack(1, true);
    }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => { void playMusic(); });
    navigator.mediaSession.setActionHandler('pause', pauseMusic);
    navigator.mediaSession.setActionHandler('previoustrack', () => { void previousMusic(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { void nextMusic(); });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seekMusic(details.seekTime);
    });
  }
  return audioEl;
}

export function normalizeMusicManifest(value: unknown): MusicManifest {
  const input = value as { version?: unknown; tracks?: unknown };
  if (input?.version !== 1) return { version: 1, tracks: [] };
  const rows = Array.isArray(input?.tracks) ? input.tracks : [];
  const seen = new Set<string>();
  const isLocalPath = (path: string) => /^(?:[a-z]:[\\/]|\\\\|file:)/i.test(path);
  const tracks = rows.flatMap((raw): MusicTrack[] => {
    const row = raw as Partial<MusicTrack>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const src = typeof row.src === 'string' ? row.src.trim() : '';
    const duration = row.duration;
    const cover = typeof row.cover === 'string' ? row.cover.trim() : '';
    const lyrics = typeof row.lyrics === 'string' ? row.lyrics.trim() : '';
    if (!id || seen.has(id) || !title || !src || isLocalPath(src)
      || (duration != null && (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0))
      || (cover && isLocalPath(cover)) || (lyrics && isLocalPath(lyrics))) return [];
    seen.add(id);
    return [{
      id,
      title,
      artist: typeof row.artist === 'string' ? row.artist.trim() : '',
      src,
      ...(typeof row.album === 'string' && row.album.trim() ? { album: row.album.trim() } : {}),
      ...(cover ? { cover } : {}),
      ...(lyrics ? { lyrics } : {}),
      ...(typeof row.genre === 'string' && row.genre.trim() ? { genre: row.genre.trim() } : {}),
      ...(typeof row.mood === 'string' && row.mood.trim() ? { mood: row.mood.trim() } : {}),
      ...(typeof duration === 'number' ? { duration } : {}),
    }];
  });
  return { version: 1, tracks };
}

export async function loadMusicLibrary(): Promise<void> {
  if (state.status === 'ready') return;
  if (loadPromise) return loadPromise;
  loadPreferences();
  emit({ status: 'loading', error: null });
  loadPromise = fetch(staticUrl(MANIFEST_URL))
    .then(async (response) => {
      if (!response.ok) throw new Error(`Music manifest HTTP ${response.status}`);
      const manifest = normalizeMusicManifest(await response.json());
      const currentId = manifest.tracks.some((track) => track.id === state.currentId)
        ? state.currentId
        : (manifest.tracks[0]?.id ?? null);
      emit({ status: 'ready', tracks: manifest.tracks, currentId });
      savePreferences();
    })
    .catch((error: unknown) => {
      emit({ status: 'error', error: error instanceof Error ? error.message : 'Unable to load music.' });
    })
    .finally(() => { loadPromise = null; });
  return loadPromise;
}

function selectTrack(id: string): { audio: HTMLAudioElement; track: MusicTrack } | null {
  const track = state.tracks.find((candidate) => candidate.id === id);
  if (!track) return null;
  const audio = ensureAudio();
  const src = mediaUrl(track.src);
  const absoluteSrc = new URL(src, window.location.href).href;
  if (state.currentId !== id || audio.src !== absoluteSrc) {
    audio.src = src;
    emit({ currentId: id, currentTime: 0, duration: track.duration ?? 0, error: null });
    savePreferences();
  }
  updateMediaSession(track);
  return { audio, track };
}

export async function playMusic(id: string | null = state.currentId): Promise<void> {
  if (state.status !== 'ready') await loadMusicLibrary();
  const targetId = id ?? state.tracks[0]?.id;
  if (!targetId) return;
  const selected = selectTrack(targetId);
  if (!selected) return;
  window.dispatchEvent(new Event('cuberoot:music-start'));
  try {
    await selected.audio.play();
  } catch (error) {
    emit({ playing: false, error: error instanceof Error ? error.message : 'Unable to play this track.' });
  }
}

export function pauseMusic(): void {
  audioEl?.pause();
}

export function toggleMusic(): void {
  if (state.playing) pauseMusic(); else void playMusic();
}

async function stepTrack(delta: -1 | 1, fromEnded = false): Promise<void> {
  if (state.tracks.length === 0) return;
  const currentIndex = Math.max(0, state.tracks.findIndex((track) => track.id === state.currentId));
  if (fromEnded && state.repeat === 'off' && currentIndex === state.tracks.length - 1) {
    emit({ playing: false, currentTime: state.duration });
    return;
  }
  let nextIndex: number;
  if (state.shuffle && state.tracks.length > 1) {
    do { nextIndex = Math.floor(Math.random() * state.tracks.length); } while (nextIndex === currentIndex);
  } else {
    nextIndex = (currentIndex + delta + state.tracks.length) % state.tracks.length;
  }
  await playMusic(state.tracks[nextIndex].id);
}

export function nextMusic(): Promise<void> {
  return stepTrack(1);
}

export function previousMusic(): Promise<void> {
  if ((audioEl?.currentTime ?? 0) > 3) {
    seekMusic(0);
    return Promise.resolve();
  }
  return stepTrack(-1);
}

export function seekMusic(seconds: number): void {
  if (!audioEl || !Number.isFinite(seconds)) return;
  audioEl.currentTime = Math.max(0, Math.min(audioEl.duration || seconds, seconds));
  emit({ currentTime: audioEl.currentTime });
}

export function setMusicVolume(volume: number): void {
  const next = Math.max(0, Math.min(1, volume));
  if (audioEl) audioEl.volume = next;
  emit({ volume: next });
  savePreferences();
}

export function toggleMusicShuffle(): void {
  emit({ shuffle: !state.shuffle });
  savePreferences();
}

export function cycleMusicRepeat(): void {
  emit({ repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off' });
  savePreferences();
}

export function parseLrc(source: string): LyricLine[] {
  const offset = Number(source.match(/^\[offset:([+-]?\d+)\]$/im)?.[1] ?? 0) / 1000;
  const lines: LyricLine[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]+\]/g, '').trim();
    if (!text) continue;
    for (const stamp of stamps) {
      const fraction = (stamp[3] ?? '').padEnd(3, '0').slice(0, 3);
      lines.push({
        time: Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + Number(fraction) / 1000 + offset),
        text,
      });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function loadTrackLyrics(track: MusicTrack): Promise<LyricLine[]> {
  if (!track.lyrics) return Promise.resolve([]);
  const cached = lyricCache.get(track.lyrics);
  if (cached) return cached;
  const request = fetch(mediaUrl(track.lyrics))
    .then((response) => response.ok ? response.text() : '')
    .then(parseLrc)
    .catch(() => []);
  lyricCache.set(track.lyrics, request);
  return request;
}

if (typeof window !== 'undefined') {
  window.addEventListener('cuberoot:metronome-start', pauseMusic);
}
