import tables from "../pose-fitter/tables/move-tables.json";
import geometry from "../pose-fitter/tables/render-geometry.json";
import type { MoveStep } from "./move-search-types";

export type CubeColor = "white" | "yellow" | "orange" | "red" | "blue" | "green";
export const CUBE_PALETTE: Record<CubeColor,string> = {
  white:"#f5f6f2",yellow:"#ffd83d",orange:"#ff922d",red:"#e83b3b",blue:"#236ee8",green:"#23b86d",
};
export interface CubeStateSnapshot {colors:CubeColor[];stickers:number[];moves:readonly string[]}
export interface ColorTimeline { initial:CubeColor[]; initialStickers:number[]; initialMoves:readonly string[];frames:({frame:number}&CubeStateSnapshot)[] }
const sources = tables.moves as Record<string,number[]>;
const geometryIndex=new Map(tables.geometry_positions.map((position,index)=>[position,index]));
/** Apply a committed move to the immutable geometry-face state. */
export function applyCubeMove(state:CubeStateSnapshot,move:string,history:readonly string[]):CubeStateSnapshot {
 const permutation=sources[move];if(!permutation)throw new Error(`Unknown cube move: ${move}`);
 const indices=tables.geometry_positions.map(position=>geometryIndex.get(permutation[position])!);
 return {colors:indices.map(i=>state.colors[i]),stickers:indices.map(i=>state.stickers[i]),moves:history};
}
function apply<T>(colors:T[],moves:readonly string[]) {
  for (const raw of moves) {
    const move = raw.endsWith("2'") ? raw.slice(0,-1) : raw;
    if (!sources[move]) throw new Error(`Unknown cube move: ${move}`);
    colors = sources[move].map(index => colors[index]);
  }
  return colors;
}
const faceColors = (positions:CubeColor[]) => tables.geometry_positions.map(index => positions[index]);
const centerFaces = geometry.faces.flatMap((face,index) => {
 const center = [0,1,2].map(axis=>face.reduce((sum,point)=>sum+point[axis]/4,0));
 const normal=geometry.normals[index],axis=normal.findIndex(value=>value!==0);
 return center.every((value,k)=>k===axis||Math.abs(value)<1e-5)?[{index,axis,side:Math.sign(normal[axis])}]:[];
});
/** Wide/slice/whole-cube scramble moves also move the center-color frame. */
export function centerColorsForScramble(scramble:string) {
 const colors=buildColorTimeline(scramble,[]).initial;
 return centerFaces.map(({index,axis,side})=>({axis,side,color:colors[index]}));
}
/** Same physical position permutations as the CPU search. Commits are applied
 * before drawing the current residual geometry, exactly once per frame. */
export function buildColorTimeline(scramble:string,steps:readonly Pick<MoveStep,"frame_index"|"state_moves">[]):ColorTimeline {
  let positions = tables.identity.map(index => tables.solved_colors[index] as CubeColor);
  const initialMoves=scramble.replaceAll("’","'").trim().split(/\s+/).filter(Boolean);
  positions = apply(positions,initialMoves);
  let identities=apply(tables.geometry_positions.map((_,i)=>i),initialMoves);
  let stickers=tables.geometry_positions.map(index=>identities[index]);
  const initialStickers=stickers;
  const initial=faceColors(positions),frames:ColorTimeline["frames"]=[];
  let colors=initial,moves:readonly string[]=initialMoves;
  for (const step of steps) {
    if (step.state_moves.length) {
      positions=apply(positions,step.state_moves);colors=faceColors(positions);
      identities=apply(identities,step.state_moves);stickers=tables.geometry_positions.map(index=>identities[index]);
      moves=[...moves,...step.state_moves];
    }
    frames.push({frame:step.frame_index,colors,stickers,moves});
  }
  return {initial,initialStickers,initialMoves,frames};
}
export function colorsAtFrame(timeline:ColorTimeline,frame:number,solved:boolean):CubeColor[]|undefined {
  return stateAtFrame(timeline,frame,solved)?.colors;
}
export function stateAtFrame(timeline:ColorTimeline,frame:number,solved:boolean) {
  const rows=timeline.frames;
  if (!solved && (!rows.length || frame>rows[rows.length-1].frame)) return;
  let lo=0,hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].frame<=frame)lo=mid+1;else hi=mid;}
  return lo ? rows[lo-1] : {colors:timeline.initial,stickers:timeline.initialStickers,moves:timeline.initialMoves};
}
