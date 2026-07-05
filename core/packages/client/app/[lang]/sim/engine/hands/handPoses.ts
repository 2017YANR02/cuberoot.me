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
    pos: new THREE.Vector3(252, -8, -34),
    quat: quatFromWorldRots([
      ["y", 90],   // 指列转向 -z(后)
      ["z", 180],  // 食指侧翻到上方,掌心落向 -x(魔方)
    ]),
    fingers: fingerPose(
      // 数值 = 坐标下降求解(指尖圆帽心落面外一半径处 + 指腹朝按压向 +
      // 指链不进 96+r 立方包络 + 解剖正则),见 memory project_sim_hands_rig。
      // 圆拱约束:中节弯钳 ≤1.1,弯曲摊到三关节,指链侧影成圆弧而非中节尖折的 ∧ 拱。
      // 2026-07-05 手模几何大改(锥形扁截面指骨 + 掌指关节弓 rootX + 末节缩短)
      // 移动了指尖落点,故用浏览器内坐标下降对新几何重解 curl(指尖圆帽切立方
      // 面,残差 |gap|<2.5U)—— 改指长/rootX/半径系数必须重跑(方法同 memory)。
      fc(1.088, 1.117, 1.074, 0.13),  // 拇指:圆弧绕过掌根前下,末节沿 F 面压 FR 棱外端
      fc(1.047, 1.053, 0.806, -0.12), // 食指:圆拱,指尖钩压 BUR 角后棱沿
      fc(1.077, 1.047, 0.895, -0.12), // 中指:圆拱钩压 BR 棱 B 面
      fc(0.995, 1.075, 0.832, -0.16), // 无名指:圆拱钩压 BDR 角后棱沿
      fc(0.62, 1.08, 0.72, -0.3),     // 小指:随无名指并拢弯收,悬空不接触;splay 收敛
                                      // 到 -0.3(-0.5 会横倒进无名指穿插,评审 #9),
                                      // 靠加大 curl 补收拢

    ),
  };
}

/** 左手相对右手的每指弯曲固定微偏(rad)—— 打破双手逐帧完美镜像同步的 CG 感
 *  (评审 #9);量级 ≲0.03,指尖偏移 ≲3U,不破坏接触观感。写死常量,禁随机
 *  (每次刷新长相变)。 */
const LEFT_CURL_OFFSET: Record<FingerName, [number, number, number]> = {
  thumb: [0.02, -0.02, 0.03],
  index: [-0.03, 0.02, -0.02],
  middle: [0.02, 0.03, -0.03],
  ring: [-0.02, -0.03, 0.02],
  pinky: [0.04, -0.02, 0.04],
};

export function homeLeft(): HandPose {
  const r = homeRight();
  // 左手几何在「局部 y=0 平面」镜像(buildHand side=-1),世界姿态在「x=0 平面」
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
