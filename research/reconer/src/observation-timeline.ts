/**
 * Short-lived geometric association and visible-state event proposals.
 * No optical flow, hand motion, old splits, answers, or synthetic boundary is
 * consumed. Stable reads do not prove that no hidden move occurred in between.
 */
import type { ColorName } from "./reconstruct.ts";
import { assertGeometryFrame, type GeometryFrame, type GeometryMode, type ObservedFace, type PointXY } from "./visible-geometry.ts";

export interface ObservationInterval {
  startFrameId: string;
  endFrameId: string;
  startPtsSeconds: number;
  endPtsSeconds: number;
  startTimeMs: number | null;
  endTimeMs: number | null;
}

export interface StableObservationSample extends ObservationInterval {
  sampleId: string;
  frameIds: string[];
  faces: ObservedFace[];
}

export interface ObservationEvent extends ObservationInterval {
  eventId: string;
  beforeSampleId: string;
  afterSampleId: string;
  reason: "visible-state-change";
  candidateOnly: true;
  actionCount: "unknown";
  changedCells: number;
}

export interface UnresolvedObservationGap extends ObservationInterval {
  reason: "missing-real-time" | "missing-geometric-observation" | "missing-frame-observations" | "coordinate-space-change" | "time-gap" | "identity-uncertain" | "insufficient-common-cells" | "unstable-observations" | "long-event-window";
}

export interface ObservationTimeline {
  sourceId: string | null;
  sourceHash: string | null;
  mode: GeometryMode;
  stableSamples: StableObservationSample[];
  events: ObservationEvent[];
  unresolvedGaps: UnresolvedObservationGap[];
  boundaryCoverageComplete: false;
  parameters: TimelineOptions;
  parametersCalibrated: false;
  limitations: string[];
}

export interface TimelineOptions {
  mode: GeometryMode;
  maxFrames: number;
  minStableFrames: number;
  minReadableCells: number;
  minCommonCells: number;
  minChangedCells: number;
  maxTrackGapMs: number;
  maxEventWindowMs: number;
  maxQuadCornerDistance: number;
  maxQuadScaleRatio: number;
}

export const DEFAULT_TIMELINE_OPTIONS: Readonly<TimelineOptions> = {
  mode: "automatic", maxFrames: 15_000, minStableFrames: 2, minReadableCells: 3,
  minCommonCells: 3, minChangedCells: 1, maxTrackGapMs: 80, maxEventWindowMs: 250,
  maxQuadCornerDistance: 0.35, maxQuadScaleRatio: 1.35,
};

function interval(first: GeometryFrame, last: GeometryFrame): ObservationInterval {
  return { startFrameId: first.frameId, endFrameId: last.frameId, startPtsSeconds: first.ptsSeconds,
    endPtsSeconds: last.ptsSeconds, startTimeMs: first.realTimeMs, endTimeMs: last.realTimeMs };
}

function readable(face: ObservedFace): number { return face.colors.filter((c) => c !== null).length; }
function assignmentKey(assignment: readonly number[]): string { return assignment.join(","); }
function sharedAssignments(a: ObservedFace, b: ObservedFace): number[][] {
  const allowed = new Set(a.assignments.map(assignmentKey));
  return b.assignments.filter((assignment) => allowed.has(assignmentKey(assignment)));
}
function distance(a: PointXY, b: PointXY): number { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function quadScale(face: ObservedFace): number {
  return (distance(face.quad[0], face.quad[1]) + distance(face.quad[1], face.quad[2]) + distance(face.quad[2], face.quad[3]) + distance(face.quad[3], face.quad[0])) / 4;
}
function geometryCompatible(a: ObservedFace, b: ObservedFace, options: TimelineOptions): boolean {
  if (a.trackHint && b.trackHint && a.trackHint !== b.trackHint) return false;
  if (sharedAssignments(a, b).length === 0) return false;
  const sa = quadScale(a), sb = quadScale(b);
  if (Math.min(sa, sb) <= 0 || Math.max(sa, sb) / Math.min(sa, sb) > options.maxQuadScaleRatio) return false;
  return a.quad.every((p, i) => distance(p, b.quad[i]) / Math.min(sa, sb) <= options.maxQuadCornerDistance);
}

/** Mutual unique matches only; hints never override current image geometry. */
function associate(previous: ObservedFace[], current: ObservedFace[], options: TimelineOptions): boolean {
  if (current.length !== previous.length) return false;
  const candidates = current.map((face) => previous.map((prior, i) => geometryCompatible(prior, face, options) ? i : -1).filter((i) => i >= 0));
  if (candidates.some((choices) => choices.length !== 1 || candidates.filter((other) => other.includes(choices[0])).length !== 1)) return false;
  for (let i = 0; i < current.length; i++) {
    const choices = candidates[i];
    current[i].trackId = previous[choices[0]].trackId;
  }
  return true;
}

function compareFaces(a: readonly ObservedFace[], b: readonly ObservedFace[]): { common: number; changed: number } {
  let common = 0, changed = 0;
  for (const current of b) {
    const prior = a.find((face) => face.trackId !== null && face.trackId === current.trackId);
    if (!prior) continue;
    for (let cell = 0; cell < 9; cell++) {
      if (prior.colors[cell] === null || current.colors[cell] === null) continue;
      common++;
      if (prior.colors[cell] !== current.colors[cell]) changed++;
    }
  }
  return { common, changed };
}

/** Independent pure transform; output intervals always retain PTS and real time. */
export function buildObservationTimeline(input: readonly GeometryFrame[], overrides: Partial<TimelineOptions> = {}): ObservationTimeline {
  if (!Array.isArray(input) || !overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new Error("Timeline input and options must be an array and an object.");
  const options = { ...DEFAULT_TIMELINE_OPTIONS, ...overrides };
  if (!["automatic", "diagnostic-manual"].includes(options.mode)) throw new Error("Unknown timeline mode.");
  for (const key of ["maxFrames", "minStableFrames", "minReadableCells", "minCommonCells", "minChangedCells"] as const) {
    if (!Number.isInteger(options[key]) || options[key] < 1) throw new Error(`Invalid timeline budget ${key}.`);
  }
  for (const key of ["maxTrackGapMs", "maxEventWindowMs", "maxQuadCornerDistance", "maxQuadScaleRatio"] as const) {
    if (!Number.isFinite(options[key]) || options[key] <= 0) throw new Error(`Invalid timeline threshold ${key}.`);
  }
  if (options.minStableFrames < 2 || options.minStableFrames > options.maxFrames || options.minReadableCells > 9
    || options.minCommonCells > 27 || options.minChangedCells > 27 || options.maxQuadScaleRatio < 1) throw new Error("Invalid stability/geometry thresholds.");
  if (input.length > options.maxFrames || options.maxFrames > 100_000) throw new Error("Timeline frame budget exceeded.");
  for (const frame of input) assertGeometryFrame(frame);
  const result: ObservationTimeline = { sourceId: input[0]?.sourceId ?? null, sourceHash: input[0]?.sourceHash ?? null,
    mode: options.mode, stableSamples: [], events: [], unresolvedGaps: [], boundaryCoverageComplete: false,
    parameters: options, parametersCalibrated: false, limitations: ["Visible-state changes propose intervals, not a complete action segmentation.", "Occluded moves, turns without stable frames, and multiple moves per interval remain unresolved.", "Real timestamps and geometry provenance must be verified by their upstream producers; numeric values and source labels are not proof.", "Thresholds and association rules have not been calibrated on target videos."] };
  let nextTrack = 0;
  const frames = input.map((frame) => ({ ...frame, faces: frame.faces.filter((face) => face.assignments.length > 0 && readable(face) >= options.minReadableCells).map((face) => ({ ...face, colors: [...face.colors], instanceIds: [...face.instanceIds], assignments: face.assignments.map((a) => [...a]), trackId: null as string | null })) }));
  const seenIds = new Set<string>();
  let lastKnownTimeMs: number | null = null;
  let run: GeometryFrame[] = [];
  let lastStable: StableObservationSample | null = null;
  let gapSinceStable = false;
  const addGap = (a: GeometryFrame, b: GeometryFrame, reason: UnresolvedObservationGap["reason"]) => {
    result.unresolvedGaps.push({ ...interval(a, b), reason });
    gapSinceStable = true;
  };
  const flush = (): void => {
    if (!run.length) return;
    if (run.length < options.minStableFrames) { addGap(run[0], run[run.length - 1], "unstable-observations"); run = []; return; }
    const first = run[0], last = run[run.length - 1];
    const faces: ObservedFace[] = [];
    for (const finalFace of last.faces) {
      const track = run.map((frame) => frame.faces.find((face) => face.trackId === finalFace.trackId));
      if (track.some((face) => !face)) continue;
      const colors: (ColorName | null)[] = finalFace.colors.map((color, cell) => color !== null && track.every((face) => face!.colors[cell] === color) ? color : null);
      if (colors.filter((c) => c !== null).length < options.minReadableCells) continue;
      faces.push({ ...finalFace, colors, instanceIds: finalFace.instanceIds.map((id, cell) => colors[cell] === null ? null : id),
        evidenceIds: [...new Set(track.flatMap((face) => face!.evidenceIds))],
        centerEvidence: colors[4] !== null && track.every((face) => face!.centerEvidence?.color === colors[4]) ? finalFace.centerEvidence : null });
    }
    if (!faces.length) { addGap(first, last, "insufficient-common-cells"); run = []; return; }
    const sample: StableObservationSample = { ...interval(first, last), sampleId: `stable-${result.stableSamples.length}`, frameIds: run.map((f) => f.frameId), faces };
    if (lastStable && !gapSinceStable) {
      const change = compareFaces(lastStable.faces, faces);
      const startTime = lastStable.endTimeMs, endTime = sample.startTimeMs;
      const eventInterval: ObservationInterval = { startFrameId: lastStable.endFrameId, endFrameId: sample.startFrameId,
        startPtsSeconds: lastStable.endPtsSeconds, endPtsSeconds: sample.startPtsSeconds, startTimeMs: startTime, endTimeMs: endTime };
      if (change.common < options.minCommonCells) result.unresolvedGaps.push({ ...eventInterval, reason: "insufficient-common-cells" });
      else if (change.changed >= options.minChangedCells) {
        if (startTime === null || endTime === null) result.unresolvedGaps.push({ ...eventInterval, reason: "missing-real-time" });
        else if (endTime - startTime > options.maxEventWindowMs) result.unresolvedGaps.push({ ...eventInterval, reason: "long-event-window" });
        else result.events.push({ ...eventInterval, eventId: `event-${result.events.length}`, beforeSampleId: lastStable.sampleId,
          afterSampleId: sample.sampleId, reason: "visible-state-change", candidateOnly: true, actionCount: "unknown", changedCells: change.changed });
      }
    }
    result.stableSamples.push(sample);
    lastStable = sample;
    gapSinceStable = false;
    run = [];
  };
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i], previous = frames[i - 1];
    if (frame.sourceId !== result.sourceId || frame.sourceHash !== result.sourceHash) throw new Error("A timeline cannot combine different source videos.");
    if (options.mode === "automatic" && frame.mode !== "automatic") throw new Error("Manual geometry cannot enter an automatic timeline.");
    if (seenIds.has(frame.frameId)) throw new Error("Duplicate frame id in timeline.");
    seenIds.add(frame.frameId);
    if (previous && (frame.ptsSeconds <= previous.ptsSeconds || BigInt(frame.sourcePts) <= BigInt(previous.sourcePts) || frame.frameIndex <= previous.frameIndex)) throw new Error("Frames must be in strictly increasing source order; do not silently sort duplicates.");
    if (frame.realTimeMs !== null) {
      if (lastKnownTimeMs !== null && frame.realTimeMs <= lastKnownTimeMs) throw new Error("Verified real times must be strictly increasing, including across unknown-time gaps.");
      lastKnownTimeMs = frame.realTimeMs;
    }
    const freshTracks = () => { for (const face of frame.faces) face.trackId = `track-${nextTrack++}`; };
    if (frame.realTimeMs === null) { flush(); addGap(previous ?? frame, frame, "missing-real-time"); freshTracks(); continue; }
    if (!frame.faces.length) { flush(); addGap(previous ?? frame, frame, "missing-geometric-observation"); continue; }
    if (!previous) { freshTracks(); run = [frame]; continue; }
    if (previous.realTimeMs === null || !previous.faces.length) {
      addGap(previous, frame, previous.realTimeMs === null ? "missing-real-time" : "missing-geometric-observation");
      freshTracks(); run = [frame]; continue;
    }
    if (frame.width !== previous.width || frame.height !== previous.height || frame.sourceCrop.some((value, index) => value !== previous.sourceCrop[index])) { flush(); addGap(previous, frame, "coordinate-space-change"); freshTracks(); run = [frame]; continue; }
    if (frame.frameIndex !== previous.frameIndex + 1) { flush(); addGap(previous, frame, "missing-frame-observations"); freshTracks(); run = [frame]; continue; }
    if (frame.realTimeMs - previous.realTimeMs > options.maxTrackGapMs) { flush(); addGap(previous, frame, "time-gap"); freshTracks(); run = [frame]; continue; }
    if (!associate(previous.faces, frame.faces, options)) { flush(); addGap(previous, frame, "identity-uncertain"); freshTracks(); run = [frame]; continue; }
    const change = compareFaces(previous.faces, frame.faces);
    if (change.common < options.minCommonCells) { flush(); addGap(previous, frame, "insufficient-common-cells"); freshTracks(); run = [frame]; continue; }
    // Only a retained association may narrow candidates. A reset above must not
    // carry an earlier face's constraints into the new track.
    for (const face of frame.faces) {
      const prior = previous.faces.find((candidate) => candidate.trackId === face.trackId)!;
      face.assignments = sharedAssignments(prior, face);
      face.assignmentStatus = face.assignments.length === 1 ? "geometric" : "ambiguous";
    }
    if (change.changed > 0) { flush(); run = [frame]; }
    else run.push(frame);
  }
  flush();
  return result;
}
