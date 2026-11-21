import orientations from "../pose-fitter/tables/orientations.json";
import turns from "../pose-fitter/tables/render-turns.json";
import { axisAngle, multiply, rotate } from "./cube-motion";
import type { CubePose, Quaternion, V3 } from "./cube-motion";
import type { MoveStep } from "./move-search-types";
import { projectedCubeAtFrame } from "./projected-cube";
import type { ProjectedCubeFrame } from "./projected-cube";
import {displaySliceCommits} from './cube-display-slices';
import type {DisplaySlice} from './cube-display-slices';

const moveTurns=turns as Record<string,{axis:number;angles:number[]}>;
const clean=(move:string)=>move.replaceAll("’","'").replace(/2'$/,"2");
const inverse=(q:Quaternion):Quaternion=>[-q[0],-q[1],-q[2],q[3]];
const quarter=(angle:number)=>((angle%360)+360)%360;
const moveCache=new Map<string,string>();
const identity=orientations.identity_index;
export const CAMERA_ORIENTATION:Quaternion=[0,0,0,1];
const orientationQuaternions=orientations.rvecs.map(vector=>axisAngle(vector as V3));
const orientationIndices=new Map(orientations.matrices.map((matrix,index)=>[matrix.flat().join(","),index]));
const normals:V3[]=[[0,0,1],[0,0,-1],[0,-1,0],[0,1,0],[1,0,0],[-1,0,0]];
const dot=(a:V3,b:V3)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Orthographic isometric notation reference: equally visible U/F/R faces,
// with U straight up, F down-left, R down-right. This does not set the camera.
const notationFront:V3=[-1/Math.sqrt(2),1/Math.sqrt(6),-1/Math.sqrt(3)];
const notationRight:V3=[1/Math.sqrt(2),1/Math.sqrt(6),-1/Math.sqrt(3)];

/** Name faces using the orthographic isometric notation reference. U is the
 * nearest face to screen-up; jointly align F down-left and R down-right rather
 * than naming whichever face is most viewer-facing as F. */
export function displayCubeBasis(rotation:Quaternion):number {
 const best=(candidates:V3[],direction:V3)=>candidates.reduce((chosen,normal)=>
  dot(rotate(rotation,normal),direction)>dot(rotate(rotation,chosen),direction)+1e-10?normal:chosen);
 const up=best(normals,[0,-1,0]);
 const score=(front:V3)=>dot(rotate(rotation,front),notationFront)+dot(rotate(rotation,cross(up,front)),notationRight);
 const front=normals.filter(normal=>dot(normal,up)===0).reduce((chosen,normal)=>score(normal)>score(chosen)+1e-10?normal:chosen);
 const right=cross(up,front);
 return orientationIndices.get([...right,...front.map(v=>-v),...up].join(","))!;
}

function orientedLayers(axis:number,angles:readonly number[],orientation:number) {
 const matrix=orientations.matrices[orientation];
 const target=matrix.findIndex(row=>row[axis]!==0),sign=matrix[target][axis];
 return {axis:target,angles:(sign>0?[...angles]:[-angles[2],-angles[1],-angles[0]]) as V3};
}

/** Conjugate every supported face, wide, slice or whole-cube turn. */
export function reorientedMove(raw:string,orientation:number):string {
 const move=clean(raw),turn=moveTurns[move];
 if(!turn)throw new Error(`Unknown cube turn: ${raw}`);
 const key=`${orientation}/${move}`,cached=moveCache.get(key);if(cached)return cached;
 const mapped=orientedLayers(turn.axis,turn.angles,orientation);
 const lowercase=/^[rludfb]/.test(move);
 const match=Object.entries(moveTurns).find(([name,candidate])=>
  /^[rludfb]/.test(name)===lowercase&&candidate.axis===mapped.axis&&
  candidate.angles.every((angle,i)=>quarter(angle)===quarter(mapped.angles[i])));
 if(!match)throw new Error(`Cannot reorient cube turn: ${raw}`);
 moveCache.set(key,match[0]);return match[0];
}

function rotationForMove(move:string):Quaternion {
 const turn=moveTurns[move];
 if(!turn||!turn.angles.every(angle=>angle===turn.angles[0]))throw new Error("Cube setup needs an x, y or z rotation");
 const vector:V3=[0,0,0];vector[turn.axis]=turn.angles[0]*Math.PI/180;
 return axisAngle(vector);
}

/** Rotate about the actual cube face axes currently named R/U/F on screen.
 * Keep a camera-space view offset so every later tracked rotation is carried
 * through the same view change, rather than rotating only the sticker state. */
export function rotateCubeView(view:Quaternion,cube:Quaternion,move:string):Quaternion {
 const displayed=multiply(view,cube),basis=orientationQuaternions[displayCubeBasis(displayed)];
 const local=multiply(multiply(inverse(basis),rotationForMove(move)),basis);
 const cameraTurn=multiply(multiply(displayed,local),inverse(displayed));
 const next=multiply(cameraTurn,view),length=Math.hypot(...next);
 return next.map(value=>value/length) as Quaternion;
}

const nearestOrientation=(q:Quaternion)=>orientationQuaternions.reduce((best,candidate,index)=>{
 const score=Math.abs(candidate.reduce((sum,v,i)=>sum+v*q[i],0));
 return score>best.score?{index,score}:best;
},{index:identity,score:-1}).index;

// These words compose in move order: each token acts in the displayed frame.
const rotationWords=(()=>{
 const words=new Map<number,string[]>([[identity,[]]]),queue=[identity];
 for(const basis of queue)for(const move of ["x","x'","x2","y","y'","y2","z","z'","z2"]){
  const next=nearestOrientation(multiply(rotationForMove(move),orientationQuaternions[basis]));
  if(!words.has(next)){words.set(next,[...words.get(basis)!,move]);queue.push(next);}
 }
 return words;
})();

/** Setup after the entered scramble. The first observed basis is implicit in
 * the on-screen moves, but an external player starts in the scramble basis. */
export function initialGripMoves(rows: readonly ProjectedCubeFrame[], view: Quaternion): readonly string[] {
  if (!rows.length) return [];
  const basis = displayCubeBasis(multiply(view, rows[0].pose.rotation));
  return rotationWords.get(basis)!;
}

export const CUBE_GRIP_ROTATIONS: readonly string[] = [...rotationWords.values()].map(word => word.join(' '));

function rotationAngle(q: Quaternion) {
 return 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180 / Math.PI;
}

/** Compare measured cube-to-camera poses in the fixed colour axes. */
export function relativeCubeGrip(reference: Quaternion, observed: Quaternion) {
 const relative = multiply(inverse(reference), observed);
 const basis = nearestOrientation(relative);
 const exact = orientationQuaternions[basis];
 // Local-axis turns compose on the right of the cube-to-camera pose.
 const moves = [...rotationWords.get(basis)!].reverse();
 return {
  basis,
  moves,
  target: multiply(reference, exact),
  degrees: rotationAngle(relative),
  errorDegrees: rotationAngle(multiply(inverse(exact), relative)),
  axis: moves.length === 1 ? moveTurns[moves[0]].axis : undefined,
 };
}

export interface ReorientedMoveStep { frame:number; moves:string[]; rotation:boolean }
export interface DisplayMoveToken { frame:number;move:string;rotation:boolean }
/** Frame batches carry timing, not visual grouping. Merge adjacent matching
 * quarter turns token by token, including pairs inside or across batches. */
export function displayMoveTokens(steps:readonly ReorientedMoveStep[]):DisplayMoveToken[] {
 const tokens:DisplayMoveToken[]=[];
 for(const step of steps)for(const raw of step.moves){
  const move=clean(raw),last=tokens.at(-1);
  if(last&&last.rotation===step.rotation&&last.move===move&&/^(?:[RLUDFB]w?|[MESxyzrludfb])'?$/.test(move)){
   last.move=move.replace(/'$/,"")+"2";last.frame=step.frame;
  }else tokens.push({frame:step.frame,move,rotation:step.rotation});
 }
 return tokens;
}
export interface RotationDisplayOptions { fps?:number;rotationThresholdDegrees?:number;minimumRotationSeconds?:number;nativeSlices?:boolean }
/** Fold the observed coordinate-basis jump and simultaneous layer commits
 * into a native slice only when their exact same-axis effect is M/E/S. */
function sliceFromBasisChange(slice:DisplaySlice,previous:number):{move:string;basis:number}|undefined {
 const vector:V3=[0,0,0];vector[slice.axis]=slice.coreDegrees*Math.PI/180;
 const expected=axisAngle(vector);
 const candidate=nearestOrientation(multiply(orientationQuaternions[previous],expected));
 const delta=nearestOrientation(multiply(orientationQuaternions[candidate],inverse(orientationQuaternions[previous])));
 const batch=[...rotationWords.get(delta)!,...slice.moves.map(move=>reorientedMove(move,candidate))].map(move=>moveTurns[move]);
 if(batch.some(turn=>turn.axis!==batch[0].axis))return;
 const angles=[0,1,2].map(layer=>quarter(batch.reduce((sum,turn)=>sum+turn.angles[layer],0)));
 const move=Object.entries(moveTurns).find(([name,turn])=>/^[MES](?:2|')?$/.test(name)&&
  turn.axis===batch[0].axis&&turn.angles.every((angle,i)=>quarter(angle)===angles[i]))?.[0];
 return move?{move,basis:candidate}:undefined;
}
/** Both turns and tracked rotations use the same absolute displayed-face
 * assignment as the controls, including the opening frame's camera angle. */
export function reorientedMoveTimeline(rows:readonly ProjectedCubeFrame[],steps:readonly MoveStep[],view:Quaternion,
 options:RotationDisplayOptions={}):ReorientedMoveStep[] {
 if(!rows.length)return [];
 const fps=options.fps??30,threshold=options.rotationThresholdDegrees??75,minimumSeconds=options.minimumRotationSeconds??.1;
 const byFrame=new Map(steps.map(step=>[step.frame_index,step]));
 const end=steps.at(-1)?.frame_index??rows.at(-1)!.frame;
 const frames=[...new Set([...rows.map(row=>row.frame),...steps.map(step=>step.frame_index)])].filter(frame=>frame<=end).sort((a,b)=>a-b);
 const poses=frames.map(frame=>multiply(view,projectedCubeAtFrame(rows,frame)!.rotation));
 const bases=poses.map(displayCubeBasis);
 const result:ReorientedMoveStep[]=[];
 const slices=new Map((options.nativeSlices===false?[]:displaySliceCommits(rows,steps,fps)).map(slice=>[slice.startFrame,slice]));
 const frameIndices=new Map(frames.map((frame,i)=>[frame,i]));
 const appendMoves=(frame:number,converted:string[])=>{
  const last=result.at(-1);
  // Do not cancel inverse pairs here; that requires the color-checked pass.
  if(last&&!last.rotation&&last.moves.length===1&&converted.length===1&&last.moves[0]===converted[0]&&/^[RLUDFBMESrludfb]'?$/.test(converted[0])){
   last.moves=[converted[0][0]+'2'];last.frame=frame;
  }else result.push({frame,moves:converted,rotation:false});
 };
 let previous=bases[0],anchor=poses[0];
 for(let index=0;index<frames.length;index++){
  const frame=frames[index],candidate=bases[index];
  const moves=byFrame.get(frame)?.state_moves;
  const observed=slices.get(frame),slice=observed?sliceFromBasisChange(observed,previous):undefined;
  if(slice){
   const last=frameIndices.get(observed!.frame)!;
   appendMoves(frames[last],[slice.move]);previous=slice.basis;anchor=poses[last];index=last;continue;
  }
  const angle=2*Math.acos(Math.min(1,Math.abs(multiply(poses[index],inverse(anchor))[3])))*180/Math.PI;
  let stableUntil=index;
  if(candidate!==previous&&angle>=threshold){
   while(stableUntil+1<frames.length&&bases[stableUntil+1]===candidate)stableUntil++;
  }
  if(candidate!==previous&&angle>=threshold&&(frames[stableUntil]-frame)/fps+1e-9>=minimumSeconds){
   const delta=nearestOrientation(multiply(orientationQuaternions[candidate],inverse(orientationQuaternions[previous])));
   const moves=rotationWords.get(delta)!;
   if(moves.length)result.push({frame,moves,rotation:true});
   previous=candidate;anchor=poses[index];
  }
  if(moves?.length){
   appendMoves(frame,moves.map(move=>reorientedMove(move,previous)));
  }
 }
 return result;
}

/** Apply the view to the entire tracked pose. Stickers, signed partial turns
 * and the animation history stay in their original frame during smoothing. */
export function reorientedCubePose(pose:CubePose,view:Quaternion):CubePose {
 if(view.every((v,i)=>v===CAMERA_ORIENTATION[i]))return pose;
 return {...pose,rotation:multiply(view,pose.rotation)};
}
