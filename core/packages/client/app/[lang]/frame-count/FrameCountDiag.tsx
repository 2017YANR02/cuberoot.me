'use client';

/**
 * @module FrameCountDiag
 * 设备端诊断浮层 — 仅 URL 带 ?fcdiag=1 时挂载。
 * 把整条加载/解码状态机 + 最近的 console 日志直接画到屏幕上,
 * 让无法远程调试的真机 (iOS Safari on Windows 开发机) 也能截图反馈卡点。
 * 正常用户永远看不到 (query-gated),零副作用。
 */

import { useEffect, useRef, useState } from 'react';

export interface FrameCountDiagState {
  videoFile: File | null;
  loadProgress: { bytes: number; total: number } | null;
  videoFirstFrameReady: boolean;
  parseFailed: boolean;
  frameBufferReady: boolean;
  samplesCount: number;
  decoderDead: boolean;
  keyThumbCount: number;
  videoFps: number;
  totalFrames: number;
  isMobile: boolean;
}

interface VideoStats {
  rs: number;
  net: number;
  err: number | null;
  vw: number;
  vh: number;
  ct: number;
  dur: number;
}

const READY_STATE = ['0 NOTHING', '1 METADATA', '2 CUR_DATA', '3 FUTURE', '4 ENOUGH'];
const NET_STATE = ['0 EMPTY', '1 IDLE', '2 LOADING', '3 NO_SOURCE'];
const MEDIA_ERR = ['', '1 ABORTED', '2 NETWORK', '3 DECODE', '4 SRC_NOT_SUPPORTED'];

export function FrameCountDiag({ enabled, state }: { enabled: boolean; state: FrameCountDiagState }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [vstat, setVstat] = useState<VideoStats | null>(null);
  const logsRef = useRef<string[]>([]);

  // 捕获 console (log/warn/error),只留 frame-count 相关的几条,环形缓冲
  useEffect(() => {
    if (!enabled) return;
    const orig = { log: console.log, warn: console.warn, error: console.error };
    const push = (tag: string, args: unknown[]) => {
      const text = args.map(a => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      if (!/FrameBuffer|FCLog|FrameCount|decoder|sample|HEVC|codec|mp4box/i.test(text)) return;
      const line = `${tag}${text}`.slice(0, 160);
      logsRef.current = [...logsRef.current.slice(-9), line];
      setLogs(logsRef.current);
    };
    console.log = (...a: unknown[]) => { push('', a); orig.log(...a); };
    console.warn = (...a: unknown[]) => { push('⚠ ', a); orig.warn(...a); };
    console.error = (...a: unknown[]) => { push('✖ ', a); orig.error(...a); };
    return () => { console.log = orig.log; console.warn = orig.warn; console.error = orig.error; };
  }, [enabled]);

  // 轮询 video 元素硬状态 (readyState / error / networkState / 尺寸)
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const v = document.querySelector('video');
      if (!v) { setVstat(null); return; }
      setVstat({
        rs: v.readyState, net: v.networkState, err: v.error ? v.error.code : null,
        vw: v.videoWidth, vh: v.videoHeight, ct: v.currentTime, dur: v.duration,
      });
    };
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  const s = state;
  const lp = s.loadProgress;
  const row = (k: string, v: string, warn?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: warn ? '#ff8080' : undefined }}>
      <span style={{ opacity: 0.6 }}>{k}</span><span>{v}</span>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', left: 6, right: 6, bottom: 6, zIndex: 99999,
        maxHeight: '52vh', overflowY: 'auto',
        background: 'rgba(0,0,0,0.88)', color: '#9effa0',
        font: '11px/1.45 ui-monospace, Menlo, Consolas, monospace',
        padding: '8px 10px', borderRadius: 8, border: '1px solid #2a5',
        WebkitOverflowScrolling: 'touch', pointerEvents: 'auto',
      }}
    >
      <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>
        FC DIAG (?fcdiag=1)
      </div>
      {row('VideoDecoder', typeof VideoDecoder !== 'undefined' ? 'YES' : 'NO (no WebCodecs)', typeof VideoDecoder === 'undefined')}
      {row('IS_MOBILE', String(s.isMobile))}
      {row('file', s.videoFile ? `${s.videoFile.name} ${(s.videoFile.size / 1048576).toFixed(1)}MB ${s.videoFile.type || '(no type)'}` : 'none')}
      {row('loadProgress', lp ? `${(lp.bytes / 1048576).toFixed(1)}/${(lp.total / 1048576).toFixed(1)}MB` : 'null (done/idle)')}
      {row('firstFrameReady', String(s.videoFirstFrameReady), !s.videoFirstFrameReady && !!s.videoFile)}
      {row('video.readyState', vstat ? (READY_STATE[vstat.rs] ?? String(vstat.rs)) : 'no <video>', !!vstat && vstat.rs < 2)}
      {row('video.networkState', vstat ? (NET_STATE[vstat.net] ?? String(vstat.net)) : '-', !!vstat && vstat.net === 3)}
      {row('video.error', vstat && vstat.err != null ? (MEDIA_ERR[vstat.err] ?? String(vstat.err)) : 'none', !!(vstat && vstat.err != null))}
      {row('video.size', vstat ? `${vstat.vw}x${vstat.vh}` : '-', !!vstat && vstat.vw === 0)}
      {row('video.dur', vstat ? (isFinite(vstat.dur) ? vstat.dur.toFixed(2) + 's' : 'NaN') : '-')}
      {row('parseFailed', String(s.parseFailed), s.parseFailed)}
      {row('frameBufferReady', String(s.frameBufferReady))}
      {row('samples', String(s.samplesCount))}
      {row('decoderDead', String(s.decoderDead), s.decoderDead)}
      {row('keyThumbs', String(s.keyThumbCount))}
      {row('fps / totalFrames', `${s.videoFps} / ${s.totalFrames}`)}
      <div style={{ color: '#fff', fontWeight: 700, margin: '6px 0 2px' }}>recent logs</div>
      {logs.length === 0 ? <div style={{ opacity: 0.5 }}>(none yet)</div> : logs.map((l, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: l.startsWith('✖') ? '#ff8080' : l.startsWith('⚠') ? '#ffd080' : '#cfcfcf' }}>{l}</div>
      ))}
    </div>
  );
}
