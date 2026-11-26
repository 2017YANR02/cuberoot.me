'use client';

import dynamic from 'next/dynamic';
import { reviewCamera } from '@cuberoot/timer-ui/reconstruct/replay-view';
import { useEffect, useRef, useState } from 'react';
import type { AlgCase } from '@cuberoot/shared/alg';
import { useT } from '@/hooks/useT';
import { goalLabels, returnToTrainingReplay, type GuidedDrill, type PracticeRole } from '@/lib/replay-training-session';
import { loadLibrarySource } from '@/lib/alg-library-cache';
import { useBluetoothCube } from '@/lib/bluetooth';
import { moveClockElapsed, type MoveClockSample } from '@cuberoot/shared/smart-cube/move-clock';
import { measuredTurnSpan, storeGuidedSample } from '@/lib/replay-guided-practice';
import { caseKey } from '@/lib/trainer-case-key';
import { ReplayPracticeCube } from './ReplayPracticeCube';
import { inPracticeSlot, inViewerGrip } from '@/lib/replay-practice-view';
import type { F2lSlotId } from '@cuberoot/shared/timer/reconstruct/f2l-slots';
import './replay-reply.css';

const Player = dynamic(() => import('./AlgPlayer'), {ssr:false});
const aufs = ['', 'U', 'U2', "U'"];
type Attempt = {startedAt:number; tick:number; adjustment:number; entryMs?:number};

export default function ReplayGoalTrainer({owner, set, caseId, session}: {owner:string; set:string; caseId:number;
  session:{id:string; role:PracticeRole; scope:string; returnPath:string; slot?:F2lSlotId; drill:GuidedDrill}}) {
  const t = useT(), drill = session.drill, goal = drill.goal;
  const [item, setItem] = useState<AlgCase>();
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>();
  const active = useRef<Attempt | undefined>(undefined);
  const turns = useRef<{start?:MoveClockSample; times:number[]; valid:boolean}>({times:[], valid:false});
  const [macRequest, setMacRequest] = useState<{device:string; finish:(value:string|null)=>void}>();
  const [mac, setMac] = useState('');
  const cube = useBluetoothCube({
    allowSimulated:false,
    onNeedMac:(device)=>new Promise(resolve=>{setMac('');setMacRequest({device,finish:resolve});}),
    onConnectionEvent:event=>{if(event.kind!=='reconnected') turns.current.valid=false;},
    onMove:(_move,ts,_faces,metadata,clock)=>{
      const run=active.current, stream=turns.current;
      if (!run || !stream.valid || (goal==='transition' && run.entryMs==null)) return;
      if (ts<run.tick+(run.entryMs ?? 0)) return;
      if (!clock || metadata?.estimatedTime || metadata?.futureHistory) {stream.valid=false;return;}
      stream.start ??= clock;
      const elapsed=moveClockElapsed(stream.start,clock);
      if (elapsed==null) stream.valid=false;
      else stream.times.push(elapsed);
    },
  });
  const [completed, setCompleted] = useState(0);
  const [feedback, setFeedback] = useState('');
  useEffect(()=>{
    let live = true;
    setLoadError(false);
    loadLibrarySource('3x3',set).then(file=>{
      const found=file.cases.find(c=>c.id===caseId);
      if(live){setItem(found);setLoadError(!found);}
    }).catch(()=>{if(live)setLoadError(true);});
    return ()=>{live=false;};
  },[set,caseId,retry]);
  const route = goal==='routes' ? completed%2===0?'recorded':'reference' : 'case';
  const librarySetup = item?.algs[0]?.[0]?.setup || item?.setup;
  const setup = drill.setup || (librarySetup && inPracticeSlot(librarySetup, session.slot));
  const line = route==='reference' ? drill.reference : drill.original || inPracticeSlot(item?.algs[0]?.[0]?.alg ?? '', session.slot);
  const [stepping, setStepping] = useState(false);
  const [step, setStep] = useState(0);
  const viewSetup = [(drill.whiteBottom || !drill.setup) && 'z2', setup, aufs[attempt?.adjustment ?? 0]].filter(Boolean).join(' ');
  const shownLine = line && inViewerGrip(line, session.slot);
  function start() {
    if(active.current || !item) return;
    const next={startedAt:Date.now(),tick:performance.now(),adjustment:goal==='recognition'?Math.floor(Math.random()*4):0};
    turns.current={times:[],valid:cube.status.connected && goal!=='recognition'};
    setStepping(false); setStep(0); active.current=next; setAttempt(next); setFeedback('');
  }
  function finish(correct:boolean) {
    const current=active.current;
    if(!current || !item || !setup) return;
    active.current=undefined;
    const ms=Math.max(1,Math.round(performance.now()-current.tick));
    const ok=storeGuidedSample(set,{goal,variant:route,i:completed+1,caseKey:caseKey(item),caseName:item.name,
      ms,entryMs:current.entryMs,turnSpan:turns.current.valid?measuredTurnSpan(turns.current.times):undefined,scramble:[setup,aufs[current.adjustment]].filter(Boolean).join(' '),penalty:correct?'ok':'DNF',
      practiceSample:{id:crypto.randomUUID(),startedAt:current.startedAt,owner,clock:'guided-manual',
        conditions:JSON.stringify([goal,route,setup]),replay:{scope:session.scope,role:session.role}}});
    setAttempt(undefined);
    if(ok)setCompleted(n=>n+1);
    const answer = goal==='recognition' && !correct ? ' · '+(aufs[(4-current.adjustment)%4] || t('原位','Aligned')) : '';
    setFeedback(ok ? t(correct?'正确':'未完成或答错',correct?'Correct':'Missed')+' · '+(ms/1000).toFixed(3)+' s'+answer
      : t('未能保存成绩，请检查设备存储。','Could not save the attempt. Check device storage.'));
  }
  return <section className="replay-reply rr-panel rr-guided" data-no-timer aria-label={t('复盘专项练习','Guided replay practice')}>
    <header><h3>{item?.name} · {t(goalLabels[goal].zh,goalLabels[goal].en)}{drill.sourceStage && ' · '+drill.sourceStage+' '+(session.slot ?? '')}</h3></header>
    {loadError ? <button type="button" onClick={()=>setRetry(n=>n+1)}>{t('重新加载公式','Reload case')}</button> : !item ? <p role="status">{t('正在加载公式…','Loading case…')}</p> : setup ? <>
      <p>{goal==='recognition'?t('记住原位。开始后，选择让顶层回到原位的调整。','Study this orientation. Start, then choose the adjustment that restores it.')
        : goal==='transition'?t('按打乱摆好起点。从上一段末尾连做，进入目标段时标记一次，完成后停止。','Set up the position and start from the previous stage. Mark entry to the target stage, then finish.')
        : goal==='routes'?t('从同一起点交替练原解和参考解，每轮记录正确情况和用时。','Alternate the recorded and reference routes from this position. Mark each result and time.')
        : t('按打乱摆好固定局面。开始后连续完成公式，再标记结果。','Set up the fixed position. Start, execute the case continuously and mark the result.')}</p>
      {stepping && line ? <Player puzzle="3x3" set="" setup={viewSetup} alg={line} sceneRot={reviewCamera(session.slot,set)}
        size={200} moveDurationMs={450} interactionMode="none" hideResetView onStepChange={setStep}/> :
        <ReplayPracticeCube setup={viewSetup} slot={session.slot} set={set} size={160} alt={t('当前练习局面','Current practice position')}/>}
      {goal!=='recognition' && line && !attempt && <div className="rr-actions"><button type="button" aria-pressed={stepping}
        onClick={()=>{setStep(0);setStepping(!stepping);}}>{stepping?t('收起逐步跟练','Close walkthrough'):t('逐步跟练','Step through')}</button></div>}
      {goal!=='recognition' && <><details><summary>{t('起始打乱','Starting scramble')}</summary><code>{inViewerGrip(setup, session.slot) ?? setup}</code></details>
        {line && <p>{route==='reference'?t('参考解','Reference'):route==='recorded'?t('原解','Recorded'):t('练习路线','Practice moves')}{session.slot && shownLine && t('（当前视角）',' (as viewed)')} · <code>{(shownLine ?? line).split(/\s+/).map((m,i)=><span key={i}>{i>0?' ':''}{drill.entryAfter===i && <b> | </b>}{stepping && step===i+1 ? <strong aria-current="step"><u>{m}</u></strong> : m}</span>)}</code>
          {route==='recorded' && drill.recordedTurns!=null && ' · '+drill.recordedTurns+' HTM'}
          {route==='reference' && drill.referenceTurns!=null && ' · '+drill.referenceTurns+' HTM'}
          {drill.entryAfter!=null && <small>{t(' ｜ 后进入目标段',' · Target stage begins after |')}</small>}</p>}</>}
      {goal!=='recognition' && <details><summary>{t('智能魔方转动间隔','Smart cube turn intervals')}</summary>
        <p>{t('连接后记录首末转动用时和最长相邻转动间隔。','Connect to measure first-to-last turn time and the longest gap between turns.')}</p>
        <button type="button" disabled={!!attempt} onClick={()=>cube.status.connected?cube.disconnect():void cube.connect().catch(()=>
          setFeedback(t('连接未完成，可继续手动计时。','Connection incomplete. Manual timing is available.')))}>
          {cube.status.connected?t('断开智能魔方','Disconnect cube'):t('连接智能魔方','Connect cube')}</button>
        {macRequest && <form onSubmit={e=>{e.preventDefault();macRequest.finish(mac.trim());setMacRequest(undefined);}}>
          <label>{macRequest.device} MAC <input value={mac} required onChange={e=>setMac(e.target.value)}/></label>
          <button type="submit">{t('确认','Confirm')}</button><button type="button" onClick={()=>{macRequest.finish(null);setMacRequest(undefined);}}>{t('取消','Cancel')}</button></form>}
      </details>}
      <div className="rr-actions">{!attempt ? <button type="button" onClick={start}>{t('开始本次练习','Start attempt')}</button> :
        goal==='recognition' ? aufs.map((auf,i)=><button key={i} type="button" onClick={()=>finish((attempt.adjustment+i)%4===0)}>{auf || t('原位','Aligned')}</button>) :
          <>{goal==='transition' && attempt.entryMs==null ? <button type="button" onClick={()=>{
            const marked={...attempt,entryMs:Math.round(performance.now()-attempt.tick)};active.current=marked;setAttempt(marked);
          }}>{t('进入目标段','Mark stage entry')}</button> : <button type="button" onClick={()=>finish(true)}>{t('完成 · 正确','Finish · correct')}</button>}
          <button type="button" onClick={()=>finish(false)}>{t('记为失误','Mark missed')}</button></>}</div>
      <small>{t('手动计时','Manual timing')} · {t('本次已记','Attempts saved')} {completed}</small>
    </> : <p role="status">{t('此公式缺少经确认的起始局面。','A verified starting position is unavailable for this case.')}</p>}
    <p role="status">{feedback}</p><div className="rr-actions"><button type="button" onClick={()=>returnToTrainingReplay(session.id,session.returnPath)}>{t('回到本局复盘','Return to this solve')}</button></div>
  </section>;
}
