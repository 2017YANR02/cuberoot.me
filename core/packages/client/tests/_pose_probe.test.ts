/**
 * /sim home 握姿 Node 蒙皮探针 + 坐标下降求解器(r11 全关节解锁版)。
 * 默认(无 env)skip —— CI 零成本;用法:
 *   PROBE=1  只测量当前 handPoses 姿态的全部指标(锚点复现/回归)
 *   GRIP=1   默认握贴纸位契约核对(FINGERTRICKS.md §1.1,改手必跑)
 *   SOLVE=R  右手全通道坐标下降(roll/pos + 四指 c1/splay/twist + 拇指 5 通道)
 *   SOLVE=L  左手偏移解(右手解冻结,解 LEFT_CURL_OFFSET 维度)
 * 跑法:pnpm --filter @cuberoot/client exec cross-env? 无 —— 直接
 *   PROBE=1 pnpm --filter @cuberoot/client exec vitest run tests/_pose_probe.test.ts
 * 判据与 r5/r6/r10 同源:全蒙皮顶点(applyBoneTransform)Chebyshev 间隙、
 * 四指长轴倾角、接触落点/贴面 gap、拇指真实甲片网格 PCA 法向、M 列 |x|、
 * 拇指 CMC/MCP 高度(r11 新规格:可见拇指根沉 D 层以下)。
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { nailFrame } from '@/app/[lang]/sim/engine/hands/handModelGltf';
import { buildManoHand, MANO_THUMB_ROLL, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import { WRIST_LOCAL, type HandModel, type FingerName } from '@/app/[lang]/sim/engine/hands/handModel';
import { homeRight, homeLeft, quatFromWorldRots, type HandPose, type FingerCurl } from '@/app/[lang]/sim/engine/hands/handPoses';

const MODE = process.env.SOLVE ?? (process.env.PROBE ? 'PROBE' : process.env.MEASURE_NAILK ? 'NAILK' : process.env.GRIP ? 'GRIP' : '');
// 求解期顶点降采样步长(STRIDE=1 关闭)。默认 3 ≈ 3× 提速,采样误差 ~0.1U。
const SOLVE_STRIDE = Math.max(1, Number(process.env.STRIDE ?? 3));
// PROBE_OUT=<file>:全部探针日志同步落盘 —— vitest 后台跑(非 TTY 管道)时
// console.log 会被 reporter 吞掉,6 分钟求解跑完只剩 summary(2026-07-11 两连踩)。
const PROBE_OUT = process.env.PROBE_OUT;
if (PROBE_OUT) {
  const fs = await import('node:fs');
  fs.writeFileSync(PROBE_OUT, '');
  const orig = console.log.bind(console);
  console.log = (...args: unknown[]): void => {
    orig(...args);
    fs.appendFileSync(PROBE_OUT, args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n');
  };
}
// 手模 = MANO 独占(2026-07-11 内置 generic-hand 退役):硬规格含真 CMC 沉
// D 层(cmcY ≤ −30,generic 上 r11 已证不可行,是删它的动因之一)。
const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const HALF = 96; // 魔方半宽(SIZE=64,棱长 192)

async function loadModel(side: 1 | -1): Promise<HandModel> {
  const name = side === -1 ? 'right' : 'left';
  const p = fileURLToPath(new URL(`../public/sim/hands/mano/${name}.mano.json`, import.meta.url));
  const data = JSON.parse(await readFile(p, 'utf8')) as ManoHandData;
  return buildManoHand(data, side, new THREE.MeshStandardMaterial(), `${name}.mano.json`);
}

/** rig applyHand 的姿态数学复刻(twist/meta 含 r11 通道;sideSign = model.side)。 */
function applyPose(m: HandModel, pose: HandPose): void {
  const g = m.group;
  g.position.copy(pose.pos);
  g.quaternion.copy(pose.quat);
  const sideSign = m.side;
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  for (const name of FINGERS) {
    const f = m.fingers[name];
    const fp = pose.fingers[name];
    e.set((fp.twist ?? 0) * sideSign, -fp.curl[0], fp.splay * sideSign, 'YZX');
    f.root.quaternion.setFromEuler(e).premultiply(f.rootBase);
    if (fp.mid) {
      f.mid.rotation.set(fp.mid[0] * sideSign, -fp.curl[1], fp.mid[1] * sideSign, 'YZX');
    } else {
      f.mid.rotation.set(0, -fp.curl[1], 0);
    }
    f.tip.rotation.set(0, -fp.curl[2], 0);
    if (f.meta && f.metaBase) {
      const mm = fp.meta;
      if (mm) {
        e.set((mm[2] ?? 0) * sideSign, -mm[0], mm[1] * sideSign, 'YZX');
        f.meta.quaternion.setFromEuler(e).premultiply(f.metaBase)
          .multiply(q.copy(f.metaBase).invert());
      } else {
        f.meta.quaternion.identity();
      }
    }
  }
  g.updateMatrixWorld(true);
  m.poseCorrective?.(); // MANO posedirs(姿态修正 blendshape)—— 改绑定几何,量哪都得先修
}

type Probe = {
  m: HandModel;
  mesh: THREE.SkinnedMesh;
  dom: string[]; // 每顶点主导骨名
  sec: string[]; // 次权重骨名(>0.15)
  nailThumb: THREE.Mesh;
  /** 无名指+小指的肉半径和(绑定姿实测 p50 顶点→链轴距):指间净距 =
   *  链轴线间最短距 − 此值(轴线法对穿插深度有正确梯度,表面点間距在
   *  互穿时恒 ≈0 无梯度)。 */
  ringPinkyRad: number;
};

async function makeProbe(side: 1 | -1): Promise<Probe> {
  const m = await loadModel(side);
  const mesh = m.meshes[0] as THREE.SkinnedMesh;
  const geo = mesh.geometry;
  const skinIndex = geo.getAttribute('skinIndex');
  const skinWeight = geo.getAttribute('skinWeight');
  const names = mesh.skeleton.bones.map((b) => b.name);
  const dom: string[] = [];
  const sec: string[] = [];
  for (let i = 0; i < geo.getAttribute('position').count; i++) {
    let bi = 0, bw = -1, si = -1, sw = 0.15;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bw) { bw = w; bi = skinIndex.getComponent(i, k); }
    }
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      const idx = skinIndex.getComponent(i, k);
      if (idx !== bi && w > sw) { sw = w; si = idx; }
    }
    dom.push(names[bi] ?? '');
    sec.push(si >= 0 ? names[si] ?? '' : '');
  }
  const nailThumb = m.nailMeshes!.find((n) => (n.userData.nail as { finger: string }).finger === 'thumb')!;
  const p: Probe = { m, mesh, dom, sec, nailThumb, ringPinkyRad: 0 };
  // 绑定姿下量无名/小指肉半径(p50 顶点→本指链轴距),解算期常量。
  m.group.updateMatrixWorld(true);
  const radOf = (name: FingerName): number => {
    const segs = chainSegs(p, name);
    const ds = skinnedVerts(p, (n) => n.includes(`${name}-finger-phalanx`) || n === chainBones[name][3])
      .map((v) => Math.min(...segs.map(([a, b]) => segPointDist(a, b, v))));
    ds.sort((a, b) => a - b);
    return ds.length ? ds[Math.floor(ds.length * 0.5)] : 0;
  };
  p.ringPinkyRad = radOf('ring') + radOf('pinky');
  return p;
}

/** 指链 3 段(骨关节世界位)。 */
function chainSegs(p: Probe, name: FingerName): [THREE.Vector3, THREE.Vector3][] {
  const [j1, j2, j3, j4] = chainBones[name];
  const q = [jointWorld(p, j1), jointWorld(p, j2), jointWorld(p, j3), jointWorld(p, j4)];
  return [[q[0], q[1]], [q[1], q[2]], [q[2], q[3]]];
}

function segPointDist(a: THREE.Vector3, b: THREE.Vector3, v: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, v.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
  return a.clone().addScaledVector(ab, t).distanceTo(v);
}

/** 线段-线段最短距(夹持参数化,数值稳)。 */
function segSegDist(a1: THREE.Vector3, a2: THREE.Vector3, b1: THREE.Vector3, b2: THREE.Vector3): number {
  const d1 = a2.clone().sub(a1), d2 = b2.clone().sub(b1), r = a1.clone().sub(b1);
  const A = d1.lengthSq(), E = d2.lengthSq(), F = d2.dot(r);
  let s = 0, t = 0;
  if (A > 1e-9) {
    const C = d1.dot(r), B = d1.dot(d2);
    const den = A * E - B * B;
    s = den > 1e-9 ? Math.max(0, Math.min(1, (B * F - C * E) / den)) : 0;
    t = E > 1e-9 ? (B * s + F) / E : 0;
    if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -C / A)); }
    else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (B - C) / A)); }
  } else if (E > 1e-9) {
    t = Math.max(0, Math.min(1, F / E));
  }
  return a1.clone().addScaledVector(d1, s).distanceTo(b1.clone().addScaledVector(d2, t));
}

const _v = new THREE.Vector3();
/** 全蒙皮顶点世界坐标(posed)。filter 按主导骨名。 */
function skinnedVerts(p: Probe, match?: (domName: string) => boolean, stride = 1): THREE.Vector3[] {
  const geo = p.mesh.geometry;
  const pos = geo.getAttribute('position');
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += stride) {
    if (match && !match(p.dom[i])) continue;
    _v.fromBufferAttribute(pos, i);
    p.mesh.applyBoneTransform(i, _v);
    out.push(_v.clone().applyMatrix4(p.mesh.matrixWorld));
  }
  return out;
}

function jointWorld(p: Probe, boneName: string): THREE.Vector3 {
  const b = p.m.group.getObjectByName(boneName);
  if (!b) throw new Error(`bone ${boneName} missing`);
  return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
}

/** 甲片平面 PCA 法向(世界系):协方差最小特征向量,反幂迭代。 */
function nailNormal(p: Probe): THREE.Vector3 {
  p.nailThumb.updateMatrixWorld(true);
  const pos = (p.nailThumb.geometry as THREE.BufferGeometry).getAttribute('position');
  const pts: number[][] = [];
  const c = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(p.nailThumb.matrixWorld);
    pts.push([_v.x, _v.y, _v.z]);
    c[0] += _v.x; c[1] += _v.y; c[2] += _v.z;
  }
  c[0] /= pts.length; c[1] /= pts.length; c[2] /= pts.length;
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const q of pts) {
    const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a][b] += d[a] * d[b];
  }
  // 反幂迭代:解 (M + eps I) x = b 迭代 → 最小特征向量
  const solve3 = (A: number[][], b: number[]): number[] => {
    const m = A.map((r) => [...r]);
    const x = [...b];
    for (let i = 0; i < 3; i++) {
      let piv = i;
      for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[piv][i])) piv = r;
      [m[i], m[piv]] = [m[piv], m[i]];
      [x[i], x[piv]] = [x[piv], x[i]];
      for (let r = i + 1; r < 3; r++) {
        const k = m[r][i] / m[i][i];
        for (let cc = i; cc < 3; cc++) m[r][cc] -= k * m[i][cc];
        x[r] -= k * x[i];
      }
    }
    for (let i = 2; i >= 0; i--) {
      for (let cc = i + 1; cc < 3; cc++) x[i] -= m[i][cc] * x[cc];
      x[i] /= m[i][i];
    }
    return x;
  };
  const tr = M[0][0] + M[1][1] + M[2][2];
  const A = M.map((r, i) => r.map((v2, j) => v2 + (i === j ? 1e-9 * tr : 0)));
  let x = [0.3, 0.5, 0.8];
  for (let it = 0; it < 30; it++) {
    x = solve3(A, x);
    const n = Math.hypot(x[0], x[1], x[2]);
    x = [x[0] / n, x[1] / n, x[2] / n];
  }
  return new THREE.Vector3(x[0], x[1], x[2]);
}

type Metrics = {
  pen: number; // 全手 Chebyshev 穿模(>0 = 穿进方块)
  /** 小指↔无名指净距:链轴线最短距 − 两指肉半径和(<0 = 互穿)。 */
  pinkyRingClear: number;
  /** 四指肉的内伸最深点(向掌侧符号化:R 手 = min x,L 手 = min −x)。
   *  两手互为镜像且同行同深,左右净距 = 2×此值 —— <0 即左右手指互穿
   *  (2026-07-11 用户背面截图抓的:HAND_SCALE 改大后旧姿态左右指尖对撞,
   *  且求解器此前根本没有跨手项,单手合规即放行)。 */
  fourFleshMinX: number;
  /** 内伸符号(R=+1 取 x,L=−1 取 −x):tipx 带必须带符号用 —— r12 实测
   *  |x| 写法让食/中指跑到 x=−37 的镜像解还"合规"。 */
  inwardSgn: 1 | -1;
  fingers: Record<string, { tiltDeg: number; gapB: number; contactY: number; contactX: number; dorsalY: number; tip: THREE.Vector3 }>;
  thumb: {
    fGap: number; cx: number; cy: number; minAbsX: number;
    nailDotZ: number; cmcY: number; mcpY: number; fleshMinY: number; fleshMaxY: number;
    len2d: number; // 拇指链 CMC→tip 直线距(视觉长度 proxy,防拉直读长)
    /** 可见拇指(MCP→tip)对水平面的仰俯角(°)。2026-07-11 用户硬规格:
     *  拇指要水平 —— r3 抛光曾漂成 40° 斜插(接触 y 28)。 */
    horizDeg: number;
    tip: THREE.Vector3;
  };
};

const FOUR: FingerName[] = ['index', 'middle', 'ring', 'pinky'];
const chainBones: Record<FingerName, [string, string, string, string]> = {
  thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  index: ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
  middle: ['middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
  ring: ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
  pinky: ['pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'],
};

function measure(p: Probe, opts?: { penScope?: 'all' | 'noThumb' | 'thumbOnly'; skipNail?: boolean; fast?: boolean }): Metrics {
  const scope = opts?.penScope ?? 'all';
  // fast:求解期顶点降采样(每 SOLVE_STRIDE 取 1)—— 损失评估几千次,全分辨率
  // 是耗时大头;带宽/墙有 ≥0.1U 余量设计,采样误差 ~0.1U 可容。最终打印/回归
  // 一律全分辨率(不传 fast)。
  const stride = opts?.fast ? SOLVE_STRIDE : 1;
  // 穿模(蒙皮肉 + 拇指甲片;分阶段求解时可只看局部)
  let pen = -1e9;
  const all = skinnedVerts(p, scope === 'all' ? undefined
    : scope === 'noThumb' ? (n): boolean => !n.startsWith('thumb')
    : (n): boolean => n.startsWith('thumb'), stride);
  for (const v of all) pen = Math.max(pen, HALF - Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)));
  if (scope !== 'noThumb') {
    p.nailThumb.updateMatrixWorld(true);
    const posA = (p.nailThumb.geometry as THREE.BufferGeometry).getAttribute('position');
    for (let i = 0; i < posA.count; i++) {
      _v.fromBufferAttribute(posA, i).applyMatrix4(p.nailThumb.matrixWorld);
      pen = Math.max(pen, HALF - Math.max(Math.abs(_v.x), Math.abs(_v.y), Math.abs(_v.z)));
    }
  }

  const fingers: Metrics['fingers'] = {};
  const inwardSgn = p.m.side === -1 ? 1 : -1; // R 手内伸 = −x 方向,L 镜像
  let fourFleshMinX = 1e9;
  for (const name of FOUR) {
    const [j1, , , j4] = chainBones[name];
    const a = jointWorld(p, j1);
    const b = jointWorld(p, j4);
    const d = b.clone().sub(a);
    const tiltDeg = (Math.atan2(Math.abs(d.y), Math.hypot(d.x, d.z)) * 180) / Math.PI;
    // 指腹对 B 面贴面:该指主导顶点里 z ≤ -HALF 侧最靠面的
    const verts = skinnedVerts(p, (n) => n.includes(`${name === 'index' ? 'index' : name === 'middle' ? 'middle' : name === 'ring' ? 'ring' : 'pinky'}-finger-phalanx`) || n === chainBones[name][3], stride);
    let gapB = 1e9, cy = 0, cx = 0, cn = 0;
    const inB = (v: THREE.Vector3): boolean => v.z <= -HALF && Math.abs(v.x) <= HALF && Math.abs(v.y) <= HALF;
    for (const v of verts) {
      fourFleshMinX = Math.min(fourFleshMinX, v.x * inwardSgn);
      if (!inB(v)) continue; // B 面外侧且在面足迹内才算贴面候选(绕出棱外的肉不算)
      const g = -HALF - v.z;
      if (g < gapB) gapB = g;
    }
    for (const v of verts) {
      if (!inB(v)) continue;
      if (-HALF - v.z < gapB + 1.5) { cy += v.y; cx += v.x; cn++; }
    }
    // 指背朝向:root 世界系 -z′(弯曲平面背侧)在世界 y 的分量
    const dorsal = new THREE.Vector3(0, 0, -1).applyQuaternion(
      p.m.fingers[name].root.getWorldQuaternion(new THREE.Quaternion()));
    fingers[name] = {
      tiltDeg,
      gapB: cn ? gapB : 1e9,
      contactY: cn ? cy / cn : NaN,
      contactX: cn ? cx / cn : NaN,
      dorsalY: dorsal.y,
      tip: b.clone(),
    };
  }

  // 拇指
  const tv = skinnedVerts(p, (n) => n.startsWith('thumb'), stride);
  let fGap = 1e9, cx = 0, cy = 0, cn = 0, minAbsX = 1e9, fleshMinY = 1e9, fleshMaxY = -1e9;
  const inF = (v: THREE.Vector3): boolean => v.z >= HALF && Math.abs(v.x) <= HALF && Math.abs(v.y) <= HALF;
  for (const v of tv) {
    minAbsX = Math.min(minAbsX, Math.abs(v.x));
    fleshMinY = Math.min(fleshMinY, v.y);
    fleshMaxY = Math.max(fleshMaxY, v.y);
    if (!inF(v)) continue; // F 面外侧且在面足迹内才算贴面候选
    const g = v.z - HALF;
    if (g < fGap) fGap = g;
  }
  for (const v of tv) {
    if (!inF(v)) continue;
    if (v.z - HALF < fGap + 1.5) { cx += v.x; cy += v.y; cn++; }
  }
  const cmc = jointWorld(p, 'thumb-metacarpal');
  const mcp = jointWorld(p, 'thumb-phalanx-proximal');
  const ttip = jointWorld(p, 'thumb-tip');
  const n = opts?.skipNail ? new THREE.Vector3(0, 0, 1) : nailNormal(p);
  const rSegs = chainSegs(p, 'ring'), pSegs = chainSegs(p, 'pinky');
  let axisD = 1e9;
  for (const [a1, a2] of rSegs) for (const [b1, b2] of pSegs) axisD = Math.min(axisD, segSegDist(a1, a2, b1, b2));
  return {
    pen,
    pinkyRingClear: axisD - p.ringPinkyRad,
    fourFleshMinX,
    inwardSgn,
    fingers,
    thumb: {
      fGap: cn ? fGap : 1e9,
      cx: cn ? cx / cn : NaN,
      cy: cn ? cy / cn : NaN,
      minAbsX,
      nailDotZ: Math.abs(n.z),
      cmcY: cmc.y,
      mcpY: mcp.y,
      fleshMinY,
      fleshMaxY,
      len2d: cmc.distanceTo(ttip),
      // r26 起带符号:正 = 指尖高于 MCP(用户规格「指尖到 MCP 从左上到右下」
      // 的期望方向),负 = MCP 反翘。
      horizDeg: Math.atan2(ttip.y - mcp.y, Math.hypot(ttip.x - mcp.x, ttip.z - mcp.z)) * 180 / Math.PI,
      tip: ttip.clone(),
    },
  };
}

function fmt(mx: Metrics): string {
  const f = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '—');
  const rows = FOUR.map((k) => {
    const r = mx.fingers[k];
    return `${k.padEnd(6)} tilt ${f(r.tiltDeg)}° gapB ${f(r.gapB, 2)} contact (${f(r.contactX)},${f(r.contactY)}) tip (${f(r.tip.x)},${f(r.tip.y)},${f(r.tip.z)}) dorsalY ${f(r.dorsalY, 2)}`;
  });
  const t = mx.thumb;
  return [
    `pen ${f(mx.pen, 2)} pinkyRingClear ${f(mx.pinkyRingClear, 2)} 四指内伸minX ${f(mx.fourFleshMinX)}(左右净距 ${f(2 * mx.fourFleshMinX)})`,
    ...rows,
    `thumb fGap ${f(t.fGap, 2)} contact (${f(t.cx)},${f(t.cy)}) |x|min ${f(t.minAbsX)} nail·ẑ ${f(t.nailDotZ, 3)} horiz ${f(t.horizDeg)}°`,
    `thumb CMC y ${f(t.cmcY)} MCP y ${f(t.mcpY)} fleshY [${f(t.fleshMinY)},${f(t.fleshMaxY)}] len2d ${f(t.len2d)}`,
  ].join('\n');
}

// ---------------- 求解参数化(SOLVE=R / SOLVE=L,三阶段) ----------------
/** 参数向量 → HandPose:roll 绕「过四指接触质心、平行 z 轴」转(接触点近似
 *  保持,solver 只需微调),pos 偏移叠加;四指 (dc1, dsplay, twist),拇指
 *  5 通道绝对值。s = [roll,dx,dy,dz, 四指×3, 拇指×5](21 维)。
 *  策略(21 维冷启动联合下降实测卡平坦区/串行基,废):
 *   A. roll 网格扫,每档只解四指恢复规格(dy/dz + 12 指参,splay 解析暖启动);
 *   B. 每个可行 roll 冻结手根,单解拇指 5 通道(多结构化种子);
 *   C. 选最优档全 21 维小步联合抛光。 */
type Params = number[];
const PIVOT = new THREE.Vector3(93, 1.7, -97);
const I_FOUR = 4; // 四指参数起点(每指 dc1,dsplay,twist)
const I_THUMB = 16;

function buildPose(base: HandPose, s: Params): HandPose {
  const [rollDeg, dx, dy, dz] = s;
  // MANO 尾部 31/32 = 绕同一枢轴的全局 pitch(x)/yaw(y),单位度:generic 的
  // base.quat 是按其掌弓解的,MANO 真实掌弓下指根线俯倾 ~10°,只有 z-roll
  // 修不平(首役 roll=0 档倾角 11~12° 卡死实测)。default 无尾参 ?? 0。
  const roll = quatFromWorldRots([['z', rollDeg], ['x', s[31] ?? 0], ['y', s[32] ?? 0]]);
  const pos = base.pos.clone().sub(PIVOT).applyQuaternion(roll).add(PIVOT)
    .add(new THREE.Vector3(dx, dy, dz));
  const quat = roll.clone().multiply(base.quat);
  const fingers = {} as Record<FingerName, FingerCurl>;
  const four = FOUR;
  four.forEach((name, i) => {
    const b = base.fingers[name];
    fingers[name] = {
      // MANO 追加尾部通道 dc2(23..26)/dc3(27..30):generic 的 c2/c3 烘焙值
      // 按其节段比例调的,MANO 真实解剖比例下冻结 c2/c3 → 倾角压不进 7.8° 墙
      // (首役 stage A 全档 10~15° 实测)。default 无尾参,?? 0 兜底。
      curl: [b.curl[0] + s[4 + i * 3], b.curl[1] + (s[23 + i] ?? 0), b.curl[2] + (s[27 + i] ?? 0)],
      splay: b.splay + s[5 + i * 3],
      twist: s[6 + i * 3],
    };
  });
  fingers.thumb = {
    curl: [s[16], s[17], s[18]], splay: s[19], twist: s[20],
    mid: [s[21], s[22]], // MCP 出平面 [twist, splay](r11:共面链解不开 甲∥F + MCP 沉 D)
  };
  return { pos, quat, fingers };
}

const hinge = (x: number): number => Math.max(0, x);
// 拇指 5+2 通道界(c1,c2,c3,splay,twist,mid×2)。MANO 放宽 c2/c3 过伸下界:
// 真实拇指 IP/MCP 可过伸,generic 界内 c2=-0.6/c3=-0.3 双顶死、甲面∥F 收不满(实测)。
const THUMB_BOUNDS: [number, number][] =
  [[-1.7, 1.8], [-0.9, 1.2], [-0.6, 1.3], [-0.6, 2.0], [-3.3, 3.3], [-2.2, 2.2], [-1.2, 1.2]];
const rowY: Record<string, number> = { index: 64, middle: 0, ring: -64 };
// r6 被认可姿态的 dorsalY 实测锚点 —— 指背在该握里朝外侧平伸,twist 的职责是
// 整手 roll 后把指背转回这个朝向,不是「朝上」。
const dorsalAnchor: Record<string, number> = { index: -0.02, middle: -0.06, ring: -0.14, pinky: -0.18 };

/** 四指 + 手根部分(stage A;pen 不含拇指)。out 传入时回填分项(诊断用)。 */
function fourLoss(mx: Metrics, out?: Record<string, number>): number {
  const t = (k: string, v: number): number => { if (out) out[k] = (out[k] ?? 0) + v; return v; };
  // 静置余量 ≥1.2U:待机呼吸 x ±1.76 / y ±0.88(home),贴 0 的裸间隙会被
  // 周期性吃穿(L 首解 pen −0.79 抓的)。
  // 余量墙 MANO ×20:权 5 在 pen −1.17 处梯度 ~0.005,推不动(实测停 −1.17)
  // 呼吸余量墙权重 PENW(r22:yaw 解在 pen 0.00 平衡,100 推不动,加压清)
  let L = t('pen', 1e4 * hinge(mx.pen) ** 2 + Number(process.env.PENW ?? 100) * hinge(mx.pen + 1.2) ** 2);
  // 左右手互撑硬墙(2026-07-11 用户背面截图:左右指尖对撞):四指肉内伸不过
  // x=12 ⇒ 镜像后左右净距 ≥24(≈0.375 棱块)。此前无任何跨手项,单手合规即
  // 放行 —— HAND_SCALE 变大/带宽收紧时会静默撞上。
  L += t('handClear', 100 * hinge(12 - mx.fourFleshMinX) ** 2);
  // MANO 版新增硬规格:真 CMC(thumb-metacarpal 关节)沉 D 层(y ≤ −30,
  // 规格界 −28.5 留 1.5U 余量)。CMC 位置只由手根位姿决定(关节自转不移位),
  // 放 stage A/C 的全局参数才有梯度 —— stage B 冻结手根,放 thumbLoss 无用。
  L += t('cmc', 60 * hinge(mx.thumb.cmcY + 30) ** 2);
  for (const name of FOUR) {
    const r = mx.fingers[name];
    // 倾角:硬墙提前到 7.8°(规格 8.6°,r10 终解曾全贴 8.6 上限 —— 四指水平
    // 是用户两次重申的硬规格,贴线冒险)+ 常开二次项加重。
    // 小指豁免:用户水平规格只点名食/中/无名;7.8° 墙曾把小指拍平(r6 蜷姿
    // 8.3°),小指被推平后前伸横穿 D 面底下(截图抓的)—— 改宽墙 25° + 强制
    // 收拢在后半区(tip z ≤ −40,别探进 D 扫掠柱/画面底部)。
    if (name === 'pinky') {
      // r26(用户规格「小拇指不要往上翘,接近水平、和无名指差不多」):宽墙
      // 25° env 化(TILTP),解题时压到无名指同级(~13°)。
      L += t(`${name}.tilt`, 200 * hinge(r.tiltDeg - Number(process.env.TILTP ?? 25)) ** 2);
      // r26:z 双侧带(PINKZ)—— TILTP 压平时小指曾被推到 z −142(越过 B 面
      // 深探背后,正对背面视角直戳观察者),平化必须圈在后半区浅带内。
      const [pzLo, pzHi] = (process.env.PINKZ ?? '-999,-40').split(',').map(Number);
      L += t(`${name}.tipz`, 6 * hinge(r.tip.z - pzHi) ** 2 + 25 * hinge(pzLo - r.tip.z) ** 2);
      // 小指↔无名指净距 ≥0.8U(2026-07-11 用户抓 MANO 小指压进无名指):
      // 轴线距对互穿深度有梯度,表面点距在互穿时恒 ≈0 推不动。
      L += t(`${name}.ringClear`, 120 * hinge(0.8 - mx.pinkyRingClear) ** 2);
      // 小指不与其它指交叉/被挡(2026-07-11 用户抓「小拇指被挡住」):tip 要
      // 明确低于无名指 tip ≥12U —— r5 两者 y 只差 2U,俯/仰角下小指整根被
      // 无名指遮死。轴距净距是方向无关量,挡视线的「同高贴排」它拦不住。
      // 带上界 45U:r7 无下界时小指被推飞到 −215(垂直下插 130U,假)。
      // r26:带宽 env 化(PBELOW='lo,hi')。TILTP 压平小指后其自然高度更低
      // (根位固定,平指 tip ≈ 根高),旧 hi=45 下界会经此耦合反把无名指从块
      // 中线拽下来(实测 −66.9→−80.3),压平解必须放宽 hi。
      const [pbLo, pbHi] = (process.env.PBELOW ?? '12,45').split(',').map(Number);
      L += t(`${name}.below`, 25 * (hinge(r.tip.y - (mx.fingers.ring.tip.y - pbLo)) ** 2 + hinge((mx.fingers.ring.tip.y - pbHi) - r.tip.y) ** 2));
    } else {
      // r25:水平墙 env 化(TILT4,默认 7.8°)。「指中线对齐块中线」(2026-07-11
      // 用户规格)在手根冻结下几何上必须让指轴上斜 ~8°(接触点抬 27U / 链长
      // ~180U),两规格冲突时中线对齐优先 —— 真人跨三行贴纸的握持本就扇形张指。
      const tilt4 = Number(process.env.TILT4 ?? 7.8);
      L += t(`${name}.tilt`, 200 * hinge(r.tiltDeg - tilt4) ** 2 + 2.5 * (r.tiltDeg / 8) ** 2);
    }
    L += t(`${name}.dorsal`, 120 * hinge(Math.abs(r.dorsalY - dorsalAnchor[name]) - 0.15) ** 2 + 2 * (r.dorsalY - dorsalAnchor[name]) ** 2);
    if (name !== 'pinky') {
      if (!Number.isFinite(r.gapB) || r.gapB > 900) {
        const d = r.tip.distanceTo(new THREE.Vector3(85, rowY[name], -HALF - 3));
        L += t(`${name}.lost`, 3e3 + 2 * d * d); // 丢接触:指尖拉向本行目标点(平坦罚无梯度)
        continue;
      }
      L += t(`${name}.gap`, 60 * (hinge(2.4 - r.gapB) ** 2 + hinge(r.gapB - 3.4) ** 2) + 0.8 * (r.gapB - 2.9) ** 2);
      // 行带硬约束(±24 内)+ 弱行心拉:stage C 曾拿行心弱罚换拇指分,把食指
      // 接触漂到 y=31(越界进中排)—— 行带必须是硬墙。
      // r25(用户规格「指中线对齐所压块中线」):行带 env 化,解题时收窄
      // (ROWBAND=5 级)把接触心钉到块心;默认 24 = 贴纸带内即可(回归口径)。
      const dyRow = Math.abs(r.contactY - rowY[name]);
      const rowBand = Number(process.env.ROWBAND ?? 24);
      L += t(`${name}.row`, 25 * hinge(dyRow - rowBand) ** 2 + 1.2 * (dyRow / 10) ** 2);
      // 2026-07-11 用户规格:背面看食/中/无名**指尖端点**要刚好碰到所压
      // 棱/角块的内缘(往中心收)。tip 骨(MANO=皮尖)|x| 进 [36,46] 带 →
      // 指尖肉(侧向半径 ~4U)刚好探到块内缘 x≈32,不越 R 层界(M 列安全
      // 隐式满足:全部肉 |x|≳32.5)。深度上 tip 拉回面附近:旧解食指 tip
      // z −123.6 悬空越面 27U(只有指腹蹭到面,端点戳向空中)。
      const ax = r.tip.x * mx.inwardSgn; // 带符号:跨过中线 = 负,墙立即起(r12 镜像解教训)
      // r21:CW26 整手俯转下 [36,46] 内缘带与拇指 Je 契约被证不可兼容(5 连解:
      // 四指钉内缘 ⇒ 手根内移 40U ⇒ 拇指 F 接触可达区中心塌到 x≈0,要么穿 M 列
      // 要么丢面)。TIPX 放宽仍须在 Q/Te/T 贴纸带内(x≤96−肉半径)。
      const [tipxLo, tipxHi] = (process.env.TIPX ?? '36,46').split(',').map(Number);
      // r26:ring 上界可单独豁免(TIPXR)—— ring 钉块中线的上摆天然把 tip x
      // 推外(r25 锥面),全指同带硬收会拿中线换 tipx(实测 −78.5 掉线)。
      const hiEff = name === 'ring' && process.env.TIPXR ? Number(process.env.TIPXR) : tipxHi;
      L += t(`${name}.tipx`, 50 * (hinge(tipxLo - ax) ** 2 + hinge(ax - hiEff) ** 2));
      // r21:CW26 下尖排斜穿面,越面深度放宽(TIPZLO;用户预览认可 −150 级越面)
      const tipzLo = Number(process.env.TIPZLO ?? -104);
      L += t(`${name}.tipz`, 2 * (hinge(tipzLo - r.tip.z) ** 2 + hinge(r.tip.z + 94) ** 2));
    } else if (Number.isFinite(r.gapB) && r.gapB < 900) {
      L += t(`${name}.gap`, 60 * hinge(2.0 - r.gapB) ** 2); // 小指不需接触,但别蹭面
    }
  }
  // r21(2026-07-11 用户俯视图规格):食/中/无名指尖排与 B 面平行 —— 三尖
  // z 展布 ≤2U 软墙(丢接触时 tip 仍有坐标,lost 项主导,此项只在贴面后收尾)。
  const zs = (['index', 'middle', 'ring'] as const).map((n) => mx.fingers[n].tip.z);
  L += t('tipzEq', 30 * hinge(Math.max(...zs) - Math.min(...zs) - 2) ** 2);
  return L;
}

/** 拇指部分(stage B;pen 只含拇指肉 + 甲片)。 */
function thumbLoss(mx: Metrics): number {
  let L = 1e4 * hinge(mx.pen) ** 2 + Number(process.env.PENW ?? 100) * hinge(mx.pen + 1.2) ** 2;
  const t = mx.thumb;
  // M 列安全(硬)。r21 CW26:拇指几何上必入 M 列(5 连解证明),M 扫掠避让
  // 交指法侧(同中指 @pin 先例),墙职责降为左右拇指互撑净距 —— THUMBMX 下调。
  L += 100 * hinge(Number(process.env.THUMBMX ?? 34.5) - t.minAbsX) ** 2;
  if (!Number.isFinite(t.fGap) || t.fGap > 900) {
    // 丢接触软拉目标:水平拇指 tip 落 F 竖直正中、贴中列边界(r6/r7 用户规格)
    const d = t.tip.distanceTo(new THREE.Vector3(58, 0, HALF + 3));
    return L + 3e3 + 2 * d * d;
  }
  L += 60 * (hinge(2.4 - t.fGap) ** 2 + hinge(t.fGap - 3.4) ** 2);
  // 接触心硬带:留在 F 面本列贴纸内(|x|∈[38,90])—— stage C 曾拿 0.2 弱罚换
  // MCP 分,把接触心漂到 (96,-47) 角块区。L 手 x 为负,取绝对值。
  // y 带 = 竖直正中 ±12(r6 用户规格「魔方高 3 则拇指尖在 1.5」:tip/接触
  // y≈0;r4/r5 的下半区带 [−52,−8] 被此规格取代)。MCP 沉 D 随之废除(水平
  // + 居中 ⇒ MCP ≈ ±17 内,与沉 D 几何互斥;真 CMC ≤ −30 仍保留 —— 掌骨
  // 从腕上 CMC 斜升 ~19° 到 MCP,解剖可行)。
  const cxA = Math.abs(t.cx);
  // r26:cy 带 env 化(THCY)。解「MCP 下沉、指尖不动」时必须收窄钉住指尖
  // —— 否则水平项的陡梯度走「抬整只拇指」宽盆地(cy −8→+28 实测两连翻车),
  // 沉 MCP 的窄谷根本进不去。
  const [cyLo, cyHi] = (process.env.THCY ?? '-12,12').split(',').map(Number);
  // 拇指 tip 内收带(r7 用户规格「拇指要往里靠拢」,TTX=lo,hi env 可调):
  // [38,50](中列边界)与 [44,64](贴纸带心)均被证不可达 —— 四指收中已把
  // 掌体拉向 B 侧(pos z ≈−130),拇指跨 225U+ 深度才够到 F,链长 288 无
  // 余量,且越往里甲面越翻离 F(与甲∥F 物理互斥),stage B 全 roll 丢面。
  // 现行 [48,68] + 甲权外调(NAILW)找平衡。
  const [ttxLo, ttxHi] = (process.env.TTX ?? '48,68').split(',').map(Number);
  L += 30 * (hinge(38 - cxA) ** 2 + hinge(cxA - (ttxHi + 8)) ** 2 + hinge(cyLo - t.cy) ** 2 + hinge(t.cy - cyHi) ** 2);
  const tipAx = Math.abs(t.tip.x);
  L += 40 * (hinge(ttxLo - tipAx) ** 2 + hinge(tipAx - ttxHi) ** 2);
  // 甲面∥F(硬规格,出平面通道解锁后应逼近 1)。MANO ×4:len2d 项在 MANO
  // 解剖长拇指上天然大,曾把这条硬规格压到只剩 ~16 的话语权(0.926 实测)。
  // MANO ×20:12000 档 stage C 停 0.961(len2d/gap 换分),60000 全解找到
  // twist 2.40 + mid 深出平面盆地 → 0.995,其余规格无一破(2026-07-11 实测)。
  L += Number(process.env.NAILW ?? 60000) * (1 - t.nailDotZ) ** 2;
  // 可见拇指(MCP→tip)水平硬墙(2026-07-11 用户规格「大拇指要水平」;
  // r3 曾斜插 40°)。9° 墙对齐四指 7.8/8.6 的余量哲学。generic 时代的
  // V 形折叠 / MCP 沉 D 约束均与「水平 + tip 居中」互斥,随内置手模退役。
  // r26(用户规格「指尖不动,MCP 往下降」):水平墙改带符号目标带 THORIZ
  // (lo,hi,单位度;正 = 指尖高于 MCP)。默认 '-9,9' = 旧水平规格口径;解题
  // 时给 '12,22' 级把 MCP 压到指尖下方。
  const [thLo, thHi] = (process.env.THORIZ ?? '-9,9').split(',').map(Number);
  L += 300 * (hinge(thLo - t.horizDeg) ** 2 + hinge(t.horizDeg - thHi) ** 2)
    + 1.5 * ((t.horizDeg - (thLo + thHi) / 2) / 9) ** 2;
  // len2d 软审美(「太长」直棍观感):200 按 generic 比例定;MANO 真实解剖
  // 拇指更长(CMC 真关节在腕上),200 不可达 → 265,免得软项吃掉硬规格。
  L += 0.5 * hinge(t.len2d - 265) ** 2;
  return L;
}

function totalLoss(mx: Metrics): number {
  return fourLoss(mx) + thumbLoss(mx);
}

/** 通用坐标下降:steps = 每参基础步长,schedule 收缩。 */
function descend(
  evalAt: (v: Params) => number, seed: Params, steps: number[],
  bounds: [number, number][], tag: string, quiet = false,
  compounds: { idx: number[]; d: number[] }[] = [],
): { s: Params; loss: number } {
  const s = [...seed];
  let best = evalAt(s);
  for (const scale of [1, 0.45, 0.2, 0.09, 0.04, 0.018]) {
    let improved = true;
    let rounds = 0;
    while (improved && rounds < 8) {
      improved = false;
      rounds++;
      for (let i = 0; i < s.length; i++) {
        const span = steps[i] * scale;
        if (span === 0) continue;
        for (const dir of [1, -1]) {
          const trial = [...s];
          trial[i] = Math.min(bounds[i][1], Math.max(bounds[i][0], s[i] + dir * span));
          if (trial[i] === s[i]) continue;
          const v = evalAt(trial);
          if (v < best - 1e-6) { best = v; s[i] = trial[i]; improved = true; }
        }
      }
      // 复合方向:单坐标步会被成对约束墙卡死(如根 −x 单走违反四指 tipx 带、
      // 加卷单走离面,联合走才可行),提供设计方向让下降能横穿窄谷。
      for (const c of compounds) {
        for (const dir of [1, -1]) {
          const trial = [...s];
          let moved = false;
          for (let k = 0; k < c.idx.length; k++) {
            const i = c.idx[k];
            trial[i] = Math.min(bounds[i][1], Math.max(bounds[i][0], s[i] + dir * c.d[k] * scale));
            if (trial[i] !== s[i]) moved = true;
          }
          if (!moved) continue;
          const v = evalAt(trial);
          if (v < best - 1e-6) {
            best = v;
            for (const i of c.idx) s[i] = trial[i];
            improved = true;
          }
        }
      }
    }
  }
  if (!quiet) console.log(`[${tag}] loss ${best.toFixed(2)} params ${JSON.stringify(s.map((x) => +x.toFixed(4)))}`);
  return { s, loss: best };
}

/** stage A 暖启动:每指 splay 牛顿迭代,把链端 y 拉回本行行心。 */
function warmStartSplay(p: Probe, base: HandPose, s: Params): void {
  for (let i = 0; i < FOUR.length; i++) {
    const name = FOUR[i];
    const target = name === 'pinky' ? -80 : rowY[name];
    for (let k = 0; k < 6; k++) {
      applyPose(p.m, buildPose(base, s));
      const y0 = jointWorld(p, chainBones[name][3]).y;
      const h = 0.04;
      const trial = [...s];
      trial[I_FOUR + i * 3 + 1] += h;
      applyPose(p.m, buildPose(base, trial));
      const y1 = jointWorld(p, chainBones[name][3]).y;
      const dY = (y1 - y0) / h;
      if (Math.abs(dY) < 1) break;
      const step = Math.max(-0.35, Math.min(0.35, (target - y0) / dY));
      s[I_FOUR + i * 3 + 1] = Math.max(-0.9, Math.min(0.9, s[I_FOUR + i * 3 + 1] + step));
      if (Math.abs(target - y0) < 4) break;
    }
  }
}

/** 接触点 → Speffz 贴纸判定(F 自 +z 看、B 自 −z 看;角=大写、棱=字母+e,
 *  面心不该出现)。世界 +x 在 B 面观察者系是左侧 —— vx 先换观察者右向。 */
function stickerOf(face: 'F' | 'B', cx: number, cy: number): string {
  const c = 32; // 棱块界(SIZE/2)
  const vx = face === 'F' ? cx : -cx;
  const row = cy > c ? 0 : cy < -c ? 2 : 1;
  const col = vx < -c ? 0 : vx > c ? 2 : 1;
  const corner = face === 'F' ? ['I', 'J', 'K', 'L'] : ['Q', 'R', 'S', 'T']; // 左上 右上 右下 左下
  const edge = face === 'F' ? ['Ie', 'Je', 'Ke', 'Le'] : ['Qe', 'Re', 'Se', 'Te']; // 上 右 下 左
  if (row === 0) return col === 0 ? corner[0] : col === 2 ? corner[1] : edge[0];
  if (row === 2) return col === 0 ? corner[3] : col === 2 ? corner[2] : edge[2];
  return col === 2 ? edge[1] : col === 0 ? edge[3] : `${face}心`;
}

/** 五指贴纸位(1 拇指..5 小指;悬空 = ∅)。 */
function gripSpeffz(mx: Metrics): string[] {
  const th = Number.isFinite(mx.thumb.fGap) && mx.thumb.fGap < 900
    ? stickerOf('F', mx.thumb.cx, mx.thumb.cy) : '∅';
  return [th, ...FOUR.map((n) => {
    const r = mx.fingers[n];
    return Number.isFinite(r.gapB) && r.gapB < 900 ? stickerOf('B', r.contactX, r.contactY) : '∅';
  })];
}

describe.skipIf(!MODE)('pose probe / solver', () => {
  it('run', async () => {
    const isL = MODE === 'PROBE_L' || MODE === 'L';
    const p = await makeProbe(isL ? 1 : -1);
    if (MODE === 'GRIP') {
      // 默认握贴纸位契约核对(FINGERTRICKS.md §1.1,2026-07-11 用户规格):
      // 改手(资产/HAND_SCALE/home 解/绑定层/姿态修正)后必跑:
      //   GRIP=1 pnpm --filter @cuberoot/client exec vitest run tests/_pose_probe.test.ts
      const pl = await makeProbe(1);
      applyPose(p.m, homeRight());
      applyPose(pl.m, homeLeft());
      const CONTRACT: Record<'R' | 'L', string[]> = {
        R: ['Je', 'Q', 'Te', 'T', '∅'],
        L: ['Le', 'R', 'Re', 'S', '∅'],
      };
      for (const [tag, probe] of [['R', p], ['L', pl]] as const) {
        const got = gripSpeffz(measure(probe));
        console.log(`GRIP ${tag} 实测 ${got.map((s, i) => `${tag}${i + 1}:${s}`).join(' ')} | 契约 ${CONTRACT[tag].map((s, i) => `${tag}${i + 1}:${s}`).join(' ')}`);
        expect(got, `${tag} 手默认握贴纸位(FINGERTRICKS.md §1.1)`).toEqual(CONTRACT[tag]);
      }
      return;
    }
    if (MODE === 'NAILK') {
      // 甲宽比例标定(换资产必重标,NAIL_HALFW_K 注释的方法):绑定姿态下
      // 每指末节甲域(t∈[0.4,1.15])背侧(h≥0)顶点横向偏移 |u−uC| 的 p90
      // ÷ 末节长 = K(背侧指尖满宽比)。打出来抄进 MANO_NAIL_HALFW_K。
      for (const name of FINGERS) {
        const [j1, j2, j3, j4] = chainBones[name];
        const q1 = jointWorld(p, j1), q2 = jointWorld(p, j2), q3 = jointWorld(p, j3), q4 = jointWorld(p, j4);
        const nf = nailFrame(q1, q2, q3, q4, name === 'thumb', p.m.side, MANO_THUMB_ROLL);
        const verts = skinnedVerts(p, (n) => n === j3 || n === j4);
        const us: number[] = [];
        let uw = 0, uh = 0;
        for (const v of verts) {
          const rel = v.clone().sub(q3);
          const t = rel.dot(nf.axis) / nf.len;
          const h = rel.dot(nf.dorsal);
          if (t < 0.4 || t > 1.15 || h < 0) continue;
          uw += h; uh += h * rel.dot(nf.lat);
        }
        const uC = uw > 1e-6 ? uh / uw : 0;
        for (const v of verts) {
          const rel = v.clone().sub(q3);
          const t = rel.dot(nf.axis) / nf.len;
          const h = rel.dot(nf.dorsal);
          if (t < 0.4 || t > 1.15 || h < 0) continue;
          us.push(Math.abs(rel.dot(nf.lat) - uC));
        }
        us.sort((a, b) => a - b);
        const p90 = us.length ? us[Math.min(us.length - 1, Math.floor(us.length * 0.9))] : NaN;
        console.log(`NAILK ${name.padEnd(6)} len ${nf.len.toFixed(1)} p90 ${p90.toFixed(1)} K ${(p90 / nf.len).toFixed(3)} (n=${us.length})`);
      }
      {
        // 拇指绑定滚转标定:扫 roll∈[0,2π),对每个候选量背侧窗(t∈[0.4,1.15],
        // h≥0)的横宽 p90 与高度均值 —— 甲床方向 = 宽/高比最大(甲板宽而平,
        // 指腹窄而鼓,侧棱两者皆小)。取分最高的抄进 MANO_THUMB_ROLL。
        const [j1, j2, j3, j4] = chainBones.thumb;
        const q1 = jointWorld(p, j1), q2 = jointWorld(p, j2), q3 = jointWorld(p, j3), q4 = jointWorld(p, j4);
        const verts = skinnedVerts(p, (n) => n === j3 || n === j4);
        const scores: { roll: number; w: number; h: number; score: number; n: number }[] = [];
        for (let roll = 0; roll < Math.PI * 2; roll += 0.05) {
          const nf = nailFrame(q1, q2, q3, q4, true, p.m.side, roll);
          const ws: number[] = [], hs: number[] = [];
          for (const v of verts) {
            const rel = v.clone().sub(q3);
            const t = rel.dot(nf.axis) / nf.len;
            const h = rel.dot(nf.dorsal);
            if (t < 0.4 || t > 1.15 || h < 0) continue;
            ws.push(Math.abs(rel.dot(nf.lat)));
            hs.push(h);
          }
          if (ws.length < 10) continue;
          ws.sort((a, b) => a - b);
          const w90 = ws[Math.floor(ws.length * 0.9)];
          const hM = hs.reduce((a, b) => a + b, 0) / hs.length;
          scores.push({ roll, w: w90, h: hM, score: w90 / Math.max(1e-6, hM), n: ws.length });
        }
        scores.sort((a, b) => b.score - a.score);
        for (const sc of scores.slice(0, 8)) {
          console.log(`THUMBROLL ${sc.roll.toFixed(2)} score ${sc.score.toFixed(2)} w90 ${sc.w.toFixed(1)} hMean ${sc.h.toFixed(1)} (n=${sc.n})`);
        }
      }
      expect(true).toBe(true);
      return;
    }
    if (MODE === 'SYM') {
      // 对称性二分诊断(SOLVE=SYM MODEL=mano)。转换器 @2 起 UV 图集重排顶点,
      // 左右索引不再对应 → 关节按名精确比 + 顶点最近邻抽样(1/7)。
      // ①绑定层:两腕同锚 WRIST_LOCAL ⇒ 手系里 L = R 关于 y=WRIST_LOCAL.y
      //   平面镜像;②摆姿层:世界系里 L = R 关于 x=0 镜像(homeLeft 已补腕锚
      //   常差项)。哪层先炸 = 不对称源。
      const pl = await makeProbe(1);
      const layer = (tag: string, mir: (v: THREE.Vector3) => THREE.Vector3): void => {
        let jWorst = 0, jName = '';
        for (const name of FINGERS.flatMap((fn) => chainBones[fn]).concat('wrist')) {
          const d = jointWorld(p, name).distanceTo(mir(jointWorld(pl, name)));
          if (d > jWorst) { jWorst = d; jName = name; }
        }
        const vr = skinnedVerts(p), vl = skinnedVerts(pl).map(mir);
        let nnWorst = 0;
        for (let i = 0; i < vr.length; i += 7) {
          let best = 1e9;
          for (const w of vl) { const d = vr[i].distanceToSquared(w); if (d < best) best = d; }
          nnWorst = Math.max(nnWorst, Math.sqrt(best));
        }
        console.log(`SYM ${tag}: joint max ${jWorst.toFixed(3)} @${jName} | vert NN max ${nnWorst.toFixed(3)}`);
      };
      const wly = WRIST_LOCAL.y;
      p.m.group.updateMatrixWorld(true);
      pl.m.group.updateMatrixWorld(true);
      layer('bind ', (v) => new THREE.Vector3(v.x, 2 * wly - v.y, v.z));
      applyPose(p.m, homeRight());
      applyPose(pl.m, homeLeft());
      layer('posed', (v) => new THREE.Vector3(-v.x, v.y, v.z));
      expect(true).toBe(true);
      return;
    }
    const base = isL ? homeLeft() : homeRight();
    applyPose(p.m, base);
    console.log(`=== ${isL ? 'L' : 'R'} mano 当前姿态(handPoses 现值) ===`);
    console.log(fmt(measure(p)));
    PIVOT.x *= isL ? -1 : 1; // 接触质心枢轴随手侧镜像
    if (process.env.SEED && (MODE === 'R' || MODE === 'L')) {
      // 直通抛光:SEED=<23 维 JSON 数组;MANO 33 维(尾 10 = dc2×4+dc3×4+
      // pitch/yaw)> 跳过 A/B,只跑 C(盆地稳定,免得全新 A/B 随权重微调跳去
      // 别的解构)。
      const seed = JSON.parse(process.env.SEED) as Params;
      if (process.env.DIAG) {
        // 指径标定核对:用户规则「单指宽 ≈ 0.9 棱块」(handModel.ts HAND_SCALE 注释,
        // 按 generic 资产标的 2.2)。量 MANO 资产在当前 HAND_SCALE 下的实际指径,
        // 给出按同规则的隐含 scale。
        for (const fn of ['index', 'middle', 'ring'] as FingerName[]) {
          const segs = chainSegs(p, fn);
          const ds = skinnedVerts(p, (n) => n.includes(`${fn}-finger-phalanx`) || n === chainBones[fn][3])
            .map((v) => Math.min(...segs.map(([a, b]) => segPointDist(a, b, v))));
          ds.sort((a, b) => a - b);
          const r = ds.length ? ds[Math.floor(ds.length * 0.5)] : 0;
          console.log(`FLESHRAD ${fn.padEnd(6)} p50 ${r.toFixed(2)} 2r/棱块 ${(2 * r / 64).toFixed(3)} 隐含scale ${(2.2 * 0.9 * 64 / (2 * r)).toFixed(2)}`);
        }
        // 滑入诊断:种子原地 vs 手根 −x 平移若干档,逐项打指标,找拒绝复合步的墙。
        for (const dx of [0, -3, -6, -12, -24]) {
          const trial = [...seed];
          trial[1] += dx;
          applyPose(p.m, buildPose(base, trial));
          const m = measure(p);
          console.log(`--- DIAG dx=${dx} totalLoss ${totalLoss(m).toFixed(1)} ---`);
          console.log(fmt(m));
        }
        expect(true).toBe(true);
        return;
      }
      if (process.env.SCAN) {
        // r25 诊断:SCAN=<idx>:<lo>:<hi>:<n> 沿单参数线扫,打 totalLoss + 分项
        // (找"row 想拉、谁在顶"的墙)。
        const [si, lo, hi, n] = process.env.SCAN.split(':').map(Number);
        for (let k = 0; k <= n; k++) {
          const trial = [...seed];
          trial[si] = lo + ((hi - lo) * k) / n;
          applyPose(p.m, buildPose(base, trial));
          const m = measure(p);
          const parts: Record<string, number> = {};
          fourLoss(m, parts);
          const top = Object.entries(parts).filter(([, v]) => v >= 20).sort((a, b) => b[1] - a[1])
            .map(([kk, v]) => `${kk} ${v.toFixed(0)}`).join(' | ');
          console.log(`SCAN s[${si}]=${trial[si].toFixed(3)} total ${totalLoss(m).toFixed(0)} thumb ${(totalLoss(m) - fourLoss(m)).toFixed(0)} :: ${top}`);
          console.log(`  idx cy ${m.fingers.index.contactY.toFixed(1)} mid cy ${m.fingers.middle.contactY.toFixed(1)} ring cy ${m.fingers.ring.contactY.toFixed(1)} ringGap ${m.fingers.ring.gapB.toFixed(2)} ringTilt ${m.fingers.ring.tiltDeg.toFixed(1)} pen ${m.pen.toFixed(2)} prClear ${m.pinkyRingClear.toFixed(2)}`);
          console.log(`  thumb MCP ${m.thumb.mcpY.toFixed(1)} cy ${m.thumb.cy.toFixed(1)} cx ${m.thumb.cx.toFixed(1)} fGap ${m.thumb.fGap.toFixed(2)} horiz ${m.thumb.horizDeg.toFixed(1)} nail ${m.thumb.nailDotZ.toFixed(3)}`);
        }
        expect(true).toBe(true);
        return;
      }
      const tail2 = 10;
      const spB2 = 1.35;
      const boundsA2: [number, number][] = [
        [-90, 90], [-50, 50], [-100, 45], [-55, 55],
        ...FOUR.flatMap((): [number, number][] => [[-0.9, 0.9], [-spB2, spB2], [-1.3, 1.3]]),
        ...THUMB_BOUNDS,
        ...(tail2 ? [...Array(8).fill([-0.9, 0.9]), [-30, 30], [-30, 30]] as [number, number][] : []),
      ];
      const gP = MODE === 'L' ? 0 : 1.2; // L 手根冻结(同 stage A/C 理由)
      const gPAng = MODE === 'L' ? 0 : 0.6;
      const stepsC2 = [gP, gP, gP, gP, ...FOUR.flatMap(() => [0.025, 0.025, 0.04]), 0.04, 0.04, 0.04, 0.05, 0.06, 0.05, 0.05,
        ...(tail2 ? [...Array(8).fill(0.02), gPAng, gPAng] : [])];
      // FREEZE=逗号分隔参数下标,钉死不动(r13 教训:根 x 自由时下降偷懒外移
      // 根修四指,把拇指甩出可达域;冻 dx 逼四指走加卷路线)。
      const frozen = new Set((process.env.FREEZE ?? '').split(',').filter(Boolean).map(Number));
      for (const fi of frozen) stepsC2[fi] = 0;
      // r24(用户规格「食/中/无名弯曲程度要小」):CURLW>0 时直接罚三指
      // MCP+PIP 绝对弯曲平方 —— 带内自由度全部花在"更直"上,而不是停在
      // 带边任意点(r22/r23 只动了掌角,关节弯曲基本没变,用户抓的)。
      const curlW = Number(process.env.CURLW ?? 0);
      const evalC2 = (v: Params): number => {
        applyPose(p.m, buildPose(base, v));
        let L = totalLoss(measure(p, { fast: true }));
        if (curlW) {
          for (let i = 0; i < 3; i++) {
            const b = base.fingers[FOUR[i]];
            L += curlW * ((b.curl[0] + v[4 + i * 3]) ** 2 + (b.curl[1] + (v[23 + i] ?? 0)) ** 2);
          }
        }
        return L;
      };
      // 复合方向:整手根沿手内方向平移 + 四指补卷(dc1 或 dc2)保 tip 不出带。
      // κ 三档括住"1.2U 平移 ≈ 多少补卷"的未知雅可比,singles 事后清残差。
      const compounds = (MODE === 'L' ? [] : [
        ...[0.008, 0.016, 0.032].map((k) => ({ idx: [1, 4, 7, 10, 13], d: [-1.2, k, k, k, k] })),
        { idx: [1, 23, 24, 25, 26], d: [-1.2, 0.02, 0.02, 0.02, 0.02] },
        // r22(用户机理「MCP 弯少一点」):手根沿 CW26 手轴外移 (+cos26,0,+sin26)
        // + 四指 dc2 **加勾**补偿(近节平伸、远节扣面 —— 探针实测 dc1 伸直的
        // 雅可比把尖甩更远,不能钉尖;钉尖靠 PIP 加深)。dc1 变体只管观感直化。
        // ⚠ t∈[7,20] 平台:拇指肉跨中线时 |x|min 恒 ≈0 无梯度,种子必须跳过。
        ...[0.008, 0.016, 0.032].map((k) => ({ idx: [1, 3, 23, 24, 25, 26], d: [1.08, 0.53, k, k, k, k] })),
        { idx: [1, 3, 4, 7, 10, 13], d: [1.08, 0.53, -0.02, -0.02, -0.02, -0.02] },
        // r25(用户规格「指中线对齐块中线」):splay 摆是沿锥面的 —— 上摆压肉
        // 进面(pen 6.2 线扫实证)、下摆脱面(lost),必须配 curl 收放走「贴面
        // 等高线」。每指 (splay, dc1, dc2) 三档 κ + (splay, dc3) 变体,双向自动。
        ...[0, 1, 2].flatMap((i) => [0.012, 0.025, 0.05].map((k) => (
          { idx: [5 + 3 * i, 4 + 3 * i, 23 + i], d: [0.05, -k, -k] }))),
        ...[0, 1, 2].map((i) => ({ idx: [5 + 3 * i, 27 + i], d: [0.05, -0.03] })),
      ]).filter((c) => !c.idx.some((i) => frozen.has(i))); // 冻结下标的复合步一并禁(r14 曾绕过)
      const fin = descend(evalC2, seed, stepsC2, boundsA2, 'POLISH', false, compounds);
      applyPose(p.m, buildPose(base, fin.s));
      console.log(fmt(measure(p)));
      console.log('BAKE s', JSON.stringify(fin.s.map((x) => +x.toFixed(4))));
      const pose = buildPose(base, fin.s);
      console.log('BAKE pos', pose.pos.toArray().map((x) => +x.toFixed(2)));
      console.log('BAKE quat', pose.quat.toArray().map((x) => +x.toFixed(6)));
      console.log('BAKE roll(deg)', fin.s[0]);
      for (const name of FINGERS) {
        const f = pose.fingers[name];
        console.log(`BAKE ${name}`, JSON.stringify({
          curl: f.curl.map((x) => +x.toFixed(4)), splay: +f.splay.toFixed(4),
          twist: +(f.twist ?? 0).toFixed(4),
          ...(f.mid ? { mid: f.mid.map((x) => +x.toFixed(4)) } : {}),
        }));
      }
      expect(true).toBe(true);
      return;
    }
    if (MODE === 'R' || MODE === 'L') {
      // ---- stage A:roll 网格 × 四指恢复(pen 不含拇指,免得失效拇指姿污染) ----
      // L 手 base 已含 R 解烘焙的 roll(homeLeft 镜像),只解 0 档微调。
      // MANO R:解锁 pitch/yaw 后盆地在 roll≈0(深 roll 全档食指丢接触实测),
      // 网格改细扫 0 附近。
      const ROLLS = MODE === 'L' ? [0] : [8, 4, 0, -4];
      // L 手全程冻结手根(dy/dz 也冻):pos/quat 必须保持 homeLeft 严格镜像,
      // 不对称只由指参吸收(stage A 曾拿 dy+23 换倾角,拇指被拖垮且烘不进偏移表)。
      const gA = MODE === 'L' ? 0 : 4;
      // MANO 尾部 10 维:dc2×4 + dc3×4(23..30)+ 全局 pitch/yaw 度(31/32)
      const manoTail = 10;
      const gAng = MODE === 'L' ? 0 : 2; // pitch/yaw 也属手根,L 冻结保镜像
      const gDx = MODE === 'L' ? 0 : 3; // 解冻 dx(L 冻结手根保镜像)
      const stepsA = [0, gDx, gA, gA, ...FOUR.flatMap(() => [0.07, 0.07, 0.12]), 0, 0, 0, 0, 0, 0, 0,
        ...(manoTail ? [...Array(8).fill(0.06), gAng, gAng] : [])];
      // MANO dsplay 放宽 ±1.35:真实手指根横距 < 三行贴纸跨距,行对齐更吃 splay
      const spB = 1.35;
      const boundsA: [number, number][] = [
        [-90, 90], [-50, 50], [-100, 45], [-55, 55],
        ...FOUR.flatMap((): [number, number][] => [[-0.9, 0.9], [-spB, spB], [-1.3, 1.3]]),
        ...THUMB_BOUNDS,
        ...(manoTail ? [...Array(8).fill([-0.9, 0.9]), [-30, 30], [-30, 30]] as [number, number][] : []),
      ];
      const evalA = (v: Params): number => {
        applyPose(p.m, buildPose(base, v));
        return fourLoss(measure(p, { penScope: 'noThumb', skipNail: true, fast: true }));
      };
      type Cand = { s: Params; lossA: number; lossB?: number; mx?: Metrics };
      const cands: Cand[] = [];
      for (const roll of ROLLS) {
        const s: Params = [roll, 0, 0, 0, ...Array(12).fill(0), 0.2, 0.35, 0.3, 0.6, 0, 0, 0,
          ...Array(manoTail).fill(0)];
        warmStartSplay(p, base, s);
        let r = descend(evalA, s, stepsA, boundsA, `A roll=${roll}`, true);
        {
          // 多起点抖动重启:33 维坐标下降易停浅盆(dsp/py 实测远离界仍卡),
          // 从当前优点加扰动再降,取最优(扰动幅度≈各通道步长 2~3 倍)。
          for (let k = 0; k < 5; k++) {
            const jit = r.s.map((v, j) => {
              const st = stepsA[j];
              if (!st) return v;
              const lo = boundsA[j][0], hi = boundsA[j][1];
              return Math.min(hi, Math.max(lo, v + (Math.random() * 2 - 1) * st * 2.5));
            });
            const r2 = descend(evalA, jit, stepsA, boundsA, `A${k} roll=${roll}`, true);
            if (r2.loss < r.loss) r = r2;
          }
        }
        applyPose(p.m, buildPose(base, r.s));
        const amx = measure(p, { penScope: 'noThumb', skipNail: true });
        const parts: Record<string, number> = {};
        fourLoss(amx, parts);
        console.log(`[A roll=${roll}] fourLoss ${r.loss.toFixed(2)} | pen ${amx.pen.toFixed(2)} cmcY ${amx.thumb.cmcY.toFixed(1)} dy ${r.s[2].toFixed(1)} dz ${r.s[3].toFixed(1)} | ${FOUR.map((n) => { const g = amx.fingers[n]; return `${n[0]}:t${g.tiltDeg.toFixed(0)}° g${Number.isFinite(g.gapB) && g.gapB < 900 ? g.gapB.toFixed(1) : '—'}`; }).join(' ')}`);
        console.log(`    breakdown: ${Object.entries(parts).filter(([, v]) => v >= 50).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | ')} || dsp ${FOUR.map((_, i) => r.s[5 + i * 3].toFixed(2)).join('/')} py ${(r.s[31] ?? 0).toFixed(1)}/${(r.s[32] ?? 0).toFixed(1)}`);
        cands.push({ s: r.s, lossA: r.loss });
      }
      // ---- stage B:可行 roll 档上单解拇指(手根/四指冻结) ----
      // 结构化瞄准种子:冷种子从 bind 对掌位过不了「丢接触高罚区」到「掌骨
      // 指向下方」的基(21 维首役 + 冷种子 stage B 实测 MCP 卡 29~33)。
      // (a) 纯关节位置(免蒙皮,快)最小二乘:(c1,splay) 把 MCP 钉到 D 层下
      //     目标网格点;(b) (c2,c3) 把 thumb-tip 拉到 F 贴纸带心;(c) 全 5 参精解。
      const mxf = isL ? -1 : 1; // 目标点 x 随手侧镜像
      // r6:拇指尖居中(y≈0)+ 水平 ⇒ MCP 也在 ±17 内;网格铺中带
      const mcpTargets = [
        new THREE.Vector3(58 * mxf, -6, 50), new THREE.Vector3(48 * mxf, 4, 58), new THREE.Vector3(65 * mxf, -14, 62),
      ];
      // twist('YZX' 序 = 真轴向旋前)网格铺满 ±3:「从下向上折的 V」在 MCP 处
      // 要 ~150° 反折,c2 界内做不到 —— 可行解构 = twist 把弯曲平面旋转半圈,
      // 让 c2+c3 正向弯度(≤137°)变成向上折。
      const twistGrid = [-3, -2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25, 3];
      // 水平拇指 tip 落竖直正中、贴纸带心(r6 y≈0 / r8 x≈56)
      const tipTarget = new THREE.Vector3(56 * mxf, 0, HALF + 3);
      const stepsB = [0.1, 0.1, 0.1, 0.12, 0.15, 0.12, 0.12];
      const boundsB: [number, number][] = [...THUMB_BOUNDS];
      const aimSeed = (cFull: Params, mcpT: THREE.Vector3, tw: number): number[] => {
        const jointsAt = (tv: number[]): { mcp: THREE.Vector3; tip: THREE.Vector3 } => {
          const full = [...cFull];
          full.splice(I_THUMB, 7, ...tv);
          applyPose(p.m, buildPose(base, full));
          return { mcp: jointWorld(p, 'thumb-phalanx-proximal'), tip: jointWorld(p, 'thumb-tip') };
        };
        const seed = [0.3, 0.35, 0.3, 0.8, tw, 0, 0];
        // (a) c1/splay 对 MCP 瞄准
        const rA = descend((v) => {
          const j = jointsAt([v[0], seed[1], seed[2], v[1], tw, 0, 0]);
          return j.mcp.distanceToSquared(mcpT);
        }, [seed[0], seed[3]], [0.25, 0.25], [boundsB[0], boundsB[3]], '', true);
        seed[0] = rA.s[0]; seed[3] = rA.s[1];
        // (b) c2/c3 + MCP 出平面 splay 对 tip 瞄准(3 参:共面链够不到时靠出平面)
        const rB = descend((v) => {
          const j = jointsAt([seed[0], v[0], v[1], seed[3], tw, 0, v[2]]);
          return j.tip.distanceToSquared(tipTarget);
        }, [seed[1], seed[2], 0], [0.2, 0.2, 0.2], [boundsB[1], boundsB[2], boundsB[6]], '', true);
        seed[1] = rB.s[0]; seed[2] = rB.s[1]; seed[6] = rB.s[2];
        return seed;
      };
      // MANO 闸门放宽:A 优点普遍停在几百量级的浅盆(非可行域问题),
      // 让 stage C 全维联合抛光收尾;default 保持 80 严闸。
      const gateB = 800;
      for (const c of cands) {
        if (c.lossA > gateB) { console.log(`[B] skip roll=${c.s[0]}(A 不可行 ${c.lossA.toFixed(1)})`); continue; }
        let bestT: { s: Params; loss: number } | null = null;
        for (const mcpT of mcpTargets) {
          for (const tw of twistGrid) {
            const seed = aimSeed(c.s, mcpT, tw);
            const evalB = (v: Params): number => {
              const full = [...c.s];
              full.splice(I_THUMB, 7, ...v);
              applyPose(p.m, buildPose(base, full));
              return thumbLoss(measure(p, { penScope: 'thumbOnly', fast: true }));
            };
            const r = descend(evalB, seed, stepsB, boundsB, '', true);
            if (!bestT || r.loss < bestT.loss) bestT = r;
          }
        }
        c.s.splice(I_THUMB, 7, ...bestT!.s);
        c.lossB = bestT!.loss;
        applyPose(p.m, buildPose(base, c.s));
        c.mx = measure(p);
        const t = c.mx.thumb;
        console.log(`[B roll=${c.s[0]}] thumbLoss ${c.lossB.toFixed(2)} CMC ${t.cmcY.toFixed(1)} MCP ${t.mcpY.toFixed(1)} nail ${t.nailDotZ.toFixed(3)} fGap ${Number.isFinite(t.fGap) && t.fGap < 900 ? t.fGap.toFixed(2) : '—'} len ${t.len2d.toFixed(0)}`);
      }
      // ---- stage C:总分最优档全 21 维小步抛光 ----
      const ranked = cands.filter((c) => c.lossB !== undefined)
        .sort((a, b) => (a.lossA + a.lossB!) - (b.lossA + b.lossB!));
      if (!ranked.length) throw new Error('no feasible candidate');
      const inc = ranked[0];
      console.log(`=== stage C 起点 roll=${inc.s[0]} A ${inc.lossA.toFixed(1)} B ${inc.lossB!.toFixed(1)} ===`);
      // L 手冻结手根 4 参:pos/quat 保持 homeLeft 的严格镜像(镜像资产 ~2U 雕刻
      // 不对称全部由指参吸收),否则烘焙进不了 LEFT_CURL_OFFSET。
      const gStep = MODE === 'L' ? 0 : 1.5;
      const gStepAng = MODE === 'L' ? 0 : 0.8;
      const stepsC = [gStep, gStep, gStep, gStep, ...FOUR.flatMap(() => [0.03, 0.03, 0.05]), 0.05, 0.05, 0.05, 0.06, 0.08, 0.06, 0.06,
        ...(manoTail ? [...Array(8).fill(0.025), gStepAng, gStepAng] : [])];
      const evalC = (v: Params): number => {
        applyPose(p.m, buildPose(base, v));
        return totalLoss(measure(p, { fast: true }));
      };
      const fin = descend(evalC, inc.s, stepsC, boundsA, 'C');
      applyPose(p.m, buildPose(base, fin.s));
      const mx = measure(p);
      console.log(fmt(mx));
      console.log('BAKE s', JSON.stringify(fin.s.map((x) => +x.toFixed(4))));
      // 烘焙用绝对值输出
      const pose = buildPose(base, fin.s);
      console.log('BAKE pos', pose.pos.toArray().map((x) => +x.toFixed(2)));
      console.log('BAKE quat', pose.quat.toArray().map((x) => +x.toFixed(6)));
      console.log('BAKE roll(deg)', fin.s[0]);
      for (const name of FINGERS) {
        const f = pose.fingers[name];
        console.log(`BAKE ${name}`, JSON.stringify({
          curl: f.curl.map((x) => +x.toFixed(4)), splay: +f.splay.toFixed(4),
          twist: +(f.twist ?? 0).toFixed(4),
          ...(f.mid ? { mid: f.mid.map((x) => +x.toFixed(4)) } : {}),
        }));
      }
    }
    expect(true).toBe(true);
  }, 1e7);
});
