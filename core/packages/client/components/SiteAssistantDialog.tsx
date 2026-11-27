'use client';

import { useAssistantTextReveal } from '@/hooks/useAssistantTextReveal';
import MoreToggle, { MoreTogglePanel } from '@/components/MoreToggle';
import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, RefObject } from 'react';
import remarkGfm from 'remark-gfm';
// Keep Markdown off the homepage's initial path. Resolve it while the visitor
// composes so the first verified answer can paint with its citation links.
type MarkdownRenderer = typeof import('react-markdown')['default'];
let readyMarkdown: MarkdownRenderer | undefined;
const loadMarkdown = () => import('react-markdown').then(module => {
  readyMarkdown = module.default;
  return module;
}).catch(() => ({ default: ({ children }: { children?: string | null }) => <>{children}</> }));
const DeferredMarkdown = lazy(loadMarkdown);
const WrHistoryChart = lazy(() => import('@/components/wca-stats/WrHistoryChart').catch(() => ({ default: () => null })));
import { useCopy } from '@/hooks/useCopy';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, ArrowRight, Check, Copy, Pencil, Maximize2, Minimize2, MessageSquarePlus, Image as ImageIcon, Plus, Mic, Square, Quote, X } from '@app-foundation/icons/lucide';
import { SITE_ASSISTANT_MAX_IMAGES, SITE_ASSISTANT_QUESTION_MAX_LENGTH, isAssistantSourceHref, type AssistantImage, type AssistantAnswer, type AssistantChart, type AssistantStatus, type AssistantErrorCode, type ChatProvider, type AssistantThinkingMode } from '@cuberoot/shared/site-assistant';
import { ASSISTANT_ERROR_TEXT } from '@/lib/site-assistant-errors';
import { authActions } from '@/lib/auth-store';
import { formatWcaResult } from '@/lib/wca-format-result';
import { useDialogMotion, useModalDismiss } from '@/hooks/useModalDismiss';
import { speechInputError } from '@/lib/speech-input-error';
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
import AssistantComposerSettings from './AssistantComposerSettings';
import AssistantAnswerBody from './AssistantAnswerBody';
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
import { assistantProgressView } from '@/lib/assistant-progress';
import { assistantProgressScope } from '@cuberoot/shared/site-assistant';
import { eventDisplayName } from '@/lib/wca-events';
import { formatDateRangeIso } from '@/lib/wca-date';

import type { ReplayReply } from '@/lib/assistant-conversations';
const ReplayReplyCard = lazy(() => import('./ReplayReplyCard'));

export interface AssistantTurn { replayReport?: ReplayReply; serverAnswerUpdatedAt?:number; deliveryState?:'queued'|'running'|'applied'|'completed'|'stopped'|'error'; deliveryError?:AssistantErrorCode; targetId?:string; messageId?:string; answerVersion?:number; references?:AssistantReference[]; createdAt?: number; finishedAt?: number; endState?: 'complete'|'stopped'|'error'; progress?: AssistantProgress[]; requestId?: string; feedback?: AssistantFeedback|null; question:string; images?:AssistantImage[]; imagesExpired?:boolean; result?:AssistantAnswer; partial?:boolean }
interface Props {
  practiceChatId?: string;
  onAlgorithmChange?:(turn:number, artifact:number, card:number, expected:AssistantAlgorithmCard, next:AssistantAlgorithmCard)=>void;
  onAnswerRevealed?:(id:string,text:string)=>void;
  embedded?:boolean; active?:boolean; searchResults?:ReactNode; onBranch?:(index:number)=>void;
  turns:AssistantTurn[]; status?:AssistantStatus; busy:boolean; paused?:boolean; recovering?:boolean; activeMessageId?:string; onResume?:()=>void|Promise<void>; stopping?:boolean; stopUnconfirmed?:boolean; error:AssistantErrorCode|null; lang:'zh'|'en';
  images:AssistantImage[]; onImagesChange:(images:AssistantImage[])=>void;
  draft:string; onDraftChange:(draft:string)=>void;
  onAuthSend?:(question:string,images:AssistantImage[],references:AssistantReference[])=>boolean;
  authSendLabel?:string; authPlaceholder?:string; authNotice?:string;
  openaiAvailable?:boolean; provider:ChatProvider; onProviderChange:(value:ChatProvider)=>void;
  thinking:AssistantThinkingMode; onThinkingChange:(mode:AssistantThinkingMode)=>void;
  onFeedback:(id:string,value:AssistantFeedback|null)=>void;
  onAsk:(question:string,replaceLast?:boolean,images?:AssistantImage[],references?:AssistantReference[],mode?:'steer'|'queue'|'parallel')=>Promise<boolean>|void; onStop:()=>void; onClose:()=>void; onNew:()=>void;
}
const QUERY_LABELS: Record<string, {zh:string;en:string}> = {
  annual_attendance:{zh:'正在统计单年参赛场数',en:'Counting competitions by calendar year'},
  recent_3x3_champions:{zh:'正在统计 WCA 三阶决赛夺冠次数',en:'Counting WCA 3×3 final wins'},
  competition_round:{zh:'正在查询比赛轮次成绩',en:'Reading round results'},
  competition_schedule:{zh:'正在核对场馆赛程和官方报名',en:'Checking venue schedules and WCA registration'},
  web_search:{zh:'正在搜索网络资料',en:'Searching the web'},
  news:{zh:'正在查询 WCA 官方新闻',en:'Reading WCA news'},
  lookup_cube_photo:{zh:'正在识别魔方并验证公式',en:'Identifying the cube and verifying algorithms'},
  my_formula_reviews:{zh:'正在读取你的公式复习记录',en:'Reading your formula reviews'},
  verify_cube_moves:{zh:'正在用三阶状态验证转法',en:'Checking moves against the 3×3 cube state'},
  navigation:{zh:'正在查找功能入口',en:'Finding site tools'},
  pages:{zh:'正在查询站内页面',en:'Searching site pages'},
  records:{zh:'正在查询纪录',en:'Looking up records'},
  find_person:{zh:'正在查找选手',en:'Finding a competitor'},
  person:{zh:'正在读取选手成绩',en:'Reading competitor results'},
  person_competitions:{zh:'正在统计选手参加过的比赛',en:'Counting competitions the competitor entered'},
  person_countries:{zh:'正在按举办地统计参赛记录',en:'Grouping competition entries by host country or region'},
  rankings:{zh:'正在查询排名',en:'Looking up rankings'},
  competitions:{zh:'正在查找比赛',en:'Finding competitions'},
  scrambles:{zh:'正在读取比赛打乱',en:'Reading competition scrambles'},
  recons:{zh:'正在查找公开复盘',en:'Finding public reconstructions'},
  recon:{zh:'正在读取复盘步骤',en:'Reading reconstruction steps'},
  glossary:{zh:'正在查询魔方术语',en:'Looking up cubing terms'},
  forum:{zh:'正在查询论坛内容',en:'Searching forum posts'},
  algorithms:{zh:'正在查询公式库',en:'Searching algorithms'},
  statistics:{zh:'正在查询统计数据',en:'Looking up statistics'},
  statistics_metadata:{zh:'正在核对统计口径与可用筛选条件',en:'Checking the statistic’s methodology and filters'},
  analysis_schema:{zh:'正在确认可查询的资料和字段',en:'Checking available datasets and fields'},
  analysis_query:{zh:'正在按问题条件筛选并汇总数据',en:'Filtering and aggregating data for the request'},
  deliberate:{zh:'正在切换深入分析',en:'Starting deeper analysis'},
};
type Example = {zh:string; en:string; featured?:boolean; image?:boolean};
const QUESTION_EXAMPLES: {id:string; title:{zh:string;en:string}; questions:Example[]}[] = [
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
    {featured:true,zh:'我想学 CFOP 公式，帮我找到对应页面。',en:'I want to learn CFOP algorithms. Show me the relevant pages.'},
    {zh:'先学简单一点的，帮我找到 2 步 OLL 和 2 步 PLL。',en:'Start with something simpler. Show me 2-look OLL and 2-look PLL.'},
    {zh:'我想学桥式的 CMLL 公式。',en:'I want to learn CMLL algorithms for Roux.'},
  ]},
  {id:'practice',title:{zh:'专项训练',en:'Targeted practice'},questions:[
    {featured:true,zh:'我想练习 PLL 识别，打开识别训练。',en:'I want to practise PLL recognition. Show me the recognition trainer.'},
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
    {featured:true,zh:'找找接下来在中国举行的比赛。',en:'Find upcoming competitions in China.'},
    {zh:'目前三阶魔方的单次和平均世界纪录是多少？',en:'What are the current 3x3 single and average world records?'},
  ]},
  {id:'analysis',title:{zh:'按条件做统计',en:'Custom statistics'},questions:[
    {zh:'把我去年的参赛次数按月份统计。',en:'Break down my competition count last year by month.'},
    {zh:'我去年和前年的参赛次数相差多少？',en:'How did my competition count change between last year and the year before?'},
    {zh:'我去年三阶比赛中每次还原的 DNF 比例是多少？',en:'What percentage of my 3x3 attempts last year were DNFs?'},
    {zh:'我去年在哪些国家或地区参加过比赛？分别多少场？',en:'Which countries or regions did I compete in last year, and how many competitions in each?'},
  ]},
  {id:'images',title:{zh:'看图与复盘',en:'Images and reconstructions'},questions:[
    {image:true,zh:'帮我读出这张成绩截图里的项目和成绩。',en:'Read the events and results in this screenshot.'},
    {image:true,zh:'识别图片里的公式，保留原始转动符号。',en:'Read the algorithm in this image, preserving the original move notation.'},
    {image:true,zh:'解释这张统计图的坐标轴和变化趋势。',en:'Explain the axes and trends in this chart.'},
    {featured:true,zh:'找找耿暄一最近的三阶公开复盘。',en:'Find Xuanyi Geng’s latest public 3x3 reconstructions.'},
  ]},
];
export function assistantToolLabel(tool: string) {
  return tr(QUERY_LABELS[tool] ?? {zh:'查询资料', en:'Source lookup'});
}
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
function AssistantExecutionProgress({turn,busy,status,stopping,lang}:{turn:AssistantTurn;busy:boolean;status:AssistantStatus;stopping?:boolean;lang:'zh'|'en'}) {
  const [expanded,setExpanded]=useState(false);
  const [now,setNow]=useState(Date.now);
  const panelId=useId();
  useEffect(()=>{ if(!busy){setExpanded(false);return;} const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer); },[busy]);
  const {steps,current}=assistantProgressView(turn.progress ?? []);
  const stepTitle=(step:AssistantProgress,live:boolean)=>{
    const label=step.phase==='tool'
      ? tr(QUERY_LABELS[step.tool ?? ''] ?? {zh:'正在查询资料',en:'Looking up sources'})
      : tr(step.phase==='review' ? {zh:'正在对照证据核对回答',en:'Checking the answer against the evidence'} : step.activity==='write' || busy && step===current && turn.partial
        ? {zh:'正在组织内容并生成回答',en:'Organizing and writing the answer'} : {zh:'正在梳理问题并规划回答',en:'Breaking down the request and planning the answer'});
    const scope=assistantProgressScope(step.scope);
    const event=scope?.event ? eventDisplayName(scope.event,lang==='zh') : undefined;
    const dates=scope?.from && scope.to ? formatDateRangeIso(scope.from,scope.to) : undefined;
    return [tr({zh:`第 ${step.id} 步`,en:`Step ${step.id}`}),live?label:label.replace(/^正在/,''),event,dates,
      step.reused && tr({zh:'已复用查询结果',en:'Reused saved result'})].filter(Boolean).join(' · ');
  };
  const evidence=steps.findLast(step=>step.phase==='tool' && (step.state==='partial' || step.state==='error' || step.state==='complete' && (step.reused || !!step.sourceCount)));
  const evidenceSummary=evidence && [
    evidence.state==='partial' ? tr({zh:'资料不完整',en:'Partial data'}) :
      evidence.state==='error' ? tr({zh:'查询未成功',en:'Query failed'}) :
      evidence.sourceCount ? tr({zh:`已读取 ${evidence.sourceCount} 条来源`,en:`${evidence.sourceCount} sources read`}) : null,
    stepTitle(evidence,false),
    evidence.reused && evidence.state==='partial' && !busy && turn.endState==='error' && tr({zh:'可缩小范围后再查',en:'Try a narrower query'}),
  ].filter(Boolean).join(' · ');
  const interrupted=turn.endState==='error' && current && (current.state==='running' || current.state==='error');
  const summary=stopping ? tr({zh:'正在停止',en:'Stopping'}) : busy ? current ? stepTitle(current,true) : statusLabel(status)
    : interrupted ? stepTitle(current,false)+' · '+tr(turn.deliveryError==='timeout'?{zh:'超时',en:'Timed out'}:{zh:'未完成',en:'Could not complete'})
    : tr(turn.endState==='complete' || (turn.result && !turn.partial) ? {zh:'处理完成',en:'Completed'} : turn.endState==='stopped' ? {zh:'已停止',en:'Stopped'} : {zh:'处理未完成',en:'Could not complete'});
  const heading=!stopping && evidenceSummary && (!busy || current?.phase==='model' && current.activity!=='write' && !turn.partial)
    ? evidenceSummary : summary;
  const elapsed=Math.max(0,((busy ? now : turn.finishedAt ?? turn.createdAt ?? now)-(turn.createdAt ?? now))/1000);
  return <div className="site-assistant-progress" data-active={busy && !stopping}>
    <div className="site-assistant-progress-heading" data-evidence={heading===evidenceSummary || undefined}>
      <span className="site-assistant-progress-active-text" role="status" aria-live="polite" title={heading}>{heading}</span>
      <span className="site-assistant-progress-time" aria-hidden="true">{elapsed.toFixed(0)} s</span>
      {!busy && !!steps.length && <MoreToggle expanded={expanded} onToggle={()=>setExpanded(!expanded)} aria-controls={panelId}><span className="site-assistant-progress-active-text">{tr({zh:'处理过程',en:'Activity'})}</span></MoreToggle>}
    </div>
    {!busy && !!steps.length && <MoreTogglePanel id={panelId} expanded={expanded}>
      <ol className="site-assistant-progress-steps">{steps.map(step=>{
        const state=step.state==='running' && !busy ? 'stopped' : step.state;
        const label=tr(state==='complete' ? {zh:'完成',en:'Finished'} : state==='partial' ? {zh:'信息不完整',en:'Partial information'} : state==='error' ? {zh:'未成功',en:'Failed'} : state==='stopped' ? {zh:'已中断',en:'Interrupted'} : {zh:'进行中',en:'In progress'});
        return <li key={step.id} data-state={state}>
          {state==='complete' ? <Check size={13} aria-hidden="true"/> : state==='error' || state==='stopped' ? <X size={13} aria-hidden="true"/> : <span className="site-assistant-progress-dot" aria-hidden="true"/>}
          <span>{stepTitle(step,false)} · {label}{!!step.sourceCount && <span> · {tr({zh:`已读取 ${step.sourceCount} 条来源`,en:`${step.sourceCount} sources read`})}</span>}</span>
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
  const Markdown=readyMarkdown ?? DeferredMarkdown;
  const {sources,text,withFallback}=answerPresentation(result,partial);
  const resolveLink=assistantAnswerLinks(result);
  const markdown=withFallback.replace(/\[\[([^\]\n]+)\]\]/g,(_marker,id:string)=>{
    const index=sources.findIndex(source=>source.id===id);
    return index<0 ? '' : `[${index+1}](#assistant-source-${index})`;
  });
  return <div className="site-assistant-prose"><Suspense fallback={<p>{text.replace(/\[\[[^\]\n]+\]\]/g, '')}</p>}><Markdown skipHtml remarkPlugins={[remarkGfm,remarkAssistantLinks(resolveLink)]}
    allowedElements={['p','strong','em','del','code','pre','ul','ol','li','blockquote','h1','h2','h3','h4','hr','br','a','span','table','thead','tbody','tr','th','td']}
    components={{table:({children})=><div className="site-assistant-table"><table>{children}</table></div>,a:({href,children})=>{
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

export function SiteAssistantResult({artifact: a, lang}: {artifact: NonNullable<AssistantAnswer['artifacts']>[number]; lang: 'en' | 'zh'}) {
  if (a.kind === 'algorithms') return <AssistantAlgorithmCards result={a}/>;
  return a.kind==='cube-photo'?<PhotoChatResult result={a}/>:a.kind==='progress'?<Progress chart={a}/>:<section><h4>{a.title}</h4><div className="site-assistant-table"><table><thead><tr>{a.columns.map((c,k)=><th key={k}>{c}</th>)}</tr></thead><tbody>{a.rows.map((row,k)=><tr key={k}>{row.map((cell,c)=>{
            const kind=a.columnKinds?.[c];
            const href=a.cellLinks?.[k]?.[c] ?? (c===0 ? a.links?.[k] : undefined);
            const compId=href && /^\/wca\/comp\/([A-Za-z0-9_-]+)$/.exec(href)?.[1];
            const dateColumn=a.columnKinds?.indexOf('date') ?? -1;
            const content=kind==='country' && cell ? <span title={countryName(cell,lang==='zh')}><Flag iso2={cell} spanClassName="country-flag" imgClassName="country-flag-ct"/></span> : compId ? <CompCell compId={compId} compName={cell} isZh={lang==='zh'} date={dateColumn>=0 ? row[dateColumn] : null}/> : cell;
            return <td key={c} className={kind==='date' ? 'site-assistant-date' : kind==='country' ? 'site-assistant-country' : undefined}>{href && isAssistantSourceHref(href) ? <Link prefetch={false} href={href} {...sourceLinkProps(href)}>{content}</Link> : content}</td>;
          })}</tr>)}</tbody></table></div></section>;
}

export default function SiteAssistantDialog({practiceChatId,onAuthSend,authSendLabel,authPlaceholder,authNotice,onAlgorithmChange,onAnswerRevealed,turns,draft,images,onImagesChange:setImages,onDraftChange:setDraft,provider,openaiAvailable=false,onProviderChange,thinking,onThinkingChange,status={phase:'planning'},busy,paused=false,recovering=false,activeMessageId,onResume,stopping=false,stopUnconfirmed=false,error,lang,onAsk,onStop,onClose:onClosed,onNew,onFeedback,embedded=false,active=true,searchResults,onBranch}:Props) {
  useEffect(()=>{if(active && !readyMarkdown)void loadMarkdown();},[active]);
  const [deliveryMode,setDeliveryMode]=useState<'steer'|'queue'|'parallel'>('steer');
  const isRunning=(turn:AssistantTurn,index:number)=>busy && (activeMessageId?turn.messageId===activeMessageId:index===turns.length-1);
  const { motionRef, close: onClose } = useDialogMotion(onClosed, { enabled: !embedded });
  const [initialAnswers] = useState(() => new Set(turns.filter(turn => turn.result && !turn.partial).map(turn => turn.requestId)));
  const onRevealComplete = useCallback((id:string, text:string) => {
    onAnswerRevealed?.(id, text);
  }, [onAnswerRevealed]);
  const titleId=useId();
  const [imageError,setImageError]=useState<string|null>(null);
  const [processingImages,setProcessingImages]=useState(false);
  const imageInput=useRef<HTMLInputElement>(null);
  const imageJob=useRef(0);
  const processing=useRef(false);
  useEffect(()=>()=>{imageJob.current++;},[]);
  const pickerQuestion=useRef<string|null>(null);
  const addImages=async(files:File[],question?:string|null)=>{
    if(submitLock.current || processing.current || editing!==null || !files.length)return;
    setImageError(null);
    if(images.length+files.length>SITE_ASSISTANT_MAX_IMAGES){setImageError(tr({zh:'每次最多添加 3 张图片。',en:'Add up to 3 images per message.'}));return;}
    const job=++imageJob.current;
    processing.current=true;setProcessingImages(true);
    const prepared:AssistantImage[]=[];
    try {
      for(const file of files){
        prepared.push(await prepareAssistantImage(file));
        if(job!==imageJob.current)return;
      }
    } catch {
      if(job===imageJob.current)setImageError(tr({zh:'图片无法读取。请选择 10 MB 以内的 JPG、PNG 或 WebP；图片过大时请先裁剪。',en:'Could not read the image. Choose a JPG, PNG or WebP under 10 MB; crop large images first.'}));
      return;
    } finally {if(job===imageJob.current){processing.current=false;setProcessingImages(false);}}
    const attachments=[...images,...prepared];
    setImages(attachments);
    if (question && input.current?.value===draft && !dialog.current?.closest('[hidden], [inert]')) await submit(question,attachments);
  };
  const renderImages=(items:AssistantImage[],removable=false)=><div className="site-assistant-images">{items.map((image,index)=><div className="site-assistant-image" key={index}>
    {/* Saved references are fetched with owner authentication, never from public article storage. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <AssistantImagePreview image={image} index={index} />
    {removable && <Tooltip content={tr({zh:'移除图片',en:'Remove image'})}>{tip=><button {...tip} type="button" className="site-assistant-action" disabled={processingImages} aria-label={tr({zh:`移除图片 ${index+1}`,en:`Remove image ${index+1}`})} onClick={()=>{setImages(images.filter((_,i)=>i!==index));setImageError(null);}}><X size={14}/></button>}</Tooltip>}
  </div>)}</div>;
  const [expanded,setExpanded]=useState(false);
  const [showLatest,setShowLatest]=useState(false);
  const [unreadContent,setUnreadContent]=useState(false);
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
    document.getElementById(titleId+'-turn-'+index)?.scrollIntoView({block:'center',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
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
  const composer=useRef<HTMLFormElement>(null);
  const cardScroll=useRef<number|null>(null);
  const changeAlgorithm=(turn:number,artifact:number,card:number,expected:AssistantAlgorithmCard,next:AssistantAlgorithmCard)=>{
    cardScroll.current=messages.current?.scrollTop ?? null;
    onAlgorithmChange?.(turn,artifact,card,expected,next);
  };
  const follow=useRef(true);
  const previousTurns=useRef(turns);
  const input=useRef<HTMLTextAreaElement>(null);
  const editInput=useRef<HTMLTextAreaElement>(null);
  const volumeMeter = useRef<HTMLMeterElement>(null);
  const updateVolume = useCallback((level: number) => {
    if (volumeMeter.current) volumeMeter.current.value = level;
  }, []);
  const {listening, status: micStatus, error: micError, microphone, start, startWithBrowserMicrophone, stop} = useSpeechToText({
    lang: lang === 'zh' ? 'zh-CN' : 'en-US', onResult: setDraft, onAudioLevel: updateVolume,
  });
  const micLabel = tr(listening ? {zh:'停止听写',en:'Stop dictation'} : {zh:'语音输入',en:'Voice input'});
  useEffect(()=>{if(!active)stop();},[active,stop]);
  useEffect(()=>{if(!active)return;const previous=document.activeElement as HTMLElement;input.current?.focus({preventScroll:true});return()=>{if(!embedded)previous?.focus();};},[active,embedded]);
  const latestIsReplay=!!turns.at(-1)?.replayReport;
  useLayoutEffect(()=>{
    const form=composer.current, panel=dialog.current;
    if (!form || !panel) return;
    const measure=()=>{
      const height=form.offsetHeight+'px';
      if (panel.style.getPropertyValue('--assistant-composer-height')===height) return;
      panel.style.setProperty('--assistant-composer-height',height);
      const log=messages.current;
      if (log && follow.current && previousTurns.current.length && !latestIsReplay) log.scrollTop=log.scrollHeight;
    };
    measure();
    if (typeof ResizeObserver==='undefined') return;
    const observer=new ResizeObserver(measure);
    observer.observe(form,{box:'border-box'});
    return ()=>observer.disconnect();
  },[latestIsReplay]);
  useLayoutEffect(()=>{
    const previous=previousTurns.current;
    previousTurns.current=turns;
    if (!follow.current && turns!==previous && (turns.length>previous.length || turns.some((turn,index)=>{
      const result=turn.result, old=previous[index]?.result;
      return result && (result.answer!==old?.answer || result.artifacts?.length!==old?.artifacts?.length);
    }))) setUnreadContent(true);
    const node=messages.current;
    if(node && cardScroll.current!==null) { node.scrollTop=cardScroll.current; cardScroll.current=null; return; }
    if(node && follow.current) {
      if (turns.at(-1)?.replayReport) {
        const turn = node.querySelectorAll('.site-assistant-turn')[turns.length - 1];
        if (turn) node.scrollTop += turn.getBoundingClientRect().top - node.getBoundingClientRect().top;
      } else node.scrollTop = turns.length ? node.scrollHeight : 0;
    }
  },[turns,busy,error,status]);
  useEffect(()=>{
    const node=input.current;
    if(node) { node.style.height='auto'; node.style.height=`${Math.min(node.scrollHeight,180)}px`; }
  },[draft,expanded]);
  const isEditing=editing!==null;
  useEffect(()=>{if(!active)return;if(isEditing)editInput.current?.focus();else if(!window.matchMedia?.('(pointer: coarse)').matches)input.current?.focus();},[isEditing,active]);
  const scrollLatest=()=>{follow.current=true;setShowLatest(false);setUnreadContent(false);const node=messages.current;if(node)node.scrollTop=node.scrollHeight;};
  const modeLabel=deliveryMode==='parallel'?tr({zh:'在新对话并行处理',en:'Send in a new chat'}):deliveryMode==='steer'?tr({zh:'调整当前任务',en:'Adjust current task'}):tr({zh:'加入队列',en:'Add to queue'});
  const sendLabel=authSendLabel ?? (paused ? tr({zh:'在新对话提问',en:'Ask in a new chat'}) : busy ? modeLabel : tr({zh:'发送',en:'Send'}));
  const submit=async(question=draft,attachments=images)=>{
    if(submitLock.current || stopping || processing.current || editing!==null || (!question.trim() && !attachments.length) || question.trim().length>SITE_ASSISTANT_QUESTION_MAX_LENGTH)return;
    const needsPhoto=QUESTION_EXAMPLES.some(group=>group.questions.some(example=>example.image && (example.zh===question.trim() || example.en===question.trim())));
    if (needsPhoto && (authSendLabel || !attachments.length)) {
      stop();
      if (authSendLabel) { setDraft(question);authActions.login();return; }
      pickerQuestion.current=question;imageInput.current?.click();return;
    }
    submitLock.current=true;setSubmitting(true);follow.current=true;setUnreadContent(false);stop();
    try {
      if (authSendLabel && onAuthSend) {
        if (question!==draft) setDraft(question);
        onAuthSend(question, attachments, reference ? [reference] : []);
        return;
      }
      const accepted=await onAsk(question.trim(),false,attachments,reference?[reference]:[],busy?deliveryMode:'queue');
      if(accepted!==false){if(input.current?.value===draft)setDraft('');setImages([]);setReference(current=>current===reference?null:current);setImageError(null);}
      else if(question!==draft && input.current?.value===draft)setDraft(question);
    } finally {submitLock.current=false;setSubmitting(false);}
  };
  const exampleButton=(example:Example)=>{
    const question=tr(example);
    const needsImage=example.image && !images.length;
    const label=authSendLabel && example.image ? authPlaceholder : needsImage ? tr({zh:'选择图片',en:'Choose image'}) : authSendLabel;
    return <button className="site-assistant-action" type="button" key={example.en} disabled={submitting || stopping || processingImages}
      aria-label={label ? label+' · '+question : undefined} onClick={()=>void submit(question)}>{example.image && <ImageIcon size={16} aria-hidden="true"/>}{question}</button>;
  };
  const unfinished=turns.findLast(turn=>!turn.targetId && (turn.deliveryState==='stopped' || turn.deliveryState==='error'));
  const latestRoot=turns.findLast(turn=>!turn.targetId);
  const recoveryTurn=paused ? unfinished ?? latestRoot : latestRoot;
  const recoveryError=error ?? (paused ? unfinished?.deliveryError : undefined);
  const retryAt=recoveryError==='model_rate_limited' ? recoveryTurn?.progress?.at(-1)?.retryAt : undefined;
  const authError=recoveryError==='login_required' || recoveryError==='wca_link_required';
  const retryAllowed=!authError && recoveryError!=='account_forbidden' && recoveryError!=='daily_limit' && recoveryError!=='verification_required';
  const canResume=!!onResume && !!recoveryTurn?.messageId && recoveryTurn===unfinished;
  const failedTurn=recoveryTurn?.endState==='error' || recoveryTurn?.endState==='stopped';
  const mayResume=canResume || (paused && !unfinished && !failedTurn && !!onResume);
  const [resuming,setResuming]=useState(false);
  const resumeLock=useRef(false);
  const resume=async()=>{
    if (resumeLock.current || !onResume) return;
    resumeLock.current=true;setResuming(true);
    try { await onResume(); } finally {resumeLock.current=false;setResuming(false);}
  };
  function recoveryAction() {
    if (authError) return <button className="site-assistant-auth-link" type="button" onClick={()=>authActions.login()}>
      {tr(recoveryError==='login_required' ? {zh:'登录后继续聊天',en:'Sign in to continue chatting'} : {zh:'绑定 WCA 账号以继续',en:'Link your WCA account to continue'})}<ArrowRight size={16}/>
    </button>;
    if (recoveryError==='verification_required') return <Link href={`/competition-verify?returnTo=${encodeURIComponent(lang==='zh'?'/zh/chat':'/chat')}`} prefetch={false}>{tr({zh:'完成访问验证',en:'Verify access'})}</Link>;
    if (!retryAllowed) return null;
    const disabled=busy || stopping || editing!==null;
    if (mayResume) return <button type="button" className="site-assistant-action" disabled={disabled || resuming} onClick={()=>void resume()}>
      {tr(canResume ? {zh:'继续当前任务',en:'Continue this task'} : {zh:'恢复队列',en:'Resume queue'})}
    </button>;
    if (recoveryTurn && failedTurn) return <button type="button" className="site-assistant-action" disabled={disabled} onClick={()=>void onAsk(recoveryTurn.question,true,recoveryTurn.images,recoveryTurn.references,paused?'parallel':'queue')}>
      {tr(paused ? {zh:'在新对话重新提问',en:'Ask again in a new chat'} : {zh:'在本对话重试',en:'Retry in this chat'})}
    </button>;
    return null;
  }
  const recovery=(recoveryError || paused && !stopping) && <div className="site-assistant-recovery">
    {recoveryError && <p role="alert">{tr(ASSISTANT_ERROR_TEXT[recoveryError])}{retryAt && retryAt>Date.now() && tr({zh:' 可重试时间 ' ,en:' Retry at '})+new Date(retryAt).toLocaleTimeString(lang)}</p>}
    {paused && !stopping && <p role="status">{tr({zh:'任务和队列已暂停',en:'Task and queue paused'})}</p>}
    {recoveryAction()}
  </div>;
  const content=<div ref={dialog} className={`site-assistant-dialog${expanded ? ' is-expanded' : ''}${embedded ? ' site-assistant-embedded' : ''}`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-label={embedded ? tr({zh:'聊天内容',en:'Conversation'}) : undefined} aria-labelledby={embedded ? undefined : titleId} data-site-surface={embedded ? undefined : "panel"} onKeyDown={event=>{
      if(embedded || event.key!=='Tab')return;
      const focusable=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled),select:not(:disabled),summary');
      if(!focusable?.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }}>
      {!embedded && <header className="site-assistant-header"><div><h2 id={titleId}>{tr({zh:'问 CubeRoot',en:'Ask CubeRoot'})}</h2><p>{tr({zh:'解答疑问、分析资料、探索魔方',en:'Ask, analyse and explore cubing'})}</p></div>
        <button className="site-assistant-action" type="button" onClick={()=>{imageJob.current++;processing.current=false;setProcessingImages(false);setImageError(null);stop();onNew();setEditing(null);setReference(null);setSelection(null);setDraft('');input.current?.focus();}} title={tr({zh:'新对话',en:'New conversation'})} aria-label={tr({zh:'新对话',en:'New conversation'})}><MessageSquarePlus size={20}/></button>
        <button className="site-assistant-action site-assistant-expand" type="button" onClick={()=>setExpanded(value=>!value)} title={tr(expanded?{zh:'退出全屏',en:'Exit full screen'}:{zh:'全屏',en:'Full screen'})} aria-label={tr(expanded?{zh:'退出全屏',en:'Exit full screen'}:{zh:'全屏',en:'Full screen'})}>{expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button>
        <ClearButton variant="standalone" className="site-assistant-action site-assistant-close" onClick={onClose} ariaLabel={tr({zh:'关闭',en:'Close'})}/>
      </header>}
      <div className="site-assistant-body"><div ref={messages} onScroll={()=>{const node=messages.current;if(node && turns.length){follow.current=node.scrollHeight-node.scrollTop-node.clientHeight<=2;setShowLatest(!follow.current);if(follow.current)setUnreadContent(false);}}} className="site-assistant-messages" onPointerUp={readSelection} onKeyUp={readSelection} role="log" aria-live="polite">
        {!turns.length && !searchResults && <div className="site-assistant-examples">
          <h3>{tr({zh:'你想了解什么？',en:'What would you like to know?'})}</h3>
          {authSendLabel && <p className="site-assistant-examples-intro">{tr({zh:'文字问题可在账号验证后自动发送。',en:'Text questions can be sent automatically after account verification.'})}</p>}
          <div className="site-assistant-example-groups site-assistant-featured">{QUESTION_EXAMPLES.flatMap(group=>group.questions.filter(example=>example.featured).map(exampleButton))}</div>
          <details className="site-assistant-more-examples" open><MoreToggle as="summary">{tr({zh:'更多问题',en:'More questions'})}</MoreToggle>
            <div className="site-assistant-example-groups">{QUESTION_EXAMPLES.map(group=><section className="site-assistant-example-group" key={group.id} aria-labelledby={`${titleId}-examples-${group.id}`}>
              <h4 id={`${titleId}-examples-${group.id}`}>{tr(group.title)}</h4>
              {group.questions.filter(example=>!example.featured).map(exampleButton)}
            </section>)}</div>
          </details>
        </div>}
        {turns.map((turn,i)=>{
          const animate = !!turn.requestId && !initialAnswers.has(turn.requestId);
          const revealDone = !turn.partial;
          const hasPartialContent = !!turn.result?.answer.trim() || !!turn.result?.artifacts?.length;
          const tableLinks=new Set(turn.result?.artifacts?.flatMap(a=>a.kind==='table' ? [...a.links ?? [],...a.cellLinks?.flat() ?? []] : []) ?? []);
          const presentation=turn.result ? answerPresentation(turn.result,turn.partial) : null;
          const citedLinks=new Set(presentation?.sources.filter(source=>presentation.withFallback.includes(`[[${source.id}]]`)).map(source=>source.href));
          const seenActions=new Set<string>();
          const actions=turn.result?.actions?.filter(action=>{
            const key = action.id.startsWith('replay:practice:') ? action.id : action.href;
            if(!isAssistantSourceHref(action.href) || tableLinks.has(action.href) || citedLinks.has(action.href) || seenActions.has(key))return false;
            seenActions.add(key);return true;
          }) ?? [];
          const report = revealDone ? turn.replayReport : undefined;
          const recorded = report && actions.find(action=>action.id.startsWith('replay:practice:recorded:'));
          const retest = report && actions.find(action=>action.id.startsWith('replay:practice:retest:'));
          const remainingActions = actions.filter(action=>action!==recorded && action!==retest);
          const actionLink = (action: (typeof actions)[number]) => {
            const practice = action.id.startsWith('replay:practice:');
            const role = practice && /^replay:practice:(recorded|retest):[0-9]+$/.exec(action.id)?.[1];
            const href = role && practiceChatId ? action.href + '&replayPractice=' + encodeURIComponent(practiceChatId + '.' + role) : action.href;
            return <Link key={action.id} className="site-assistant-action" href={href}
              {...(practice || action.id.startsWith('train:case:') ? {target:'_blank', rel:'noopener noreferrer'} : sourceLinkProps(action.href))}
              onClick={event=>{if(turn.requestId)void sendAssistantEvent(turn.requestId,{type:'click',kind:'action',id:action.id}).catch(()=>{});openSolverDocument(event);}}
              prefetch={false}>{practice ? action.title : tr({zh:`打开 ${action.title}`,en:`Open ${action.title}`})}</Link>;
          };
          const answerText = turn.result && <SiteAssistantAnswerText result={turn.result} partial={turn.partial} requestId={turn.requestId} animate={animate} onRevealComplete={onRevealComplete}/>;
          return <section className="site-assistant-turn" id={titleId+'-turn-'+i} key={turn.messageId ?? i}>{editing!==null && i===turns.length-1 ? <form className="site-assistant-edit" onSubmit={event=>{event.preventDefault();if((editing.trim()||turn.images?.length)&&editing.trim().length<=SITE_ASSISTANT_QUESTION_MAX_LENGTH&&!busy){turn.references?.length ? onAsk(editing.trim(),true,turn.images,turn.references) : onAsk(editing.trim(),true,turn.images);setEditing(null);}}}>
          {!!turn.images?.length && renderImages(turn.images)}<textarea autoComplete="off" ref={editInput} className="site-assistant-draft" aria-label={tr({zh:'编辑问题',en:'Edit question'})} value={editing} maxLength={SITE_ASSISTANT_QUESTION_MAX_LENGTH} rows={3} onChange={event=>setEditing(event.target.value)}/>
          <div className="site-assistant-edit-actions">{editing && <ClearButton variant="standalone" onClick={()=>setEditing('')}/>}<button type="button" className="site-assistant-action" onClick={()=>setEditing(null)}>{tr({zh:'取消',en:'Cancel'})}</button><button type="submit" className="site-assistant-action site-assistant-send" disabled={busy||editing.trim().length>SITE_ASSISTANT_QUESTION_MAX_LENGTH||(!editing.trim()&&!turn.images?.length)}>{tr({zh:'发送',en:'Send'})}</button></div>
        </form> : <div className="site-assistant-question">{turn.imagesExpired && <p className="site-assistant-note">{tr({zh:'较早的图片已释放，需要时请重新添加。',en:'Earlier images have been released. Attach them again if needed.'})}</p>}{!!turn.images?.length && renderImages(turn.images)}{turn.references?.map((item,j)=><div key={j}>{quoteCard(item)}</div>)}{report ? <details><MoreToggle as="summary">{tr({zh:'查看本次复盘提问',en:'View replay question'})}</MoreToggle><h3 data-assistant-message="user" data-turn={i}>{turn.question}</h3></details> : turn.question && <h3 data-assistant-message="user" data-turn={i}>{turn.question}</h3>}<div className="site-assistant-question-actions">{turn.question && <Tooltip content={tr({zh:'引用问题',en:'Quote question'})}>{tip=><button {...tip} className="site-assistant-action" type="button" aria-label={tr({zh:'引用问题',en:'Quote question'})} onClick={()=>useQuote(quote(turn,i,'user'))}><Quote size={15}/></button>}</Tooltip>}<button className="site-assistant-action" type="button" onClick={()=>{if(navigator.clipboard)copy(turn.question,`question-${i}`);}} title={tr(copiedKey===`question-${i}`?{zh:'已复制',en:'Copied'}:{zh:'复制问题',en:'Copy question'})}>{copiedKey===`question-${i}`?<Check size={15}/>:<Copy size={15}/>}</button>{i===turns.length-1 && <button className="site-assistant-action" type="button" disabled={busy} onClick={()=>{stop();setEditing(turn.question);}} title={tr({zh:'编辑问题',en:'Edit question'})}><Pencil size={15}/></button>}</div></div>}
          {turn.deliveryState==='applied' && <p className="site-assistant-note" role="status">{tr({zh:'已用于调整当前任务',en:'Applied to the current task'})}</p>}
          {turn.deliveryState==='queued' && !paused && <p className="site-assistant-note" role="status">{tr(turn.targetId
            ? {zh:'等待当前步骤结束',en:'Waiting for the current step'}
            : activeMessageId || turns.slice(0,i).some(previous=>previous.deliveryState==='queued' && !previous.targetId)
              ? {zh:'等待本对话的上一条回复',en:'Waiting for the previous reply in this chat'}
              : {zh:'正在开始',en:'Starting'})}</p>}
          {turn.deliveryState==='error' && turn.deliveryError && (turn!==recoveryTurn || recoveryError!==turn.deliveryError) && <p className="site-assistant-note" role="alert">{tr(ASSISTANT_ERROR_TEXT[turn.deliveryError])}</p>}
          {((isRunning(turn,i)) || !!turn.progress?.length || !!turn.endState) && <AssistantExecutionProgress key={turn.createdAt ?? turn.requestId ?? i} turn={turn} busy={isRunning(turn,i)} stopping={stopping && isRunning(turn,i)} status={status} lang={lang}/>}
          {turn.result && (revealDone || hasPartialContent) && <AssistantAnswerBody turn={i} enabled={active && revealDone} report={!!report} onNavigate={()=>{follow.current=false;}}>{report ? <Suspense fallback={<p role="status">{tr({zh:'正在打开复盘报告…',en:'Opening solve report…'})}</p>}><ReplayReplyCard report={report}
            recordedAction={recorded && actionLink(recorded)} retestAction={retest && actionLink(retest)}>{answerText}</ReplayReplyCard></Suspense> : answerText}
          {revealDone && !!remainingActions.length && <div className="site-assistant-response-actions site-assistant-navigation">{remainingActions.map(actionLink)}</div>}
          {turn.result.artifacts?.map((a,j)=>!revealDone && a.kind!=='algorithms' ? null : a.kind==='algorithms'?<AssistantAlgorithmCards key={j} result={a} onAsk={busy ? undefined : question=>onAsk(question)} onChange={onAlgorithmChange && !turn.partial ? (card,expected,next)=>changeAlgorithm(i,j,card,expected,next) : undefined}/>:<SiteAssistantResult key={j} artifact={a} lang={lang}/>)}
        </AssistantAnswerBody>}
          {turn.result && revealDone && !(isRunning(turn,i)) && <AssistantAnswerActions key={turn.requestId ?? i} turn={turn} lang={lang} active={active} onFeedback={onFeedback} onQuote={()=>useQuote(quote(turn,i,'assistant'))} onRetry={i===turns.length-1 && !error && !paused && !busy && editing===null ? ()=>turn.references?.length ? onAsk(turn.question,true,turn.images,turn.references) : onAsk(turn.question,true,turn.images) : undefined} onBranch={onBranch && !turn.partial && !busy ? ()=>onBranch(i) : undefined} preview={<><SiteAssistantAnswerText result={turn.result}/>{turn.result.artifacts?.filter(a=>a.kind==='algorithms').map((a,j)=><AssistantAlgorithmCards key={j} result={a}/>)}</>}/>}
          {turn.partial && hasPartialContent && !(isRunning(turn,i)) && <p className="site-assistant-incomplete">{tr({zh:'回答未完成',en:'Answer incomplete'})}</p>}
          {turn===recoveryTurn && recovery}
        </section>;})}
        {!recoveryTurn && recovery}
      </div>
      {showLatest && turns.length>0 && <button className="site-assistant-action site-assistant-latest" type="button" onClick={scrollLatest} aria-label={tr(unreadContent ? {zh:'有新内容，回到最新消息',en:'New content, jump to latest'} : {zh:'回到最新消息',en:'Jump to latest'})}><ArrowDown size={18}/>{unreadContent && <span>{tr({zh:'有新内容',en:'New content'})}</span>}</button>}</div>
      {selection && <button type="button" className="site-assistant-action site-assistant-quote-selection" onPointerDown={event=>event.preventDefault()} onClick={()=>useQuote(selection)}><Quote size={16}/>{tr({zh:'引用所选内容',en:'Quote selected text'})}</button>}
      {editing===null && searchResults}
      <form ref={composer} className="site-assistant-compose" onDragOver={event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();}} onDrop={event=>{event.preventDefault();void addImages(Array.from(event.dataTransfer.files));}} onSubmit={e=>{e.preventDefault();submit();}}><div className="site-assistant-input">
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event=>{const question=pickerQuestion.current;pickerQuestion.current=null;const files=Array.from(event.target.files ?? []);event.target.value='';void addImages(files,question);}}/>
        {reference && quoteCard(reference,true)}
        {!!images.length && renderImages(images,true)}
        {listening && <div className="site-assistant-voice-status">
          <span role="status">{tr(micStatus === 'awaiting-permission' ? {zh:'请在浏览器的权限提示中允许使用麦克风',en:'Allow microphone access in the browser prompt'}
            : micStatus === 'starting' ? {zh:'正在启动麦克风…',en:'Starting microphone…'}
            : micStatus === 'stopping' ? {zh:'正在完成听写…',en:'Finishing dictation…'}
            : {zh:'正在聆听',en:'Listening'})}</span>
          {micStatus === 'listening' && microphone && <meter ref={volumeMeter} min={0} max={1} aria-label={tr({zh:'麦克风输入音量',en:'Microphone input level'})}/>}
        </div>}
        {micError && <p className="site-assistant-voice-error" role="status">{tr(speechInputError(micError))}</p>}
        {(micError === 'device-timeout' || micError === 'capture-timeout' || micStatus === 'awaiting-permission') &&
          <button type="button" className="site-assistant-voice-retry" disabled={editing !== null}
            onClick={startWithBrowserMicrophone}>{tr({zh:'使用浏览器默认麦克风',en:'Use browser microphone'})}</button>}
        <div className="site-assistant-input-row">
          <CompactSelect className="site-assistant-attachments" triggerClassName="site-assistant-action" popupClassName="site-assistant-menu site-assistant-attachment-menu" unstyledTrigger
            label={<Plus size={20}/>} ariaLabel={tr({zh:'添加附件',en:'Add attachments'})}
            items={[{value:'images',label:<span className="site-assistant-attachment-option"><span className="site-assistant-attachment-icon" aria-hidden="true"><ImageIcon size={22}/></span>{tr({zh:'照片',en:'Photos'})}</span>}]}
            onChange={()=>{pickerQuestion.current=null;imageInput.current?.click();}} disabled={submitting||editing!==null||processingImages||images.length>=SITE_ASSISTANT_MAX_IMAGES}/>
          <textarea autoComplete="off" className="site-assistant-draft" onPaste={event=>{const files=Array.from(event.clipboardData.files);if(files.length){event.preventDefault();void addImages(files);}}} ref={input} aria-label={tr({zh:'继续提问',en:'Ask a follow-up'})} placeholder={authPlaceholder ?? tr(paused ? {zh:'提问将开启新对话',en:'Ask to start a new chat'} : {zh:'随心输入',en:'Type anything'})} maxLength={SITE_ASSISTANT_QUESTION_MAX_LENGTH} rows={1} disabled={editing!==null} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!window.matchMedia?.('(pointer: coarse)').matches){e.preventDefault();submit();}}}/>
          <div className="site-assistant-input-actions">
            {!busy && <AssistantComposerSettings provider={provider} thinking={thinking} openaiAvailable={openaiAvailable}
              onProviderChange={onProviderChange} onThinkingChange={onThinkingChange} />}
            <Tooltip content={listening ? micLabel : tr({zh:'用语音输入',en:'Use voice input'})}>{tip => <button {...tip} className="site-assistant-action site-assistant-mic" type="button"
              disabled={editing !== null || micStatus === 'stopping'} onClick={listening ? stop : start}
              aria-label={micLabel} aria-pressed={listening}><Mic size={19}/></button>}</Tooltip>
            {busy && <CompactSelect className="site-assistant-thinking" popupClassName="site-assistant-menu" items={[{value:'steer' as const,label:tr({zh:'调整当前任务',en:'Adjust current task'})},{value:'queue' as const,label:tr({zh:'加入队列',en:'Add to queue'})},{value:'parallel' as const,label:tr({zh:'在新对话并行处理',en:'Send in a new chat'})}]} value={deliveryMode} onChange={setDeliveryMode} label={modeLabel} ariaLabel={tr({zh:'发送方式',en:'Delivery mode'})} variant="plain" preserveFocus/>}
            {busy && <Tooltip content={tr(stopping?{zh:'正在停止',en:'Stopping'}:{zh:'停止',en:'Stop'})}>{tip=><button {...tip} className="site-assistant-action site-assistant-send" type="button" disabled={stopping} onClick={onStop} aria-label={tr({zh:'停止',en:'Stop'})}><Square size={16} fill="currentColor"/></button>}</Tooltip>}
            {(!busy || draft.trim() || images.length>0) && <Tooltip content={sendLabel}>{tip=><button {...tip} className={`site-assistant-action site-assistant-send${authSendLabel ? ' site-assistant-auth-send' : ''}`} type="submit" disabled={stopping||submitting||(!draft.trim()&&!images.length)||draft.trim().length>SITE_ASSISTANT_QUESTION_MAX_LENGTH||editing!==null||processingImages} aria-label={sendLabel}>{authSendLabel ?? <ArrowUp size={20}/>}</button>}</Tooltip>}
          </div>
        </div>
        {draft.length>=SITE_ASSISTANT_QUESTION_MAX_LENGTH*.9 && <span className="site-assistant-input-count" role="status">{draft.length}/{SITE_ASSISTANT_QUESTION_MAX_LENGTH}</span>}
      </div>{processingImages && <p role="status">{tr({zh:'正在处理图片…',en:'Preparing images…'})}</p>}
      {quoteError && <p role="alert">{tr({zh:'引用内容较长，请选中需要引用的片段。',en:'This quote is too long. Select a shorter passage.'})}</p>}
      {authNotice && <p className="site-assistant-note" role="alert">{authNotice}</p>}
      {recovering && <p className="site-assistant-note" role="status">{tr({zh:'正在恢复已保存的进度',en:'Restoring saved progress'})}</p>}
      {stopUnconfirmed && <p role="alert">{tr({zh:'尚未确认停止，请重试停止。补充内容仍保留在输入框。',en:'Stop has not been confirmed. Try stopping again. Your draft is still in the input.'})}</p>}
      {imageError && <p role="alert">{imageError}</p>}
      {!!images.length && <p className="site-assistant-note">{tr({zh:'发送后，图片会保存为私有会话附件并交给 AI 识别。追问可参考最近 3 张图片。',en:'Sent images are saved as private chat attachments and processed by AI. Follow-ups can reference the latest 3 images.'})}</p>}
      {openaiAvailable && <p className="site-assistant-note">{tr({zh:'使用 GPT 或回退到 GPT 时，本次问题、最近对话和附件将交由 OpenAI 处理。',en:'When GPT is selected or used as a fallback, OpenAI processes your question, recent conversation and attachments.'})}</p>}
      <p className="site-assistant-note">{tr({zh:'AI 回答可能有误，请核对来源。WCA 数据以最近导入为准。',en:'AI can make mistakes. Check sources. WCA data reflects the latest import.'})}</p></form>
    </div>;
  return embedded ? content : <AssistantModal onClose={onClose} motionRef={motionRef}>{content}</AssistantModal>;
}
