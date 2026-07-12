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
  // 2026-07-11 r21(用户俯视图选定 CW26):整手绕「虎口空洞中心」竖直轴
  // (pivot (170,0,-10),世界 y)俯视顺时针刚体转 26° 烘进 quat,使
  // 食/中/无名指尖排与 B 面平行(tipzEq 硬项);左手 homeLeft 镜像反向。
  // 2026-07-11 r22(用户机理「四指 MCP 弯少一点」):r21 拇指实为跨中线
  // ~20U(|x|min 0.9 是跨零假象,镜像互穿 40U)。平移换不动(四指无多余
  // 内伸量,5 连解证死);正解 = **掌体绕指尖竖列 yaw 回转 12.8°**(三尖
  // 近共线成竖轴,轴上点不动 ⇒ 尖排平行 B 面保持、指尖贴纸不动、掌根带
  // 拇指退出中线、MCP 视觉变直)。求解 FREEZE=0,31(yaw 放开)+ 种子跳
  // 拇指跨零梯度平台;env:THUMBMX=12 TIPX='36,90' TTX='40,68'
  // TIPZLO=-120。终解(r23b 抖动重启定稿,总 yaw 15.2°):拇指 |x|min
  // 45.5(镜像净距 91U,M 列墙 34.5 自然达标)、贴 F fGap 0.65(z 向静态,
  // 待机呼吸只动 x/y 不吃)接触 (87.2,−8.2) Je 带、水平 0.7° 甲 0.999
  // CMC −29.8;四指接触 (95.2,77.8)/(90.0,−2.3)/(93.8,−87.8) 在 Q/Te/T,
  // 倾角 7.7/6.0/7.7,三尖 z 展布 2.2,pen −0.65。⚠ 残差(坐标下降盆地
  // 底,均 ≤0.4U 亚视觉):index gap 3.55(带上 +0.15)、pen 呼吸余量
  // 0.65<1.2、tipzEq 2.2>2.0;改此值必须重跑 SOLVE=R(env 同上)。
  // 2026-07-11 r24(用户规格「食/中/无名弯曲再小、指尖往魔方里收」):冻结
  // 拇指+手根只放四指关节(r24 全通道版拿拇指居中/CMC 换分,废),CURLW=300
  // 罚弯曲平方 + TIPX 收 [40,66]。PIP 直化 13°/2°/7°,DIP 全直化;MCP 微增
  // (几何:指从上方拱过棱沿压 B 的 dive 由 MCP 承担,同根位下不可再直,
  // 要更直须抬高指根线 = 动手根,另议)。
  // 2026-07-11 r25(用户规格「指中线对齐块中线」,MD §1.1 新增):r24 接触心
  // y 51/7/−91,无名指压在魔方下沿(块心 −64 偏 27U)。splay 摆沿锥面(上摆
  // 压肉进面 pen 6.2、下摆脱面,线扫实证),复合步 (splay,dc1/dc2/dc3) 走
  // 「贴面等高线」三轮收敛 → 接触心 62.6/1.4/−66.9(全部 ±3U 进块中线)。
  // 代价:无名指轴上斜 13.2°(手根冻结下接触点抬 24U 的几何必然,水平墙
  // TILT4 让路,规格冲突以中线对齐为先),小指↔无名指净距压 0.8 硬墙(达标
  // 零余量)。env:ROWBAND=0 TILT4=16 TIPX='40,66' TTX='40,68' TIPZLO=-120
  // CURLW=300,拇指+手根冻结。
  return {
    pos: new THREE.Vector3(372.21, -75.81, -29.55),
    quat: new THREE.Quaternion(-0.536805, -0.106353, 0.827205, 0.127516),
    fingers: fingerPose(
      { curl: [1.0646, -0.4952, 0.0796], splay: 0.4628, twist: 2.3394, mid: [-0.7962, -0.0834] }, // 拇指:水平 0.7°,贴 F @Je(r24 起冻结未动)
      { curl: [0.6077, 0.7445, 0.131], splay: -0.0865, twist: -0.0577 },   // 食指:接触心 y 62.6 @Q(块心 64)
      { curl: [0.777, 0.721, 0.2841], splay: 0.1976, twist: 0.126 },       // 中指:接触心 y 1.4 @Te(块心 0)
      { curl: [0.8261, 0.5959, 0.0076], splay: 0.2848, twist: -0.0674 },   // 无名指:接触心 y −66.9 @T(块心 −64)
      { curl: [1.1872, 0.2326, -0.0129], splay: 0.519, twist: 0.0373 },    // 小指:∅ 悬空,让位下沉
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
