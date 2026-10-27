'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, ThumbsUp, ThumbsDown, Volume2, Square, Share, RefreshCw, Ellipsis, GitBranch, ChevronRight, FileText } from '@app-foundation/icons/lucide';
import { CompactSelect } from '@/components/CompactSelect';
import { Tooltip } from '@/components/Tooltip';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { sendAssistantEvent, type AssistantFeedback } from '@/lib/site-assistant-request';
import { assistantAnswerText, assistantSpokenText, downloadAssistantPdf } from '@/lib/assistant-answer-export';
import type { AssistantTurn } from './SiteAssistantDialog';
import { AssistantShareDialog } from './AssistantShareDialog';

function Action({ label, children, onClick, disabled, pressed }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return <Tooltip content={label}>{tip => <button {...tip} type="button" className="site-assistant-action" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>{children}</button>}</Tooltip>;
}

export default function AssistantAnswerActions({ turn, lang, active, onRetry, onBranch, onFeedback, preview }: {
  turn: AssistantTurn; lang: 'zh' | 'en'; active: boolean; onRetry?: () => void; onBranch?: () => void;
  onFeedback: (id: string, value: AssistantFeedback | null) => void; preview: ReactNode;
}) {
  const { copied, copy } = useCopy();
  const [feedback, setFeedback] = useState(turn.feedback ?? null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const speechJob = useRef(0);
  const stop = () => {
    speechJob.current++;
    if (utterance.current && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    utterance.current = null; setSpeaking(false);
  };
  useEffect(() => { if (!active) { stop(); setShareOpen(false); } }, [active]);
  useEffect(() => () => { speechJob.current++; if (utterance.current && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  const exportText = () => assistantAnswerText(turn.result!, window.location.origin);
  const read = () => {
    if (speaking) { stop(); return; }
    setFailure('');
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
      item.onend = () => next(index + 1);
      item.onerror = event => { if (speechJob.current !== job) return; utterance.current = null; setSpeaking(false); if (event.error !== 'canceled' && event.error !== 'interrupted') setFailure(tr({ zh: '朗读失败，请重试。', en: 'Read aloud failed. Please retry.' })); };
      utterance.current = item; window.speechSynthesis.speak(item);
    };
    setSpeaking(true); next(0);
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
    try { await downloadAssistantPdf(turn.question, exportText()); }
    catch { setFailure(tr({ zh: 'PDF 导出失败，请重试。', en: 'PDF export failed. Please retry.' })); }
    finally { setPdfBusy(false); }
  };
  const timestamp = turn.createdAt ? new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(turn.createdAt) : null;
  return <>
    <div className="site-assistant-response-actions assistant-answer-toolbar">
      <Action label={tr(copied ? { zh: '已复制', en: 'Copied' } : { zh: '复制', en: 'Copy' })} onClick={() => copy(exportText())}>{copied ? <Check size={18}/> : <Copy size={18}/>}</Action>
      {turn.requestId && !turn.partial && <CompactSelect side="top" unstyledTrigger triggerClassName="site-assistant-action" popupClassName="assistant-action-menu" className="assistant-toolbar-menu" ariaLabel={tr({ zh: '评价回答', en: 'Rate response' })} label={feedback ? feedback === 'helpful' ? <ThumbsUp size={18}/> : <ThumbsDown size={18}/> : <span className="assistant-feedback-symbol"><ThumbsUp size={12}/><ThumbsDown size={12}/></span>} disabled={pending} value={feedback === 'helpful' ? 'helpful' : feedback ? 'other' : undefined} onChange={value => void saveFeedback(value)} items={[
        { value: 'helpful' as const, label: <span className="assistant-menu-label"><ThumbsUp size={19}/>{tr({ zh: '回复优秀', en: 'Good response' })}</span> },
        { value: 'other' as const, label: <span className="assistant-menu-label"><ThumbsDown size={19}/>{tr({ zh: '回复不佳', en: 'Bad response' })}</span> },
      ]}/>}
      <Action label={tr(speaking ? { zh: '停止朗读', en: 'Stop reading' } : { zh: '朗读', en: 'Read aloud' })} onClick={read} pressed={speaking}>{speaking ? <Square size={16} fill="currentColor"/> : <Volume2 size={19}/>}</Action>
      {!turn.partial && <Action label={tr({ zh: '分享', en: 'Share' })} onClick={() => setShareOpen(true)}><Share size={18}/></Action>}
      {onRetry && <Action label={tr({ zh: '重试', en: 'Retry' })} onClick={() => { stop(); onRetry(); }}><RefreshCw size={18}/></Action>}
      {(timestamp || onBranch) && <CompactSelect side="top" unstyledTrigger triggerClassName="site-assistant-action" popupClassName="assistant-action-menu" className="assistant-toolbar-menu" ariaLabel={tr({ zh: '更多', en: 'More' })} label={<Ellipsis size={20}/>} items={[
        ...(timestamp ? [{ value: 'time', disabled: true, label: <span className="assistant-menu-time">{timestamp}</span> }] : []),
        ...(onBranch ? [{ value: 'branch', label: <span className="assistant-menu-label"><GitBranch size={18}/>{tr({ zh: '创建对话分支', en: 'Branch in new chat' })}<ChevronRight size={16}/></span> }] : []),
      ]} onChange={value => { if (value === 'branch') { stop(); onBranch?.(); } }}/>}
      <span className="assistant-toolbar-divider" aria-hidden="true"/>
      <Tooltip content={tr({ zh: '转换为 PDF', en: 'Export as PDF' })}>{tip => <button {...tip} className="site-assistant-action assistant-pdf-action" aria-label={tr({ zh: '转换为 PDF', en: 'Export as PDF' })} type="button" disabled={pdfBusy} onClick={() => void pdf()}><FileText size={18}/><span>{tr({ zh: '转换为 PDF', en: 'Export as PDF' })}</span></button>}</Tooltip>
    </div>
    {failure && <p className="site-assistant-voice-error" role="status">{failure}</p>}
    {shareOpen && <AssistantShareDialog turn={turn} lang={lang} preview={preview} text={exportText()} shareId={shareId} onShareId={setShareId} onClose={() => setShareOpen(false)}/>}
  </>;
}
