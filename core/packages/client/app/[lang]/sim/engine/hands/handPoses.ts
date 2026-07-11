/**
 * /sim 手部姿态数据 — home 握持位 + 姿态工具。
 * 姿态用「世界轴旋转序列」描述(依次左乘),比裸 euler 好调:每一步都是
 * "绕世界某轴转几度" 的直观操作,Playwright 校准时逐项拧。
 * 左手 = 右手关于 x=0 平面的镜像:pos.x 取反,四元数 (qx,-qy,-qz,qw),
 * splay 由 rig 侧 ×side。
 */
import * as THREE from "three";
import type { FingerName } from "./handModel";

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
  return {
    pos: new THREE.Vector3(299.27, -48.92, 29.41),
    quat: quatFromWorldRots([
      ["y", 90],     // 指列转向 -z(后)
      ["z", 180],    // 食指侧翻到上方,掌心落向 -x(魔方)
      ["x", 2.04],   // 俯仰 ≈0(2026-07-10 四指水平硬规格:25.56→≈0。下耷
                     // 根源 = c1 横扫绕被 pitch 带斜的轴,pitch→0 后 c1 扫掠面
                     // 天然水平,splay 退化为每指纵向微调;指腹贴 B 面改靠
                     // c1 环抱绕过右后棱 + 原 c2/c3 拱形,pos.y/z 随之重解。
                     // 同日 r6:整手下移 posY 19→15.2、接触列居中到贴纸带心)
      ["y", 12.62],  // yaw:拇指侧向魔方收拢(8.59→12.62,16 维联合解)
      ["z", -15.778], // r11 滚转:拇指侧下沉(CMC 87.8→30.9,配合 pos.y 下移
                     // 15.2→−49.7)。r9 的 Rz(−40°) 因四指转斜被否;r11 靠新
                     // twist 通道逐指把长轴/指背转回规格(7.8/7.8/5.1/0°),
                     // roll 只取拇指规格所需最小档(_pose_probe stage A 网格扫)。
    ]),
    fingers: fingerPose(
      // 2026-07-06 GLTF 蒙皮手模(WebXR generic-hand)标定,浏览器内坐标下降。
      // 判据三轮:v2 活体 *-tip 端点骨贴面 → v3(2026-07-07,用户报穿模)改
      // 「蒙皮肉面 Chebyshev 间隙」—— tip 骨在面外 4U 时末节肉垫(半径 ~10U)
      // 仍沉进贴纸 12~20U → v3.1 间隙加到 2.7U:转动起步时活动层贴面绕轴翻剪
      // (revolving-door,剪深 ≈ 接触点到轴距 × 层角),整手外让 5° 内让满,
      // 起步窗口只能靠静置间隙兜住;2.7U 同时把指腹接触半径顶到 ≥136U(角柱
      // 扫掠半径 135.8U),y/z 腕部借力沿对角线擦角也安全。重解目标 = 该指全部
      // 蒙皮顶点(applyBoneTransform 合成)间隙 2.7U 且指尖切向漂移最小。姿态
      // 约束沿用:四指近乎「平摊」搭 B 面(钩成爪 = 假),每关节保留轻微自然
      // 屈曲(全伸直 = 木棍)。拇指两条硬约束:① 肉垫厚,只靠 curl 脱困会整根
      // 飘离贴纸,splay 必须入参(「立起指腹前段压」);② 全部拇指肉 |x|≥34.5
      // —— 内缘悬过 x=32(M 列界)的肉会在 R/L 腕转时随层扫穿静止 M 列的棱块
      // (旋转半径 ~97U < 角柱 135.8U,Chebyshev 内陷被 x 深度截到 8U,oracle
      // 实测),曾被误诊为资产孤岛几何;tip 落 FR 贴纸中心带 (62,-19)。手位
      // (pos/quat)不动;拇指弯曲平面 roll 烘在 handModelGltf 的
      // THUMB_CURL_PLANE_ROLL。改指长/缩放/roll/HAND_SCALE 必须重跑标定
      // (方法见 memory project_sim_hands_rig)。
      // 2026-07-07 用户加弯档:三指 c2/c3 上调(原「微拱」偏平),c1 按
      // 「指尖钉回原接触点 + 间隙 2.7U」重解(浏览器内局部二分,从原 c1 出发
      // 取最近交叉 —— pen(c1) 非单调,全局二分会跳到「MCP 伸直平探」的假解支)。
      // 2026-07-08 拇指重解(甲面 ∥ F 规格):THUMB_CURL_PLANE_ROLL 1.524→2.074,
      // 甲背·ẑ≈0.85(见 THUMB_CURL_PLANE_ROLL 注释)。
      // 2026-07-09 拇指整体抬进 E 层带(用户报障:正常握持两拇指必须在 E 层,
      // 旧解 tip 带 y≈−19、肉垂到 −49 压 D 排贴纸)。重解目标:可见拇指肉
      // (|x|≤105)全部 y∈[−32,32](解到 [−30.9,+30.9],62U 肉径是该资产装进
      // 60U 窗的物理极限,余量 ~1.1U)+ 肉 |x|≥34.5 + Chebyshev 间隙 ≥2.7
      // + 指腹仍压 FR 贴纸(接触心 (56,−2) 间隙 3.6U,tip 骨 (63,−5),末节
      // 中腹贴面、指尖微翘)。出带肉全部在角柱扫掠环带外(y>32 的肉 xz 半径
      // ≥173 > 135.8;y<−32 的肉不复存在 —— D 带扫掠对拇指天然免疫,
      // THUMB_EVADE_D/LOW_EVADE.thumb 降级为保险)。浏览器坐标下降解
      // (判据全蒙皮顶点,方法见 memory project_sim_hands_rig)。
      // 2026-07-10 四指水平硬规格重解(用户规格:B 面视图每指长轴水平跨过
      // 自己那排,|Δy/len|<0.15;接触位不变 R2@Q 角 / R3@T 棱 / R4@T 角)。
      // 16 维进程内坐标下降(Node 蒙皮探针 tests/_pose_probe SOLVE=1,先复现
      // 原锚点再解):pitch≈0 后 c1 = 水平环抱量、splay = 每指纵向微调;
      // 解得倾角 食 −0.1° / 中 0.1° / 无名 3.0° / 小指 7.8°(全 <8.6°),
      // 贴面 2.9/2.7/3.0(裸世界单位,落点 y 88/26/−38 各自贴纸带内),
      // 拇指 fGap 3.2、肉 |x|≥34.5、yVis [−31.7,31.7] ⊂ ±32(c1/c2/c3 联合
      // 拉直压窄 y 跨度 —— 拇指自轴斜是跨度膨胀主因)。小指 pen −0.5 裸单位
      // 静置安全但余量薄,改小指 curl 前先跑探针。
      // 2026-07-10 r6 整列下沉居中(用户抓「食指顶到 U 面白排」):loss 加
      // 「接触点→贴纸带心 64/0/−64 软拉」重解,posY 19→15.2 / posZ 39.9→31.2,
      // 接触落点 y 88/26/−38 → **65/1/−61**(各排居中);倾角 4.6/4.9/7.5/8.3°
      // (|Δy/len| 全 <0.15),贴面 2.8/2.8/2.6,拇指同步重解:fGap 2.8、
      // 肉 |x|≥34.7、yVis [−31.7,31.6] ⊂ ±32(E 带守住)。
      // ⚠ 涟漪:全部 flick fit(HOOK_FOLLOW 等)的起点 = 本 home 姿,大改后
      // 各手势贴面质量需按 r3/r4 方法复检(FINGERTRICKS §5)。
      // 2026-07-10 r10(回滚 + 甲面硬平行):r7/r8「拇指挂点大平移」脱掌解剖学
      // 假(attach 前的 rootBase 改动被世界位姿补偿吞掉,「只转支架肉不动」,
      // 用户抓的)、r9「整手 Rz(−40°) 滚转」违反四指水平硬规格,先后被否决。
      // 2026-07-10 r11(全关节解锁,方案 D):用户拍板「真人手有多少自由度就给
      // 多少」。资产(WebXR generic-hand,25 关节全蒙皮)本就够,是绑定层焊死
      // 的 —— 解锁:①每指根 twist(Euler x 槽,'YZX' 序 = 真轴向旋前);②四指
      // 掌骨 meta 关节(掌弓);③拇指 MCP 出平面 [twist,splay](mid 通道)。
      // 关键认知:旧拇指链是**共面三连杆**,几何可证 甲面∥F 与 MCP 沉 D 不可
      // 兼得(解析上界 nail·ẑ≈0.87@MCP−35,solver Pareto 前沿吻合)—— 真人
      // 拇指靠 MCP 外展+旋前出平面,mid 通道是死结唯一解。求解 = tests/
      // _pose_probe.test.ts(SOLVE=R 三阶段:roll 网格×四指恢复 → CMC/tip 两步
      // 解析瞄准种子×twist 网格单解拇指 → 全 23 维抛光;SEED= 直通抛光)。
      // R 终解(loss 14.1):四指倾角 7.8/7.8/5.1/0°(<8.6 留余量)、贴面
      // 2.86~2.94、行带内、指背贴 r6 锚;拇指甲片 PCA 法向·ẑ 0.974、MCP y
      // −34.0(D 层下)、贴面 3.36、接触 (90,7) FR 贴纸内、肉 |x|≥58.5、链距
      // 231→202(V 形折叠,治「太长」)、pen −2.86。真 CMC(腕侧掌骨根)y
      // 29.6 = 本解构运动学下限:再低要么破四指水平(roll>−28 后 stage A 崩),
      // 要么脱 F 接触 —— 用户口径「CMC 沉 D」按可见拇指根(MCP+鱼际)交付,
      // 鱼际肉 fleshY 已到 −63。
      { curl: [1.5054, -0.3684, 0.145], splay: 0.997, twist: 2.2846, mid: [-0.0614, -0.8862] }, // 拇指:从下向上立,甲面∥F 0.991
      { curl: [0.7593, 0.38, 0.28], splay: -0.1024, twist: -0.0321 }, // 食指:水平环抱,7.8°
      { curl: [0.8085, 0.42, 0.26], splay: -0.0887, twist: -0.0312 }, // 中指:水平环抱,7.8°
      { curl: [0.673, 0.40, 0.28], splay: -0.0334, twist: 0.0004 },   // 无名指:水平环抱,5.6°
      { curl: [0.6836, 0.42, 0.30], splay: 0.0795, twist: 0.114 },    // 小指:蜷收在后半区悬空(tip z≤−40,禁探 D 底)
    ),
  };
}

/** 左手相对右手的每指弯曲固定偏移(rad)= 左手独立肉面间隙标定解 − 右手解
 *  (left.glb 镜像资产有 ~2U 雕刻不对称,同 curl 下两手间隙不同,必须各解各的)
 *  + 破双手逐帧完美镜像同步的 CG 感(评审 #9)。写死常量,禁随机(刷新换脸)。
 *  第 4 位(可选)= splay 偏移:2026-07-10 手指放平重解后左拇指 E 带差 splay
 *  一口气(y 抬升的主杠杆,c2/c3 抬不动),给偏移表补上该维度。
 *  第 5 位(可选)= twist 偏移;第 6/7 位(可选)= MCP mid [twist, splay] 偏移
 *  (r11 通道,见 FingerCurl)。 */
const LEFT_CURL_OFFSET: Record<FingerName, [number, number, number, number?, number?, number?, number?]> = {
  // 2026-07-10 r11(全关节解锁)重解:L 手根冻结为 homeRight 严格镜像(不对称
  // 全由指参吸收),_pose_probe SOLVE=L SEED=镜像 R 拇指 直通抛光,L 独立解 −
  // R 解。L 终解 loss 10.8:四指倾角 7.8/7.8/6.6°、小指 9.2° 蜷收后半区、贴面
  // 2.88~2.91、行带内;拇指甲法向 ·ẑ 0.994、MCP y −38.8(D 层下)、贴面 2.40、
  // 接触 (−89,6) FL 贴纸内、肉 |x|≥59.8、链距 199、pen −2.40(≥1.2U 呼吸余量)。
  thumb: [-0.0037, 0.0233, -0.0177, -0.0219, 0.0143, 0.0665, -0.0325],
  index: [0.011, 0.02, 0.03, -0.0075, -0.0156],
  middle: [-0.0088, 0.025, -0.02, -0.005, -0.0221],
  ring: [0.0178, -0.03, 0.02, 0.017, -0.0041],
  pinky: [0.0254, -0.02, 0.04, 0, -0.002],
};

export function homeLeft(): HandPose {
  const r = homeRight();
  // 左手几何在「局部 y=0 平面」镜像(left.glb 真镜像资产,side=+1),世界姿态在「x=0 平面」
  // 镜像:M_x·R·M_y = mirrorQuatX(R) ∘ Rz(π)(M_x·M_y = diag(-1,-1,1) = 绕 z 转 π)。
  // 少乘这个局部 Rz(π) 手指会指向正下方(v1 实测踩过)。
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  const fingers = {} as HandFingerPose;
  for (const name of Object.keys(r.fingers) as FingerName[]) {
    const f = r.fingers[name];
    const off = LEFT_CURL_OFFSET[name];
    const midBase = f.mid ?? [0, 0];
    const mid: [number, number] | undefined = f.mid || off[5] != null || off[6] != null
      ? [midBase[0] + (off[5] ?? 0), midBase[1] + (off[6] ?? 0)] : undefined;
    fingers[name] = {
      curl: [f.curl[0] + off[0], f.curl[1] + off[1], f.curl[2] + off[2]],
      splay: f.splay + (off[3] ?? 0), // splay 由 rig ×side 镜像;偏移是左手局部值
      twist: (f.twist ?? 0) + (off[4] ?? 0), // twist 同 splay:rig ×side,偏移为左手局部值
      ...(mid ? { mid } : {}), // MCP 出平面通道镜像语义由 rig ×side,偏移为左手局部值
      ...(f.meta ? { meta: f.meta } : {}), // 掌弓通道镜像语义由 rig ×side,需要 L 独立偏移时再扩表
    };
  }
  return {
    pos: new THREE.Vector3(-r.pos.x, r.pos.y, r.pos.z),
    quat: mirrorQuatX(r.quat).multiply(qz),
    fingers,
  };
}
