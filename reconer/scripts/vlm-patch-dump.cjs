// 用普查结果修补 v1 转储: 两个变体
//   null 变体: 仅把普查判 J(衣)/S(手)/.(不可读) 的格置 null (保守 — 只删毒证据)
//   full 变体: 读数整体替换为普查色 (WYROGB), J/S/. 置 null (VLM 读色通道)
// 普查格序已实证与 run.grid 格序 1:1 对齐 (g-10-0 / g-14-1 逐格吻合)
const fs = require("node:fs");
const census = `
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
`.trim().split("\n").map((l) => l.trim().split(/\s+/));

const map = new Map(census.map(([k, grade, s]) => [k.replace(/^g-/, "").replace(".png", ""), { grade, s }]));
const CUBE = new Set(["W", "Y", "R", "O", "G", "B"]);

for (const variant of ["null", "full"]) {
  const dump = JSON.parse(fs.readFileSync(".tmp/obs-geo.json", "utf8"));
  const v = dump.videos.find((x) => x.name.startsWith("1"));
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
  fs.writeFileSync(`.tmp/obs-geo-vlm-${variant}.json`, JSON.stringify(dump));
  console.log(`${variant}: 链命中 ${hit}/35, 置null ${nulled} 格` + (variant === "full" ? `, 改写 ${replaced} 格` : ""));
}
