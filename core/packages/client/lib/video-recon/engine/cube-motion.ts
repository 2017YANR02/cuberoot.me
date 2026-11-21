import geometry from "../pose-fitter/tables/render-geometry.json";
import turns from "../pose-fitter/tables/render-turns.json";
import orientations from "../pose-fitter/tables/orientations.json";
import { applyCubeMove } from "./cube-colors";
import type { CubeColor, CubeStateSnapshot } from "./cube-colors";
import type { FittedGeometry } from "./pose-types";
import type { ColoredFace } from "./reconstruction-view";
export type V3=[number,number,number];
export type Quaternion=[number,number,number,number];
export interface CubePose {rotation:Quaternion;axis:number;angles:V3;state:CubeStateSnapshot}
export interface CubeSurface {face:number;sticker:number;color:CubeColor;points:V3[];normal:V3}
export interface LayerPhase {axis:number;start:V3;end:V3;state:CubeStateSnapshot}
const zero=():V3=>[0,0,0];
const dot=(a:V3,b:V3)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V3)=>a.map(v=>v/Math.hypot(...a)) as V3;
export function axisAngle(v:V3):Quaternion {
 const angle=Math.hypot(...v);if(angle<1e-15)return [0,0,0,1];
 const s=Math.sin(angle/2)/angle;return [v[0]*s,v[1]*s,v[2]*s,Math.cos(angle/2)];
}
export function multiply(a:Quaternion,b:Quaternion):Quaternion {return [
 a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
 a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
 a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
 a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
export function rotate(q:Quaternion,p:V3):V3 {
 const u=q.slice(0,3) as V3,t=cross(u,p).map(v=>2*v) as V3,c=cross(u,t);
 return p.map((v,i)=>v+q[3]*t[i]+c[i]) as V3;
}
function slerp(a:Quaternion,b:Quaternion,t:number):Quaternion {
 let cosine=a.reduce((sum,v,i)=>sum+v*b[i],0);
 if(cosine<0){b=b.map(v=>-v) as Quaternion;cosine=-cosine;}
 const angle=Math.acos(Math.min(1,cosine)),s=Math.sin(angle);
 const left=s<1e-8?1-t:Math.sin((1-t)*angle)/s,right=s<1e-8?t:Math.sin(t*angle)/s;
 const q=a.map((v,i)=>v*left+b[i]*right),length=Math.hypot(...q);
 return q.map(v=>v/length) as Quaternion;
}
export function makeCubePose(fit:Pick<FittedGeometry,"axis"|"params"|"angles">,state:CubeStateSnapshot,
 orientationSymmetry?:number|null):CubePose|undefined {
 if(!geometry.layers[fit.axis]||fit.params.length<3||fit.angles.length!==3||
  ![...fit.params.slice(0,3),...fit.angles].every(Number.isFinite))return;
 let rotation=axisAngle(fit.params.slice(0,3) as V3),axis=fit.axis,angles=[...fit.angles] as V3;
 if(orientationSymmetry!=null){
  const symmetry=orientations.matrices[orientationSymmetry],vector=orientations.rvecs[orientationSymmetry];
  if(!symmetry||!vector)return;
  rotation=multiply(rotation,axisAngle(vector.map(v=>-v) as V3));
  axis=symmetry.findIndex(row=>row[fit.axis]!==0);
  if(symmetry[axis][fit.axis]<0)angles=[-angles[2],-angles[1],-angles[0]];
 }
 return {rotation,axis,angles,state};
}
/** Exactly three shared matrices. No face or cubie owns an animation path. */
export function layerRotations(pose:CubePose):Quaternion[] {
 return pose.angles.map(angle=>{const v=zero();v[pose.axis]=angle*Math.PI/180;return multiply(pose.rotation,axisAngle(v));});
}
export function poseSurfaces(pose:CubePose):CubeSurface[] {
 const layers=layerRotations(pose);
 return geometry.faces.map((face,id)=>{
  const q=layers[geometry.layers[pose.axis][id]];
  return {face:id,sticker:pose.state.stickers[id],color:pose.state.colors[id],
   points:face.map(p=>rotate(q,p.map(v=>v/geometry.cube_size) as V3)),normal:rotate(q,unit(geometry.normals[id] as V3))};
 });
}
/** Standalone projection diagnostics use the same shared layer transforms. */
export function cubeSurfaces(fit:Pick<FittedGeometry,"axis"|"params"|"angles">,colors:CubeColor[],stickers:number[]):CubeSurface[] {
 const pose=makeCubePose(fit,{colors,stickers,moves:[]});return pose?poseSurfaces(pose):[];
}
export function projectSurfaces(surfaces:CubeSurface[]):ColoredFace[] {
 return surfaces.flatMap(face=>{
  const center=face.points.reduce<V3>((sum,p)=>sum.map((v,i)=>v+p[i]/4) as V3,[0,0,0]);
  if(dot(face.normal,[-center[0],-center[1],-4-center[2]])<=0||!face.color)return [];
  return [{face:face.face,color:face.color,depth:center[2]+4,points:face.points.map(([x,y,z]):[number,number]=>[3*x/(z+4),3*y/(z+4)])}];
 }).sort((a,b)=>b.depth-a.depth||a.face-b.face);
}
const moveTurns=turns as Record<string,{axis:number;angles:number[]}>;
const normalize=(move:string)=>move.replaceAll("’","'").replace(/2'$/,"2");
const inverse=(move:string)=>move.endsWith("2")?move:move.endsWith("'")?move.slice(0,-1):move+"'";
export interface TurnAction {token:string;axis:number;angles:V3;history:readonly string[]}
export function relativeTurns(from:readonly string[],to:readonly string[]):TurnAction[] {
 let common=0;while(common<from.length&&common<to.length&&normalize(from[common])===normalize(to[common]))common++;
 const actions:TurnAction[]=[];
 const add=(raw:string,undo:boolean,history:readonly string[])=>{
  const token=normalize(raw),turn=moveTurns[token];if(!turn)throw new Error(`Unknown cube turn: ${token}`);
  actions.push({token:undo?inverse(token):token,axis:turn.axis,angles:turn.angles.map(v=>undo?-v:v) as V3,history});
 };
 for(let i=from.length-1;i>=common;i--)add(from[i],true,from.slice(0,i));
 for(let i=common;i<to.length;i++)add(to[i],false,to.slice(0,i+1));
 return actions;
}
const span=(phase:LayerPhase)=>Math.max(...phase.start.map((v,i)=>Math.abs(phase.end[i]-v)));
export const easeOutCubic=(t:number)=>1-(1-Math.max(0,Math.min(1,t)))**3;
/** Rebase discrete commits into slab angles, then interpolate a legal cube
 * configuration. Perpendicular turns meet only at aligned layer boundaries.
 * Retargeting starts from the sampled configuration, cutting off the old curve. */
export function layerTransition(from:CubePose,to:CubePose) {
 const phases:LayerPhase[]=[];
 let current=from;
 const add=(axis:number,start:V3,end:V3,state:CubeStateSnapshot)=>{
  const phase={axis,start,end,state};if(span(phase)>1e-8)phases.push(phase);
  current={...from,axis,angles:end,state};
 };
 const actions=relativeTurns(from.state.moves,to.state.moves);
 for(let i=0;i<actions.length;){
  const axis=actions[i].axis,delta=zero();let state=current.state;
  while(i<actions.length&&actions[i].axis===axis){
   const action=actions[i++];delta.forEach((_,k)=>delta[k]+=action.angles[k]);
   state=applyCubeMove(state,action.token,action.history);
  }
  if(current.axis!==axis)add(current.axis,current.angles,zero(),current.state);
  const start=current.angles.map((v,k)=>v-delta[k]) as V3;
  add(axis,start,zero(),state);
 }
 if(current.axis!==to.axis)add(current.axis,current.angles,zero(),current.state);
 const last=phases.at(-1);
 if(last&&last.axis===to.axis&&current.angles.every(v=>Math.abs(v)<1e-8)){
  last.end=to.angles;last.state=to.state;if(span(last)<1e-8)phases.pop();
 } else add(to.axis,current.angles,to.angles,to.state);
 const total=phases.reduce((sum,phase)=>sum+span(phase),0);
 return {phases,sample(progress:number,easing:(t:number)=>number=easeOutCubic):CubePose {
  if(progress<=0)return from;if(progress>=1)return to;
  const t=easing(progress),rotation=slerp(from.rotation,to.rotation,t);
  let distance=t*total;
  for(const phase of phases){
   const length=span(phase);
   if(distance<=length)return {rotation,axis:phase.axis,state:phase.state,
    angles:phase.start.map((v,i)=>v+(phase.end[i]-v)*distance/length) as V3};
   distance-=length;
  }
  return {...to,rotation};
 }};
}
