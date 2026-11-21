import type { FrameResult, InferenceBackend, Settings } from "./detector";

export function videoResultKey(size: number, backend: InferenceBackend, settings: Settings, fitPose: boolean,
  fittingConfig?:{scramble:string;turningStartFrame:number|null;originSeconds?:number;endSeconds?:number}) {
  return JSON.stringify([size, backend, settings.thresholds, settings.presenceThreshold,
    settings.bboxThreshold, settings.roiPadding, fitPose, fitPose ? fittingConfig : null]);
}
export interface SavedVideoResult { timestamp: number; result: FrameResult }

/** Results only: video pixels are decoded on demand, rather than retained. */
export class VideoResultCache {
  private variants = new Map<string, SavedVideoResult[]>();
  put(key: string, timestamp: number, result: FrameResult) {
    const rows = this.variants.get(key) ?? [];
    const index = this.lowerBound(rows, timestamp);
    if (index < rows.length && Math.abs(rows[index].timestamp - timestamp) < 0.00001) rows[index] = { timestamp, result };
    else rows.splice(index, 0, { timestamp, result });
    this.variants.set(key, rows);
    return rows.length;
  }
  get(key: string, timestamp: number, tolerance = 0.00001): SavedVideoResult | undefined {
    const rows = this.variants.get(key);
    if (!rows?.length) return;
    const index = this.lowerBound(rows, timestamp);
    const before = rows[index - 1], after = rows[index];
    const nearest = !before ? after : !after ? before :
      timestamp - before.timestamp <= after.timestamp - timestamp ? before : after;
    return nearest && Math.abs(nearest.timestamp - timestamp) <= tolerance ? nearest : undefined;
  }
  count(key: string) { return this.variants.get(key)?.length ?? 0; }
  entries(key: string): readonly SavedVideoResult[] { return [...(this.variants.get(key) ?? [])]; }
  clear() { this.variants.clear(); }
  private lowerBound(rows: SavedVideoResult[], timestamp: number) {
    let lo = 0, hi = rows.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (rows[mid].timestamp < timestamp) lo = mid + 1; else hi = mid; }
    return lo;
  }
}
