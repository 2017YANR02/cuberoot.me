'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { CopySuccessIcon } from '@/components/CopySuccessIcon';
import { Copy, ThumbsUp, ThumbsDown, Volume2, Square, Share, RefreshCw, Ellipsis, GitBranch, ChevronRight, FileText, Quote, SlidersHorizontal } from '@app-foundation/icons/lucide';
import { CompactSelect } from '@/components/CompactSelect';
import { Tooltip } from '@/components/Tooltip';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { sendAssistantEvent, type AssistantFeedback } from '@/lib/site-assistant-request';
import { assistantAnswerText, assistantSpokenText, downloadAssistantPdf } from '@/lib/assistant-answer-export';
import type { AssistantTurn } from './SiteAssistantDialog';
import { playAssistantSpeech } from '@/lib/assistant-speech';
import { getSpeechPreferences, getServerSpeechPreferences, subscribeSpeechPreferences, setSpeechPreferences, loadSpeechVoices, speechRates, type SpeechVoiceOptions } from '@/lib/assistant-speech-preferences';

const AssistantShareDialog = dynamic(() => import('./AssistantShareDialog').then(module => module.AssistantShareDialog), { ssr: false });

function Action({ label, children, onClick, disabled, pressed }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return <Tooltip content={label}>{tip => <button {...tip} type="button" className="site-assistant-action" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>{children}</button>}</Tooltip>;
}

export default function AssistantAnswerActions({ turn, lang, active, onRetry, onBranch, onQuote, onFeedback, preview }: {
  turn: AssistantTurn; lang: 'zh' | 'en'; active: boolean; onRetry?: () => void; onBranch?: () => void; onQuote?: () => void;
  onFeedback: (id: string, value: AssistantFeedback | null) => void; preview: ReactNode;
}) {
  const { copied, copy } = useCopy();
  const [feedback, setFeedback] = useState(turn.feedback ?? null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);
  const [speechFallback, setSpeechFallback] = useState(false);
  const speechController = useRef<AbortController | null>(null);
  const speechPreferences = useSyncExternalStore(subscribeSpeechPreferences, getSpeechPreferences, getServerSpeechPreferences);
  const [voiceOptions, setVoiceOptions] = useState<SpeechVoiceOptions | null>(null);
  const [voiceError, setVoiceError] = useState(false);
  const refreshVoices = () => { setVoiceError(false); void loadSpeechVoices().then(setVoiceOptions, () => setVoiceError(true)); };
  const [shareOpen, setShareOpen] = useState(false);
  const [shared, setShared] = useState<{result: AssistantTurn['result']; id: string} | null>(null);
  const shareId = shared && shared.result === turn.result ? shared.id : null;
  const [pdfBusy, setPdfBusy] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const speechJob = useRef(0);
  const stop = () => {
    speechJob.current++;
    speechController.current?.abort(); speechController.current = null; setSpeechLoading(false);
    if (utterance.current && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    utterance.current = null; setSpeaking(false);
  };
  useEffect(() => { if (!active) { stop(); setShareOpen(false); } }, [active]);
  useEffect(() => {
    const cancel = () => stop();
    window.addEventListener('assistant-speech-start', cancel);
    return () => { window.removeEventListener('assistant-speech-start', cancel); speechJob.current++; speechController.current?.abort(); if (utterance.current && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, []);
  useEffect(() => { stop(); setSpeechFallback(false); }, [turn.result, turn.messageId]);
  useEffect(() => { stop(); }, [speechPreferences.voice]);
  // System speech cannot change an utterance's rate after it starts.
  useEffect(() => { if (utterance.current) stop(); }, [speechPreferences.rate]);
  const exportText = () => assistantAnswerText(turn.result!, window.location.origin);
  const readBrowser = () => {
    if (speaking) { stop(); return; }
    window.dispatchEvent(new Event('assistant-speech-start'));
    setFailure(''); setSpeechFallback(false);
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setFailure(tr({ zh: '此浏览器暂不支持朗读。', en: 'Read aloud is unavailable in this browser.' })); return;
    }
    window.speechSynthesis.cancel();
    const job = ++speechJob.current;
    const chunks = assistantSpokenText(exportText()).match(/[\s\S]{1,180}(?:[。！？.!?\s]|$)|[\s\S]{1,180}/g) ?? [];
    const next = (index: number) => {
      if (speechJob.current !== job) return;
      if (index >= chunks.length) { utterance.current = null; setSpeaking(false); return; }
      const item = new SpeechSynthesisUtterance(chunks[index]);
      item.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
      item.rate = getSpeechPreferences().rate;
      item.onend = () => next(index + 1);
      item.onerror = event => { if (speechJob.current !== job) return; utterance.current = null; setSpeaking(false); if (event.error !== 'canceled' && event.error !== 'interrupted') setFailure(tr({ zh: '朗读失败，请重试。', en: 'Read aloud failed. Please retry.' })); };
      utterance.current = item; window.speechSynthesis.speak(item);
    };
    setSpeaking(true); next(0);
  };
  const read = async () => {
    if (speaking) { stop(); return; }
    window.dispatchEvent(new Event('assistant-speech-start'));
    setFailure(''); setSpeechFallback(false);
    const controller = new AbortController(); speechController.current = controller;
    setSpeaking(true); setSpeechLoading(true);
    const validId = (id?: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
    try {
      const preferences = getSpeechPreferences();
      const voices = preferences.voice ? await loadSpeechVoices() : null;
      controller.signal.throwIfAborted();
      const voice = voices?.voices.some(item => item.id === preferences.voice) ? preferences.voice : undefined;
      await playAssistantSpeech({ messageId: validId(turn.messageId), requestId: validId(turn.requestId), answer: assistantSpokenText(exportText()), lang, voice }, controller.signal, () => setSpeechLoading(false));
    } catch {
      if (!controller.signal.aborted) {
        setFailure(tr({ zh: '语音合成暂不可用，可使用浏览器朗读。', en: 'Voice generation is unavailable. You can use browser read aloud.' }));
        setSpeechFallback(true);
      }
    } finally {
      if (speechController.current === controller) { speechController.current = null; setSpeaking(false); setSpeechLoading(false); }
    }
  };
  const saveFeedback = async (next: AssistantFeedback) => {
    if (!turn.requestId || pending) return;
    const value = feedback === next ? null : next;
    setPending(true); setFailure('');
    try { await sendAssistantEvent(turn.requestId, { type: 'feedback', value }); setFeedback(value); onFeedback(turn.requestId, value); }
    catch { setFailure(tr({ zh: '反馈未保存，请重试。', en: 'Feedback was not saved. Please retry.' })); }
    finally { setPending(false); }
  };
  const pdf = async () => {
    setPdfBusy(true); setFailure('');
    try { await downloadAssistantPdf(turn.question, turn.result!, lang, turn.createdAt); }
    catch { setFailure(tr({ zh: 'PDF 导出失败，请重试。', en: 'PDF export failed. Please retry.' })); }
    finally { setPdfBusy(false); }
  };
  const timestamp = turn.createdAt ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(turn.createdAt) : null;
  return <>
    <div className="site-assistant-response-actions assistant-answer-toolbar">
      {onQuote && <Action label={tr({zh:'引用回答',en:'Quote answer'})} onClick={onQuote}><Quote size={18}/></Action>}
      <Action label={tr(copied ? { zh: '已复制', en: 'Copied' } : { zh: '复制', en: 'Copy' })} onClick={() => copy(exportText())}>{copied ? <CopySuccessIcon size={18} /> : <Copy size={18}/>}</Action>
      {turn.requestId && !turn.partial && <CompactSelect side="top" unstyledTrigger triggerClassName="site-assistant-action" popupClassName="assistant-action-menu" className="assistant-toolbar-menu" ariaLabel={tr({ zh: '评价回答', en: 'Rate response' })} label={feedback ? feedback === 'helpful' ? <ThumbsUp size={18}/> : <ThumbsDown size={18}/> : <span className="assistant-feedback-symbol"><ThumbsUp size={12}/><ThumbsDown size={12}/></span>} disabled={pending} value={feedback === 'helpful' ? 'helpful' : feedback ? 'other' : undefined} onChange={value => void saveFeedback(value)} items={[
        { value: 'helpful' as const, label: <span className="assistant-menu-label"><ThumbsUp size={19}/>{tr({ zh: '回复优秀', en: 'Good response' })}</span> },
        { value: 'other' as const, label: <span className="assistant-menu-label"><ThumbsDown size={19}/>{tr({ zh: '回复不佳', en: 'Bad response' })}</span> },
      ]}/>}
      <Action label={tr(speaking ? { zh: '停止朗读', en: 'Stop reading' } : { zh: '朗读', en: 'Read aloud' })} onClick={() => void read()} pressed={speaking}>{speaking ? <Square size={16} fill="currentColor"/> : <Volume2 size={19}/>}</Action>
      <CompactSelect side="top" unstyledTrigger triggerClassName="site-assistant-action" popupClassName="assistant-action-menu" className="assistant-toolbar-menu" ariaLabel={tr({ zh: '选择音色', en: 'Choose voice' })} label={<SlidersHorizontal size={17}/>} onOpenChange={open => { if (open) refreshVoices(); }} value={voiceOptions?.voices.some(item => item.id === speechPreferences.voice) ? speechPreferences.voice : ''} items={voiceError ? [{ value: '__retry', label: tr({ zh: '加载失败，重试', en: 'Loading failed. Retry' }) }] : voiceOptions ? [
        { value: '', label: tr({ zh: '默认音色', en: 'Default voice' }) },
        ...voiceOptions.voices.map(voice => ({ value: voice.id, label: tr(voice.name) })),
      ] : [{ value: '__loading', label: tr({ zh: '正在加载…', en: 'Loading…' }), disabled: true }]} onChange={voice => { if (voice === '__retry') refreshVoices(); else setSpeechPreferences({ voice }); }}/>
      <CompactSelect side="top" unstyledTrigger triggerClassName="site-assistant-action" popupClassName="assistant-action-menu" className="assistant-toolbar-menu" ariaLabel={tr({ zh: '选择语速', en: 'Choose speed' })} label={<span style={{ fontSize: 12 }}>{speechPreferences.rate}×</span>} value={speechPreferences.rate} items={speechRates.map(rate => ({ value: rate, label: `${rate}×` }))} onChange={rate => setSpeechPreferences({ rate })}/>
      {!turn.partial && <Action label={tr({ zh: '分享', en: 'Share' })} pressed={shareOpen} onClick={() => setShareOpen(true)}><Share size={18}/></Action>}
      {onRetry && <Action label={tr({ zh: '重试', en: 'Retry' })} onClick={() => { stop(); onRetry(); }}><RefreshCw size={18}/></Action>}
      {(timestamp || onBranch) && <CompactSelect side="top" unstyledTrigger triggerClassName="site-assistant-action" popupClassName="assistant-action-menu" className="assistant-toolbar-menu" ariaLabel={tr({ zh: '更多', en: 'More' })} label={<Ellipsis size={20}/>} items={[
        ...(timestamp ? [{ value: 'time', disabled: true, label: <span className="assistant-menu-time">{timestamp}</span> }] : []),
        ...(onBranch ? [{ value: 'branch', label: <span className="assistant-menu-label"><GitBranch size={18}/>{tr({ zh: '创建对话分支', en: 'Branch in new chat' })}<ChevronRight size={16}/></span> }] : []),
      ]} onChange={value => { if (value === 'branch') { stop(); onBranch?.(); } }}/>}
      <span className="assistant-toolbar-divider" aria-hidden="true"/>
      <Tooltip content={tr({ zh: '转换为 PDF', en: 'Export as PDF' })}>{tip => <button {...tip} className="site-assistant-action assistant-pdf-action" aria-label={tr({ zh: '转换为 PDF', en: 'Export as PDF' })} type="button" disabled={pdfBusy} onClick={() => void pdf()}><FileText size={18}/><span>PDF</span></button>}</Tooltip>
    </div>
    {speechLoading && <div className="site-assistant-progress-heading" role="status">{tr({ zh: '正在生成语音…', en: 'Generating audio…' })}</div>}
    {speechFallback && <button type="button" className="site-assistant-action" onClick={readBrowser}>{tr({ zh: '使用浏览器朗读', en: 'Use browser read aloud' })}</button>}
    {failure && <p className="site-assistant-voice-error" role="status">{failure}</p>}
    {shareOpen && <AssistantShareDialog turn={turn} lang={lang} preview={preview} text={exportText()} shareId={shareId} onShareId={id=>setShared(id ? {result:turn.result,id} : null)} onClose={() => setShareOpen(false)}/>}
  </>;
}
