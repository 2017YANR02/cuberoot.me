'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Music, Video, Mic, Square, Play, Pause, Search } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { createMeetCode, getVideoConfig } from '@/lib/video-room-api';
import { loadMusicLibrary, playMusic, pauseMusic, useMusicPlayer } from '@/lib/music-player';
import { parseChatShare } from '@/lib/chat-shares';

export function ChatVoiceInput({ insert, disabled, lang }: { insert(value: string): void; disabled: boolean; lang: string }) {
  const t = useT();
  const speech = useSpeechToText({ lang: lang === 'zh' ? 'zh-CN' : 'en-US', onResult: (text, final) => { if (final) insert(text); } });
  if (!speech.supported) return null;
  return <div className="friend-chat-voice"><button type="button" className="friend-chat-action friend-chat-icon" disabled={disabled} aria-pressed={speech.listening} aria-label={speech.listening ? t('停止语音输入', 'Stop dictation') : t('语音输入', 'Dictation')} onClick={speech.listening ? speech.stop : speech.start}>{speech.listening ? <Square size={23} /> : <Mic size={25} />}</button>{'error' in speech && !!speech.error && <span className="friend-chat-error" role="alert">{t('语音输入失败，请重试。', 'Dictation failed. Try again.')}</span>}</div>;
}

export function ChatMoreTools({ insert }: { insert(value: string): void }) {
  const t = useT();
  const [mode, setMode] = useState<'grid' | 'music'>('grid');
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const alive = useRef(true);
  const player = useMusicPlayer();
  useEffect(() => { alive.current = true; void getVideoConfig().then(config => { if (alive.current) setVideoEnabled(config?.enabled === true); }); return () => { alive.current = false; }; }, []);
  async function invite() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const code = await createMeetCode();
      if (alive.current) insert(`\n${t('视频通话邀请', 'Video call invitation')}\nhttps://cuberoot.me/meet?room=${code}\n`);
    } catch { if (alive.current) setError(t('无法创建视频房间，请稍后重试。', 'Could not create a video room. Try again.')); }
    finally { if (alive.current) setBusy(false); }
  }
  return <>
    {mode === 'grid' ? <div className="friend-chat-more-grid">
      {videoEnabled && <button type="button" disabled={busy} onClick={() => void invite()}><span><Video /></span>{busy ? t('创建中…', 'Creating…') : t('视频通话', 'Video call')}</button>}
      <button type="button" onClick={() => { setMode('music'); void loadMusicLibrary(); }}><span><Music /></span>{t('音乐', 'Music')}</button>
    </div> : <div className="friend-chat-music-picker">
      <div className="friend-chat-tools"><button type="button" className="friend-chat-action" onClick={() => setMode('grid')}><ArrowLeft size={16} />{t('更多功能', 'More actions')}</button><AppLink href="/music" prefetch={false}>{t('打开曲库', 'Open music library')}</AppLink></div>
      <div className="friend-chat-search"><Search size={16} /><input aria-label={t('搜索音乐', 'Search music')} value={query} onChange={e => setQuery(e.target.value)} />{query && <ClearButton onClick={() => setQuery('')} />}</div>
      {player.status === 'loading' && <p role="status">{t('加载中…', 'Loading…')}</p>}
      {(player.status === 'error' || player.error) && <p role="alert">{t('音乐加载或播放失败', 'Could not load or play music')}<button type="button" className="friend-chat-action" onClick={() => void loadMusicLibrary(true)}>{t('重试', 'Retry')}</button></p>}
      {player.status === 'ready' && !player.tracks.filter(track => `${track.title} ${track.artist}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).length && <p>{t('没有匹配的音乐', 'No matching music')}</p>}
      <div className="friend-chat-music-list">{player.tracks.filter(track => `${track.title} ${track.artist}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(track => <div className="friend-chat-music-track" key={track.id}>
        <button type="button" className="friend-chat-action" aria-label={t('试听', 'Preview') + ': ' + track.title} onClick={() => player.currentId === track.id && player.playing ? pauseMusic() : void playMusic(track.id)}>{player.currentId === track.id && player.playing ? <Pause size={19} /> : <Play size={19} />}</button>
        <span><strong>{track.title}</strong><small>{track.artist}</small></span>
        <button type="button" className="friend-chat-action" onClick={() => insert(`\n🎵 ${track.title} — ${track.artist}\nhttps://cuberoot.me/music?track=${encodeURIComponent(track.id)}\n`)}>{t('分享', 'Share')}</button>
      </div>)}</div>
    </div>}
    {error && <p className="friend-chat-error" role="alert">{error}</p>}
  </>;
}

export function ChatShareBody({ body, renderText }: { body: string; renderText(text: string): ReactNode }) {
  const t = useT();
  const player = useMusicPlayer();
  return <>{body.split('\n').map((line, index) => {
    const share = parseChatShare(line);
    if (!share) return <span key={index}>{renderText(line)}{'\n'}</span>;
    return <span className="friend-chat-share-card" key={index}>
      {share.kind === 'meet' ? <Video size={23} /> : <Music size={23} />}
      <AppLink href={share.href} prefetch={false} target="_blank" rel="noopener noreferrer">{share.kind === 'meet' ? t('加入视频通话', 'Join video call') : t('打开这首歌', 'Open this track')}</AppLink>
      {share.kind === 'music' && <button type="button" className="friend-chat-action" aria-label={t('播放音乐', 'Play music')} onClick={() => void playMusic(share.id)}><Play size={17} /></button>}
      {share.kind === 'music' && player.error && player.currentId === share.id && <small role="alert">{t('播放失败，请打开曲库重试', 'Playback failed. Try the music library.')}</small>}
    </span>;
  })}</>;
}
