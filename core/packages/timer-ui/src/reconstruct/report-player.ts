import type { SolveMove } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import type { ReconstructLocalize } from './ReconstructHost';
import { playbackSeek, rawPlaybackTarget, playbackIndexAt, type PlaybackMove } from './playback-track';
import { groupNode, textNode, buttonNode, type ReportNode, type ReportAction } from './report-content';
import { reportSeconds } from './report-presentation';
export const REPLAY_SPEEDS=[0.5,1,2] as const;
export interface ReportPlayerState {index:number;timeMs:number;playing:boolean;speed:number;posed:boolean;run:number}
export function reportPlayerAction(state:ReportPlayerState,action:ReportAction,track:PlaybackMove[],raw:SolveMove[],lastTs:number,hasGyro:boolean) {
  const next={...state};let seek=false,jump=false;
  const at=(index:number,timeMs?:number)=>{Object.assign(next,playbackSeek(track,lastTs,index,timeMs));next.playing=false;seek=true;jump=true;};
  switch(action.type){
    case 'pause':next.playing=false;break;
    case 'start':at(0);break;
    case 'end':at(track.length);break;
    case 'seek':at(Number(action.value));break;
    case 'step':at(state.index+Number(action.value));jump=Number(action.value)<0;break;
    case 'time':at(playbackIndexAt(track,Number(action.value)),Number(action.value));break;
    case 'play-from':{const target=rawPlaybackTarget(track,raw,Number(action.value),action.timeMs,true);at(target.index,target.timeMs);next.playing=track.length>0&&target.index<track.length;next.run++;break;}
    case 'play':if(!track.length)break;if(state.index>=track.length){at(0);next.playing=true;}else next.playing=!state.playing;next.run++;break;
    case 'speed':if(REPLAY_SPEEDS.includes(Number(action.value) as 1))next.speed=Number(action.value);break;
    case 'gyro':next.posed=Boolean(action.value)&&hasGyro;break;
  }
  return {state:next,seek,jump};
}
export function reportPlayback(state:ReportPlayerState,total:number,totalMs:number,hasGyro:boolean,hasSide:boolean,tr:ReconstructLocalize):ReportNode {
  const control=(id:string,label:string,action:ReportAction,disabled:boolean,icon:string)=>buttonNode(id,label,action,`reconstruct-pb-btn${id==='play'?' is-play':''}`,{disabled,icon});
  return groupNode('playback',[
    groupNode('main',[
      groupNode('top',[textNode('caption',tr({zh:'回放',en:'replay'}),'reconstruct-playback-cap'),groupNode('controls',[
        hasGyro?{id:'gyro',kind:'toggle',text:tr({zh:'陀螺仪',en:'Gyro'}),value:state.posed,action:{type:'gyro'}}:null,
        groupNode('speeds',[textNode('label',tr({zh:'速度',en:'Speed'}),'reconstruct-playback-speed-cap'),...REPLAY_SPEEDS.map(value=>buttonNode(String(value),value+'x',{type:'speed',value},`reconstruct-playback-speed-btn ${state.speed===value?'active':''}`,{selected:state.speed===value}))],'reconstruct-playback-speed','row'),
      ],'reconstruct-playback-controls','row')],'reconstruct-playback-top','row'),
      {id:'cube',kind:'slot'},
      groupNode('counter',[{id:'elapsed',kind:'slot'},textNode('total',' / '+reportSeconds(totalMs))],'reconstruct-playback-counter','row'),
      {id:'timeline',kind:'slot'},
      groupNode('buttons',[
        control('start',tr({zh:'回到开头',en:'To start'}),{type:'start'},state.index===0,'start'),
        control('back',tr({zh:'上一步',en:'Step back'}),{type:'step',value:-1},state.index===0,'back'),
        control('play',state.playing?tr({zh:'暂停',en:'Pause'}):state.index>=total?tr({zh:'重播',en:'Replay'}):tr({zh:'播放',en:'Play'}),{type:'play'},total===0,state.playing?'pause':'play'),
        control('next',tr({zh:'下一步',en:'Step forward'}),{type:'step',value:1},state.index>=total,'next'),
        control('end',tr({zh:'到结尾',en:'To end'}),{type:'end'},state.index>=total,'end'),
      ],'reconstruct-playback-buttons','row'),
    ],'reconstruct-playback-main'),
    hasSide&&groupNode('side',[{id:'notation',kind:'slot'}],'reconstruct-playback-side'),
  ],`reconstruct-playback${hasSide?' has-side':''}`);
}

export function playbackMoveDurationTicks(moves:PlaybackMove[],index:number,totalMs:number,speed:number) {
  if(index<=0)return undefined;
  const move=moves[index-1];
  const interval=move.endTs>move.ts?move.endTs-move.ts:Infinity;
  return Math.max(1,Math.min(500,interval,(moves[index]?.ts??totalMs)-move.ts)*60/(1000*speed));
}
