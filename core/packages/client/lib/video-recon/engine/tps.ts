import type {MoveStep} from './move-search-types';

export const TPS_SIGMA_SECONDS = 0.2;
export interface TurnEvent {timestamp:number;move:string}
export interface TpsPoint {timestamp:number;tps:number}

function normalizedTurn(raw:string):string|undefined {
  let move=raw.replace(/[’′]/g,"'").replace(/2'$/,'2');
  if(/^[urfdlb]/.test(move))move=move[0].toUpperCase()+'w'+move.slice(1);
  return /^(?:[URFDLB]w?|[MES])(?:2|')?$/.test(move)?move:undefined;
}

/** Active upload span uses original commit endpoints, not clip boundaries or
 * the midpoint timestamps used to plot combined half-turn events. */
export function committedTurnSpan(steps:readonly Pick<MoveStep,'frame_index'|'state_moves'>[],fps:number):number|undefined {
  if(!Number.isFinite(fps)||fps<=0)return;
  const frames=steps.filter(step=>Number.isFinite(step.frame_index)&&step.state_moves.some(move=>normalizedTurn(move)))
    .map(step=>step.frame_index);
  if(!frames.length)return;
  const span=(Math.max(...frames)-Math.min(...frames))/fps;
  return span>0?span:undefined;
}

export function tpsSummary(events:readonly TurnEvent[],seconds:number|undefined,moves=events.length) {
  const duration=seconds!==undefined&&Number.isFinite(seconds)&&seconds>=0?seconds:undefined;
  return {moves,seconds:duration,averageTps:duration!==undefined&&duration>0?moves/duration:undefined};
}

/** Match the earlier Gaussian solve plots: one event per HTM turn, including
 * half/wide/slice turns. Adjacent identical quarter commits form one half turn
 * at their midpoint. Keep inverses and other moves separate; omit rotations. */
export function turnEvents(steps:readonly Pick<MoveStep,'frame_index'|'state_moves'>[],fps:number):TurnEvent[] {
  if(!Number.isFinite(fps)||fps<=0)return [];
  const events:TurnEvent[]=[];
  let previous:TurnEvent|undefined;
  for(const step of [...steps].sort((a,b)=>a.frame_index-b.frame_index)){
    if(!Number.isFinite(step.frame_index))continue;
    for(const raw of step.state_moves){
      const move=normalizedTurn(raw);
      if(!move){previous=undefined;continue;}
      const timestamp=step.frame_index/fps;
      if(previous&&previous.move===move&&!move.endsWith('2')){
        previous.move=move.replace(/'$/,'')+'2';
        previous.timestamp=(previous.timestamp+timestamp)/2;
        previous=undefined;
      }else {previous={timestamp,move};events.push(previous);}
    }
  }
  return events;
}

/** Sum normalized Gaussians in seconds. No edge renormalization: the complete
 * curve integrates to the counted moves, including tails outside the viewport. */
export function gaussianTpsAt(events:readonly TurnEvent[],timestamp:number):number {
  if(!Number.isFinite(timestamp))return 0;
  let sum=0;
  for(const event of events){
    const z=(timestamp-event.timestamp)/TPS_SIGMA_SECONDS;
    if(Math.abs(z)<=8)sum+=Math.exp(-0.5*z*z);
  }
  return sum/(TPS_SIGMA_SECONDS*Math.sqrt(2*Math.PI));
}

export function tpsCurve(events:readonly TurnEvent[],start:number,end:number):TpsPoint[] {
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
  const count=Math.min(5000,Math.max(128,Math.ceil((end-start)/0.02)));
  return Array.from({length:count+1},(_,i)=>{
    const timestamp=start+(end-start)*i/count;
    return {timestamp,tps:gaussianTpsAt(events,timestamp)};
  });
}
