/** 手写声明:_svg_invariants.mjs(纯 JS,供 node CLI 直跑,故不写成 .ts)。 */
export interface SvgPlate { pts: [number, number][]; w: number; fill: string; group: number; roundJoin: boolean }
export interface SvgSticker { pts: [number, number][]; fill: string; order: number }
export interface SchematicDoc {
  viewBox: [number, number, number, number] | null;
  plates: SvgPlate[];
  plateRuns: SvgPlate[][];
  hiddenStickers: SvgSticker[];
  visibleStickers: SvgSticker[];
  strayStickers: number;
  perPathOpacity: number;
}
export interface AuditCheck { name: string; pass: boolean; detail: string }
export function parseSchematicSvg(svg: string): SchematicDoc;
export function signedDist(poly: [number, number][], x: number, y: number): number;
export function triangleFanSamples(poly: [number, number][], div?: number): [number, number][];
export function coverageLeak(
  stickerPolys: [number, number][][], plates: { pts: [number, number][]; w: number }[], tol?: number,
): { count: number; worst: number };
export function cornerMismatches(
  plates: { pts: [number, number][]; w: number }[], tol?: number,
): { a: number; b: number; p: [number, number]; q: [number, number]; d: number }[];
export function auditSchematicSvg(svg: string): { pass: boolean; checks: AuditCheck[]; doc: SchematicDoc };
