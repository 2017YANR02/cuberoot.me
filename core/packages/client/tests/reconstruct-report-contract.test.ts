import { describe, expect, it } from 'vitest';
import { initialReportUI, reduceReportUI, reportComposition, reportStepTable, resolveReportSlots, textNode } from '@cuberoot/timer-ui/reconstruct/report-content';
import { reportPlayerAction, playbackMoveDurationTicks } from '@cuberoot/timer-ui/reconstruct/report-player';
import { playbackTrack } from '@cuberoot/timer-ui/reconstruct/playback-track';
import type { Col } from '@cuberoot/timer-ui/reconstruct/report-columns';
import type { Solve } from '@cuberoot/shared/timer/types';
const tr=<T>(value:{zh:T;en:T})=>value.en;
const solve:Solve={id:'contract',ts:1,timeMs:600,event:'333',penalty:'ok',scramble:'R U',moves:[{m:'R',ts:100},{m:'U',ts:300},{m:'R',ts:500}]};
const base=()=>({solve,recon:null,analysis:null,hasAnalysis:true,scoreable:true,state:initialReportUI(),tr,hasTable:true,hasMeta:false,autoMemoMs:null,hasBldMemo:false});
describe('one report contract across renderers',()=>{
  it('serializes the same order, fallback and disclosure state, including future shared content',()=>{
    const input=base();const root=reportComposition(input);
    expect(root.children!.map(n=>n.id)).toEqual(['summary','actions','scramble','playback','analysis-status','analysis','references','raw']);
    const slots={'raw-list':textNode('future-row','Added once in shared content')};
    expect(resolveReportSlots(root,slots)!.children!.at(-1)!.children).toEqual([]);
    input.state=reduceReportUI(input.state,{type:'disclosure',key:'raw'});
    const document=resolveReportSlots(reportComposition(input),slots)!;
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);
    expect(document.children!.at(-1)!.children).toEqual([slots['raw-list']]);
  });
  it('keeps only one table column open, skips optimal badges for free steps and preserves percentages',()=>{
    const column:Col={key:'cross',label:'Cross',chip:null,tone:0,recognitionMs:100,executionMs:200,stepMs:300,cumulativeMs:300,turns:2,refTurns:2,refUserTurns:2,refDelta:0,refSolution:'R U',avgMs:400,skipped:false,endIdx:1};
    let ui=reduceReportUI(initialReportUI(),{type:'column',key:'cross'});
    ui=reduceReportUI(ui,{type:'column',key:'free'});
    const content=reportStepTable([column,{...column,key:'free',label:'F1',skipped:true,turns:0,refTurns:0}],new Map([['cross',['R','U']],['free',[]]]),null,null,'cfop',ui,tr,true)!;
    const table=content.children!.find(n=>n.kind==='table')!;
    expect(table.columns!.map(c=>c.selected)).toEqual([false,true,undefined]);
    expect(table.columns![1].disabled).toBe(true);
    const reference=table.rows!.find(row=>row.id==='reference')!;
    expect(JSON.stringify(reference.cells[0])).toContain('sa-grade optimal');
    expect(JSON.stringify(reference.cells[1])).not.toContain('sa-grade optimal');
    expect(table.rows!.find(row=>row.id==='average')!.cells[0].text).toBe('-25%');
    expect(reduceReportUI(ui,{type:'column',key:'free'}).openColumn).toBe(null);
  });
  it('retains paused sub-move time, repeated stepping, end replay and gyro continuation',()=>{
    const raw=solve.moves!,track=playbackTrack(raw,undefined,false).moves;
    let state={index:0,timeMs:0,playing:false,speed:1,posed:false,run:0};
    for(let i=0;i<3;i++)state=reportPlayerAction(state,{type:'step',value:1},track,raw,500,true).state;
    expect(state.index).toBe(3);expect(state.timeMs).toBe(500);
    const restart=reportPlayerAction(state,{type:'play'},track,raw,500,true);
    expect(restart.state.index).toBe(0);expect(restart.state.playing).toBe(true);expect(restart.jump).toBe(true);
    state={...restart.state,index:1,timeMs:225};
    state=reportPlayerAction(state,{type:'pause'},track,raw,500,true).state;
    expect(state.timeMs).toBe(225);
    state=reportPlayerAction(state,{type:'play'},track,raw,500,true).state;
    state=reportPlayerAction(state,{type:'gyro',value:true},track,raw,500,true).state;
    expect(state.playing).toBe(true);expect(state.timeMs).toBe(225);
    expect(reportPlayerAction(state,{type:'step',value:1},track,raw,500,true).jump).toBe(false);
    expect(reportPlayerAction(state,{type:'step',value:-1},track,raw,500,true).jump).toBe(true);
    expect(reportPlayerAction(state,{type:'speed',value:4},track,raw,500,true).state.speed).toBe(1);
    expect(playbackMoveDurationTicks(track,1,600,1)).toBe(12);
  });
  it('clears feedback on a repeated answer and only changes copy feedback after success',()=>{
    let state=initialReportUI();state=reduceReportUI(state,{type:'feedback',value:false});expect(state.feedback).toBe(false);
    state=reduceReportUI(state,{type:'feedback',value:false});expect(state.feedback).toBeNull();
    expect(reduceReportUI(state,{type:'share'}).copied).toBeNull();
    expect(reduceReportUI(state,{type:'copied',key:'share'}).copied).toBe('share');
  });
});
