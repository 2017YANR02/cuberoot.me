import geometry from "../pose-fitter/tables/render-geometry.json";
import type { FittedGeometry } from "./pose-types";

type Vector = [number,number,number];
type Matrix = [Vector,Vector,Vector];
export const CUBE_VIEW_BOX = "-1 -1 2 2";
// Cube units, independent of video resolution, intrinsics and fitted translation.
const CAMERA_DISTANCE = 4, FOCAL_LENGTH = 3;
const dot = (a:Vector,b:Vector) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const transform = (m:Matrix,p:Vector):Vector => [dot(m[0],p),dot(m[1],p),dot(m[2],p)];
function rotation(vector:Vector):Matrix {
  const theta=Math.hypot(...vector);
  if (theta<Number.EPSILON) return [[1,0,0],[0,1,0],[0,0,1]];
  const [x,y,z]=vector.map(value=>value/theta),c=Math.cos(theta),s=Math.sin(theta),k=1-c;
  return [[c+x*x*k,x*y*k-z*s,x*z*k+y*s],
    [y*x*k+z*s,c+y*y*k,y*z*k-x*s],
    [z*x*k-y*s,z*y*k+x*s,c+z*z*k]];
}
export interface CubeFaceProjection { face:number;points:[number,number][];depth:number }
/** Only the selected fit's orientation and residual turns enter the viewer.
 * Source translation is deliberately never read, including for face culling. */
export function fixedCubeProjection(fit:Pick<FittedGeometry,"axis"|"params"|"angles">):CubeFaceProjection[] {
  if (!geometry.layers[fit.axis] || fit.params.length<3 || fit.angles.length!==3 ||
      ![...fit.params.slice(0,3),...fit.angles].every(Number.isFinite)) return [];
  const orientation=rotation(fit.params.slice(0,3) as Vector);
  const layers=fit.angles.map(angle=>{
    const vector:Vector=[0,0,0];vector[fit.axis]=angle*Math.PI/180;
    return rotation(vector);
  });
  return geometry.faces.flatMap((face,id)=>{
    const layer=layers[geometry.layers[fit.axis][id]];
    const points=face.map(point=>transform(orientation,transform(layer,
      point.map(value=>value/geometry.cube_size) as Vector)));
    const center=points.reduce<Vector>((sum,p)=>sum.map((value,i)=>value+p[i]/4) as Vector,[0,0,0]);
    const normal=transform(orientation,transform(layer,geometry.normals[id] as Vector));
    if (dot(normal,[-center[0],-center[1],-CAMERA_DISTANCE-center[2]])<=0) return [];
    return [{face:id,depth:center[2]+CAMERA_DISTANCE,
      points:points.map(([x,y,z]):[number,number]=>[
        FOCAL_LENGTH*x/(z+CAMERA_DISTANCE),FOCAL_LENGTH*y/(z+CAMERA_DISTANCE)])}];
  });
}
