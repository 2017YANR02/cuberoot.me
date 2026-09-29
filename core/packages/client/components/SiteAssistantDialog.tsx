'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Search, LoaderCircle, MessageSquarePlus, Mic, Square, X } from 'lucide-react';
import type { AssistantAnswer, AssistantChart, AssistantStatus, AssistantErrorCode } from '@cuberoot/shared/site-assistant';
import { ASSISTANT_ERROR_TEXT } from '@/lib/site-assistant-errors';
import { useAuthStore } from '@/lib/auth-store';
import { formatWcaResult } from '@/lib/wca-format-result';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { ClearButton } from '@/components/ClearButton';
import Link from '@/components/AppLink';
import WrHistoryChart from '@/components/wca-stats/WrHistoryChart';
import { tr } from '@/i18n/tr';
import './site_assistant.css';

export interface AssistantTurn { question:string; result?:AssistantAnswer; partial?:boolean }
interface Props {
  turns:AssistantTurn[]; status?:AssistantStatus; busy:boolean; error:AssistantErrorCode|null; lang:'zh'|'en';
  onAsk:(question:string)=>void; onStop:()=>void; onClose:()=>void; onNew:()=>void;
}
const QUERY_LABELS: Record<string, {zh:string;en:string}> = {
  pages:{zh:'正在查询站内页面',en:'Searching site pages'},
  records:{zh:'正在查询纪录',en:'Looking up records'},
  find_person:{zh:'正在查找选手',en:'Finding a competitor'},
  person:{zh:'正在读取选手成绩',en:'Reading competitor results'},
  rankings:{zh:'正在查询排名',en:'Looking up rankings'},
  competitions:{zh:'正在查找比赛',en:'Finding competitions'},
  scrambles:{zh:'正在读取比赛打乱',en:'Reading competition scrambles'},
  recons:{zh:'正在查找公开复盘',en:'Finding public reconstructions'},
  recon:{zh:'正在读取复盘步骤',en:'Reading reconstruction steps'},
  glossary:{zh:'正在查询魔方术语',en:'Looking up cubing terms'},
  forum:{zh:'正在查询论坛内容',en:'Searching forum posts'},
  algorithms:{zh:'正在查询公式库',en:'Searching algorithms'},
  statistics:{zh:'正在查询统计数据',en:'Looking up statistics'},
};
function statusLabel(status:AssistantStatus) {
  if(status.phase==='querying') return tr(QUERY_LABELS[status.tool ?? ''] ?? {zh:'正在查询资料',en:'Looking up sources'});
  return tr(status.phase==='writing' ? {zh:'正在生成回答',en:'Writing answer'} : {zh:'正在思考',en:'Thinking'});
}
function AnswerText({result,partial}:{result:AssistantAnswer;partial?:boolean}) {
  const sources=result.sources.filter(source=>/^\/(?!\/)/.test(source.href));
  // Do not flash incomplete citation syntax as provider chunks arrive.
  const text=result.answer.replace(/\[\[[^\]\n]*\]?$/, '').replace(/\[$/, '');
  const parts=text.split(/(\[\[[^\]\n]+\]\]|\*\*[^*]+\*\*)/g);
  const citation=(id:string,key:number)=>{
    const source=sources.find(source=>source.id===id);
    return source ? <Link className="site-assistant-citation" key={key} href={source.href} prefetch={false} title={source.title} aria-label={tr({zh:`来源：${source.title}`,en:`Source: ${source.title}`})}>{source.title}</Link> : null;
  };
  return <p className="site-assistant-prose">{parts.map((part,i)=>part.startsWith('[[')?citation(part.slice(2,-2),i):part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part)}
    {!partial && !text.includes('[[') && sources.length===1 && citation(sources[0].id,parts.length)}
  </p>;
}
function Progress({chart}:{chart:AssistantChart}) {
  // Raw WCA values drive geometry; formatted labels are only for display.
  const points=chart.points.map(p=>({date:p.date,y:chart.event==='333fm' && chart.metric==='single' ? p.value : chart.event==='333mbf' || chart.event==='333mbo' ? p.value : p.value/100,person:p.person,label:p.label}));
  return <section className="site-assistant-chart"><h4>{chart.title}</h4>
    {chart.event!=='333mbf' && chart.event!=='333mbo' && <WrHistoryChart rawPoints={points} />}
    <details><summary>{tr({zh:'查看成绩数据',en:'View result data'})}</summary><div className="site-assistant-table"><table><thead><tr><th>{tr({zh:'日期',en:'Date'})}</th><th>{tr({zh:'成绩',en:'Result'})}</th></tr></thead><tbody>{chart.points.map((p,i)=><tr key={i}><td>{p.date}</td><td>{formatWcaResult(p.value,chart.event,chart.metric)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export default function SiteAssistantDialog({turns,status={phase:'planning'},busy,error,lang,onAsk,onStop,onClose,onNew}:Props) {
  const [draft,setDraft]=useState('');
  const backdrop=useModalDismiss(onClose);
  const dialog=useRef<HTMLDivElement>(null);
  const messages=useRef<HTMLDivElement>(null);
  const follow=useRef(true);
  const turnCount=useRef(turns.length);
  const input=useRef<HTMLTextAreaElement>(null);
  const {listening,error:micError,start,stop}=useSpeechToText({lang:lang==='zh'?'zh-CN':'en-US',onResult:setDraft});
  useEffect(()=>{const previous=document.activeElement as HTMLElement;input.current?.focus();return()=>previous?.focus();},[]);
  useEffect(()=>{
    if(turns.length!==turnCount.current) { follow.current=true; turnCount.current=turns.length; }
    const node=messages.current;
    if(node && follow.current) node.scrollTop=node.scrollHeight;
  },[turns,busy,error,status]);
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
      <div ref={messages} onScroll={()=>{const node=messages.current;if(node)follow.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;}} className="site-assistant-messages" role="log" aria-live="polite" aria-busy={busy}>
        {!turns.length && <div className="site-assistant-examples"><p>{tr({zh:'你想了解什么？',en:'What would you like to know?'})}</p>{[
          {zh:'三阶魔方世界纪录',en:'Current 3x3 world records'},
          {zh:'看看耿暄一的三阶成绩是怎么进步的',en:'Explore Xuanyi Geng’s progress in 3x3'},
          {zh:'找找接下来在中国举行的比赛',en:'Find upcoming competitions in China'},
          {zh:'怎样在 CubeRoot 练习 PLL 识别？',en:'How can I practise PLL recognition on CubeRoot?'},
          {zh:'群论能怎么解释魔方的转动？',en:'How does group theory explain cube moves?'},
        ].map(example=><button className="site-assistant-action" type="button" key={example.en} onClick={()=>onAsk(tr(example))}>{tr(example)}</button>)}</div>}
        {turns.map((turn,i)=><section className="site-assistant-turn" key={i}><h3>{turn.question}</h3>{turn.result && <div className="site-assistant-response"><AnswerText result={turn.result} partial={turn.partial}/>
          {turn.result.artifacts?.map((a,j)=>a.kind==='progress'?<Progress key={j} chart={a}/>:<section key={j}><h4>{a.title}</h4><div className="site-assistant-table"><table><thead><tr>{a.columns.map((c,k)=><th key={k}>{c}</th>)}</tr></thead><tbody>{a.rows.map((row,k)=><tr key={k}>{row.map((cell,c)=><td key={c}>{c===0 && a.links?.[k]?.startsWith('/') && !a.links[k].startsWith('//') ? <Link prefetch={false} href={a.links[k]}>{cell}</Link>:cell}</td>)}</tr>)}</tbody></table></div></section>)}
        </div>}
          {busy && i===turns.length-1 && <div className="site-assistant-status" role="status"><span className="site-assistant-status-icon" aria-hidden="true">{status.phase==='querying'?<Search size={16}/>:<LoaderCircle size={16}/>}</span><span>{statusLabel(status)}</span><span className="site-assistant-status-dots" aria-hidden="true">···</span></div>}
          {turn.partial && !(busy && i===turns.length-1) && <p className="site-assistant-incomplete">{tr({zh:'回答未完成',en:'Answer incomplete'})}</p>}
        </section>)}
        {error && <div role="alert"><p>{tr(ASSISTANT_ERROR_TEXT[error])}</p>{error==='login_required'||error==='wca_link_required' ? <button className="site-assistant-action" type="button" onClick={()=>useAuthStore.getState().login()}>{tr({zh:'前往账号页',en:'Go to account'})}</button> : error==='verification_required' ? <Link href={`/competition-verify?returnTo=${encodeURIComponent(lang==='zh'?'/zh':'/')}`} prefetch={false}>{tr({zh:'完成访问验证',en:'Verify access'})}</Link> : error!=='daily_limit' && error!=='account_forbidden' && turns.length>0 && <button className="site-assistant-action" type="button" onClick={()=>onAsk(turns[turns.length-1].question)}>{tr({zh:'重试',en:'Retry'})}</button>}</div>}
      </div>
      <form className="site-assistant-compose" onSubmit={e=>{e.preventDefault();submit();}}><div className="site-assistant-input">
        <textarea className="site-assistant-draft" ref={input} aria-label={tr({zh:'继续提问',en:'Ask a follow-up'})} placeholder={tr({zh:'随心输入',en:'Type anything'})} maxLength={500} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}}/>
        <div className="site-assistant-input-actions">
          {draft && <ClearButton onClick={()=>setDraft('')}/>}
          <button className="site-assistant-action site-assistant-mic" type="button" disabled={busy} onClick={()=>listening?stop():void start()} title={tr({zh:'语音输入',en:'Voice input'})} aria-pressed={listening}><Mic size={19}/></button>
          {busy?<button className="site-assistant-action site-assistant-send" type="button" onClick={onStop} title={tr({zh:'停止',en:'Stop'})}><Square size={16}/></button>:<button className="site-assistant-action site-assistant-send" type="submit" disabled={!draft.trim()} title={tr({zh:'发送',en:'Send'})}><ArrowUp size={20}/></button>}
        </div>
      </div>{micError && <p role="status">{tr({zh:'语音未能识别，请检查麦克风权限，或使用键盘听写。',en:'Voice recognition failed. Check microphone permissions or use keyboard dictation.'})}</p>}
      <p className="site-assistant-note">{tr({zh:'登录并绑定 WCA 账号后可提问。回答附有来源；WCA 数据以最近一次导入为准。',en:'Sign in and link WCA to ask. Answers include sources; WCA data reflects the latest import.'})}</p></form>
    </div>
  </div>,document.body);
}
