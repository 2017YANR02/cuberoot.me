/**
 * /sim 手部指法动画 rig — 3x3 专属(world.puzzleKind === 3 时启用)。
 *
 * 同步原理:不挂事件、不改引擎热点文件 —— 每帧轮询 cube.table.groups 里
 * 各层 CubeGroup 的实时 angle(tween 播放与手动拖层都写这里),手跟着当前
 * 角度摆位,天然零漂移;drop() 归零后进入回位混合。
 *
 * 手势两类(**指法权威规格表:同目录 FINGERTRICKS.md,改指法先改那里**):
 *  - weld  腕转:整只手焊在转动层上,绕层轴跟转(R/L 外层、整体 x/y/z 双手)。
 *  - flick 指弹:出一根手指沿转向扫(U/D 食指/无名指、F/B 拇指/中指、M/E/S)。
 *    双中手专项:F 族「食指越顶」topPush;y 族接触勾拨 hook(180° 提示连拨:
 *    U2 食指→中指、D2' 小指→无名指,首指保持、双指齐收);B' 右食指 backHook;
 *    U'p 右食指推 upPush。左中右下:F 族右食指 downPush(F2 连拨)。
 * 手/指的选择依转向(angle 符号)+ 握姿 + 转前提示分配,映射见
 * classifyHandGesture(纯函数,tests/hands_gestures.test.ts 锁定)。
 *
 * 握姿持久化:x 轴单层 weld(R/L)提交(层角走满 ±90° 倍数后 drop)把该旋转
 * 烘进 per-hand 的 grip 基座 —— 手停在转完的位置,不自动回家(真实指法如此)。
 * 整体转体(x/y/z whole)不烘也不软钳制:手 1:1 黏着魔方刚体同转(零相对运动
 * = 转动全程零穿模;魔方箱体在四分转下不变 → 任意 90° 踏移后的握姿间隙不变),
 * 层角越过 45°(带迟滞)即踏移一个 90°(手瞬跳换握,与「自动转体」跨 ±90° 的
 * scene 快切同款观感,#20),提交时残差≈0 直接落回 home —— 终态 = home 握新
 * 朝向的面,与视角/自动转体一致。回 home / 换握由解法框记号驱动:↑ 上手
 * (拇指起手在 U 面)、↓ 下手(D 面)、· 回 home 握;手别由空白定(FINGERTRICKS
 * §2:记号紧贴后续字符 = 右手,后随空白/串尾 = 左手),见 regrip() / simulateGrips()。
 *
 * 穿模禁令(用户规格:任何时刻手指不得嵌入魔方,含转动途中)三机制:
 *  1. 静置贴面 = 肉面标定(handPoses,蒙皮顶点距体表 0.7~0.8U 相切);
 *  2. 转层外让 = 非 weld 手整手沿本侧外向 x 平移(DODGE_MAG 幅度表,目标值
 *     是层角纯函数,与层动零延迟同步)—— 径向退出活动层扫掠圆柱,且沿贴面
 *     纯切向滑动不产生新穿透;禁用 per-finger 抬指方案(基节伸展会把骑棱指
 *     沿面上滑并向内推,反钻进角块,oracle 实测自伤);
 *  3. 回位/换握 slerp = 手沿径向外拱(接触半径 117U < 角柱扫掠半径 135.8U,
 *     不拱会削穿棱柱)。呼吸浮动只走切向(y + 本侧外向 x),禁接触法向 z。
 */
import * as THREE from "three";
import { SIZE } from "../define";
import { buildForearm, makeSkinDetailTexture, HAND_SCALE, WRIST_LOCAL, type HandModel, type FingerName } from "./handModel";
import { loadGltfHand } from "./handModelGltf";
import { bakeHandTextures, bakeLimbTextures, type HandBakedMaps } from "./bakeHandTexture";
import { addHandSkeleton, makeHandSkeletonMats, type SkeletonMatKey } from "./handSkeleton";
import { homeLeft, homeRight, type HandPose } from "./handPoses";

/** 只读 duck-type,避免运行时 import NxN Cube(rig 只碰 groups 的 angle)。 */
export interface HandsCubeLike {
  order: number;
  table: { groups: Record<"x" | "y" | "z", { angle: number }[]> };
}

/** group.ts CubeGroup.AXIS_VECTOR 的同款轴向(x=(-1,0,0) 等)。这里复制而非
 *  import,是为了让 rig 与 NxN 引擎零 import 耦合;若上游改轴向(不可能,
 *  记号语义锁死)需同步。 */
const AXIS_VEC: Record<"x" | "y" | "z", THREE.Vector3> = {
  x: new THREE.Vector3(-1, 0, 0),
  y: new THREE.Vector3(0, -1, 0),
  z: new THREE.Vector3(0, 0, -1),
};

export type HandSide = "L" | "R";
export type Axis = "x" | "y" | "z";
export type LayerClass = "high" | "low" | "mid" | "whole";

/** 指弹样式(规格与编排细节见同目录 FINGERTRICKS.md):
 *  topPush 食指越顶(双中手 F 族)/ hook 贴面勾拨(双中手 y 族,含连拨)/
 *  backHook 双中手 B' 右食指背钩 / downPush 左中右下 F 族右食指下拨 /
 *  upPush U' 推法(记号 U'p,右食指 RUB→BLU)。无 style = 遗留扫法(非标准握)。 */
export type FlickStyle = "topPush" | "hook" | "backHook" | "downPush" | "upPush";

export type HandGesture =
  | { kind: "weld"; hands: HandSide[] }
  | { kind: "flick"; hand: HandSide; finger: FingerName; finger2?: FingerName; style?: FlickStyle };

/** 两手当前握姿名(null = 非标准握,如 weld 途中/自定义积);由 grip 四元数判读。 */
export interface HandGripNames { R: GripName | null; L: GripName | null }

/** 播放/键盘路径的转前提示(prepareTwist 登记):quarters=180° 才连拨;push=U'p。 */
export interface TwistHint { quarters?: number; push?: boolean }

/**
 * (轴, 层类别, 转向, 握姿, 提示) → 手势。dir = sign(group.angle)(angle 绕 AXIS_VEC)。
 * 权威规格表在 FINGERTRICKS.md(改指法先改那里);直觉映射(标准配色正视 F 绿 U 白):
 *  R/L 外层 = 同侧手腕转;U 顺(dir>0)= 右食指弹,U' = 左食指;
 *  D = 左无名指,D' = 右无名指;F = 右拇指推,F' = 左拇指;
 *  B/B' = 后侧中指(双手指尖本就搭在 B 面);M/E/S 就近借同族手指。
 *  整体 x/y/z = 双手抱转(regrip 回位)。
 * 双中手(grips 全 home)专项:F 族「食指越顶」topPush;y 族走接触勾拨 hook
 * (U/U' 食指、D/D' 无名指,180° 提示时连拨:U2 食指→中指、D2' 小指→无名指);
 * B' 右食指 backHook(B 左食指镜像);U'p 右食指推 upPush。
 * 左中右下(L home + R down):F=右食指 downPush,F2 连拨食指→中指。
 * 非标准握一律回落遗留映射(几何未标定)。
 */
export function classifyHandGesture(
  axis: Axis, cls: LayerClass, dir: 1 | -1,
  grips: HandGripNames = { R: null, L: null }, hint?: TwistHint,
): HandGesture {
  const bothHome = grips.R === "home" && grips.L === "home";
  const double = (hint?.quarters ?? 1) >= 2;
  if (cls === "whole") return { kind: "weld", hands: ["L", "R"] };
  if (axis === "x") {
    if (cls === "high") return { kind: "weld", hands: ["R"] };
    if (cls === "low") return { kind: "weld", hands: ["L"] };
    return { kind: "flick", hand: dir < 0 ? "L" : "R", finger: "middle" }; // M 族
  }
  if (axis === "y") {
    if (cls === "high") {
      // U 族食指。U'p 推法:仅 U'(dir<0)方向、双中手、显式 push 提示。
      if (hint?.push && dir < 0 && bothHome) return { kind: "flick", hand: "R", finger: "index", style: "upPush" };
      const hand = dir > 0 ? "R" : "L";
      if (bothHome) {
        // U2 / U2' 双向连拨(2026-07-09 L 侧 hook_index/hook_middle2 镜像标定)。
        return double
          ? { kind: "flick", hand, finger: "index", finger2: "middle", style: "hook" } // U2/U2' 连拨
          : { kind: "flick", hand, finger: "index", style: "hook" };
      }
      return { kind: "flick", hand, finger: "index" };
    }
    const hand = dir < 0 ? "L" : "R";
    if (cls === "low" && bothHome) {
      // D2' / D2 双向连拨(2026-07-10 L 侧 hook_pinky/hook_ring2 镜像标定)。
      return double
        ? { kind: "flick", hand, finger: "pinky", finger2: "ring", style: "hook" } // 先小指后无名指
        : { kind: "flick", hand, finger: "ring", style: "hook" };
    }
    return { kind: "flick", hand, finger: "ring" }; // D / E 族(非标准握 / E)
  }
  // z 轴。F 族分手依据:拇指伸展 = 沿 F 面向上扫,F(dir>0)使左列上行 → 左拇指,
  // F' 使右列上行 → 右拇指(冻结层角实测过,反着配会出现「层往下、指往上」)。
  if (cls === "high") {
    if (grips.L === "home" && grips.R === "down" && dir > 0) {
      // 左中右下 F 族:右食指在 down 握天然压 U 面 UFR 区,下拨;F2 连拨接中指。
      return double
        ? { kind: "flick", hand: "R", finger: "index", finger2: "middle", style: "downPush" }
        : { kind: "flick", hand: "R", finger: "index", style: "downPush" };
    }
    if (bothHome) return { kind: "flick", hand: dir > 0 ? "R" : "L", finger: "index", style: "topPush" };
    return { kind: "flick", hand: dir > 0 ? "L" : "R", finger: "thumb" }; // F 族
  }
  if (cls === "low" && bothHome) {
    // 双中手 B'(dir>0)= 右食指背钩;B = 左食指镜像(FINGERTRICKS §4.2 推定)。
    // B2 / B2' 双向连拨(2026-07-10 backHook_middle2 标定):先食指后中指,
    // 首指 Q2 极早期沿 BACK_EXIT 退场(同 U2 的 HOOK_EXIT 编排)。
    const hand = dir > 0 ? "R" : "L";
    return double
      ? { kind: "flick", hand, finger: "index", finger2: "middle", style: "backHook" }
      : { kind: "flick", hand, finger: "index", style: "backHook" };
  }
  return { kind: "flick", hand: dir < 0 ? "L" : "R", finger: "middle" }; // B / S 族
}

/** 活动层集合 → 层类别。外层优先(宽层 Rw 含 N-1 → 按 R 族做手势)。 */
export function classifyLayers(layers: number[], order: number): LayerClass {
  const hasHigh = layers.includes(order - 1);
  const hasLow = layers.includes(0);
  if (layers.length >= order || (hasHigh && hasLow)) return "whole";
  if (hasHigh) return "high";
  if (hasLow) return "low";
  return "mid";
}

/** 90° 精确跟手;180°(U2 等)超过 SOFT_LIMIT 的部分压缩 — 手腕不拧断。 */
function softClampAngle(a: number): number {
  const LIMIT = 1.62; // ≈93°
  const abs = Math.abs(a);
  if (abs <= LIMIT) return a;
  return Math.sign(a) * (LIMIT + (abs - LIMIT) * 0.28);
}

const HALF_PI = Math.PI / 2;

/** 换握目标 */
export type GripName = "home" | "up" | "down";

/**
 * 换握基座四元数:up=上手(拇指起手在 U 面,恰等于 home 被 R/L' 提交后的腕姿),
 * down=下手(D 面)。两手同为绕 x 轴 ±90°(绕 x 的旋转在 x=0 镜像下不变,左右共用)。
 */
export function gripQuat(name: GripName): THREE.Quaternion {
  const q = new THREE.Quaternion();
  if (name === "up") q.setFromAxisAngle(AXIS_VEC.x, HALF_PI);
  else if (name === "down") q.setFromAxisAngle(AXIS_VEC.x, -HALF_PI);
  return q;
}

export type GripSimStep =
  | { grip: GripName; side?: HandSide } // side 缺省 = 双手(FINGERTRICKS §2:紧贴=R / 空格=L)
  | { axis: Axis; layers: number[]; quarters: number };

/**
 * 静态推演一串(转动 / 换握记号)后的两手握姿基座 — 跳步 / 拖进度条用,
 * 结果与逐步 live 播放的 weld 烘入一致(flick 不改握,weld 按层转烘入)。
 */
export function simulateGrips(steps: GripSimStep[], order: number): { R: THREE.Quaternion; L: THREE.Quaternion } {
  const grips = { R: new THREE.Quaternion(), L: new THREE.Quaternion() };
  const q = new THREE.Quaternion();
  for (const s of steps) {
    if ("grip" in s) {
      for (const side of s.side ? [s.side] : (["R", "L"] as const)) grips[side].copy(gripQuat(s.grip));
      continue;
    }
    if (s.quarters === 0 || s.layers.length === 0) continue;
    const cls = classifyLayers(s.layers, order);
    if (cls === "whole") continue; // 整体转体不烘(live 同款:黏着转+踏移,提交即在 home 频段,#20)
    if (s.axis !== "x") continue; // 只有 x 轴单层 weld 烘入(y/z 无 weld 手势)
    const g = classifyHandGesture(s.axis, cls, s.quarters > 0 ? 1 : -1);
    if (g.kind !== "weld") continue;
    q.setFromAxisAngle(AXIS_VEC[s.axis], s.quarters * HALF_PI);
    for (const h of g.hands) grips[h].premultiply(q);
  }
  return grips;
}

const FADE_MS = 240;
const RECOVER_MS = 300;
const IDLE_KEEPALIVE_MS = 6000;
/** 手势判向的最小角度 — angle 起步为 0,超过此值才提交方向。 */
const COMMIT_ANGLE = 0.02;

/**
 * 转层外让幅度表(世界单位):非 weld 手在该(轴,层类)转动期间沿本侧外向 x
 * 平移多远。方向学问:±x 同时垂直于 y/z 转轴(平移=纯径向退出扫掠圆柱)且与
 * 各贴面(B/F 的 z 法向)正交(沿面纯切向滑动,不产生新穿透)—— 是唯一对
 * 所有 y/z 招式都安全的单一方向。幅度由穿模 oracle(蒙皮顶点 vs 静止层箱体 +
 * 反旋活动层箱体)标定:活动层角柱扫掠半径 96√2≈135.8U,指腹接触半径 ~134U,
 * 外层转动小让即可;E(赤道)会犁过贴 F 面的拇指整块肉(径向 117U,关节动作
 * 无解),必须大让 =「双手松握让赤道层转」;B 族犁中节侧肉(径向 ~117U)。
 * x 轴:R/L 是 weld,M 层扫掠区(|x|≤32+沿轴余量)碰不到指肉(x≥75),零让。
 */
const DODGE_MAG: Record<Axis, Record<LayerClass, number>> = {
  x: { high: 0, low: 0, mid: 0, whole: 0 },
  // y.high 0(2026-07-09 用户规格「手作为整体任何时候不远离魔方,单指可以」):
  // U 族静止手不再整手平移(旧 16),改静止手食指单指离面避让,见
  // HOOK_INDEX_EVADE。
  // y.low 0(2026-07-09 同规格迁移):D 族静止手改「无名指 + 拇指」单指避让,
  // 见 LOW_EVADE。dodge=0 且无避让的裸基线(2026-07-09 全顶点冻结扫,双向
  // + 180°):① 静止手无名指末节肉(骑 B 面下部 BDL/BDR)被 D 层角柱蹭
  // 3.7~5.4U@θ≈0.05-0.25;② 静止手拇指末节下缘肉(y≈-44..-49 越过 D 界
  // -32,径向 ~119U < 角柱 135.8U)被犁 11.5~11.7U@θ≈1.0-1.5(旧注释的
  // 「大鱼际 3.4U」实测主犯是拇指末节肉,拇指单指避让直接可解)。
  // y.mid 0(2026-07-09 同规格迁移):E 族改双手「拇指 + 中指(+ 弹指无名指)」
  // 单指避让,见 MID_EVADE。dodge=0 且无避让的裸基线(全顶点冻结扫,双向
  // + 180°):双手拇指末节肉被 E 带角柱犁 9.2~11.3U、双手中指末节肉
  // 6.0~7.5U、弹指手无名指自身扫掠探进 4.3~4.8U、弹指手食指被腕借力压进
  // 静止 U 带 ~3U(借力已随迁移归零,见 driveGesture)。旧注释「E 犁拇指
  // 整块肉 + 掌体,关节动作无解」实测不成立:受害全是末节单指肉,无掌体命中。
  y: { high: 0, low: 0, mid: 0, whole: 0 },
  // z.low 0(2026-07-09 同规格迁移):B 族静止手改「食指 + 中指」单指避让,
  // 见 B_EVADE。dodge=0 且无避让的裸基线(全顶点冻结扫,双向 + 180°):
  // ① 静止手食指末节尖肉(BUL/BUR 角,z≈−95)被 B 层角柱蹭
  // 0.7~1.4U@θ≈1.33-1.42;② 静止手中指中节侧肉(骑 BL/BR 棱,径向 ~132U)
  // 被犁 2.3U@θ≈0.83(仅 B' 的静止 L 手)。无名指/拇指/掌体全程干净,旧
  // 「必须让 40U」严重高估。180° 深穿(11.9/19.4U)是**弹指手自身**食指
  // softClamp 后被 Q2 扫掠 —— 旧 dodge 本就不覆盖弹指手(styled 排除),
  // 既有残差,见 FINGERTRICKS §6。
  // z.high 0(2026-07-09 同规格迁移):F 族非 topPush/downPush 分支(非双中手
  // 握持的遗留拇指上扫)改单指离面避让,见 F_EVADE;弹指腕借力对 z.high 同步
  // 归零(见 driveGesture)。dodge=0 且借力=0 的裸基线(全顶点冻结扫,双向
  // + 180°,up/down/home 全部 8 种组合):up 握手拇指末节被 F 层角柱犁
  // 11.5~11.7U、无名指 3.7~5.4U;down 握手食指 0.7~2.4U;home 握手全程干净
  // (贴 B/F 面的指肉都在 F 带 z∈[32,96] 外)。另有借力单独贡献的 up 握弹指
  // 手中指 6.0U/食指 2.8U 静态箱穿(归零借力即清)。双中手 topPush/downPush
  // 本就整段免让(driveGesture 早退),不受迁移影响。
  // z.mid 0(2026-07-09 同规格迁移):S 族。home 握全程干净(dodge=0 裸基线,
  // 全顶点冻结扫 0.94°/步双向 + 180°:贴 B 面指列 z≈−98、拇指 z≈+99 都在
  // S 带 z∈[−32,32] 外,最近点只有弹指手无名指扫掠瞬时 −1.77U 负值)——
  // 旧幅度 10 对 home 握纯属保险。up/down 握才有真受害(改 S_EVADE 单指
  // 避让,见该注释;弹指腕借力对 z.mid 同步归零,见 driveGesture):
  // 双手拇指末节 9.2~11.2U + 静止手中指末节 5.9~7.3U —— 旧 dodge=10 本就
  // 兜不住(真实播放 R S R' S' 实测照穿 6.7U,既有暴露)。
  z: { high: 0, low: 0, mid: 0, whole: 0 },
};

/**
 * 「食指越顶」(style:"topPush",双手 home 握的 F 族)动作参数:手根不动,
 * 食指先沿 B 面竖直抬升(splay,越过 U 面 + 间隙),再大幅前卷 MCP(c1)+
 * 拉直中末节,指链从魔方上方横越 U 面,指尖落到 UFR/UFL 角块 U 面贴纸上方。
 * 用户规格:F 转动开始**之前**指尖就要到位 —— 伸指(reach)是时间驱动的前置
 * 动画(REACH_MS,prepareTwist 启动,播放循环闸步等 isReachPreparing),
 * 转动期间只有下压(press)随层角;拖拽/键盘没有前置窗口,beginGesture 补
 * 触发与层角并发。抬升先行、前卷后动(liftIn < sweepStart 语义):指尖起点
 * 就骑在 B 面上棱沿,先卷会立刻犁进 U 面。回程(reachTarget=0)同一参数化
 * 倒放,先收卷再落指,路径对称安全。数值浏览器内标定 + 穿模 oracle 验证。
 */
const TOP_PUSH = {
  liftIn: 0.5,    // reach 前半段完成抬升
  sweepStart: 0.15, // 前卷从 reach 15% 起动(抬升先行)
  c1: 0.66,       // MCP 前卷幅度(rad;过大越过贴纸冲到角外缘,坐标下降定档)
  c2: 0.18,       // 中节加弯(用户规格:按压时弯曲要明显,别伸直戳)
  c3: 0.15,       // 末节加弯
  lift: 0.54,     // 抬升量(splay rad;弯曲平面前斜,前卷伴随下沉,~207U/rad 补偿)
  backOff: 0.03,  // reach 早段微伸(c1 −,sin 包络):抬升弧面稍向内斜,不退
                  // 一点指腹会蹭进 B 面上沿(oracle 实测 2.65U)
  // —— 转动物理跟随(用户硬规格:F 转动时**只有食指动**,手根/其余手指/
  // 另一只手一律静止;且四分转**全程**指尖贴住初始 UFR 角块)—— 接触点绕
  // z 走弧,弧长全部由食指四关节的 TOP_PUSH_FOLLOW 曲线补(见下),指尖钉在
  // 角块贴纸上、贴纸在指腹下滑转;不动腕 weld、不做 dodge(driveGesture 里
  // topPush 整段跳过外让 —— 静止手安全性靠 home 姿指腹接触半径 ≥136U >
  // 角柱扫掠 135.8U)。按压不是独立通道:knot0 就是按压姿(reach 一到位指腹
  // 即贴到贴纸 ~1.2U,转动开始之前已接触 —— 推动 = 先接触后运动)。转过
  // releaseAt(=90°,四分转终点)后才弹离(follow 渐出 + 额外抬升退出角柱
  // 扫掠区),只有 F2 的第二个 90° 走释放滑行。release 用未钳制层角(F2 的
  // UFL 角 ~2.27rad 扫到指位,必须按原角先弹离)。
  releaseAt: HALF_PI, // 释放起点(rad,原角):四分转全程接触
  releaseLen: 0.28, // 释放行程(~1.85rad 完全弹离;0.5 时倒退太慢,F2 第二象限
                    // 来料棱块在 θ≈1.85 追上手指,oracle 实测 pen +4.8 → 收紧)
  releaseLift: 0.2, // 弹离额外抬升(splay rad,指腹退出扫掠半径 135.8U)
  // —— 收指退场(提交后)—— 层已归位,凭空造的退路全被 oracle 毙掉:弧倒退
  // 指腹犁进已还原方块 U 面内缘 ~25U;弧姿态与收指 reach 并行衰减的合成弦线
  // 斜穿方块内部(pen +41);splay 抬离在弧末端(指腹贴 R 面)是切向,越抬越
  // 切进前柱(+14);沿掌轴伸直的 c1 展开扫弧直接穿心(+63)。唯一已验证绿的
  // 离场编排 = F2 的 release 路径(弧倒退 ×3 速 + releaseLift,F2 全程扫描
  // 实证):层方块占位 90° 周期(slab(θ)≡slab(θ−90°)),四分转提交后让原角
  // **虚拟续转**推进走完 release 窗口,姿态与已验证的 release 点对点相同,
  // 对静止层的占位失配 ≤ releaseLen(0.28rad)且恰在已抬离段。串行:reach 钳
  // 在 1,decay 段跑虚拟 release,走完才收指(从带 releaseLift 的按压位倒放
  // reach 路径)。小角度残余(拖拽回弹,提交角 < retreatSplit)按 decay 原地
  // 缩回按压位(φ 小时弧退对静止层安全)。
  retreatSplit: 1.2, // 提交原角 ≥ 此值走「虚拟续转 release」离场,否则原地缩回
};
/**
 * 接触跟随曲线:指尖钉住随层转的角块贴纸一路到终点(用户规格:F 时初始
 * UFR 角块转到哪、指尖跟到哪,终点 DFR)。食指独臂可达域不够(MCP 到终点
 * 269U > 指长 237U,实测差 32U),由「原地腕转」通道 wrist 补:手根绕
 * 「过腕点、平行转轴 z」的轴原地翻转 ψ —— 腕点自身不动 → 前臂(锚在腕点)
 * 全程静止、手掌不离位,视觉 = 真人压腕推 F;其余弧长由食指四关节
 * {c1,c2,c3,splay} 跟随。每 2.5° 层角一个 knot(37 个),线性插值;φ 封顶
 * 90°(F2 第二象限由 release 弹离)。knot0 = 按压姿(φ→0 指腹贴到贴纸
 * ~1.2U,wrist[0]=0)。**两手各一套**:left.glb 镜像资产 ~2U 雕刻不对称,
 * 共用一套 L 手会嵌进贴纸 1.6U(同 LEFT_CURL_OFFSET 先例,必须各解各的)。
 * 数值浏览器内连续化坐标下降标定(2.5° 步、上一 knot 热启动保同一 IK 分支 ——
 * 各 knot 独立解会落进不同零空间盆地,之字形插值段实测嵌 12U;判据:计数
 * 回转 −φ 后指尖钉住按压锚点、末节肉垫距贴纸 ~1.2U、接触点不出本角块贴纸、
 * 食指顶点两域穿模 ≤0)。1° 细扫复核:R gap 0.43~2.44 / L gap 0.43~2.73,
 * 穿模 ≤−0.43,腕转 ψ≤|0.345|(≈20°,~60° 层角前为 0)。改 home 姿 /
 * HAND_SCALE 必须重标(rig.tuning 现场调,烘回此处;工具见 memory
 * project_sim_hands_rig)。
 */
const TOP_PUSH_FOLLOW = {
  R: {
    c1: [0, 0, -0.015, -0.06, -0.06, -0.06, -0.075, -0.09, -0.09, -0.09, -0.105, -0.075, -0.075, -0.075, -0.06, -0.045, -0.045, -0.045, -0.015, -0.015, 0.015, 0.015, 0.03, 0.045, 0.075, 0.09, 0.135, 0.135, 0.135, 0.15, 0.15, 0.15, 0.15, 0.12, 0.12, 0.135, 0.135],
    c2: [0, 0, 0.09, 0.195, 0.18, 0.21, 0.285, 0.36, 0.42, 0.48, 0.54, 0.51, 0.555, 0.585, 0.585, 0.6, 0.645, 0.66, 0.66, 0.675, 0.66, 0.66, 0.645, 0.63, 0.585, 0.54, 0.51, 0.48, 0.48, 0.435, 0.435, 0.42, 0.42, 0.435, 0.405, 0.36, 0.33],
    c3: [0, 0.03, 0.03, 0.12, 0.27, 0.33, 0.315, 0.24, 0.21, 0.18, 0.15, 0.18, 0.165, 0.165, 0.135, 0.105, 0.015, -0.03, -0.105, -0.18, -0.225, -0.27, -0.315, -0.375, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435, -0.435],
    // splay[0..2] 比标定值抬浅 0.006(锚点在 φ=0.03 倾斜系测 gap 1.2,换算回
    // θ=0 差 x′·sinφ≈2U,按压位实测下陷 0.78 → 抬 ~1.2U 回到面上)
    splay: [-0.0303, -0.0303, -0.0303, -0.0513, -0.0663, -0.0813, -0.0963, -0.1263, -0.1413, -0.1713, -0.2013, -0.2163, -0.2613, -0.3063, -0.3213, -0.3663, -0.4113, -0.4563, -0.4713, -0.5163, -0.5463, -0.5763, -0.6063, -0.6363, -0.6513, -0.6813, -0.6513, -0.6813, -0.6663, -0.6663, -0.6513, -0.6513, -0.6213, -0.6213, -0.6063, -0.5913, -0.5763],
    wrist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.015, -0.045, -0.06, -0.105, -0.12, -0.15, -0.18, -0.225, -0.27, -0.3, -0.315, -0.345],
  },
  L: {
    c1: [0, 0, -0.015, -0.03, -0.075, -0.075, -0.075, -0.09, -0.09, -0.09, -0.105, -0.075, -0.06, -0.015, -0.03, -0.015, 0, 0, 0.03, 0.045, 0.075, 0.105, 0.12, 0.15, 0.18, 0.195, 0.24, 0.255, 0.27, 0.27, 0.285, 0.285, 0.315, 0.345, 0.375, 0.375, 0.375],
    c2: [0, 0, 0.045, 0.09, 0.195, 0.255, 0.315, 0.405, 0.465, 0.495, 0.54, 0.525, 0.54, 0.525, 0.54, 0.555, 0.555, 0.555, 0.525, 0.525, 0.495, 0.465, 0.45, 0.42, 0.39, 0.345, 0.315, 0.24, 0.225, 0.21, 0.18, 0.15, 0.105, 0.015, -0.075, -0.105, -0.135],
    c3: [0, 0.015, 0.18, 0.285, 0.27, 0.255, 0.21, 0.135, 0.075, 0.09, 0.105, 0.09, 0.06, 0.075, 0.06, 0.03, -0.015, -0.03, -0.045, -0.12, -0.18, -0.21, -0.27, -0.345, -0.45, -0.405, -0.435, -0.39, -0.51, -0.51, -0.51, -0.51, -0.51, -0.51, -0.51, -0.51, -0.51],
    // 同 R:抬浅 0.007(L 按压位实测下陷 1.13)
    splay: [-0.0214, -0.0214, -0.0214, -0.0434, -0.0734, -0.0884, -0.1034, -0.1334, -0.1634, -0.2084, -0.2384, -0.2684, -0.2834, -0.3134, -0.3584, -0.4034, -0.4484, -0.4934, -0.5384, -0.5684, -0.5834, -0.6134, -0.6434, -0.6584, -0.6884, -0.6884, -0.6734, -0.6884, -0.6734, -0.6734, -0.6584, -0.6584, -0.6284, -0.6284, -0.6134, -0.5984, -0.5834],
    wrist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.015, 0.03, 0.06, 0.075, 0.105, 0.15, 0.18, 0.21, 0.24, 0.255, 0.285, 0.315, 0.345],
  },
};
/** knot 线性插值;φ=k×2.5° 恰落第 k 个 knot(标定时单点解耦)。 */
function followAt(arr: number[], phi: number): number {
  const t = Math.min(1, phi / HALF_PI) * (arr.length - 1);
  const i = Math.min(arr.length - 2, Math.floor(t));
  return arr[i] + (arr[i + 1] - arr[i]) * (t - i);
}
const REACH_MS = 200;
/** topPush 释放进度(0=按压跟随,1=完全弹离);t = |未钳制层角|。 */
function topPushRelease(t: number): number {
  const x = Math.min(1, Math.max(0, (t - TOP_PUSH.releaseAt) / TOP_PUSH.releaseLen));
  return x * x * (3 - 2 * x);
}
/**
 * topPush 弧位置(rad):release 段沿标定弧**倒退**(手指原路退回起始按压位,
 * 比层角快 ~3 倍)—— 禁把 follow 幅度直接 ×(1−rel) 淡出:关节角朝 hover 姿
 * 插值走的是弦线,切进魔方内部(F2 实测 pen +30)。倒退路径上手指与来料
 * 角块在同槽位相遇时,姿态恰是该槽位的标定接触姿(间隙 ≥0.4),天然安全。
 */
function topPushArcPhi(rawAbs: number): number {
  return Math.min(HALF_PI, rawAbs) * (1 - topPushRelease(rawAbs));
}

/** 贴面勾拨基础曲线(y 族勾弯 + 双中手接触样式 hook/backHook 共用)。
 *  数值 = 旧 y 勾弯内联常量抽出(视觉不变);接触带由浏览器 oracle 标定微调。 */
const HOOK = {
  c1: -0.34, // 基节伸展:指尖抬离层面(位置上退不扎层)
  c2: 0.52,  // 中节勾弯(可见的向掌心勾)
  c3: 0.42,
  drift: 0.22, // splay 横拉系数(×扫角)
  open: 1.3,   // 弯曲饱和角
};

/** 连拨次指 Q1 就位姿(FINGERTRICKS §4.1:首指扫前 90° 期间次指渐入就位,
 *  90° 处接力)。键 = 次指名,两手各一套(2026-07-09 U2' 镜像标定:共享值
 *  ×sideSign 的镜像对 L 差 ~1.4U —— 资产不对称,Q1 末 θ≈1.30 角部扫掠窗
 *  蹭中 L3 中节;splay 语义仍 ×sideSign,L 值按 L 手密扫单解)。
 *  数值浏览器标定(rig.tuning 现场调)。 */
const HOOK_PREP: Record<HandSide, Partial<Record<string, { c1: number; c2: number; c3: number; splay: number }>>> = {
  R: {
    hook_middle: { c1: -0.29, c2: 0.309, c3: 0.0093, splay: 0.468 }, // U2 次指:中指沿 B 面上探 U 层带,90° 交接处进带;0.024rad 热窗密解(粗采样漏 slab 角部 −12U)
    hook_ring: { c1: -0.12, c2: 0.06, c3: 0.04, splay: -0.08 },     // D2' 次指:无名指微让位再接力
    // B2' 次指:中指沿 B 面上探顶带(BUR 区,与 hook_middle 同类攀爬),
    // 90° 交接处接住 Q2 来料。数值浏览器标定(种子 = hook_middle)。
    backHook_middle: { c1: -0.29, c2: 0.309, c3: 0.0093, splay: 0.468 },
  },
  L: {
    // U2' 次指:R 值镜像起点上 0.02rad 密网格(Q1 每 0.02 + Q2 每 1.5° 全顶点
    // + 贴角保持)重解 —— 共享值在 L 差 c3/splay 各 ~0.02rad,Q1 末角部窗
    // +1.36U → 全程 ≤ −0.02U。
    hook_middle: { c1: -0.29, c2: 0.309, c3: -0.0107, splay: 0.488 },
    hook_ring: { c1: -0.12, c2: 0.06, c3: 0.04, splay: -0.08 },
    backHook_middle: { c1: -0.29, c2: 0.309, c3: -0.0107, splay: 0.488 },
  },
};

/** 样式化指法跟随曲线(FINGERTRICKS §4.0「贴面」):每通道二次型
 *  v(s) = lin·s + quad·s²,s = 本指扫角/90°。键 = `${style}_${finger}` + 连拨
 *  次指后缀 "2"(U=hook_index / D'=hook_ring / D2'=hook_pinky+hook_ring2 /
 *  U2 次指=hook_middle2 / B'=backHook_index / 右下手 F=downPush_index+
 *  downPush_middle2 / U'p=upPush_index)。两手各一套(镜像资产不对称,同
 *  topPush 先例);数值浏览器 oracle 坐标下降标定(判据:指腹对活动层 gap
 *  贴带 [0.6,2.6] + 全局 pen ≤0),改 home 姿必须重标。缺键回退各样式默认
 *  常量。splay 为本手局部值(不再 ×sideSign,两手各解各的)。三次项给「中段
 *  追面、末端归位」的弓形留自由度(二次型贴到 83° 后末端回不了家,实测)。 */
type HookFit = { c1: [number, number, number]; c2: [number, number, number]; c3: [number, number, number]; splay: [number, number, number] };
/** 2026-07-08 浏览器坐标下降解,密采样版(θ 步长 0.08/0.09 全程 + 400·pen² +
 *  接触带 hinge [0.6,2.6] + endHome 正则;粗采样曾漏掉 slab 角部窄窗口 ——
 *  方形层 45° 时角伸出 √2 半宽,扫过指节只在 ~0.1rad 窗口现形,重解后全清,
 *  唯余起始 θ≈0.05 的 −0.42U 结构残差:cubic 在 s=0 无力,home 指腹本就停在
 *  角部扫掠带内,真实播放该角度仅 1 帧)。downPush_* 与 hook_index/hook_middle2
 *  同值不是巧合:下手握 = home 绕 x 刚体转 −90°,F 层相对手的几何与 U 层完全
 *  同构(零跟随基线逐位相同,oracle 实证),关节空间解可整套移植。 */
const HOOK_FOLLOW: Record<HandSide, Record<string, HookFit>> = {
  R: {
    // hook_index 全曲线重解(2026-07-09 r3,U/U2-Q1「贴面扫到角 M」):12 参数
    // 节点参数化(每通道 v(1/3)/v(2/3)/v(1),中段塑形与端点解耦)坐标下降,
    // cost = 全顶点穿透罚 400·pen²(θ 每 1.5° + 末端着陆窗 0.5° + 提交点本尊,
    // 漏采样提交点会被 solver 牺牲,踩过)+ 贴面带 hinge + M-touch 端点。
    // 端点禁硬钉 3D 点:r1 的 (109,66,66) 钉点姿本身肉侵入 12.6U(distal 下缘
    // 肉卷进角块内),物理不可行 —— 改「pad 肉垫贴 RUF 角块 M 贴纸」接触目标
    // (x−96 ∈ [0.2,1.4] 于贴纸足迹 y,z∈[36,92])+ tip 骨 y/z 松钉贴纸中带。
    // 解:全程 pen ≤ 0(冻结 1.5° 细扫),提交姿 pad 贴 M 间隙 1.31U,
    // tip (116.5,63.3,67.5)。中段路径 = 骑着转动层凸轮面走 R 面外侧走廊。
    hook_index: { c1: [2.0913, -7.605, 6.0985], c2: [-3.2437, 12.8925, -9.0084], c3: [-0.6026, 3.5474, -2.6099], splay: [-1.0552, 1.7857, -0.9633] },
    hook_ring: { c1: [0.001, -0.5045, 0.5795], c2: [1.3257, -1.1291, 0.4743], c3: [0.1113, -0.0262, -0.2939], splay: [-0.21, 0.3862, 0.1281] },
    // hook_middle2 全曲线重解(2026-07-09 r3,U2 规格「第二个 U 做完 R3 紧贴
    // 角 M」):方法同 hook_index(全顶点罚 + M-touch 端点;r2 的「骨端扩壳箱
    // 余量 10U」低估肉厚,全顶点复测 Q2 末穿 23.6U / 提交姿穿 18.8U)。解:
    // Q2 全程 pen ≤ +0.06U 瞬态,提交姿 pad 贴 M 间隙 1.38U,tip (118.4,61.7,79.7)。
    hook_middle2: { c1: [0.2654, -1.1002, 1.676], c2: [-1.1264, 5.7823, -4.4656], c3: [4.4818, -4.8895, 0.6305], splay: [0.1777, -1.8721, 1.6047] },
    hook_pinky: { c1: [0.2484, -0.21, 0.0182], c2: [0.7997, -0.5291, -0.0955], c3: [-0.2046, 0.2746, -0.155], splay: [-0.1375, 0.008, 0.1] },
    hook_ring2: { c1: [0.041, -0.382, 0.5732], c2: [1.7475, -1.4909, 0.3643], c3: [0.8482, -0.6875, -0.4179], splay: [-0.34, 0.37, 0.1144] },
    backHook_index: { c1: [-0.18, 0.15, 0.069], c2: [-0.03, 0, 0.0857], c3: [0.1967, 0.1108, 0.0428], splay: [0.5063, -0.1012, -0.0764] },
    // B2' 次指 Q2 跟随(2026-07-10 连拨标定):prep 攀到 B 面顶带后,沿右侧
    // 弧下潜接住来料(与 backHook_index 的 Q1 弧同族)。节点参数化 12 参
    // 坐标下降(全顶点罚每 0.026rad + 贴面带 + 落地窗 ≥1.1U 软目标):Q2
    // 全程 pen ≤ −0.17(走廊窄段 0.17~0.26U 余量),提交 pad gap 0.83U,
    // tip (109.5, 26.9, −119.6)。
    backHook_middle2: { c1: [0.4058, -1.0737, 0.6268], c2: [0.6442, -1.1839, 0.6754], c3: [-1.0226, 3.6657, -2.2927], splay: [0.8339, -1.3842, 0.959] },
    downPush_index: { c1: [-0.03, -0.45, 0.3], c2: [1.26, -0.81, -0.27], c3: [-0.0614, 0.5774, -0.4054], splay: [-0.3427, 0.0532, 0.1695] },
    downPush_middle2: { c1: [0.19, -0.36, 0.096], c2: [0.784, -0.704, 0.2988], c3: [-0.4291, 0.7306, 0.1306], splay: [-0.336, 0.22, -0.02] },
    // upPush 推行程 v1:独臂只跟得住起推段(RUB→BLU 弧长 ~190U 超出可达域,
    // 全程贴块需「腕偏航 + 其余四指同步避让」的整手编排,留待后续;wrist 通道
    // 已备,见 UP_PUSH)。
    upPush_index: { c1: [0, 0.3375, 0.0731], c2: [-0.4862, -0.1475, 0], c3: [-0.5769, -0.2337, -0.2719], splay: [0, 0, 0] },
  },
  L: {
    // hook_index 全曲线重解(2026-07-09 U2' 镜像标定,方法同 R 侧 r3:节点
    // 参数化 12 参 + 每 1.5° 全顶点罚 + M-touch 镜像端点 —— U'/U2'-Q1 做完
    // L2 贴 UFL 角块 L 面贴纸,x+96 ∈ [0.2,1.4] 于 y,z∈[36,92];起点 = R 侧
    // r3 fit 镜像)。解:冻结细扫全程 pen ≤ 0,提交姿 pad 贴镜像角 M 间隙
    // 1.56U,tip (−118.8, 69.9, 55.6)。顺带解决 §6「U' 终点贴块未标定」。
    hook_index: { c1: [1.9138, -6.75, 5.401], c2: [-2.7937, 11.1825, -7.7934], c3: [0.0599, 1.8149, -1.6199], splay: [1.2602, -2.2807, 1.2783] },
    hook_ring: { c1: [0.001, -0.7134, 0.7419], c2: [1.3557, -1.0769, 0.5043], c3: [0.187, -0.1418, -0.3372], splay: [0.27, -0.3878, -0.1444] },
    // hook_middle2 镜像标定(2026-07-09,U2' 次指 L3 的 Q2 走廊,方法同 R 侧
    // r3:节点参数化 12 参重解 + 每 1.5° 全顶点罚 + M-touch 镜像端点 —— U2'
    // 终点 = 角 M 的 x 镜像贴纸,即 UFL 角块 L 面贴纸,x+96 ∈ [0.2,1.4] 于
    // y,z∈[36,92];起点 = R 值 c 通道同 / splay 反号)。解:Q2 全程 pen ≤
    // +0.02U 瞬态,提交姿 pad 贴镜像角 M 间隙 1.16U,tip (−118.6, 61.8, 82.2)
    // (端点带下限提到 1.1U 重精修 —— 首解 0.52U 太贴,回撤攻窗 kFit=1 保持
    // 提交姿 + 凸包渐升会瞬时压进贴纸,同 R 侧 1.38U 余量的经验)。
    hook_middle2: { c1: [-0.7609, 2.0498, -0.4278], c2: [0.4223, 1.9573, -2.2044], c3: [7.318, -12.0782, 4.9055], splay: [0.2073, 1.3996, -1.4922] },
    // D2 连拨镜像标定(2026-07-10,方法同 U2' L 侧:起点 = R 值 c 通道同 /
    // splay 反号,节点参数化 12 参 + 每 1.5° 全顶点罚 + 锚种子正则重解;贴面
    // 契约 —— D 族无 M-touch 端点,gap 走廊照抄 R 侧轮廓)。资产不对称只出
    // ~0.2U 量级(≪ U2' 的 1.4U):hook_pinky 仅端点节点 v(1) 抬 +0.02rad
    // (清 Q2 冻结保持段 +0.16U → 全程 ≤ −0.51U,首指做完停位必须在后续角柱
    // 扫掠环带外 —— D2' 首指无 HOOK_EXIT 同款退场,靠端姿本身出带,镜像同);
    // hook_ring2 仅 c2 前段节点 v(1/3) −0.06rad(清 Q2 走廊 +0.07U 瞬态)。
    // 解:Q1 pinky pen ≤ −0.76 / Q2 ring pen 全负、贴面收尾 gap 0.42U。
    hook_pinky: { c1: [0.2684, -0.3, 0.1082], c2: [0.7997, -0.5291, -0.0955], c3: [-0.2046, 0.2746, -0.155], splay: [0.1375, -0.008, -0.1] },
    hook_ring2: { c1: [0.041, -0.382, 0.5732], c2: [1.2075, -0.1409, -0.4457], c3: [0.8482, -0.6875, -0.4179], splay: [0.34, -0.37, -0.1144] },
    // backHook_index 端节点微调(2026-07-10 B2 连拨标定):L 侧 Q1 末端姿顶点
    // 在 90° 边界恰贴来料角柱(1.5° 后 +0.85U,BACK_EXIT ramp 物理来不及)——
    // 同 D2 pinky 方案,端节点 v(1) 微调 [−0.06, +0.06, −0.188, +0.2] 把停位
    // 挪出早窗(v(1/3)/v(2/3) 不动,Q1 走廊不变),90° pad gap 1.81U、
    // tip90 (−106.1, 76.5, −110)。单拨 B 提交姿同此(共享 fit)。
    backHook_index: { c1: [-0.085, 0.27, -0.27], c2: [0.085, -0.1843, 0.2954], c3: [-0.3035, 1.0859, -0.8159], splay: [-0.2433, -0.6981, 0.9495] },
    // B2 次指 Q2 跟随(2026-07-10 连拨标定,B2' 的 x 镜像;方法同 R 侧)。解:
    // Q2 全程 pen ≤ +0.05U 冻结瞬态(走廊 θ≈2.14-2.22 蹭零),提交 pad gap
    // 1.02U,tip (−99.2, 66.5, −117.8)。
    backHook_middle2: { c1: [0.3354, -0.3614, 0.0009], c2: [0.0249, 0.0859, 0.0252], c3: [0.7329, -2.2905, 1.741], splay: [-0.7929, 0.5265, 0.0626] },
  },
};
const fitAt = (f: HookFit, ch: keyof HookFit, s: number): number => ((f[ch][2] * s + f[ch][1]) * s + f[ch][0]) * s;

/** D2' 首指小指前置伸指(prepareTwist 时间驱动 reach):小指 home 收拢悬空,
 *  先伸至 D 层 BDR 接触位再起转(连拨第一击也要贴面)。数值浏览器标定。 */
const PINKY_REACH = { c1: -0.26, c2: 0.19, c3: 0, splay: 0.02 };

/** D 族接触勾拨的拇指避让:D/D' 前 ~40° D 层 F 面材料扫过拇指下缘扇区
 *  (y<−32 的拇指肉半径 ~110U < 角柱扫掠 135.8U,零跟随 oracle 实测 pen
 *  −7.8@θ=0.35)。旧方案 = 整手外让 44U,接触规格下弹指手不能让 → 改拇指
 *  自己抬避(沿 F 面切向安全)。进度 = sm(min(1,|层角|/0.12)),decay 同乘
 *  回位;窗口过后(θ>0.8)保持避让姿到 drop(斜落回反而重穿窗口)。
 *  数值浏览器标定,两手各一套。 */
const THUMB_EVADE_D: Record<HandSide, { c1: number; c2: number; c3: number; splay: number }> = {
  R: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 },
  L: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 },
};

/** B 族接触背钩的静止指避让:home 指列(中指/无名指)贴着 B 面 2.7U 停靠,而
 *  backHook 转的就是 B 层 —— 层角 45° 附近方形角部伸出至 √2 半宽(比面多 ~40U),
 *  会扫中静止指腹(oracle 密采样 2026-07-08 现形,粗采样一直漏)。弹指手无 dodge
 *  (styled 弃 dodge 保接触),给静止的中/无名指走这条快升姿态通道抬离扫掠区。 */
const BACK_EVADE: Record<HandSide, { c1: number; c2: number; c3: number; splay: number }> = {
  R: { c1: -0.028, c2: 0, c3: 0, splay: 0 }, // 微伸即可(0.03rad×指长≈2U);reg 压最小干预
  L: { c1: -0.0246, c2: 0, c3: 0, splay: 0 },
};

/** U 族(y.high)静止手食指单指避让(2026-07-09 用户规格「手作为整体在任何
 *  时候不要远离魔方,单个手指可以」,替代旧 DODGE_MAG.y.high=16 整手平移):
 *  home 静止手食指尖贴 B 面上部(L 手 BUL / R 手 BUR),正处 U 层扫掠带,
 *  U/U'/U2/U'p 期间沿 B 面外法线(−z)微伸离面一小段,层角回落后归位。
 *  时序同 dodge:目标 = min(1,|层角|/0.09) 即时跟升,drop 后 RECOVER_MS
 *  回落(HandState.indexEvade,tick 推进)。数值浏览器截图标定,判据:
 *  U 层角块扫掠(角柱 135.8U)不碰静止食指。 */
const HOOK_INDEX_EVADE: Record<HandSide, { c1: number; c2: number; c3: number; splay: number }> = {
  R: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
  L: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
};

/** D 族(y.low)静止手单指避让(2026-07-09 总原则迁移,替代旧
 *  DODGE_MAG.y.low=44 整手平移):home 静止手上,① 无名指腹贴 B 面下部
 *  (BDL/BDR 角)正处 D 层扫掠带,沿 B 面外法线(−z)微伸离面(基节伸展,
 *  同 BACK_EVADE 方向学;实测指尖 Δ≈(−4,+2,−13)U,主向 −z);② 拇指
 *  末节下缘肉被 D 层角柱(135.8U)犁到,拇指绕根节甩出 F 面(实测指尖
 *  Δ≈(−16,−29,+34)U,径向 137.6→174.9U;数值 = THUMB_EVADE_D 同款 ——
 *  D 族期间两手拇指做同一个避让动作,视觉统一;splay 符号两手镜像已烘入,
 *  applyHand 不再 ×sideSign)。时序同 HOOK_INDEX_EVADE:目标 =
 *  min(1,|层角|/0.09) 即时跟升,drop 后 RECOVER_MS 回落
 *  (HandState.lowEvade,tick 推进)。全顶点冻结扫余量:静止手拇指/无名指
 *  最近点均 ≥5.3U(兜真实播放 ±2.2U 呼吸浮动);真实播放 D/D' 零穿模、
 *  D2' 仅回撤 0.49U 单帧瞬态(≪ 既有 −2.9U 基线)。 */
const LOW_EVADE: Record<HandSide, { ring: { c1: number; c2: number; c3: number; splay: number }; thumb: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: { ring: { c1: -0.05, c2: -0.03, c3: 0, splay: 0 }, thumb: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 } },
  L: { ring: { c1: -0.05, c2: -0.03, c3: 0, splay: 0 }, thumb: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 } },
};

/** E 族(y.mid)双手单指避让(2026-07-09 总原则迁移,替代旧
 *  DODGE_MAG.y.mid=62 整手平移):E 层带(y∈[−32,32])扫掠会犁**两只手**的
 *  贴面指 —— 受害不分弹指手(dodge=0 裸基线,全顶点冻结扫,双向 + 180°):
 *  ① 双手拇指末节肉(贴 F 面,y≈−20、径向 ~119U < 角柱 135.8U)被犁
 *  9.2~11.3U(弹指侧 θ≈0.1-0.64 / 静止侧 θ≈0.98-1.42,窗口首尾相接);
 *  ② 双手中指末节肉(骑 BR/BL 棱中部 y≈0)被犁 6.0~7.5U(θ 窗口与拇指
 *  互补);③ 弹指手无名指自身的 legacy 勾弯扫掠(标定于旧整手 dodge=62 之下)
 *  中段/回撤探进 E 带 4.3~4.8U。避让方向全为贴面外法线:拇指绕根节甩出
 *  F 面(+z,数值 = THUMB_EVADE_D 同款,与 D 族视觉统一);中指/无名指沿
 *  B 面外法线(−z)基节伸展离面。旧注释「E 犁拇指整块肉,关节动作无解」
 *  实测不成立 —— 主犯全是末节单指肉,甩出/离面即清。时序同
 *  HOOK_INDEX_EVADE:目标 = min(1,|层角|/0.09) 即时跟升,drop 后
 *  RECOVER_MS 回落(HandState.midEvade,tick 推进;driveGesture 写**两手**
 *  目标)。splay 两手镜像符号已烘入表内,applyHand 不 ×sideSign。
 *  标定实测(E' 冻结 0.8):拇指尖 Δ≈(±16,−30,+33)U 径向 138→174U(与
 *  THUMB_EVADE_D 同款数值,D/E 两族拇指动作视觉统一);中指尖
 *  Δ≈(±4,+4,−16)U 主向 −z;弹指无名指尖 Δ≈(+4,+2,−16)U。避让后全顶点
 *  冻结扫余量:中指 ≥4.4U、拇指 >6U、弹指无名指 ≥4.9U(0.94° 细扫全程
 *  零穿模,decay 0);真实播放 E/E'/E2/E2' 及混序全零。 */
const MID_EVADE: Record<HandSide, { thumb: { c1: number; c2: number; c3: number; splay: number }; middle: { c1: number; c2: number; c3: number; splay: number }; ring: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
    ring: { c1: -0.06, c2: -0.04, c3: 0, splay: 0 },
  },
  L: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
    ring: { c1: -0.06, c2: -0.04, c3: 0, splay: 0 },
  },
};

/** B 族(z.low)静止手单指避让(2026-07-09 总原则迁移,替代旧
 *  DODGE_MAG.z.low=40 整手平移;与 BACK_EVADE 分工:那是**弹指手本侧**静止
 *  中/无名指,这里是**另一只手**):home 静止手贴 B 面的指列处 B 层扫掠带
 *  (z∈[−96,−32],角柱 135.8U),dodge=0 裸基线(2026-07-09 全顶点冻结扫,
 *  双向 + 180°)实测只两指被蹭:① 食指末节尖肉(BUL/BUR 角,z≈−95)被
 *  0.7~1.4U@θ≈1.33-1.42;② 中指中节侧肉(骑 BL/BR 棱,径向 ~132U)被
 *  2.3U@θ≈0.83(仅 B' 的静止 L 手;B 的静止 R 手中指实测未中,~2U 资产
 *  不对称 + 扫向相位所致,两手同表保镜像统一)。无名指/拇指/掌体全程干净
 *  (旧注释「B 族犁中节侧肉,必须让 40U」严重高估)。避让方向 = B 面外法线
 *  (−z)基节伸展离面:食指 = HOOK_INDEX_EVADE 同款数值(同一根手指同一个
 *  动作,U/B 两族视觉统一);中指 = MID_EVADE.middle 同款(E/B 统一)。时序
 *  同 HOOK_INDEX_EVADE:目标 = min(1,|层角|/0.09) 即时跟升,drop 后
 *  RECOVER_MS 回落(HandState.bEvade,tick 推进;driveGesture 只写另一手)。 */
const B_EVADE: Record<HandSide, { index: { c1: number; c2: number; c3: number; splay: number }; middle: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: { index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 }, middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 } },
  L: { index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 }, middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 } },
};

/** F 族(z.high)遗留拇指分支(非 topPush/downPush 的其它握持)单指避让
 *  (2026-07-09 总原则迁移,替代旧 DODGE_MAG.z.high=10 整手平移):F 层带
 *  (z∈[32,96],角柱 135.8U)扫掠受害按**该手自身握姿**分组(dodge=0 且
 *  borrow=0 裸基线,全顶点冻结扫,双向 + 180°,8 种 up/down/home 组合):
 *  ① up 握手拇指末节肉(home 压 F 面的拇指转到 U 面上方,(±40,+112,44)
 *  径向 ~119U)被犁 11.5~11.7U@θ≈1.0-1.3(仅静止时;弹指拇指自己张开避走);
 *  ② up 握手无名指末节(骑 D 面下缘 (±72,−104,66..70))被蹭 3.7~5.4U
 *  @θ≈0.15-0.2 与 θ≈1.57;③ down 握手食指末节(压 U 面上方 (±73,+110,73))
 *  被蹭 0.7~2.4U。home 握手全程干净(贴 B/F 面的指肉都在 F 带外)——
 *  旧整手让 10U 是为 up/down 握持兜底的保险。避让方向 = 该指所贴面的外
 *  法线,且全部复用既有单指动作(关节空间随握姿旋转,方向自动跟面):
 *  拇指 = THUMB_EVADE_D 同款甩出(up 握下 = 甩离 U 面,D/E/F 三族拇指
 *  同一动作);食指 = HOOK_INDEX_EVADE 同款基节伸展(down 握下 = 离 U 面,
 *  U/B/F 三族同一动作);无名指 = LOW_EVADE.ring 同款(up 握下 = 离 D 面,
 *  幅度按 5.4U 裸穿加深到 c1:-0.07/c2:-0.04)。施加按握姿选指(applyHand:
 *  up = 拇指+无名指 / down = 食指 / home 与非标准握不动),两手都写目标
 *  (受害不分弹指手,driveGesture)。时序同 HOOK_INDEX_EVADE:目标 =
 *  min(1,|层角|/0.09) 即时跟升,drop 后 RECOVER_MS 回落(HandState.fEvade,
 *  tick 推进)。splay 两手镜像符号已烘入表内,applyHand 不 ×sideSign。 */
const F_EVADE: Record<HandSide, { thumb: { c1: number; c2: number; c3: number; splay: number }; index: { c1: number; c2: number; c3: number; splay: number }; ring: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 },
    index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
    ring: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
  },
  L: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 },
    index: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
    ring: { c1: -0.07, c2: -0.04, c3: 0, splay: 0 },
  },
};
/** F_EVADE / S_EVADE 按握姿选指用的基座快照(gripQuat 每帧新建太浪费)。 */
const GRIP_Q_UP = gripQuat("up");
const GRIP_Q_DOWN = gripQuat("down");

/** S 族(z.mid)up/down 握单指避让(2026-07-09 总原则迁移,替代旧
 *  DODGE_MAG.z.mid=10 整手平移):home 握全程干净(贴 B/F 面的指肉都在
 *  S 带 z∈[−32,32] 外),受害只在 up/down 握(dodge=0 且借力=0 裸基线,
 *  全顶点冻结扫,双向 + 180°,8 种组合):① 双手拇指末节肉(up 握下
 *  home 压 F 面的拇指转到 U 面上方 (±56,±105,±20..23),z 探进 S 带、
 *  径向 ~119U < 角柱 135.8U)被犁 9.2~11.2U;② 静止手中指末节肉(up 握下
 *  骑 D 面下缘 (±64..66,∓107,±15..19))被犁 5.9~7.3U(弹指中指自己扫开,
 *  不中);down 握 y/z 镜像同值。避让全部复用既有单指动作(关节空间随握姿
 *  旋转,方向自动跟该指所贴面的外法线):拇指 = THUMB_EVADE_D 同款甩出
 *  (D/E/F/S 四族拇指同一动作);中指 = MID_EVADE.middle 同款基节伸展
 *  (E/B/S 统一,up 握下 = 离 D 面甩出扫掠半径)。施加按握姿选指
 *  (applyHand:up/down = 拇指+中指,home 与非标准握不动),两手都写目标
 *  (受害不分弹指手,driveGesture)。时序同 HOOK_INDEX_EVADE:目标 =
 *  min(1,|层角|/0.09) 即时跟升,drop 后 RECOVER_MS 回落(HandState.sEvade,
 *  tick 推进)。splay 两手镜像符号已烘入表内,applyHand 不 ×sideSign。 */
const S_EVADE: Record<HandSide, { thumb: { c1: number; c2: number; c3: number; splay: number }; middle: { c1: number; c2: number; c3: number; splay: number } }> = {
  R: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: -0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
  },
  L: {
    thumb: { c1: 0, c2: -0.08, c3: 0, splay: 0.2 },
    middle: { c1: -0.06, c2: -0.03, c3: 0, splay: 0 },
  },
};

/** 回撤抬指(hook/backHook/downPush 的 decay 凸包):终姿绕层缠得深(尤其连拨
 *  s=1 + 下手握),关节空间直线回 home 的「弦」会切进魔方体(真实播放 oracle
 *  F2 −21.8U,2026-07-08)。decay 叠一个伸展凸包(快攻 12% - 平台 - 快收 15%
 *  包络,起止为零),指尖先径向抬离再归位 —— 伸展方向对任何绕缠终姿都朝外,
 *  天然安全。幅度按回撤起点的 s 加权(缠得浅回撤本就安全,别白抬)。 */
const RETREAT_LIFT = { c1: -0.338, c2: -0.653, c3: -0.113 };

/** per-style 回撤凸包覆盖(缺键回落 RETREAT_LIFT;FINGERTRICKS §5.1 预留的
 *  per-style 回撤编排):hook_index 端点 2026-07-09 钉角 M(指链绕过右上棱
 *  包到 R 面前上)后,s=1 冻结 ×decayK 的关节直线弦会横切 U 面右前区(真实
 *  播放 oracle ~38U);hook_middle2 同族端姿(U2 次指同贴角 M,回撤弦切
 *  25.8U)。默认 RETREAT_LIFT 的纯伸展方向抬不过顶,且缺 splay 通道 ——
 *  +x 甩离 R 面才是钉角端姿的天然逃逸向。数值浏览器坐标下降按 decayK 网格
 *  解(判据 = 回撤全程 pen ≤0 对静态整方箱体;U 单拨与 U2 双指回撤两条
 *  路径同罚)。键 = HOOK_FOLLOW 同款 `${style}_${finger}${次指 ? "2" : ""}`,
 *  只 R 侧钉角端姿需要覆盖。有覆盖的键在 applyHand 里还启用「攻窗保持」:
 *  decayK ∈ [0.88,1] 段 fit 输出钳在提交姿(kFit=min(1,decayK/0.88)),凸包
 *  升满后才开始衰减 —— 贴块提交姿 pad 离贴纸只 ~1.4U,×0.99 的第一帧就会
 *  拉进贴纸。2026-07-09 r3 解:U 回撤全程 pen ≤0;U2 回撤仅攻窗/收尾
 *  ≤0.45U 瞬态(prep 通道仍走 decayK 的固有残差,< 0.5U 验收带)。 */
const RETREAT_LIFT_STYLED: Record<HandSide, Partial<Record<string, { c1: number; c2: number; c3: number; splay: number }>>> = {
  R: {
    hook_index: { c1: -0.563, c2: 0.2, c3: 0.4, splay: 0.2 },
    hook_middle2: { c1: -0.2, c2: 0.1, c3: 0.575, splay: 1.225 },
  },
  // L 侧(U'/U2' 钉镜像角端姿,2026-07-09):浏览器按 U' 单拨 + U2' 双指两条
  // 回撤路径联解,细 k 网格(尾段 0.01~0.06 + 攻窗 0.965~0.995 都要采,
  // kStep 0.04 粗网格漏 k=0.98/0.02 两处真峰,踩过)。**凸包 splay 镜像与
  // fit 通道相反**:fit 的 splay 镜像 = 反号,但回撤凸包在贴角端姿上的逃逸
  // splay 两手同号为正(负 splay 盆地多起点怎么解都剩 0.5~1.9U 残差,正
  // splay 盆地直接全负);尾段(k≈0.02,走弦末端蹭 B 面)靠 c1 基节伸展
  // 离面清。解:两键全 k 网格(0.005 步注入复核)pen ≤ 0。
  L: {
    hook_index: { c1: -0.61, c2: 0.36, c3: 0.2, splay: 0 },
    hook_middle2: { c1: -0.35, c2: 0.06, c3: 0.17, splay: 0.7 },
    // D2 两键(2026-07-10 镜像连拨落地):注入 0.005 步细 k 网格实测,默认
    // RETREAT_LIFT(无 styled 键 = 无攻窗保持)在攻窗段 k≈0.945-0.965 把
    // ring2 端姿(pad gap ~0.4U)×decayK 拉进箱体 +4.0U(R 侧同网格 +2.9U,
    // 同族既有暴露,真实播放 60fps 采样只探到 0.5U)—— 该峰主要靠 styled 键
    // 自带的攻窗 kFit 钳解决,凸包本身只需极小量:pinky 键零凸包(仅为启用
    // 攻窗保持),ring2 微量伸展 + 负 splay。8 参联解(pinky+ring2 两路径
    // 同罚),全 k 网格(0.005 步)pen ≤ −0.49。
    hook_pinky: { c1: 0, c2: 0, c3: 0, splay: 0 },
    hook_ring2: { c1: -0.038, c2: -0.053, c3: -0.001, splay: -0.163 },
  },
};

/** U2 连拨首指退场(FINGERTRICKS §4.2):第一个 U 做完食指紧贴角 M(初始
 *  UBR 角块已转到 URF,指尖停其 R 面贴纸);第二个 U 开始的**前 20%**
 *  (sRaw2 ∈ [0,HOOK_EXIT_IN])内食指快速离开角 M,此后保持退场姿给接力
 *  中指让位,U2 提交后与次指一起归 home(见 RETREAT_LIFT_STYLED)。幅度
 *  下限是物理的:贴 M 的任何姿态都在角柱扫掠环带内(半径 ~117 < 96√2),
 *  Q2 中后段(φ≈0.68-1.27)下一个角柱必扫过原地,「+x 一小段(17U)」清不掉
 *  (r2 复测 11.8U)—— 2026-07-09 r3 按「Q2 全程全顶点 pen ≤0 + 最小幅度
 *  正则」重解,指尖 Δ≈(+38,−21,+21) 甩出扫掠环带(radius ~178),观感 =
 *  拨完向右前下方的自然 follow-through。判据:Q2 全程食指 pen ≤ −1U。 */
const HOOK_EXIT = { c1: 0.139, c2: 0.225, c3: -0.016, splay: -0.1 };
/** HOOK_EXIT 渐入窗口:Q2 前 20% 内退场到位(连续 180° 层转无时间间隙,
 *  「先退再接」折衷为「极早期快退」)。 */
const HOOK_EXIT_IN = 0.2;

/** B2/B2' 连拨首指退场(HOOK_EXIT 的 backHook 版):backHook Q1 做完食指
 *  绕过 BR/BL 棱贴在 R/L 面旁(R 侧 distal 肉 (105,2,−77),径向 ~105 <
 *  角柱扫掠 96√2 ≈ 135.8),Q2 中后段下一个角柱必扫过原地 —— Q2 前 20%
 *  (HOOK_EXIT_IN 同窗)沿 B 面外法线(−z)拉出扫掠带 + 基节伸展,观感 =
 *  背钩拨完向后下方的自然 follow-through。判据:Q2 全程食指全顶点 pen ≤ 0
 *  + 最小幅度正则;两手各解各的(splay 符号已烘入,不 ×sideSign)。
 *  2026-07-10 标定:R 最小幅度解(Q2 worst −0.81U,tip 提交
 *  (135.2, 11.5, −115.1));L 侧早窗(90° 边界贴角柱)靠 backHook_index 端
 *  节点微调解开(见 HOOK_FOLLOW.L 注),exit 同为中等幅度(Q2 worst 0.00U
 *  单点擦零,tip 提交 (−131.8, 87.1, −152.7),向后上方甩出)。 */
const BACK_EXIT: Record<HandSide, { c1: number; c2: number; c3: number; splay: number }> = {
  R: { c1: -0.16, c2: -0.028, c3: -0.002, splay: 0 },
  L: { c1: -0.232, c2: -0.064, c3: 0.006, splay: -0.016 },
};

/** 左中右下 F 族「食指下拨」(FINGERTRICKS §4.3):食指尖起手压 U 面 UFR 区,
 *  随 F 层角前卷(×φ/90°)把初始 UFR 往前下带;F2 次指中指 Q1 前探 UF 缘接力。
 *  数值浏览器标定。 */
const DOWN_PUSH = {
  c1: 0.5, c2: 0.35, c3: 0.25, splay: 0, // 回退默认(实际走 HOOK_FOLLOW.downPush_*)
  // = HOOK_PREP.middle 的 splay 反号版(hook 分支 prep ×sideSign、downPush 分支
  // 用本手局部值,R 手 sideSign=−1;符号踩过,oracle 实证 43U 反向)。
  prep2: { c1: -0.29, c2: 0.309, c3: 0.0093, splay: -0.468 },
};

/** U' 推法(记号 U'p,FINGERTRICKS §4.5):右食指前置就位到 RUB 角块 U 贴纸
 *  (reach:从 BUR 的 B 面接触位爬过后上棱),推层 90° 指尖随初始角块到
 *  BLU。climb = reach 通道姿态;follow = 随层角展开(浏览器标定);
 *  wrist = 原地腕转 ψ 三次多项式(绕「过腕点、平行 y」轴,腕点不动 → 前臂
 *  静止;食指独臂只够 ~20° 推程,RUB→BLU 弧长 ~190U 必须腕转补,同
 *  topPush wrist 通道原理)。 */
const UP_PUSH = {
  climb: { c1: 0.035, c2: 0.265, c3: -0.0709, splay: -0.3188 }, // pad 距顶面 1.76U、tip 落 RUB 贴纸区,已解
  // 转移凸包:home→climb 的 smR 直插会切过上后棱(真实播放 oracle 就位行程
  // −11U,2026-07-08 —— 静态只验过 reach 终点没验过渡)。sin(π·reachT) 包络,
  // 起止为零,中途抬高绕行;收指走同一路径倒放,天然同修。
  transit: { c1: -0.081, c2: 0, c3: 0, splay: 0 },
  follow: { c1: 0.4, c2: 0.3, c3: 0.1, splay: 0.5, drift: 0.6 }, // 回退默认(实际走 HOOK_FOLLOW.upPush_index)
  // 腕偏航通道(未启用,标定难点见 HOOK_FOLLOW.upPush_index 注释):裸偏航
  // ±0.6 会把静止指排甩进魔方顶(oracle pen −61),须与四指避让联合解。
  wrist: [0, 0, 0] as [number, number, number],
};

interface HandState {
  model: HandModel;
  home: HandPose;
  /** 独立前臂(肘锚固定,每帧 IK 指向手腕 —— 腕转时肘不绕魔方公转)。 */
  forearm: THREE.Group;
  /** 肘锚点(rig 局部,画面外下方)。 */
  elbow: THREE.Vector3;
  /** 持久握姿基座(weld 提交烘入 / 换握记号设定);identity = home 握。 */
  grip: THREE.Quaternion;
  /** weld 进行中:跟随的轴;null = 未 weld。 */
  weldAxis: Axis | null;
  weldAngle: number;
  /** weld 的未压缩层角(提交烘入判定用;flick 借力通道恒 0,不烘)。 */
  weldRawAngle: number;
  /** true = 本次 weld 是整体转体(不软钳制、不烘 grip,weldAngle 已含 90° 踏移)。 */
  weldWhole: boolean;
  /** drop 后的回位:从该四元数 slerp 回 identity。 */
  recoverQuat: THREE.Quaternion;
  recoverT: number; // 0..1,1=已回位
  /** flick 残留(手指偏移随时间衰减)。 */
  flickFinger: FingerName | null;
  /** 连拨次指(180° 接力,FINGERTRICKS §4.1);decay 期间保留(两指一起恢复)。 */
  flickFinger2: FingerName | null;
  flickAxis: Axis | null; // 弹指所属轴(决定扫法:y=勾弯横拉,x/z=竖扫);decay 期间保留
  flickStyle: FlickStyle | null; // 特殊扫法(FINGERTRICKS.md);decay 期间保留
  flickAmount: number; // 当前手指扫角(rad,随层角;连拨/接触样式存未钳制原角)
  flickDecay: number;  // drop 后残留衰减
  /** topPush 伸指进度(时间驱动,0..1;reachTarget 为目标,tick 内推进)。 */
  reachT: number;
  reachTarget: 0 | 1;
  /** 转层外让:0..1 进度(目标值是层角纯函数,零延迟同步;回落 RECOVER_MS
   *  衰减)× dodgeMag = 整手沿本侧外向 x 平移量。 */
  dodge: number;
  dodgeTarget: number;
  dodgeMag: number;
  /** U 族静止手食指单指避让:0..1 进度,时序语义同 dodge(即时跟升 /
   *  RECOVER_MS 回落)× HOOK_INDEX_EVADE = 食指离面姿态偏移。 */
  indexEvade: number;
  indexEvadeTarget: number;
  /** D 族静止手「无名指 + 拇指」单指避让:同 indexEvade 时序 × LOW_EVADE。 */
  lowEvade: number;
  lowEvadeTarget: number;
  /** E 族双手「拇指 + 中指(+ 弹指无名指)」单指避让:同上时序 × MID_EVADE。 */
  midEvade: number;
  midEvadeTarget: number;
  /** B 族静止手「食指 + 中指」单指避让:同上时序 × B_EVADE。 */
  bEvade: number;
  bEvadeTarget: number;
  /** F 族遗留分支(非双中手握持)单指避让:同上时序 × F_EVADE(按握姿选指)。 */
  fEvade: number;
  fEvadeTarget: number;
  /** S 族 up/down 握「拇指 + 中指」单指避让:同上时序 × S_EVADE(按握姿选指)。 */
  sEvade: number;
  sEvadeTarget: number;
}

export default class HandsRig extends THREE.Group {
  private readonly skinMat: THREE.MeshStandardMaterial;
  private readonly cuffMat: THREE.MeshStandardMaterial;
  /** 两手各自的烘焙贴图材质(UV 布局左右不一致,各烘各的);烘焙失败为空,
   *  手退回平色 skinMat 仍可用。 */
  private readonly handMats: THREE.MeshPhysicalMaterial[] = [];
  /** MediaPipe 风格骨架叠加层材质(透明常开,fade 只驱动 opacity)。 */
  private readonly skelMats: THREE.MeshBasicMaterial[];
  private readonly skelMatMap: Record<SkeletonMatKey, THREE.MeshBasicMaterial>;
  /** GLTF 手模异步加载,完成前为 null —— 所有姿态/手势入口 null 守卫 no-op,
   *  加载完成后若开关已开则从 fade=0 淡入。 */
  private hands: Record<HandSide, HandState> | null = null;
  private cube: HandsCubeLike | null = null;

  private enabled = false;
  private fade = 0; // 0 隐 → 1 显
  private lastActivityAt = 0;
  private idleClock = 0;
  private regripFlag = false;

  /** 当前手势(某一轴上活动层的手势);null = 静止。dir=0 表示方向未提交;
   *  lastAngle 用于识别「同轴同类连发」(U 接 U:角度从 ~π/2 跳回 ~0);
   *  quarters = 整体转体已踏移的 90° 数(带迟滞,driveGesture 维护)。 */
  private active: { axis: Axis; cls: LayerClass; dir: 0 | 1 | -1; gesture: HandGesture | null; lastAngle: number; quarters: number } | null = null;

  constructor() {
    super();
    this.name = "handsRig";
    // 皮肤(前臂 + 烘焙失败时的手部回退):物理材质 + 顶点血色(几何侧烘)+
    // 程序噪声 bump/roughness(毛孔颗粒);手本体正常路径用 initAsync 里的
    // 烘焙贴图材质(handMats)。sheen 给轮廓软绒光(皮肤次表面近似)。
    const detail = makeSkinDetailTexture();
    const skin = new THREE.MeshPhysicalMaterial({
      color: 0xd9af94, // 降饱和肤色 —— 偏橘的高饱和基色是「橘蜡假人」主因(评审 #8)
      roughness: 0.85, // 有 roughnessMap 时为乘数:0.85 × 贴图(均值 ~0.66)≈ 实效 0.56
      metalness: 0,
      vertexColors: true,
      // sheen 别高:每个体块的轮廓缘光会把拼球结构一个个勾出来(「葡萄串」)。
      sheen: 0.15,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffdfca),
    });
    skin.bumpMap = detail;
    skin.bumpScale = 0.55;
    skin.roughnessMap = detail;
    this.skinMat = skin;
    // DoubleSide:相机顺臂轴看进袖筒开口时,单面袖壁会被背面剔除露白看穿。
    this.cuffMat = new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });

    // 骨架叠加层材质先建(setSkeletonVisible 在加载完成前就可调),几何在
    // initAsync 里挂到加载好的骨骼上。默认隐藏 —— 由设置「骨架线条」开关驱动。
    this.skelMatMap = makeHandSkeletonMats();
    this.skelMats = Object.values(this.skelMatMap);
    this.setSkeletonVisible(false);
    // GLTF 手模异步加载(本地 /sim/hands/*.glb,~94KB/只)。失败打日志,
    // 手指开关成为空操作(本地资产失败即 bug,不做程序化回退)。
    void this.initAsync();

    // 手专属补光:layer 1(魔方在默认 layer 0,不受影响;手网格同时在 0+1,
    // 场景主光照到手,补光只照手)。左前暖 + 右下冷,把背光侧从死黑里捞出来。
    const fillA = new THREE.DirectionalLight(0xfff0e2, Math.PI * 0.22);
    fillA.position.set(-SIZE * 3, SIZE * 1.5, SIZE * 3);
    fillA.layers.set(1);
    // 下方冷补光压低(0.16→0.08):拉开明暗比,减少「均匀照亮」的蜡感(评审 #10)。
    const fillB = new THREE.DirectionalLight(0xdfe8f5, Math.PI * 0.08);
    fillB.position.set(SIZE * 2, -SIZE * 3, SIZE * 2);
    fillB.layers.set(1);
    // 暖背光轮廓(rim):从手后上方掠射,勾亮指缘/指尖 —— 皮肤薄处透红是次表面
    // 散射最强的「肉感」信号,一盏背光比任何贴图都廉价有效(craft 研究首推)。
    const rim = new THREE.DirectionalLight(0xffcaa6, Math.PI * 0.3);
    rim.position.set(SIZE * 1.2, SIZE * 2.6, -SIZE * 3.2);
    rim.layers.set(1);
    // 前侧低强度暖 rim:产品主视角(正面)吃不到后上 rim,补一盏让正面握持
    // 视角的指缘也有暖轮廓(评审 #10②)。
    const rimFront = new THREE.DirectionalLight(0xffcaa6, Math.PI * 0.12);
    rimFront.position.set(-SIZE * 2, SIZE * 1.2, SIZE * 3);
    rimFront.layers.set(1);
    this.add(fillA, fillB, rim, rimFront);

    this.visible = false;
  }

  /** 加载两只 GLTF 手 → 烘焙皮肤贴图 → 建前臂 / 骨架叠加 / HandState。魔方
   *  右侧 = 解剖学右手(right.glb,side=-1 语义只剩 splay 镜像);左侧 =
   *  left.glb 真镜像资产。 */
  private async initAsync(): Promise<void> {
    let right: HandModel, left: HandModel;
    try {
      [right, left] = await Promise.all([
        loadGltfHand(-1, this.skinMat),
        loadGltfHand(1, this.skinMat),
      ]);
    } catch (e) {
      console.error("[sim hands] GLTF hand load failed:", e);
      return;
    }
    // 程序化皮肤贴图烘焙(albedo/bump/roughness + 指甲)。必须在入场景 / 摆
    // home 姿态之前(烘焙契约:绑定姿态 + group 无父级)。UV 布局左右手不一致
    // (实测 max diff 0.042),两手各烘各的。失败非致命:退回平色 skinMat。
    const mkBakedMat = (maps: HandBakedMaps): THREE.MeshPhysicalMaterial => new THREE.MeshPhysicalMaterial({
      color: 0xffffff, // 基础肤色已画进 albedo(0xd9af94 × 斑驳),别再乘一层
      roughness: 1.0,  // roughnessMap 画的是物理值,权威;皮肤 ~0.6 / 甲面 ~0.34
      metalness: 0,
      vertexColors: true, // 血色/掌背明暗仍走顶点色(低频),与贴图相乘复合
      sheen: 0.15,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffdfca),
      map: maps.albedo,
      bumpMap: maps.bump,
      bumpScale: 0.7,
      roughnessMap: maps.rough,
    });
    try {
      for (const model of [right, left]) {
        const mat = mkBakedMat(await bakeHandTextures(model));
        model.meshes[0].material = mat;
        this.handMats.push(mat);
      }
    } catch (e) {
      console.error("[sim hands] skin texture bake failed:", e);
    }
    // 加载层自建材质(甲片等,HandModel.extraMats 契约):入 handMats 统一
    // fade/dispose。结构断言兼容尚未携带该字段的加载层。
    for (const model of [right, left]) {
      const extra = (model as { extraMats?: THREE.MeshPhysicalMaterial[] }).extraMats;
      if (extra) this.handMats.push(...extra);
    }
    this.add(right.group, left.group);
    const rArm = buildForearm(this.skinMat, this.cuffMat);
    const lArm = buildForearm(this.skinMat, this.cuffMat);
    // 前臂烘同款皮肤贴图(同公式/同材质参数,腕缝两侧肤质细节连续 —— 平色
    // 管子接烘焙手的材质断层比几何台阶还显眼)。两臂几何相同,烘一次共享;
    // 失败非致命:退回平色 skinMat。
    try {
      const mat = mkBakedMat(bakeLimbTextures(rArm.meshes[0].geometry));
      rArm.meshes[0].material = mat;
      lArm.meshes[0].material = mat;
      this.handMats.push(mat);
    } catch (e) {
      console.error("[sim hands] forearm texture bake failed:", e);
    }
    this.add(rArm.group, lArm.group);
    right.meshes.push(...rArm.meshes);
    left.meshes.push(...lArm.meshes);
    // 21 关键点骨架叠加(MediaPipe Hands 默认画风)—— 静态几何挂关节组,
    // 姿态自动跟随;网格进 model.meshes 复用补光层 / dispose。
    addHandSkeleton(right, this.skelMatMap);
    addHandSkeleton(left, this.skelMatMap);
    this.hands = {
      // 肘锚随 HAND_SCALE 等比外推:手/前臂变大后锚点太近会让前臂几何越过肘
      // 悬在半空(几何长 152U·scale,锚点必须比腕远至少这么多)。
      R: this.initHandState(right, homeRight(), rArm.group, new THREE.Vector3(SIZE * 4.4, -SIZE * 5.2, SIZE * 1.4).multiplyScalar(HAND_SCALE)),
      L: this.initHandState(left, homeLeft(), lArm.group, new THREE.Vector3(-SIZE * 4.4, -SIZE * 5.2, SIZE * 1.4).multiplyScalar(HAND_SCALE)),
    };
    for (const s of ["R", "L"] as const) {
      for (const m of this.hands[s].model.meshes) m.layers.enable(1);
    }
    // 加载期间开关已开 → 从 0 重新淡入(否则 fade 早到 1,手会瞬间蹦出来)。
    if (this.enabled) {
      this.fade = 0;
      for (const mat of this.fadeMats()) mat.transparent = true;
    }
  }

  /** 随 fade 开合的实体材质(骨架叠加线另算,常开 transparent 只驱动 opacity)。
   *  handMats 异步烘焙后才入列,动态取。 */
  private fadeMats(): THREE.Material[] {
    return [this.skinMat, this.cuffMat, ...this.handMats];
  }

  /** 调试开关(SimSettings.handsSkeleton 驱动):显隐 MediaPipe 风格骨架叠加线
   *  (关节点 + 连线)。两只手共享同一批材质实例,一次性切全部。与 fade 驱动的
   *  opacity 相互独立 —— 直接控 visible,不影响手部皮肤/指甲的淡入淡出。 */
  setSkeletonVisible(v: boolean): void {
    for (const mat of this.skelMats) mat.visible = v;
  }

  private initHandState(model: HandModel, home: HandPose, forearm: THREE.Group, elbow: THREE.Vector3): HandState {
    model.group.position.copy(home.pos);
    model.group.quaternion.copy(home.quat);
    return {
      model,
      home,
      forearm,
      elbow,
      grip: new THREE.Quaternion(),
      weldAxis: null,
      weldAngle: 0,
      weldRawAngle: 0,
      weldWhole: false,
      recoverQuat: new THREE.Quaternion(),
      recoverT: 1,
      flickFinger: null,
      flickFinger2: null,
      flickAxis: null,
      flickStyle: null,
      flickAmount: 0,
      flickDecay: 0,
      reachT: 0,
      reachTarget: 0,
      dodge: 0,
      dodgeTarget: 0,
      dodgeMag: 0,
      indexEvade: 0,
      indexEvadeTarget: 0,
      lowEvade: 0,
      lowEvadeTarget: 0,
      midEvade: 0,
      midEvadeTarget: 0,
      bEvade: 0,
      bEvadeTarget: 0,
      fEvade: 0,
      fEvadeTarget: 0,
      sEvade: 0,
      sEvadeTarget: 0,
    };
  }

  /** rig 只在 3x3 上活动;其它拼图/关开关时传 null。 */
  attachCube(cube: HandsCubeLike | null): void {
    if (this.cube === cube) return;
    this.cube = cube;
    this.active = null;
    this.resetGrips();
  }

  /** 握姿全清回 home(挂/摘 cube 或瞬时跳步前的硬复位)。 */
  private resetGrips(): void {
    const hands = this.hands;
    if (!hands) return;
    for (const side of ["R", "L"] as const) {
      const h = hands[side];
      h.grip.identity();
      h.recoverT = 1;
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      h.weldWhole = false;
      h.flickFinger = null;
      h.flickFinger2 = null;
      h.flickAxis = null;
      h.flickStyle = null;
      h.flickAmount = 0;
      h.flickDecay = 0;
      h.reachT = 0;
      h.reachTarget = 0;
      h.dodge = 0;
      h.dodgeTarget = 0;
      h.indexEvade = 0;
      h.indexEvadeTarget = 0;
      h.lowEvade = 0;
      h.lowEvadeTarget = 0;
      h.midEvade = 0;
      h.midEvadeTarget = 0;
      h.bEvade = 0;
      h.bEvadeTarget = 0;
      h.fEvade = 0;
      h.fEvadeTarget = 0;
      h.sEvade = 0;
      h.sEvadeTarget = 0;
    }
    this.regripFlag = false;
    this.pendingHint = null;
  }

  /**
   * 换握(动画):手 slerp 到指定握姿基座 —— 解法框记号 ↑/↓/· 驱动。
   * side 缺省 = 双手;单手记号(FINGERTRICKS §2 空格规则)只动指定手。
   * 把「当前显示偏移 ∘ 旧 grip」折算成相对新 grip 的回位余量,切换瞬间画面连续。
   */
  regrip(name: GripName, only?: HandSide): void {
    const hands = this.hands;
    if (!hands) return;
    const target = gripQuat(name);
    const q = HandsRig._qTmp;
    let any = false;
    for (const side of only ? [only] : (["R", "L"] as const)) {
      const h = hands[side];
      if (h.weldAxis) {
        q.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
      } else if (h.recoverT < 1) {
        const t = 1 - Math.pow(1 - h.recoverT, 3);
        q.copy(h.recoverQuat).slerp(HandsRig._qIdent, t);
      } else {
        q.identity();
      }
      q.multiply(h.grip).multiply(HandsRig._qTmp2.copy(target).invert());
      h.grip.copy(target);
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      h.weldWhole = false;
      if (q.angleTo(HandsRig._qIdent) < 0.01) {
        h.recoverT = 1; // 已在目标握姿,免 300ms 空转(播放循环靠 isRegripping 闸步)
        continue;
      }
      h.recoverQuat.copy(q);
      h.recoverT = 0;
      any = true;
    }
    if (any) {
      this.regripFlag = true;
      this.lastActivityAt = performance.now();
    }
  }

  /** 瞬时设定两手握姿基座(跳步 / 拖进度条的静态摆位,配 simulateGrips)。 */
  setGrips(qR: THREE.Quaternion, qL: THREE.Quaternion): void {
    const hands = this.hands;
    if (!hands) return;
    hands.R.grip.copy(qR);
    hands.L.grip.copy(qL);
    for (const side of ["R", "L"] as const) {
      const h = hands[side];
      h.recoverT = 1;
      h.weldAxis = null;
      h.weldAngle = 0;
      h.weldRawAngle = 0;
      h.weldWhole = false;
      h.flickFinger = null;
      h.flickFinger2 = null;
      h.flickAxis = null;
      h.flickStyle = null;
      h.flickAmount = 0;
      h.flickDecay = 0;
      h.reachT = 0;
      h.reachTarget = 0;
      h.dodge = 0;
      h.dodgeTarget = 0;
      h.indexEvade = 0;
      h.indexEvadeTarget = 0;
      h.lowEvade = 0;
      h.lowEvadeTarget = 0;
      h.midEvade = 0;
      h.midEvadeTarget = 0;
      h.bEvade = 0;
      h.bEvadeTarget = 0;
      h.fEvade = 0;
      h.fEvadeTarget = 0;
      h.sEvade = 0;
      h.sEvadeTarget = 0;
    }
    this.regripFlag = false;
  }

  /** 换握动画进行中(播放循环用它闸住下一步;普通 weld 回位不算)。 */
  get isRegripping(): boolean {
    return this.regripFlag;
  }

  /** 转前提示(prepareTwist 登记,tick 建手势时按 (axis,cls,dir) 匹配消费):
   *  quarters ≥2 才连拨、push = U'p 推法。3s 过期防陈旧提示污染后续拖拽。 */
  private pendingHint: { axis: Axis; cls: LayerClass; dir: 1 | -1; quarters: number; push: boolean; at: number } | null = null;

  private takeHint(axis: Axis, cls: LayerClass, dir: 1 | -1): TwistHint | undefined {
    const hint = this.pendingHint;
    if (!hint || performance.now() - hint.at > 3000) return undefined;
    if (hint.axis !== axis || hint.cls !== cls || hint.dir !== dir) return undefined;
    this.pendingHint = null;
    return { quarters: hint.quarters, push: hint.push };
  }

  /** 两手握姿名判读(grip 是精确四分转积,阈值只兜浮点;非标准积 = null)。 */
  private gripNames(): HandGripNames {
    const hands = this.hands;
    const nameOf = (q: THREE.Quaternion): GripName | null => {
      if (q.angleTo(HandsRig._qIdent) < 0.01) return "home";
      if (q.angleTo(gripQuat("up")) < 0.01) return "up";
      if (q.angleTo(gripQuat("down")) < 0.01) return "down";
      return null;
    };
    if (!hands) return { R: null, L: null };
    return { R: nameOf(hands.R.grip), L: nameOf(hands.L.grip) };
  }

  /** 该手势是否走「前置伸指」(转动开始前指尖先到位;FINGERTRICKS §4.5/§4.2):
   *  topPush(F 族越顶)/ upPush(U'p 就位 RUB)/ D2' 首指小指伸至 D 层。 */
  private static needsReach(g: HandGesture): boolean {
    if (g.kind !== "flick") return false;
    return g.style === "topPush" || g.style === "upPush" || (g.style === "hook" && g.finger === "pinky");
  }

  /**
   * 播放前置伸指 + 转前提示:登记 (quarters, push) 提示(连拨 / 推法分类用),
   * 该转动若需前置就位(needsReach),启动/继续伸指动画并返回「还需等待」——
   * 调用方本轮不发 twist,等 isReachPreparing 落 false 再转。返回 false =
   * 无需前置或已到位。幂等,播放循环可 16ms 轮询重入。
   */
  prepareTwist(axis: Axis, layers: number[], dir: 1 | -1, quarters = 1, push = false): boolean {
    const hands = this.hands;
    const cube = this.cube;
    if (!hands || !cube || !this.enabled) return false;
    const cls = classifyLayers(layers, cube.order);
    const g = classifyHandGesture(axis, cls, dir, this.gripNames(), { quarters, push });
    this.pendingHint = { axis, cls, dir, quarters, push, at: performance.now() };
    // U 族接续闸(2026-07-09 U2' 镜像连拨):对侧手上一步 U 族 hook(钉角端姿)
    // 的回撤未完时,下一步 y.high 必须等 —— 回撤走廊在 U 带扫掠环带内侧
    // (半径 ~107U < 96√2),层再次转动会犁到回撤中的指链(真实播放 oracle
    // U2'→U'p 实测 11U;F/S 族「decay 段吃 evade」先例是小幅姿态可解,这里
    // 是结构性重叠只能等,decay ≤ RECOVER_MS)。同手连发(U 接 U2)不闸:
    // beginGesture 直接重置本手 decay,r3 基线行为不变。
    if (axis === "y" && cls === "high" && g.kind === "flick") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      if (other.flickDecay > 0 && other.flickAxis === "y" && other.flickStyle === "hook" && other.flickFinger === "index") {
        this.lastActivityAt = performance.now();
        return true;
      }
    }
    if (!HandsRig.needsReach(g) || g.kind !== "flick") return false;
    const h = hands[g.hand];
    if (h.flickDecay > 0 && h.reachT > 0) {
      // 上一转的退场未完:清 flickAmount 会让手指从弧中段瞬移。轮询重入
      // 等 decay 走完(届时 reachT 仍为 1,下一轮直接从按压位起推)。
      this.lastActivityAt = performance.now();
      return true;
    }
    h.flickFinger = g.finger;
    h.flickFinger2 = g.finger2 ?? null;
    h.flickAxis = axis;
    h.flickStyle = g.style ?? null;
    h.flickAmount = 0;
    h.flickDecay = 0;
    h.reachTarget = 1;
    this.lastActivityAt = performance.now();
    return h.reachT < 1;
  }

  /** 标定入口:编排参数的活引用(浏览器坐标下降现场改,数值烘回源码)。 */
  get tuning(): {
    push: typeof TOP_PUSH; follow: typeof TOP_PUSH_FOLLOW;
    hook: typeof HOOK; hookFollow: typeof HOOK_FOLLOW; hookPrep: typeof HOOK_PREP;
    pinkyReach: typeof PINKY_REACH; downPush: typeof DOWN_PUSH; upPush: typeof UP_PUSH;
    thumbEvadeD: typeof THUMB_EVADE_D; backEvade: typeof BACK_EVADE;
    hookIndexEvade: typeof HOOK_INDEX_EVADE; lowEvade: typeof LOW_EVADE;
    midEvade: typeof MID_EVADE; bEvade: typeof B_EVADE; fEvade: typeof F_EVADE;
    sEvade: typeof S_EVADE;
    retreatLift: typeof RETREAT_LIFT; retreatLiftStyled: typeof RETREAT_LIFT_STYLED;
    hookExit: typeof HOOK_EXIT; backExit: typeof BACK_EXIT;
  } {
    return {
      push: TOP_PUSH, follow: TOP_PUSH_FOLLOW,
      hook: HOOK, hookFollow: HOOK_FOLLOW, hookPrep: HOOK_PREP,
      pinkyReach: PINKY_REACH, downPush: DOWN_PUSH, upPush: UP_PUSH,
      thumbEvadeD: THUMB_EVADE_D, backEvade: BACK_EVADE,
      hookIndexEvade: HOOK_INDEX_EVADE, lowEvade: LOW_EVADE,
      midEvade: MID_EVADE, bEvade: B_EVADE, fEvade: F_EVADE,
      sEvade: S_EVADE,
      retreatLift: RETREAT_LIFT, retreatLiftStyled: RETREAT_LIFT_STYLED,
      hookExit: HOOK_EXIT, backExit: BACK_EXIT,
    };
  }

  /** 前置伸指进行中(播放循环闸步,与 isRegripping 同款;手关着恒 false)。 */
  get isReachPreparing(): boolean {
    const hands = this.hands;
    if (!hands || !this.enabled) return false;
    return (["R", "L"] as const).some((s) => {
      const h = hands[s];
      return h.flickFinger !== null && h.reachTarget === 1 && h.reachT < 1;
    });
  }

  /** reach 式手势收指进行中:下一步(尤其 weld,R'/L 等会把整手烘着转)必须等
   *  指链撤回,否则伸在魔方上方的手指被腕转扫进方块(真实播放 oracle −11U,
   *  2026-07-08)。非 reach 的 hook 类回撤已是安全的关节直线(见 applyHand
   *  decayK 注释),不闸。 */
  get isReachRetreating(): boolean {
    const hands = this.hands;
    if (!hands || !this.enabled) return false;
    return (["R", "L"] as const).some((s) => {
      const h = hands[s];
      // decay 段也算「收指未完」:reach 式手势 decay 结束必然接 walk-back,若只
      // 看 reachTarget,下一步会在 decay 期间放行,retreat 与 weld 叠加(oracle
      // 实测 R' 把回撤中的食指烘着转进方块 −11U)。
      return h.reachT > 0 && (h.reachTarget === 0 || h.flickDecay > 0);
    });
  }

  setEnabled(on: boolean): void {
    // visible 无条件跟 on 拉起(不能挂在 enabled-diff 后面:dt=0 帧曾把
    // visible 误置 false,若 enabled 未变就再也拉不起来)。
    if (on) this.visible = true;
    if (this.enabled === on) return;
    this.enabled = on;
    this.lastActivityAt = 0; // 让 tick 重新计 keepalive
    for (const mat of this.fadeMats()) {
      mat.transparent = true; // 渐变期间开启;fade 达到 1 后关掉(省排序)
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** 每帧驱动;返回 true = 画面有变化需要重渲。 */
  tick(dtMs: number): boolean {
    if (!this.visible) return false;
    const dt = Math.min(dtMs, 100); // 掉帧保护
    let animating = false;

    // —— 淡入淡出 ——
    const fadeTarget = this.enabled ? 1 : 0;
    if (this.fade !== fadeTarget) {
      const step = dt / FADE_MS;
      this.fade = fadeTarget > this.fade ? Math.min(1, this.fade + step) : Math.max(0, this.fade - step);
      const eased = this.fade * this.fade * (3 - 2 * this.fade);
      for (const mat of [...this.fadeMats(), ...this.skelMats]) mat.opacity = eased;
      // 只在「淡出完成」隐藏 —— 淡入起点 fade=0 碰上 dt=0 帧不能误藏。
      if (this.fade === 0 && !this.enabled) this.visible = false;
      if (this.fade === 1) for (const mat of this.fadeMats()) mat.transparent = false;
      animating = true;
      this.lastActivityAt = performance.now();
    }
    if (!this.visible) return true;
    const hands = this.hands;
    if (!hands) return animating; // GLTF 加载中:fade 照走,姿态等模型

    // —— 轮询当前转动层 ——
    const now = performance.now();
    const cube = this.cube;
    // 外让/单指避让目标每帧重算(driveGesture 写入);无手势帧目标归零 → 衰减回落。
    hands.R.dodgeTarget = 0;
    hands.L.dodgeTarget = 0;
    hands.R.indexEvadeTarget = 0;
    hands.L.indexEvadeTarget = 0;
    hands.R.lowEvadeTarget = 0;
    hands.L.lowEvadeTarget = 0;
    hands.R.midEvadeTarget = 0;
    hands.L.midEvadeTarget = 0;
    hands.R.bEvadeTarget = 0;
    hands.L.bEvadeTarget = 0;
    hands.R.fEvadeTarget = 0;
    hands.L.fEvadeTarget = 0;
    hands.R.sEvadeTarget = 0;
    hands.L.sEvadeTarget = 0;
    if (cube) {
      let axis: Axis | null = null;
      let layers: number[] | null = null;
      let repAngle = 0;
      for (const a of ["x", "y", "z"] as const) {
        const gs = cube.table.groups[a];
        let ls: number[] | null = null;
        let best = 0;
        for (let l = 0; l < gs.length; l++) {
          const ang = gs[l].angle;
          if (ang !== 0) {
            (ls ??= []).push(l);
            if (Math.abs(ang) > Math.abs(best)) best = ang;
          }
        }
        if (ls && (axis === null || Math.abs(best) > Math.abs(repAngle))) {
          axis = a;
          layers = ls;
          repAngle = best;
        }
      }

      if (axis && layers) {
        this.lastActivityAt = now;
        animating = true;
        const cls = classifyLayers(layers, cube.order);
        // 招式队列是同步接续的(drop → 下一步 twist 在同一 tick),中间可能
        // 没有「零活动帧」—— 所以轴变 / 层类变 / 同类连发 / 方向反转四种切换
        // 都要在这里显式收尾旧手势,否则上一手的 weld 姿态永远悬着(踩过)。
        if (!this.active || this.active.axis !== axis || this.active.cls !== cls) {
          this.endGesture();
          this.active = { axis, cls, dir: 0, gesture: null, lastAngle: 0, quarters: 0 };
        } else if (this.active.gesture && Math.abs(repAngle) < Math.abs(this.active.lastAngle) - 0.8) {
          // 同轴同类连发(U 接 U):角度从 ~π/2 跳回 ~0 = 新的一步。
          this.endGesture();
          this.active.gesture = null;
          this.active.dir = 0;
        }
        const act = this.active;
        if (Math.abs(repAngle) >= COMMIT_ANGLE) {
          const dir: 1 | -1 = repAngle > 0 ? 1 : -1;
          if (act.gesture && act.dir !== 0 && act.dir !== dir) {
            // 转向反转(拖拽回拉 / U 接 U'):换手重分类。
            this.endGesture();
            act.gesture = null;
          }
          if (!act.gesture) {
            // 握姿感知分类(grip 是精确四分转积,阈值只兜浮点;regrip() 提交即
            // 写 grip,动画途中判定也指向终态)+ 转前提示(连拨 / 推法)消费。
            act.gesture = classifyHandGesture(axis, cls, dir, this.gripNames(), this.takeHint(axis, cls, dir));
            act.dir = dir;
            this.beginGesture(act.gesture, axis);
          }
        }
        if (act.gesture) this.driveGesture(act.gesture, axis, repAngle);
        act.lastAngle = repAngle;
      } else if (this.active) {
        // 层已 drop(角度归零 & bake)→ 手势进入回位。
        this.endGesture();
        this.active = null;
        this.lastActivityAt = now;
        animating = true;
      }
    }

    // —— 回位 / 残留衰减 / 待机微动 ——
    this.idleClock += dt;
    const keepalive = now - this.lastActivityAt < IDLE_KEEPALIVE_MS;
    for (const side of ["R", "L"] as const) {
      const h = hands[side];
      if (h.recoverT < 1) {
        h.recoverT = Math.min(1, h.recoverT + dt / RECOVER_MS);
        animating = true;
      }
      if (h.flickDecay > 0) {
        h.flickDecay = Math.max(0, h.flickDecay - dt / RECOVER_MS);
        if (h.flickDecay === 0) {
          if (h.flickStyle === "topPush" || h.reachT > 0) {
            // 带前置伸指的样式(topPush/upPush/D2' 小指):完全收回(下方
            // reachT=0 清理)才清字段,退场走完才收指(串行)。topPush 的
            // flickAmount 不清(收指段姿态靠它判定终点:release 走满/缩回
            // 按压位);其余 reach 样式 decay 已沿弧退到起手位,清零防
            // decayK 回 1 时姿态弹回。
            if (h.flickStyle !== "topPush") h.flickAmount = 0;
            h.reachTarget = 0;
          } else {
            h.flickFinger = null; h.flickFinger2 = null; h.flickAxis = null; h.flickStyle = null;
          }
        }
        animating = true;
      }
      // 前置伸指/收指(时间驱动);完全收回后才清 flick 状态。
      if (h.reachT !== h.reachTarget) {
        const step = dt / REACH_MS;
        h.reachT = h.reachTarget > h.reachT
          ? Math.min(h.reachTarget, h.reachT + step)
          : Math.max(h.reachTarget, h.reachT - step);
        animating = true;
      }
      if (h.flickFinger && h.flickStyle && h.reachTarget === 0 && h.reachT === 0 && h.flickDecay === 0 && this.active?.gesture?.kind !== "flick") {
        h.flickFinger = null; h.flickFinger2 = null; h.flickAxis = null; h.flickStyle = null;
        h.flickAmount = 0;
      }
      if (h.dodgeTarget > h.dodge) {
        // 外让即时跟目标(目标本身随层角从 0 连续爬升,无跳变)
        h.dodge = h.dodgeTarget;
        animating = true;
      } else if (h.dodge > h.dodgeTarget) {
        h.dodge = Math.max(h.dodgeTarget, h.dodge - dt / RECOVER_MS);
        animating = true;
      }
      // U 族静止手食指单指避让:同 dodge 时序(即时跟升 / RECOVER_MS 回落)。
      if (h.indexEvadeTarget > h.indexEvade) {
        h.indexEvade = h.indexEvadeTarget;
        animating = true;
      } else if (h.indexEvade > h.indexEvadeTarget) {
        h.indexEvade = Math.max(h.indexEvadeTarget, h.indexEvade - dt / RECOVER_MS);
        animating = true;
      }
      // D 族静止手「无名指 + 拇指」单指避让:同上时序。
      if (h.lowEvadeTarget > h.lowEvade) {
        h.lowEvade = h.lowEvadeTarget;
        animating = true;
      } else if (h.lowEvade > h.lowEvadeTarget) {
        h.lowEvade = Math.max(h.lowEvadeTarget, h.lowEvade - dt / RECOVER_MS);
        animating = true;
      }
      // E 族双手「拇指 + 中指(+ 弹指无名指)」单指避让:同上时序。
      if (h.midEvadeTarget > h.midEvade) {
        h.midEvade = h.midEvadeTarget;
        animating = true;
      } else if (h.midEvade > h.midEvadeTarget) {
        h.midEvade = Math.max(h.midEvadeTarget, h.midEvade - dt / RECOVER_MS);
        animating = true;
      }
      // B 族静止手「食指 + 中指」单指避让:同上时序。
      if (h.bEvadeTarget > h.bEvade) {
        h.bEvade = h.bEvadeTarget;
        animating = true;
      } else if (h.bEvade > h.bEvadeTarget) {
        h.bEvade = Math.max(h.bEvadeTarget, h.bEvade - dt / RECOVER_MS);
        animating = true;
      }
      // S 族 up/down 握「拇指 + 中指」单指避让(按握姿选指):同上时序。
      if (h.sEvadeTarget > h.sEvade) {
        h.sEvade = h.sEvadeTarget;
        animating = true;
      } else if (h.sEvade > h.sEvadeTarget) {
        h.sEvade = Math.max(h.sEvadeTarget, h.sEvade - dt / RECOVER_MS);
        animating = true;
      }
      // F 族遗留分支单指避让(按握姿选指):同上时序。
      if (h.fEvadeTarget > h.fEvade) {
        h.fEvade = h.fEvadeTarget;
        animating = true;
      } else if (h.fEvade > h.fEvadeTarget) {
        h.fEvade = Math.max(h.fEvadeTarget, h.fEvade - dt / RECOVER_MS);
        animating = true;
      }
      this.applyHand(side, keepalive);
    }
    if (this.regripFlag && hands.R.recoverT >= 1 && hands.L.recoverT >= 1) {
      this.regripFlag = false;
    }
    if (keepalive) animating = true;
    return animating;
  }

  // ================= 手势生命周期 =================

  private beginGesture(g: HandGesture, axis: Axis): void {
    const hands = this.hands;
    if (!hands) return;
    if (g.kind === "weld") {
      for (const s of g.hands) {
        const h = hands[s];
        h.weldAxis = null; // driveGesture 里设,先清残留
        h.weldAngle = 0;
        h.weldRawAngle = 0;
        h.weldWhole = false;
        h.recoverT = 1; // weld 直接接管,丢弃未完的回位
      }
    } else {
      const h = hands[g.hand];
      h.flickFinger = g.finger;
      h.flickFinger2 = g.finger2 ?? null;
      h.flickAxis = axis;
      h.flickStyle = g.style ?? null;
      h.flickAmount = 0;
      h.flickDecay = 0;
      // 前置伸指样式(topPush/upPush/D2' 小指):播放路径 prepareTwist 已前置
      // (reachT 到 1);拖拽/键盘没有前置窗口,这里补触发,伸指与层角并发。
      // reachT 不清零 —— 已到位的连发(F 接 F)指尖全程停在贴纸上。
      if (HandsRig.needsReach(g)) h.reachTarget = 1;
    }
  }

  private driveGesture(g: HandGesture, axis: Axis, angle: number): void {
    const hands = this.hands;
    if (!hands) return;
    if (g.kind === "weld") {
      const act = this.active;
      const whole = act?.cls === "whole";
      let weldAngle: number;
      if (whole && act) {
        // 整步转体(#20):手 1:1 黏着魔方刚体同转,不软钳制(钳制会打破刚体
        // 同转 → 手相对魔方旋转 = 指穿贴面,拖 260px 层角可达 ~292° 实测穿模)。
        // 长拖防手臂缠绕:层角越过 45°(+0.06 迟滞防边界抖动)即踏移一个 90°,
        // 手瞬跳换握 —— 与「自动转体」跨 ±90° 的 scene 快切同款观感;魔方箱体
        // 在四分转下不变,踏移后的握姿间隙与 home 完全相同,零穿模。
        if (Math.abs(angle - act.quarters * HALF_PI) > HALF_PI / 2 + 0.06) {
          act.quarters = Math.round(angle / HALF_PI);
        }
        weldAngle = angle - act.quarters * HALF_PI;
      } else {
        weldAngle = softClampAngle(angle);
      }
      for (const s of g.hands) {
        const h = hands[s];
        h.weldAxis = axis;
        h.weldWhole = whole;
        h.weldAngle = weldAngle;
        h.weldRawAngle = angle;
      }
    } else {
      const h = hands[g.hand];
      if (g.style) {
        // 样式化指法(FINGERTRICKS.md):手根不动 —— 禁腕借力(借力绕 y/z 会把
        // 静止的中指/无名指沿 ~130U 弧转进 B 面,dodge 已按接触规格砍掉后
        // oracle 实测 pen −5.7);接触/连拨编排全在 applyHand 随层角展开。
        // flickAmount 存未钳制原角(release / 连拨象限拆分依赖真实层角)。
        h.flickAmount = angle;
      } else {
        h.flickAmount = softClampAngle(angle);
        // 弹指时手腕轻微借力(跟层角),applyHand 里通过 weld 通道叠加。系数按轴:
        // x 族(M)必须为 0 —— 绕 x 借力会把贴 B 面的指腹沿 ~118U 半径圆弧转进
        // 角块区(对角线处 Chebyshev 内陷 >15U,oracle 实测);y/z 借力在 2.7U
        // 贴面间隙下对角线擦过量 <0(指腹接触半径 ~136U ≥ 角柱 135.8U,且旧
        // 扫法带 dodge 外让)。y.mid(E 族)也必须 0 —— 上述安全论证只覆盖
        // 外层带(接触半径 ~136U);E 带贴面指(拇指/中指)半径只 ~119-130U,
        // 且整手 dodge 已废,借力旋转会把弹指手食指腹沿 B 面切向压进静止 U 带
        // 箱体(dodge=0 裸基线 oracle 实测 ~3U)。z.high(F 族遗留拇指分支,
        // 只在 up/down/混合握持出现)也必须 0 —— 该借力绕 z 旋转弹指手,up 握
        // 下会把中指/食指末节切向压进静止箱体角柱(dodge=0 裸基线 oracle 实测
        // 中指 6.0U/食指 2.8U@θ≈1.2-1.6),home 握下也把食指腹压进 BUR 角
        // ~1.4U;旧安全论证同样依赖已废的整手 dodge。归零后弹指手根更稳
        // (总原则),残余受害由 F_EVADE 单指避让兜。z.mid(S 族)同理必须 0:
        // up 握下借力把弹指手拇指(z 探进 S 带、径向 ~119U)切向压进转动域,
        // 真实播放 R S R' S' 实测 10.5U(借力是该拇指唯一运动通道,归零即清
        // 借力分量);home 握借力本安全(指肉全在 S 带外)但同享手根更稳,
        // 静态扫掠残余受害由 S_EVADE 单指避让兜。
        h.weldAxis = axis;
        h.weldWhole = false;
        h.weldAngle = softClampAngle(angle)
          * (axis === "x" || (axis === "y" && this.active?.cls === "mid")
            || (axis === "z" && (this.active?.cls === "high" || this.active?.cls === "mid")) ? 0 : 0.1);
        h.weldRawAngle = 0; // 借力不烘入握姿
      }
    }
    // —— 转层外让目标(穿模禁令:见 DODGE_MAG 注释)——
    // 非 weld 手(含指弹手:弹指手指是贴着活动层扫的,整手外让同时也把它
    // 拉出扫掠区)按幅度表沿本侧外向 x 平移;0.09rad≈5° 内让满,与转动起步
    // 贴面翻剪 / 角柱越过接触点的窗口同步。weld 手随层整体转,零相对运动不让。
    // topPush/downPush 整段跳过(z 轴手根不动样式,静止手安全性靠 home 姿
    // 指腹接触半径 ≥136U > 角柱扫掠 135.8U,oracle 复核)。
    if (g.kind === "flick" && (g.style === "topPush" || g.style === "downPush")) return;
    // U 族(y.high,含 hook 单/连拨与 upPush)静止手改食指单指避让(见
    // HOOK_INDEX_EVADE 注释):静止手食指尖在 B 面上部(BUL/BUR)正处 U 层
    // 扫掠带(upPush 真实播放 oracle 曾测 −1.7U,2026-07-08),整手 dodge 已
    // 废(DODGE_MAG.y.high=0),只写另一手的单指避让目标;弹指手不避
    // (指尖要贴面)。
    if (g.kind === "flick" && axis === "y" && this.active?.cls === "high") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > other.indexEvadeTarget) other.indexEvadeTarget = t;
    }
    // D 族(y.low,含 hook 单/连拨)静止手改「无名指 + 拇指」单指避让(见
    // LOW_EVADE 注释):整手 dodge 已废(DODGE_MAG.y.low=0),只写另一手目标;
    // 弹指手自身的拇指避让走 THUMB_EVADE_D(既有通道,保留)。
    if (g.kind === "flick" && axis === "y" && this.active?.cls === "low") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > other.lowEvadeTarget) other.lowEvadeTarget = t;
    }
    // E 族(y.mid)双手单指避让(见 MID_EVADE 注释):E 带扫掠犁**两只手**的
    // 贴 F 面拇指与贴 B 面中指(受害不分弹指手,窗口首尾相接),整手 dodge
    // 已废(DODGE_MAG.y.mid=0),两手都写目标;弹指手无名指的扫掠抬离也由
    // 同一进度驱动(applyHand role===1 分支)。
    if (g.kind === "flick" && axis === "y" && this.active?.cls === "mid") {
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > hands.R.midEvadeTarget) hands.R.midEvadeTarget = t;
      if (t > hands.L.midEvadeTarget) hands.L.midEvadeTarget = t;
    }
    // B 族(z.low)静止手改「食指 + 中指」单指避让(见 B_EVADE 注释):整手
    // dodge 已废(DODGE_MAG.z.low=0),只写另一手目标;弹指手本侧的静止中/
    // 无名指避让走 BACK_EVADE(既有通道,保留)。
    if (g.kind === "flick" && axis === "z" && this.active?.cls === "low") {
      const other = hands[g.hand === "R" ? "L" : "R"];
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > other.bEvadeTarget) other.bEvadeTarget = t;
    }
    // F 族(z.high 遗留拇指分支;topPush/downPush 已在上方整段 return)单指
    // 避让(见 F_EVADE 注释):受害不分弹指手(up 握弹指手的无名指同样被扫),
    // 两手都写目标,施加端按各手握姿选指(home 握手在 applyHand 里不动)。
    if (g.kind === "flick" && axis === "z" && this.active?.cls === "high") {
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > hands.R.fEvadeTarget) hands.R.fEvadeTarget = t;
      if (t > hands.L.fEvadeTarget) hands.L.fEvadeTarget = t;
    }
    // S 族(z.mid)up/down 握「拇指 + 中指」单指避让(见 S_EVADE 注释):
    // 受害不分弹指手(弹指手拇指同样被扫),两手都写目标,施加端按各手握姿
    // 选指(home 握手在 applyHand 里不动 —— home 握 S 全程干净)。
    if (g.kind === "flick" && axis === "z" && this.active?.cls === "mid") {
      const t = Math.min(1, Math.abs(angle) / 0.09);
      if (t > hands.R.sEvadeTarget) hands.R.sEvadeTarget = t;
      if (t > hands.L.sEvadeTarget) hands.L.sEvadeTarget = t;
    }
    const mag = DODGE_MAG[axis][this.active?.cls ?? "whole"];
    if (mag > 0) {
      const t = Math.min(1, Math.abs(angle) / 0.09);
      for (const side of ["R", "L"] as const) {
        if (g.kind === "weld" && g.hands.includes(side)) continue;
        // 接触样式(hook/backHook/upPush):弹指手不外让 —— 指尖要贴面,外让
        // 会拉脱接触;另一手照常外让(穿模保护)。
        if (g.kind === "flick" && (g.style === "hook" || g.style === "backHook" || g.style === "upPush") && g.hand === side) continue;
        const h = hands[side];
        h.dodgeMag = mag;
        if (t > h.dodgeTarget) h.dodgeTarget = t;
      }
    }
  }

  private endGesture(): void {
    const hands = this.hands;
    if (!hands) return;
    for (const side of ["R", "L"] as const) {
      const h = hands[side];
      if (h.weldAxis) {
        // weld 提交(未压缩层角走满 ±90° 倍数)→ 只有 x 轴单层(R/L 腕转)把该
        // 旋转烘进持久握姿基座 —— 腕上下翻是自然持姿。整体转体(x/y/z whole)
        // 不烘:weldAngle 已是 90° 踏移后的残差(提交时 ≈0),直接 slerp 落回
        // home —— 终态 = home 握新朝向的面,与视角/自动转体一致(#20)。
        // 残余(压缩差/采样差)折进回位四元数抹平;未提交(拖拽回弹,snap=0)
        // 整段 weld 姿态 slerp 回当前握姿。
        const snap = Math.round(h.weldRawAngle / HALF_PI);
        if (snap !== 0 && h.weldAxis === "x" && !h.weldWhole) {
          h.grip.premultiply(HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC[h.weldAxis], snap * HALF_PI));
          h.recoverQuat.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle - snap * HALF_PI);
        } else {
          h.recoverQuat.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
        }
        h.recoverT = 0;
        h.weldAxis = null;
        h.weldAngle = 0;
        h.weldRawAngle = 0;
        h.weldWhole = false;
      }
      if (h.flickFinger) {
        h.flickDecay = 1;
        // flickAmount 保留为残留幅度,由 flickDecay 衰减。
        // topPush:flickAmount 保留提交原角(退场姿态由 applyHand 的 effRaw
        // 统一推导,见 TOP_PUSH.retreatSplit 注释)。收指**串行**:reach 钳在 1,
        // decay 段跑虚拟续转 release / 原地缩回,tick 里 decay 归零才 reachTarget=0。
      }
    }
  }

  // ================= 每帧姿态合成 =================

  private static _qTmp = new THREE.Quaternion();
  private static _qTmp2 = new THREE.Quaternion();
  private static _qIdent = new THREE.Quaternion();
  private static _eTmp = new THREE.Euler();
  private static _vTmp = new THREE.Vector3();
  private static _vTmp2 = new THREE.Vector3();
  private static _vTmp3 = new THREE.Vector3();
  private static _vTmp4 = new THREE.Vector3();
  private static _mTmp = new THREE.Matrix4();

  private applyHand(side: HandSide, idle: boolean): void {
    const hands = this.hands;
    if (!hands) return;
    const h = hands[side];
    const g = h.model.group;
    const sideSign = h.model.side;
    const q = HandsRig._qTmp;

    // 手根变换 = 偏移旋转(weld 实时 / 回位余量) ∘ 持久握姿基座 ∘ home。
    if (h.weldAxis) {
      q.setFromAxisAngle(AXIS_VEC[h.weldAxis], h.weldAngle);
    } else if (h.recoverT < 1) {
      // easeOutCubic 回位
      const t = 1 - Math.pow(1 - h.recoverT, 3);
      q.copy(h.recoverQuat).slerp(HandsRig._qIdent, t);
    } else {
      q.identity();
    }
    q.multiply(h.grip);
    g.quaternion.copy(q).multiply(h.home.quat);
    g.position.copy(h.home.pos).applyQuaternion(q);

    // topPush 有效原角(活跃 = 本值;提交后退场 = 虚拟续转 release / 原地缩回;
    // 收指段钳各自终点。姿态推导统一走它,见 TOP_PUSH.retreatSplit 注释)。
    let topEffRaw = 0;
    if (h.flickStyle === "topPush" && h.flickFinger) {
      const amt = Math.abs(h.flickAmount);
      if (h.flickDecay === 0 && h.reachTarget === 1) {
        topEffRaw = amt; // 活跃手势(driveGesture 每帧喂原角)
      } else if (amt >= TOP_PUSH.retreatSplit) {
        // 虚拟续转:原角推进到 release 走满(F2 提交本就 ≥ 该值,无缝)
        topEffRaw = amt + (1 - h.flickDecay)
          * Math.max(0, TOP_PUSH.releaseAt + TOP_PUSH.releaseLen * 1.2 - amt);
      } else {
        topEffRaw = amt * h.flickDecay; // 小角度残余原地缩回
      }
    }
    // topPush 原地腕转(见 TOP_PUSH_FOLLOW 注释):绕「过腕点、平行 z」轴
    // 翻转 ψ(φ_eff) —— 腕点不动 → 前臂静止、手掌不离位,补足食指 32U 可达缺口。
    if (h.flickStyle === "topPush" && h.flickFinger && (h.reachT > 0 || h.flickAmount !== 0)) {
      const smReach = h.reachT * h.reachT * (3 - 2 * h.reachT);
      const psi = followAt(TOP_PUSH_FOLLOW[side].wrist, topPushArcPhi(topEffRaw)) * smReach;
      if (psi !== 0) {
        const W = HandsRig._vTmp.copy(WRIST_LOCAL).applyQuaternion(g.quaternion).add(g.position);
        const qp = HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC.z, psi);
        g.quaternion.premultiply(qp);
        g.position.sub(W).applyQuaternion(qp).add(W);
      }
    }
    // upPush 原地腕转(见 UP_PUSH 注释):绕「过腕点、平行 y」轴偏航 ψ(s),
    // 把整手向左带,补足食指推 RUB→BLU 的可达缺口;decay 同乘倒放。
    if (h.flickStyle === "upPush" && h.flickFinger && (h.reachT > 0 || h.flickAmount !== 0)) {
      const smReach = h.reachT * h.reachT * (3 - 2 * h.reachT);
      const decayW = h.flickDecay > 0 ? h.flickDecay : 1;
      const su = Math.min(Math.abs(h.flickAmount), HALF_PI) / HALF_PI * decayW;
      const wUp = UP_PUSH.wrist;
      const psi = ((wUp[2] * su + wUp[1]) * su + wUp[0]) * su * smReach;
      if (psi !== 0) {
        const W = HandsRig._vTmp.copy(WRIST_LOCAL).applyQuaternion(g.quaternion).add(g.position);
        const qp = HandsRig._qTmp2.setFromAxisAngle(AXIS_VEC.y, psi);
        g.quaternion.premultiply(qp);
        g.position.sub(W).applyQuaternion(qp).add(W);
      }
    }

    // 回位 / 换握 slerp 途中手沿径向外拱(sin 峰在行程中段,行程角越大拱越高):
    // 手绕魔方扫 90°(↑↓ 换握)时指腹接触半径 ~117U 小于角柱扫掠半径 135.8U,
    // 不外拱会整排手指削穿棱柱区(穿模禁令)。残余小角度(<0.06rad)不拱。
    // 单靠外拱不够:外拱只沿「手根相位」的径向推,与手根相位错开的指肉
    // (拇指压 F 面、指列贴 B 面)几乎不受益,oracle 实测换握中段仍 35~41U
    // 深插 —— 所以叠加「张手」(regripOpen,下方手指环节):像真人换握时
    // 松开手指,行程中段把 curl 压掉大半,指尖从抓握半径伸展出扫掠区。
    let regripOpen = 0;
    if (!h.weldAxis && h.recoverT < 1) {
      const ang = 2 * Math.acos(Math.min(1, Math.abs(h.recoverQuat.w)));
      if (ang > 0.06) {
        const t = 1 - Math.pow(1 - h.recoverT, 3);
        const ax = HandsRig._vTmp.set(h.recoverQuat.x, h.recoverQuat.y, h.recoverQuat.z);
        if (ax.lengthSq() > 1e-9) {
          ax.normalize();
          const radial = HandsRig._vTmp2.copy(g.position).addScaledVector(ax, -g.position.dot(ax));
          if (radial.lengthSq() > 1) {
            g.position.addScaledVector(radial.normalize(), Math.sin(Math.PI * t) * ang * 26);
          }
        }
        // 张手量:行程角 ≥90° 全开;小残余回位(flick 借力 ~9°)几乎不开。
        if (ang > 0.3) regripOpen = Math.sin(Math.PI * t) * Math.min(1, ang / HALF_PI);
      }
    }

    // 转层外让:沿本侧外向 x 平移(见 DODGE_MAG 注释)。
    if (h.dodge > 0) {
      g.position.x += h.dodge * h.dodgeMag * (sideSign === -1 ? 1 : -1);
    }

    // 待机微动:极轻的呼吸浮动(位移 ±1.0,相位左右手错开)。禁走 z —— 那是
    // B/F 接触法向,肉面标定间隙只 ~0.8U,呼吸会周期性吃穿;改沿本侧外向 x
    // (掌与 R/L 面之间本就留 ~97U 空腔,纯切向安全)。换握回位途中(recoverT<1)
    // 禁全部;y 呼吸只在 home 握走 —— up/down 握下 y 变成拇指/指列的 U/D 接触
    // 法向(L 拇指间隙只 1.25U,旧 ±2.64U 呼吸周期性吃穿 1.4U,oracle 2026-07-07
    // 现形,存量 bug);外向 x 在任意绕 x 握姿下都切向安全,保留。指弹进行中
    // (flickFinger)也禁全部 —— topPush 无 weld,呼吸会叠在按压接触上抖
    // (±2U 噪声 > 1.2U 接触间隙,标定/oracle 全被污染,2026-07-07 现形)。
    if (idle && !h.weldAxis && !h.flickFinger && h.recoverT >= 1) {
      const t = this.idleClock / 1000;
      const ph = side === "R" ? 0 : 1.7;
      // y 呼吸幅度 0.4(旧 1.0):2026-07-09 拇指 home 抬进 E 层带后可见肉
      // y∈[−30.9,30.9],距 ±32 带界只剩 ~1.1U —— 旧 ±2.2U 呼吸会周期性把
      // 拇指肉推出 E 带(L 相位 1.7 起手即 +2.18,实测 33.2)。
      if (h.grip.w > 0.9999) g.position.y += Math.sin(t * 1.1 + ph) * 0.4 * HAND_SCALE;
      g.position.x += Math.cos(t * 0.9 + ph) * 0.8 * HAND_SCALE * (sideSign === -1 ? 1 : -1);
    }

    // 前臂 IK:origin 贴到手腕接驳点,+x 指向「肘 → 腕」方向 —— 肘锚固定,
    // 腕转/弹指/回位时前臂自然摆动而不是整条手臂绕魔方公转。滚转对齐掌平面:
    // setFromUnitVectors 最小旋转的滚转随肘-腕方位漂,扁截面会转离腕背压扁向
    // 现台阶;改正交基 +x=肘→腕、+z≈手系掌法向,截面扁向永远接续手背/掌面。
    const wrist = HandsRig._vTmp.copy(WRIST_LOCAL).applyQuaternion(g.quaternion).add(g.position);
    h.forearm.position.copy(wrist);
    const dir = HandsRig._vTmp2.copy(wrist).sub(h.elbow).normalize();
    const zF = HandsRig._vTmp3.set(0, 0, 1).applyQuaternion(g.quaternion);
    zF.addScaledVector(dir, -zF.dot(dir));
    if (zF.lengthSq() < 1e-6) zF.set(0, 0, 1); // 臂轴撞上掌法向的退化兜底
    zF.normalize();
    const yF = HandsRig._vTmp4.crossVectors(zF, dir);
    h.forearm.quaternion.setFromRotationMatrix(HandsRig._mTmp.makeBasis(dir, yF, zF));

    // 手指姿态 = home 弯曲 + flick 偏移。
    const sm = (t: number): number => t * t * (3 - 2 * t);
    const decayK = h.flickDecay > 0 ? h.flickDecay : 1;
    const flickA = h.flickFinger ? h.flickAmount * decayK : 0;
    // 连拨(FINGERTRICKS §4.1):未钳制原角按象限拆两指 —— 首指扫 [0,90°] 后保持
    // 末姿不恢复,次指前 90° 就位、[90°,180°] 接力;drop 后 decayK 同乘,两指
    // 一起恢复(用户硬规则)。
    const isDouble = h.flickFinger2 !== null;
    const rawAbs = Math.abs(h.flickAmount);
    const rawSign = h.flickAmount < 0 ? -1 : 1;
    const amt1 = isDouble ? Math.min(rawAbs, HALF_PI) * decayK : 0;
    const amt2 = isDouble ? Math.max(0, Math.min(rawAbs - HALF_PI, HALF_PI)) * decayK : 0;
    // 回撤禁倒放(2026-07-08 真实播放 oracle 现形 −27U):fit 是「贴面路径」,
    // decay 若把 s 缩小 = 沿接触曲线倒放,而提交后层角已归零(魔方恢复整体),
    // 倒放中段的贴面姿态直接穿进复位的层。改为 s 取未缩层角、decayK 只乘 fit
    // 输出 —— 回撤变成关节空间直线回 home(末端 fit(1)≈0 由 endHome 正则拉住,
    // 起点即终姿,途中不再重返扫掠带)。upPush 弧退例外(U 面平面在 y 旋转下
    // 不变,沿弧倒放贴面天然安全,保留原 share 语义)。
    const sRaw1 = Math.min(rawAbs, HALF_PI) / HALF_PI;
    const sRaw2 = Math.max(0, Math.min(rawAbs - HALF_PI, HALF_PI)) / HALF_PI;
    const prep2T = isDouble ? sm(Math.min(1, rawAbs / HALF_PI)) * decayK : 0;
    // F 族遗留分支避让按本手握姿选指(见 F_EVADE 注释):up = 拇指+无名指在
    // F 带内 / down = 食指在 F 带内 / home 与非标准握的指肉都在带外,不动。
    let fEvadeGrip: GripName | null = null;
    if (h.fEvade > 0) {
      if (h.grip.angleTo(GRIP_Q_UP) < 0.01) fEvadeGrip = "up";
      else if (h.grip.angleTo(GRIP_Q_DOWN) < 0.01) fEvadeGrip = "down";
    }
    // S 族避让同款握姿选指(见 S_EVADE 注释):up/down 握拇指+中指探进 S 带,
    // home 与非标准握的指肉都在带外,不动。
    let sEvadeGrip: GripName | null = null;
    if (h.sEvade > 0) {
      if (h.grip.angleTo(GRIP_Q_UP) < 0.01) sEvadeGrip = "up";
      else if (h.grip.angleTo(GRIP_Q_DOWN) < 0.01) sEvadeGrip = "down";
    }
    for (const name of ["thumb", "index", "middle", "ring", "pinky"] as const) {
      const f = h.model.fingers[name];
      const pose = h.home.fingers[name];
      let c1 = pose.curl[0];
      let c2 = pose.curl[1];
      let c3 = pose.curl[2];
      let splay = pose.splay * sideSign;
      // topPush 伸指是时间驱动(reachT),层角为零的前置/回收期间也要摆位。
      const topPush = h.flickStyle === "topPush" && h.flickFinger === name;
      // 本指角色与负担扫角(带符号):单指 = 全量;连拨首指钳 90°、次指接后半。
      const role = h.flickFinger === name ? 1 : h.flickFinger2 === name ? 2 : 0;
      // D 族拇指避让(见 THUMB_EVADE_D 注释):非弹指角色的拇指在 D/D' 期间抬避。
      if (name === "thumb" && role === 0 && h.flickStyle === "hook" && h.flickAxis === "y"
        && (h.flickFinger === "ring" || h.flickFinger === "pinky")) {
        const ev = THUMB_EVADE_D[side];
        const tEv = sm(Math.min(1, rawAbs / 0.12)) * decayK;
        c1 += ev.c1 * tEv;
        c2 += ev.c2 * tEv;
        c3 += ev.c3 * tEv;
        splay += ev.splay * tEv;
      }
      // B 族静止指避让(见 BACK_EVADE 注释):backHook 期间静止的中/无名指抬离 B 面。
      if ((name === "middle" || name === "ring") && role === 0 && h.flickStyle === "backHook") {
        const ev = BACK_EVADE[side];
        const tEv = sm(Math.min(1, rawAbs / 0.12)) * decayK;
        c1 += ev.c1 * tEv;
        c2 += ev.c2 * tEv;
        c3 += ev.c3 * tEv;
        splay += ev.splay * tEv;
      }
      // U 族静止手食指离面避让(见 HOOK_INDEX_EVADE 注释):弹指发生在另一只
      // 手上,本手无 flick 状态,进度走 tick 推进的 indexEvade(role===0 兜住
      // 「上一步避让还在回落、本手食指已开始弹下一步」的重叠帧)。
      if (name === "index" && role === 0 && h.indexEvade > 0) {
        const ev = HOOK_INDEX_EVADE[side];
        c1 += ev.c1 * h.indexEvade;
        c2 += ev.c2 * h.indexEvade;
        c3 += ev.c3 * h.indexEvade;
        splay += ev.splay * h.indexEvade;
      }
      // D 族静止手「无名指 + 拇指」单指避让(见 LOW_EVADE 注释):弹指发生在
      // 另一只手上,进度走 tick 推进的 lowEvade(role===0 兜重叠帧,同上)。
      // splay 两手镜像符号已烘入表内,不 ×sideSign(同 THUMB_EVADE_D 先例)。
      if ((name === "ring" || name === "thumb") && role === 0 && h.lowEvade > 0) {
        const ev = LOW_EVADE[side][name];
        c1 += ev.c1 * h.lowEvade;
        c2 += ev.c2 * h.lowEvade;
        c3 += ev.c3 * h.lowEvade;
        splay += ev.splay * h.lowEvade;
      }
      // B 族静止手「食指 + 中指」单指避让(见 B_EVADE 注释):弹指发生在另一只
      // 手上,进度走 tick 推进的 bEvade(role===0 兜重叠帧,同上)。
      if ((name === "index" || name === "middle") && role === 0 && h.bEvade > 0) {
        const ev = B_EVADE[side][name];
        c1 += ev.c1 * h.bEvade;
        c2 += ev.c2 * h.bEvade;
        c3 += ev.c3 * h.bEvade;
        splay += ev.splay * h.bEvade;
      }
      // F 族遗留分支单指避让(见 F_EVADE 注释):受害不分弹指手,两手同走
      // tick 推进的 fEvade,按本手握姿选指;splay 镜像符号已烘入表内,不
      // ×sideSign。role===0 兜重叠帧;弹指手指自身在 decay 段(flickDecay>0)
      // 也要吃 evade —— 同类连发(F 接 F')时上一步的弹指拇指正随 decayK 回落
      // 回 home 位,恰落进下一步的扫掠区(真实播放 oracle 实测 10.6U),且
      // decay 清零瞬间 role 0 才生效会造成单帧姿态跳变;正在扫的弹指
      // (flickDecay===0)不避,指尖要沿面扫。
      if ((role === 0 || h.flickDecay > 0) && h.fEvade > 0 && fEvadeGrip !== null
        && (fEvadeGrip === "up" ? name === "thumb" || name === "ring" : name === "index")) {
        const ev = F_EVADE[side][name as "thumb" | "ring" | "index"];
        c1 += ev.c1 * h.fEvade;
        c2 += ev.c2 * h.fEvade;
        c3 += ev.c3 * h.fEvade;
        splay += ev.splay * h.fEvade;
      }
      // S 族 up/down 握「拇指 + 中指」单指避让(见 S_EVADE 注释):受害不分
      // 弹指手,两手同走 tick 推进的 sEvade,按本手握姿选指(home 握不动);
      // splay 镜像符号已烘入表内,不 ×sideSign。role===0 兜重叠帧;弹指手指
      // 自身在 decay 段(flickDecay>0)也吃 evade(同 F_EVADE:同类连发时
      // 上一步弹指中指随 decayK 回落恰落进下一步扫掠区,且免 decay 清零瞬间
      // 的单帧姿态跳变);正在扫的弹指中指(flickDecay===0)不避,自己扫开。
      if ((role === 0 || h.flickDecay > 0) && h.sEvade > 0 && sEvadeGrip !== null
        && (name === "thumb" || name === "middle")) {
        const ev = S_EVADE[side][name];
        c1 += ev.c1 * h.sEvade;
        c2 += ev.c2 * h.sEvade;
        c3 += ev.c3 * h.sEvade;
        splay += ev.splay * h.sEvade;
      }
      // E 族双手「拇指 + 中指」单指避让(见 MID_EVADE 注释):受害不分弹指手,
      // 两手同走 tick 推进的 midEvade(role===0 兜重叠帧,同上)。
      if ((name === "thumb" || name === "middle") && role === 0 && h.midEvade > 0) {
        const ev = MID_EVADE[side][name];
        c1 += ev.c1 * h.midEvade;
        c2 += ev.c2 * h.midEvade;
        c3 += ev.c3 * h.midEvade;
        splay += ev.splay * h.midEvade;
      }
      // E 族弹指无名指扫掠抬离(见 MID_EVADE 注释):legacy 勾弯标定于旧整手
      // dodge=62 之下,dodge 归零后扫掠中段 / softClamp 保持段 / 回撤会探进
      // E 带(裸基线 4.3~4.8U),叠一层沿 B 面外法线(−z)的基节伸展偏置。
      // !flickStyle 挡掉 styled hook(D 族无名指有自己的贴面 fit)。
      if (name === "ring" && role === 1 && !h.flickStyle && h.midEvade > 0) {
        const ev = MID_EVADE[side].ring;
        c1 += ev.c1 * h.midEvade;
        c2 += ev.c2 * h.midEvade;
        c3 += ev.c3 * h.midEvade;
        splay += ev.splay * h.midEvade;
      }
      const share = !isDouble ? (role === 1 ? flickA : 0) : (role === 1 ? amt1 : amt2) * rawSign;
      const engaged = role === 1
        ? (h.reachT > 0 || share !== 0)
        : role === 2 && (prep2T > 0 || share !== 0);
      if (engaged) {
        // 弹指(前后钳形握姿)分扫法,匹配接触点处层面的真实运动方向:
        //  拇指(F 族):折叠的中节展开 → 沿 F 面向上大扫幅;
        //  y 轴(U/D/E,食指/无名指)与 hook/backHook:层动水平朝本手掌心 →
        //  向掌心勾弯横拉(真实拨 U 是「勾」;反向伸展会向手背过伸 —— 用户报障);
        //  downPush/upPush:压面推层(FINGERTRICKS §4.3/§4.5);
        //  x/z 轴中指(M/B/S 族):接触立柱处层动是竖直的 → splay 竖扫为主。
        const open = Math.min(1, Math.abs(share) / HOOK.open);
        if (topPush) {
          // 食指越顶(home 握 F 族):reach(时间驱动)先抬(splay 竖直离开
          // B 面)后卷(c1 大幅前卷 + 中末节拉直,指链横越 U 面上方),指尖
          // 落到 UFR/UFL 角块 U 面贴纸上方。转动段物理跟随:press 从转动
          // 一开始压满(推动=接触),腕 track 同转(driveGesture);释放段
          // (releaseAt 后)press 渐出 + releaseLift 抬离扫掠区,层滑行收尾。
          // 收指 reachT 倒放同路径。
          const liftT = sm(Math.min(1, h.reachT / TOP_PUSH.liftIn));
          const sweepT = sm(Math.max(0, (h.reachT - TOP_PUSH.sweepStart) / (1 - TOP_PUSH.sweepStart)));
          // reach 早段微伸(sin 包络):抬升弧面稍向内斜,顶着 B 面上沿滑会
          // 蹭进 2.65U(oracle),c1 退一点让指腹离面爬升。
          const backOff = Math.sin(Math.PI * Math.min(1, h.reachT / 0.35)) * TOP_PUSH.backOff;
          // 接触跟随:指尖钉住随层转的角块贴纸(全程接触规格),knot 曲线随
          // 弧位置 φ_eff 展开(knot0 即按压姿,reach 到位即贴住);release(F2
          // 第二象限)/ 收指沿同曲线倒放 —— φ_eff 退回 = 手指原路撤离,见
          // topPushArcPhi 注释。
          const FW = TOP_PUSH_FOLLOW[side];
          // φ/release 统一从 topEffRaw 推导:活跃段 = 原角(与旧行为一致);
          // 退场段 = 虚拟续转 release(与 F2 已验证姿态点对点相同)/ 原地缩回。
          const phi = topPushArcPhi(topEffRaw);
          const relEff = topPushRelease(topEffRaw);
          const followGate = sm(h.reachT);
          c1 += sweepT * TOP_PUSH.c1 - backOff + followAt(FW.c1, phi) * followGate;
          c2 += sweepT * TOP_PUSH.c2 + followAt(FW.c2, phi) * followGate;
          c3 += sweepT * TOP_PUSH.c3 + followAt(FW.c3, phi) * followGate;
          // 抬升方向 = 世界 +y;splay 局部符号在镜像资产下左右相反,×sideSign
          // (R 实测 splay 负=抬升;L 反之)。releaseLift 挂 followGate:活跃段
          // 恒 1 无影响,收指段随 reach 渐出(从带抬离的按压位平滑归位)。
          splay += (liftT * TOP_PUSH.lift + relEff * TOP_PUSH.releaseLift * followGate
            + followAt(FW.splay, phi) * followGate) * sideSign;
        } else if (h.flickStyle === "downPush") {
          // 左中右下 F 族(FINGERTRICKS §4.3):食指尖起手压 U 面 UFR 区,随层角
          // 前卷把初始 UFR 往前下带;F2 次指中指 Q1 前探 UF 缘、Q2 接力。
          const t = role === 2 ? sRaw2 : (isDouble ? sRaw1 : Math.min(rawAbs, HALF_PI) / HALF_PI);
          if (role === 2) {
            c1 += DOWN_PUSH.prep2.c1 * prep2T;
            c2 += DOWN_PUSH.prep2.c2 * prep2T;
            c3 += DOWN_PUSH.prep2.c3 * prep2T;
            splay += DOWN_PUSH.prep2.splay * prep2T;
          }
          const fit = HOOK_FOLLOW[side][`downPush_${name}${role === 2 ? "2" : ""}`];
          if (fit) {
            c1 += fitAt(fit, "c1", t) * decayK;
            c2 += fitAt(fit, "c2", t) * decayK;
            c3 += fitAt(fit, "c3", t) * decayK;
            splay += fitAt(fit, "splay", t) * decayK;
          } else {
            c1 += DOWN_PUSH.c1 * t * decayK;
            c2 += DOWN_PUSH.c2 * t * decayK;
            c3 += DOWN_PUSH.c3 * t * decayK;
            splay += DOWN_PUSH.splay * t * decayK;
          }
          if (h.flickDecay > 0) {
            // 快攻-平台-快收包络(非对称正弦):D2' 类深绕缠从 decay 第一帧就开始
            // 切弦,正弦起攻太慢救不了头段(oracle 实测 −4.7@dec0.89)。
            const lift = sm(Math.min(1, (1 - decayK) / 0.12)) * sm(Math.min(1, decayK / 0.15)) * t;
            c1 += RETREAT_LIFT.c1 * lift;
            c2 += RETREAT_LIFT.c2 * lift;
            c3 += RETREAT_LIFT.c3 * lift;
          }
        } else if (h.flickStyle === "upPush") {
          // U'p 推法(FINGERTRICKS §4.5):reach 爬上 RUB 角块 U 贴纸,随层角
          // 沿 U 面推初始角块到 BLU;decay 沿弧倒放(U 面平面在 y 旋转下不变,
          // 弧退贴面天然安全),收指段 reach 倒放爬回 B 面。
          const smR = sm(h.reachT);
          const t = Math.min(Math.abs(share), HALF_PI) / HALF_PI;
          c1 += UP_PUSH.climb.c1 * smR;
          c2 += UP_PUSH.climb.c2 * smR;
          c3 += UP_PUSH.climb.c3 * smR;
          splay += UP_PUSH.climb.splay * smR;
          const tr = Math.sin(Math.PI * h.reachT); // 转移凸包(见 UP_PUSH.transit)
          c1 += UP_PUSH.transit.c1 * tr;
          c2 += UP_PUSH.transit.c2 * tr;
          c3 += UP_PUSH.transit.c3 * tr;
          splay += UP_PUSH.transit.splay * tr;
          const fit = HOOK_FOLLOW[side][`upPush_${name}`];
          if (fit) {
            c1 += fitAt(fit, "c1", t);
            c2 += fitAt(fit, "c2", t);
            c3 += fitAt(fit, "c3", t);
            splay += fitAt(fit, "splay", t);
          } else {
            c1 += UP_PUSH.follow.c1 * t;
            c2 += UP_PUSH.follow.c2 * t;
            c3 += UP_PUSH.follow.c3 * t;
            splay += (UP_PUSH.follow.splay + UP_PUSH.follow.drift) * t;
          }
        } else if (name === "thumb") {
          c1 -= open * 0.25;
          c2 -= open * 0.9;
          c3 -= open * 0.35;
        } else if (h.flickStyle === "hook" || h.flickStyle === "backHook" || h.flickAxis === "y") {
          // 「勾」的合成(y 族默认;双中手接触样式 hook 含连拨;B'/B 背钩
          // backHook 同族 —— B 面顶带在 z 旋转下切向水平移动,勾法同 U):
          // 基节伸展把指尖抬离层面(位置上退,不扎进转动层),中/末节加弯给出
          // 可见的向掌心勾弯(用户规格:拨 U 手指要弯,禁向手背反弓)。
          if (role === 2 && prep2T > 0) {
            // 连拨次指就位(U2 中指上探 / D2' 无名指让位 / B2 中指上探顶带);
            // 键按样式区分(hook 与 backHook 的中指就位目标不同)。
            const p = HOOK_PREP[side][`${h.flickStyle}_${name}`];
            if (p) {
              c1 += p.c1 * prep2T;
              c2 += p.c2 * prep2T;
              c3 += p.c3 * prep2T;
              splay += p.splay * prep2T * sideSign;
            }
          }
          if (name === "pinky" && h.reachT > 0) {
            // D2' 首指小指:前置伸至 D 层 BDR 接触位(prepareTwist reach)
            const smR = sm(h.reachT);
            c1 += PINKY_REACH.c1 * smR;
            c2 += PINKY_REACH.c2 * smR;
            c3 += PINKY_REACH.c3 * smR;
            splay += PINKY_REACH.splay * smR * sideSign;
          }
          // 接触样式且有标定跟随曲线 → 二次型跟随(贴面);否则回退旧勾弯。
          const fit = h.flickStyle
            ? HOOK_FOLLOW[side][`${h.flickStyle}_${name}${role === 2 ? "2" : ""}`] : undefined;
          if (fit) {
            const s = role === 2 ? sRaw2 : (isDouble ? sRaw1 : Math.min(rawAbs, HALF_PI) / HALF_PI);
            // 钉角 M 端姿的 per-style 回撤覆盖(见 RETREAT_LIFT_STYLED):贴块
            // 提交姿 pad 离贴纸只 ~1.4U,fit(1)×decayK 的第一帧就往贴纸里拉
            // (oracle 实测 0.8U)—— 攻窗(decayK ∈ [0.88,1])先钳 kFit=1 保持
            // 提交姿,等回撤凸包升满再沿直线衰减;凸包包络仍走 decayK。
            const rlS = h.flickDecay > 0
              ? RETREAT_LIFT_STYLED[side][`${h.flickStyle}_${name}${role === 2 ? "2" : ""}`] : undefined;
            const kFit = rlS ? Math.min(1, decayK / 0.88) : decayK;
            c1 += fitAt(fit, "c1", s) * kFit;
            c2 += fitAt(fit, "c2", s) * kFit;
            c3 += fitAt(fit, "c3", s) * kFit;
            splay += fitAt(fit, "splay", s) * kFit; // 每手独立标定,含侧向符号
            // U2 首指退场(HOOK_EXIT 注释):Q2 前 20% 内食指快速离开角 M
            // (走廊在 Q2 中后段被下一个角柱扫过,必须撤出扫掠环带),此后
            // 保持退场姿到提交(随 kFit 与次指一起归 home)。
            if (role === 1 && isDouble && h.flickStyle === "hook" && name === "index") {
              const ex = sm(Math.min(1, sRaw2 / HOOK_EXIT_IN)) * kFit;
              c1 += HOOK_EXIT.c1 * ex;
              c2 += HOOK_EXIT.c2 * ex;
              c3 += HOOK_EXIT.c3 * ex;
              splay += HOOK_EXIT.splay * ex * sideSign;
            }
            // B2/B2' 连拨首指退场(BACK_EXIT 注释):Q1 末端姿在角柱扫掠环带
            // 内(径向 ~105U),Q2 前 20% 内沿 −z 拉出;splay 符号已烘入表。
            if (role === 1 && isDouble && h.flickStyle === "backHook" && name === "index") {
              const bx = BACK_EXIT[side];
              const ex = sm(Math.min(1, sRaw2 / HOOK_EXIT_IN)) * kFit;
              c1 += bx.c1 * ex;
              c2 += bx.c2 * ex;
              c3 += bx.c3 * ex;
              splay += bx.splay * ex;
            }
            if (h.flickDecay > 0) {
              // 包络说明见 downPush 分支同款注释;非钉角样式回落默认 RETREAT_LIFT。
              const lift = sm(Math.min(1, (1 - decayK) / 0.12)) * sm(Math.min(1, decayK / 0.15)) * s;
              const rl: { c1: number; c2: number; c3: number; splay?: number } = rlS ?? RETREAT_LIFT;
              c1 += rl.c1 * lift;
              c2 += rl.c2 * lift;
              c3 += rl.c3 * lift;
              splay += (rl.splay ?? 0) * lift;
            }
          } else {
            c1 += HOOK.c1 * open;
            c2 += HOOK.c2 * open;
            c3 += HOOK.c3 * open;
            splay += softClampAngle(share) * HOOK.drift * (side === "R" ? 1 : -1) * sideSign;
          }
        } else {
          // x/z 族竖扫。世界系扫向:z 族(B/S)两手各推自己那根立柱,方向随
          // dir 与手绑定(右列 down=dir 正);x 族(M/E' 同轴)绕 x 转时整个
          // B 面同向竖移,与手无关 —— 先算世界竖向 vy,再按「右手 splay 正
          // = 世界向下 / 左手相反」换算符号(不能用镜像对称公式:绕 x 的旋转
          // 在 x=0 镜像下不变,两手需求会打架,推导见 memory)。
          c1 -= open * 0.15;
          c2 -= open * 0.25;
          c3 -= open * 0.3;
          const vy = (h.flickAxis === "z" && side === "L" ? 1 : -1) * Math.sign(share);
          splay += (side === "R" ? -1 : 1) * vy * 0.45 * Math.abs(share);
        }
      }
      // 换握张手:行程中段把弯曲压掉大半(见 regripOpen 注释),指尖伸展
      // 离开抓握半径;splay 不动(横向散开会互相打架)。
      if (regripOpen > 0) {
        if (name === "thumb") {
          // 拇指例外(2026-07-09 E 带姿):四指「张」= 压 curl 伸直离开抓握
          // 半径,但拇指压的是 F 面、末节大弯(c3≈1.1)—— 同款压 curl 会把
          // 指尖伸直戳进 F 面(regrip oracle 实测 7.6U;旧姿 c3=0.55 时 2.9U
          // 已有暴露)。拇指的「张」= 轻开 curl + 绕根节向贴面外甩
          // (THUMB_EVADE_D 同款方向,随 open 渐入),yz 径向甩出箱体对角
          // 扫掠区。幅度 regrip play oracle 标定。
          const k = 1 - regripOpen * 0.3;
          c1 *= k;
          c2 *= k;
          c3 *= k;
          c2 -= 0.16 * regripOpen;
          splay += (side === "R" ? -1 : 1) * 0.4 * regripOpen;
        } else {
          // oracle 标定:0.6 时 180° 换握中段剩 3.2U,0.72 剩 0.46U(↓→↑),
          // 0.78 全零(旧平摊 curl);2026-07-07 home 加弯档后残余绝对弯曲
          // 变大,中段指尖勾 U 面 1.38U → 提到 0.86。
          const k = 1 - regripOpen * 0.86;
          c1 *= k;
          c2 *= k;
          c3 *= k;
        }
      }
      // 反弓钳制:extend 类偏移(x/z 竖扫)可能把中/末节压到负值 ——
      // 手指向手背反弓是解剖学假(用户报障同族问题)。拇指 IP 生理上可轻度
      // 过伸(拨 F 的推压姿),给 -0.5 下限。
      if (name === "thumb") {
        c2 = Math.max(-0.5, c2);
      } else {
        c2 = Math.max(0.03, c2);
      }
      c3 = Math.max(0.03, c3);
      // 指根 = 基座朝向 ∘ (curl/splay)。四指基座为 identity;拇指基座是对掌位
      // 四元数 —— 直接写 rotation 会抹掉它(踩过),必须叠加。
      HandsRig._eTmp.set(0, -c1, splay);
      f.root.quaternion.setFromEuler(HandsRig._eTmp).premultiply(f.rootBase);
      f.mid.rotation.set(0, -c2, 0);
      f.tip.rotation.set(0, -c3, 0);
    }
  }

  /** 释放几何/材质(rig 与 world 同生命周期,当前无人调用;备完整性)。 */
  dispose(): void {
    if (this.hands) {
      for (const side of ["R", "L"] as const) {
        for (const m of this.hands[side].model.meshes) m.geometry.dispose();
      }
    }
    this.skinMat.bumpMap?.dispose();
    this.skinMat.dispose();
    for (const mat of this.handMats) {
      mat.map?.dispose();
      mat.bumpMap?.dispose();
      mat.roughnessMap?.dispose();
      mat.dispose();
    }
    this.cuffMat.dispose();
    for (const m of this.skelMats) m.dispose();
  }
}
