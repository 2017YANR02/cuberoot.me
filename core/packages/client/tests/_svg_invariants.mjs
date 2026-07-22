/**
 * _svg_invariants — /sim 示意导出 SVG 的几何不变量检查(纯函数,零依赖)。
 *
 * 供两处共用:
 *  - tests/sim_svg_export_schematic.test.ts(CI 内存导出直检)
 *  - scripts/audit-sim-svg.mjs(对任意 .svg 文件跑同一套判据,含浏览器现抓件)
 *
 * 判据来源 = 2026-07-22 与 visualcube 对齐时连环踩过的坑,每条都有真实事故:
 *  ① perPathOpacity:半透明必须挂在 <g> 上整层拍平;逐 path 挂会在重叠区二次
 *     叠加(0.5+0.5=0.75)→ X 光下角块附近糊出深浅方块。
 *  ② coverage:任何贴纸墨迹不得越出面板墨迹(贴纸尖角戳出轮廓);隐藏贴纸必须
 *     被可见面板完全蒙住(否则 X 光下背面艳色裸露)。等距偏移塌角 / toFixed 拆组
 *     都曾在此露馅。
 *  ③ cornerConsistency:相邻面板共享的轮廓顶点在内缩后必须严格重合 —— 内缩系数
 *     全图唯一(vc 对所有面同一个 0.94)。逐面归一 → 圆弧圆心错开 → 角上双弧凸起
 *     (normal 视图 UFL/DFR)。
 *
 * 面板墨迹模型:核多边形 ⊕ 半径 stroke-width/2 的圆盘(round-join 描边即闵可夫
 * 斯基和)—— 带符号距离 ≤ w/2 即着墨,精确无近似。
 */

/** 解析示意 SVG 的结构:面板(fill===stroke 且带 stroke-width 的 path)、贴纸
 *  (无 stroke 的 path,defs/marker 内的箭头三角除外)、分层顺序、逐 path opacity。 */
export function parseSchematicSvg(svg) {
  const vb = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
  const viewBox = vb ? [Number(vb[1]), Number(vb[2]), Number(vb[3]), Number(vb[4])] : null;
  const tokens = [...svg.matchAll(/<(g|path|defs|marker)\b[^>]*>|<\/(g|defs|marker)>/g)];
  const plates = [];      // { pts, w, fill, group } 文档序
  const stickers = [];    // { pts, fill, order } 文档序(order = 已见面板数,0=面板前)
  let perPathOpacity = 0;
  let groupId = -1;       // 当前 <g opacity> 编号(-1 = 组外)
  let inDefs = 0;
  const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  const pts = (d) => [...d.matchAll(/[ML](-?[\d.]+)[ ,](-?[\d.]+)/g)]
    .map((m) => [Number(m[1]), Number(m[2])]);
  let groupsSeen = 0;
  for (const t of tokens) {
    const tag = t[0];
    if (t[2] === 'defs' || t[2] === 'marker') { inDefs = Math.max(0, inDefs - 1); continue; }
    if (t[1] === 'defs' || t[1] === 'marker') { inDefs++; continue; }
    if (t[2] === 'g') { groupId = -1; continue; }
    if (t[1] === 'g') { groupId = groupsSeen++; continue; }
    if (inDefs) continue;
    const d = attr(tag, 'd');
    if (!d) continue;
    if (attr(tag, 'opacity') != null) perPathOpacity++;
    const fill = attr(tag, 'fill');
    const stroke = attr(tag, 'stroke');
    const w = attr(tag, 'stroke-width');
    if (stroke != null && w != null && stroke === fill) {
      plates.push({ pts: pts(d), w: Number(w), fill, group: groupId, roundJoin: attr(tag, 'stroke-linejoin') === 'round' });
    } else if (stroke == null) {
      stickers.push({ pts: pts(d), fill, order: plates.length });
    }
  }
  // 面板按「所属 <g> / 组外连续段」切 run:2 run = X 光(隐藏面板 + 可见面板),
  // 1 run = normal(只有可见面板)。
  const plateRuns = [];
  let lastKey = null;
  for (const p of plates) {
    const key = p.group === -1 ? 'bare' : `g${p.group}`; // 组外连续段合并为一个 run
    if (key !== lastKey) { plateRuns.push([]); lastKey = key; }
    plateRuns[plateRuns.length - 1].push(p);
  }
  return {
    viewBox,
    plates,
    plateRuns,
    /** 面板前的贴纸 = 隐藏面贴纸(X 光首层);无面板时全部算可见。 */
    hiddenStickers: plates.length > 0 ? stickers.filter((s) => s.order === 0) : [],
    visibleStickers: plates.length > 0 ? stickers.filter((s) => s.order === plates.length) : stickers,
    /** 夹在面板 run 之间的贴纸 —— 合法结构里不存在,>0 即层序坏了。 */
    strayStickers: plates.length > 0
      ? stickers.filter((s) => s.order !== 0 && s.order !== plates.length).length : 0,
    perPathOpacity,
  };
}

/** 点到多边形的带符号距离(内负外正)。 */
export function signedDist(poly, x, y) {
  let inside = false, mind = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    mind = Math.min(mind, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return inside ? -mind : mind;
}

/** 三角扇网格采样多边形内部与边缘(重心细分,div=4 → 四边形 60 点)。 */
export function triangleFanSamples(poly, div = 4) {
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    for (let u = 0; u <= div; u++) {
      for (let v = 0; v + u <= div; v++) {
        const a = u / div, b = v / div, c = 1 - a - b;
        out.push([cx * c + ax * a + bx * b, cy * c + ay * a + by * b]);
      }
    }
  }
  return out;
}

/** 贴纸采样点落在面板墨迹并集之外的数量与最坏越界距离。 */
export function coverageLeak(stickerPolys, plates, tol = 0.05) {
  let count = 0, worst = 0;
  for (const st of stickerPolys) {
    for (const [x, y] of triangleFanSamples(st)) {
      const d = Math.min(...plates.map((p) => signedDist(p.pts, x, y) - p.w / 2));
      if (d > tol) { count++; if (d > worst) worst = d; }
    }
  }
  return { count, worst };
}

/** 不同面板间距离 < max(w)/2 的顶点对必须严格重合(< tol):它们是同一个轮廓
 *  顶点各自内缩的像,错位即角上双弧凸起。返回违规对列表。 */
export function cornerMismatches(plates, tol = 0.02) {
  const bad = [];
  for (let a = 0; a < plates.length; a++) {
    for (let b = a + 1; b < plates.length; b++) {
      const near = Math.max(plates[a].w, plates[b].w) / 2;
      if (near <= 0.5) continue; // 1px 锐角退化面板不参与
      for (const p of plates[a].pts) {
        for (const q of plates[b].pts) {
          const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
          if (d > tol && d < near) bad.push({ a, b, p, q, d });
        }
      }
    }
  }
  return bad;
}

/** 全套判据一次跑完,返回 { pass, checks: [{name, pass, detail}] }。 */
export function auditSchematicSvg(svg) {
  const doc = parseSchematicSvg(svg);
  const checks = [];
  const push = (name, pass, detail) => checks.push({ name, pass, detail });

  push('structure', doc.plateRuns.length <= 2 && doc.strayStickers === 0,
    `plateRuns=${doc.plateRuns.map((r) => r.length).join('+') || '0'} `
    + `stickers=${doc.hiddenStickers.length}隐+${doc.visibleStickers.length}显 stray=${doc.strayStickers}`);
  push('perPathOpacity', doc.perPathOpacity === 0, `${doc.perPathOpacity} 个 path 挂了 opacity(应为 0,半透明只许挂 <g>)`);
  push('roundJoin', doc.plates.every((p) => p.roundJoin), `${doc.plates.filter((p) => !p.roundJoin).length} 块面板缺 round-join`);

  if (doc.plates.length > 0) {
    const vis = coverageLeak(doc.visibleStickers.map((s) => s.pts), doc.plates);
    push('coverage:visible', vis.count === 0,
      `可见贴纸越出面板墨迹 ${vis.count} 点(最坏 ${vis.worst.toFixed(3)}px)`);
    if (doc.plateRuns.length === 2) {
      const visPl = doc.plateRuns[1];
      const hid = coverageLeak(doc.hiddenStickers.map((s) => s.pts), visPl);
      push('coverage:hidden', hid.count === 0,
        `隐藏贴纸未被可见面板蒙住 ${hid.count} 点(最坏 ${hid.worst.toFixed(3)}px)`);
    }
    const mism = cornerMismatches(doc.plates);
    push('cornerConsistency', mism.length === 0,
      mism.length === 0 ? '共享角顶点全部重合'
        : `${mism.length} 对共享角顶点错位,最坏 ${Math.max(...mism.map((m) => m.d)).toFixed(3)}px @ (${mism[0].p[0]},${mism[0].p[1]})`);
  }

  return { pass: checks.every((c) => c.pass), checks, doc };
}
