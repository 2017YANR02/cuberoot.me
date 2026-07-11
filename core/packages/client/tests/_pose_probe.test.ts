/**
 * /sim home 握姿 Node 蒙皮探针 + 坐标下降求解器(r11 全关节解锁版)。
 * 默认(无 env)skip —— CI 零成本;用法:
 *   PROBE=1  只测量当前 handPoses 姿态的全部指标(锚点复现/回归)
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
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { adaptGltfHand, nailFrame } from '@/app/[lang]/sim/engine/hands/handModelGltf';
import { buildManoHand, MANO_THUMB_ROLL, type ManoHandData } from '@/app/[lang]/sim/engine/hands/handModelMano';
import type { HandModel, FingerName } from '@/app/[lang]/sim/engine/hands/handModel';
import { homeRight, homeLeft, quatFromWorldRots, type HandPose, type FingerCurl, type HandModelKind } from '@/app/[lang]/sim/engine/hands/handPoses';

const MODE = process.env.SOLVE ?? (process.env.PROBE ? 'PROBE' : process.env.MEASURE_NAILK ? 'NAILK' : '');
/** MODEL=mano → 加载 scripts/convert-mano.py 的转换资产,解 MANO 版 home;
 *  缺省 = 内置 generic-hand。MANO 版比 default 多一条硬规格:真 CMC 沉 D 层
 *  (cmcY ≤ −30,含 1.5U 余量;generic 上 r11 已证不可行,MANO 是下一个上限)。 */
const MODEL: HandModelKind = process.env.MODEL === 'mano' ? 'mano' : 'default';
const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const HALF = 96; // 魔方半宽(SIZE=64,棱长 192)

async function loadModel(file: 'right.glb' | 'left.glb', side: 1 | -1): Promise<HandModel> {
  if (MODEL === 'mano') {
    const name = side === -1 ? 'right' : 'left';
    const p = fileURLToPath(new URL(`../public/sim/hands/mano/${name}.mano.json`, import.meta.url));
    const data = JSON.parse(await readFile(p, 'utf8')) as ManoHandData;
    return buildManoHand(data, side, new THREE.MeshStandardMaterial(), `${name}.mano.json`);
  }
  const p = fileURLToPath(new URL(`../public/sim/hands/${file}`, import.meta.url));
  const buf = await readFile(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    new GLTFLoader().parse(ab, '', resolve, reject);
  });
  return adaptGltfHand(gltf.scene, side, new THREE.MeshStandardMaterial(), file);
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
}

type Probe = {
  m: HandModel;
  mesh: THREE.SkinnedMesh;
  dom: string[]; // 每顶点主导骨名
  sec: string[]; // 次权重骨名(>0.15)
  nailThumb: THREE.Mesh;
};

async function makeProbe(file: 'right.glb' | 'left.glb', side: 1 | -1): Promise<Probe> {
  const m = await loadModel(file, side);
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
  return { m, mesh, dom, sec, nailThumb };
}

const _v = new THREE.Vector3();
/** 全蒙皮顶点世界坐标(posed)。filter 按主导骨名。 */
function skinnedVerts(p: Probe, match?: (domName: string) => boolean): THREE.Vector3[] {
  const geo = p.mesh.geometry;
  const pos = geo.getAttribute('position');
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
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
  fingers: Record<string, { tiltDeg: number; gapB: number; contactY: number; contactX: number; dorsalY: number; tip: THREE.Vector3 }>;
  thumb: {
    fGap: number; cx: number; cy: number; minAbsX: number;
    nailDotZ: number; cmcY: number; mcpY: number; fleshMinY: number; fleshMaxY: number;
    len2d: number; // 拇指链 CMC→tip 直线距(视觉长度 proxy,防拉直读长)
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

function measure(p: Probe, opts?: { penScope?: 'all' | 'noThumb' | 'thumbOnly'; skipNail?: boolean }): Metrics {
  const scope = opts?.penScope ?? 'all';
  // 穿模(蒙皮肉 + 拇指甲片;分阶段求解时可只看局部)
  let pen = -1e9;
  const all = skinnedVerts(p, scope === 'all' ? undefined
    : scope === 'noThumb' ? (n): boolean => !n.startsWith('thumb')
    : (n): boolean => n.startsWith('thumb'));
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
  for (const name of FOUR) {
    const [j1, , , j4] = chainBones[name];
    const a = jointWorld(p, j1);
    const b = jointWorld(p, j4);
    const d = b.clone().sub(a);
    const tiltDeg = (Math.atan2(Math.abs(d.y), Math.hypot(d.x, d.z)) * 180) / Math.PI;
    // 指腹对 B 面贴面:该指主导顶点里 z ≤ -HALF 侧最靠面的
    const verts = skinnedVerts(p, (n) => n.includes(`${name === 'index' ? 'index' : name === 'middle' ? 'middle' : name === 'ring' ? 'ring' : 'pinky'}-finger-phalanx`) || n === chainBones[name][3]);
    let gapB = 1e9, cy = 0, cx = 0, cn = 0;
    const inB = (v: THREE.Vector3): boolean => v.z <= -HALF && Math.abs(v.x) <= HALF && Math.abs(v.y) <= HALF;
    for (const v of verts) {
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
  const tv = skinnedVerts(p, (n) => n.startsWith('thumb'));
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
  return {
    pen,
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
      tip: ttip.clone(),
    },
  };
}

function fmt(mx: Metrics): string {
  const f = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '—');
  const rows = FOUR.map((k) => {
    const r = mx.fingers[k];
    return `${k.padEnd(6)} tilt ${f(r.tiltDeg)}° gapB ${f(r.gapB, 2)} contact (${f(r.contactX)},${f(r.contactY)}) dorsalY ${f(r.dorsalY, 2)}`;
  });
  const t = mx.thumb;
  return [
    `pen ${f(mx.pen, 2)}`,
    ...rows,
    `thumb fGap ${f(t.fGap, 2)} contact (${f(t.cx)},${f(t.cy)}) |x|min ${f(t.minAbsX)} nail·ẑ ${f(t.nailDotZ, 3)}`,
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
  const roll = quatFromWorldRots([['z', rollDeg]]);
  const pos = base.pos.clone().sub(PIVOT).applyQuaternion(roll).add(PIVOT)
    .add(new THREE.Vector3(dx, dy, dz));
  const quat = roll.clone().multiply(base.quat);
  const fingers = {} as Record<FingerName, FingerCurl>;
  const four = FOUR;
  four.forEach((name, i) => {
    const b = base.fingers[name];
    fingers[name] = {
      curl: [b.curl[0] + s[4 + i * 3], b.curl[1], b.curl[2]],
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
const rowY: Record<string, number> = { index: 64, middle: 0, ring: -64 };
// r6 被认可姿态的 dorsalY 实测锚点 —— 指背在该握里朝外侧平伸,twist 的职责是
// 整手 roll 后把指背转回这个朝向,不是「朝上」。
const dorsalAnchor: Record<string, number> = { index: -0.02, middle: -0.06, ring: -0.14, pinky: -0.18 };

/** 四指 + 手根部分(stage A;pen 不含拇指)。 */
function fourLoss(mx: Metrics): number {
  // 静置余量 ≥1.2U:待机呼吸 x ±1.76 / y ±0.88(home),贴 0 的裸间隙会被
  // 周期性吃穿(L 首解 pen −0.79 抓的)。
  let L = 1e4 * hinge(mx.pen) ** 2 + 5 * hinge(mx.pen + 1.2) ** 2;
  // MANO 版新增硬规格:真 CMC(thumb-metacarpal 关节)沉 D 层(y ≤ −30,
  // 规格界 −28.5 留 1.5U 余量)。CMC 位置只由手根位姿决定(关节自转不移位),
  // 放 stage A/C 的全局参数才有梯度 —— stage B 冻结手根,放 thumbLoss 无用。
  if (MODEL === 'mano') L += 60 * hinge(mx.thumb.cmcY + 30) ** 2;
  for (const name of FOUR) {
    const r = mx.fingers[name];
    // 倾角:硬墙提前到 7.8°(规格 8.6°,r10 终解曾全贴 8.6 上限 —— 四指水平
    // 是用户两次重申的硬规格,贴线冒险)+ 常开二次项加重。
    // 小指豁免:用户水平规格只点名食/中/无名;7.8° 墙曾把小指拍平(r6 蜷姿
    // 8.3°),小指被推平后前伸横穿 D 面底下(截图抓的)—— 改宽墙 25° + 强制
    // 收拢在后半区(tip z ≤ −40,别探进 D 扫掠柱/画面底部)。
    if (name === 'pinky') {
      L += 200 * hinge(r.tiltDeg - 25) ** 2;
      L += 6 * hinge(r.tip.z + 40) ** 2;
    } else {
      L += 200 * hinge(r.tiltDeg - 7.8) ** 2 + 2.5 * (r.tiltDeg / 8) ** 2;
    }
    L += 120 * hinge(Math.abs(r.dorsalY - dorsalAnchor[name]) - 0.15) ** 2 + 2 * (r.dorsalY - dorsalAnchor[name]) ** 2;
    if (name !== 'pinky') {
      if (!Number.isFinite(r.gapB) || r.gapB > 900) {
        const d = r.tip.distanceTo(new THREE.Vector3(85, rowY[name], -HALF - 3));
        L += 3e3 + 2 * d * d; // 丢接触:指尖拉向本行目标点(平坦罚无梯度)
        continue;
      }
      L += 60 * (hinge(2.4 - r.gapB) ** 2 + hinge(r.gapB - 3.4) ** 2) + 0.8 * (r.gapB - 2.9) ** 2;
      // 行带硬约束(±24 内)+ 弱行心拉:stage C 曾拿行心弱罚换拇指分,把食指
      // 接触漂到 y=31(越界进中排)—— 行带必须是硬墙。
      const dyRow = Math.abs(r.contactY - rowY[name]);
      L += 25 * hinge(dyRow - 24) ** 2 + 1.2 * (dyRow / 10) ** 2;
    } else if (Number.isFinite(r.gapB) && r.gapB < 900) {
      L += 60 * hinge(2.0 - r.gapB) ** 2; // 小指不需接触,但别蹭面
    }
  }
  return L;
}

/** 拇指部分(stage B;pen 只含拇指肉 + 甲片)。 */
function thumbLoss(mx: Metrics): number {
  let L = 1e4 * hinge(mx.pen) ** 2 + 5 * hinge(mx.pen + 1.2) ** 2;
  const t = mx.thumb;
  L += 100 * hinge(34.5 - t.minAbsX) ** 2; // M 列安全(硬)
  if (!Number.isFinite(t.fGap) || t.fGap > 900) {
    const d = t.tip.distanceTo(new THREE.Vector3(60, -8, HALF + 3)); // FR 贴纸带心软拉
    return L + 3e3 + 2 * d * d;
  }
  L += 60 * (hinge(2.4 - t.fGap) ** 2 + hinge(t.fGap - 3.4) ** 2);
  // 接触心硬带:必须留在 FR/FL 贴纸内(|x|∈[38,90], y∈[-28,28])—— stage C
  // 曾拿 0.2 弱罚换 MCP 分,把接触心漂到 (96,-47) 角块区。L 手 x 为负,取绝对值。
  const cxA = Math.abs(t.cx);
  L += 30 * (hinge(38 - cxA) ** 2 + hinge(cxA - 90) ** 2 + hinge(-28 - t.cy) ** 2 + hinge(t.cy - 28) ** 2);
  L += 3000 * (1 - t.nailDotZ) ** 2;      // 甲面∥F(硬规格,出平面通道解锁后应逼近 1)
  L += 6 * hinge(t.mcpY + 34) ** 2 + 0.04 * (t.mcpY + 40) ** 2; // 可见拇指根(MCP)沉 D 层以下(带余量)
  // V 形折叠(用户「太长」= 直棍下探观感):tip 要折回 MCP 之上 + 链距压短
  L += 4 * hinge(t.mcpY + 10 - t.tip.y) ** 2;
  L += 0.5 * hinge(t.len2d - 200) ** 2;
  return L;
}

function totalLoss(mx: Metrics): number {
  return fourLoss(mx) + thumbLoss(mx);
}

/** 通用坐标下降:steps = 每参基础步长,schedule 收缩。 */
function descend(
  evalAt: (v: Params) => number, seed: Params, steps: number[],
  bounds: [number, number][], tag: string, quiet = false,
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

describe.skipIf(!MODE)('pose probe / solver', () => {
  it('run', async () => {
    const isL = MODE === 'PROBE_L' || MODE === 'L';
    const p = await makeProbe(isL ? 'left.glb' : 'right.glb', isL ? 1 : -1);
    if (MODE === 'NAILK') {
      // 甲宽比例标定(换资产必重标,NAIL_HALFW_K 注释的方法):绑定姿态下
      // 每指末节甲域(t∈[0.4,1.15])背侧(h≥0)顶点横向偏移 |u−uC| 的 p90
      // ÷ 末节长 = K(背侧指尖满宽比)。打出来抄进 MANO_NAIL_HALFW_K。
      for (const name of FINGERS) {
        const [j1, j2, j3, j4] = chainBones[name];
        const q1 = jointWorld(p, j1), q2 = jointWorld(p, j2), q3 = jointWorld(p, j3), q4 = jointWorld(p, j4);
        const nf = nailFrame(q1, q2, q3, q4, name === 'thumb', p.m.side, MODEL === 'mano' ? MANO_THUMB_ROLL : undefined);
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
      expect(true).toBe(true);
      return;
    }
    const base = isL ? homeLeft(MODEL) : homeRight(MODEL);
    applyPose(p.m, base);
    console.log(`=== ${isL ? 'L' : 'R'} ${MODEL} 当前姿态(handPoses 现值) ===`);
    console.log(fmt(measure(p)));
    PIVOT.x *= isL ? -1 : 1; // 接触质心枢轴随手侧镜像
    if (process.env.SEED && (MODE === 'R' || MODE === 'L')) {
      // 直通抛光:SEED=<23 维 JSON 数组> 跳过 A/B,只跑 C(盆地稳定,免得
      // 全新 A/B 随权重微调跳去别的解构)。
      const seed = JSON.parse(process.env.SEED) as Params;
      const boundsA2: [number, number][] = [
        [-90, 90], [-50, 50], [-100, 45], [-55, 55],
        ...FOUR.flatMap((): [number, number][] => [[-0.9, 0.9], [-0.9, 0.9], [-1.3, 1.3]]),
        [-1.7, 1.8], [-0.6, 1.2], [-0.3, 1.3], [-0.6, 2.0], [-3.3, 3.3], [-2.2, 2.2], [-1.2, 1.2],
      ];
      const gP = MODE === 'L' ? 0 : 1.2; // L 手根冻结(同 stage A/C 理由)
      const stepsC2 = [gP, gP, gP, gP, ...FOUR.flatMap(() => [0.025, 0.025, 0.04]), 0.04, 0.04, 0.04, 0.05, 0.06, 0.05, 0.05];
      const evalC2 = (v: Params): number => {
        applyPose(p.m, buildPose(base, v));
        return totalLoss(measure(p));
      };
      const fin = descend(evalC2, seed, stepsC2, boundsA2, 'POLISH');
      applyPose(p.m, buildPose(base, fin.s));
      console.log(fmt(measure(p)));
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
      // MANO R:CMC 沉 D 是硬约束,可行域未知 → roll 网格铺得更深更密。
      const ROLLS = MODE === 'L' ? [0]
        : MODEL === 'mano' ? [0, -12, -20, -28, -36, -44, -52, -60, -68, -76]
        : [0, -12, -20, -28, -36, -44, -52];
      // L 手全程冻结手根(dy/dz 也冻):pos/quat 必须保持 homeLeft 严格镜像,
      // 不对称只由指参吸收(stage A 曾拿 dy+23 换倾角,拇指被拖垮且烘不进偏移表)。
      const gA = MODE === 'L' ? 0 : 4;
      const stepsA = [0, 0, gA, gA, ...FOUR.flatMap(() => [0.07, 0.07, 0.12]), 0, 0, 0, 0, 0, 0, 0];
      const boundsA: [number, number][] = [
        [-90, 90], [-50, 50], [-100, 45], [-55, 55],
        ...FOUR.flatMap((): [number, number][] => [[-0.9, 0.9], [-0.9, 0.9], [-1.3, 1.3]]),
        [-1.7, 1.8], [-0.6, 1.2], [-0.3, 1.3], [-0.6, 2.0], [-3.3, 3.3], [-2.2, 2.2], [-1.2, 1.2],
      ];
      const evalA = (v: Params): number => {
        applyPose(p.m, buildPose(base, v));
        return fourLoss(measure(p, { penScope: 'noThumb', skipNail: true }));
      };
      type Cand = { s: Params; lossA: number; lossB?: number; mx?: Metrics };
      const cands: Cand[] = [];
      for (const roll of ROLLS) {
        const s: Params = [roll, 0, 0, 0, ...Array(12).fill(0), 0.2, 0.35, 0.3, 0.6, 0, 0, 0];
        warmStartSplay(p, base, s);
        const r = descend(evalA, s, stepsA, boundsA, `A roll=${roll}`, true);
        console.log(`[A roll=${roll}] fourLoss ${r.loss.toFixed(2)}`);
        cands.push({ s: r.s, lossA: r.loss });
      }
      // ---- stage B:可行 roll 档上单解拇指(手根/四指冻结) ----
      // 结构化瞄准种子:冷种子从 bind 对掌位过不了「丢接触高罚区」到「掌骨
      // 指向下方」的基(21 维首役 + 冷种子 stage B 实测 MCP 卡 29~33)。
      // (a) 纯关节位置(免蒙皮,快)最小二乘:(c1,splay) 把 MCP 钉到 D 层下
      //     目标网格点;(b) (c2,c3) 把 thumb-tip 拉到 F 贴纸带心;(c) 全 5 参精解。
      const mxf = isL ? -1 : 1; // 目标点 x 随手侧镜像
      const mcpTargets = [
        new THREE.Vector3(58 * mxf, -42, 50), new THREE.Vector3(48 * mxf, -52, 58), new THREE.Vector3(65 * mxf, -38, 62),
      ];
      // twist('YZX' 序 = 真轴向旋前)网格铺满 ±3:「从下向上折的 V」在 MCP 处
      // 要 ~150° 反折,c2 界内做不到 —— 可行解构 = twist 把弯曲平面旋转半圈,
      // 让 c2+c3 正向弯度(≤137°)变成向上折。
      const twistGrid = [-3, -2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25, 3];
      const tipTarget = new THREE.Vector3(60 * mxf, -12, HALF + 3);
      const stepsB = [0.1, 0.1, 0.1, 0.12, 0.15, 0.12, 0.12];
      const boundsB: [number, number][] = [[-1.7, 1.8], [-0.6, 1.2], [-0.3, 1.3], [-0.6, 2.0], [-3.3, 3.3], [-2.2, 2.2], [-1.2, 1.2]];
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
      for (const c of cands) {
        if (c.lossA > 80) { console.log(`[B] skip roll=${c.s[0]}(A 不可行 ${c.lossA.toFixed(1)})`); continue; }
        let bestT: { s: Params; loss: number } | null = null;
        for (const mcpT of mcpTargets) {
          for (const tw of twistGrid) {
            const seed = aimSeed(c.s, mcpT, tw);
            const evalB = (v: Params): number => {
              const full = [...c.s];
              full.splice(I_THUMB, 7, ...v);
              applyPose(p.m, buildPose(base, full));
              return thumbLoss(measure(p, { penScope: 'thumbOnly' }));
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
      const stepsC = [gStep, gStep, gStep, gStep, ...FOUR.flatMap(() => [0.03, 0.03, 0.05]), 0.05, 0.05, 0.05, 0.06, 0.08, 0.06, 0.06];
      const evalC = (v: Params): number => {
        applyPose(p.m, buildPose(base, v));
        return totalLoss(measure(p));
      };
      const fin = descend(evalC, inc.s, stepsC, boundsA, 'C');
      applyPose(p.m, buildPose(base, fin.s));
      const mx = measure(p);
      console.log(fmt(mx));
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
