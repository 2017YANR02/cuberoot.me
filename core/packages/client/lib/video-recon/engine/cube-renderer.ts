import {CUBE_PALETTE} from "./cube-colors";
import {layerRotations,poseSurfaces,rotate} from "./cube-motion";
import type {CubePose,V3} from "./cube-motion";
const plastic:V3=[.045,.055,.06];
const palette=Object.fromEntries(Object.entries(CUBE_PALETTE).map(([name,hex])=>[
 name,[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255) as V3]));
export interface MeshQuad {points:V3[];color:V3;kind:"body"|"sticker"}
/** Closed, opaque slab bodies and inset stickers share the same three layer
 * transforms. Hidden/internal surfaces participate in the GPU depth buffer. */
export function cubeMesh(pose:CubePose):MeshQuad[] {
 const mesh:MeshQuad[]=[],rotations=layerRotations(pose);
 for(let layer=0;layer<3;layer++){
  const low:V3=[-.5,-.5,-.5],high:V3=[.5,.5,.5];
  low[pose.axis]=-.5+layer/3+.00005;high[pose.axis]=-.5+(layer+1)/3-.00005;
  for(let axis=0;axis<3;axis++)for(const side of [0,1]){
   const u=(axis+1)%3,v=(axis+2)%3;
   const points=([[0,0],[1,0],[1,1],[0,1]] as const).map(([a,b])=>{
    const p:V3=[0,0,0];p[axis]=side?high[axis]:low[axis];p[u]=a?high[u]:low[u];p[v]=b?high[v]:low[v];
    return rotate(rotations[layer],p);
   });
   mesh.push({points,color:plastic,kind:"body"});
  }
 }
 for(const face of poseSurfaces(pose)){
  if(!palette[face.color])continue;
  const center=face.points.reduce<V3>((sum,p)=>sum.map((value,i)=>value+p[i]/4) as V3,[0,0,0]);
  const points=face.points.map(p=>p.map((value,i)=>center[i]+.87*(value-center[i])+.0003*face.normal[i]) as V3);
  mesh.push({points,color:palette[face.color],kind:"sticker"});
 }
 return mesh;
}
const vertex=`attribute vec3 position;
attribute vec3 color;
uniform vec2 aspect;
varying vec3 faceColor;
void main(){
 float z=position.z+4.0;
 gl_Position=vec4(3.0*position.x*aspect.x,-3.0*position.y*aspect.y,2.6666666667*z-9.1666666667,z);
 faceColor=color;
}`;
const fragment=`precision mediump float;
varying vec3 faceColor;
void main(){gl_FragColor=vec4(faceColor,1.0);}`;
export class CubeRenderer {
 private gl:WebGLRenderingContext;
 private program:WebGLProgram;
 private buffer:WebGLBuffer;
 private aspect:WebGLUniformLocation;
 constructor(private canvas:HTMLCanvasElement){
  const gl=canvas.getContext("webgl",{alpha:true,antialias:true,depth:true,preserveDrawingBuffer:false});
  if(!gl)throw new Error("The 3D preview needs WebGL support.");this.gl=gl;
  const compile=(type:number,source:string)=>{
   const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(error??"Unable to compile cube renderer");}
   return shader;
  };
  const program=gl.createProgram()!,vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??"Unable to link cube renderer");
  this.program=program;this.buffer=gl.createBuffer()!;this.aspect=gl.getUniformLocation(program,"aspect")!;
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,offset] of [["position",0],["color",12]] as const){const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset);}
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
  this.resize();
 }
 resize(){
  const cssWidth=this.canvas.clientWidth,cssHeight=this.canvas.clientHeight;
  // Hidden panels have no layout size. Keep their last valid buffer rather
  // than replacing it with a square that can distort the first visible draw.
  if(cssWidth<=0||cssHeight<=0)return;
  const width=Math.max(1,Math.round(cssWidth*(window.devicePixelRatio||1))),height=Math.max(1,Math.round(cssHeight*(window.devicePixelRatio||1)));
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
  this.gl.viewport(0,0,width,height);
 }
 draw(pose?:CubePose){
  this.resize();
  const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!pose)return;
  const values:number[]=[];
  for(const quad of cubeMesh(pose))for(const index of [0,1,2,0,2,3])values.push(...quad.points[index],...quad.color);
  gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  const width=this.canvas.width,height=this.canvas.height;
  gl.uniform2f(this.aspect,Math.min(1,height/width),Math.min(1,width/height));
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.DYNAMIC_DRAW);
  gl.drawArrays(gl.TRIANGLES,0,values.length/6);
 }
 dispose(){this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}
}
