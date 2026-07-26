/**
 * facelet 序 ↔ /sim 引擎的 (cubelet, 面) 寻址 —— 嵌入 3D 魔方时的唯一一份换算。
 *
 * facelet 序是标准 URFDLB 行主序(U 0..n²-1,再 R F D L B),也就是 Kociemba /
 * visualcube fd 用的那套;`Cube.serialize()` 就按这个序输出。引擎那边一枚贴纸的
 * 地址是 (cubelet 的 initial 索引, 本地面),两者对不上就会画错/点错块,所以两个
 * 消费方(/scramble/solver 的立体画板、/predict 的题板)共用这一份。
 *
 * 表由「从未拧过的 order-N 魔方」推出,逐面枚举顺序与 Cube.serialize() 的循环
 * 逐字对应(U/R 已对着 facelet.ts 的 Kociemba CORNER_FACELET 表验过)。
 */

/** cuber 引擎的 FACE 枚举:L0 R1 D2 U3 B4 F5。 */
export const ENGINE_FACE = { L: 0, R: 1, D: 2, U: 3, B: 4, F: 5 } as const;

export interface FaceletAddress {
  /** cubelet 的 initial 索引(z·N² + y·N + x)。 */
  cube: number;
  /** ENGINE_FACE 之一。 */
  face: number;
}

/** facelet idx(URFDLB)→ (cubelet, 本地面)。 */
export function buildFaceletMap(N: number): FaceletAddress[] {
  const out: FaceletAddress[] = [];
  const idx = (x: number, y: number, z: number) => z * N * N + y * N + x;
  let x: number, y: number, z: number;
  y = N - 1; for (z = 0; z < N; z++) for (x = 0; x < N; x++) out.push({ cube: idx(x, y, z), face: ENGINE_FACE.U });
  x = N - 1; for (y = N - 1; y >= 0; y--) for (z = N - 1; z >= 0; z--) out.push({ cube: idx(x, y, z), face: ENGINE_FACE.R });
  z = N - 1; for (y = N - 1; y >= 0; y--) for (x = 0; x < N; x++) out.push({ cube: idx(x, y, z), face: ENGINE_FACE.F });
  y = 0; for (z = N - 1; z >= 0; z--) for (x = 0; x < N; x++) out.push({ cube: idx(x, y, z), face: ENGINE_FACE.D });
  x = 0; for (y = N - 1; y >= 0; y--) for (z = 0; z < N; z++) out.push({ cube: idx(x, y, z), face: ENGINE_FACE.L });
  z = 0; for (y = N - 1; y >= 0; y--) for (x = N - 1; x >= 0; x--) out.push({ cube: idx(x, y, z), face: ENGINE_FACE.B });
  return out;
}

/** `${cubelet}_${face}` → facelet idx,给「点到哪枚贴纸」反查用。 */
export function buildReverseFaceletMap(map: readonly FaceletAddress[]): Map<string, number> {
  const m = new Map<string, number>();
  map.forEach((e, i) => m.set(`${e.cube}_${e.face}`, i));
  return m;
}
