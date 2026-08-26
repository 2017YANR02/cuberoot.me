// 验证自动脱靶信号 (sup=色块支撑率) 对 VLM 普查标注 (J/S=衣服/手) 的预测力 (正⑱ 阶段1)
// 判死线: 某阈值下 杀掉 ≥70% 的 J/S 格 且 误杀 ≤10% 的贴纸格 (只算 read 非 null 的格)
// 用法: node scripts/vlm-sup-validate.cjs [dump=.tmp/obs-geo2.json]
const fs = require("node:fs");
const { execSync } = require("node:child_process");
// 复用 patch 脚本里的普查数据
const src = fs.readFileSync("scripts/vlm-patch-dump.cjs", "utf8");
const CENSUS = {};
for (const m of src.matchAll(/"(\d)": `\n([\s\S]*?)`/g)) CENSUS[m[1]] = m[2];

const DUMP = process.argv[2] ?? ".tmp/obs-geo2.json";
const dump = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const CUBE = new Set(["W", "Y", "R", "O", "G", "B"]);

const cells = []; // {bad: bool, sup: number, read: bool, video}
for (const [prefix, raw] of Object.entries(CENSUS)) {
  const v = dump.videos.find((x) => x.name.startsWith(prefix));
  if (!v) continue;
  const map = new Map(raw.trim().split("\n").map((l) => l.trim().split(/\s+/))
    .map(([k, g, s]) => [k.replace(/^g-/, "").replace(".png", ""), s]));
  let hit = 0;
  for (let b = 0; b < v.bounds.length; b++) {
    for (let i = 0; i < v.bounds[b].length; i++) {
      const c = v.bounds[b][i];
      const s = map.get(`${b}-${i}-f${Math.floor((c.f0 + c.f1) / 2)}`);
      if (!s) continue;
      hit++;
      if (!c.sup) throw new Error("转储缺 sup 字段");
      for (let k = 0; k < 9; k++) {
        if (c.read[k] === null) continue; // 只算实际喂进证据的格
        if (s[k] === ".") continue; // 普查不可读格不计分
        cells.push({ bad: !CUBE.has(s[k]), sup: c.sup[k], video: prefix });
      }
    }
  }
  console.log(`v${prefix}: 普查链命中 ${hit}`);
}
const bad = cells.filter((c) => c.bad), good = cells.filter((c) => !c.bad);
console.log(`标注格: 毒(J/S) ${bad.length}, 贴纸 ${good.length}`);
console.log(`毒格 sup 分布: ${JSON.stringify([0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => bad.filter((c) => c.sup <= t).length))} (≤0/0.2/0.4/0.6/0.8/1)`);
console.log(`贴纸格 sup 分布: ${JSON.stringify([0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => good.filter((c) => c.sup <= t).length))}`);
for (const thr of [0.01, 0.2, 0.35, 0.5, 0.65, 0.8, 1.01]) {
  const kill = bad.filter((c) => c.sup < thr).length / bad.length;
  const fk = good.filter((c) => c.sup < thr).length / good.length;
  console.log(`阈值 ${thr}: 杀毒 ${(kill * 100).toFixed(0)}%  误杀 ${(fk * 100).toFixed(0)}%  ${kill >= 0.7 && fk <= 0.1 ? "✓ 达标" : ""}`);
}
