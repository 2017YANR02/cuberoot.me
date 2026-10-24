/** Answer-free bounded search over independently produced observations. No GT/legacy dump imports. */
import { anchoredBeamSearch, buildVocabulary, SearchBudgetExceeded, type Candidate } from "./anchored-search.ts";
import { tokenize } from "./cube-state.ts";
import { invertPerm, physicalPerm, seqCompose } from "./rotation-perms.ts";
import { CUBE_COLOR_TO_NAME } from "./reconstruct.ts";
import type { EvaluationMode, PredictionDocument, VideoPrediction } from "./evaluation.ts";
import type { GeometryFrame, GeometryMode, ObservedFace } from "./visible-geometry.ts";
import type { ObservationTimeline } from "./observation-timeline.ts";

export interface ManualObservationEvent {
  eventId: string;
  beforeFrameId: string;
  afterFrameId: string;
}
export interface ReconstructionRequest {
  schemaVersion: 1;
  videoId: string;
  sourceHash: string;
  geometryMode: GeometryMode;
  initialState: { kind: "independent-scramble"; notation: string } | { kind: "unknown" };
  terminalState: "observed-solved" | "unknown";
  boundaries: { mode: "automatic" } | {
    mode: "manual";
    provenance: "independent-boundary-annotation";
    coverageDeclaration: "all-actions-in-selected-interval";
    events: ManualObservationEvent[];
  };
  search?: Partial<SearchConfiguration>;
}
export interface SearchConfiguration {
  beamWidth: number;
  pathsPerState: number;
  alternativesLimit: number;
  maxExpandedNodes: number;
  maxElapsedMs: number;
  maxEvents: number;
  maxGeometryHypotheses: number;
  minReadableCells: number;
  minScoreGap: number;
  minMatchedFraction: number;
  hitScore: number;
  missScore: number;
}
export const DEFAULT_SEARCH_CONFIGURATION: Readonly<SearchConfiguration> = {
  beamWidth: 256, pathsPerState: 3, alternativesLimit: 5,
  maxExpandedNodes: 1_500_000, maxElapsedMs: 20_000, maxEvents: 120,
  maxGeometryHypotheses: 64, minReadableCells: 3,
  minScoreGap: 1.5, minMatchedFraction: 0.8, hitScore: 1, missScore: -2,
};
export interface ReconstructionResult {
  schemaVersion: 1;
  mode: EvaluationMode;
  conditions: { geometry: GeometryMode; initialState: ReconstructionRequest["initialState"]["kind"]; terminalState: ReconstructionRequest["terminalState"]; boundaryCoverageDeclaredComplete: boolean; boundaryCoverageVerified: false };
  status: VideoPrediction["status"];
  reasons: string[];
  qualityVerified: false;
  parametersCalibrated: false;
  searchConfiguration: SearchConfiguration;
  searchPlan: { candidateCount: number; expansionUpperBound: number; exceedsNodeBudget: boolean } | null;
  candidates: { moves: string[]; events: { eventId: string; move: string; beforeFrameId: string; afterFrameId: string }[]; score: number }[];
  scoreGap: number | null;
  visualSupport: { matchedCells: number; observedCells: number; fraction: number; minimumFrameFraction: number } | null;
  searchStats?: { expandedNodes: number; completedSegments: number; elapsedMs: number };
  predictionDocument: PredictionDocument;
  limitations: string[];
}
function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], name: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unexpected ${name}.${key}; inference accepts no answer data`);
}
function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value || value.trim() !== value) throw new Error(`${name} must be a nonempty trimmed string`);
  return value;
}
export function parseReconstructionRequest(value: unknown): ReconstructionRequest {
  const raw = object(value, "request");
  keys(raw, ["schemaVersion", "videoId", "sourceHash", "geometryMode", "initialState", "terminalState", "boundaries", "search"], "request");
  if (raw.schemaVersion !== 1) throw new Error("Unsupported request schema");
  const videoId = text(raw.videoId, "videoId"), sourceHash = text(raw.sourceHash, "sourceHash");
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) throw new Error("sourceHash must be the actual source SHA-256");
  if (raw.geometryMode !== "automatic" && raw.geometryMode !== "diagnostic-manual") throw new Error("Invalid geometryMode");
  if (raw.terminalState !== "observed-solved" && raw.terminalState !== "unknown") throw new Error("Invalid terminalState");
  const initial = object(raw.initialState, "initialState");
  keys(initial, ["kind", "notation"], "initialState");
  let initialState: ReconstructionRequest["initialState"];
  if (initial.kind === "unknown" && initial.notation === undefined) initialState = { kind: "unknown" };
  else if (initial.kind === "independent-scramble" && typeof initial.notation === "string") {
    if (initial.notation.length > 4096) throw new Error("Scramble exceeds the notation budget");
    const tokens = tokenize(initial.notation);
    if (tokens.length > 500) throw new Error("Scramble exceeds the token budget");
    if (tokens.join("") !== initial.notation.replace(/\s/g, "")) throw new Error("Scramble contains unsupported notation");
    physicalPerm(initial.notation);
    initialState = { kind: "independent-scramble", notation: initial.notation };
  } else throw new Error("initialState must contain an independently supplied scramble or be unknown");
  const boundary = object(raw.boundaries, "boundaries");
  keys(boundary, ["mode", "provenance", "coverageDeclaration", "events"], "boundaries");
  let boundaries: ReconstructionRequest["boundaries"];
  if (boundary.mode === "automatic" && boundary.events === undefined && boundary.provenance === undefined && boundary.coverageDeclaration === undefined) boundaries = { mode: "automatic" };
  else if (boundary.mode === "manual" && boundary.provenance === "independent-boundary-annotation" && boundary.coverageDeclaration === "all-actions-in-selected-interval" && Array.isArray(boundary.events)) {
    if (boundary.events.length > 500) throw new Error("Manual boundary list exceeds the event budget");
    const events = boundary.events.map((item, i) => {
      const event = object(item, `event ${i}`); keys(event, ["eventId", "beforeFrameId", "afterFrameId"], `event ${i}`);
      return { eventId: text(event.eventId, "eventId"), beforeFrameId: text(event.beforeFrameId, "beforeFrameId"), afterFrameId: text(event.afterFrameId, "afterFrameId") };
    });
    if (new Set(events.map(e => e.eventId)).size !== events.length) throw new Error("Duplicate event ids");
    boundaries = { mode: "manual", provenance: "independent-boundary-annotation", coverageDeclaration: "all-actions-in-selected-interval", events };
  } else throw new Error("Manual boundaries must be declared; automatic requests cannot accept a hidden step list");
  const search = raw.search === undefined ? undefined : object(raw.search, "search");
  if (search) keys(search, Object.keys(DEFAULT_SEARCH_CONFIGURATION), "search");
  const request: ReconstructionRequest = { schemaVersion: 1, videoId, sourceHash, geometryMode: raw.geometryMode, initialState, terminalState: raw.terminalState, boundaries, search: search as Partial<SearchConfiguration> | undefined };
  searchConfiguration(request.search);
  return request;
}
function searchConfiguration(overrides?: Partial<SearchConfiguration>): SearchConfiguration {
  const config = { ...DEFAULT_SEARCH_CONFIGURATION, ...overrides };
  for (const key of ["beamWidth", "pathsPerState", "alternativesLimit", "maxExpandedNodes", "maxElapsedMs", "maxEvents", "maxGeometryHypotheses", "minReadableCells"] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`Invalid search.${key}`);
  }
  if (config.beamWidth > 2048 || config.pathsPerState > 8 || config.alternativesLimit < 2 || config.alternativesLimit > 16
    || config.maxExpandedNodes > 2_000_000 || config.maxElapsedMs > 60_000 || config.maxEvents > 500
    || config.maxGeometryHypotheses > 256 || config.minReadableCells > 27) throw new Error("Search exceeds supported bounded configuration");
  if (!Number.isFinite(config.minScoreGap) || config.minScoreGap <= 0 || !Number.isFinite(config.hitScore)
    || !Number.isFinite(config.missScore) || config.hitScore <= config.missScore
    || !Number.isFinite(config.minMatchedFraction) || config.minMatchedFraction <= 0 || config.minMatchedFraction > 1) throw new Error("Invalid uncalibrated scoring parameters");
  return config;
}

/** Existing vocabulary plus missing B and explicit rotation events; no answer-driven candidate injection. */
function inferenceVocabulary(): Candidate[] {
  const candidates = new Map(buildVocabulary().map(candidate => [candidate.token, { ...candidate, face: candidate.face === null ? null : "event" }]));
  for (const base of ["B", "b", "x", "y", "z"]) for (const suffix of ["", "2", "'"]) {
    const token = base + suffix, perm = physicalPerm(token);
    candidates.set(token, { token, face: "event", prior: 1, perm, invPerm: invertPerm(perm) });
  }
  return [...candidates.values()];
}
type CellEvidence = { idx: number; color: string };
function compileFrame(faces: readonly ObservedFace[], config: SearchConfiguration): CellEvidence[][] | null {
  const usable = faces.filter(face => face.assignments.length && face.colors.some(c => c !== null));
  // Local B-window pullbacks do not establish a joint continuous pose. Do not
  // freely combine ambiguous mappings from multiple visible faces.
  if (usable.length > 1 && usable.some(face => face.assignments.length !== 1)) return null;
  const spatialFaces = usable.map(face => Math.floor(face.assignments[0][4] / 9));
  const opposite = [3, 4, 5, 0, 1, 2];
  if (new Set(spatialFaces).size !== spatialFaces.length || spatialFaces.some(face => spatialFaces.includes(opposite[face]))) return null;
  let combinations: CellEvidence[][] = [[]];
  for (const face of usable) {
    const next: CellEvidence[][] = [];
    for (const existing of combinations) for (const assignment of face.assignments) {
      const cells = face.colors.flatMap((color, i) => color === null ? [] : [{ idx: assignment[i], color }]);
      const occupied = new Set(existing.map(c => c.idx));
      if (cells.some(c => occupied.has(c.idx))) continue;
      next.push([...existing, ...cells]);
      if (next.length > config.maxGeometryHypotheses) return null;
    }
    combinations = next;
    if (!combinations.length) return null;
  }
  return combinations.length && combinations.every(cells => cells.length >= config.minReadableCells) ? combinations : null;
}
function evidenceScore(state: readonly number[], hypotheses: readonly CellEvidence[][], config: SearchConfiguration): number {
  // Normalize over a fixed set of observed cells and supplied geometric hypotheses.
  // These are bounded evidence scores, not calibrated model probabilities.
  const scores = hypotheses.map(cells => cells.reduce((score, cell) => score + (CUBE_COLOR_TO_NAME[Math.floor(state[cell.idx] / 9)] === cell.color ? config.hitScore : config.missScore), 0) / cells.length);
  const maximum = Math.max(...scores);
  return maximum + Math.log(scores.reduce((sum, score) => sum + Math.exp(score - maximum), 0) / scores.length);
}

export function reconstructObservations(request: ReconstructionRequest, frames: readonly GeometryFrame[], timeline: ObservationTimeline): ReconstructionResult {
  const config = searchConfiguration(request.search);
  const mode: EvaluationMode = { initialState: request.initialState.kind === "unknown" ? "unknown" : "known", boundaries: request.boundaries.mode,
    geometry: request.geometryMode === "automatic" ? "automatic" : "manual" };
  const result: ReconstructionResult = {
    schemaVersion: 1, mode, conditions: { geometry: request.geometryMode, initialState: request.initialState.kind, terminalState: request.terminalState, boundaryCoverageDeclaredComplete: false, boundaryCoverageVerified: false },
    status: "abstained", reasons: [], qualityVerified: false, parametersCalibrated: false, searchConfiguration: config,
    candidates: [], scoreGap: null, visualSupport: null, searchPlan: null,
    predictionDocument: { schemaVersion: 1, runs: [{ mode, predictions: [{ videoId: request.videoId, status: "abstained" }] }] },
    limitations: ["No trained or calibrated quality claim is implied by a physically anchored path.", "Surviving beam alternatives are incomplete; a margin is not a correctness probability.", "Automatic event proposals have unknown action count and cannot yet drive a complete trajectory.", "This entry accepts a known standard-color scramble followed by a physical hold rotation and an observed solved terminal state; unknown-state inference remains unsupported.", "Only configured event vocabulary is searched; hidden canceling moves and other missing vocabulary remain unresolved.", "Completion timestamps are not inferred from manual interval endpoints.", "Unique multi-face mappings are supplied evidence, not proof of a consistent continuous camera pose."],
  };
  const abstain = (reason: string) => { result.reasons.push(reason); return result; };
  if (!frames.length) return abstain("no-observations");
  if (frames.some(frame => frame.sourceId !== request.videoId || frame.sourceHash !== request.sourceHash || frame.mode !== request.geometryMode)) throw new Error("Request/source/geometry mode does not match observations");
  if (timeline.sourceId !== request.videoId || timeline.sourceHash !== request.sourceHash || timeline.mode !== request.geometryMode) throw new Error("Timeline provenance mismatch");
  if (request.initialState.kind === "unknown") return abstain("unknown-initial-state-not-implemented");
  if (request.terminalState !== "observed-solved") return abstain("terminal-state-not-confirmed");
  if (request.boundaries.mode === "automatic") return abstain("automatic-boundary-coverage-unresolved");
  const events = request.boundaries.events;
  if (!events.length || events.length > config.maxEvents) return abstain("event-count-empty-or-over-budget");
  const frameMap = new Map(frames.map(frame => [frame.frameId, frame]));
  if (frameMap.size !== frames.length) throw new Error("Duplicate input frames");
  const endpointScores = new Map<string, CellEvidence[][]>();
  let previousAfter = -Infinity;
  for (const event of events) {
    const before = frameMap.get(event.beforeFrameId), after = frameMap.get(event.afterFrameId);
    if (!before || !after || before.frameIndex >= after.frameIndex || before.frameIndex < previousAfter) throw new Error("Manual event frames must exist and be ordered without overlapping action windows");
    if (before.realTimeMs === null || after.realTimeMs === null) return abstain("real-time-mapping-unverified");
    for (const frame of [before, after]) {
      if (endpointScores.has(frame.frameId)) continue;
      const evidence = compileFrame(frame.faces, config);
      if (!evidence) return abstain(`insufficient-or-over-budget-geometry:${frame.frameId}`);
      endpointScores.set(frame.frameId, evidence);
    }
    previousAfter = after.frameIndex;
  }
  // The requested initial/terminal states must describe the entire selected observation interval.
  if (events[0].beforeFrameId !== frames[0].frameId || events[events.length - 1].afterFrameId !== frames[frames.length - 1].frameId) return abstain("manual-events-do-not-cover-selected-interval");
  result.conditions.boundaryCoverageDeclaredComplete = true;
  const beforeIds = new Set(events.map(event => event.beforeFrameId));
  const finalId = events[events.length - 1].afterFrameId;
  const score = (frameId: string, state: readonly number[]) => evidenceScore(state, endpointScores.get(frameId)!, config);
  const vocabulary = inferenceVocabulary();
  const expansionUpperBound = vocabulary.length * (24 + Math.max(0, events.length - 1) * config.beamWidth);
  result.searchPlan = { candidateCount: vocabulary.length, expansionUpperBound, exceedsNodeBudget: expansionUpperBound > config.maxExpandedNodes };
  try {
    const decoded = anchoredBeamSearch(events.map(() => ({ event: 1 })), physicalPerm(request.initialState.notation), {
      vocabulary, beamWidth: config.beamWidth, pathsPerState: config.pathsPerState,
      alternativesLimit: config.alternativesLimit, maxExpandedNodes: config.maxExpandedNodes, maxElapsedMs: config.maxElapsedMs,
      maxRotInserts: 0, // Rotations consume explicit events; never invent untimed insertions.
      initialOrientation: "physical-hold",
      scoreSegment: (index, start, end) => {
        const event = events[index];
        return score(event.beforeFrameId, start) + (event.afterFrameId === finalId || beforeIds.has(event.afterFrameId) ? 0 : score(event.afterFrameId, end));
      },
      scoreFinal: state => score(finalId, state),
    });
    result.searchStats = decoded.searchStats;
    if (!decoded.anchored) return abstain("no-physically-anchored-path-in-budget");
    result.candidates = (decoded.alternatives ?? []).map(path => ({ moves: path.movesFlat, score: path.score,
      events: events.map((event, i) => ({ ...event, move: path.segTokens[i] })) }));
    if (!result.candidates.length) return abstain("no-trajectory-candidates");
    const top = decoded.alternatives![0];
    if (top.segTokens.some(token => token === "")) return abstain("unresolved-empty-action-event");
    let state: readonly number[] = top.terminalState;
    const supports = new Map<string, { matched: number; total: number }>();
    const observe = (frameId: string) => {
      if (supports.has(frameId)) return;
      const choices = endpointScores.get(frameId)!.map(cells => ({
        matched: cells.filter(cell => CUBE_COLOR_TO_NAME[Math.floor(state[cell.idx] / 9)] === cell.color).length, total: cells.length,
      })).sort((a, b) => b.matched / b.total - a.matched / a.total);
      supports.set(frameId, choices[0]);
    };
    for (let index = events.length - 1; index >= 0; index--) {
      observe(events[index].afterFrameId);
      state = seqCompose(state, invertPerm(physicalPerm(top.segTokens[index])));
      observe(events[index].beforeFrameId);
    }
    const matchedCells = [...supports.values()].reduce((sum, value) => sum + value.matched, 0);
    const observedCells = [...supports.values()].reduce((sum, value) => sum + value.total, 0);
    result.visualSupport = { matchedCells, observedCells, fraction: matchedCells / observedCells,
      minimumFrameFraction: Math.min(...[...supports.values()].map(value => value.matched / value.total)) };
    if (result.visualSupport.minimumFrameFraction < config.minMatchedFraction) return abstain("insufficient-observed-color-support");
    result.scoreGap = result.candidates.length > 1 ? result.candidates[0].score - result.candidates[1].score : null;
    if (result.scoreGap !== null && result.scoreGap < config.minScoreGap) return abstain("ambiguous-surviving-trajectories");
    if (result.candidates.length === 1) return abstain("single-survivor-does-not-establish-trajectory-confidence");
    result.status = "completed";
    result.predictionDocument.runs[0].predictions[0] = { videoId: request.videoId, status: "completed", moves: result.candidates[0].moves };
    return result;
  } catch (error) {
    if (!(error instanceof SearchBudgetExceeded)) throw error;
    result.status = "timeout";
    result.reasons.push(error.reason);
    result.searchStats = error.stats;
    result.predictionDocument.runs[0].predictions[0] = { videoId: request.videoId, status: "timeout" };
    return result;
  }
}
