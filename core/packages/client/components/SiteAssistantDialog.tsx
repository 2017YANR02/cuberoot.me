'use client';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import Markdown from 'react-markdown';
import { useCopy } from '@/hooks/useCopy';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, Check, Copy, Pencil, RotateCcw, Maximize2, Minimize2, Search, LoaderCircle, MessageSquarePlus, Mic, Square, X } from 'lucide-react';
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
  draft:string; onDraftChange:(draft:string)=>void;
  onAsk:(question:string,replaceLast?:boolean)=>void; onStop:()=>void; onClose:()=>void; onNew:()=>void;
}
const QUERY_LABELS: Record<string, {zh:string;en:string}> = {
  navigation:{zh:'正在查找功能入口',en:'Finding site tools'},
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
// Solver documents require their own COOP/COEP headers; soft navigation cannot apply them.
function openSolverDocument(event:MouseEvent<HTMLAnchorElement>) {
  if (/^\/(?:zh\/)?scramble\/solver(?:\?|$)/.test(new URL(event.currentTarget.href).pathname) && event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  }
}
export function SiteAssistantAnswerText({result,partial}:{result:AssistantAnswer;partial?:boolean}) {
  const sources=result.sources.filter(source=>/^\/(?!\/)/.test(source.href));
  // Do not flash incomplete citation syntax as provider chunks arrive.
  const text=result.answer.replace(/\[\[[^\]\n]*\]?$/, '').replace(/\[$/, '');
  const withFallback=!partial && !text.includes('[[') && sources.length===1 ? text+`[[${sources[0].id}]]` : text;
  const markdown=withFallback.replace(/\[\[([^\]\n]+)\]\]/g,(_marker,id:string)=>{
    const index=sources.findIndex(source=>source.id===id);
    return index<0 ? '' : `[${index+1}](#assistant-source-${index})`;
  });
  return <div className="site-assistant-prose"><Markdown skipHtml
    allowedElements={['p','strong','em','code','pre','ul','ol','li','blockquote','h1','h2','h3','h4','hr','br','a']}
    components={{a:({href,children})=>{
      const match=/^#assistant-source-(\d+)$/.exec(href ?? '');
      const source=match ? sources[Number(match[1])] : undefined;
      return source ? <Link className="site-assistant-citation" href={source.href} onClick={openSolverDocument} prefetch={false} title={source.title} aria-label={tr({zh:`来源：${source.title}`,en:`Source: ${source.title}`})}>{source.title}</Link> : <>{children}</>;
    }}}>{markdown}</Markdown></div>;

}
function Progress({chart}:{chart:AssistantChart}) {
  // Raw WCA values drive geometry; formatted labels are only for display.
  const points=chart.points.map(p=>({date:p.date,y:chart.event==='333fm' && chart.metric==='single' ? p.value : chart.event==='333mbf' || chart.event==='333mbo' ? p.value : p.value/100,person:p.person,label:p.label}));
  return <section className="site-assistant-chart"><h4>{chart.title}</h4>
    {chart.event!=='333mbf' && chart.event!=='333mbo' && <WrHistoryChart rawPoints={points} />}
    <details><summary>{tr({zh:'查看成绩数据',en:'View result data'})}</summary><div className="site-assistant-table"><table><thead><tr><th>{tr({zh:'日期',en:'Date'})}</th><th>{tr({zh:'成绩',en:'Result'})}</th></tr></thead><tbody>{chart.points.map((p,i)=><tr key={i}><td>{p.date}</td><td>{formatWcaResult(p.value,chart.event,chart.metric)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export default function SiteAssistantDialog({turns,draft,onDraftChange:setDraft,status={phase:'planning'},busy,error,lang,onAsk,onStop,onClose,onNew}:Props) {
  const [expanded,setExpanded]=useState(false);
  const [showLatest,setShowLatest]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const {copy,copiedKey}=useCopy();
  const backdrop=useModalDismiss(onClose);
  const dialog=useRef<HTMLDivElement>(null);
  const messages=useRef<HTMLDivElement>(null);
  const follow=useRef(true);
  const turnCount=useRef(turns.length);
  const input=useRef<HTMLTextAreaElement>(null);
  const editInput=useRef<HTMLTextAreaElement>(null);
  const {listening,error:micError,start,stop}=useSpeechToText({lang:lang==='zh'?'zh-CN':'en-US',onResult:setDraft});
  useEffect(()=>{const previous=document.activeElement as HTMLElement;input.current?.focus();return()=>previous?.focus();},[]);
  useEffect(()=>{
    if(turns.length!==turnCount.current) { follow.current=true; turnCount.current=turns.length; }
    const node=messages.current;
    if(node && follow.current) node.scrollTop=node.scrollHeight;
  },[turns,busy,error,status]);
  useEffect(()=>{
    const node=input.current;
    if(node) { node.style.height='auto'; node.style.height=`${Math.min(node.scrollHeight,180)}px`; }
  },[draft,expanded]);
  const isEditing=editing!==null;
  useEffect(()=>{if(isEditing)editInput.current?.focus();else input.current?.focus();},[isEditing]);
  const scrollLatest=()=>{follow.current=true;setShowLatest(false);const node=messages.current;if(node)node.scrollTop=node.scrollHeight;};
  const copyAnswer=(result:AssistantAnswer,key:string)=>{
    if(!navigator.clipboard)return;
    const text=result.answer.replace(/\[\[([^\]\n]+)\]\]/g,(_marker,id:string)=>{
      const source=result.sources.find(s=>s.id===id && /^\/(?!\/)/.test(s.href));
      return source ? `[${source.title}](${new URL(source.href,window.location.origin).href})` : '';
    });
    const tables=(result.artifacts ?? []).map(a=>a.kind==='table' ? [a.title,a.columns.join('\t'),...a.rows.map(row=>row.join('\t'))].join('\n') : [a.title,...a.points.map(p=>`${p.date}\t${formatWcaResult(p.value,a.event,a.metric)}`)].join('\n'));
    copy([text,...tables].join('\n\n'),key);
  };
  const submit=()=>{if(!busy && editing===null && draft.trim() && draft.trim().length<=500){stop();onAsk(draft.trim());setDraft('');}};
  return createPortal(<div className="site-assistant-backdrop" {...backdrop}>
    <div ref={dialog} className={`site-assistant-dialog${expanded ? ' is-expanded' : ''}`} role="dialog" aria-modal="true" aria-labelledby="site-assistant-title" data-site-surface="panel" onKeyDown={event=>{
      if(event.key!=='Tab')return;
      const focusable=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled),summary');
      if(!focusable?.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }}>
      <header className="site-assistant-header"><div><h2 id="site-assistant-title">{tr({zh:'问 CubeRoot',en:'Ask CubeRoot'})}</h2><p>{tr({zh:'查成绩、找工具、学公式',en:'Results, tools and algorithms'})}</p></div>
        <button className="site-assistant-action" type="button" onClick={()=>{stop();onNew();setEditing(null);setDraft('');input.current?.focus();}} title={tr({zh:'新对话',en:'New conversation'})}><MessageSquarePlus size={20}/></button>
        <button className="site-assistant-action site-assistant-expand" type="button" onClick={()=>setExpanded(value=>!value)} title={tr(expanded?{zh:'退出全屏',en:'Exit full screen'}:{zh:'全屏',en:'Full screen'})}>{expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button>
        <button className="site-assistant-action" type="button" onClick={onClose} title={tr({zh:'关闭',en:'Close'})}><X size={22}/></button>
      </header>
      <div className="site-assistant-body"><div ref={messages} onScroll={()=>{const node=messages.current;if(node){follow.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;setShowLatest(!follow.current);}}} className="site-assistant-messages" role="log" aria-live="polite">
        {!turns.length && <div className="site-assistant-examples"><p>{tr({zh:'你想了解什么？',en:'What would you like to know?'})}</p>{[
          {zh:'三阶魔方世界纪录',en:'Current 3x3 world records'},
          {zh:'看看耿暄一的三阶成绩是怎么进步的',en:'Explore Xuanyi Geng’s progress in 3x3'},
          {zh:'找找接下来在中国举行的比赛',en:'Find upcoming competitions in China'},
          {zh:'怎样在 CubeRoot 练习 PLL 识别？',en:'How can I practise PLL recognition on CubeRoot?'},
          {zh:'我要学习三阶 OLL 和 PLL 公式',en:'I want to learn 3x3 OLL and PLL algorithms'},
          {zh:'我需要一个二阶魔方求解器',en:'I need a 2x2 cube solver'},
          {zh:'群论能怎么解释魔方的转动？',en:'How does group theory explain cube moves?'},
        ].map(example=><button className="site-assistant-action" type="button" key={example.en} onClick={()=>onAsk(tr(example))}>{tr(example)}</button>)}</div>}
        {turns.map((turn,i)=><section className="site-assistant-turn" key={i}>{editing!==null && i===turns.length-1 ? <form className="site-assistant-edit" onSubmit={event=>{event.preventDefault();if(editing.trim()&&!busy){onAsk(editing.trim(),true);setEditing(null);}}}>
          <textarea ref={editInput} className="site-assistant-draft" aria-label={tr({zh:'编辑问题',en:'Edit question'})} value={editing} maxLength={500} rows={3} onChange={event=>setEditing(event.target.value)}/>
          <div className="site-assistant-edit-actions">{editing && <ClearButton onClick={()=>setEditing('')}/>}<button type="button" className="site-assistant-action" onClick={()=>setEditing(null)}>{tr({zh:'取消',en:'Cancel'})}</button><button type="submit" className="site-assistant-action site-assistant-send" disabled={busy||!editing.trim()}>{tr({zh:'发送',en:'Send'})}</button></div>
        </form> : <div className="site-assistant-question"><h3>{turn.question}</h3><div className="site-assistant-question-actions"><button className="site-assistant-action" type="button" onClick={()=>{if(navigator.clipboard)copy(turn.question,`question-${i}`);}} title={tr(copiedKey===`question-${i}`?{zh:'已复制',en:'Copied'}:{zh:'复制问题',en:'Copy question'})}>{copiedKey===`question-${i}`?<Check size={15}/>:<Copy size={15}/>}</button>{i===turns.length-1 && <button className="site-assistant-action" type="button" disabled={busy} onClick={()=>{stop();setEditing(turn.question);}} title={tr({zh:'编辑问题',en:'Edit question'})}><Pencil size={15}/></button>}</div></div>}
          {busy && i===turns.length-1 && <div className="site-assistant-status" role="status"><span className="site-assistant-status-icon" aria-hidden="true">{status.phase==='querying'?<Search size={16}/>:<LoaderCircle size={16}/>}</span><span>{statusLabel(status)}</span><span className="site-assistant-status-dots" aria-hidden="true">···</span></div>}
          {turn.result && <div className="site-assistant-response"><SiteAssistantAnswerText result={turn.result} partial={turn.partial}/>
          {!turn.partial && !!turn.result.actions?.length && <div className="site-assistant-response-actions site-assistant-navigation">{turn.result.actions.filter(action=>/^\/(?!\/)/.test(action.href)).map(action=><Link key={action.id} className="site-assistant-action" href={action.href} onClick={openSolverDocument} prefetch={false}>{tr({zh:`打开 ${action.title}`,en:`Open ${action.title}`})}</Link>)}</div>}
          {turn.result.artifacts?.map((a,j)=>a.kind==='progress'?<Progress key={j} chart={a}/>:<section key={j}><h4>{a.title}</h4><div className="site-assistant-table"><table><thead><tr>{a.columns.map((c,k)=><th key={k}>{c}</th>)}</tr></thead><tbody>{a.rows.map((row,k)=><tr key={k}>{row.map((cell,c)=><td key={c}>{c===0 && a.links?.[k]?.startsWith('/') && !a.links[k].startsWith('//') ? <Link prefetch={false} href={a.links[k]}>{cell}</Link>:cell}</td>)}</tr>)}</tbody></table></div></section>)}
        </div>}
          {turn.result && !(busy && i===turns.length-1) && <div className="site-assistant-response-actions"><button className="site-assistant-action" type="button" onClick={()=>copyAnswer(turn.result!,`answer-${i}`)} title={tr(copiedKey===`answer-${i}`?{zh:'已复制',en:'Copied'}:{zh:'复制回答',en:'Copy answer'})}>{copiedKey===`answer-${i}`?<Check size={16}/>:<Copy size={16}/>}</button>{i===turns.length-1 && !error && <button className="site-assistant-action" type="button" disabled={busy||editing!==null} onClick={()=>onAsk(turn.question,true)} title={tr({zh:'重新生成',en:'Regenerate'})}><RotateCcw size={16}/></button>}<span role="status">{copiedKey===`answer-${i}` && tr({zh:'已复制',en:'Copied'})}</span></div>}
          {turn.partial && !(busy && i===turns.length-1) && <p className="site-assistant-incomplete">{tr({zh:'回答未完成',en:'Answer incomplete'})}</p>}
        </section>)}
        {error && <div role="alert"><p>{tr(ASSISTANT_ERROR_TEXT[error])}</p>{error==='login_required'||error==='wca_link_required' ? <button className="site-assistant-action" type="button" onClick={()=>useAuthStore.getState().login()}>{tr({zh:'前往账号页',en:'Go to account'})}</button> : error==='verification_required' ? <Link href={`/competition-verify?returnTo=${encodeURIComponent(lang==='zh'?'/zh':'/')}`} prefetch={false}>{tr({zh:'完成访问验证',en:'Verify access'})}</Link> : error!=='daily_limit' && error!=='account_forbidden' && turns.length>0 && <button className="site-assistant-action" type="button" disabled={busy||editing!==null} onClick={()=>onAsk(turns[turns.length-1].question,true)}>{tr({zh:'重试',en:'Retry'})}</button>}</div>}
      </div>
      {showLatest && <button className="site-assistant-action site-assistant-latest" type="button" onClick={scrollLatest} title={tr({zh:'回到最新消息',en:'Jump to latest'})}><ArrowDown size={18}/></button>}</div>
      <form className="site-assistant-compose" onSubmit={e=>{e.preventDefault();submit();}}><div className="site-assistant-input">
        <textarea className="site-assistant-draft" ref={input} aria-label={tr({zh:'继续提问',en:'Ask a follow-up'})} placeholder={tr({zh:'随心输入',en:'Type anything'})} maxLength={500} rows={1} disabled={editing!==null} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!window.matchMedia?.('(pointer: coarse)').matches){e.preventDefault();submit();}}}/>
        <div className="site-assistant-input-actions">
          {draft && <ClearButton onClick={()=>setDraft('')}/>}
          <span className="site-assistant-compose-hint">{draft.length>=450?`${draft.length}/500`:tr({zh:'Shift + Enter 换行',en:'Shift + Enter for a new line'})}</span>
          <button className="site-assistant-action site-assistant-mic" type="button" disabled={busy||editing!==null} onClick={()=>listening?stop():void start()} title={tr({zh:'语音输入',en:'Voice input'})} aria-pressed={listening}><Mic size={19}/></button>
          {busy?<button className="site-assistant-action site-assistant-send" type="button" onClick={onStop} title={tr({zh:'停止',en:'Stop'})}><Square size={16}/></button>:<button className="site-assistant-action site-assistant-send" type="submit" disabled={!draft.trim()||draft.trim().length>500||editing!==null} title={tr({zh:'发送',en:'Send'})}><ArrowUp size={20}/></button>}
        </div>
      </div>{micError && <p role="status">{tr({zh:'语音未能识别，请检查麦克风权限，或使用键盘听写。',en:'Voice recognition failed. Check microphone permissions or use keyboard dictation.'})}</p>}
      <p className="site-assistant-note">{tr({zh:'AI 回答可能有误，请核对来源。WCA 数据以最近导入为准。',en:'AI can make mistakes. Check sources. WCA data reflects the latest import.'})}</p></form>
    </div>
  </div>,document.body);
}
