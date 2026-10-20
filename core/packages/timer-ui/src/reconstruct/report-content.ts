/** Canonical report content for DOM and native renderers. Keep labels, ordering,
 * visibility and action payloads here; adapters only draw nodes and execute effects. */
import type { Solve } from '@cuberoot/shared/timer';
import type { trainingRepetitionMetrics, trainingCaseStatistics } from './report-presentation';
import { effectiveMs } from '@cuberoot/shared/timer/types';
import { formatMs } from '@cuberoot/shared/timer/stats';
import { timerEventNxnSize } from '@cuberoot/shared/timer/event-catalog';
import type { ReconstructLocalize } from './ReconstructHost';
import type { AnalysisSnapshot } from './analysis-protocol';
import type { ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import { gradeForDelta } from '@cuberoot/shared/timer/reconstruct/reference';
import type { ReferenceResult } from '@cuberoot/shared/timer/reconstruct/reference';
import { columnTotals, stageAverageDelta, reportTableVisibility, type Col } from './report-columns';
import { projectReferenceRows, reportSeconds as sec } from './report-presentation';

export type ReportAction = { type: string; key?: string; value?: number | boolean | string; timeMs?: number; copyText?: string };
export interface ReportNode {
  notation?: { line: string; crossColor: import('@cuberoot/shared/timer').TimerColorLetter | null;
    links: import('@cuberoot/shared/recon/comment-links').ReconCommentLink[];
    colorHrefs: Record<string, string>; inspectionColors?: string; diagramId?: string };
  id: string; kind: 'group' | 'text' | 'button' | 'toggle' | 'select' | 'disclosure' | 'table' | 'slot' | 'color' | 'moves' | 'bar';
  tag?: 'div'|'span'|'dl'|'dt'|'dd'|'fragment'; text?: string; className?: string; layout?: 'row' | 'flow'; title?: string; icon?: string;
  children?: ReportNode[]; action?: ReportAction; disabled?: boolean; selected?: boolean;
  value?: number | boolean | string; options?: { value: number; label: string }[];
  columns?: ReportNode[]; rows?: { id: string; label: string; className?: string; cells: ReportNode[] }[];
  tone?: number; href?: string; state?: string; stage?: string; colors?: string; fills?: string[];
  segments?: {id:string;fraction:number;tone:number;label:string}[];
  tokens?: {token:string;before:ReportAction;after:ReportAction}[];
}
export interface ReportUIState {
  expanded: Record<string, boolean>; openColumn: string | null; simplified: boolean;
  feedback: boolean | null; copied: string | null;
}
export const initialReportUI = (feedback?: boolean): ReportUIState => ({expanded:{},openColumn:null,simplified:true,feedback:feedback ?? null,copied:null});
export function reduceReportUI(state: ReportUIState, action: ReportAction): ReportUIState {
  switch(action.type) {
    case 'disclosure': return {...state,expanded:{...state.expanded,[action.key!]:!state.expanded[action.key!]}};
    case 'column': return {...state,openColumn:state.openColumn===action.key?null:action.key!};
    case 'simplified': return {...state,simplified:typeof action.value==='boolean'?action.value:!state.simplified};
    case 'feedback': return {...state,feedback:state.feedback===action.value?null:Boolean(action.value)};
    case 'copied': return {...state,copied:action.key ?? null};
    default:return state;
  }
}
export const textNode = (id:string,text:string,className?:string):ReportNode=>({id,kind:'text',text,className});
export const groupNode = (id:string,children:(ReportNode|null|false|undefined)[],className?:string,layout?:'row'|'flow'):ReportNode=>({id,kind:'group',children:children.filter(Boolean) as ReportNode[],className,layout,tag:layout==='flow'?'span':'div'});
export const buttonNode = (id:string,text:string,action:ReportAction,className?:string,extra:Partial<ReportNode>={}):ReportNode=>({id,kind:'button',text,action,className,...extra});
const num = (n:number|null|undefined)=>n==null?'–':String(n);

export function reportActions(solve:Solve,tr:ReconstructLocalize,state:ReportUIState,canUse:boolean,placement:'detail'|'report'|'recap'='report',shareMode:'copy'|'system'='copy') {
  const shareClass=placement==='recap'?'shell-recap-btn shell-recap-btn--icon':placement==='detail'?'timer-solve-detail-action timer-solve-detail-header-action--icon':'rc-action rc-action--ghost rc-action--icon';
  const useClass=placement==='recap'?'shell-recap-btn shell-recap-btn--primary':placement==='detail'?'timer-solve-detail-action':'rc-action';
  const canShare=Boolean(solve.moves?.length),copied=state.copied==='share';
  return {...groupNode('actions',[
    buttonNode('share',!canShare?tr({zh:'没有动作记录，无法分享回放',en:'No move log — share unavailable'}):copied?tr({zh:'链接已复制',en:'Link copied'}):shareMode==='system'?tr({zh:'分享回放',en:'Share replay'}):tr({zh:'复制分享链接',en:'Copy share link'}),{type:'share'},shareClass,{disabled:!canShare,icon:copied?'check':'share'}),
    canUse&&Boolean(solve.scramble?.trim())&&buttonNode('use',tr({zh:'用这条打乱',en:'Use this scramble'}),{type:'use-scramble'},useClass),
  ],placement==='report'?'rc-actions':undefined,'row'),tag:placement==='report'?'div':'fragment'} as ReportNode;
}
export function reportSummary(solve:Solve,summary:{stm:number;tps:number;fluency:number|null},tr:ReconstructLocalize,date?:{short:string;full:string}) {
  const cell=(id:string,label:string,value:string,extra?:ReportNode)=>groupNode(id,[{...textNode(id+'-label',label,'rc-summary-label'),tag:'dt'},{...textNode(id+'-value',value,'rc-summary-big'),tag:'dd'},extra],'rc-summary-cell');
  return {...groupNode('summary',[
    cell('time',tr({zh:'时间',en:'Time'}),formatMs(effectiveMs(solve)),solve.penalty!=='ok'?textNode('penalty',solve.penalty,'rc-summary-pen'):undefined),
    cell('stm','STM',String(summary.stm)),cell('tps','TPS',summary.tps.toFixed(2)),
    cell('fluency',tr({zh:'流畅',en:'Fluency'}),summary.fluency==null?'–':`${summary.fluency}%`),
    date&&{...cell('date',tr({zh:'日期',en:'Date'}),date.short),title:date.full},
  ],'rc-summary','flow'),tag:'dl' as const};
}

export function reportTrainingSummary(solve: Solve,
  metrics: NonNullable<ReturnType<typeof trainingRepetitionMetrics>>,
  statistics: ReturnType<typeof trainingCaseStatistics>, tr: ReconstructLocalize): ReportNode {
  const metric = (id: string, label: string, ms: number) => groupNode(id, [
    { ...textNode(id + '-label', label, 'rc-summary-label'), tag: 'dt' },
    { ...textNode(id + '-value', `${sec(ms)} s`, 'rc-summary-big'), tag: 'dd' },
  ], 'rc-summary-cell');
  const delta = statistics && solve.penalty === 'ok' ? metrics.executionMs - statistics.executionMs : null;
  return groupNode('training-summary', [
    (Boolean(solve.caseId) || solve.penalty !== 'ok') && groupNode('training-identity', [
      Boolean(solve.caseId) && textNode('case', solve.caseId!, 'rc-training-case'),
      solve.penalty !== 'ok' && textNode('penalty', solve.penalty, 'rc-summary-pen'),
    ], 'rc-training-identity', 'row'),
    { ...groupNode('training-times', [
      metric('observation', tr({ zh: '观察', en: 'Observation' }), metrics.observationMs),
      metric('execution', tr({ zh: '执行', en: 'Execution' }), metrics.executionMs),
      metric('total', tr({ zh: '总时间', en: 'Total' }), metrics.totalMs),
    ], 'rc-summary rc-training-times'), tag: 'dl' },
    statistics ? groupNode('case-statistics', [
      textNode('sample', tr({ zh: `同情况 · 同计时方式 · 此前最近 ${statistics.count} 次`, en: `Same case and timing mode · ${statistics.count} previous attempts` }), 'rc-training-note'),
      { ...groupNode('case-means', [
        metric('observation-mean', tr({ zh: '观察均值', en: 'Mean observation' }), statistics.observationMs),
        metric('execution-mean', tr({ zh: '执行均值', en: 'Mean execution' }), statistics.executionMs),
        metric('execution-best', tr({ zh: '执行最佳', en: 'Best execution' }), statistics.bestExecutionMs),
      ], 'rc-summary rc-training-history'), tag: 'dl' },
      delta !== null && textNode('comparison', delta === 0
        ? tr({ zh: '本次执行与近期均值相同', en: 'Execution matches your recent mean' })
        : delta < 0 ? tr({ zh: `本次执行快 ${sec(-delta)} s`, en: `Execution is ${sec(-delta)} s faster` })
          : tr({ zh: `本次执行慢 ${sec(delta)} s`, en: `Execution is ${sec(delta)} s slower` }), 'rc-training-note'),
    ], 'rc-training-statistics') : null,
  ], 'rc-training-summary');
}
export function reportStepTable(cols:Col[],sequences:Map<string,string[]>,rotations:number[]|null,reference:ReferenceResult|null,method:MethodId,state:ReportUIState,tr:ReconstructLocalize,hideBar=false) {
  if(!cols.length)return null;
  const totals=columnTotals(cols),{hasRef,hasAvg}=reportTableVisibility(cols);
  const cell=(id:string,value:string,extra?:ReportNode,title?:string)=>({...groupNode(id,[textNode(id+'-value',value),extra],undefined,'flow'),title});
  const rows:NonNullable<ReportNode['rows']>=[];
  const row=(id:string,label:string,cells:ReportNode[],total:ReportNode,className?:string)=>rows.push({id,label,cells:[...cells,total],className});
  const pct=(id:string,n:number|null)=>n==null?undefined:textNode(id,`${n}%`,'sa-pct');
  row('recognition',tr({zh:'识别',en:'Recognition'}),cols.map(c=>cell(c.key,sec(c.recognitionMs))),cell('total',sec(totals.rec),pct('pct',totals.recPct)));
  row('execution',tr({zh:'执行',en:'Execution'}),cols.map(c=>cell(c.key,sec(c.executionMs))),cell('total',sec(totals.exec),pct('pct',totals.execPct)));
  row('step',tr({zh:'本步',en:'Step time'}),cols.map(c=>cell(c.key,c.skipped?tr({zh:'跳过',en:'skip'}):sec(c.stepMs))),cell('total',sec(totals.step)),'sa-row-strong');
  row('cumulative',tr({zh:'累计',en:'Total time'}),cols.map(c=>cell(c.key,sec(c.cumulativeMs))),cell('total',sec(totals.last)));
  row('turns',tr({zh:'步数',en:'Turns'}),cols.map(c=>cell(c.key,num(c.turns))),cell('total',num(totals.turns)));
  if(rotations)row('rotations',tr({zh:'转体',en:'Rotations'}),cols.map((c,i)=>cell(c.key,num(rotations[i]))),cell('total',num(rotations.reduce((a,b)=>a+b,0))));
  if(hasRef)row('reference',tr({zh:'参考',en:'Reference'}),cols.map(c=>{
    const optimal=!c.skipped&&gradeForDelta(c.refDelta)==='optimal';
    const extra=c.refTurns==null?undefined:optimal?{...textNode('grade',tr({zh:'最优',en:'Optimal'}),'sa-grade optimal'),title:tr({zh:'和参考解法一样短',en:'As short as the reference line'})}:c.refDelta?textNode('delta',`${c.refDelta>0?'+':''}${c.refDelta}`,`sa-delta ${c.refDelta>0?'slower':'faster'}`):undefined;
    const cmp=c.refUserTurns;
    return cell(c.key,num(c.refTurns),extra,cmp!=null&&c.turns!=null&&cmp!==c.turns?tr({zh:`比的是执行步数 ${cmp}(不含起手 AUF)—— 参考公式本身没有 AUF`,en:`Compared against ${cmp} execution turns (the leading AUF is excluded — the reference alg has none)`}):undefined);
  }),cell('total',num(reference?.refTurns)),'sa-row-ref');
  if(hasAvg)row('average',method==='cfop'?tr({zh:'对比 ao12',en:'vs ao12'}):tr({zh:'对比近期阶段均值',en:'vs recent stage mean'}),cols.map(c=>{
    const delta=stageAverageDelta(c);return delta==null?cell(c.key,'–'):textNode(c.key,`${delta>0?'+':''}${delta}%`,`sa-delta ${delta>0?'slower':'faster'}`);
  }),cell('total','–'),'sa-row-avg');
  const open=cols.find(c=>c.key===state.openColumn);
  return groupNode('analysis',[
    textNode('analysis-title',tr({zh:'分步分析',en:'Step analysis'}),'sa-title'),
    !hideBar&&cols.some(c=>(c.stepMs??0)>0)&&{id:'step-bar',kind:'bar',text:tr({zh:'各步用时占比',en:'Time per step'}),segments:cols.filter(c=>(c.stepMs??0)>0).map(c=>({id:c.key,fraction:(c.stepMs??0)/cols.reduce((sum,c)=>sum+Math.max(0,c.stepMs??0),0),tone:c.tone,label:c.label+' '+sec(c.stepMs)+'s'}))},
    {id:'step-table',kind:'table',className:'sa-table',columns:[...cols.map(c=>buttonNode(c.key,c.label,{type:'column',key:c.key},'sa-col-btn',{
      disabled:!(sequences.get(c.key)?.length),selected:state.openColumn===c.key,tone:c.tone,
      children:c.chip?[textNode('chip',c.chip,'sa-chip')]:undefined,title:tr({zh:'看这一步拧了什么',en:'Show this step’s turns'})})),textNode('total',tr({zh:'合计',en:'Total'}),'sa-total-col')],rows},
    open&&groupNode('sequence',[
      groupNode('actual',[textNode('label',open.label,'sa-seq-label'),textNode('moves',(sequences.get(open.key)??[]).join(' '),'sa-seq-moves')],'sa-seq-row','row'),
      !open.skipped&&Boolean(open.refSolution)&&groupNode('ref',[textNode('label',tr({zh:'参考',en:'Reference'}),'sa-seq-label'),textNode('moves',open.refSolution!,'sa-seq-moves')],'sa-seq-row is-ref','row'),
    ],'sa-seq'),
  ],'sa');
}
export function reportReferences(reference:ReferenceResult,tr:ReconstructLocalize) {
  const rows=projectReferenceRows(reference,tr);if(!rows.length)return null;
  return groupNode('reference-list',[
    ...rows.map(s=>groupNode(s.step,[textNode('stage',s.label,'reconstruct-ref-stage'),groupNode('counts',[
      textNode('count',`${s.userTurns??'—'} / ${s.refTurns??'—'}`),s.kind&&textNode('kind',s.kindLabel,'reconstruct-ref-kind')],'reconstruct-ref-count','flow'),textNode('solution',s.solution,'reconstruct-ref-alg')],'reconstruct-ref-row')),
    reference.refTurns!=null&&reference.userTurns!=null&&groupNode('ref-total',[
      textNode('count',`${tr({zh:'合计',en:'Total'})} ${reference.userTurns} / ${reference.refTurns} ${tr({zh:'步',en:'turns'})}`),
      Boolean(reference.delta)&&textNode('delta',`${reference.delta!>0?'+':''}${reference.delta}`,`reconstruct-stage-delta ${reference.delta!>0?'slower':'faster'}`),
    ],'reconstruct-ref-total','flow')],'reconstruct-ref-list');
}
export function reportRawMoves(solve:Solve,wasted:ReadonlySet<number>,tr:ReconstructLocalize) {
  const moves=solve.moves??[];
  if(!moves.length)return textNode('no-moves',tr({zh:'这把没有蓝牙动作记录。',en:'No bluetooth moves recorded for this solve.'}),'reconstruct-empty');
  return groupNode('raw-list',moves.map((m,i)=>{
    const gap=i?m.ts-moves[i-1].ts:null;
    return {...groupNode(String(i),[textNode('idx',String(i+1),'reconstruct-move-idx'),textNode('move',m.m,'reconstruct-move-token'),textNode('ts',`t=${sec(m.ts)}s`,'reconstruct-move-ts'),textNode('gap',gap==null?'—':`Δ=+${sec(gap)}s`,'reconstruct-move-gap')],`reconstruct-move-row${gap!=null&&gap>500?' slow':''}${wasted.has(i)?' wasted':''}`,'row'),title:wasted.has(i)?tr({zh:'废步:这一段转完回到了之前的状态',en:'wasted: this run returns to a prior state'}):undefined};
  }),'reconstruct-move-list');
}
export function reportFeedback(state:ReportUIState,tr:ReconstructLocalize) {
  return groupNode('feedback',[
    textNode('question',tr({zh:'复盘对不对?',en:'Reconstruction correct?'}),'rc-feedback-q'),
    ...[true,false].map(value=>buttonNode(String(value),value?tr({zh:'切分是对的',en:'The split is right'}):tr({zh:'切分不对',en:'The split is wrong'}),{type:'feedback',value},`rc-feedback-btn${state.feedback===value?value?' is-on':' is-off':''}`,{selected:state.feedback===value,icon:value?'thumb-up':'thumb-down'})),
    {...textNode('hint','ⓘ','rc-feedback-info'),title:tr({zh:'阶段边界是从动作流推出来的,不是魔方报的。推错了这里说一声 —— 不影响任何数字,只是留个记号。',en:'The stage boundaries are inferred from the turn stream, not reported by the cube. Say so if they are wrong — it changes no number, it just leaves a marker.'})},
  ],'rc-feedback','row');
}
export function reportNoGyro(recordGyro:boolean,canEnable:boolean,tr:ReconstructLocalize) {
  return groupNode('no-gyro',[
    textNode('notice',recordGyro?tr({zh:'这把没录姿态,还有几处相对面判不准是不是中层 —— 现在已经开着了,下一把就准。',en:'No orientation was recorded for this solve, so a few opposite-face pairs could not be confirmed as slices. It is on now — the next solve will be exact.'}):tr({zh:'这把没录姿态,还有几处相对面判不准是不是中层 —— 转体也一个都推不出来。',en:'No orientation was recorded for this solve, so a few opposite-face pairs could not be confirmed as slices — and rotations cannot be recovered at all.'})),
    !recordGyro&&canEnable&&buttonNode('enable-gyro',tr({zh:'开启录姿态',en:'Record orientation'}),{type:'enable-gyro'},'rc-nogyro-fix'),
  ],'rc-nogyro');
}
export interface ReportCompositionInput {
  solve:Solve; recon:ReconTextResult|null; analysis:AnalysisSnapshot|null; hasAnalysis:boolean; scoreable:boolean;
  state:ReportUIState; tr:ReconstructLocalize; hideActions?:boolean; hasTable:boolean; hasMeta:boolean;
  autoMemoMs:number|null; hasBldMemo:boolean;
  trainingSummary?: boolean;
}
/** Composition is shared too. Slots refer to shared content builders or platform drawing. */
export function reportComposition(input:ReportCompositionInput):ReportNode {
  const {solve,recon,analysis,hasAnalysis,scoreable,state,tr}=input;
  const slot=(id:string):ReportNode=>({id,kind:'slot'});
  const disclosure=(id:string,title:string,children:(ReportNode|null|false)[]):ReportNode=>({...groupNode(id,children,'reconstruct-section reconstruct-section-collapsible'),kind:'disclosure',text:title,selected:!!state.expanded[id],action:{type:'disclosure',key:id}});
  const report = groupNode('report',[
    slot('summary'),!input.hideActions&&slot('actions'),
    Boolean(solve.scramble?.trim())&&!recon?.lines.length&&groupNode('scramble',[textNode('label',tr({zh:'打乱',en:'Scramble'}),'rc-scramble-label'),textNode('text',solve.scramble,'rc-scramble-text')],'rc-scramble'),
    input.autoMemoMs!=null&&slot('auto-memo'),input.hasBldMemo&&slot('bld-memo'),solve.bld?.memoMs!=null&&slot('memo-bar'),
    Boolean(solve.moves?.length)&&timerEventNxnSize(solve.event)!=null&&slot('playback'),
    hasAnalysis&&(!analysis?.text||analysis.provisional)&&analysis?.status!=='complete'&&textNode('analysis-status',analysis?.status==='error'?tr({zh:'部分复盘分析未能加载，请重新打开重试。',en:'Some analysis could not load. Reopen this report to retry.'}):analysis?.provisional?tr({zh:'正在补齐最后的步骤…',en:'Updating the final steps…'}):tr({zh:'正在分析复盘…',en:'Analyzing solve…'})),
    input.hasTable&&solve.bld?.memoMs==null&&slot('analysis'),input.hasMeta&&solve.bld?.memoMs==null&&slot('meta'),
    (scoreable||!!analysis?.reference)&&disclosure('references',tr({zh:'参考解法',en:'Reference lines'}),[
      !!analysis?.reference&&slot('reference-list'),
      (!analysis?.reference||analysis.status==='error')&&textNode('reference-status',analysis?.status==='error'?tr({zh:'参考解法未能加载，请重新打开重试。',en:'Reference lines could not load. Reopen this report to retry.'}):analysis?.status==='complete'?tr({zh:'暂无参考解法。',en:'No reference lines available.'}):tr({zh:'正在计算参考解法…',en:'Computing reference lines…'})),
    ]),
    disclosure('raw',tr({zh:`动作序列 (${solve.moves?.length??0})`,en:`Move stream (${solve.moves?.length??0})`}),[slot('raw-list')]),
  ],'rc-report');
  if (input.trainingSummary) report.children = [
    slot('training-summary'), ...(!input.hideActions ? [slot('actions')] : []),
    slot('playback'),
    disclosure('raw', tr({ zh: `动作序列 (${solve.moves?.length ?? 0})`, en: `Move stream (${solve.moves?.length ?? 0})` }), [slot('raw-list')]),
  ];
  return report;
}
export function resolveReportSlots(node:ReportNode,slots:Record<string,ReportNode|null>):ReportNode|null {
  if(node.kind==='slot'&&Object.hasOwn(slots,node.id))return slots[node.id];
  if(node.kind==='disclosure'&&!node.selected)return {...node,children:[]};
  return {...node,children:node.children?.map(child=>resolveReportSlots(child,slots)).filter((n):n is ReportNode=>n!==null)};
}
export function reportMeta(inspectionMs:number|null,putDownMs:number|null,tr:ReconstructLocalize) {
  const parts:string[]=[];
  if(inspectionMs!=null&&inspectionMs>0)parts.push(`${tr({zh:'观察',en:'inspect'})} ${sec(inspectionMs)}s`);
  if(putDownMs!=null&&putDownMs>0)parts.push(`${tr({zh:'放下',en:'put-down'})} ${sec(putDownMs)}s`);
  return parts.length?textNode('meta',parts.join(' · '),'reconstruct-stage-meta'):null;
}
export function reportBld(solve:Solve,autoMemoMs:number|null,memo: {parity:boolean;cornerPairs:string;edgePairs:string;twistedCorners:string[];flippedEdges:string[]}|null,executionMs:number,canApply:boolean,tr:ReconstructLocalize):Record<string,ReportNode|null> {
  const pair=(id:string,label:string,value:string):ReportNode=>({...groupNode(id,[textNode('key',label+':','reconstruct-bld-memo-key'),textNode('value',value,'reconstruct-bld-memo-val')],undefined,'row'),tag:'fragment'});
  return {
    'auto-memo':autoMemoMs==null?null:groupNode('auto-memo',[textNode('hint',`${tr({zh:'自动检测记忆时长',en:'auto-detected memo'})}: ${sec(autoMemoMs)}s`),canApply&&buttonNode('apply',tr({zh:'应用',en:'Apply'}),{type:'memo',value:autoMemoMs},'rc-action rc-action--ghost')],'reconstruct-auto-memo-hint'),
    'bld-memo':!memo?null:groupNode('bld-memo',[
      groupNode('head',[textNode('title',tr({zh:'盲拧记忆 (Speffz)',en:'BLD memo (Speffz)'}),'reconstruct-bld-memo-title'),textNode('buffers',tr({zh:'缓冲块: 角 UFR / 棱 UF',en:'buffers: corner UFR / edge UF'})+(memo.parity?tr({zh:' · 奇偶',en:' · parity'}):''),'reconstruct-bld-memo-buffers')],'reconstruct-bld-memo-head'),
      groupNode('pairs',[pair('corners',tr({zh:'角块',en:'Corners'}),memo.cornerPairs||tr({zh:'(无)',en:'(none)'})),pair('edges',tr({zh:'棱块',en:'Edges'}),memo.edgePairs||tr({zh:'(无)',en:'(none)'})),Boolean(memo.twistedCorners.length)&&pair('twisted',tr({zh:'角扭',en:'Twisted'}),memo.twistedCorners.join(' ')),Boolean(memo.flippedEdges.length)&&pair('flipped',tr({zh:'棱翻',en:'Flipped'}),memo.flippedEdges.join(' '))],'reconstruct-bld-memo-grid'),
    ],'reconstruct-bld-memo'),
    'memo-bar':solve.bld?.memoMs==null?null:groupNode('memo-bar',[textNode('memo',`${tr({zh:'记忆',en:'Memo'})} ${formatMs(solve.bld.memoMs)}`,'reconstruct-bld-seg memo'),textNode('exec',`${tr({zh:'执行',en:'Execution'})} ${formatMs(executionMs)}`,'reconstruct-bld-seg exec')],'reconstruct-bld-bar','row'),
  };
}

export function reportNotationExtras(solve:Solve,recon:ReconTextResult|null,state:ReportUIState,tr:ReconstructLocalize,capabilities:{recordGyro:boolean;canEnableGyro:boolean;canFeedback:boolean}) {
 return {notice:!solve.gyro&&(recon?.blindPairs??0)>0?reportNoGyro(capabilities.recordGyro,capabilities.canEnableGyro,tr):null,feedback:recon&&capabilities.canFeedback?reportFeedback(state,tr):null};
}
