import turns from '../pose-fitter/tables/render-turns.json';
import {axisAngle,multiply} from './cube-motion';
import type {CubePose,Quaternion,V3} from './cube-motion';
import type {MoveStep} from './move-search-types';
const moveTurns=turns as Record<string,{axis:number;angles:number[]}>;
const quarter=(angle:number)=>((angle%360)+360)%360;
const inverse=(q:Quaternion):Quaternion=>[-q[0],-q[1],-q[2],q[3]];
export interface DisplaySlice {startFrame:number;frame:number;sourceFrames:number[];moves:string[];axis:number;coreDegrees:number}

/** Resolve only the slice/simultaneous ambiguity, using measured core motion.
 * Two equal outer rotations plus the observed opposing rigid quarter-turn are
 * exactly a middle-layer turn. Short lead/settle windows match the earlier
 * standalone renderer and cannot cross another committed move. */
export function displaySliceCommits(input:readonly {frame:number;pose:CubePose}[],steps:readonly MoveStep[],fps:number):DisplaySlice[] {
 const end=steps.at(-1)?.frame_index??Infinity,rows=input.filter(row=>row.frame<=end);
 const indices=new Map(rows.map((row,i)=>[row.frame,i]));
 const events=steps.filter(step=>step.state_moves.length),committed=new Set(events.map(step=>step.frame_index));
 const resolve=(first:number,last:number,raw:string[]):DisplaySlice|undefined=>{
  if(raw.length<2||first===0)return;
  const parsed=raw.map(move=>moveTurns[move.replaceAll('’',"'").replace(/2'$/,'2')]);
  if(parsed.some(turn=>!turn)||parsed.some(turn=>turn.axis!==parsed[0].axis||turn.angles[1]!==0))return;
  const outer=[0,2].map(layer=>quarter(parsed.reduce((sum,turn)=>sum+turn.angles[layer],0)));
  if(!outer[0]||outer[0]!==outer[1])return;
  const axis=parsed[0].axis,coreDegrees=-outer[0],vector:V3=[0,0,0];vector[axis]=coreDegrees*Math.PI/180;
  const expected=axisAngle(vector),before:number[]=[],after:number[]=[last];
  for(let i=first-1;i>=0&&rows[first].frame-rows[i].frame<=fps*.12+1e-9;i--){before.push(i);if(committed.has(rows[i].frame))break;}
  for(let i=last+1;i<rows.length&&rows[i].frame-rows[last].frame<=fps*.085+1e-9;i++){if(committed.has(rows[i].frame))break;after.push(i);}
  for(const a of before)for(const b of after){
   const delta=multiply(inverse(rows[a].pose.rotation),rows[b].pose.rotation);
   const jump=2*Math.acos(Math.min(1,Math.abs(delta[3])))*180/Math.PI;
   const error=2*Math.acos(Math.min(1,Math.abs(expected.reduce((sum,v,i)=>sum+v*delta[i],0))))*180/Math.PI;
   if(jump>=60&&error<=30)return {startFrame:rows[first].frame,frame:rows[last].frame,
    sourceFrames:first===last?[rows[first].frame]:[rows[first].frame,rows[last].frame],moves:raw,axis,coreDegrees};
  }
 };
 const result:DisplaySlice[]=[];
 for(let i=0;i<events.length;i++){
  const first=indices.get(events[i].frame_index);if(first==null)continue;
  let slice=resolve(first,first,events[i].state_moves);
  if(!slice&&events[i].state_moves.length===1&&i+1<events.length&&events[i+1].state_moves.length===1&&events[i+1].frame_index-events[i].frame_index<=fps*.085+1e-9){
   const last=indices.get(events[i+1].frame_index);
   if(last!=null){slice=resolve(first,last,[...events[i].state_moves,...events[i+1].state_moves]);if(slice)i++;}
  }
  if(slice)result.push(slice);
 }
 return result;
}
