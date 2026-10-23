/** Score saved predictions after inference exits. No decoder or dataset GT helpers are imported. */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { evaluateReconstruction } from "../src/evaluation.ts";

const HELP = `Usage: pnpm exec tsx scripts/evaluate-reconstruction.ts --predictions predictions.json --truth truth.json [--out report.json] [--overwrite]

Inference must finish and save its output before this separate evaluator reads truth.
Every declared mode is scored against every truth video. Missing predictions,
failed, abstained and timeout results receive zero; empty truth is reported separately.
Raw spelling and spelling-normalized scores are both reported, with no mode pooling.
Sequence score = 1 - editDistance / max(predictionLength, referenceLength).
An existing report is preserved unless --overwrite is explicitly supplied.
Times are original-video milliseconds; 50 fps timing policy uses 20 ms intervals/tolerance.
One move string is one annotated event. Bundles such as UD' retain their boundaries.

truth.json:
{"schemaVersion":1,"videos":[{"videoId":"solve-1","moves":["R","U2'"],"completionIntervalsMs":[[100,110],[200,220]]}]}

predictions.json:
{"schemaVersion":1,"runs":[{"mode":{"initialState":"known","boundaries":"automatic"},"predictions":[{"videoId":"solve-1","status":"completed","moves":["R","U2"],"completionTimesMs":[105,210]}]}]}

Modes: initialState=known|unknown; boundaries=manual|automatic.
Statuses: completed|failed|abstained|timeout. completed requires moves (possibly []).
Optional times must align one-to-one with moves. Unreadable truth intervals are null.
See exported document/report types in src/evaluation.ts.
`;

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  const flags = new Map<string, string>();
  let overwrite = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--overwrite") {
      if (overwrite) throw new Error("Repeated --overwrite argument");
      overwrite = true;
      continue;
    }
    const value = args[++i];
    if (!["--truth", "--predictions", "--out"].includes(key) || !value || value.startsWith("--") || flags.has(key)) {
      throw new Error(`Invalid or repeated argument ${key}; use --help`);
    }
    flags.set(key, value);
  }
  const predictionPath = flags.get("--predictions"), truthPath = flags.get("--truth");
  if (!predictionPath || !truthPath) throw new Error("--predictions and --truth are required; use --help");
  const predictionFile = realpathSync(predictionPath), truthFile = realpathSync(truthPath);
  if (predictionFile === truthFile) throw new Error("Predictions and truth must be separate files");
  const out = flags.get("--out");
  if (overwrite && !out) throw new Error("--overwrite requires --out");
  if (out) {
    const outputFile = existsSync(out) ? realpathSync(out) : resolve(out);
    if (outputFile === predictionFile || outputFile === truthFile) throw new Error("Report output must not overwrite predictions or truth");
    if (existsSync(out) && !overwrite) throw new Error("Report already exists; choose a new --out path or explicitly pass --overwrite");
  }
  const predictions: unknown = JSON.parse(readFileSync(predictionFile, "utf8"));
  const truth: unknown = JSON.parse(readFileSync(truthFile, "utf8"));
  const report = `${JSON.stringify(evaluateReconstruction(truth, predictions), null, 2)}\n`;
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, report, { flag: overwrite ? "w" : "wx" });
  } else {
    process.stdout.write(report);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
