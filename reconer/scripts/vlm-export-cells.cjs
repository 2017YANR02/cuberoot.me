// 导出 VLM 普查标注格训练集 (正⑱ 阶段1): 格心块中位 RGB + 毒/贴纸标签
// → scripts/vlm-census-cells.json (checked in, real-eval --cellveto 的 kNN 池)
// 用法: node scripts/vlm-export-cells.cjs [dump=.tmp/obs-geo2.json]
const fs = require("node:fs");
const src = fs.readFileSync("scripts/vlm-patch-dump.cjs", "utf8");
const CENSUS = {};
for (const m of src.matchAll(/"(\d)": `\n([\s\S]*?)`/g)) CENSUS[m[1]] = m[2];

const DUMP = process.argv[2] ?? ".tmp/obs-geo2.json";
const dump = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const CUBE = new Set(["W", "Y", "R", "O", "G", "B"]);

const rows = [];
for (const [prefix, raw] of Object.entries(CENSUS)) {
  const v = dump.videos.find((x) => x.name.startsWith(prefix));
  const map = new Map(raw.trim().split("\n").map((l) => l.trim().split(/\s+/))
    .map(([k, , s]) => [k.replace(/^g-/, "").replace(".png", ""), s]));
  for (let b = 0; b < v.bounds.length; b++) {
    for (let i = 0; i < v.bounds[b].length; i++) {
      const c = v.bounds[b][i];
      const s = map.get(`${b}-${i}-f${Math.floor((c.f0 + c.f1) / 2)}`);
      if (!s) continue;
      for (let k = 0; k < 9; k++) {
        if (c.read[k] === null || s[k] === "." || !c.rgbRead[k]) continue;
        rows.push({ v: prefix, rgb: c.rgbRead[k], bad: !CUBE.has(s[k]) ? 1 : 0 });
      }
    }
  }
}
fs.writeFileSync("scripts/vlm-census-cells.json", JSON.stringify(rows));
console.log(`导出 ${rows.length} 格 (毒 ${rows.filter((r) => r.bad).length}) → scripts/vlm-census-cells.json`);
