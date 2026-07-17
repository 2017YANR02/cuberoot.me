# /sim 图像面板 异形拼图 sr 精确一致 — 待办

方案 A:异形(sq1/pyraminx/megaminx/skewb)右侧 sr 预览 = 朝向 + 配色 + 透视 + 状态 与左边 3D 一致(风格用 sr,不复刻 sim 网格外观)。详见 memory `project_sim_exotic_sr_exact_match.md`。

## 关键发现:sim 异形引擎用「固定配色」,不是 faceColors 面板
- **skewb** → `CUBE_FILL`(WCA 标准,`@/lib/cube-colors`)
- **sq1** → `SQ1_COLORS`(F=红 R=绿 U=黑…,`engine/sq1/sq1Colors.ts`)
- **pyraminx** → `CUBE_FILL` 按面 index(0=D 1=F 2=R 3=B)
- **megaminx** → cubing.js `defaultPlatonicColorSchemes()[12]`(twizzle scheme,键 `{U,F,R,C,A,L,E,BF,BR,BL,I,D}`)

`srSchemeFor` 必须喂这些固定色,**不能**喂 `spec.faceU..B`(只有默认调色板 = 固定 scheme 时才凑巧对上,用户改色即分叉)。

## 已完成
| 拼图 | 配色 | 朝向(SR_ANGLE_BASE) | 状态 |
|---|---|---|---|
| **skewb** | `CUBE_FILL` ✅ | `{yaw:90}` ✅ | 完成 |
| **sq1** | `SQ1_COLORS` ✅ | `{yaw:0,pitch:-90}` → z-36/x-59 ✅ | 完成 |
| **pyraminx** | `CUBE_FILL`(left=F right=R top=B back=D)✅ | `{yaw:36,pitch:-51,yawSign:-1}` → y0/x-20 ✅ | 默认对上;跟踪近似 |

## 待办
### megaminx ⛔(需专门一轮)
两难点:
1. **配色 12 面命名不一致**:sim/cubing.js scheme 键 `{U,F,R,C,A,L,E,BF,BR,BL,I,D}` vs sr 键 `{U,F,R,dr,dl,L,d,br,BR,BL,bl,b}` —— 非恒等映射,要逐面几何对齐(sr debug-color 大图单独读键位,再对 cubing.js 面名)。sr 默认色也不等于 sim(sim 底面 C=Cream 奶油,sr 默认底是黄/粉)。
2. **正十二面体朝向**:sim 默认 = twizzle canonical(U 顶面 / F-R 前棱)+ yaw-36 转角视图;sr identity = F 正对相机(canonical face-front),但五边形几何使 {y} 自旋非线性滑动,y36/y54/y72 扫描面位跳变难读。
- 现状:mega 落回旧 sr-iso 锚(不回归,但配色/朝向不精确匹配)。
- 建议:单开一轮,先 300px 大图 debug-color 读 sr 全 12 键位建映射表,再定朝向;透视另计。

### 透视 P2 ⛔(全部)
runtime patch sr `Camera` 距离,由 `mapPerspective(v)=2+(v/100)*8` 驱动。sr 现在相机写死,预览比左边略扁。

### pyra/mega 跟踪精度
sq1/skewb 滑杆跟踪 1:1;pyra 因 tetra 几何 gain 不同,只在默认精确、偏离近似(已在 `SR_ANGLE_BASE` 注释)。mega 同理待定。

## 已知 BUG(follow-up,非阻塞)
- **skewb 两图转动记号不统一**:同一 alg/scramble 喂左(sim WCA skewb 记号,`project_sim_skewb_wca_notation.md`)和右(sr 自有 skewb 记号)得到**不同状态**——solved 一致,一转即分叉。修法:喂 sr 前把 WCA skewb 记号翻译成 sr 记号。sq1/pyra/mega 同样需核对记号对齐。

## 标定法
temp 在 `PuzzleSVG.tsx` `patchSrPuzzlegen(mod)` 后挂 `window.__srMod=mod`,浏览器 eval `mod.SVG(host,type,{width,height,puzzle:{rotations,scheme}})` 扫候选栅格对左边 sim GL canvas(默认 viewAngle=30/viewGradient=33 → yaw=-36/pitch=30.6)。**判据 = 左边**。标定完删 hook。左右滑杆(input[type=range])index:灵敏度0 缩放1 透视2 Yaw(左右)3 Pitch(上下)4 转速5。
