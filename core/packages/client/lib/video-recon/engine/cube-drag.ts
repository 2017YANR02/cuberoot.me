import { axisAngle, multiply } from "./cube-motion";
import type { Quaternion, V3 } from "./cube-motion";

export type DragPoint=[number,number];
export type CubeDragKind="orbit"|"roll";
const unit=(q:Quaternion)=>{const length=Math.hypot(...q);return q.map(v=>v/length) as Quaternion;};
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Project onto a virtual trackball facing the viewer. The hyperbolic edge
 * stays smooth when a captured pointer leaves the visible circle. */
function trackball([x,y]:DragPoint):V3 {
 const radiusSquared=x*x+y*y,z=radiusSquared<=.5?Math.sqrt(1-radiusSquared):.5/Math.sqrt(radiusSquared);
 const length=Math.hypot(x,y,z);return [x/length,y/length,-z/length];
}

/** Sample from the gesture's original orientation, so the result does not
 * depend on pointer event frequency or on video frames arriving during drag. */
export function dragCubeView(view:Quaternion,from:DragPoint,to:DragPoint,kind:CubeDragKind):Quaternion {
 if(from[0]===to[0]&&from[1]===to[1])return view;
 let delta:Quaternion;
 if(kind==="roll"){
  if(Math.hypot(...from)<1e-8||Math.hypot(...to)<1e-8)return view;
  const angle=Math.atan2(from[0]*to[1]-from[1]*to[0],from[0]*to[0]+from[1]*to[1]);
  delta=axisAngle([0,0,angle]);
 }else{
  const a=trackball(from),b=trackball(to),axis=cross(a,b),cosine=a.reduce((sum,v,i)=>sum+v*b[i],0);
  // Finite trackball samples lie on the front hemisphere, but retain a stable
  // antipodal fallback for very long drags outside the viewport.
  if(1+cosine<1e-10){
   const perpendicular=cross(a,Math.abs(a[0])<.8?[1,0,0]:[0,1,0]),length=Math.hypot(...perpendicular);
   delta=[perpendicular[0]/length,perpendicular[1]/length,perpendicular[2]/length,0];
  }else delta=unit([...axis,1+cosine]);
 }
 return unit(multiply(delta,view));
}

/** Arrow keys turn/tilt in the display; Q/E roll about the viewing axis. */
export function nudgeCubeView(view:Quaternion,key:string,fine=false):Quaternion|undefined {
 const angle=(fine?2:10)*Math.PI/180;
 const axes:Record<string,V3>={ArrowLeft:[0,angle,0],ArrowRight:[0,-angle,0],
  ArrowUp:[-angle,0,0],ArrowDown:[angle,0,0],q:[0,0,-angle],e:[0,0,angle]};
 const vector=axes[key.length===1?key.toLowerCase():key];
 return vector?unit(multiply(axisAngle(vector),view)):undefined;
}
