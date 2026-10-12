'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
const Markdown = lazy(() => import('react-markdown').catch(() => ({ default: ({ children }: { children?: string | null }) => <>{children}</> })));
const WrHistoryChart = lazy(() => import('@/components/wca-stats/WrHistoryChart').catch(() => ({ default: () => null })));
import { useCopy } from '@/hooks/useCopy';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, Check, Copy, Pencil, RotateCcw, Maximize2, Minimize2, Search, LoaderCircle, MessageSquarePlus, ImagePlus, Mic, Square, X } from 'lucide-react';
import { SITE_ASSISTANT_MAX_IMAGES, type AssistantImage, type AssistantAnswer, type AssistantChart, type AssistantStatus, type AssistantErrorCode } from '@cuberoot/shared/site-assistant';
import { ASSISTANT_ERROR_TEXT } from '@/lib/site-assistant-errors';
import { useAuthStore } from '@/lib/auth-store';
import { formatWcaResult } from '@/lib/wca-format-result';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { Tooltip } from '@/components/Tooltip';
import { prepareAssistantImage } from '@/lib/site-assistant-images';
import { ClearButton } from '@/components/ClearButton';
import Link from '@/components/AppLink';
import { Flag } from '@/components/Flag';
import { CompCell } from '@/components/CompCell/CompCell';
import { loadFlagData } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { tr } from '@/i18n/tr';
import './site_assistant.css';

export interface AssistantTurn { question:string; images?:AssistantImage[]; imagesExpired?:boolean; result?:AssistantAnswer; partial?:boolean }
interface Props {
  turns:AssistantTurn[]; status?:AssistantStatus; busy:boolean; error:AssistantErrorCode|null; lang:'zh'|'en';
  images:AssistantImage[]; onImagesChange:(images:AssistantImage[])=>void;
  draft:string; onDraftChange:(draft:string)=>void;
  onAsk:(question:string,replaceLast?:boolean,images?:AssistantImage[])=>void; onStop:()=>void; onClose:()=>void; onNew:()=>void;
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
const QUESTION_EXAMPLES = [
  {id:'learn-algorithms',title:{zh:'学习公式',en:'Learn algorithms'},questions:[
    {zh:'我想学 CFOP 公式，帮我找到对应页面。',en:'I want to learn CFOP algorithms. Show me the relevant pages.'},
    {zh:'我想学 F2L，打开三阶 F2L 公式库。',en:'I want to learn F2L. Show me the 3x3 F2L library.'},
    {zh:'我想学习完整的 OLL 公式。',en:'I want to learn the full OLL algorithm set.'},
    {zh:'我想学习完整的 PLL 公式。',en:'I want to learn the full PLL algorithm set.'},
    {zh:'先学简单一点的，帮我找到 2 步 OLL 和 2 步 PLL。',en:'Start with something simpler. Show me 2-look OLL and 2-look PLL.'},
    {zh:'我想学桥式的 CMLL 公式。',en:'I want to learn CMLL algorithms for Roux.'},
  ]},
  {id:'practice',title:{zh:'专项训练',en:'Targeted practice'},questions:[
    {zh:'我想练习 PLL 公式，带我去选择训练情况。',en:'I want to practise PLL algorithms. Take me to case selection.'},
    {zh:'我想练习 OLL 公式，打开对应训练页面。',en:'I want to practise OLL algorithms. Show me the trainer.'},
    {zh:'我想练习 PLL 识别，打开识别训练。',en:'I want to practise PLL recognition. Show me the recognition trainer.'},
    {zh:'我想练习 ZBLL，打开训练页面。',en:'I want to practise ZBLL. Show me the trainer.'},
    {zh:'我想练习十字最优解，去哪里训练？',en:'I want to practise optimal cross solutions. Where is the trainer?'},
    {zh:'我想练习桥式，帮我打开对应训练器。',en:'I want to practise Roux. Show me the trainer.'},
  ]},
  {id:'tools',title:{zh:'用好网站',en:'Using CubeRoot'},questions:[
    {zh:'计时器的普通计时和公式训练有什么区别？',en:'What is the difference between normal timing and algorithm training?'},
    {zh:'怎样只练习我选中的 PLL 情况？',en:'How can I practise only the PLL cases I select?'},
    {zh:'在哪里可以给复盘视频数帧？',en:'Where can I count frames in a solve video?'},
    {zh:'帮我找到二阶魔方求解器。',en:'Help me find the 2x2 cube solver.'},
  ]},
  {id:'learning',title:{zh:'学公式与原理',en:'Algorithms and concepts'},questions:[
    {zh:'OLL 和 PLL 分别解决什么问题？',en:'What do OLL and PLL each solve?'},
    {zh:'换位子和共轭子有什么区别？',en:'What is the difference between a commutator and a conjugate?'},
    {zh:'群论能怎么解释魔方的转动？',en:'How does group theory explain cube moves?'},
    {zh:'网站有哪些三阶魔方公式集？',en:'Which 3x3 algorithm sets are available on CubeRoot?'},
  ]},
  {id:'rules',title:{zh:'了解比赛规则',en:'Competition rules'},questions:[
    {zh:'WCA 比赛观察时间超过 15 秒会怎样？',en:'What happens if inspection exceeds 15 seconds in a WCA competition?'},
    {zh:'+2 和 DNF 分别在什么情况下判罚？',en:'When does a solve receive a +2 penalty or a DNF?'},
    {zh:'三阶平均成绩怎样计算，DNF 怎样处理？',en:'How is a 3x3 average calculated, and how are DNFs handled?'},
    {zh:'停表后魔方还差一点没对齐，规则怎么判？',en:'How do the rules handle a cube that is slightly misaligned when the timer stops?'},
  ]},
  {id:'results',title:{zh:'查成绩与比赛',en:'Results and competitions'},questions:[
    {zh:'我今年参加了多少场 WCA 比赛？',en:'How many WCA competitions have I competed in this year?'},
    {zh:'看看耿暄一的三阶成绩是怎么进步的。',en:'Show me Xuanyi Geng’s progress in 3x3.'},
    {zh:'找找接下来在中国举行的比赛。',en:'Find upcoming competitions in China.'},
    {zh:'目前三阶魔方的单次和平均世界纪录是多少？',en:'What are the current 3x3 single and average world records?'},
  ]},
  {id:'analysis',title:{zh:'按条件做统计',en:'Custom statistics'},questions:[
    {zh:'把我去年的参赛次数按月份统计。',en:'Break down my competition count last year by month.'},
    {zh:'我去年和前年的参赛次数相差多少？',en:'How did my competition count change between last year and the year before?'},
    {zh:'我去年三阶比赛中每次还原的 DNF 比例是多少？',en:'What percentage of my 3x3 attempts last year were DNFs?'},
    {zh:'我去年在哪些国家或地区参加过比赛？分别多少场？',en:'Which countries or regions did I compete in last year, and how many competitions in each?'},
  ]},
  {id:'images',title:{zh:'看图与复盘',en:'Images and reconstructions'},note:{zh:'图片问题请先添加图片。',en:'For image questions, attach an image first.'},questions:[
    {zh:'帮我读出这张成绩截图里的项目和成绩。',en:'Read the events and results in this screenshot.'},
    {zh:'识别图片里的公式，保留原始转动符号。',en:'Read the algorithm in this image, preserving the original move notation.'},
    {zh:'解释这张统计图的坐标轴和变化趋势。',en:'Explain the axes and trends in this chart.'},
    {zh:'找找耿暄一最近的三阶公开复盘。',en:'Find Xuanyi Geng’s latest public 3x3 reconstructions.'},
  ]},
];
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
  const linkedInTable=result.artifacts?.some(a=>a.kind==='table' && (a.links?.includes(sources[0]?.href) || a.cellLinks?.some(row=>row.includes(sources[0]?.href))));
  const withFallback=!partial && !text.includes('[[') && sources.length===1 && !linkedInTable ? text+`[[${sources[0].id}]]` : text;
  const markdown=withFallback.replace(/\[\[([^\]\n]+)\]\]/g,(_marker,id:string)=>{
    const index=sources.findIndex(source=>source.id===id);
    return index<0 ? '' : `[${index+1}](#assistant-source-${index})`;
  });
  return <div className="site-assistant-prose"><Suspense fallback={<p>{text.replace(/\[\[[^\]\n]+\]\]/g, '')}</p>}><Markdown skipHtml
    allowedElements={['p','strong','em','code','pre','ul','ol','li','blockquote','h1','h2','h3','h4','hr','br','a']}
    components={{a:({href,children})=>{
      const match=/^#assistant-source-(\d+)$/.exec(href ?? '');
      const source=match ? sources[Number(match[1])] : undefined;
      return source ? <Link className="site-assistant-citation" href={source.href} onClick={openSolverDocument} prefetch={false} title={source.title} aria-label={tr({zh:`来源：${source.title}`,en:`Source: ${source.title}`})}>{source.title}</Link> : <>{children}</>;
    }}}>{markdown}</Markdown></Suspense></div>;

}
function Progress({chart}:{chart:AssistantChart}) {
  // Raw WCA values drive geometry; formatted labels are only for display.
  const points=chart.points.map(p=>({date:p.date,y:chart.event==='333fm' && chart.metric==='single' ? p.value : chart.event==='333mbf' || chart.event==='333mbo' ? p.value : p.value/100,person:p.person,label:p.label}));
  return <section className="site-assistant-chart"><h4>{chart.title}</h4>
    {chart.event!=='333mbf' && chart.event!=='333mbo' && <Suspense fallback={null}><WrHistoryChart rawPoints={points} /></Suspense>}
    <details><summary>{tr({zh:'查看成绩数据',en:'View result data'})}</summary><div className="site-assistant-table"><table><thead><tr><th>{tr({zh:'日期',en:'Date'})}</th><th>{tr({zh:'成绩',en:'Result'})}</th></tr></thead><tbody>{chart.points.map((p,i)=><tr key={i}><td>{p.date}</td><td>{formatWcaResult(p.value,chart.event,chart.metric)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export default function SiteAssistantDialog({turns,draft,images,onImagesChange:setImages,onDraftChange:setDraft,status={phase:'planning'},busy,error,lang,onAsk,onStop,onClose,onNew}:Props) {
  const [imageError,setImageError]=useState<string|null>(null);
  const [processingImages,setProcessingImages]=useState(false);
  const imageInput=useRef<HTMLInputElement>(null);
  const imageJob=useRef(0);
  const processing=useRef(false);
  useEffect(()=>()=>{imageJob.current++;},[]);
  const addImages=async(files:File[])=>{
    if(busy || processing.current || editing!==null || !files.length)return;
    setImageError(null);
    if(images.length+files.length>SITE_ASSISTANT_MAX_IMAGES){setImageError(tr({zh:'每次最多添加 3 张图片。',en:'Add up to 3 images per message.'}));return;}
    const job=++imageJob.current;
    processing.current=true;setProcessingImages(true);
    try {
      const prepared:AssistantImage[]=[];
      for(const file of files){
        prepared.push(await prepareAssistantImage(file));
        if(job!==imageJob.current)return;
      }
      setImages([...images,...prepared]);
    } catch {
      if(job===imageJob.current)setImageError(tr({zh:'图片无法读取。请选择 10 MB 以内的 JPG、PNG 或 WebP；图片过大时请先裁剪。',en:'Could not read the image. Choose a JPG, PNG or WebP under 10 MB; crop large images first.'}));
    } finally {if(job===imageJob.current){processing.current=false;setProcessingImages(false);}}
  };
  const renderImages=(items:AssistantImage[],removable=false)=><div className="site-assistant-images">{items.map((image,index)=><div className="site-assistant-image" key={index}>
    {/* Data URLs stay in conversation memory; never upload private attachments to public article storage. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:${image.mediaType};base64,${image.data}`} alt={tr({zh:`附图 ${index+1}`,en:`Attachment ${index+1}`})}/>
    {removable && <Tooltip content={tr({zh:'移除图片',en:'Remove image'})}>{tip=><button {...tip} type="button" className="site-assistant-action" disabled={processingImages} aria-label={tr({zh:`移除图片 ${index+1}`,en:`Remove image ${index+1}`})} onClick={()=>{setImages(images.filter((_,i)=>i!==index));setImageError(null);}}><X size={14}/></button>}</Tooltip>}
  </div>)}</div>;
  const [expanded,setExpanded]=useState(false);
  const [showLatest,setShowLatest]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [,setFlagVersion]=useState(0);
  const hasCompetitionTables=turns.some(turn=>turn.result?.artifacts?.some(a=>a.kind==='table' && (a.links?.some(href=>href.startsWith('/wca/comp/')) || a.cellLinks?.some(row=>row.some(href=>href?.startsWith('/wca/comp/'))))));
  useEffect(()=>{
    if(!hasCompetitionTables)return;
    let active=true;
    loadFlagData({persons:false}).then(version=>{if(active)setFlagVersion(version);});
    return ()=>{active=false;};
  },[hasCompetitionTables]);
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
    if(node && follow.current) node.scrollTop=turns.length ? node.scrollHeight : 0;
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
  const submit=()=>{if(!busy && !processing.current && editing===null && (draft.trim() || images.length) && draft.trim().length<=500){stop();onAsk(draft.trim(),false,images);setDraft('');setImages([]);setImageError(null);}};
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
        <button className="site-assistant-action" type="button" onClick={()=>{imageJob.current++;processing.current=false;setProcessingImages(false);setImageError(null);stop();onNew();setEditing(null);setDraft('');input.current?.focus();}} title={tr({zh:'新对话',en:'New conversation'})}><MessageSquarePlus size={20}/></button>
        <button className="site-assistant-action site-assistant-expand" type="button" onClick={()=>setExpanded(value=>!value)} title={tr(expanded?{zh:'退出全屏',en:'Exit full screen'}:{zh:'全屏',en:'Full screen'})}>{expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button>
        <button className="site-assistant-action" type="button" onClick={onClose} title={tr({zh:'关闭',en:'Close'})}><X size={22}/></button>
      </header>
      <div className="site-assistant-body"><div ref={messages} onScroll={()=>{const node=messages.current;if(node && turns.length){follow.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;setShowLatest(!follow.current);}}} className="site-assistant-messages" role="log" aria-live="polite">
        {!turns.length && <div className="site-assistant-examples">
          <h3>{tr({zh:'你想了解什么？',en:'What would you like to know?'})}</h3>
          <p className="site-assistant-examples-intro">{tr({zh:'点击示例填入问题，可修改后发送。',en:'Choose a question to edit and send.'})}</p>
          <div className="site-assistant-example-groups">{QUESTION_EXAMPLES.map(group=><section className="site-assistant-example-group" key={group.id} aria-labelledby={`assistant-examples-${group.id}`}>
            <h4 id={`assistant-examples-${group.id}`}>{tr(group.title)}</h4>
            {group.note && <p className="site-assistant-examples-intro">{tr(group.note)}</p>}
            {group.questions.map(example=><button className="site-assistant-action" type="button" key={example.en} onClick={()=>{stop();setDraft(tr(example));input.current?.focus();}}>{tr(example)}</button>)}
          </section>)}</div>
        </div>}
        {turns.map((turn,i)=>{
          const tableLinks=new Set(turn.result?.artifacts?.flatMap(a=>a.kind==='table' ? [...a.links ?? [],...a.cellLinks?.flat() ?? []] : []) ?? []);
          const seenActions=new Set<string>();
          const actions=turn.result?.actions?.filter(action=>{
            if(!/^\/(?!\/)/.test(action.href) || tableLinks.has(action.href) || seenActions.has(action.href))return false;
            seenActions.add(action.href);return true;
          }) ?? [];
          return <section className="site-assistant-turn" key={i}>{editing!==null && i===turns.length-1 ? <form className="site-assistant-edit" onSubmit={event=>{event.preventDefault();if((editing.trim()||turn.images?.length)&&!busy){onAsk(editing.trim(),true,turn.images);setEditing(null);}}}>
          {!!turn.images?.length && renderImages(turn.images)}<textarea ref={editInput} className="site-assistant-draft" aria-label={tr({zh:'编辑问题',en:'Edit question'})} value={editing} maxLength={500} rows={3} onChange={event=>setEditing(event.target.value)}/>
          <div className="site-assistant-edit-actions">{editing && <ClearButton onClick={()=>setEditing('')}/>}<button type="button" className="site-assistant-action" onClick={()=>setEditing(null)}>{tr({zh:'取消',en:'Cancel'})}</button><button type="submit" className="site-assistant-action site-assistant-send" disabled={busy||(!editing.trim()&&!turn.images?.length)}>{tr({zh:'发送',en:'Send'})}</button></div>
        </form> : <div className="site-assistant-question">{turn.imagesExpired && <p className="site-assistant-note">{tr({zh:'较早的图片已释放，需要时请重新添加。',en:'Earlier images have been released. Attach them again if needed.'})}</p>}{!!turn.images?.length && renderImages(turn.images)}{turn.question && <h3>{turn.question}</h3>}<div className="site-assistant-question-actions"><button className="site-assistant-action" type="button" onClick={()=>{if(navigator.clipboard)copy(turn.question,`question-${i}`);}} title={tr(copiedKey===`question-${i}`?{zh:'已复制',en:'Copied'}:{zh:'复制问题',en:'Copy question'})}>{copiedKey===`question-${i}`?<Check size={15}/>:<Copy size={15}/>}</button>{i===turns.length-1 && <button className="site-assistant-action" type="button" disabled={busy} onClick={()=>{stop();setEditing(turn.question);}} title={tr({zh:'编辑问题',en:'Edit question'})}><Pencil size={15}/></button>}</div></div>}
          {busy && i===turns.length-1 && <div className="site-assistant-status" role="status"><span className="site-assistant-status-icon" aria-hidden="true">{status.phase==='querying'?<Search size={16}/>:<LoaderCircle size={16}/>}</span><span>{statusLabel(status)}</span><span className="site-assistant-status-dots" aria-hidden="true">···</span></div>}
          {turn.result && <div className="site-assistant-response"><SiteAssistantAnswerText result={turn.result} partial={turn.partial}/>
          {!turn.partial && !!actions.length && <div className="site-assistant-response-actions site-assistant-navigation">{actions.map(action=><Link key={action.id} className="site-assistant-action" href={action.href} onClick={openSolverDocument} prefetch={false}>{tr({zh:`打开 ${action.title}`,en:`Open ${action.title}`})}</Link>)}</div>}
          {turn.result.artifacts?.map((a,j)=>a.kind==='progress'?<Progress key={j} chart={a}/>:<section key={j}><h4>{a.title}</h4><div className="site-assistant-table"><table><thead><tr>{a.columns.map((c,k)=><th key={k}>{c}</th>)}</tr></thead><tbody>{a.rows.map((row,k)=><tr key={k}>{row.map((cell,c)=>{
            const kind=a.columnKinds?.[c];
            const href=a.cellLinks?.[k]?.[c] ?? (c===0 ? a.links?.[k] : undefined);
            const compId=href && /^\/wca\/comp\/([A-Za-z0-9_-]+)$/.exec(href)?.[1];
            const dateColumn=a.columnKinds?.indexOf('date') ?? -1;
            const content=kind==='country' && cell ? <span title={countryName(cell,lang==='zh')}><Flag iso2={cell} spanClassName="country-flag" imgClassName="country-flag-ct"/></span> : compId ? <CompCell compId={compId} compName={cell} isZh={lang==='zh'} date={dateColumn>=0 ? row[dateColumn] : null}/> : cell;
            return <td key={c} className={kind==='date' ? 'site-assistant-date' : kind==='country' ? 'site-assistant-country' : undefined}>{href?.startsWith('/') && !href.startsWith('//') ? <Link prefetch={false} href={href}>{content}</Link> : content}</td>;
          })}</tr>)}</tbody></table></div></section>)}
        </div>}
          {turn.result && !(busy && i===turns.length-1) && <div className="site-assistant-response-actions"><button className="site-assistant-action" type="button" onClick={()=>copyAnswer(turn.result!,`answer-${i}`)} title={tr(copiedKey===`answer-${i}`?{zh:'已复制',en:'Copied'}:{zh:'复制回答',en:'Copy answer'})}>{copiedKey===`answer-${i}`?<Check size={16}/>:<Copy size={16}/>}</button>{i===turns.length-1 && !error && <button className="site-assistant-action" type="button" disabled={busy||editing!==null} onClick={()=>onAsk(turn.question,true,turn.images)} title={tr({zh:'重新生成',en:'Regenerate'})}><RotateCcw size={16}/></button>}<span role="status">{copiedKey===`answer-${i}` && tr({zh:'已复制',en:'Copied'})}</span></div>}
          {turn.partial && !(busy && i===turns.length-1) && <p className="site-assistant-incomplete">{tr({zh:'回答未完成',en:'Answer incomplete'})}</p>}
        </section>;})}
        {error && <div role="alert"><p>{tr(ASSISTANT_ERROR_TEXT[error])}</p>{error==='login_required'||error==='wca_link_required' ? <button className="site-assistant-action" type="button" onClick={()=>useAuthStore.getState().login()}>{tr({zh:'前往账号页',en:'Go to account'})}</button> : error==='verification_required' ? <Link href={`/competition-verify?returnTo=${encodeURIComponent(lang==='zh'?'/zh':'/')}`} prefetch={false}>{tr({zh:'完成访问验证',en:'Verify access'})}</Link> : error!=='daily_limit' && error!=='account_forbidden' && turns.length>0 && <button className="site-assistant-action" type="button" disabled={busy||editing!==null} onClick={()=>onAsk(turns[turns.length-1].question,true,turns[turns.length-1].images)}>{tr({zh:'重试',en:'Retry'})}</button>}</div>}
      </div>
      {showLatest && turns.length>0 && <button className="site-assistant-action site-assistant-latest" type="button" onClick={scrollLatest} title={tr({zh:'回到最新消息',en:'Jump to latest'})}><ArrowDown size={18}/></button>}</div>
      <form className="site-assistant-compose" onDragOver={event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();}} onDrop={event=>{event.preventDefault();void addImages(Array.from(event.dataTransfer.files));}} onSubmit={e=>{e.preventDefault();submit();}}><div className="site-assistant-input">
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event=>{const files=Array.from(event.target.files ?? []);event.target.value='';void addImages(files);}}/>
        {!!images.length && renderImages(images,true)}
        <textarea className="site-assistant-draft" onPaste={event=>{const files=Array.from(event.clipboardData.files);if(files.length){event.preventDefault();void addImages(files);}}} ref={input} aria-label={tr({zh:'继续提问',en:'Ask a follow-up'})} placeholder={tr({zh:'随心输入',en:'Type anything'})} maxLength={500} rows={1} disabled={editing!==null} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!window.matchMedia?.('(pointer: coarse)').matches){e.preventDefault();submit();}}}/>
        <div className="site-assistant-input-actions">
          <Tooltip content={tr({zh:'添加图片，可粘贴或拖入',en:'Add images, or paste or drop them here'})}>{tip=><button {...tip} type="button" className="site-assistant-action" disabled={busy||editing!==null||processingImages||images.length>=SITE_ASSISTANT_MAX_IMAGES} aria-label={tr({zh:'添加图片',en:'Add images'})} onClick={()=>imageInput.current?.click()}><ImagePlus size={19}/></button>}</Tooltip>
          {draft && <ClearButton onClick={()=>setDraft('')}/>}
          <span className="site-assistant-compose-hint">{draft.length>=450?`${draft.length}/500`:tr({zh:'Shift + Enter 换行',en:'Shift + Enter for a new line'})}</span>
          <button className="site-assistant-action site-assistant-mic" type="button" disabled={busy||editing!==null} onClick={()=>listening?stop():void start()} title={tr({zh:'语音输入',en:'Voice input'})} aria-pressed={listening}><Mic size={19}/></button>
          {busy?<button className="site-assistant-action site-assistant-send" type="button" onClick={onStop} title={tr({zh:'停止',en:'Stop'})}><Square size={16}/></button>:<button className="site-assistant-action site-assistant-send" type="submit" disabled={(!draft.trim()&&!images.length)||draft.trim().length>500||editing!==null||processingImages} title={tr({zh:'发送',en:'Send'})}><ArrowUp size={20}/></button>}
        </div>
      </div>{processingImages && <p role="status">{tr({zh:'正在处理图片…',en:'Preparing images…'})}</p>}
      {imageError && <p role="alert">{imageError}</p>}
      {!!images.length && <p className="site-assistant-note">{tr({zh:'发送后，图片将交给 AI 识别。追问可参考最近 3 张图片。',en:'Sent images are processed by AI. Follow-ups can reference the latest 3 images.'})}</p>}
      {micError && <p role="status">{tr({zh:'语音未能识别，请检查麦克风权限，或使用键盘听写。',en:'Voice recognition failed. Check microphone permissions or use keyboard dictation.'})}</p>}
      <p className="site-assistant-note">{tr({zh:'AI 回答可能有误，请核对来源。WCA 数据以最近导入为准。',en:'AI can make mistakes. Check sources. WCA data reflects the latest import.'})}</p></form>
    </div>
  </div>,document.body);
}
