'use client';

// 浏览器原生语音识别封装 (Web Speech API)
// Ported from packages/client/src/utils/useSpeechToText.ts.
// Chrome/Edge/Safari 都支持 (webkit 前缀);Firefox 不支持 → supported=false
// 不引入任何依赖,不上后端 ASR。
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
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
interface SRConstructor { new(): SRInstance }

function getSR(): SRConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Options {
  lang: 'zh-CN' | 'en-US';
  /** 每次有新文本(含中途 interim)时回调。isFinal=true 表示这是最终结果。 */
  onResult?: (text: string, isFinal: boolean) => void;
}

export function useSpeechToText({ lang, onResult }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SRInstance | null>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { setSupported(getSR() !== null); }, []);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) return;
    // 同实例不能并发 start,先 abort 旧的
    try { recRef.current?.abort(); } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => { setListening(false); recRef.current = null; };
    rec.onerror = () => { setListening(false); recRef.current = null; };
    rec.onresult = (e: SREvent) => {
      let text = '';
      let isFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        text += r[0].transcript;
        if (r.isFinal) isFinal = true;
      }
      if (text) onResultRef.current?.(text, isFinal);
    };
    recRef.current = rec;
    try { rec.start(); } catch {
      // 已 in-progress / 权限拒绝 — 静默
      setListening(false);
      recRef.current = null;
    }
  }, [lang]);

  // 卸载时停掉
  useEffect(() => {
    return () => { try { recRef.current?.abort(); } catch { /* ignore */ } };
  }, []);

  return { supported, listening, start, stop };
}
