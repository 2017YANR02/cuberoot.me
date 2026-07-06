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
    pos: new THREE.Vector3(312, 32, 41),
    quat: quatFromWorldRots([
      ["y", 90],     // 指列转向 -z(后)
      ["z", 180],    // 食指侧翻到上方,掌心落向 -x(魔方)
      ["x", 25.56],  // 俯仰:指列斜向下搭上 B 面(平指贴面要求,联合解出)
      ["y", 8.59],   // 微 yaw:拇指侧向魔方收拢
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
      fc(0.69, 0.257, 0.7, 1.105),    // 拇指:指腹前段压 FR 贴纸中心带,肉 |x|≥34
      fc(0.868, 0.15, 0.125, -0.45),  // 食指:微拱,肉垫距 B 面上部 2.7U
      fc(0.976, 0.264, 0.12, -0.45),  // 中指:微拱,B 面中部
      fc(0.923, 0.232, 0.156, -0.404),// 无名指:微拱,B 面下部
      fc(1.0, 0.25, 0.2, -0.42),      // 小指:随无名指并拢平收,悬空不接触
    ),
  };
}

/** 左手相对右手的每指弯曲固定偏移(rad)= 左手独立肉面间隙标定解 − 右手解
 *  (left.glb 镜像资产有 ~2U 雕刻不对称,同 curl 下两手间隙不同,必须各解各的)
 *  + 破双手逐帧完美镜像同步的 CG 感(评审 #9)。写死常量,禁随机(刷新换脸)。 */
const LEFT_CURL_OFFSET: Record<FingerName, [number, number, number]> = {
  thumb: [0.023, -0.014, 0],
  index: [0.001, 0.015, 0.202],
  middle: [-0.005, 0.02, 0],
  ring: [0.06, -0.082, -0.036],
  pinky: [0.04, -0.02, 0.04],
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
      splay: f.splay, // splay 由 rig ×side 镜像
    };
  }
  return {
    pos: new THREE.Vector3(-r.pos.x, r.pos.y, r.pos.z),
    quat: mirrorQuatX(r.quat).multiply(qz),
    fingers,
  };
}
