// 用 VLM 盲读普查修补转储 (正⑱): 两个变体
//   null 变体: 仅把普查判 J(衣/背景)/S(手)/.(不可读) 的格置 null (保守 — 只删毒证据)
//   full 变体: 读数整体替换为普查色 (WYROGB), J/S/. 置 null (VLM 读色通道)
// 普查格序已实证与 run.grid 格序 1:1 对齐 (v1 g-10-0 / g-14-1 逐格吻合)。
// 普查 = 无 GT 上下文视觉子代理盲读 .tmp/png/vlm-v{N}-grid/ 叠网格 4K 裁片。
// 用法: node scripts/vlm-patch-dump.cjs [视频前缀=1] [dump=.tmp/obs-geo.json]
// 产物: .tmp/obs-geo-vlm{N}-null.json / -full.json
const fs = require("node:fs");

// 各视频普查原始数据 (2026-07-11; 评级 A贴合 B偏移 C跨面 D部分脱靶 E大部脱靶)
const CENSUS = {
  "1": `
g-4-0-f943.png B RYOBYBSBB
g-5-0-f953.png D SRRSRRSRY
g-8-0-f964.png D YRSYGSRSS
g-10-0-f987.png A GROBYYGYS
g-11-0-f994.png D JGRJBYGYG
g-13-0-f1003.png E JJJJGBSYG
g-14-0-f1028.png B JOYGYOWYW
g-14-1-f1042.png B JGOWYRBYO
g-14-2-f1056.png D JJOWGRBYO
g-14-3-f1076.png D JJJJORGYY
g-14-4-f1093.png A GGYWBGROY
g-15-0-f1102.png D JJJJWGBYY
g-18-0-f1121.png D JJJJGRYYY
g-20-0-f1130.png D JJJJGGGYB
g-22-0-f1142.png D JJYJGYGOR
g-23-0-f1147.png D JJYSYYGOB
g-24-0-f1157.png D JJGJYYRBB
g-24-1-f1164.png D JJJJRYBYB
g-26-0-f1169.png D JJJJYYYYO
g-27-0-f1178.png E JJJJYYSYY
g-27-1-f1185.png A YYYYYYYYY
g-27-2-f1196.png B YYYYYYBYY
g-27-3-f1211.png A YYYYYYYYY
g-29-0-f1221.png C YOOYYOYYY
g-30-0-f1230.png C YRYRRYYOS
g-30-1-f1235.png B YYYYYYYOS
g-31-0-f1240.png D ORRRRSYOS
g-31-1-f1246.png D YOOBRSBBS
g-32-0-f1251.png D JOORSSRRS
g-33-0-f1261.png C YBGYBGOOS
g-36-0-f1277.png C RYGRGRYRS
g-37-0-f1281.png D RYGRRRRSS
g-38-0-f1288.png D YRSRRSRRB
g-38-1-f1296.png D RRJRRSRBB
g-39-0-f1313.png E RSSBSSSSS
`,
  "3": `
g-0-0-f684.png A BYGBGSYBW
g-2-0-f700.png D JRSWWSYRY
g-2-1-f703.png D RRSOBSYGG
g-5-0-f722.png B BBRBGYRGR
g-6-0-f731.png D SBWRBRJBY
g-7-0-f739.png E SOOSSBJSB
g-8-0-f751.png D SGGSGGSGG
g-9-0-f755.png A GWBGWWORG
g-14-0-f786.png D JJJWWO.WG
g-16-0-f800.png C BWRGWBSWB
g-17-0-f804.png D JJJWBRWBS
g-17-1-f808.png D JJJWWGBRS
g-18-0-f813.png D JJJWWGBRS
g-18-1-f822.png B YWJWWSWBB
g-19-0-f828.png D OGJWBSWBS
g-21-0-f836.png D BRSGGSGSS
g-24-0-f857.png D SBWSWBSGR
g-25-0-f862.png D SWWSWBSOW
g-26-0-f875.png C WRRWWBOWW
g-26-1-f885.png C SWBWBWOWO
g-26-2-f893.png D SWBSOWSSG
g-26-3-f907.png E SSWSSOSSG
g-27-0-f918.png E SS.SSGSSS
g-27-1-f922.png E SSWSSRSSS
g-29-0-f931.png D SRGSRGSRB
g-31-0-f939.png D SBRSGGSGG
g-31-1-f944.png D JRRJRRJJG
g-32-0-f952.png D SBRSWRSJR
g-32-1-f956.png D JWWSWRJRG
g-33-0-f967.png D JJJWWOWRB
g-33-1-f980.png E JJJWWWRSS
g-33-2-f994.png D WWOWRGGSS
g-34-0-f1012.png C RWWGBWGGO
g-35-0-f1017.png C GBWGGWSGO
g-35-1-f1025.png D SBWSWGSRG
g-38-0-f1037.png D SRWSGRSGG
g-40-0-f1049.png D BBJWWSWSS
g-40-1-f1054.png A WOBWWBWOY
g-42-0-f1066.png E WSJBRSSSS
g-43-0-f1076.png D WBJWRSWSS
`,
};

const PREFIX = process.argv[2] ?? "1";
const DUMP = process.argv[3] ?? ".tmp/obs-geo.json";
const raw = CENSUS[PREFIX];
if (!raw) throw new Error(`视频 ${PREFIX} 无普查数据`);
const census = raw.trim().split("\n").map((l) => l.trim().split(/\s+/));
const map = new Map(census.map(([k, grade, s]) => [k.replace(/^g-/, "").replace(".png", ""), { grade, s }]));
const CUBE = new Set(["W", "Y", "R", "O", "G", "B"]);

for (const variant of ["null", "full"]) {
  const dump = JSON.parse(fs.readFileSync(DUMP, "utf8"));
  const v = dump.videos.find((x) => x.name.startsWith(PREFIX));
  let nulled = 0, replaced = 0, hit = 0;
  for (let b = 0; b < v.bounds.length; b++) {
    for (let i = 0; i < v.bounds[b].length; i++) {
      const c = v.bounds[b][i];
      const e = map.get(`${b}-${i}-f${Math.floor((c.f0 + c.f1) / 2)}`);
      if (!e) continue;
      hit++;
      for (let k = 0; k < 9; k++) {
        const cl = e.s[k];
        if (!CUBE.has(cl)) { if (c.read[k] !== null) nulled++; c.read[k] = null; }
        else if (variant === "full") { if (c.read[k] !== cl) replaced++; c.read[k] = cl; }
      }
    }
  }
  const out = `.tmp/obs-geo-vlm${PREFIX}-${variant}.json`;
  fs.writeFileSync(out, JSON.stringify(dump));
  console.log(`${variant}: 链命中 ${hit}/${census.length}, 置null ${nulled} 格` + (variant === "full" ? `, 改写 ${replaced} 格` : "") + ` → ${out}`);
}
