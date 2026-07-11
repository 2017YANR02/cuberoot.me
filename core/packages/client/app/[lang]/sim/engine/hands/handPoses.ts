/**
 * /sim 手部姿态数据 — home 握持位 + 姿态工具。
 * 姿态用「世界轴旋转序列」描述(依次左乘),比裸 euler 好调:每一步都是
 * "绕世界某轴转几度" 的直观操作,Playwright 校准时逐项拧。
 * 左手 = 右手关于 x=0 平面的镜像:pos.x 取反,四元数 (qx,-qy,-qz,qw),
 * splay 由 rig 侧 ×side。
 */
import * as THREE from "three";
import { WRIST_LOCAL, type FingerName } from "./handModel";

// 手模 = MPI MANO 独占(2026-07-11 用户拍板删除内置 generic-hand;资产
// 用户自持授权,scripts/convert-mano.py 逐机转换,gitignored —— 缺资产时
// 手部功能整体不可用,rig 侧 warn)。指法 fit 表暂沿用 generic 时代标定值
// (近似,FINGERTRICKS §5 重标)。

export interface FingerCurl {
  /** 三关节弯曲量(rad,正=向掌心卷)。 */
  curl: [number, number, number];
  /** 指根横向张开(rad,作者系:正=向拇指侧;rig 应用时 ×side)。 */
  splay: number;
  /** 指根绕自身长轴的轴向扭转(rad,作者系,rig ×side;默认 0 = 历史姿态
   *  不变)。r11 全关节解锁新通道:拇指 = CMC 旋前(真人对掌伴随掌骨 ~90°
   *  轴旋,甲面朝向的唯一直接杠杆 —— curl/splay 空间对甲面法向无杠杆,
   *  r10 实测);四指 = 指柱滚转(整手滚转后把指背转回朝上的补偿,r9 缺
   *  此通道所以救不回四指水平)。 */
  twist?: number;
  /** 中节关节(拇指=MCP / 四指=PIP)的出平面通道 [twist, splay](rad,作者系,
   *  均由 rig ×side;缺省 = 纯铰链 = 旧行为)。r11 追加:拇指链此前是「共面
   *  三连杆」,几何可证 甲面∥F 与 MCP 沉 D 层不可兼得(解析上界 nail·ẑ≈0.87
   *  @MCP−35,求解器 Pareto 前沿实测吻合)—— 真人拇指 MCP 自带外展+旋前,
   *  出平面自由度是该死结的唯一解。四指慎用(PIP 出平面在解剖上很小)。 */
  mid?: [number, number];
  /** 掌骨关节 [curl, splay, twist?](rad,作者系,splay/twist 由 rig ×side)。
   *  四指专用(拇指的掌骨 = root 本身,忽略此项);默认缺省 = 掌骨保持绑定
   *  位(旧「焊死在掌内」行为)。真人掌弓自由度:握持时环/小指掌骨向掌心
   *  收拢(cupping),掌面不是刚板。 */
  meta?: [number, number, number?];
}
export type HandFingerPose = Record<FingerName, FingerCurl>;

export interface HandPose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  fingers: HandFingerPose;
}

/** 依次绕世界轴旋转(度)→ 四元数。列表顺序 = 施加顺序(后者左乘)。 */
export function quatFromWorldRots(rots: [axis: "x" | "y" | "z", deg: number][]): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const step = new THREE.Quaternion();
  for (const [axis, deg] of rots) {
    v.set(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
    step.setFromAxisAngle(v, (deg * Math.PI) / 180);
    q.premultiply(step);
  }
  return q;
}

/** 关于 x=0 平面镜像一个旋转:M·R·M,M=diag(-1,1,1) ⇒ (qx,qy,qz,qw)→(qx,-qy,-qz,qw)。 */
export function mirrorQuatX(q: THREE.Quaternion): THREE.Quaternion {
  return new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
}

function fingerPose(
  thumb: FingerCurl, index: FingerCurl, middle: FingerCurl, ring: FingerCurl, pinky: FingerCurl,
): HandFingerPose {
  return { thumb, index, middle, ring, pinky };
}

/**
 * 右手 home 握持(前后钳形,按用户指位规格):指列竖排绕过右后竖棱 ——
 * 食指尖压 BUR 角块 B 面、中指压 BR 棱 B 面、无名指压 BDR 角块 B 面,拇指从
 * 掌根前下绕出压 FR 棱 F 面;小指无目标,收拢在无名指下方。左手镜像同规格
 * (BUL/BL/BDL/FL)。**掌心不贴 R 面**:掌体外移悬空,与面之间留 ~97U(≈半个
 * cube 宽)空腔(参考站同款「指尖抓面、掌心成拱」;HAND_SCALE=2.2 真人手比例,
 * 指长足够),指尖接触点滑到各自贴纸的后棱沿(食指/无名指 x≈96 骑棱,中指
 * x≈88,拇指 FR 棱外端 x≈82,块不变),基节大弯 ~0.8rad 高拱。
 * 基础朝向 = Ry(90)∘Rz(180):指列朝 -z(后)、食指侧朝 +y(上)、掌心朝 -x
 * (魔方)—— 该三元组的手性要求 side=-1 几何(见 handsRig 构造注释)。
 * 数值在 SIZE=64(棱长 192、半宽 96)坐标系下;由坐标下降求解 + Playwright 复核,
 * 改 HAND_SCALE / 指根 rz / 掌横弓必须重跑标定(方法见 memory project_sim_hands_rig)。
 */
export function homeRight(): HandPose {
  return manoHomeRight();
}

/**
 * MANO 右手 home(2026-07-11 实解,_pose_probe MODEL=mano SOLVE=R 三阶段 +
 * NAILW=60000 高甲权盆地)。MANO 版硬规格比 default 多一条:**真 CMC
 * (thumb-metacarpal 关节)y ≤ −28.5(D 层界下)** —— generic-hand r11 已证
 * 超出其可行域(CMC 卡 +30),MANO 真实掌型下达成 **CMC −30.0**,且甲面∥F
 * 反超 generic(nail·ẑ 0.995 vs 0.991)。
 * 终解指标:四指倾角 4.9/2.8/7.8°(<8.6)、贴面 2.91/2.60/2.92、行带内
 * (60.9/−4.6/−71.2);小指 25° 蜷收豁免;拇指 fGap 3.18 压 FR 贴纸
 * (90.0,6.7)、MCP −51.7(D 层下)、肉 |x|min 48.2(M 列 34.5 余量)、
 * mid 深出平面 [−0.24,−0.77](twist 2.40 盆地 —— 12000 甲权停 0.961,
 * 60000 才跳出);pen −1.63(≥1.2U 呼吸余量)。
 * 求解自由度比 default 多:四指 dc2/dc3 尾参 + 手根 pitch/yaw(generic 的
 * base.quat 按其掌弓解,MANO 真实掌弓指根线俯倾 ~10°,只有 z-roll 修不平);
 * 全都烘进本值,改 convert-mano.py / MANO_THUMB_ROLL 必须重解。
 */
function manoHomeRight(): HandPose {
  // 2026-07-11 r2:小指↔无名指净距约束(链轴距 − 肉半径和 ≥0.8U)入解
  // (用户抓小指压进无名指,原解 −33.8 深穿插)。
  // 2026-07-11 r3:posedirs 姿态修正(鱼际隆起)入环重抛光 —— 修正会改贴面
  // 几何,解必须带着它收敛。
  // 2026-07-11 r4:**拇指水平**(用户规格「正面看拇指要直、不上翘」):可见
  // 拇指 MCP→tip 对水平面 ≤9° 硬墙入解;V 形折叠废除(与水平互斥)。
  // 2026-07-11 r5:**四指指尖收中**(用户规格「背面看食/中/无名指尖端点刚好
  // 碰到棱/角块内缘」):tip 骨 |x| 进 [36,46] 带 + tip z 拉回面附近(旧解
  // 食指 tip z −123 悬空越面)。
  // 2026-07-11 r6:**拇指尖抬回竖直正中**(用户规格「魔方高 3 则指尖在 1.5」,
  // r5 的 −44 太低;MCP 沉 D 约束随之废除,真 CMC −30 保留)+ **小指低于
  // 无名指 ≥12U**(用户抓「小拇指被挡住」,r5 两 tip 同高被无名指遮死)。
  // 2026-07-11 r19(HAND_SCALE 2.2→2.6 重解):MANO 指围实测仅 0.71~0.79 棱块,
  // 违反用户 0.9 规则(2.2 按已退役 generic 标),重标后拇指链/棱长比 1.49→1.76
  // 才够得到 F 面内侧 —— 2.2 下「拇指再内收」被证几何不可行(掌根贴死 R 面,
  // DIAG 内移 3U 即 pen 2.75)。新增硬约束:①四指 tipx 带符号(|x| 写法曾容忍
  // x=−37 镜像解)②左右手互撑墙 fourFleshMinX ≥12(用户背面截图抓左右指尖对撞,
  // 此前无跨手项)。终解:拇指贴 F fGap 2.47 接触 (93.1,−12.1) 水平 1.6°
  // nail 0.935 CMC −36.3、肉横贯 F 右三分之一(|x|min 53.9,2.2 时代 91 的
  // 「指尖骑棱」观感消除);四指 tip x 35.9/44.7/46.4 贴纸 Q/Te/T、倾角
  // 7.8/5.3/8.3°;小指低于无名指 34.8U;互撑净距 69.2;pen −1.80 呼吸余量恢复。
  // ⚠ 毛刺:ring gapB 3.53(带上 3.4 +0.13)、ring 倾角 8.3(<规格 8.6,超
  // 7.8 预留墙)、拇指接触 y −12.1(带下缘)。
  return {
    pos: new THREE.Vector3(336.65, -82.23, -93.5),
    quat: new THREE.Quaternion(-0.456514, -0.093871, 0.874084, 0.136966),
    fingers: fingerPose(
      { curl: [1.0175, -0.6136, 0.036], splay: 0.4628, twist: 2.2903, mid: [-0.7388, -0.0834] }, // 拇指:水平 1.6°,贴 F fGap 2.47
      { curl: [0.5357, 0.9001, 0.1675], splay: -0.0098, twist: -0.0629 },  // 食指:tip x 35.9 @Q
      { curl: [0.7582, 0.6898, 0.6898], splay: 0.1493, twist: 0.0256 },    // 中指:tip x 44.7 @Te
      { curl: [0.6699, 0.8729, 0.2444], splay: 0.1414, twist: -0.1851 },   // 无名指:tip x 46.4 @T
      { curl: [1.0391, 0.3949, 0.2697], splay: 0.4606, twist: 0.0165 },    // 小指:∅ 悬空,低于无名指 34.8U
    ),
  };
}

/** 左手 = 右手严格镜像(2026-07-11 用户拍板「左右手必须对称」):左资产由
 *  convert-mano.py 从 MANO_RIGHT 镜像生成(官方 MANO_LEFT 本就是 R 的位精确
 *  镜像,实测顶点/关节/权重差全 0),指参逐项相同(splay/twist/mid 的镜像
 *  语义由 rig ×side),SOLVE=SYM 顶点级 0 残差。generic 时代的每指左偏移表
 *  (left.glb 雕刻不对称 + 破镜像同步 CG 感)随内置手模一并退役。 */
export function homeLeft(): HandPose {
  const r = homeRight();
  // 左手几何在「局部 y=0 平面」镜像(镜像资产,side=+1),世界姿态在「x=0 平面」
  // 镜像:M_x·R·M_y = mirrorQuatX(R) ∘ Rz(π)(M_x·M_y = diag(-1,-1,1) = 绕 z 转 π)。
  // 少乘这个局部 Rz(π) 手指会指向正下方(v1 实测踩过)。
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  const fingers = {} as HandFingerPose;
  for (const name of Object.keys(r.fingers) as FingerName[]) {
    const f = r.fingers[name];
    fingers[name] = {
      curl: [f.curl[0], f.curl[1], f.curl[2]],
      splay: f.splay,
      twist: f.twist ?? 0,
      ...(f.mid ? { mid: [f.mid[0], f.mid[1]] as [number, number] } : {}),
      ...(f.meta ? { meta: f.meta } : {}),
    };
  }
  const quat = mirrorQuatX(r.quat).multiply(qz);
  const pos = new THREE.Vector3(-r.pos.x, r.pos.y, r.pos.z);
  // 两腕同锚 WRIST_LOCAL(y=−1U≠0)⇒ 手系里 L 几何 = My·R + (0,2·WLy,0)
  // 常差,世界严格镜像必须把该项沿左手姿态转回:pos_L = Mx·pos_R −
  // quat_L·(0,2·WLy,0)。缺此项整只左手偏离完美镜像 4.4U(SOLVE=SYM 实测,
  // 曾被误诊为「MANO 左模板非镜像」)。
  pos.add(new THREE.Vector3(0, -2 * WRIST_LOCAL.y, 0).applyQuaternion(quat));
  return { pos, quat, fingers };
}
