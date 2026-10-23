/** Post-hoc trajectory scoring. This module never imports or runs inference. */
export type InitialStateMode = "known" | "unknown";
export type BoundaryMode = "manual" | "automatic";
export type PredictionStatus = "completed" | "failed" | "abstained" | "timeout";

export interface EvaluationMode {
  initialState: InitialStateMode;
  boundaries: BoundaryMode;
}

export interface ReferenceVideo {
  videoId: string;
  moves: string[];
  /** Turn completion time, in original-video milliseconds; null means unreadable. */
  completionIntervalsMs?: ([number, number] | null)[];
}

export interface ReferenceDocument {
  schemaVersion: 1;
  videos: ReferenceVideo[];
}

export interface VideoPrediction {
  videoId: string;
  status: PredictionStatus;
  /** Required for completed predictions. Failed partial output receives no credit. */
  moves?: string[];
  completionTimesMs?: number[];
}

export interface PredictionRun {
  mode: EvaluationMode;
  /** Every reference video is expected. Missing entries are failures, not exclusions. */
  predictions: VideoPrediction[];
}

export interface PredictionDocument {
  schemaVersion: 1;
  runs: PredictionRun[];
}

export interface AlignmentStep {
  operation: "match" | "substitution" | "insertion" | "deletion";
  truthIndex: number | null;
  predictionIndex: number | null;
}

export interface SequenceScore {
  editDistance: number;
  insertions: number;
  deletions: number;
  substitutions: number;
  matches: number;
  /** Unclamped (insertions can make this greater than one). Null for empty truth. */
  moveErrorRate: number | null;
  /** 1 - editDistance / max(truthLength, predictionLength); null for empty truth. */
  score: number | null;
  exact: boolean | null;
}

export interface TimingScore {
  targetFrameMs: 20;
  totalTruthMoves: number;
  annotatedTruthMoves: number;
  eligibleTruthMoves: number;
  wideIntervalMoves: number;
  truthCoverage: number | null;
  correctlyMatchedMoves: number;
  timedMatches: number;
  withinToleranceMoves: number;
  /** Denominator includes every eligible truth move, including missed/wrong moves. */
  withinToleranceRate: number | null;
  /** Error summaries concern timed, correctly matched moves only. */
  medianErrorMs: number | null;
  p90ErrorMs: number | null;
  passed: boolean;
}

export interface VideoEvaluation {
  videoId: string;
  status: PredictionStatus;
  missingPrediction: boolean;
  emptyReference: boolean;
  referenceLength: number;
  returnedPredictionLength: number;
  raw: SequenceScore;
  normalized: SequenceScore;
  timing: TimingScore;
}

export interface SequenceSummary {
  macroScore: number | null;
  exactSolves: number;
  exactSolveRate: number | null;
  insertions: number;
  deletions: number;
  substitutions: number;
}

export interface RunEvaluation {
  mode: EvaluationMode;
  videos: VideoEvaluation[];
  summary: {
    videoCount: number;
    scoredVideoCount: number;
    emptyReferenceVideoCount: number;
    statusCounts: Record<PredictionStatus, number>;
    missingPredictions: number;
    raw: SequenceSummary;
    normalized: SequenceSummary;
    timing: { passedVideos: number; passRate: number | null; meanTruthCoverage: number | null };
  };
}

export interface EvaluationReport {
  schemaVersion: 1;
  policy: {
    sequenceUnit: "input-token";
    normalization: "spelling-only";
    score: "1 - editDistance / max(referenceLength, predictionLength)";
    failedPredictionScore: 0;
    emptyReference: "excluded-and-reported";
    targetFrameMs: 20;
    minimumTimingCoverage: 0.8;
    minimumTimingMatchRate: 0.9;
    timingAlignment: "spelling-normalized-levenshtein";
  };
  /** Modes deliberately have no combined accuracy. */
  runs: RunEvaluation[];
}

/**
 * Keep event boundaries and physical actions intact. In particular, do not cancel
 * U U', expand wide moves, reorder commuting moves, or remove whole-cube rotations.
 * Existing annotations may bundle simultaneous moves (UD', L2'x') into one token;
 * normalize spellings within that token without splitting or merging its event.
 */
export function normalizeMoveToken(token: string): string {
  if (typeof token !== "string" || !token || /\s/.test(token)) {
    throw new Error(`Invalid move token: ${JSON.stringify(token)}`);
  }
  const parts = token.match(/(?:[URFDLB]w?|[urfdlbMESxyz])(?:2'?|')?/g);
  if (!parts || parts.join("") !== token) {
    throw new Error(`Invalid move token: ${JSON.stringify(token)}`);
  }
  return parts.map((part) => part.replace(/^([URFDLB])w/, (_, face: string) => face.toLowerCase())
    .replace(/2'$/, "2")).join("");
}

/** Unit-cost Levenshtein alignment; ties prefer diagonal, then deletion, then insertion. */
export function alignMoveSequences(truth: readonly string[], prediction: readonly string[]): {
  score: SequenceScore;
  alignment: AlignmentStep[];
} {
  const width = prediction.length + 1;
  const cells = (truth.length + 1) * width;
  // Bound evaluator memory independently of malformed or unexpectedly long input.
  if (!Number.isSafeInteger(cells) || cells > 4_000_000) {
    throw new Error("Sequence alignment exceeds 4,000,000 cells; evaluate shorter trajectories separately");
  }
  const dp = new Uint32Array(cells);
  for (let i = 0; i <= truth.length; i++) dp[i * width] = i;
  for (let j = 0; j <= prediction.length; j++) dp[j] = j;
  for (let i = 1; i <= truth.length; i++) {
    for (let j = 1; j <= prediction.length; j++) {
      dp[i * width + j] = Math.min(
        dp[(i - 1) * width + j - 1] + (truth[i - 1] === prediction[j - 1] ? 0 : 1),
        dp[(i - 1) * width + j] + 1,
        dp[i * width + j - 1] + 1,
      );
    }
  }
  const alignment: AlignmentStep[] = [];
  let i = truth.length, j = prediction.length;
  while (i || j) {
    const current = dp[i * width + j];
    if (i && j && current === dp[(i - 1) * width + j - 1] + (truth[i - 1] === prediction[j - 1] ? 0 : 1)) {
      alignment.push({ operation: truth[i - 1] === prediction[j - 1] ? "match" : "substitution", truthIndex: --i, predictionIndex: --j });
    } else if (i && current === dp[(i - 1) * width + j] + 1) {
      alignment.push({ operation: "deletion", truthIndex: --i, predictionIndex: null });
    } else {
      alignment.push({ operation: "insertion", truthIndex: null, predictionIndex: --j });
    }
  }
  alignment.reverse();
  const count = (operation: AlignmentStep["operation"]) => alignment.filter((s) => s.operation === operation).length;
  const distance = dp[cells - 1];
  return {
    score: {
      editDistance: distance,
      insertions: count("insertion"),
      deletions: count("deletion"),
      substitutions: count("substitution"),
      matches: count("match"),
      moveErrorRate: truth.length ? distance / truth.length : null,
      score: truth.length ? 1 - distance / Math.max(truth.length, prediction.length) : null,
      exact: truth.length ? distance === 0 : null,
    },
    alignment,
  };
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function videoId(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name}.videoId must be nonempty`);
  return value;
}

function moveList(value: unknown, name: string): string[] {
  return array(value, name).map((token) => {
    if (typeof token !== "string") throw new Error(`${name} must contain move strings`);
    normalizeMoveToken(token); // Reject unsupported notation instead of silently dropping it.
    return token;
  });
}

function time(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite, nonnegative number`);
  return value;
}

function uniqueIds<T extends { videoId: string }>(videos: T[], name: string): void {
  if (new Set(videos.map((v) => v.videoId)).size !== videos.length) throw new Error(`${name} contains duplicate videoId values`);
}

export function parseReferenceDocument(value: unknown): ReferenceDocument {
  const doc = record(value, "truth");
  if (doc.schemaVersion !== 1) throw new Error("truth.schemaVersion must be 1");
  const videos = array(doc.videos, "truth.videos").map((entry, index): ReferenceVideo => {
    const name = `truth.videos[${index}]`, row = record(entry, name);
    const moves = moveList(row.moves, `${name}.moves`);
    const result: ReferenceVideo = { videoId: videoId(row.videoId, name), moves };
    if (row.completionIntervalsMs !== undefined) {
      result.completionIntervalsMs = array(row.completionIntervalsMs, `${name}.completionIntervalsMs`).map((interval, i) => {
        if (interval === null) return null;
        const pair = array(interval, `${name}.completionIntervalsMs[${i}]`);
        if (pair.length !== 2) throw new Error(`${name} completion intervals must have two endpoints`);
        const start = time(pair[0], name), end = time(pair[1], name);
        if (end < start) throw new Error(`${name} has a reversed completion interval`);
        return [start, end];
      });
      if (result.completionIntervalsMs.length !== moves.length) throw new Error(`${name} completion interval count must equal move count`);
    }
    return result;
  });
  uniqueIds(videos, "truth.videos");
  if (!videos.length) throw new Error("truth.videos must contain at least one video");
  return { schemaVersion: 1, videos };
}

export function parsePredictionDocument(value: unknown): PredictionDocument {
  const doc = record(value, "predictions");
  if (doc.schemaVersion !== 1) throw new Error("predictions.schemaVersion must be 1");
  const runs = array(doc.runs, "predictions.runs").map((entry, index): PredictionRun => {
    const name = `predictions.runs[${index}]`, run = record(entry, name);
    const mode = record(run.mode, `${name}.mode`);
    if (mode.initialState !== "known" && mode.initialState !== "unknown") throw new Error(`${name}.mode.initialState must be known or unknown`);
    if (mode.boundaries !== "manual" && mode.boundaries !== "automatic") throw new Error(`${name}.mode.boundaries must be manual or automatic`);
    const predictions = array(run.predictions, `${name}.predictions`).map((entry, index): VideoPrediction => {
      const rowName = `${name}.predictions[${index}]`, row = record(entry, rowName);
      if (row.status !== "completed" && row.status !== "failed" && row.status !== "abstained" && row.status !== "timeout") {
        throw new Error(`${rowName}.status must be completed, failed, abstained, or timeout`);
      }
      const result: VideoPrediction = { videoId: videoId(row.videoId, rowName), status: row.status };
      if (row.moves !== undefined || row.status === "completed") result.moves = moveList(row.moves, `${rowName}.moves`);
      if (row.completionTimesMs !== undefined) {
        result.completionTimesMs = array(row.completionTimesMs, `${rowName}.completionTimesMs`).map((value) => time(value, rowName));
        if (result.completionTimesMs.length !== (result.moves?.length ?? 0)) throw new Error(`${rowName} completion time count must equal move count`);
        if (result.completionTimesMs.some((t, i, times) => i > 0 && t < times[i - 1])) throw new Error(`${rowName} completion times must be chronological`);
      }
      return result;
    });
    uniqueIds(predictions, name);
    return { mode: { initialState: mode.initialState, boundaries: mode.boundaries }, predictions };
  });
  if (!runs.length) throw new Error("predictions.runs must contain at least one run");
  const modeKeys = runs.map((r) => `${r.mode.initialState}/${r.mode.boundaries}`);
  if (new Set(modeKeys).size !== modeKeys.length) throw new Error("Duplicate evaluation mode; compare different models in separate reports");
  return { schemaVersion: 1, runs };
}

function scoreTiming(truth: ReferenceVideo, prediction: VideoPrediction, alignment: AlignmentStep[]): TimingScore {
  const intervals = truth.completionIntervalsMs ?? truth.moves.map(() => null);
  const eligible = intervals.map((interval) => interval !== null && interval[1] - interval[0] <= 20 + 1e-9);
  const eligibleCount = eligible.filter(Boolean).length;
  const annotated = intervals.filter((x) => x !== null).length;
  let matched = 0, within = 0;
  const errors: number[] = [];
  for (const step of alignment) {
    if (step.operation !== "match" || step.truthIndex === null || step.predictionIndex === null || !eligible[step.truthIndex]) continue;
    matched++;
    const predictedTime = prediction.completionTimesMs?.[step.predictionIndex];
    if (predictedTime === undefined) continue;
    const [start, end] = intervals[step.truthIndex]!;
    const error = Math.max(start - predictedTime, predictedTime - end, 0);
    errors.push(error);
    if (error <= 20 + 1e-9) within++;
  }
  errors.sort((a, b) => a - b);
  const middle = Math.floor(errors.length / 2);
  const coverage = truth.moves.length ? eligibleCount / truth.moves.length : null;
  const rate = eligibleCount ? within / eligibleCount : null;
  return {
    targetFrameMs: 20,
    totalTruthMoves: truth.moves.length,
    annotatedTruthMoves: annotated,
    eligibleTruthMoves: eligibleCount,
    wideIntervalMoves: annotated - eligibleCount,
    truthCoverage: coverage,
    correctlyMatchedMoves: matched,
    timedMatches: errors.length,
    withinToleranceMoves: within,
    withinToleranceRate: rate,
    medianErrorMs: errors.length ? (errors.length % 2 ? errors[middle] : (errors[middle - 1] + errors[middle]) / 2) : null,
    p90ErrorMs: errors.length ? errors[Math.ceil(errors.length * 0.9) - 1] : null,
    passed: prediction.status === "completed" && coverage !== null && coverage >= 0.8 && rate !== null && rate >= 0.9,
  };
}

function sequenceSummary(videos: VideoEvaluation[], metric: "raw" | "normalized"): SequenceSummary {
  const scored = videos.filter((v) => !v.emptyReference);
  const exact = scored.filter((v) => v[metric].exact).length;
  return {
    macroScore: scored.length ? scored.reduce((sum, v) => sum + v[metric].score!, 0) / scored.length : null,
    exactSolves: exact,
    exactSolveRate: scored.length ? exact / scored.length : null,
    insertions: scored.reduce((sum, v) => sum + v[metric].insertions, 0),
    deletions: scored.reduce((sum, v) => sum + v[metric].deletions, 0),
    substitutions: scored.reduce((sum, v) => sum + v[metric].substitutions, 0),
  };
}

/** Only completed output is scored; all other statuses are scored as no predicted moves. */
export function evaluateReconstruction(truthValue: unknown, predictionValue: unknown): EvaluationReport {
  const truth = parseReferenceDocument(truthValue);
  const prediction = parsePredictionDocument(predictionValue);
  const ids = new Set(truth.videos.map((v) => v.videoId));
  const runs = prediction.runs.map((run): RunEvaluation => {
    for (const row of run.predictions) if (!ids.has(row.videoId)) throw new Error(`Prediction for unknown videoId: ${row.videoId}`);
    const predictions = new Map(run.predictions.map((v) => [v.videoId, v]));
    const videos = truth.videos.map((reference): VideoEvaluation => {
      const supplied = predictions.get(reference.videoId);
      const row = supplied ?? { videoId: reference.videoId, status: "failed" as const };
      const moves = row.status === "completed" ? row.moves! : [];
      const raw = alignMoveSequences(reference.moves, moves);
      const normalized = alignMoveSequences(reference.moves.map(normalizeMoveToken), moves.map(normalizeMoveToken));
      return {
        videoId: reference.videoId,
        status: row.status,
        missingPrediction: supplied === undefined,
        emptyReference: reference.moves.length === 0,
        referenceLength: reference.moves.length,
        returnedPredictionLength: row.moves?.length ?? 0,
        raw: raw.score,
        normalized: normalized.score,
        timing: scoreTiming(reference, row, normalized.alignment),
      };
    });
    const statusCounts: Record<PredictionStatus, number> = { completed: 0, failed: 0, abstained: 0, timeout: 0 };
    for (const video of videos) statusCounts[video.status]++;
    const scored = videos.filter((v) => !v.emptyReference);
    const timingPassed = scored.filter((v) => v.timing.passed).length;
    return {
      mode: run.mode,
      videos,
      summary: {
        videoCount: videos.length,
        scoredVideoCount: scored.length,
        emptyReferenceVideoCount: videos.length - scored.length,
        statusCounts,
        missingPredictions: videos.filter((v) => v.missingPrediction).length,
        raw: sequenceSummary(videos, "raw"),
        normalized: sequenceSummary(videos, "normalized"),
        timing: {
          passedVideos: timingPassed,
          passRate: scored.length ? timingPassed / scored.length : null,
          meanTruthCoverage: scored.length ? scored.reduce((sum, v) => sum + v.timing.truthCoverage!, 0) / scored.length : null,
        },
      },
    };
  });
  return {
    schemaVersion: 1,
    policy: {
      sequenceUnit: "input-token",
      normalization: "spelling-only",
      score: "1 - editDistance / max(referenceLength, predictionLength)",
      failedPredictionScore: 0,
      emptyReference: "excluded-and-reported",
      targetFrameMs: 20,
      minimumTimingCoverage: 0.8,
      minimumTimingMatchRate: 0.9,
      timingAlignment: "spelling-normalized-levenshtein",
    },
    runs,
  };
}
