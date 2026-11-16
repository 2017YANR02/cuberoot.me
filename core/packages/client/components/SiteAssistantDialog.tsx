'use client';

import { useAssistantTextReveal } from '@/hooks/useAssistantTextReveal';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, RefObject } from 'react';
const Markdown = lazy(() => import('react-markdown').catch(() => ({ default: ({ children }: { children?: string | null }) => <>{children}</> })));
const WrHistoryChart = lazy(() => import('@/components/wca-stats/WrHistoryChart').catch(() => ({ default: () => null })));
import { useCopy } from '@/hooks/useCopy';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, ArrowRight, Check, Copy, Pencil, Maximize2, Minimize2, MessageSquarePlus, Image as ImageIcon, Plus, Mic, Square, Quote, X } from '@app-foundation/icons/lucide';
import { SITE_ASSISTANT_MAX_IMAGES, SITE_ASSISTANT_QUESTION_MAX_LENGTH, isAssistantSourceHref, type AssistantImage, type AssistantAnswer, type AssistantChart, type AssistantStatus, type AssistantErrorCode, type AssistantThinkingMode, type AssistantProvider } from '@cuberoot/shared/site-assistant';
import { ASSISTANT_ERROR_TEXT } from '@/lib/site-assistant-errors';
import { authActions } from '@/lib/auth-store';
import { formatWcaResult } from '@/lib/wca-format-result';
import { useDialogMotion, useModalDismiss } from '@/hooks/useModalDismiss';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { Tooltip } from '@/components/Tooltip';
import { sendAssistantEvent, type AssistantFeedback } from '@/lib/site-assistant-request';
import PhotoChatResult from './cube-photo/PhotoChatResult';
import AssistantAlgorithmCards from './AssistantAlgorithmCards';
import type { AssistantAlgorithmCard } from '@cuberoot/shared/site-assistant';
import ReconCaseLink from './ReconCaseLink';
import AssistantImagePreview from './AssistantImagePreview';
import { assistantAnswerText, SITE_ASSISTANT_REFERENCE_MAX_LENGTH, type AssistantReference } from '@cuberoot/shared/site-assistant';
import type { AssistantProgress } from '@cuberoot/shared/site-assistant';
import { prepareAssistantImage } from '@/lib/site-assistant-images';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import Link from '@/components/AppLink';
import { Flag } from '@/components/Flag';
import { CompCell } from '@/components/CompCell/CompCell';
import { loadFlagData } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { tr } from '@/i18n/tr';
import './site_assistant.css';
import AssistantAnswerActions from './AssistantAnswerActions';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { assistantAnswerLinks, remarkAssistantLinks } from '@/lib/assistant-answer-links';

export interface AssistantTurn { serverAnswerUpdatedAt?:number; deliveryState?:'queued'|'running'|'applied'|'completed'|'stopped'|'error'; targetId?:string; messageId?:string; answerVersion?:number; references?:AssistantReference[]; createdAt?: number; finishedAt?: number; endState?: 'complete'|'stopped'|'error'; progress?: AssistantProgress[]; requestId?: string; feedback?: AssistantFeedback|null; question:string; images?:AssistantImage[]; imagesExpired?:boolean; result?:AssistantAnswer; partial?:boolean }
interface Props {
  onAlgorithmChange?:(turn:number, artifact:number, card:number, expected:AssistantAlgorithmCard, next:AssistantAlgorithmCard)=>void;
  onAnswerRevealed?:(id:string,text:string)=>void;
  embedded?:boolean; active?:boolean; searchResults?:ReactNode; onBranch?:(index:number)=>void;
  turns:AssistantTurn[]; status?:AssistantStatus; busy:boolean; paused?:boolean; recovering?:boolean; activeMessageId?:string; onResume?:()=>void; stopping?:boolean; stopUnconfirmed?:boolean; error:AssistantErrorCode|null; lang:'zh'|'en';
  images:AssistantImage[]; onImagesChange:(images:AssistantImage[])=>void;
  draft:string; onDraftChange:(draft:string)=>void;
  onAuthSend?:(question:string,images:AssistantImage[],references:AssistantReference[])=>boolean;
  authSendLabel?:string; authPlaceholder?:string; authNotice?:string;
  provider?:AssistantProvider; onProviderChange?:(provider:AssistantProvider)=>void; openaiAvailable?:boolean;
  thinking:AssistantThinkingMode; onThinkingChange:(mode:AssistantThinkingMode)=>void;
  onFeedback:(id:string,value:AssistantFeedback|null)=>void;
  onAsk:(question:string,replaceLast?:boolean,images?:AssistantImage[],references?:AssistantReference[],mode?:'steer'|'queue')=>Promise<boolean>|void; onStop:()=>void; onClose:()=>void; onNew:()=>void;
}
const QUERY_LABELS: Record<string, {zh:string;en:string}> = {
  web_search:{zh:'正在搜索网络资料',en:'Searching the web'},
  news:{zh:'正在查询 WCA 官方新闻',en:'Reading WCA news'},
  lookup_cube_photo:{zh:'正在识别魔方并验证公式',en:'Identifying the cube and verifying algorithms'},
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
  analysis_schema:{zh:'正在读取数据结构',en:'Reading data definitions'},
  analysis_query:{zh:'正在计算统计结果',en:'Calculating statistics'},
  deliberate:{zh:'正在切换深入分析',en:'Starting deeper analysis'},
};
const QUESTION_EXAMPLES = [
  {id:'everyday',title:{zh:'解释与交流',en:'Everyday questions'},questions:[
    {zh:'用简单的例子解释什么是概率。',en:'Explain probability with a simple example.'},
    {zh:'为什么天空是蓝色的？用小朋友能听懂的话解释。',en:'Why is the sky blue? Explain it in words a child can understand.'},
    {zh:'帮我比较集中练习和间隔练习各自的优缺点。',en:'Compare the advantages and disadvantages of focused practice and spaced practice.'},
  ]},
  {id:'writing',title:{zh:'写作与翻译',en:'Writing and translation'},questions:[
    {zh:'帮我写一段介绍魔方社团的招新文案，语气自然一点。',en:'Write a welcoming introduction for recruiting members to a cubing club.'},
    {zh:'把“很高兴在比赛中认识你，希望下次再见”翻译成自然的英语。',en:'Translate “很高兴在比赛中认识你，希望下次再见” into natural English.'},
    {zh:'我每周有 3 个晚上可以学习，帮我制定一个循序渐进的学习计划。',en:'I have three evenings each week to study. Help me create a gradual learning plan.'},
  ]},
  {id:'learn-algorithms',title:{zh:'学习公式',en:'Learn algorithms'},questions:[
    {zh:'我想学 CFOP 公式，帮我找到对应页面。',en:'I want to learn CFOP algorithms. Show me the relevant pages.'},
    {zh:'先学简单一点的，帮我找到 2 步 OLL 和 2 步 PLL。',en:'Start with something simpler. Show me 2-look OLL and 2-look PLL.'},
    {zh:'我想学桥式的 CMLL 公式。',en:'I want to learn CMLL algorithms for Roux.'},
  ]},
  {id:'practice',title:{zh:'专项训练',en:'Targeted practice'},questions:[
    {zh:'我想练习 PLL 识别，打开识别训练。',en:'I want to practise PLL recognition. Show me the recognition trainer.'},
    {zh:'我想练习 ZBLL，打开训练页面。',en:'I want to practise ZBLL. Show me the trainer.'},
    {zh:'我想练习十字最优解，去哪里训练？',en:'I want to practise optimal cross solutions. Where is the trainer?'},
  ]},
  {id:'tools',title:{zh:'用好网站',en:'Using CubeRoot'},questions:[
    {zh:'计时器的普通计时和公式训练有什么区别？',en:'What is the difference between normal timing and algorithm training?'},
    {zh:'在哪里可以给复盘视频数帧？',en:'Where can I count frames in a solve video?'},
    {zh:'帮我找到二阶魔方求解器。',en:'Help me find the 2x2 cube solver.'},
  ]},
  {id:'learning',title:{zh:'学公式与原理',en:'Algorithms and concepts'},questions:[
    {zh:'OLL 和 PLL 分别解决什么问题？',en:'What do OLL and PLL each solve?'},
    {zh:'换位子和共轭子有什么区别？',en:'What is the difference between a commutator and a conjugate?'},
    {zh:'群论能怎么解释魔方的转动？',en:'How does group theory explain cube moves?'},
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
function sourceLinkProps(href:string) {
  return href.startsWith('https://') ? {target:'_blank',rel:'noopener noreferrer'} : {};
}
// Solver documents require their own COOP/COEP headers; soft navigation cannot apply them.
function openSolverDocument(event:MouseEvent<HTMLAnchorElement>) {
  if (/^\/(?:zh\/)?scramble\/solver(?:\?|$)/.test(new URL(event.currentTarget.href).pathname) && event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  }
}
function AssistantExecutionProgress({turn,busy,status,stopping}:{turn:AssistantTurn;busy:boolean;status:AssistantStatus;stopping?:boolean}) {
  const [expanded,setExpanded]=useState(busy);
  const [now,setNow]=useState(Date.now);
  const panelId=useId();
  useEffect(()=>{ if(!busy){setExpanded(false);return;} const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer); },[busy]);
  const steps=turn.progress ?? [];
  const current=steps.findLast(step=>step.state==='running');
  const phaseLabel=(step:AssistantProgress)=>step.reused ? tr({zh:'已复用查询结果',en:'Reused saved result'}) : step.phase==='tool' ? tr(QUERY_LABELS[step.tool ?? ''] ?? {zh:'正在查询资料',en:'Looking up sources'})
    : tr(step.phase==='review' ? {zh:'正在核对证据与回答',en:'Checking evidence and answer'} : {zh:'正在分析与组织回答',en:'Analyzing and composing'});
  const summary=stopping ? tr({zh:'正在停止',en:'Stopping'}) : busy ? current ? phaseLabel(current) : statusLabel(status)
    : tr(turn.endState==='complete' || (turn.result && !turn.partial) ? {zh:'处理完成',en:'Completed'} : turn.endState==='stopped' ? {zh:'已停止',en:'Stopped'} : {zh:'处理未完成',en:'Could not complete'});
  const elapsed=Math.max(0,((busy ? now : turn.finishedAt ?? turn.createdAt ?? now)-(turn.createdAt ?? now))/1000);
  return <div className="site-assistant-progress" data-active={busy && !stopping}>
    <div className="site-assistant-progress-heading">
      <span className="site-assistant-progress-active-text" role="status" aria-live="polite">{busy && !stopping && status.phase==='writing' && current?.phase==='model' ? statusLabel(status) : summary}</span>
      <span className="site-assistant-progress-time" aria-hidden="true">{elapsed.toFixed(0)} s</span>
      {!!steps.length && <MoreToggle expanded={expanded} onToggle={()=>setExpanded(!expanded)} aria-controls={panelId}><span className="site-assistant-progress-active-text">{tr({zh:'处理过程',en:'Activity'})}</span></MoreToggle>}
    </div>
    {!!steps.length && <MoreTogglePanel id={panelId} expanded={expanded}>
      <ol className="site-assistant-progress-steps">{steps.map(step=>{
        const state=step.state==='running' && !busy ? 'stopped' : step.state;
        const label=tr(state==='complete' ? {zh:'完成',en:'Finished'} : state==='partial' ? {zh:'信息不完整',en:'Partial information'} : state==='error' ? {zh:'未成功',en:'Failed'} : state==='stopped' ? {zh:'已中断',en:'Interrupted'} : {zh:'进行中',en:'In progress'});
        return <li key={step.id} data-state={state}>
          {state==='complete' ? <Check size={13} aria-hidden="true"/> : state==='error' || state==='stopped' ? <X size={13} aria-hidden="true"/> : <span className="site-assistant-progress-dot" aria-hidden="true"/>}
          <span className={state==='running' ? 'site-assistant-progress-active-text' : undefined}>{phaseLabel(step).replace(/^正在/,'')} · {label}{!!step.sourceCount && <span> · {tr({zh:`已读取 ${step.sourceCount} 条来源`,en:`${step.sourceCount} sources read`})}</span>}</span>
          {step.durationMs!==undefined && <span className="site-assistant-progress-time">{(step.durationMs/1000).toFixed(0)} s</span>}
        </li>;
      })}</ol>
    </MoreTogglePanel>}
  </div>;
}

/** Inside Suspense: notify only after the actual Markdown has committed and painted. */
function AssistantAnswerPaint({text,animate,requestId,onComplete,complete}:{text:string;animate:boolean;requestId?:string;onComplete?:(id:string,text:string)=>void;complete:boolean}) {
  useAssistantTextReveal(text,animate,requestId,onComplete,complete);
  return null;
}

function answerPresentation(result:AssistantAnswer,partial?:boolean) {
  const sources=result.sources.filter(source=>isAssistantSourceHref(source.href));
  // Do not flash incomplete citation syntax as provider chunks arrive.
  const text=result.answer.replace(/\[\[[^\]\n]*\]?$/, '').replace(/\[$/, '');
  const linkedInTable=result.artifacts?.some(a=>a.kind==='table' && (a.links?.includes(sources[0]?.href) || a.cellLinks?.some(row=>row.includes(sources[0]?.href))));
  const withFallback=!partial && !text.includes('[[') && sources.length===1 && !linkedInTable ? text+`[[${sources[0].id}]]` : text;
  return {sources,text,withFallback};
}
export function SiteAssistantAnswerText({result,partial,requestId,shared=false,animate=false,onRevealComplete}:{result:AssistantAnswer;partial?:boolean;requestId?:string;shared?:boolean;animate?:boolean;onRevealComplete?:(id:string,text:string)=>void}) {
  const {sources,text,withFallback}=answerPresentation(result,partial);
  const resolveLink=assistantAnswerLinks(result);
  const markdown=withFallback.replace(/\[\[([^\]\n]+)\]\]/g,(_marker,id:string)=>{
    const index=sources.findIndex(source=>source.id===id);
    return index<0 ? '' : `[${index+1}](#assistant-source-${index})`;
  });
  return <div className="site-assistant-prose"><Suspense fallback={<p>{text.replace(/\[\[[^\]\n]+\]\]/g, '')}</p>}><Markdown skipHtml remarkPlugins={[remarkAssistantLinks(resolveLink)]}
    allowedElements={['p','strong','em','code','pre','ul','ol','li','blockquote','h1','h2','h3','h4','hr','br','a','span']}
    components={{a:({href,children})=>{
      const match=/^#assistant-source-(\d+)$/.exec(href ?? '');
      const source=match ? sources[Number(match[1])] : undefined;
      const destination=href ? resolveLink(href) : undefined;
      if (source?.id.startsWith('photo:') && /^\/alg\/[^/]+\/[^/]+\/[^/?#]+/.test(source.href)) return <ReconCaseLink className="site-assistant-citation" href={source.href} title={source.title}>{source.title}</ReconCaseLink>;
      if (!source && destination) return <Link className="site-assistant-inline-link" href={destination.href} {...sourceLinkProps(destination.href)} prefetch={false} onClick={event=>{if(requestId)void sendAssistantEvent(requestId,{type:'click',kind:'source',id:destination.id}).catch(()=>{});openSolverDocument(event);}}>{children}</Link>;
      return source ? <Link className="site-assistant-citation" href={source.href} {...sourceLinkProps(source.href)} onClick={event=>{if(requestId)void sendAssistantEvent(requestId,{type:'click',kind:'source',id:source.id}).catch(()=>{});openSolverDocument(event);}} prefetch={false} title={source.title} aria-label={tr({zh:`来源：${source.title}`,en:`Source: ${source.title}`})}>{source.title}</Link> : shared && href && isAssistantSourceHref(href) ? <Link href={href} {...sourceLinkProps(href)} prefetch={false}>{children}</Link> : <>{children}</>;
    }}}>{markdown}</Markdown><AssistantAnswerPaint text={result.answer} animate={animate} requestId={requestId} complete={!partial} onComplete={onRevealComplete}/></Suspense></div>;

}
function Progress({chart}:{chart:AssistantChart}) {
  // Raw WCA values drive geometry; formatted labels are only for display.
  const points=chart.points.map(p=>({date:p.date,y:chart.event==='333fm' && chart.metric==='single' ? p.value : chart.event==='333mbf' || chart.event==='333mbo' ? p.value : p.value/100,person:p.person,label:p.label}));
  return <section className="site-assistant-chart"><h4>{chart.title}</h4>
    {chart.event!=='333mbf' && chart.event!=='333mbo' && <Suspense fallback={<LoadingIndicator />}><WrHistoryChart rawPoints={points} /></Suspense>}
    <details><MoreToggle as="summary">{tr({zh:'查看成绩数据',en:'View result data'})}</MoreToggle><div className="site-assistant-table"><table><thead><tr><th>{tr({zh:'日期',en:'Date'})}</th><th>{tr({zh:'成绩',en:'Result'})}</th></tr></thead><tbody>{chart.points.map((p,i)=><tr key={i}><td>{p.date}</td><td>{formatWcaResult(p.value,chart.event,chart.metric)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
function AssistantModal({ children, onClose, motionRef }: { children: ReactNode; onClose: () => void; motionRef: RefObject<HTMLDivElement | null> }) {
  const backdrop = useModalDismiss(onClose);
  return createPortal(<div ref={motionRef} className="site-assistant-backdrop" {...backdrop}>{children}</div>, document.body);
}

export default function SiteAssistantDialog({onAuthSend,authSendLabel,authPlaceholder,authNotice,onAlgorithmChange,onAnswerRevealed,turns,draft,images,onImagesChange:setImages,onDraftChange:setDraft,provider='bailian',onProviderChange,openaiAvailable=false,thinking,onThinkingChange,status={phase:'planning'},busy,paused=false,recovering=false,activeMessageId,onResume,stopping=false,stopUnconfirmed=false,error,lang,onAsk,onStop,onClose:onClosed,onNew,onFeedback,embedded=false,active=true,searchResults,onBranch}:Props) {
  const [deliveryMode,setDeliveryMode]=useState<'steer'|'queue'>('steer');
  const isRunning=(turn:AssistantTurn,index:number)=>busy && (activeMessageId?turn.messageId===activeMessageId:index===turns.length-1);
  const { motionRef, close: onClose } = useDialogMotion(onClosed, { enabled: !embedded });
  const [initialAnswers] = useState(() => new Set(turns.filter(turn => turn.result && !turn.partial).map(turn => turn.requestId)));
  const onRevealComplete = useCallback((id:string, text:string) => {
    onAnswerRevealed?.(id, text);
  }, [onAnswerRevealed]);
  const titleId=useId();
  const providerLabel=provider==='openai'?'GPT-5.4-mini':'Qwen3.8-Flash';
  const thinkingItems=[
    {value:'auto' as const,label:tr({zh:'自动思考',en:'Auto thinking'})},
    {value:'fast' as const,label:tr({zh:'快速回答',en:'Quick answer'})},
    {value:'deep' as const,label:tr({zh:'深入思考',en:'Deep thinking'})},
  ];
  const [imageError,setImageError]=useState<string|null>(null);
  const [processingImages,setProcessingImages]=useState(false);
  const imageInput=useRef<HTMLInputElement>(null);
  const imageJob=useRef(0);
  const processing=useRef(false);
  useEffect(()=>()=>{imageJob.current++;},[]);
  const addImages=async(files:File[])=>{
    if(submitLock.current || processing.current || editing!==null || !files.length)return;
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
    {/* Saved references are fetched with owner authentication, never from public article storage. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <AssistantImagePreview image={image} index={index} />
    {removable && <Tooltip content={tr({zh:'移除图片',en:'Remove image'})}>{tip=><button {...tip} type="button" className="site-assistant-action" disabled={processingImages} aria-label={tr({zh:`移除图片 ${index+1}`,en:`Remove image ${index+1}`})} onClick={()=>{setImages(images.filter((_,i)=>i!==index));setImageError(null);}}><X size={14}/></button>}</Tooltip>}
  </div>)}</div>;
  const [expanded,setExpanded]=useState(false);
  const [showLatest,setShowLatest]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [reference,setReference]=useState<AssistantReference|null>(null);
  const [selection,setSelection]=useState<AssistantReference|null>(null);
  const [quoteError,setQuoteError]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const submitLock=useRef(false);
  const messageKey=(turn:AssistantTurn,index:number,role:'user'|'assistant')=>
    (turn.messageId ?? turn.requestId ?? String(turn.createdAt ?? index))+':'+role;
  const quote=(turn:AssistantTurn,index:number,role:'user'|'assistant',selectedText?:string):AssistantReference=>({
    messageId:messageKey(turn,index,role),messageVersion:role==='user'?1:turn.answerVersion ?? 1,role,
    selectedText:selectedText ?? (role==='user' ? turn.question : turn.result ? assistantAnswerText(turn.result,window.location.origin) : ''),
    sourceStatus:role==='user'?'complete':turn.endState==='stopped'?'stopped':turn.partial?'partial':'complete',
  });
  const useQuote=(value:AssistantReference)=>{
    if(value.selectedText.length>SITE_ASSISTANT_REFERENCE_MAX_LENGTH){setQuoteError(true);return;}
    setQuoteError(false);setReference(value);setSelection(null);input.current?.focus({preventScroll:true});
  };
  const readSelection=()=>{
    const selected=window.getSelection();
    if(!selected || selected.isCollapsed || !selected.rangeCount){setSelection(null);return;}
    const range=selected.getRangeAt(0);
    const element=(node:Node)=>node instanceof Element?node:node.parentElement;
    const start=element(range.startContainer)?.closest<HTMLElement>('[data-assistant-message]');
    const end=element(range.endContainer)?.closest<HTMLElement>('[data-assistant-message]');
    if(!start || start!==end || !messages.current?.contains(start)){setSelection(null);return;}
    const index=Number(start.dataset.turn),role=start.dataset.assistantMessage as 'user'|'assistant';
    const text=selected.toString();
    setQuoteError(text.length>SITE_ASSISTANT_REFERENCE_MAX_LENGTH);
    setSelection(text.trim() && text.length<=SITE_ASSISTANT_REFERENCE_MAX_LENGTH ? quote(turns[index],index,role,text):null);
  };
  const jumpToQuote=(value:AssistantReference)=>{
    const index=turns.findIndex((turn,i)=>messageKey(turn,i,value.role)===value.messageId);
    if(index<0)return;
    follow.current=false;
    document.getElementById(titleId+'-turn-'+index)?.scrollIntoView({block:'center',behavior:'smooth'});
  };
  const quoteCard=(value:AssistantReference,removable=false)=><div className="site-assistant-quote">
    <button type="button" className="site-assistant-action site-assistant-quote-content" onClick={()=>jumpToQuote(value)}>
      <span>{tr(value.role==='user'?{zh:'引用问题',en:'Quoted question'}:{zh:'引用回答',en:'Quoted answer'})}{value.sourceStatus!=='complete' && ' · '+tr({zh:'未完成',en:'Incomplete'})}</span>
      <span className="site-assistant-quote-text">{value.selectedText}</span>
    </button>
    {removable && <Tooltip content={tr({zh:'移除引用',en:'Remove quote'})}>{tip=><button {...tip} type="button" className="site-assistant-action" aria-label={tr({zh:'移除引用',en:'Remove quote'})} onClick={()=>setReference(null)}><X size={15}/></button>}</Tooltip>}
  </div>;
  const [,setFlagVersion]=useState(0);
  const hasCompetitionTables=turns.some(turn=>turn.result?.artifacts?.some(a=>a.kind==='table' && (a.links?.some(href=>href.startsWith('/wca/comp/')) || a.cellLinks?.some(row=>row.some(href=>href?.startsWith('/wca/comp/'))))));
  useEffect(()=>{
    if(!hasCompetitionTables)return;
    let active=true;
    loadFlagData({persons:false}).then(version=>{if(active)setFlagVersion(version);});
    return ()=>{active=false;};
  },[hasCompetitionTables]);
  const {copy,copiedKey}=useCopy();
  const dialog=useRef<HTMLDivElement>(null);
  const messages=useRef<HTMLDivElement>(null);
  const cardScroll=useRef<number|null>(null);
  const changeAlgorithm=(turn:number,artifact:number,card:number,expected:AssistantAlgorithmCard,next:AssistantAlgorithmCard)=>{
    cardScroll.current=messages.current?.scrollTop ?? null;
    onAlgorithmChange?.(turn,artifact,card,expected,next);
  };
  const follow=useRef(true);
  const turnCount=useRef(turns.length);
  const input=useRef<HTMLTextAreaElement>(null);
  const editInput=useRef<HTMLTextAreaElement>(null);
  const {listening,error:micError,start,stop}=useSpeechToText({lang:lang==='zh'?'zh-CN':'en-US',onResult:setDraft});
  useEffect(()=>{if(!active)stop();},[active,stop]);
  useEffect(()=>{if(!active)return;const previous=document.activeElement as HTMLElement;input.current?.focus({preventScroll:true});return()=>{if(!embedded)previous?.focus();};},[active,embedded]);
  useLayoutEffect(()=>{
    if(turns.length!==turnCount.current) { follow.current=true; turnCount.current=turns.length; }
    const node=messages.current;
    if(node && cardScroll.current!==null) { node.scrollTop=cardScroll.current; cardScroll.current=null; return; }
    if(node && follow.current) node.scrollTop=turns.length ? node.scrollHeight : 0;
  },[turns,busy,error,status]);
  useEffect(()=>{
    const node=input.current;
    if(node) { node.style.height='auto'; node.style.height=`${Math.min(node.scrollHeight,180)}px`; }
  },[draft,expanded]);
  const isEditing=editing!==null;
  useEffect(()=>{if(!active)return;if(isEditing)editInput.current?.focus();else if(!window.matchMedia?.('(pointer: coarse)').matches)input.current?.focus();},[isEditing,active]);
  const scrollLatest=()=>{follow.current=true;setShowLatest(false);const node=messages.current;if(node)node.scrollTop=node.scrollHeight;};
  const submit=async()=>{
    if(submitLock.current || stopping || processing.current || editing!==null || (!draft.trim() && !images.length) || draft.trim().length>SITE_ASSISTANT_QUESTION_MAX_LENGTH)return;
    submitLock.current=true;setSubmitting(true);stop();
    try {
      if (authSendLabel && onAuthSend) { onAuthSend(draft, images, reference ? [reference] : []); return; }
      const accepted=await onAsk(draft.trim(),false,images,reference?[reference]:[],busy?deliveryMode:'queue');
      if(accepted!==false){if(input.current?.value===draft)setDraft('');setImages([]);setReference(current=>current===reference?null:current);setImageError(null);}
    } finally {submitLock.current=false;setSubmitting(false);}
  };
  const content=<div ref={dialog} className={`site-assistant-dialog${expanded ? ' is-expanded' : ''}${embedded ? ' site-assistant-embedded' : ''}`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-label={embedded ? tr({zh:'聊天内容',en:'Conversation'}) : undefined} aria-labelledby={embedded ? undefined : titleId} data-site-surface="panel" onKeyDown={event=>{
      if(embedded || event.key!=='Tab')return;
      const focusable=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled),select:not(:disabled),summary');
      if(!focusable?.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }}>
      {!embedded && <header className="site-assistant-header"><div><h2 id={titleId}>{tr({zh:'问 CubeRoot',en:'Ask CubeRoot'})}</h2><p>{tr({zh:'解答疑问、分析资料、探索魔方',en:'Ask, analyse and explore cubing'})}</p></div>
        <button className="site-assistant-action" type="button" onClick={()=>{imageJob.current++;processing.current=false;setProcessingImages(false);setImageError(null);stop();onNew();setEditing(null);setReference(null);setSelection(null);setDraft('');input.current?.focus();}} title={tr({zh:'新对话',en:'New conversation'})}><MessageSquarePlus size={20}/></button>
        <button className="site-assistant-action site-assistant-expand" type="button" onClick={()=>setExpanded(value=>!value)} title={tr(expanded?{zh:'退出全屏',en:'Exit full screen'}:{zh:'全屏',en:'Full screen'})}>{expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button>
        <button className="site-assistant-action" type="button" onClick={onClose} title={tr({zh:'关闭',en:'Close'})}><X size={22}/></button>
      </header>}
      <div className="site-assistant-body"><div ref={messages} onScroll={()=>{const node=messages.current;if(node && turns.length){follow.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;setShowLatest(!follow.current);}}} className="site-assistant-messages" onPointerUp={readSelection} onKeyUp={readSelection} role="log" aria-live="polite">
        {!turns.length && !searchResults && <div className="site-assistant-examples">
          <h3>{tr({zh:'你想了解什么？',en:'What would you like to know?'})}</h3>
          <div className="site-assistant-example-groups">{QUESTION_EXAMPLES.map(group=><section className="site-assistant-example-group" key={group.id} aria-labelledby={`${titleId}-examples-${group.id}`}>
            <div className="site-assistant-example-heading">
              <h4 id={`${titleId}-examples-${group.id}`}>{tr(group.title)}</h4>
              {group.note && <p className="site-assistant-examples-intro">{tr(group.note)}</p>}
            </div>
            {group.questions.map(example=><button className="site-assistant-action" type="button" key={example.en} onClick={()=>{stop();setDraft(tr(example));input.current?.focus();}}>{tr(example)}</button>)}
          </section>)}</div>
        </div>}
        {turns.map((turn,i)=>{
          const animate = !!turn.requestId && !initialAnswers.has(turn.requestId);
          const revealDone = !turn.partial;
          const tableLinks=new Set(turn.result?.artifacts?.flatMap(a=>a.kind==='table' ? [...a.links ?? [],...a.cellLinks?.flat() ?? []] : []) ?? []);
          const presentation=turn.result ? answerPresentation(turn.result,turn.partial) : null;
          const citedLinks=new Set(presentation?.sources.filter(source=>presentation.withFallback.includes(`[[${source.id}]]`)).map(source=>source.href));
          const seenActions=new Set<string>();
          const actions=turn.result?.actions?.filter(action=>{
            if(!isAssistantSourceHref(action.href) || tableLinks.has(action.href) || citedLinks.has(action.href) || seenActions.has(action.href))return false;
            seenActions.add(action.href);return true;
          }) ?? [];
          return <section className="site-assistant-turn" id={titleId+'-turn-'+i} key={turn.messageId ?? i}>{editing!==null && i===turns.length-1 ? <form className="site-assistant-edit" onSubmit={event=>{event.preventDefault();if((editing.trim()||turn.images?.length)&&editing.trim().length<=SITE_ASSISTANT_QUESTION_MAX_LENGTH&&!busy){turn.references?.length ? onAsk(editing.trim(),true,turn.images,turn.references) : onAsk(editing.trim(),true,turn.images);setEditing(null);}}}>
          {!!turn.images?.length && renderImages(turn.images)}<textarea ref={editInput} className="site-assistant-draft" aria-label={tr({zh:'编辑问题',en:'Edit question'})} value={editing} maxLength={SITE_ASSISTANT_QUESTION_MAX_LENGTH} rows={3} onChange={event=>setEditing(event.target.value)}/>
          <div className="site-assistant-edit-actions">{editing && <ClearButton variant="standalone" onClick={()=>setEditing('')}/>}<button type="button" className="site-assistant-action" onClick={()=>setEditing(null)}>{tr({zh:'取消',en:'Cancel'})}</button><button type="submit" className="site-assistant-action site-assistant-send" disabled={busy||editing.trim().length>SITE_ASSISTANT_QUESTION_MAX_LENGTH||(!editing.trim()&&!turn.images?.length)}>{tr({zh:'发送',en:'Send'})}</button></div>
        </form> : <div className="site-assistant-question">{turn.imagesExpired && <p className="site-assistant-note">{tr({zh:'较早的图片已释放，需要时请重新添加。',en:'Earlier images have been released. Attach them again if needed.'})}</p>}{!!turn.images?.length && renderImages(turn.images)}{turn.references?.map((item,j)=><div key={j}>{quoteCard(item)}</div>)}{turn.question && <h3 data-assistant-message="user" data-turn={i}>{turn.question}</h3>}<div className="site-assistant-question-actions">{turn.question && <Tooltip content={tr({zh:'引用问题',en:'Quote question'})}>{tip=><button {...tip} className="site-assistant-action" type="button" aria-label={tr({zh:'引用问题',en:'Quote question'})} onClick={()=>useQuote(quote(turn,i,'user'))}><Quote size={15}/></button>}</Tooltip>}<button className="site-assistant-action" type="button" onClick={()=>{if(navigator.clipboard)copy(turn.question,`question-${i}`);}} title={tr(copiedKey===`question-${i}`?{zh:'已复制',en:'Copied'}:{zh:'复制问题',en:'Copy question'})}>{copiedKey===`question-${i}`?<Check size={15}/>:<Copy size={15}/>}</button>{i===turns.length-1 && <button className="site-assistant-action" type="button" disabled={busy} onClick={()=>{stop();setEditing(turn.question);}} title={tr({zh:'编辑问题',en:'Edit question'})}><Pencil size={15}/></button>}</div></div>}
          {(turn.deliveryState==='queued' || turn.deliveryState==='applied') && <p className="site-assistant-note" role="status">{turn.deliveryState==='applied'?tr({zh:'已用于调整当前任务',en:'Applied to the current task'}):turn.targetId?tr({zh:'已收到，等待当前步骤结束',en:'Received; waiting for the current step'}):tr({zh:'已排队',en:'Queued'})}</p>}
          {((isRunning(turn,i)) || !!turn.progress?.length || !!turn.endState) && <AssistantExecutionProgress key={turn.createdAt ?? turn.requestId ?? i} turn={turn} busy={isRunning(turn,i)} stopping={stopping && isRunning(turn,i)} status={status}/>}
          {turn.result && <div className="site-assistant-response" data-assistant-message="assistant" data-turn={i}><SiteAssistantAnswerText result={turn.result} partial={turn.partial} requestId={turn.requestId} animate={animate} onRevealComplete={onRevealComplete}/>
          {revealDone && !turn.partial && !!actions.length && <div className="site-assistant-response-actions site-assistant-navigation">{actions.map(action=><Link key={action.id} className="site-assistant-action" href={action.href} {...sourceLinkProps(action.href)} onClick={event=>{if(turn.requestId)void sendAssistantEvent(turn.requestId,{type:'click',kind:'action',id:action.id}).catch(()=>{});openSolverDocument(event);}} prefetch={false}>{tr({zh:`打开 ${action.title}`,en:`Open ${action.title}`})}</Link>)}</div>}
          {revealDone && turn.result.artifacts?.map((a,j)=>a.kind==='algorithms'?<AssistantAlgorithmCards key={j} result={a} onAsk={busy ? undefined : question=>onAsk(question)} onChange={onAlgorithmChange && !turn.partial ? (card,expected,next)=>changeAlgorithm(i,j,card,expected,next) : undefined}/>:a.kind==='cube-photo'?<PhotoChatResult key={j} result={a}/>:a.kind==='progress'?<Progress key={j} chart={a}/>:<section key={j}><h4>{a.title}</h4><div className="site-assistant-table"><table><thead><tr>{a.columns.map((c,k)=><th key={k}>{c}</th>)}</tr></thead><tbody>{a.rows.map((row,k)=><tr key={k}>{row.map((cell,c)=>{
            const kind=a.columnKinds?.[c];
            const href=a.cellLinks?.[k]?.[c] ?? (c===0 ? a.links?.[k] : undefined);
            const compId=href && /^\/wca\/comp\/([A-Za-z0-9_-]+)$/.exec(href)?.[1];
            const dateColumn=a.columnKinds?.indexOf('date') ?? -1;
            const content=kind==='country' && cell ? <span title={countryName(cell,lang==='zh')}><Flag iso2={cell} spanClassName="country-flag" imgClassName="country-flag-ct"/></span> : compId ? <CompCell compId={compId} compName={cell} isZh={lang==='zh'} date={dateColumn>=0 ? row[dateColumn] : null}/> : cell;
            return <td key={c} className={kind==='date' ? 'site-assistant-date' : kind==='country' ? 'site-assistant-country' : undefined}>{href && isAssistantSourceHref(href) ? <Link prefetch={false} href={href} {...sourceLinkProps(href)}>{content}</Link> : content}</td>;
          })}</tr>)}</tbody></table></div></section>)}
        </div>}
          {turn.result && revealDone && !(isRunning(turn,i)) && <AssistantAnswerActions key={turn.requestId ?? i} turn={turn} lang={lang} active={active} onFeedback={onFeedback} onQuote={()=>useQuote(quote(turn,i,'assistant'))} onRetry={i===turns.length-1 && !error && !busy && editing===null ? ()=>turn.references?.length ? onAsk(turn.question,true,turn.images,turn.references) : onAsk(turn.question,true,turn.images) : undefined} onBranch={onBranch && !turn.partial && !busy ? ()=>onBranch(i) : undefined} preview={<><SiteAssistantAnswerText result={turn.result}/>{turn.result.artifacts?.filter(a=>a.kind==='algorithms').map((a,j)=><AssistantAlgorithmCards key={j} result={a}/>)}</>}/>}
          {turn.partial && !(isRunning(turn,i)) && <p className="site-assistant-incomplete">{tr({zh:'回答未完成',en:'Answer incomplete'})}</p>}
        </section>;})}
        {error && (error==='login_required'||error==='wca_link_required' ?
          <div className="site-assistant-auth" role="alert">
            <button className="site-assistant-auth-link" type="button" onClick={()=>authActions.login()}>
              <span>{tr(error==='login_required' ? {zh:'登录后继续聊天',en:'Sign in to continue chatting'} : {zh:'绑定 WCA 账号以继续',en:'Link your WCA account to continue'})}</span>
              <ArrowRight size={16} aria-hidden="true"/>
            </button>
          </div> :
          <div role="alert"><p>{tr(ASSISTANT_ERROR_TEXT[error])}</p>{error==='verification_required' ? <Link href={`/competition-verify?returnTo=${encodeURIComponent(lang==='zh'?'/zh':'/')}`} prefetch={false}>{tr({zh:'完成访问验证',en:'Verify access'})}</Link> : error!=='daily_limit' && error!=='account_forbidden' && turns.length>0 && <button className="site-assistant-action" type="button" disabled={busy||editing!==null} onClick={()=>onAsk(turns[turns.length-1].question,true,turns[turns.length-1].images,turns[turns.length-1].references)}>{tr({zh:'重试',en:'Retry'})}</button>}</div>)}
      </div>
      {showLatest && turns.length>0 && <button className="site-assistant-action site-assistant-latest" type="button" onClick={scrollLatest} title={tr({zh:'回到最新消息',en:'Jump to latest'})}><ArrowDown size={18}/></button>}</div>
      {selection && <button type="button" className="site-assistant-action site-assistant-quote-selection" onPointerDown={event=>event.preventDefault()} onClick={()=>useQuote(selection)}><Quote size={16}/>{tr({zh:'引用所选内容',en:'Quote selected text'})}</button>}
      {editing===null && searchResults}
      <form className="site-assistant-compose" onDragOver={event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();}} onDrop={event=>{event.preventDefault();void addImages(Array.from(event.dataTransfer.files));}} onSubmit={e=>{e.preventDefault();submit();}}><div className="site-assistant-input">
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event=>{const files=Array.from(event.target.files ?? []);event.target.value='';void addImages(files);}}/>
        {reference && quoteCard(reference,true)}
        {!!images.length && renderImages(images,true)}
        <textarea className="site-assistant-draft" onPaste={event=>{const files=Array.from(event.clipboardData.files);if(files.length){event.preventDefault();void addImages(files);}}} ref={input} aria-label={tr({zh:'继续提问',en:'Ask a follow-up'})} placeholder={authPlaceholder ?? tr({zh:'随心输入',en:'Type anything'})} maxLength={SITE_ASSISTANT_QUESTION_MAX_LENGTH} rows={1} disabled={editing!==null} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!window.matchMedia?.('(pointer: coarse)').matches){e.preventDefault();submit();}}}/>
        {draft.length>=SITE_ASSISTANT_QUESTION_MAX_LENGTH*.9 && <span className="site-assistant-input-count" role="status">{draft.length}/{SITE_ASSISTANT_QUESTION_MAX_LENGTH}</span>}
        <div className="site-assistant-input-actions">
          <CompactSelect className="site-assistant-attachments" triggerClassName="site-assistant-action" popupClassName="site-assistant-menu site-assistant-attachment-menu" unstyledTrigger
            label={<Plus size={20}/>} ariaLabel={tr({zh:'添加附件',en:'Add attachments'})}
            items={[{value:'images',label:<span className="site-assistant-attachment-option"><span className="site-assistant-attachment-icon" aria-hidden="true"><ImageIcon size={22}/></span>{tr({zh:'照片',en:'Photos'})}</span>}]}
            onChange={()=>imageInput.current?.click()} disabled={submitting||editing!==null||processingImages||images.length>=SITE_ASSISTANT_MAX_IMAGES}/>
          {!busy && (openaiAvailable && onProviderChange ? <CompactSelect className="site-assistant-thinking site-assistant-provider" popupClassName="site-assistant-menu"
            items={[{value:'openai' as const,label:'GPT-5.4-mini'},{value:'bailian' as const,label:'Qwen3.8-Flash'}]}
            value={provider} onChange={onProviderChange} label={providerLabel}
            ariaLabel={tr({zh:'AI 服务',en:'AI provider'})} variant="plain" preserveFocus/> : <span className="site-assistant-thinking site-assistant-provider site-assistant-provider-label">{providerLabel}</span>)}
          {!busy && <CompactSelect className="site-assistant-thinking" popupClassName="site-assistant-menu" items={thinkingItems} value={thinking} onChange={onThinkingChange} label={thinkingItems.find(item=>item.value===thinking)!.label} ariaLabel={tr({zh:'思考模式',en:'Thinking mode'})} variant="plain" preserveFocus/>}
          <button className="site-assistant-action site-assistant-mic" type="button" disabled={editing!==null} onClick={()=>listening?stop():void start()} title={tr({zh:'语音输入',en:'Voice input'})} aria-pressed={listening}><Mic size={19}/></button>
          {busy && <CompactSelect className="site-assistant-thinking" popupClassName="site-assistant-menu" items={[{value:'steer' as const,label:tr({zh:'调整当前任务',en:'Adjust current task'})},{value:'queue' as const,label:tr({zh:'加入队列',en:'Add to queue'})}]} value={deliveryMode} onChange={setDeliveryMode} label={deliveryMode==='steer'?tr({zh:'调整当前任务',en:'Adjust current task'}):tr({zh:'加入队列',en:'Add to queue'})} ariaLabel={tr({zh:'发送方式',en:'Delivery mode'})} variant="plain" preserveFocus/>}
          {busy && <Tooltip content={tr(stopping?{zh:'正在停止',en:'Stopping'}:{zh:'停止',en:'Stop'})}>{tip=><button {...tip} className="site-assistant-action site-assistant-send" type="button" disabled={stopping} onClick={onStop} aria-label={tr({zh:'停止',en:'Stop'})}><Square size={16} fill="currentColor"/></button>}</Tooltip>}
          {(!busy || draft.trim() || images.length>0) && <Tooltip content={authSendLabel ?? tr(busy?(deliveryMode==='steer'?{zh:'调整当前任务',en:'Adjust current task'}:{zh:'加入队列',en:'Add to queue'}):{zh:'发送',en:'Send'})}>{tip=><button {...tip} className={`site-assistant-action site-assistant-send${authSendLabel ? ' site-assistant-auth-send' : ''}`} type="submit" disabled={stopping||submitting||(!draft.trim()&&!images.length)||draft.trim().length>SITE_ASSISTANT_QUESTION_MAX_LENGTH||editing!==null||processingImages} aria-label={authSendLabel ?? tr(busy?(deliveryMode==='steer'?{zh:'调整当前任务',en:'Adjust current task'}:{zh:'加入队列',en:'Add to queue'}):{zh:'发送',en:'Send'})}>{authSendLabel ?? <ArrowUp size={20}/>}</button>}</Tooltip>}
        </div>
      </div>{processingImages && <p role="status">{tr({zh:'正在处理图片…',en:'Preparing images…'})}</p>}
      {quoteError && <p role="alert">{tr({zh:'引用内容较长，请选中需要引用的片段。',en:'This quote is too long. Select a shorter passage.'})}</p>}
      {authNotice && <p className="site-assistant-note" role="alert">{authNotice}</p>}
      {paused && !stopping && <p className="site-assistant-note" role="status">{tr({zh:'任务和队列已暂停',en:'Task and queue paused'})} <button type="button" className="site-assistant-action" disabled={stopping} onClick={onResume}>{tr({zh:'恢复执行',en:'Resume'})}</button></p>}
      {recovering && <p className="site-assistant-note" role="status">{tr({zh:'正在恢复已保存的进度',en:'Restoring saved progress'})}</p>}
      {stopUnconfirmed && <p role="alert">{tr({zh:'尚未确认停止，请重试停止。补充内容仍保留在输入框。',en:'Stop has not been confirmed. Try stopping again. Your draft is still in the input.'})}</p>}
      {imageError && <p role="alert">{imageError}</p>}
      {!!images.length && <p className="site-assistant-note">{tr({zh:'发送后，图片会保存为私有会话附件并交给 AI 识别。追问可参考最近 3 张图片。',en:'Sent images are saved as private chat attachments and processed by AI. Follow-ups can reference the latest 3 images.'})}</p>}
      {micError && <p className="site-assistant-voice-error" role="status">{tr({zh:'语音未能识别，请检查麦克风权限，或使用键盘听写。',en:'Voice recognition failed. Check microphone permissions or use keyboard dictation.'})}</p>}
      {provider==='openai' && <p className="site-assistant-note">{tr({zh:'发送后，本次问题、最近对话和附件将交由 OpenAI 处理。',en:'Sending shares this question, recent conversation and attachments with OpenAI.'})}</p>}
      <p className="site-assistant-note">{tr({zh:'AI 回答可能有误，请核对来源。WCA 数据以最近导入为准。',en:'AI can make mistakes. Check sources. WCA data reflects the latest import.'})}</p></form>
    </div>;
  return embedded ? content : <AssistantModal onClose={onClose} motionRef={motionRef}>{content}</AssistantModal>;
}
