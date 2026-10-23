import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  alignMoveSequences,
  evaluateReconstruction,
  normalizeMoveToken,
  type PredictionDocument,
  type PredictionStatus,
  type ReferenceDocument,
} from "../src/evaluation.ts";

const reference = (moves: string[]): ReferenceDocument => ({ schemaVersion: 1, videos: [{ videoId: "a", moves }] });
const prediction = (moves: string[], status: PredictionStatus = "completed"): PredictionDocument => ({
  schemaVersion: 1,
  runs: [{ mode: { initialState: "known", boundaries: "automatic" }, predictions: [{ videoId: "a", status, moves }] }],
});

describe("trajectory evaluation", () => {
  it("reports substitutions, insertions and deletions as edit errors", () => {
    const { score, alignment } = alignMoveSequences(["R", "U", "F"], ["R", "B", "F", "L"]);
    expect(score).toEqual({ editDistance: 2, insertions: 1, deletions: 0, substitutions: 1, matches: 2, moveErrorRate: 2 / 3, score: 0.5, exact: false });
    expect(alignment.at(-1)).toEqual({ operation: "insertion", truthIndex: null, predictionIndex: 3 });
    expect(alignMoveSequences(["R", "U", "F"], ["R", "F"]).score).toMatchObject({ editDistance: 1, deletions: 1, matches: 2 });
    expect(alignMoveSequences(["R"], ["R", "U", "F"]).score).toMatchObject({ editDistance: 2, moveErrorRate: 2, score: 1 - 2 / 3 });
  });

  it("reports raw notation separately from safe spelling normalization", () => {
    const report = evaluateReconstruction(reference(["U2'", "Rw", "L2'x'", "UD'"]), prediction(["U2", "r", "L2x'", "UD'"]));
    const video = report.runs[0].videos[0];
    expect(video.raw).toMatchObject({ editDistance: 3, score: 0.25, exact: false });
    expect(video.normalized).toMatchObject({ editDistance: 0, score: 1, exact: true });
    expect(normalizeMoveToken("Bw2'")).toBe("b2");
  });

  it("does not erase cancellations, rotations or rewrite physical actions", () => {
    const canceled = evaluateReconstruction(reference(["R", "U", "U'"]), prediction(["R"])).runs[0].videos[0];
    expect(canceled.normalized).toMatchObject({ editDistance: 2, deletions: 2, exact: false });
    const rewritten = evaluateReconstruction(reference(["r"]), prediction(["x", "L"])).runs[0].videos[0];
    expect(rewritten.normalized).toMatchObject({ editDistance: 2, score: 0, exact: false });
    expect(alignMoveSequences(["UD'"], ["U", "D'"]).score.editDistance).toBe(2);
    expect(() => normalizeMoveToken("R U")).toThrow("Invalid move token");
    expect(() => normalizeMoveToken("R3")).toThrow("Invalid move token");
  });

  it.each(["failed", "abstained", "timeout"] as const)("gives %s output zero even when it carries correct partial moves", (status) => {
    const result = evaluateReconstruction(reference(["R", "U"]), prediction(["R", "U"], status)).runs[0];
    expect(result.videos[0].normalized).toMatchObject({ score: 0, exact: false, deletions: 2 });
    expect(result.videos[0].returnedPredictionLength).toBe(2);
    expect(result.summary.normalized.exactSolveRate).toBe(0);
  });

  it("keeps empty truth outside score denominators and makes missing videos failures", () => {
    const truth: ReferenceDocument = { schemaVersion: 1, videos: [{ videoId: "a", moves: ["R"] }, { videoId: "b", moves: [] }, { videoId: "c", moves: ["U"] }] };
    const result = evaluateReconstruction(truth, prediction(["R"])).runs[0];
    expect(result.summary).toMatchObject({ scoredVideoCount: 2, emptyReferenceVideoCount: 1, missingPredictions: 2, normalized: { macroScore: 0.5, exactSolveRate: 0.5 } });
    expect(result.videos[1].normalized).toMatchObject({ score: null, exact: null, moveErrorRate: null });
    expect(result.videos[2]).toMatchObject({ status: "failed", missingPrediction: true, normalized: { score: 0 } });
    expect(evaluateReconstruction(reference([]), prediction([])).runs[0].summary.normalized.macroScore).toBeNull();
  });

  it("weights videos equally and keeps all four input modes separate", () => {
    const truth: ReferenceDocument = { schemaVersion: 1, videos: [{ videoId: "a", moves: ["R"] }, { videoId: "b", moves: Array(9).fill("U") }] };
    const pred = prediction(["R"]);
    for (const initialState of ["known", "unknown"] as const) {
      for (const boundaries of ["manual", "automatic"] as const) {
        if (initialState === "known" && boundaries === "automatic") continue;
        pred.runs.push({ mode: { initialState, boundaries }, predictions: [] });
      }
    }
    const result = evaluateReconstruction(truth, pred);
    expect(result.runs).toHaveLength(4);
    expect(result.runs[0].summary.normalized.macroScore).toBe(0.5);
    expect(result.runs.slice(1).map((r) => r.summary.normalized.macroScore)).toEqual([0, 0, 0]);
    expect(result).not.toHaveProperty("summary");
  });

  it("rejects duplicated or unknown videos, duplicate modes and invalid output", () => {
    const pred = prediction(["R"]);
    pred.runs[0].predictions.push({ videoId: "a", status: "completed", moves: ["R"] });
    expect(() => evaluateReconstruction(reference(["R"]), pred)).toThrow("duplicate videoId");
    pred.runs[0].predictions[1].videoId = "unknown";
    expect(() => evaluateReconstruction(reference(["R"]), pred)).toThrow("unknown videoId");
    const modes = prediction(["R"]);
    modes.runs.push(modes.runs[0]);
    expect(() => evaluateReconstruction(reference(["R"]), modes)).toThrow("Duplicate evaluation mode");
    const missingMoves = prediction(["R"]);
    delete missingMoves.runs[0].predictions[0].moves;
    expect(() => evaluateReconstruction(reference(["R"]), missingMoves)).toThrow("must be an array");
  });
});

describe("completion timing", () => {
  it("uses interval distance and a 20 ms tolerance on correct aligned moves", () => {
    const truth = reference(["R", "U2'", "F", "D", "L"]);
    truth.videos[0].completionIntervalsMs = [[100, 120], [200, 200], [300, 320], [400, 420], null];
    const pred = prediction(["R", "U2", "F", "D", "L"]);
    pred.runs[0].predictions[0].completionTimesMs = [100, 220, 305, 400, 500];
    const timing = evaluateReconstruction(truth, pred).runs[0].videos[0].timing;
    expect(timing).toMatchObject({ eligibleTruthMoves: 4, truthCoverage: 0.8, withinToleranceMoves: 4, withinToleranceRate: 1, medianErrorMs: 0, p90ErrorMs: 20, passed: true });
  });

  it("does not remove missed/wrong moves from the timing denominator", () => {
    const truth = reference(["R", "U", "F", "D", "L"]);
    truth.videos[0].completionIntervalsMs = [[100, 100], [200, 200], [300, 300], [400, 400], [500, 500]];
    const pred = prediction(["R", "B", "F", "D"]);
    pred.runs[0].predictions[0].completionTimesMs = [100, 200, 300, 400];
    expect(evaluateReconstruction(truth, pred).runs[0].videos[0].timing).toMatchObject({ eligibleTruthMoves: 5, correctlyMatchedMoves: 3, withinToleranceRate: 0.6, passed: false });
  });

  it("fails insufficient annotation coverage, wide intervals and absent prediction times", () => {
    const truth = reference(["R", "U", "F", "D", "L"]);
    truth.videos[0].completionIntervalsMs = [[100, 120], [200, 200], [300, 320], [400, 421], null];
    const pred = prediction([...truth.videos[0].moves]);
    pred.runs[0].predictions[0].completionTimesMs = [100, 200, 300, 400, 500];
    expect(evaluateReconstruction(truth, pred).runs[0].videos[0].timing).toMatchObject({ truthCoverage: 0.6, wideIntervalMoves: 1, withinToleranceRate: 1, passed: false });
    delete pred.runs[0].predictions[0].completionTimesMs;
    expect(evaluateReconstruction(truth, pred).runs[0].videos[0].timing).toMatchObject({ timedMatches: 0, withinToleranceRate: 0, passed: false });
  });

  it("rejects invalid times and unaligned arrays instead of masking them", () => {
    const truth = reference(["R"]);
    truth.videos[0].completionIntervalsMs = [[120, 100]];
    expect(() => evaluateReconstruction(truth, prediction(["R"]))).toThrow("reversed");
    const pred = prediction(["R", "U"]);
    pred.runs[0].predictions[0].completionTimesMs = [200, 100];
    expect(() => evaluateReconstruction(reference(["R", "U"]), pred)).toThrow("chronological");
    pred.runs[0].predictions[0].completionTimesMs = [100];
    expect(() => evaluateReconstruction(reference(["R", "U"]), pred)).toThrow("count must equal");
  });
});

it("the separate JSON CLI scores saved output without changing predictions", () => {
  const dir = mkdtempSync(join(tmpdir(), "reconer-evaluation-"));
  try {
    const truthPath = join(dir, "truth.json"), predPath = join(dir, "prediction.json"), outPath = join(dir, "report.json");
    const saved = JSON.stringify(prediction(["U2"]));
    writeFileSync(truthPath, JSON.stringify(reference(["U2'"])));
    writeFileSync(predPath, saved);
    const root = resolve(import.meta.dirname, "..");
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/evaluate-reconstruction.ts", "--predictions", predPath, "--truth", truthPath, "--out", outPath], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(readFileSync(outPath, "utf8")).runs[0].summary).toMatchObject({ raw: { macroScore: 0 }, normalized: { macroScore: 1 } });
    const originalReport = readFileSync(outPath, "utf8");
    writeFileSync(truthPath, JSON.stringify(reference(["R"])));
    const args = ["--import", "tsx", "scripts/evaluate-reconstruction.ts", "--predictions", predPath, "--truth", truthPath, "--out", outPath];
    const preserved = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
    expect(preserved.status).toBe(1);
    expect(preserved.stderr).toContain("Report already exists");
    expect(readFileSync(outPath, "utf8")).toBe(originalReport);
    const overwritten = spawnSync(process.execPath, [...args, "--overwrite"], { cwd: root, encoding: "utf8" });
    expect(overwritten.status, overwritten.stderr).toBe(0);
    expect(JSON.parse(readFileSync(outPath, "utf8")).runs[0].summary.normalized.macroScore).toBe(0);
    expect(readFileSync(predPath, "utf8")).toBe(saved);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
