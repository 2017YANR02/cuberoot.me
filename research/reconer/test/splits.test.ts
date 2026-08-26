import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseGT, parseSegMoves, parseSplitFrames } from "../src/splits.ts";

const FILES = ["1 4.448", "2 4.369", "3 4.375", "4 4.610", "5 4.067"].map(
  (n) => `videos/${n}.MP4.splits.txt`,
);
const read = (f: string) => readFileSync(f, "utf8");

describe("splits parsing — real GT files", () => {
  it.each(FILES)("%s: frames / segLabels / gtTokens aligned", (f) => {
    const c = read(f);
    const nSeg = parseSplitFrames(c).length - 1;
    expect(nSeg).toBeGreaterThan(1);
    // 流水线不变量: 段数 = 分类标签数 = GT token 数 (对齐, 否则 template_cnn 会跳过该视频)
    expect(parseSegMoves(c).segLabels.length).toBe(nSeg);
    expect(parseGT(c).tokens.length).toBe(nSeg);
  });

  it("file 3: exact split frames", () => {
    const frames = parseSplitFrames(read("videos/3 4.375.MP4.splits.txt"));
    expect(frames.length).toBe(46);
    expect(frames[0]).toBe(679);
    expect(frames.at(-1)).toBe(1084);
  });

  it("file 3: gt tokens keep raw form, no tail rotations", () => {
    const { tokens, tailRotations } = parseGT(read("videos/3 4.375.MP4.splits.txt"));
    expect(tokens[0]).toBe("F");
    expect(tokens).toContain("UD'"); // 同段两转保留为单 token
    expect(tokens).toContain("U2'");
    expect(tailRotations).toEqual([]);
  });
});

describe("splits parsing — synthetic", () => {
  it("strips // comments, fingering, and ... pauses", () => {
    const { tokens } = parseGT("Splits:0:1:2\n2段\n↑ F ...U // 注释\n");
    expect(tokens).toEqual(["F", "U"]);
  });

  it("separates trailing orientation rotations from segment moves", () => {
    const { tokens, tailRotations } = parseGT("Splits:0:1:2:3\nR U y2\n");
    expect(tokens).toEqual(["R", "U"]);
    expect(tailRotations).toEqual(["y2"]);
  });

  it("parseSplitFrames tolerates trailing pipe", () => {
    expect(parseSplitFrames("Splits:1:2:3|\n")).toEqual([1, 2, 3]);
  });
});
