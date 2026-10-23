/** Read-only readiness report. No frame decoding, tensor allocation or training. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, freemem, platform, totalmem } from "node:os";
import { resolve } from "node:path";
import { inventoryLegacyDataset, mediaPresence, validateVisibleDataset } from "../src/dataset-manifest.ts";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: tsx scripts/research-status.ts [--annotations COCO.json] [--python EXECUTABLE] [--output NEW.json]\nRead-only inventory and environment inspection. This does not train or certify a no-swap runtime.");
} else {
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!["--annotations", "--python", "--output"].includes(key) || options.has(key) || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error(`Invalid or duplicate option: ${key}. Use --help.`);
    }
    options.set(key, args[++i]);
  }
  const inspect = (executable: string, argv: string[]) => {
    const result = spawnSync(executable, argv, { cwd: root, encoding: "utf8", timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
    return { available: !result.error && result.status === 0, exit_code: result.status,
      output: result.stdout.trim(), error: result.error?.message ?? result.stderr.trim() };
  };
  const legacy = inventoryLegacyDataset(root);
  const media = legacy.manifest.sources.map(source => mediaPresence(source, root));
  const annotations = options.get("--annotations");
  const annotationIssues = annotations
    ? validateVisibleDataset(JSON.parse(readFileSync(resolve(annotations), "utf8")))
    : [{ severity: "error", code: "annotations-missing", item: "dataset", message: "Supply independently reviewed visible-instance COCO labels. Legacy split/probability files are not image labels." }];
  const localPython = resolve(root, "vision/.venv", platform() === "win32" ? "Scripts/python.exe" : "bin/python");
  const python = options.get("--python") ?? (existsSync(localPython) ? localPython : "python3");
  const vision = inspect(python, ["vision/baseline.py", "doctor"]);
  const resourceEvidence = platform() === "darwin" ? {
    boot_and_swap: inspect("sysctl", ["kern.boottime", "vm.swapusage"]),
    vm_stat: inspect("vm_stat", []),
    pressure: inspect("memory_pressure", ["-Q"]),
  } : null;
  const report = {
    schema_version: 1, mode: "preflight-only", recorded_at: new Date().toISOString(),
    code: inspect("git", ["rev-parse", "HEAD"]),
    local_changes: inspect("git", ["status", "--short", "--", "."]),
    hardware: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logical_cpus: cpus().length,
      total_memory_bytes: totalmem(), free_memory_bytes: freemem() },
    tools: { ffmpeg: inspect("ffmpeg", ["-version"]), ffprobe: inspect("ffprobe", ["-version"]), python, vision },
    data: { media, available_legacy_media: media.filter(item => item.present).length,
      annotated_segments: legacy.labels.filter(item => item.id.startsWith("legacy-")).reduce((sum, item) => sum + item.segments, 0),
      annotations: annotations ? resolve(annotations) : null, annotation_issues: annotationIssues, stage_a: legacy.stage_a },
    resources: { system_no_swap_verified: false, evidence: resourceEvidence,
      note: "Free RAM and zero Swapouts are observations, not OS no-swap enforcement. Apply the repository's local-compute policy before a training run; remote-host policy is separate." },
    limitations: [
      "This command never runs a model and cannot certify reconstruction accuracy or training completion.",
      "The five historical recordings are development data, not an unseen test set.",
      "Instance predictions still require validated geometry and temporal decoding before they become move reconstructions.",
    ],
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.has("--output")) writeFileSync(resolve(options.get("--output")!), json, { flag: "wx" });
  console.log(json);
}
