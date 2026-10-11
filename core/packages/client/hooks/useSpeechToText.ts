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
  onspeechstart: (() => void) | null;
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
  visualizeAudio?: boolean;
  continuous?: boolean;
  /** 每次有新文本(含中途 interim)时回调。isFinal=true 表示这是最终结果。 */
  onResult?: (text: string, isFinal: boolean) => void;
}

export function useSpeechToText({ lang, onResult, visualizeAudio = false, continuous = false }: Options) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'stopping'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [microphone, setMicrophone] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(() => Array(96).fill(0));
  const [waveformOffset, setWaveformOffset] = useState(0);
  const sessionRef = useRef<{ cancel: () => void; stop: () => void } | null>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { setSupported(getSR() !== null); }, []);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    sessionRef.current?.cancel();
    setStatus('idle');
    setSpeaking(false);
    setWaveform(Array(96).fill(0));
    setWaveformOffset(0);
    setError(null);
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    sessionRef.current?.cancel();
    setError(null);
    setMicrophone(null);
    setWaveform(Array(96).fill(0));
    setWaveformOffset(0);
    setSpeaking(false);
    if (!SR) { setStatus('idle'); setError('unsupported'); return; }
    let rec: SRInstance;
    try { rec = new SR(); } catch {
      setStatus('idle'); setError('service-not-allowed'); return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let receivedText = false;
    let stopping = false;
    let started = false;
    let previousText = '';
    let currentText = '';
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let audioSource: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let frame = 0;
    const active = () => sessionRef.current === session;
    const cancel = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      audioSource?.disconnect();
      analyser?.disconnect();
      if (audioContext) void audioContext.close().catch(() => {});
      rec.onstart = rec.onend = rec.onerror = rec.onresult = rec.onspeechend = rec.onspeechstart = null;
      if (active()) sessionRef.current = null;
      try { rec.abort(); } catch { /* Already ended. */ }
      stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    };
    const finish = (reason?: string) => {
      if (!active()) return;
      cancel();
      setStatus('idle');
      setSpeaking(false);
      setWaveform(Array(96).fill(0));
      setWaveformOffset(0);
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
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      if (!active() || stopping) return;
      setStatus('listening');
      if (continuous) clearTimeout(timer);
      else deadline(15_000);
    };
    rec.onend = () => {
      if (!active()) return;
      if (!continuous || stopping) { finish(receivedText ? undefined : 'no-speech'); return; }
      // Browsers may end even continuous recognition after silence. Keep capture
      // alive and retain this run's transcript before starting a fresh result list.
      previousText += currentText;
      currentText = '';
      started = false;
      setSpeaking(false);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (active() && !stopping) startRecognition(trackRecognition ? stream?.getAudioTracks()[0] : undefined);
      }, 300);
    };
    rec.onerror = (e) => {
      if (continuous && !stopping && e.error === 'no-speech') return;
      finish(e.error);
    };
    rec.onspeechstart = () => { if (active()) setSpeaking(true); };
    rec.onspeechend = () => { if (active()) { setSpeaking(false); if (!continuous) session.stop(); } };
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
        currentText = text;
        onResultRef.current?.(previousText + text, isFinal);
        if (isFinal && (!continuous || stopping)) finish();
        else if (!stopping && !continuous) deadline(15_000);
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
    const trackRecognition = canSelectSpeechMicrophone();
    if (visualizeAudio) {
      // Create/resume within the user gesture, before microphone permission resolves.
      try {
        audioContext = new AudioContext();
        void audioContext.resume().catch(() => finish('audio-capture'));
      } catch { finish('audio-capture'); return; }
    }
    if (trackRecognition || visualizeAudio) {
      deadline(30_000);
      // Chromium's literal "default" follows the OS input, whereas omitting
      // deviceId can select a saved browser device (including a silent virtual
      // driver). Do not enumerate or automatically open unrelated microphones.
      if (!navigator.mediaDevices?.getUserMedia) { finish('audio-capture'); return; }
      void navigator.mediaDevices.getUserMedia({ audio: trackRecognition ? { deviceId: { exact: 'default' } } : true })
        .then(captured => {
          if (!active()) { captured.getTracks().forEach(track => track.stop()); return; }
          stream = captured;
          const track = captured.getAudioTracks()[0];
          if (!track || track.readyState !== 'live') { finish('audio-capture'); return; }
          setMicrophone(track.label || null);
          track.onended = () => finish('audio-capture');
          if (audioContext) {
            audioSource = audioContext.createMediaStreamSource(captured);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            audioSource.connect(analyser);
            // Never connect microphone audio to speakers. Append one measured PCM
            // peak per tick: newest audio on the right, older audio moving left.
            const samples = new Float32Array(analyser.fftSize);
            let lastPaint = -Infinity;
            const sample = (now: number) => {
              if (!active() || !analyser) return;
              if (now - lastPaint >= 100) {
                analyser.getFloatTimeDomainData(samples);
                let peak = 0;
                for (const value of samples) peak = Math.max(peak, Math.abs(value));
                const amplitude = Math.min(1, peak * 4);
                setWaveform(history => [...history.slice(1), amplitude]);
                lastPaint = now;
              }
              // Translate between sample ticks, including silence. At the next
              // tick the history shifts by one cell and translation starts over.
              setWaveformOffset((now - lastPaint) / 100);
              frame = requestAnimationFrame(sample);
            };
            frame = requestAnimationFrame(sample);
          }
          startRecognition(trackRecognition ? track : undefined);
        })
        .catch(cause => {
          finish(cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
            ? 'not-allowed' : 'audio-capture');
        });
    } else {
      // Safari, Android and older engines keep their native capture path.
      startRecognition();
    }
  }, [lang, visualizeAudio, continuous]);

  // 卸载时停掉
  useEffect(() => {
    return () => { sessionRef.current?.cancel(); };
  }, []);

  return { supported, listening: status !== 'idle', speaking, waveform, waveformOffset, status, error, microphone, start, stop, cancel };
}
