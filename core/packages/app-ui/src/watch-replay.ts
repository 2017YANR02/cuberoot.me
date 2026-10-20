export { configureGSolverBudget as configureWatchReferenceBudget } from '@cuberoot/puzzle-solvers/cstimer-gsolver';
let analysisClock = () => Date.now();
export function configureWatchAnalysisClock(clock: () => number) { analysisClock = clock; }
import { reportComposition, reportNotationExtras, reportSummary, reportActions, reportStepTable, reportReferences, reportRawMoves, reportMeta, reportFeedback, reportNoGyro, initialReportUI, reduceReportUI, resolveReportSlots, type ReportNode, type ReportAction } from '@cuberoot/timer-ui/reconstruct/report-content';
import { reportNotation, prepareReportNotation } from '@cuberoot/timer-ui/reconstruct/report-notation';
import { reportPlayback, reportPlayerAction, playbackMoveDurationTicks } from '@cuberoot/timer-ui/reconstruct/report-player';
import { encodeReplayPayload } from '@cuberoot/shared/timer/replay-encode';
import { gradeForDelta } from '@cuberoot/shared/timer/reconstruct/reference';
import { rotationsByStep, stepTimeBounds } from '@cuberoot/shared/timer/reconstruct/rotation-detect';
import { computeStageAverages } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { methodHistoryWindow, methodStageAverages, methodHistorySource, historyAnalysisInput } from '@cuberoot/timer-ui/reconstruct/history-model';
import { loadAlg } from '@cuberoot/shared/alg';
import { reconCommentLinks, reconCommentCaseIndex, type ReconCommentCases } from '@cuberoot/shared/recon/comment-links';
import type { createNativeCubeScene } from '@cuberoot/timer-ui/native-cube-scene';
import { playbackTrack, playbackEndMs, playbackSeek, rawPlaybackTarget, playbackFrame, playbackIndexAt } from '@cuberoot/timer-ui/reconstruct/playback-track';
import { createReconstructionAnalyzer, type AnalysisWorker } from '@cuberoot/timer-ui/reconstruct/analysis-core';
import { runReconstructionAnalysis } from '@cuberoot/timer-ui/reconstruct/analysis-runner';
import { emptyAnalysis } from '@cuberoot/timer-ui/reconstruct/analysis-protocol';
import { projectReconNotation, projectReconComment, reconCommentFills, reconNotationState, reconstructionSummary, reportSeconds, projectReferenceRows } from '@cuberoot/timer-ui/reconstruct/report-presentation';
import { buildCfopColumns, buildWalkColumns, columnTotals, stageAverageDelta, reportStepSequences, reportTableVisibility } from '@cuberoot/timer-ui/reconstruct/report-columns';
import { reconstructionTimeline } from '@cuberoot/timer-ui/reconstruct/timeline-model';
import { decodeGyroTrack, sampleGyroAt } from '@cuberoot/shared/smart-cube/gyro-track';
import { applyOrientation, mirrorForBrand, sensorBasisForBrand } from '@cuberoot/shared/smart-cube/orientation';
import { prepareReconstruction } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { METHODS, METHOD_ORDER, methodById, type MethodId } from '@cuberoot/shared/timer/reconstruct/methods';
import { walkMethod, detectSolveMethod, type MethodStageMetric } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { detectWastedWork } from '@cuberoot/shared/timer/reconstruct/error-detect';
import { notationQuaternion } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { watchTimerSolve, type WatchTimerRecord } from './watch-timer';

// Only the worker transport differs from the web: QuickJS runs on the native
// serial queue. Never overlap a cancelled job with the next native request.
let queue = Promise.resolve();
export const watchReconstructionAnalyzer = createReconstructionAnalyzer(() => {
  let stopped = false;
  const worker: AnalysisWorker = { onmessage: null, onerror: null, onmessageerror: null,
    terminate() { stopped = true; },
    postMessage(data) {
      queue = queue.then(async () => {
        if (stopped) return;
        await runReconstructionAnalysis(data, response => {
          if (!stopped) worker.onmessage?.({ data: response } as MessageEvent);
        }, () => stopped);
      }).catch(error => { console.error('native analysis', String(error), error?.stack); if (!stopped) worker.onerror?.({ message: String(error) } as ErrorEvent); });
    },
  };
  return worker;
});

const stageCache = new Map<string, MethodStageMetric[]>();
export function exportWatchReplayCache() { return {analysis:watchReconstructionAnalyzer.exportCache(),stages:[...stageCache]}; }
export function importWatchReplayCache(cache: ReturnType<typeof exportWatchReplayCache>) {
  watchReconstructionAnalyzer.importCache(cache.analysis);
  for (const [key,stages] of cache.stages.slice(-100)) stageCache.set(key,stages);
}

/** Native input/render transport around the same report, analyzer and player data. */
export function createWatchReplay(scene: ReturnType<typeof createNativeCubeScene>, record: WatchTimerRecord, language: 'zh' | 'en' = 'en', preferredMethod = 'cfop', history: WatchTimerRecord[] = [], capabilities: {canUse?:boolean;canFeedback?:boolean;date?:{short:string;full:string}} = {}) {
  const solve = watchTimerSolve(record), raw = record.moves ?? [];
  if (!raw.length) throw new Error('No recorded replay');
  const gyro = decodeGyroTrack(record.gyro);
  const previous = methodHistoryWindow(history.map(watchTimerSolve),solve);
  const averages = computeStageAverages(previous,12);
  let method: MethodId = detectSolveMethod(solve.scramble,raw,solve.timeMs);
  let prepared = prepareReconstruction(solve, method, language);
  let analysis = emptyAnalysis(), unsubscribe = () => {};
  let historyPending = false, historyGeneration = 0, cancelHistory = () => {}, historyAverages: Record<string,number> = {};
  let ui=initialReportUI(solve.reconOk), posed=false, revision=0, analysisMs=0, run=0;
  const tr=<T>(text:{zh:T;en:T})=>text[language];
  let contentSlots:Record<string,ReportNode|null>={}, hasTable=false,hasMeta=false;
  let document:ReportNode|null=null,documentKey='',clipboard='';
  let effectId=0,effect:{id:number;type:string;value?:boolean|null}|null=null;
  let commentCases: ReconCommentCases = new Map(), linkLoading = false, linkKey = "";
  let track = playbackTrack(raw, undefined, false), moves = track.moves;
  let lastTs = playbackEndMs(moves, raw);
  let index = 0, timeMs = 0, playing = false, lastNow = 0, speed = 1;
  let notationPrepared=prepareReportNotation(null,method,true);
  let projection=notationPrepared.projection;
  let details: Record<string, unknown> = {};
  function seek(next: number, atMs?: number) {
    ({ index, timeMs } = playbackSeek(moves, lastTs, next, atMs));
    scene.resetOrientation(null);
    scene.replaySetup([record.slot.scramble, track.rebuilt ? prepared.view.rotation : '', ...moves.slice(0,index).map(m => m.m)].filter(Boolean).join(' '));
  }
  function refresh() {
    notationPrepared=prepareReportNotation(analysis.text,method,ui.simplified);
    projection=notationPrepared.projection;
    const previous = timeMs;
    track = playbackTrack(raw, analysis.text?.lines, posed); moves = track.moves;
    lastTs = playbackEndMs(moves, raw);
    seek(previous > 0 ? playbackIndexAt(moves, previous) : 0, previous);
    const rawWalk = method === 'cfop' ? null : walkMethod(method, solve.scramble, raw, solve.timeMs, prepared.view.rotation);
    const walk = rawWalk && analysis.text?.methodStages ? { ...rawWalk, stages: analysis.text.methodStages } : rawWalk;
    const executionMs = method === 'cfop' ? prepared.stepMx?.steps.reduce((s,m) => s + (m.executionMs ?? 0),0) ?? null
      : walk?.stages.reduce((s,m) => s + (m.executionMs ?? 0),0) ?? null;
    const columns = method === 'cfop' && prepared.stageSegs
      ? buildCfopColumns(prepared.stageSegs, prepared.stepMx, prepared.slots, analysis.reference, analysis.slotReference, averages.sampleSize >= 5 ? averages : null)
      : walk ? buildWalkColumns(walk, language === 'zh', historyAverages) : [];
    const rotationCounts = analysis.text?.rotations?.length ? rotationsByStep(analysis.text.rotations,stepTimeBounds(columns.map(c=>c.endIdx),raw)).map(r=>r.length) : null;
    const waste = detectWastedWork(solve.scramble,raw);
    const totals = columnTotals(columns);
    const sequences = reportStepSequences(columns,raw,method,analysis.text?.lines);
    const timeline = reconstructionTimeline(analysis.text?.lines ?? [],raw,method,t=>t[language]);
    const summary=reconstructionSummary(raw,solve.timeMs,analysis.text,executionMs);
    const wasted=new Set<number>();for(const span of waste?.spans??[])for(let i=span.fromIdx;i<=span.toIdx;i++)wasted.add(i);
    hasTable=Boolean(prepared.stageSegs||walk);hasMeta=Boolean(prepared.stageSegs&&method==='cfop');
    contentSlots={summary:reportSummary(solve,summary,tr,capabilities.date),
      analysis:reportStepTable(columns,sequences,rotationCounts,analysis.reference,method,ui,tr,Boolean(analysis.text?.lines.length)),
      meta:reportMeta(solve.inspectionMs??null,prepared.stepMx?.putDownMs??null,tr),
      'reference-list':analysis.reference?reportReferences(analysis.reference,tr):null,
      'raw-list':reportRawMoves(solve,wasted,tr),
    };
    details={shareUrl:'https://cuberoot.me'+(language==='zh'?'/zh':'')+'/timer?replay='+encodeReplayPayload(solve),...summary,
      columns:columns.map(c=>({key:c.key})),
      timeline:timeline.stages,timelineSegments:timeline.segs,
      lines:projection.lines.map(({line,moves:tokens})=>({label:line.label??'',moves:tokens.join(' '),fromIdx:line.fromIdx,toIdx:line.toIdx})),
    };
    documentKey='';
    revision++;
  }
  async function backfillHistory(generation: number, selected: MethodId) {
    const samples: MethodStageMetric[][] = [];
    for (const item of previous) {
      if (generation !== historyGeneration) return;
      const key = methodHistorySource(item,selected);
      let stages = stageCache.get(key);
      if (!stages) {
        const input = historyAnalysisInput(item,selected);
        if (!input) continue;
        let clean = () => {};
        stages = await new Promise<MethodStageMetric[] | undefined>(resolve=>{
          cancelHistory = () => { clean(); resolve(undefined); };
          clean = watchReconstructionAnalyzer.subscribe(input,snapshot=>{
            if (snapshot.status !== 'pending') resolve(snapshot.text?.methodStages);
          });
        });
        clean();
        if (generation !== historyGeneration) return;
        if (stages) { stageCache.set(key,stages); if(stageCache.size>100) stageCache.delete(stageCache.keys().next().value!); }
      }
      if (stages?.at(-1)?.endIdx != null) samples.push(stages);
    }
    if(generation===historyGeneration) { historyAverages = methodStageAverages(samples); historyPending = false; refresh(); }
  }
  function analyze(next: MethodId) {
    unsubscribe(); cancelHistory(); historyGeneration++; historyPending = false; historyAverages = {}; method = next; playing = false;
    linkKey = ''; linkLoading = false; commentCases = new Map();
    prepared = prepareReconstruction(solve, method, language); analysis = emptyAnalysis(); refresh();
    if (!prepared.text) return;
    const started = analysisClock(), generation = historyGeneration;
    let historyStarted = false;
    unsubscribe = watchReconstructionAnalyzer.subscribe({ text:prepared.text,
      scoreable:method === 'cfop' && prepared.stepMx?.putDownMs != null && record.penalty !== 'DNF' }, snapshot => {
      if (snapshot.status !== 'pending' && !historyStarted && next !== 'cfop' && previous.length >= 5) {
        historyStarted = true; historyPending = true;
        void backfillHistory(generation,next).catch(error => {
          console.error('history analysis', String(error));
          if (generation === historyGeneration) { historyPending = false; refresh(); }
        });
      }
      analysis = snapshot; analysisMs = analysisClock()-started; refresh();
      const sets = [...new Set((snapshot.text?.lines ?? []).flatMap(line => reconCommentLinks('// '+(line.label ?? '')).map(link=>link.href.split('/')[3])))].sort();
      const key = sets.join(',');
      if (key && key !== linkKey) {
        linkKey = key; linkLoading = true;
        void Promise.all(sets.map(async set => {
          try { return [set,reconCommentCaseIndex(set,(await loadAlg('3x3',set)).cases)] as const; }
          catch { return [set,new Map<string,string>()] as const; }
        })).then(entries=>{ if (generation === historyGeneration && linkKey === key) { commentCases = new Map(entries); linkLoading = false; refresh(); } });
      }
    });
  }
  analyze(method);
  return {
    dispose: () => { unsubscribe(); historyGeneration++; cancelHistory(); },
    analysisPending: () => analysis.status === 'pending' || linkLoading || historyPending,
    dispatch(input: Record<string, any>) {
      const now = Number(input.now) || 0; scene.advance(now);
      let action:ReportAction|undefined=input.kind==='replay-action'?input.action:undefined;
      // Lifecycle suspension is a transport event, not a separate player policy.
      if(input.kind==='replay-pause')action={type:'pause'};
      if(action){
        const before=ui;ui=reduceReportUI(ui,action);
        if(action.type==='feedback')effect={id:++effectId,type:'feedback',value:ui.feedback};
        if(action.type==='use-scramble')effect={id:++effectId,type:'use-scramble'};
        const result=reportPlayerAction({index,timeMs,playing,speed,posed,run},action,moves,raw,lastTs,gyro.length>0);
        const previousPosed=posed, previousIndex=index;
        ({index,timeMs,playing,speed,posed,run}=result.state);
        if(result.seek){
          if(result.jump)seek(index,timeMs);
          else for(let i=previousIndex;i<index;i++)scene.replayMove(moves[i].m,playbackMoveDurationTicks(moves,i+1,solve.timeMs,speed)!);
        }
        lastNow=now;
        if(previousPosed!==posed||before.simplified!==ui.simplified||before.openColumn!==ui.openColumn)refresh();
        documentKey='';
      }
      if (playing) {
        const frame = playbackFrame(moves,lastTs,timeMs+Math.max(0,now-lastNow)*speed);
        for (;index<frame.index;index++) {
          scene.replayMove(moves[index].m,playbackMoveDurationTicks(moves,index+1,solve.timeMs,speed)!);
        }
        timeMs = frame.timeMs; playing = frame.playing;
      }
      lastNow = now;
      if (posed) {
        const pose = sampleGyroAt(gyro,timeMs);
        scene.pose(gyro[0].frame === 'scramble' ? pose : applyOrientation(pose,null,{
          basis:sensorBasisForBrand(record.device?.model),mirror:mirrorForBrand(record.device?.model) }));
      } else if (!track.rebuilt) {
        scene.pose(notationQuaternion([prepared.view.rotation, ...(analysis.text?.rotations ?? []).filter(r=>r.tMs<=timeMs).map(r=>r.token)].join(' ')));
      }
      const rawIndex=index?moves[index-1].rawAfter:0;
      const key=[revision,index,playing,speed,posed,ui.simplified,ui.feedback,ui.openColumn,JSON.stringify(ui.expanded)].join('|');
      const documentChanged=key!==documentKey;
      if(documentChanged){
        const notation=reportNotation(analysis.text,method,ui,tr,{copyMode:'system',prepared:notationPrepared,currentIdx:rawIndex,canSeek:true,cases:commentCases,
          ...reportNotationExtras(solve,analysis.text,ui,tr,{recordGyro:true,canEnableGyro:false,canFeedback:Boolean(capabilities.canFeedback)})});
        clipboard=notation.clipboard;
        const playback=resolveReportSlots(reportPlayback({index,timeMs,playing,speed,posed,run},moves.length,solve.timeMs,gyro.length>0,Boolean(analysis.text),tr),{notation:notation.node});
        document=resolveReportSlots(reportComposition({solve,recon:analysis.text,analysis,hasAnalysis:Boolean(prepared.text),scoreable:method==='cfop'&&prepared.stepMx?.putDownMs!=null&&solve.penalty!=='DNF',state:ui,tr,hasTable,hasMeta,autoMemoMs:null,hasBldMemo:false}),{
          ...contentSlots,actions:reportActions(solve,tr,ui,Boolean(capabilities.canUse),'report','system'),playback,
        });
        documentKey=key;
      }
      const frame = scene.frame(now);
      return {...frame,active:frame.active||playing||analysis.status==='pending'||linkLoading||historyPending,replay:{...details,
        document:documentChanged?document:null,effect,clipboard,htm:Number(details.stm),stm:Number(details.stm),tps:Number(details.tps),timeMs,totalMs:solve.timeMs,timeText:reportSeconds(timeMs),totalText:reportSeconds(solve.timeMs),index,count:moves.length,rawIndex,playing,speed,
        method,analyzing:!analysis.text&&analysis.status==='pending',analysisPending:analysis.status==='pending'||linkLoading||historyPending,
        analysisError:analysis.status==='error'?'Analysis failed':'',analysisMs,revision,
      }};
    },
  };
}
