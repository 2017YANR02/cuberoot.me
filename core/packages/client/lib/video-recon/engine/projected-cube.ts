import { stateAtFrame } from "./cube-colors";
import type { ColorTimeline } from "./cube-colors";
import { layerTransition, makeCubePose } from "./cube-motion";
import type { CubePose } from "./cube-motion";
import type { MoveStep } from "./move-search-types";
import { poseIsFlagged, projectedGeometryIndex } from "./reconstruction-view";
import type {FrameResult} from './detector';
import turns from "../pose-fitter/tables/render-turns.json";
import type { V3 } from "./cube-motion";
import {displaySliceCommits} from './cube-display-slices';

export interface ProjectedCubeFrame { frame:number; pose:CubePose }
export interface MeasuredCubeFrame extends ProjectedCubeFrame { timestamp:number }
const linear=(t:number)=>t;
const moveTurns=turns as Record<string,{axis:number;angles:number[]}>;

/** Display-only: retain an offset excursion only if that layer commits before
 * it returns to flat (including the flat/axis-change endpoint). A commit can
 * wrap +45 to -45 within the same excursion. Camera rotation and sticker states
 * stay untouched; inputs are never mutated. */
export function hideUncommittedMisalignments(rows:readonly ProjectedCubeFrame[],steps:readonly MoveStep[],fps=30):ProjectedCubeFrame[] {
 const commits=Array.from({length:3},()=>Array.from({length:3},()=>[] as number[]));
 const slices=displaySliceCommits(rows,steps,fps),sliceFrames=new Set(slices.flatMap(slice=>slice.sourceFrames));
 for(const slice of slices)commits[slice.axis][1].push(slice.frame);
 for(const step of steps)for(const raw of step.state_moves){
  if(sliceFrames.has(step.frame_index))continue;
  const turn=moveTurns[raw.replaceAll('’',"'").replace(/2'$/,'2')];
  if(!turn||turn.angles.every(angle=>angle===turn.angles[0]))continue;
  turn.angles.forEach((angle,layer)=>{if(angle!==0)commits[turn.axis][layer].push(step.frame_index);});
 }
 const angles=rows.map(row=>[...row.pose.angles] as V3);
 for(let axis=0;axis<3;axis++)for(let layer=0;layer<3;layer++){
  const active=(index:number)=>rows[index].pose.axis===axis&&Math.abs(rows[index].pose.angles[layer])>1e-6;
  let index=0;
  while(index<rows.length){
   if(!active(index)){index++;continue;}
   const first=index;while(index+1<rows.length&&active(index+1))index++;
   const last=index,end=rows[Math.min(last+1,rows.length-1)].frame;
   const committed=commits[axis][layer].some(frame=>frame>=rows[first].frame&&frame<=end);
   if(!committed)for(let i=first;i<=last;i++)angles[i][layer]=0;
   index++;
  }
 }
 return rows.map((row,i)=>angles[i].every((angle,layer)=>angle===row.pose.angles[layer])?row:{...row,pose:{...row.pose,angles:angles[i]}});
}

function lowerBound(rows:readonly ProjectedCubeFrame[],frame:number) {
 let lo=0,hi=rows.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].frame<frame)lo=mid+1;else hi=mid;}
 return lo;
}

/** Source-time interpolation is deterministic during playback and scrubbing.
 * The component separately eases each new target in wall-clock time. */
export function projectedCubeAtFrame(rows:readonly ProjectedCubeFrame[],frame:number):CubePose|undefined {
 const index=lowerBound(rows,frame),before=rows[index-1],after=rows[index];
 if(!before)return after?.pose;
 if(!after)return before.pose;
 if(after.frame===frame)return after.pose;
 return layerTransition(before.pose,after.pose).sample((frame-before.frame)/(after.frame-before.frame),linear);
}

/** Build one display target from accepted geometry and the matching sticker state. */
export function measuredCubeFrame(
  row: { timestamp: number; result: Pick<FrameResult, 'fittedPose'> },
  colors: ColorTimeline,
  { fps, solved, turningStartFrame }: { fps: number; solved: boolean; turningStartFrame?: number | null },
  step?: MoveStep,
): MeasuredCubeFrame | undefined {
  const fit = row.result.fittedPose;
  if (!fit?.pose || poseIsFlagged(fit, step?.pose_flagged)) return;
  const frame = fit.sourceFrame ?? Math.round(row.timestamp * fps);
  const state = stateAtFrame(colors, frame, solved);
  const geometry = fit.bank[projectedGeometryIndex(fit, step?.geometry_option_index,
    turningStartFrame != null && frame <= turningStartFrame)];
  const pose = state && geometry ? makeCubePose(geometry, state, step?.orientation_symmetry_index) : undefined;
  if (pose) return { frame, pose, timestamp: row.timestamp };
}

/** Rejected fits never become render anchors. Bridge them using accepted
 * orientations and legal layer transitions, including commits in pose gaps. */
export function buildCubeReplayTimelines(rows:readonly {timestamp:number;result:Pick<FrameResult,'fittedPose'>}[],colors:ColorTimeline,
 options:{fps:number;solved:boolean;steps:readonly MoveStep[];turningStartFrame?:number|null}) {
 const steps=new Map(options.steps.map(step=>[step.frame_index,step]));
 const measured:MeasuredCubeFrame[]=[];
 for(const row of rows){
  const frame = row.result.fittedPose?.sourceFrame ?? Math.round(row.timestamp * options.fps);
  const cube = measuredCubeFrame(row, colors, options, steps.get(frame));
  if (cube) measured.push(cube);
 }
 measured.sort((a,b)=>a.frame-b.frame);
 if(!measured.length)return {measured,projected:[]};
 const timeline=new Map<number,ProjectedCubeFrame>(measured.map(row=>[row.frame,row]));
 for(const [index,state] of colors.frames.entries()){
  // A commit with no accepted geometry still gets an aligned target at its
  // own source frame. Keep the initial state before a leading pose gap too.
  if(timeline.has(state.frame)||(index!==0&&!steps.get(state.frame)?.state_moves.length))continue;
  const nearest=projectedCubeAtFrame(measured,state.frame)!;
  timeline.set(state.frame,{frame:state.frame,pose:{...nearest,angles:[0,0,0],state}});
 }
 const result=[...timeline.values()].sort((a,b)=>a.frame-b.frame);
 const projected=options.solved?hideUncommittedMisalignments(result,options.steps,options.fps):result;
 return {measured,projected};
}

export function buildProjectedCubeTimeline(...args:Parameters<typeof buildCubeReplayTimelines>):ProjectedCubeFrame[] {
 return buildCubeReplayTimelines(...args).projected;
}
