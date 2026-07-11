import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const tmp = join(import.meta.dirname, "..", ".tmp");
function objAcc(path: string) {
  const vids = JSON.parse(readFileSync(join(tmp, path), "utf8")).videos as any[];
  const out: string[] = [];
  let gO = 0, gT = 0;
  for (const v of vids) {
    let ok = 0, tot = 0;
    for (const bnd of v.bounds) {
      if (!bnd) continue;
      for (const ch of bnd) {
        for (let i = 0; i < 9; i++) {
          if (ch.read[i] == null) continue;
          tot++;
          if (ch.read[i] === ch.gt[i]) ok++;
        }
      }
    }
    out.push(`${v.name.slice(0, 3)}:${((100 * ok) / Math.max(1, tot)).toFixed(0)}%(${tot})`);
    gO += ok; gT += tot;
  }
  return { per: out.join(" "), all: ((100 * gO) / Math.max(1, gT)).toFixed(1), tot: gT };
}
for (const [n, p] of [
  ["vivid 基线", "obs-dump.json"],
  ["GT上界(同视频)", "obs-knngt.json"],
  ["pool(跨视频)", "obs-pool.json"],
  ["HD重采(零GT)", "obs-hd.json"],
  ["HD重采+精修", "obs-hdr.json"],
  ["4K重采+精修", "obs-4k.json"],
] as const) {
  if (!existsSync(join(tmp, p))) continue;
  const r = objAcc(p);
  console.log(`${n.padEnd(16)} obs逐格 ${r.all}% (${r.tot}格)  ${r.per}`);
}
