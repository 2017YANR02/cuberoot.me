import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  buildSparseAnnotationQueue, emptyVisibleDataset, inventoryLegacyDataset, validateSourceManifest, validateVisibleDataset,
  VISIBLE_CATEGORIES, type SourceVideo, type VisibleDataset, type VisibleImage,
} from "../src/dataset-manifest.ts";

const image = (id: number, split: VisibleImage["split"] = "train"): VisibleImage => ({
  id, file_name: `${id}.png`, width: 1920, height: 1080, source_id: `source-${id}`, recording_group: `recording-${id}`,
  split, image_sha256: String(id).padStart(64, "0"), pts_seconds: 1.2, reviewed: true, annotation_complete: true,
  annotation_provenance: "human-visible", reviewer: "independent-reviewer",
});
const dataset = (): VisibleDataset => ({
  images: [image(1)], categories: VISIBLE_CATEGORIES,
  annotations: [{ id: 1, image_id: 1, category_id: 1, segmentation: [[10, 10, 30, 10, 30, 30, 10, 30]],
    bbox: [10, 10, 20, 20], area: 400, iscrowd: 0, visibility: "visible", is_center: null }],
});
const source = (split: SourceVideo["split"] = "train"): SourceVideo => ({
  id: "v1", file_name: "v1.mp4", source_id: "original-1", recording_group: "session-1", split,
  historical_development: false, source_sha256: null,
  timing: { width: 1920, height: 1080, duration_seconds: 10, avg_frame_rate: "50/1", r_frame_rate: "50/1", time_base: "1/12800", real_seconds_per_pts_second: null, pts_and_duplicates_verified: false },
});

describe("dataset split and annotation integrity", () => {
  it("accepts independent visible labels and keeps color IDs separate from cube-state indices", () => {
    expect(validateVisibleDataset(dataset())).toEqual([]);
    expect(VISIBLE_CATEGORIES).toEqual([{ id: 1, name: "W" }, { id: 2, name: "Y" }, { id: 3, name: "R" }, { id: 4, name: "O" }, { id: 5, name: "B" }, { id: 6, name: "G" }]);
  });

  it("does not mistake an empty annotation template for training data", () => {
    expect(validateVisibleDataset(emptyVisibleDataset()).map((i) => i.code)).toEqual(["empty-dataset"]);
    expect(validateVisibleDataset(emptyVisibleDataset(), false)[0].severity).toBe("warning");
  });

  it.each(["source_id", "recording_group", "image_sha256"] as const)("rejects cross-split leakage through %s", (key) => {
    const data = dataset();
    const heldout = image(2, "test");
    heldout[key] = data.images[0][key];
    data.images.push(heldout);
    expect(validateVisibleDataset(data).filter((i) => i.code === "split-leakage")).toHaveLength(1);
  });

  it("rejects incomplete or pseudo-labeled frames, including nominally empty negative frames", () => {
    const data = dataset();
    data.annotations = [];
    data.images[0].annotation_complete = false;
    expect(validateVisibleDataset(data).map((i) => i.code)).toEqual(["annotation-not-ready"]);
    data.images[0].annotation_complete = true;
    data.images[0].annotation_provenance = "model-prediction";
    expect(validateVisibleDataset(data).map((i) => i.code)).toEqual(["annotation-not-ready"]);
  });

  it("keeps unknown-color regions out of background negatives", () => {
    const data = dataset();
    data.annotations[0].category_id = null;
    expect(validateVisibleDataset(data).map((i) => i.code)).toEqual(["unknown-as-background"]);
    Object.assign(data.annotations[0], { ignore: true, ignore_reason: "unreadable-color", visibility: "unknown" });
    expect(validateVisibleDataset(data)).toEqual([]);
  });

  it("rejects a string ignore flag instead of silently removing a truth instance", () => {
    const data = dataset();
    const malformed = { ...data, annotations: [{ ...data.annotations[0], ignore: "false" }] };
    expect(validateVisibleDataset(malformed).map((i) => i.code)).toEqual(["ignore-type"]);
  });

  it("rejects off-image or degenerate visible masks", () => {
    const data = dataset();
    data.annotations[0].segmentation = [[10, 10, 20, 20, 30, 30]];
    expect(validateVisibleDataset(data).map((i) => i.code)).toContain("polygon-area");
    data.annotations[0].segmentation = [[-1, 10, 20, 10, 20, 20]];
    expect(validateVisibleDataset(data).map((i) => i.code)).toContain("polygon-bounds");
    data.annotations[0].segmentation = [[10, 10, 40, 10, 40, 40]];
    expect(validateVisibleDataset(data).map((i) => i.code)).toContain("bbox-polygon-mismatch");
  });

  it("rejects identical raw media in different groups and historical footage as holdout", () => {
    const a = source();
    a.source_sha256 = "a".repeat(64);
    const b = { ...source("test"), id: "v2", source_id: "new-name", recording_group: "new-group", source_sha256: a.source_sha256 };
    expect(validateSourceManifest({ schema_version: 1, sources: [a, b] }).map((i) => i.code)).toEqual(["split-leakage"]);
    b.historical_development = true;
    expect(validateSourceManifest({ schema_version: 1, sources: [b] }).map((i) => i.code)).toEqual(["historical-holdout"]);
  });

  it("schedules only declared development/training groups and never asserts decoded PTS or annotations", () => {
    const queue = buildSparseAnnotationQueue([source(), { ...source("test"), id: "heldout" }], 2);
    expect(queue.map((q) => q.requested_pts_seconds)).toEqual([2.5, 7.5]);
    expect(queue.map((q) => q.decoded_pts_seconds)).toEqual([null, null]);
    expect(queue.every((q) => !q.annotation_complete && !q.reviewed)).toBe(true);
    expect(buildSparseAnnotationQueue([{ ...source(), recording_group: null }], 2)).toEqual([]);
  });

  it("audits historical labels without converting census RGB into instance ground truth", () => {
    const audit = inventoryLegacyDataset(resolve(import.meta.dirname, ".."));
    const historical = audit.labels.filter((l) => l.id.startsWith("legacy-"));
    expect(historical.map((l) => l.segments)).toEqual([41, 48, 45, 50, 49]);
    expect(historical.reduce((sum, l) => sum + l.nonrotation_segments, 0)).toBe(229);
    expect(audit.legacy_census).toMatchObject({ rgb_rows: 624, good: 444, bad: 180, grid_reads: 75, known_cells: 470, unknown_cells: 205, independent_visible_instance_masks: 0 });
    expect(audit.manifest.sources.filter((s) => s.historical_development).every((s) => s.split === "development")).toBe(true);
    expect(audit.labels.find((l) => l.id === "legacy-v3")?.warnings).toEqual(["Declared 46 segments, but 46 boundaries define 45."]);
  });
});
