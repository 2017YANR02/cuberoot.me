'use client';

// 浏览器原生语音识别封装 (Web Speech API)
// Ported from packages/client-vite/src/utils/useSpeechToText.ts.
// API 存在不代表识别服务可用；权限、网络和无回调超时必须反馈给调用方。
// 仍依赖浏览器的识别服务，不是跨浏览器的后端 ASR。
// Next 适配:supported 初值 false + useEffect 探测,避免 SSR/client hydration mismatch。
import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API 的 TS 类型 DOM lib 不全,这里补必需的几个。
interface SRResultAlt { transcript: string }
interface SRResult { 0: SRResultAlt; isFinal: boolean; length: number }
interface SRResultList { item(i: number): SRResult; length: number;[i: number]: SRResult }
interface SREvent extends Event { results: SRResultList; resultIndex: number }
interface SRErrorEvent extends Event { error: string }
interface SRInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(audioTrack?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
}
interface SRConstructor { new(): SRInstance }

function getSR(): SRConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function canSelectSpeechMicrophone(): boolean {
  // start(track) has no side-effect-free feature probe: older engines silently
  // ignore its argument and open their own microphone. Restrict it to the known
  // implementation: desktop Chromium 135+. Android uses a different recognizer.
  // https://github.com/mdn/browser-compat-data/blob/main/api/SpeechRecognition.json
  const chromium = navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/);
  return Boolean(chromium && Number(chromium[1]) >= 135
    && !/Android/.test(navigator.userAgent) && navigator.mediaDevices?.getUserMedia);
}

interface Options {
  lang: 'zh-CN' | 'en-US';
  /** 每次有新文本(含中途 interim)时回调。isFinal=true 表示这是最终结果。 */
  onResult?: (text: string, isFinal: boolean) => void;
}

export function useSpeechToText({ lang, onResult }: Options) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [microphone, setMicrophone] = useState<string | null>(null);
  const sessionRef = useRef<{ cancel: () => void; stop: () => void } | null>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { setSupported(getSR() !== null); }, []);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    sessionRef.current?.cancel();
    setError(null);
    setMicrophone(null);
    if (!SR) { setStatus('idle'); setError('unsupported'); return; }
    let rec: SRInstance;
    try { rec = new SR(); } catch {
      setStatus('idle'); setError('service-not-allowed'); return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let receivedText = false;
    let stopping = false;
    let started = false;
    let stream: MediaStream | null = null;
    const active = () => sessionRef.current === session;
    const cancel = () => {
      clearTimeout(timer);
      rec.onstart = rec.onend = rec.onerror = rec.onresult = rec.onspeechend = null;
      if (active()) sessionRef.current = null;
      try { rec.abort(); } catch { /* Already ended. */ }
      stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    };
    const finish = (reason?: string) => {
      if (!active()) return;
      cancel();
      setStatus('idle');
      if (reason) setError(reason);
    };
    const deadline = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // A track-backed recognizer may keep delivering interim text until
        // stop(). Request its final result instead of reporting a false failure.
        if (receivedText && !stopping) session.stop();
        else finish('timeout');
      }, ms);
    };
    const session = {
      cancel,
      stop: () => {
        if (stopping) return;
        // A permission prompt can still be pending. Release any late stream;
        // never start recognition after the user has cancelled.
        if (!started) { finish(); return; }
        stopping = true;
        setStatus('stopping');
        // stop() requests a final result; abort() here would discard it.
        deadline(5_000);
        try { rec.stop(); } catch { finish('aborted'); }
      },
    };
    sessionRef.current = session;
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      if (!active() || stopping) return;
      setStatus('listening');
      deadline(15_000);
    };
    rec.onend = () => finish(receivedText ? undefined : 'no-speech');
    rec.onerror = (e) => finish(e.error);
    rec.onspeechend = () => { if (active()) session.stop(); };
    rec.onresult = (e: SREvent) => {
      if (!active()) return;
      let text = '';
      let isFinal = true;
      // resultIndex only marks changed results; the input needs the whole utterance.
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        text += r[0].transcript;
        if (!r.isFinal) isFinal = false;
      }
      if (text.trim()) {
        receivedText = true;
        onResultRef.current?.(text, isFinal);
        if (isFinal) finish();
        else if (!stopping) deadline(15_000);
      }
    };
    setStatus('starting');
    const startRecognition = (track?: MediaStreamTrack) => {
      deadline(12_000);
      started = true;
      try {
        if (track) rec.start(track);
        else rec.start();
      } catch (cause) {
        finish(cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
          ? 'not-allowed' : 'service-not-allowed');
      }
    };
    if (canSelectSpeechMicrophone()) {
      deadline(30_000);
      // Chromium's literal "default" follows the OS input, whereas omitting
      // deviceId can select a saved browser device (including a silent virtual
      // driver). Do not enumerate or automatically open unrelated microphones.
      void navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: 'default' } } })
        .then(captured => {
          if (!active()) { captured.getTracks().forEach(track => track.stop()); return; }
          stream = captured;
          const track = captured.getAudioTracks()[0];
          if (!track || track.readyState !== 'live') { finish('audio-capture'); return; }
          setMicrophone(track.label || null);
          track.onended = () => finish('audio-capture');
          startRecognition(track);
        })
        .catch(cause => {
          finish(cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
            ? 'not-allowed' : 'audio-capture');
        });
    } else {
      // Safari, Android and older engines keep their native capture path.
      startRecognition();
    }
  }, [lang]);

  // 卸载时停掉
  useEffect(() => {
    return () => { sessionRef.current?.cancel(); };
  }, []);

  return { supported, listening: status !== 'idle', status, error, microphone, start, stop };
}
