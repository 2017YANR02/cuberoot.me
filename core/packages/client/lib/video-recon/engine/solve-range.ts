export interface SolveRange { start: number; end: number }
export function trimRange(range: SolveRange, edge: "start" | "end", value: number, duration: number, fps: number): SolveRange {
  if (!Number.isFinite(value)) return range;
  const minimum = Math.min(duration, 1 / (fps > 0 ? fps : 30));
  if (edge === "start") return { start: Math.max(0, Math.min(value, range.end - minimum)), end: range.end };
  return { start: range.start, end: Math.min(duration, Math.max(value, range.start + minimum)) };
}
export function timecode(seconds: number) {
  const centiseconds = Math.round(Math.max(0, seconds) * 100), minutes = Math.floor(centiseconds / 6000);
  return `${minutes}:${String(Math.floor(centiseconds / 100) % 60).padStart(2,"0")}.${String(centiseconds % 100).padStart(2,"0")}`;
}
