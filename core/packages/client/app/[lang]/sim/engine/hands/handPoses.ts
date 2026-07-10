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
const fc = (c1: number, c2: number, c3: number, splay = 0): FingerCurl => ({ curl: [c1, c2, c3], splay });

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
    // r9 pos = Rz(-40°) 绕枢轴 (99.4, 13.2)(r6 拇指远节关节世界位)旋转 r6 pos
    // (312, 15.17, 31.19) 所得:整手滚转把掌根甩到魔方右下角外,拇指尖区域不动。
    pos: new THREE.Vector3(263.5273, -121.9475, 31.19),
    quat: quatFromWorldRots([
      ["y", 90],     // 指列转向 -z(后)
      ["z", 180],    // 食指侧翻到上方,掌心落向 -x(魔方)
      ["x", 2.04],   // 俯仰 ≈0(2026-07-10 四指水平硬规格:25.56→≈0。下耷
                     // 根源 = c1 横扫绕被 pitch 带斜的轴,pitch→0 后 c1 扫掠面
                     // 天然水平,splay 退化为每指纵向微调;指腹贴 B 面改靠
                     // c1 环抱绕过右后棱 + 原 c2/c3 拱形,pos.y/z 随之重解。
                     // 同日 r6:整手下移 posY 19→15.2、接触列居中到贴纸带心)
      ["y", 12.62],  // yaw:拇指侧向魔方收拢(8.59→12.62,16 维联合解)
      ["z", -40],    // r9 整手滚转(2026-07-10):真人握姿 —— 手从右下角斜入,
                     // 拇指改为从下往上压 F 面,CMC/鱼际沉到 D 角区。r7/r8 的
                     // 「拇指挂点大平移」方案解剖学假(拇指柱脱掌,用户报障),
                     // 撤销改整手转;绕 z 过拇指远节关节枢轴,pos 连动重算,
                     // 全部手指 curl 逐指 4 通道阻尼牛顿重解(见各指注释)。
                     // ⚠ r5「四指水平」规格随 r9 废止:滚转后指列斜向上跨 B 面
                     // (真人握姿本就如此);接触贴纸块不变。
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
      // 2026-07-10 r9 真人握姿重解(r8「拇指挂点 −160U 平移」把拇指柱拽脱手掌,
      // 解剖学假 —— 用户报障「拇指和手的关系很奇怪,需非常完美的人手」,r7/r8
      // 机制整体撤销):挂载 quat 加 Rz(−40°) 绕拇指远节关节枢轴整手滚转,鱼际/
      // CMC 自然沉到 D 角区(拇指从下往上压 F 面,与真人速拧一致),全指 curl
      // 浏览器内逐指 4 通道阻尼牛顿重解(判据 = 关节钉回 + 全蒙皮顶点探针):
      // - 拇指:远节关节钉回 r6 位 + dx 外滑 8U;pad 贴 FR 贴纸 (64,3.5) 间隙
      //   3.1U,肉 |x|≥36.1(M 列线 34.5 ✓),甲面朝前。c3=1.1(远节绕关节的
      //   零空间自由度,用于同时满足贴面与 M 线 —— 两约束在 c3 单线上无交点,
      //   加 dx 目标外滑后可行)。
      // - 食指:滚转后解剖上够不到旧 Q 角排接触点(反弓钳制 c2≥0.03 内全空间
      //   停滞点距目标 30U,多起点验证)—— 改为自然悬停 BUR 角外(真人食指
      //   本就悬空待弹):肉距 B 面 11.7U,完全退出 U 带扫掠环(145 ≥ 135.8,
      //   反而优于 r6 的 134.5 带内暴露)。
      // - 中指:接触点钉回 T 棱排 (99.7,1.7),目标 z −4U 恢复贴面间隙 2.8U
      //   (滚转后 pad 姿态变,同关节位压深 2.7U 穿面)。
      // - 无名指:接触外滑 δ=20(x+20, z−10)—— 原位钉回时末节肉切进 DBR 角区
      //   12.6U;外滑后骑 BR 棱下端,肉间隙 3.3U。
      // - 小指:深收拢(悬空、甲背朝前、指节沉到魔方下方),清出 F 带扫掠环
      //   (142.4 ≥ 135.8;浅收拢会以 131.8 挡 F 转)。
      // 静态安全面板(两手,全蒙皮顶点):穿模 0(minCheb 98.8/98.4);
      // D 带 rMin 136.8/135.9 ≥ 135.8 —— D 族恢复天然免疫(L 余量 0.1U 薄,
      // THUMB_EVADE_D 仍为保险);U 带 115.9(中指末节上缘肉,r6 无此暴露)、
      // E 带 112(拇指 pad,同 r6)、B 带 108(接触指,同 r6)—— 转层瞬时安全
      // 依赖各族 evade/dodge。⚠ 挂载大改,全部 flick fit(HOOK_FOLLOW 等)与
      // evade 幅度的贴面质量需按 r3/r4 方法整体复检(FINGERTRICKS §5),
      // 其中 U 族需补「中指避让」(旧姿中指不进 U 带,无此机制)。
      fc(0.5729, -0.493, 1.1, 1.3917), // 拇指:pad 压 FR 贴纸,从下往上,甲面朝前
      fc(0.82, 0.18, 0.22, -0.06),     // 食指:自然微屈,悬停 BUR 角外待弹
      fc(0.6968, 0.6418, 0.26, -0.0237), // 中指:斜向上环抱,压 T 棱排居中
      fc(0.069, 1.4882, 0.28, 0.3423), // 无名指:PIP 深弯,骑 BR 棱下端
      fc(1.5, 1.2, 0.85, -0.15),       // 小指:深收拢悬空,沉在魔方下方
    ),
  };
}

/** 左手相对右手的每指弯曲固定偏移(rad)= 左手独立肉面间隙标定解 − 右手解
 *  (left.glb 镜像资产有 ~2U 雕刻不对称,同 curl 下两手间隙不同,必须各解各的)
 *  + 破双手逐帧完美镜像同步的 CG 感(评审 #9)。写死常量,禁随机(刷新换脸)。
 *  第 4 位(可选)= splay 偏移:2026-07-10 手指放平重解后左拇指 E 带差 splay
 *  一口气(y 抬升的主杠杆,c2/c3 抬不动),给偏移表补上该维度。 */
const LEFT_CURL_OFFSET: Record<FingerName, [number, number, number, number?]> = {
  // 2026-07-10 r9 整手滚转后左手独立逐指重解 − 右手解(left.glb 镜像资产
  // ~2U 雕刻不对称,两手各解各的):L 拇指 pad (−62.1,4.5) 间隙 3.4U、
  // 肉 |x|≥34.9(c2 触 −0.5 生理钳位,curl 空间内贴面∧M 线无交集,靠
  // handModelGltf THUMB_PITCH_MOUNT 的 2.8U 挂点微移补齐 —— r7 证明 ≤15U
  // 平移蒙皮无感);中指贴面 2.4U;无名指同 δ=20 外滑;小指与 R 同姿。
  thumb: [0.01, -0.007, -0.1, -0.0092],
  index: [0.02, 0, 0.02, 0.02],
  middle: [-0.0042, 0.023, -0.02, 0.0208],
  ring: [-0.0033, 0.0019, 0.02, 0.0186],
  pinky: [0, 0, 0],
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
    fingers[name] = {
      curl: [f.curl[0] + off[0], f.curl[1] + off[1], f.curl[2] + off[2]],
      splay: f.splay + (off[3] ?? 0), // splay 由 rig ×side 镜像;偏移是左手局部值
    };
  }
  return {
    pos: new THREE.Vector3(-r.pos.x, r.pos.y, r.pos.z),
    quat: mirrorQuatX(r.quat).multiply(qz),
    fingers,
  };
}
