'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, BookOpen, MessageSquarePlus, Mic, Square, X } from 'lucide-react';
import type { AssistantAnswer, AssistantChart } from '@cuberoot/shared/site-assistant';
import { formatWcaResult } from '@/lib/wca-format-result';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { ClearButton } from '@/components/ClearButton';
import Link from '@/components/AppLink';
import WrHistoryChart from '@/components/wca-stats/WrHistoryChart';
import { tr } from '@/i18n/tr';
import './site_assistant.css';

export interface AssistantTurn { question:string; result?:AssistantAnswer }
interface Props {
  turns:AssistantTurn[]; busy:boolean; error:'daily_limit'|'unavailable'|null; lang:'zh'|'en';
  onAsk:(question:string)=>void; onStop:()=>void; onClose:()=>void; onNew:()=>void;
}
function Progress({chart}:{chart:AssistantChart}) {
  // Raw WCA values drive geometry; formatted labels are only for display.
  const points=chart.points.map(p=>({date:p.date,y:chart.event==='333fm' && chart.metric==='single' ? p.value : chart.event==='333mbf' || chart.event==='333mbo' ? p.value : p.value/100,person:p.person,label:p.label}));
  return <section className="site-assistant-chart"><h4>{chart.title}</h4>
    {chart.event!=='333mbf' && chart.event!=='333mbo' && <WrHistoryChart rawPoints={points} />}
    <details><summary>{tr({zh:'查看成绩数据',en:'View result data'})}</summary><div className="site-assistant-table"><table><thead><tr><th>{tr({zh:'日期',en:'Date'})}</th><th>{tr({zh:'成绩',en:'Result'})}</th></tr></thead><tbody>{chart.points.map((p,i)=><tr key={i}><td>{p.date}</td><td>{formatWcaResult(p.value,chart.event,chart.metric)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export default function SiteAssistantDialog({turns,busy,error,lang,onAsk,onStop,onClose,onNew}:Props) {
  const [draft,setDraft]=useState('');
  const backdrop=useModalDismiss(onClose);
  const dialog=useRef<HTMLDivElement>(null);
  const tail=useRef<HTMLDivElement>(null);
  const input=useRef<HTMLTextAreaElement>(null);
  const {listening,error:micError,start,stop}=useSpeechToText({lang:lang==='zh'?'zh-CN':'en-US',onResult:setDraft});
  useEffect(()=>{const previous=document.activeElement as HTMLElement;input.current?.focus();return()=>previous?.focus();},[]);
  useEffect(()=>{
    if (busy || error) tail.current?.scrollIntoView?.({block:'nearest'});
    else { const rows=dialog.current?.querySelectorAll('.site-assistant-turn'); rows?.[rows.length-1]?.scrollIntoView?.({block:'start'}); }
  },[turns,busy,error]);
  const submit=()=>{if(!busy && draft.trim()){stop();onAsk(draft.trim());setDraft('');}};
  return createPortal(<div className="site-assistant-backdrop" {...backdrop}>
    <div ref={dialog} className="site-assistant-dialog" role="dialog" aria-modal="true" aria-labelledby="site-assistant-title" data-site-surface="panel" onKeyDown={event=>{
      if(event.key!=='Tab')return;
      const focusable=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea,summary');
      if(!focusable?.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }}>
      <header className="site-assistant-header"><div><h2 id="site-assistant-title">{tr({zh:'问 CubeRoot',en:'Ask CubeRoot'})}</h2><p>{tr({zh:'查成绩、找比赛、学魔方',en:'Results, competitions and cubing knowledge'})}</p></div>
        <button className="site-assistant-action" type="button" onClick={()=>{stop();onNew();setDraft('');input.current?.focus();}} title={tr({zh:'新对话',en:'New conversation'})}><MessageSquarePlus size={20}/></button>
        <button className="site-assistant-action" type="button" onClick={onClose} title={tr({zh:'关闭',en:'Close'})}><X size={22}/></button>
      </header>
      <div className="site-assistant-messages" role="log" aria-live="polite" aria-busy={busy}>
        {!turns.length && <div className="site-assistant-examples"><p>{tr({zh:'你想了解什么？',en:'What would you like to know?'})}</p>{[
          {zh:'三阶魔方世界纪录',en:'Current 3x3 world records'},
          {zh:'看看耿暄一的三阶成绩是怎么进步的',en:'Explore Xuanyi Geng’s progress in 3x3'},
          {zh:'找找接下来在中国举行的比赛',en:'Find upcoming competitions in China'},
          {zh:'怎样在 CubeRoot 练习 PLL 识别？',en:'How can I practise PLL recognition on CubeRoot?'},
          {zh:'群论能怎么解释魔方的转动？',en:'How does group theory explain cube moves?'},
        ].map(example=><button className="site-assistant-action" type="button" key={example.en} onClick={()=>onAsk(tr(example))}>{tr(example)}</button>)}</div>}
        {turns.map((turn,i)=><section className="site-assistant-turn" key={i}><h3>{turn.question}</h3>{turn.result && <div className="site-assistant-response"><p className="site-assistant-prose">{turn.result.answer.split(/(\*\*[^*]+\*\*)/g).map((text,k)=>text.startsWith('**')?<strong key={k}>{text.slice(2,-2)}</strong>:text)}</p>
          {turn.result.artifacts?.map((a,j)=>a.kind==='progress'?<Progress key={j} chart={a}/>:<section key={j}><h4>{a.title}</h4><div className="site-assistant-table"><table><thead><tr>{a.columns.map((c,k)=><th key={k}>{c}</th>)}</tr></thead><tbody>{a.rows.map((row,k)=><tr key={k}>{row.map((cell,c)=><td key={c}>{c===0 && a.links?.[k]?.startsWith('/') && !a.links[k].startsWith('//') ? <Link prefetch={false} href={a.links[k]}>{cell}</Link>:cell}</td>)}</tr>)}</tbody></table></div></section>)}
          <div className="site-assistant-sources">{turn.result.sources.filter(s=>/^\/(?!\/)/.test(s.href)).map(s=><Link href={s.href} key={s.id} prefetch={false}><BookOpen size={14}/>{s.title}</Link>)}</div>
        </div>}</section>)}
        {busy && <p className="site-assistant-status">{tr({zh:'正在查询资料和成绩…',en:'Looking up results and sources…'})}</p>}
        {error && <div role="alert"><p>{error==='daily_limit'?tr({zh:'全站今日 100 次提问额度已用完，北京时间零点恢复。你仍可使用下方搜索结果。',en:'The site’s daily allowance of 100 questions has been used. It resets at midnight Beijing time (UTC+8). You can still use the search results below.'}):tr({zh:'暂时无法回答，请重试或使用下方搜索结果。',en:'An answer is unavailable. Retry or use the search results below.'})}</p>{error!=='daily_limit' && turns.length>0 && <button className="site-assistant-action" type="button" onClick={()=>onAsk(turns[turns.length-1].question)}>{tr({zh:'重试',en:'Retry'})}</button>}</div>}
        <div ref={tail}/>
      </div>
      <form className="site-assistant-compose" onSubmit={e=>{e.preventDefault();submit();}}><div className="site-assistant-input">
        <textarea className="site-assistant-draft" ref={input} aria-label={tr({zh:'继续提问',en:'Ask a follow-up'})} placeholder={tr({zh:'继续问，或换一个话题…',en:'Ask a follow-up or start another topic…'})} maxLength={500} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}}/>
        {draft && <ClearButton onClick={()=>setDraft('')}/>}
        <button className="site-assistant-action" type="button" disabled={busy} onClick={()=>listening?stop():void start()} title={tr({zh:'语音输入',en:'Voice input'})} aria-pressed={listening}><Mic size={19}/></button>
        {busy?<button className="site-assistant-action" type="button" onClick={onStop} title={tr({zh:'停止',en:'Stop'})}><Square size={18}/></button>:<button className="site-assistant-action" type="submit" disabled={!draft.trim()} title={tr({zh:'发送',en:'Send'})}><ArrowUp size={20}/></button>}
      </div>{micError && <p role="status">{tr({zh:'语音未能识别，请检查麦克风权限，或使用键盘听写。',en:'Voice recognition failed. Check microphone permissions or use keyboard dictation.'})}</p>}
      <p className="site-assistant-note">{tr({zh:'回答附有来源；WCA 数据以最近一次导入为准。',en:'Answers include sources. WCA data reflects the latest import.'})}</p></form>
    </div>
  </div>,document.body);
}
