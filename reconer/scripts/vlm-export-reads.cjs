// 导出 VLM 普查读数为解码附加证据通道 (正⑱ 阶段3 原型)
// → scripts/vlm-census-reads.json: { 视频前缀: { "b-i": [9 格色或 null] } }
// J/S/. (衣服/手/不可读) → null; 只保留魔方色 — 供 backward-decode --vlmev 消费
const fs = require("node:fs");
const src = fs.readFileSync("scripts/vlm-patch-dump.cjs", "utf8");
const CUBE = new Set(["W", "Y", "R", "O", "G", "B"]);
const out = {};
for (const m of src.matchAll(/"(\d)": `\n([\s\S]*?)`/g)) {
  const vid = m[1];
  out[vid] = {};
  for (const line of m[2].trim().split("\n")) {
    const [k, , s] = line.trim().split(/\s+/);
    const key = k.replace(/^g-/, "").replace(/-f\d+\.png$/, "");
    out[vid][key] = [...s].map((c) => (CUBE.has(c) ? c : null));
  }
}
fs.writeFileSync("scripts/vlm-census-reads.json", JSON.stringify(out));
console.log(Object.entries(out).map(([v, o]) => `v${v}: ${Object.keys(o).length} 链`).join(", "), "→ scripts/vlm-census-reads.json");
