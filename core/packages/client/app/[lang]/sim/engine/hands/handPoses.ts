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
 * (BUL/BL/BDL/FL)。**掌心不贴 R 面**:掌体外移悬空,与面之间留 ~56U 空腔
 * (参考站同款「指尖抓面、掌心成拱」;HAND_SCALE=2.2 真人手比例,指长足够),
 * 指尖接触点滑向各自贴纸的后棱端(食指/无名指 x≈93,中指 x≈80,拇指 FR 棱
 * 外端 x≈72,均在原块贴纸上),中节顶满 1.65rad 成深钩抓。
 * 基础朝向 = Ry(90)∘Rz(180):指列朝 -z(后)、食指侧朝 +y(上)、掌心朝 -x
 * (魔方)—— 该三元组的手性要求 side=-1 几何(见 handsRig 构造注释)。
 * 数值在 SIZE=64(棱长 192、半宽 96)坐标系下;由坐标下降求解 + Playwright 复核,
 * 改 HAND_SCALE / 指根 rz / 掌横弓必须重跑标定(方法见 memory project_sim_hands_rig)。
 */
export function homeRight(): HandPose {
  return {
    pos: new THREE.Vector3(210, -8, -15),
    quat: quatFromWorldRots([
      ["y", 90],   // 指列转向 -z(后)
      ["z", 180],  // 食指侧翻到上方,掌心落向 -x(魔方)
    ]),
    fingers: fingerPose(
      // 数值 = 坐标下降求解(指尖圆帽心落面外一半径处 + 指腹朝按压向 +
      // 指链不进 96+r 立方包络 + 解剖正则),见 memory project_sim_hands_rig。
      fc(0.7, 1.65, 0.75, 0.01),    // 拇指:近节折在掌根后,末节沿 F 面压 FR 棱外端
      fc(0.49, 1.65, 0.69, -0.23),  // 食指:高拱深钩,压 BUR 角 B 面
      fc(0.5, 1.65, 0.59, -0.23),   // 中指:高拱压 BR 棱 B 面
      fc(0.48, 1.61, 0.82, -0.31),  // 无名指:钩压 BDR 角 B 面
      fc(0.35, 1.3, 0.55, -0.5),    // 小指:随无名指并拢弯收,悬空不接触(真人手比例下别外翘)
    ),
  };
}

export function homeLeft(): HandPose {
  const r = homeRight();
  // 左手几何在「局部 y=0 平面」镜像(buildHand side=-1),世界姿态在「x=0 平面」
  // 镜像:M_x·R·M_y = mirrorQuatX(R) ∘ Rz(π)(M_x·M_y = diag(-1,-1,1) = 绕 z 转 π)。
  // 少乘这个局部 Rz(π) 手指会指向正下方(v1 实测踩过)。
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  return {
    pos: new THREE.Vector3(-r.pos.x, r.pos.y, r.pos.z),
    quat: mirrorQuatX(r.quat).multiply(qz),
    fingers: r.fingers, // splay 由 rig ×side 镜像
  };
}
