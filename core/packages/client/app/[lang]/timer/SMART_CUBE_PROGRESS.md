# Smart Cube Progress

智能魔方平台化改造的进度跟踪。每个 Sprint 完成后追加一节，不重写历史。

相关文档：

- `SMART_CUBE_RESEARCH.md` — 竞品调研（XC大师 / GAN 魔方星球 / 魔域 / 奇艺 / Cubeast / csTimer）
- `SMART_CUBE_MIGRATION.md` — csTimer → timer 功能对齐表

---

## Sprint 1 — 修复状态同步（已完成，待实体复验）

### 现象

用户按屏幕上的打乱公式把实体 GAN 16 UI（驱动识别为 `gan-v4`）打乱到与预览图完全一致，
页面仍然显示 **「与打乱不符」**。同时右下角实时状态小图与实体魔方对不上。

### 根因（代码定位，非猜测）

一共三个独立缺陷，第一个是决定性的。

#### 缺陷 A — GAN v3/v4 的第一步转动被静默吞掉（决定性根因）

csTimer 的 `parseV4Data` 在收到 **facelets 快照事件**（v4 = `mode 0xED`，v3 = `mode 2`）时，
把魔方自报的真实状态解出来并调用 `initCubeState()`：

```js
// D:\cube\cstimer\src\js\hardware\gancube.js:421-433
function initCubeState() {
  GiikerCube.callback(latestFacelet, [], [null, locTime], deviceName);
  prevCubie.fromFacelet(latestFacelet);   // ← 以魔方真实状态为基准
  prevMoveCnt = moveCnt;                  // ← 用快照里的计数器给 prevMoveCnt 播种
  ...
}
```

我们的 v3/v4 驱动 **完全忽略了这个事件**：

- `_lib/bluetooth/gan_v4.ts:26-28` — 注释明写 `mode 0xED → facelets snapshot (we ignore …)`，
  函数体里没有 `0xed` 分支，直接落到末尾 `return []`。
- `_lib/bluetooth/gan_v3.ts:233-235` — 同样，`mode 2` 被显式忽略。

于是 `prevMoveCnt` 只能靠**第一个 move 事件**来播种，而那个分支会把这一步丢掉：

```ts
// gan_v4.ts:198-202（gan_v3.ts:168-172 同构）
if (dec.prevMoveCnt === -1) {
  dec.prevMoveCnt = moveCnt;
  return [];          // ← 连接后的第一步转动被吞
}
```

**后果**：连接后用户拧的第一步永远不会进入 `CubeStateTracker`。
跟踪状态恒等于「真实状态 × 第一步的逆」，所以：

- 打乱完成后 `facesEqual(tracked, applyScramble(scramble))` 恒为 false → 「与打乱不符」；
- 还原完成后 `isSolved()` 也恒为 false → **自动停表永远不触发**。

对照组：`gan_v2.ts:196` 是**正确的** —— 它在 facelets 事件里播种了计数器
（`if (dec.prevMoveCnt === -1) dec.prevMoveCnt = moveCnt;`）。
所以这个 bug 只影响 GAN v3/v4 系列（GAN 12/13/14/16、Mini Pro、MG、AiCube），
恰好是用户手上的机型。

> 为什么有时又「看起来正常」：点「重置状态」只调 `tracker.reset()`
> （`_lib/bluetooth/index.ts:432`），不碰 `prevMoveCnt`。如果用户在重置前已经
> 随手拧过一下，播种早已完成，之后的流程就是对的。这解释了时好时坏。

#### 缺陷 B — 丢包无法恢复，且没有任何自愈路径

csTimer 用 FIFO + 严格连号推进，缺号就向魔方请求历史补齐：

```js
// gancube.js:711-739 evictMoveBuffer
var diff = (moveBuffer[0][0] - prevMoveCnt) & 0xFF;
if (diff > 1) { requestMoveHistory(moveBuffer[0][0], diff); break; }  // 停下来补齐
```

我们没有缓冲、没有缺号检测、也从不发 `requestMoveHistory`。
`gan_v4.ts:216-219` 的注释承认了这一点，并声称「会在下一次 solved 快照重新同步」——
但那个重新同步的机制并不存在。BLE 通知丢一帧 = 状态永久错位。

附带结果：`gan_v4.ts` 的 `0xD1` 历史解析分支和 `gan_v3.ts` 的 `mode 6` 分支
目前是**死代码**，因为魔方只在收到请求后才发历史帧。

#### 缺陷 C — 右下角实时状态图不是真实状态

`_components/LiveCubeState.tsx:155`：

```ts
const composed = moves.length > 0 ? `${scramble} ${moves.join(' ')}` : scramble;
```

它渲染的是「还原态 + 打乱公式 + 连接后拧过的每一步」，而不是 `tracker.getFaces()`。
所以：

- 魔方还原着、没拧过 → 小图显示的是**打乱后的样子**（与用户看到的实体魔方矛盾）；
- 用户照着打乱拧完 → 小图变成**打乱被应用了两遍**；
- 顶部的「与打乱不符」徽章走的是真实 facelets（`_shell/SoloView.tsx:893`），
  两处数据源不一致，用户看到自相矛盾的界面。

#### 缺陷 D — 订阅者拿到的是「上一步」的状态（第二个决定性根因）

`_lib/bluetooth/index.ts` 的 `handleMove` 原来是这个顺序：

```ts
setLastMove(move);
onMoveRef.current?.(move, ts);          // ← 先通知
const isSolved = trackerRef.current.applyMove(move);   // ← 后应用
```

而打乱校验（`_shell/SoloView.tsx:893`）正是在 `onMove` 订阅里读 `getFaces()`。
于是它读到的永远是**少一步**的状态：用户拧完打乱的最后一步时，
校验拿到的是倒数第二步的状态 → 「与打乱不符」。

这个缺陷独立于 A 存在，即使 A 修好也会在「打乱刚完成」这一刻误报。
修复：先推进模型再通知。

### 附带确认（排除项）

以下均已逐条比对 csTimer，**不是**问题所在：

| 检查项 | 结论 |
|---|---|
| axis one-hot 表 `[2,32,8,1,16,4]` → `URFDLB` | 一致（`gan_v4.ts:83-84` vs `gancube.js:886-891`） |
| 方向位 `pow` 0=CW / 1=CCW | 一致 |
| moveCnt 字节序（高位在 bit 56..63） | 一致 |
| AES key/iv 基向量与 mod-255 派生 | 一致（v3/v4 都走 `getKeyV2(value, 0)`，`gancube.js:279/338`） |
| facelet / 颜色映射 | 不涉及：`solved()` 与 `applyScramble()` 同源同约定 |
| 打乱解析器 | 不涉及：两侧都是纯面转记号 |

### 修复内容

1. **A** — v3/v4 解析 facelets 快照（v4 `0xED` / v3 `mode 2`）：
   `_lib/cube/cubie.ts` 新增轻量 cubie 模型（cstimer `CubieCube` 的忠实移植，
   含 7+11 校验位补全、可解性校验、facelet 序列化），解出魔方自报状态；
   校验通过才播种计数器并上报。新增 `CubeDriverContext.onState(facelets)`，
   `CubeStateTracker.adoptFacelets()`，hook 以魔方自报状态为基准而非假定已还原。
   密钥错时状态校验不过 → 计入坏帧，不会把乱码当成状态。
2. **B** — 新增 `_lib/bluetooth/gan_move_sync.ts`：cstimer 同款 FIFO
   （严格连号推进 + 缺号时 `requestMoveHistory` + 历史回填 + 环形窗口判定），
   v3/v4 共用。与 cstimer 的唯一有意分歧：缓冲区堵死时 cstimer 直接断连，
   我们改为重新向魔方要一次状态快照重新播种，不打断用户。
3. **C** — `LiveCubeState` 改为直接渲染 `bluetoothCube.facelets`
   （`components/FaceletsCube` + visualcube）。3D 陀螺视图仍由公式驱动
   （/sim 引擎没有 facelet 入口），因此改为锚定在「魔方上一次已还原」的时刻，
   并新增 `algAnchored`：拿不到这个锚点时不画 3D，退回精确的平面视图。
4. **D** — `handleMove` 先推进模型再通知订阅者。

### 测试

无实体魔方也能验证 —— 复用仓库已有的 csTimer 沙箱比对框架
（`tests/_cstimer_sandbox.ts` + `tests/_bt_frame_fixtures.ts`，同一串密文喂给
csTimer 原版 JS 和我们的驱动，比对输出的 move 序列）。

现状：该框架覆盖了 GAN v2 / QiYi / GoCube / MoYu / Giiker，
**唯独没有覆盖 GAN v3 和 v4** —— 出问题的正是没被覆盖的两个。

新增：

- `tests/bluetooth_parity_gan_v34.test.ts`（18 例）— v3/v4 与 csTimer 的逐帧比对：
  握手字节一致、facelets 播种后第一步不被吞、18 步打乱逐步一致、
  丢包后双方发出**字节相同**的历史请求并在回填后恢复同一序列、
  重复帧、计数器 255→0 回绕、电量/硬件/陀螺帧不产生转动、错误 MAC 双方同样拒收。
  这 18 例在修复前 12 例红。
- `tests/smart_cube_state_parity.test.ts`（12 例）— 用户要求的三方一致：
  同一条打乱下 `applyScramble()`（虚拟魔方）、走真实 GAN v4 驱动 + 加密帧的
  `CubeStateTracker`（智能魔方链路）、csTimer 的 `CubieCube`（vm oracle）
  必须得到同一个 facelet 串；含打乱+逆打乱回到还原态、facelet 串往返、
  非法串必须被拒。另含两个契约测试：facelet 串与 visualcube 自身模拟逐贴纸一致
  （右下角实时图靠这个假设）、以及缺陷 D 的源码顺序守卫。

全量：3262 passed / 3 skipped，typecheck + lint 干净。

### 状态

- [x] 根因定位（代码级证据）
- [x] 测试补齐（先红后绿）
- [x] 缺陷 A 修复（facelets 播种 + 真实状态基准）
- [x] 缺陷 B 修复（FIFO + 历史补齐）
- [x] 缺陷 C 修复（实时图渲染真实 facelets）
- [x] 缺陷 D 修复（订阅顺序）
- [ ] 实体魔方复验（等用户在场）

### 待办（滚入后续 Sprint）

- 3D 陀螺视图仍由公式驱动；要让它在任意状态下都精确，需要给 /sim 的 NxN
  引擎加一个 facelet 入口。当前用 `algAnchored` 保证「宁可不画也不画错」。
- 平面展开图（net）目前只有打乱预览有；实时状态用的是立体图。
  想让用户把实体魔方和展开图逐面对照，需要给 visualcube 加 net 视图。
- 其余品牌（QiYi / MoYu32 / GoCube / Giiker）的状态快照尚未接 `onState`，
  它们连接时仍假定已还原。协议里有状态帧的应逐个接上。

---

## Sprint 2 — 无实体验证台（dev fake cube，已完成）

### 为什么要有

Sprint 1 的四个缺陷全部只在**真实链路跑起来之后**才显形：单测能证明驱动解出的
move 序列与 csTimer 一致，但证明不了「连接 → 打乱校验 → 自动停表 → 右下角实时图」
这一整条链路在浏览器里是通的。而这条链路以前只能靠插实体魔方来验，
于是它长期没被验过 —— 这正是 bug 能活到用户手里的原因。

### 做了什么

`_lib/bluetooth/fake_cube.ts`（**dev-only**，三处入口都以
`process.env.NODE_ENV !== 'production'` 关死，生产构建里是空函数）：

一个**协议级**的假 GAN v4 外设。不是打桩 —— 它自己持有一份 cubie 状态，
按真实协议组帧、用真实 AES 轮密钥加密，通过假的 GATT 对象喂给
**未经改动的 `ganV4Driver`**。也就是说被验证的仍然是生产代码路径，
只有 BLE 传输层是假的。

支持的帧：`0x01` move、`0xED` facelets 快照、`0xEF` 电量、`0xD1` 历史回填。

控制台 API（`window.__cuberootFakeCube`）：

| 调用 | 作用 |
|---|---|
| `arm()` / `disarm()` | 让下一次「搜索并连接」连到假魔方 |
| `apply("R U R'")` | 拧几步 |
| `scramble()` | 直接拧成当前屏幕上的打乱 |
| `solve()` | 回到还原态 |
| `dropNext(n)` | **吞掉**接下来 n 帧通知，模拟 BLE 丢包 |
| `state()` | 当前 facelet 串 |

`dropNext` 是关键：丢包恢复（缺陷 B）在真实使用中偶发且无法主动复现，
有了它就能确定性地测。

### 浏览器实测（Playwright，dev server）

| 场景 | 结果 |
|---|---|
| 连接握手 | 弹窗显示 设备 `GAN14-FAKE00` / 型号 `gan-v4` / 电量 `87%` / 状态「已还原」 |
| 打乱校验（缺陷 A+D 的复现场景） | `scramble()` 后徽章 `data-scramble-match="ok"`，文案「打乱已就绪」 |
| 右下角实时图（缺陷 C） | 还原态渲染出还原的魔方 —— 用户最初报的自相矛盾界面消失 |
| 丢包恢复（缺陷 B） | `dropNext(1)` 吞掉一个 `R` → 下一步产生缺号 → 自动请求历史回填 → 撤销两步后徽章回到 `ok`（未恢复的话会永久偏 `R`，徽章会卡在 `off`） |
| 还原自动停表 | 空格起表 → `apply("R U R' U'")` → `solve()` → 计时**在还原瞬间停住**，记录 1.115s，成绩面板 1/1 |

截图：`.tmp/png/smartcube-scramble-ok.png`、`.tmp/png/smartcube-autostop.png`。

### 测试

`tests/smart_cube_state_parity.test.ts` 补 4 例（16 例）：
假魔方用的 piece 级转动模型（`_lib/cube/cubie.ts` 的 `applyCubieAlg`）
必须与 facelet 级模型逐串一致、公式阶数正确（R⁴ / sune⁶ 回到还原）、
7+11 线格式往返后校验位能补回同一状态、不支持的记号（`x` / `Rw` / `M` / `R3`）
必须抛错而不是静默跳过。假魔方要是自己算错了，上面那张实测表就一文不值。

### 状态

- [x] 协议级假外设（走真实驱动）
- [x] 丢包可确定性复现
- [x] 全链路浏览器实测通过
- [x] 假魔方自身的转动模型有测试
- [ ] 实体魔方复验（等用户在场；假魔方只能证明协议链路，证不了真机时序/信号）

---

## Sprint 3 — csTimer 对齐第一批（已完成）

产出对齐表 `SMART_CUBE_MIGRATION.md`（读 csTimer 源码逐项比对，非印象），
并落地了其中两条。

### 3.1 QiYi：连接时把已打乱的魔方当成已还原

和 Sprint 1 的 GAN v3/v4 是**同一类缺陷**：魔方每一帧都自报 54 个 facelet，
我们只取了时间戳和电量，把状态丢了。于是连一个已经打乱的 QiYi 魔方，
主机认为它是还原态。

csTimer 的做法（`qiyicube.js:170-178` / `210-218`）：握手帧的 facelets 用来
播种模型；之后每一帧的 facelets 只要和自己重放出来的状态不一致，
就**以魔方自报的为准**。两条我们都补上了。

顺带修了一个由此暴露的隐患：状态采纳会更新「是否已还原」，
如果它先于 move 把 `wasSolved` 翻成 true，还原那一刻的边沿就被吞了，
**自动停表不会触发**。现在两条路径共用同一个 `publishSolved`，
且驱动必须先发 move 再发 state。

测试用 csTimer 自己的 `parseFacelet`（从源码里抽出来跑在沙箱里）当解码基准，
不是拿我对协议的理解自证。

### 3.2 设备时间戳（`MoveClock`）

对齐表里的 P0：**后续所有逐步时序分析的地基**。

问题：我们给每一步打的时间戳是 **BLE 通知到达时刻**（`performance.now()`）。
BLE 按连接间隔（7.5-30ms）成批投递，拧得快时几步会挤在同一批里到达，
到达时间差被压成 1ms 以内 —— 而「这一步和上一步隔了多久」正是
TPS / 停顿 / 识别-执行拆分全部指标的原始量。用到达时间算这些等于拿噪声当信号。

魔方自己带时钟，帧里就有：GAN v4 move 帧 bits 16..47、v3 bits 24..55，
32-bit 毫秒计数。以前两个驱动的注释都写着「unused here」。

现在：
- v3/v4 解出设备时间戳，随 move 一起上报（`CubeDriver.onMove(move, deviceTs?)`）；
- 新增 `_lib/bluetooth/move_clock.ts`：把设备时钟锚到本地时钟，
  报 `anchorLocal + (deviceTs - anchorDevice)` —— 本地可比、设备精度。
  偏差超过 2s（csTimer 的阈值，`gancube.js:474`）就重新锚定；
  计数器回绕 / 间隔离谱 / 该帧没有设备时间（历史补齐回来的）一律退回到达时间，
  绝不编造；
- 历史补齐的动作**不带时间戳**。csTimer 会插值，我们选择留空 ——
  与其编一个数进指标，不如让上层知道这一步的时间是估的。

假魔方也补了设备时钟（从一个明显不是本地时间的 epoch 起算），否则测不了这条链路。

### 测试

- `tests/bluetooth_qiyi_state.test.ts`（5 例）— 握手把打乱状态交给主机、
  与 csTimer `parseFacelet` 逐串一致、先 move 后 state 的顺序契约、
  状态回填能纠正已经跑偏的主机、非法载荷必须拒收
- `tests/move_clock.test.ts`（9 例）— 同一批到达的四步能还原出真实间隔、
  锚定不泄露设备 epoch、无设备时钟时退回到达时间、跨「无时间戳的一步」不外推、
  真漂移重锚 / 小抖动不重锚、回绕拒收、reset 后重新锚定
- `tests/bluetooth_parity_gan_v34.test.ts` 加 4 例 — 驱动上报的是帧里的设备时钟；
  历史补齐的动作无时间戳，而只是被缓冲区**扣住**的那一步保留自己的时间戳

全量 3388 passed / 3 skipped，typecheck + lint 干净。

### 浏览器实测

用假魔方按 300ms / 120ms / 900ms 的间隔拧四步，成绩里记下来的间隔是
347 / 133 / 907 ms —— 与实际驱动的间隔一致。（这条只证明链路通且数值合理；
「用的确实是设备时钟而非到达时间」由上面的单测和驱动层测试证明。）

### 状态

- [x] `SMART_CUBE_MIGRATION.md` 对齐表
- [x] QiYi 状态采纳
- [x] 设备时间戳 + 时钟对齐
- [x] 其余品牌（MoYu32 / GoCube / Giiker）的状态快照 → Sprint 4
- [ ] QiYi 的设备时间戳（帧里有，单位是 1.6us/tick，未接）
- [ ] MoYu32 的设备时间戳（0xA5 帧里五个 u16 增量，未接）

---

## Sprint 4 — 把「魔方自报状态」补齐到所有品牌（已完成，待实体复验）

Sprint 1（GAN v3/v4）和 Sprint 3（QiYi）修的是同一类缺陷：协议里带着魔方的真实状态，
我们没读。这个 Sprint 把剩下三个有状态帧的品牌接完，缺陷类到此清零。

### 4.1 三个品牌

| 品牌 | 帧 | 频率 | 之前 | 现在 |
|------|-----|------|------|------|
| MoYu32 | `0xA3` bits 8..152 = 48 贴纸 × 3 bit | 仅连接时（`prevMoveCnt === -1` 时消费，和 csTimer 一致） | 只取 bits 152..160 的计数器 | 同时解 facelets → `onState` |
| GoCube | `0x02`，6 面 × 9 字节（中心 + 8 环） | 连接时 + 每 20 步重新 ack 时 | 注释写着「不跟踪 facelet」，分支不存在 | 解出 54 贴纸 → `onState`，顺带成了周期性纠偏 |
| Giiker | 每一帧的 nibble 0..30（角排列/朝向 + 棱排列 + 12 翻转位） | **每一帧** | 只 diff 历史窗口取 move，状态全丢 | 每帧解状态 → `onState`，永不漂移 |

Giiker 是三个里最值得说的：它是唯一**每帧都自报完整状态**的品牌，
以前我们把最权威的那部分数据整包丢掉，只从历史窗口里 diff 出 move。

### 4.2 Giiker 的贴纸编号不是 Kociemba 的

Giiker 的 `ca` / `ea` 索引与默认编号不同 —— 角的顺序被置换过，每个三元组还整体转了一位
（`giikercube.js:46-70` 把自己的 `cFacelet` / `eFacelet` 传给 `toFaceCube`）。
用默认表去解，会得到一个「自洽但错」的状态：颜色计数全对，摆放整体转过。

所以 `_lib/cube/cubie.ts` 的 `cubieToFacelets(st, tables?)` 现在接受贴纸表，
默认值 `DEFAULT_FACELET_TABLES` 就是原来那两张表 —— 和 csTimer 的
`toFaceCube(cFacelet, eFacelet)`（`mathlib.js:495`）同一种参数化，不是我们自创的抽象层。
角朝向还要按 `coMask = [-1,1,-1,1,1,-1,1,-1]` 逐位取反，四个角用的是相反的扭转约定。

有一条测试专门钉这件事：拿同一组 nibble，断言我们上报的串**不等于**用默认表解出来的串。
否则删掉品牌表以后，只有还原态那一例还能过，测试会假绿。

### 4.3 顺手发现 csTimer 的 GoCube 状态采纳是坏的

`gocube.js:107` 在 `msgType == 2` 里写 `curCubie.fromFacelet(newFacelet)`，
但 `curCubie` 是它的**暂存**对象：move 分支算的是
`CubeMult(prevCubie, move, curCubie)` 然后把两个对象互换，
所以刚采纳的状态会被下一步转动直接覆盖，从来没被读过。
csTimer 的 GoCube 因此永远从还原态重放 —— 连一个已打乱的 GoCube，它和我们修复前一样错。

后果之一：这条链路不能像 QiYi 那样拿 csTimer 的「采纳后再走一步」当基准。
所以 GoCube 的解码基准改成从 `gocube.js` 源码里切出它自己的
`axisPerm` / `facePerm` / `faceOffset` 三张表（容易写错的部分来自上游），循环重写。
另有一例**故意钉住这个上游 bug**：如果 csTimer 哪天修了，那一例会红 —— 那是复查信号，不是故障。

### 4.4 边界

三个解码器都在入口校验后才上报，不合法一律**什么都不报**（退回自己的 move 重放，可恢复），
绝不上报垃圾（不可恢复）：

- 颜色 / nibble 越界（错 AES key 解出来的样子）；
- 贴纸不是九个一色（`fromFaceletString`）；
- Giiker 还过一遍 `isValidCubieState`：排列重复、单角扭转、翻转奇数、角棱奇偶不符全部拒收。

### 测试

`tests/bluetooth_brand_state.test.ts`（14 例，全部以 csTimer 自己的解码器为基准）：

- GoCube 3 例 — 五个状态逐串往返、连接时的状态被主机采纳（且状态帧不算一步转动）、
  截断 / 越界 / 单色载荷必须拒收
- GoCube vs csTimer 2 例 — 与上游三张表逐贴纸一致；钉住上游从不采纳自己的状态帧
- Giiker 3 例 — 连接前就打乱的魔方在**第一帧**就被读出来、同帧内先 move 后 state 的顺序契约、
  非法 nibble 拒收
- Giiker vs csTimer 2 例 — 与 `giikercube.js` 算出的 facelet 逐串一致；必须用 Giiker 自己的贴纸表
- MoYu32 3 例 — 快照上报且仍然播种计数器、只在计数器未播种时消费（与 csTimer 同）、
  空白位不上报假魔方但计数器照常播种
- MoYu32 vs csTimer 1 例 — 与 `moyu32cube.js` 的 `parseFacelet` 逐串一致

蓝牙 + 状态相关 10 个文件 251 passed。`tests/bluetooth_gyro.test.ts` 里原有的
「全零 0xA3 帧」用例不受影响：全零位读出来是 54 个同色，本来就该被拒。

### 状态

- [x] MoYu32 / GoCube / Giiker 的状态快照
- [x] `cubieToFacelets` 支持按品牌传贴纸表
- [ ] 实体复验（GAN 16 UI 在手；其余品牌无实体）
- [x] MoYu32 / QiYi 的设备时间戳 → Sprint 5

---

## Sprint 5 — 设备时钟补齐到所有带时钟的品牌（已完成，待实体复验）

Sprint 3 给 GAN v3/v4 接了设备时钟，理由见那一节：BLE 成批投递，到达时间差被压成 1ms 以内，
而「这一步和上一步隔了多久」是 TPS / 停顿 / 识别-执行拆分全部指标的原始量。
这个 Sprint 把剩下两个带时钟的品牌接完。三家的时钟形态各不相同：

| 品牌 | 帧里的形态 | 单位 | 历史补齐的动作 |
|------|-----------|------|---------------|
| GAN v3/v4 | 32-bit 计数器（v4 bits 16..47 / v3 bits 24..55） | ms | **无时间**（帧只报「哪一步」） |
| QiYi | 32-bit 计数器（msg[3..6]），**每个历史槽各带一个**（`off..off+3`） | 1.6 tick/ms，即 0.625ms/tick | **各自带自己的时间** |
| MoYu32 | 五个 u16 **增量**（bits 8..88），slot i 是「该步之前的间隔」 | ms | 窗口外的丢了就是丢了 |

QiYi 因此是我们支持的品牌里时序最完整的一个：**丢通知不损失时序精度** ——
补齐回来的每一步都还带着魔方自己记的时刻。GAN 做不到这件事（历史回复只有动作没有时间），
所以那条路径我们坚持留空而不插值。

MoYu32 是唯一发增量的：`Moyu32DecodeState.deviceTime` 按 csTimer
`updateMoveTimes`（`moyu32cube.js:317`）的算法累加，只累加**真正发出去的那几步**的增量 ——
计数器跳变被截到 5 步窗口时，窗口外那几步的时间跟着它们一起丢，编一个数进去会让每个下游指标都带上一段假间隔。

顺带把 `TimedMove` 从 `gan_move_sync.ts` 提到 `driver.ts`：它现在是三个品牌共用的驱动到主机词汇，
不再是 GAN 专有的类型。

### 测试

`tests/bluetooth_device_clock.test.ts`（10 例）：

- QiYi 5 例 — 1.6 tick/ms 换算、同一批到达的三步还原出真实间隔、
  **历史补齐的动作带自己的时刻**（间隔 250ms 逐一对上，不是塌到到达时刻）、
  经 `MoveClock` 后间隔仍然正确、hello 帧不算一步
- MoYu32 5 例 — 增量累加成上升时钟且按最旧到最新发、跨帧继续累加、
  只消费真正发出的那几步的增量、被拒的帧（错 key / 重复计数器）不动时钟、
  经 `MoveClock` 端到端还原间隔

`tests/bluetooth_gyro.test.ts` 里两处 `toEqual([...])` 改成 `.map(m => m.mv)` ——
返回值从 `string[]` 变成 `TimedMove[]`。

蓝牙相关 7 个文件 137 passed，typecheck + lint 干净。

### 状态

- [x] QiYi 设备时钟（含历史槽逐步时间）
- [x] MoYu32 设备时钟（增量累加）
- [x] `TimedMove` 提到共享契约层
- [ ] 实体复验
- [ ] 上层消费：把这些时间戳变成分段/停顿/TPS 指标（Phase 3 的第一块）

---

## Sprint 6 — 逐步打乱提示（已完成，假魔方已实测）

对齐表里的另一个 P0。以前只有二元判定：拧完 20 步之后才知道「与打乱不符」，
而那正是最没用的时刻 —— 用户还得自己找是哪一步歪的。现在打乱条会实时告诉他拧到哪了。

### 算法

`_lib/bluetooth/scramble_hint.ts`，移植 csTimer 的 `scrHinter.checkInSeq`（`tools/bluetoothutil.js:29`）。
我们在 facelet 层做（跟踪器本来就说 facelet），算法本身不变：

从还原态逐步重放打乱，每一步都问「这个面的**任意**转量能不能到达魔方当前状态」：
- 能，且转量与打乱一致 → 这步拧完了，继续往前走；
- 能，但转量不同 → 这步拧了一半，位置就停在这里；
- 一步都对不上 → 魔方不在这条路径上，返回 null。

一处**故意的改进**：半步未拧完时显示**剩余**转量（打乱写 `U2`、已拧一个 `U` → 提示 `U`）。
上游写了这个换算式但只在第一步启用（`next == 0 && i == 0`），
中途拧半步仍显示原始转量 —— 那会让用户把已经拧过的量再拧一遍。测试钉住了这个差异。

歧义状态（打乱里有对消，使某状态出现两次）取**更早**的位置，与上游一致。
WCA 打乱不含对消，只有手工粘贴的打乱会碰到，此时「你还在开头」是更安全的读法。

### UI

- 已拧 `--faint-foreground`（变暗）/ 当前步 `--accent` + 下划线（配色不敏感也能看出）/ 未拧正常色。
- 打乱拧完就整条恢复正常 —— 右侧「打乱已就绪」已经说明一切。
- **提示活跃时不显示「与打乱不符」**：拧到一半本来就还没匹配上,那是进度不是错误,
  红色 pill 出现在这里会被读成出错。pill 只保留提示表达不了的两种状态:拧完、拧歪。
- 含 wide/slice/rotation 的打乱不提示(智能魔方报不出这些动作,提示一个它永远看不到的步骤
  会把用户钉死在那一步)。

### 测试

`tests/scramble_hint.test.ts`（11 例，含 3 例 csTimer 对照）：
未拧 / 逐步前进 / 拧完 / 半步显示剩余量 / 拧歪返回 null / 歧义取更早 /
拒绝不可提示的记号 / 20 步真打乱每个前缀都对；
对照组把 csTimer 的 `checkInSeq` 抽进沙箱，用它自己的 CubieCube 跑，比较标注结果字符串。

### 假魔方实测（浏览器）

连上假 GAN v4 → 拧打乱前 6 步 → 前 6 步变暗、第 7 步 `L'` 高亮带下划线、其余正常，pill 不出现；
拧完 → pill 变「打乱已就绪」、整条恢复正常；再乱拧 → pill 变「与打乱不符」、提示消失。
截图 `.tmp/png/scramble-hint-live.png`。

### 状态

- [x] 提示引擎 + csTimer 对照测试
- [x] 打乱条 UI + pill 语义
- [x] 拧歪时给一条回到同一打乱的路径 → Sprint 7
- [ ] 实体复验

---

## Sprint 7 — 拧歪之后（已完成，假魔方已实测）

Sprint 6 的提示只在魔方还**在**打乱路径上时有话说。拧歪一步就只剩二元判定，
而这正是 csTimer 比「重来一遍」做得好的地方：问求解器要一条**从魔方现在的状态
到同一个打乱状态**的路径，然后在这条路径上提示（`bluetoothutil.js:71` 的
`genState`/`genScr` 分支）。

**成绩记的打乱不变** —— 修正路径终点就是原打乱状态，所以那还是同一条打乱，
只有「要拧什么」变了。

### 方向（唯一容易搞反的地方）

要的是 `from · M = target`，所以 `M = from⁻¹ · target`，与上游
`invFrom` + `CubeMult(stateInv, scrState)` 同序。落地时踩的坑是 worker 那一侧：
`solve` op 返回的是 `invertSequence(solveCube(state))`，即**生成**该状态的序列，
不是解开它的序列 —— 名字叫 `solve333` 但语义是生成器。现在 worker 直接调
`scrambleFromState`（同一个函数名，同一份语义），测试也调它，所以测的就是线上跑的。

方向不靠推理保证：测试把返回的动作应用到起始 facelet 上，检查是否**落在**目标状态，
facelet 层和 cubie 层各查一遍（免得两层的 bug 互相抵消）。

### 落地

| 文件 | 作用 |
|---|---|
| `lib/cube-facelet.ts` | facelet ↔ cubie。原来在 `/scramble/solver` 页面下，四个页面都要用，提到 `lib/` |
| `kociemba/cube.ts` | 新增 `inverseCubie` |
| `_lib/bluetooth/scramble_fixup.ts` | `fixupState`（纯代数，可测）+ `fixupScramble`（走 worker）+ `createFixupRequester`（状态机） |
| `scramble_hint.ts` | `hintScramble` 加 `from` 参数（上游 `checkInSeq` 的 `gen`）：修正路径的起点不是还原态 |

`hintScramble` 的 `from` 是必需的：没有它，走查从还原态开始，修正路径根本不在那条路上
→ 功能静默失效。有一条测试专门钉这个。

### 一个真 bug：求解比一次转动还慢

第一版在浏览器里**每隔一次**才出修正路径。原因是求解要 100-200ms，比一次转动还长：
答案回来时魔方已经又转了一步，那条从「刚才」出发的路径对不上当前状态，
而我当时的写法是直接放弃。改成**从新状态再解一次**（最多三次），
并把这段状态机从组件里抽到 `createFixupRequester` —— 有分支的逻辑不该躺在 view 里。

### 测试

`tests/scramble_fixup.test.ts`（22 例）：
- 代数层：`from · fix === target`、`inverseCubie` 双向、已在打乱态返回 null、
  单角扭转等物理不可达状态直接拒（否则两阶段搜索会去找一个不存在的解）；
- 端到端（在进程内跑 `scrambleFromState`，与 worker 同一函数）：多拧一步 / 少拧一步 /
  拧到别处 / 刚开始 / 一步没拧，五种偏离都落在打乱态；长度 ≤ 23；cubie 层复查；
- 提示层：从生成点走查、逐步前进、走完即 complete、**从还原态走查必须找不到**；
- 状态机：不动就给路径 / 求解中又转了就换新状态重解 / 求解中已到打乱态就什么都不给 /
  一直转满三次放弃且不卡住 / 求解中不排队第二次 / 打乱被换掉就放弃 / 无魔方 / 求解器无解。

### 假魔方实测（浏览器）

拧对 8 步 → 提示到第 9 步；拧一个打乱没要求的 `B'` → 出现 20 步修正路径 + `拧回原打乱` 标签；
照着修正路径拧 → 每步推进 → 最后一步落地即「打乱已就绪」，打乱条恢复成**原来那条打乱**。
连续偏离（`R` → `R'` → `R U'` → `U R'`）以及**求解中再转一步**（`F` 后 60ms 再 `D` → `D' F'`）
都正确。390px 窄屏：21 步路径折 4 行、标签独占一行、无横向溢出。
截图 `.tmp/png/scramble-fixup-live.png`、`.tmp/png/scramble-fixup-mobile.png`。

### 状态

- [x] 代数 + 方向（测试钉死）
- [x] worker 语义统一到 `scrambleFromState`
- [x] 状态机（含求解期间又转动的重解）
- [x] UI：修正路径 + `拧回原打乱` 标签（accent 色，不是红色 —— 这不是错误态）
- [ ] 实体复验

---

## Sprint 8 — 步骤判定引擎（已完成）

训练模式三件套的地基。三个需求问的是同一个问题：

- 只练 OLL 时，OLL 拧完就该停表，不该逼用户把整个魔方还原；
- 分阶段计时想**实时**出，不想事后算；
- Roux / ZZ 的识别（迁移表 P1 第 8 条）。

csTimer 用一个机制答完三个（`cubeutil.js:24 / :105 / :238`），而且比看起来简单得多：

**一个步骤 = 54 字符 mask**。同字母的位置必须**同色**，`-` 不管。没有一个字母绑定
到具体颜色，所以「十字拧好了」不必知道用户在哪面做十字；`cpll` 用小写 `r-r`
只要求 R 面那两个角贴纸**彼此**相同、不必等于中心，于是「角块排列好了」与 AUF 无关。

朝向靠「换个姿势再试一遍」解决：CFOP 那几步试 6 种（每个可能的十字面一次），
Roux 的块不对称（左块不是右块）所以试满 24 种。

### 哪部分是抄的，哪部分不是

mask 和朝向数量是上游的，逐字抄。**24 个朝向表是这里从贴纸几何推出来的**，
不是抄的 —— 那也正是能悄悄错掉的地方，所以钉了三层：

1. 每个角块的三张贴纸必须落在同一个立方体顶点上（对照 solver 已在用的
   `CORNER_FACELET` / `EDGE_FACELET`，棱块同理）；
2. **任何整体旋转都不能改变判定结果** —— 这条是 6 朝向抽样合法性的前提；
3. 每个判定都和 csTimer 真的 `cubeutil` 对答案。

### 新判据：真 cubeutil 跑在 vm 里

`lib/mathlib.js` + `lib/cubeutil.js` 只要补上 `isaac.js` 和三个 stub 就能原样在 vm 里跑
（`tests/_cstimer_cubeutil.ts`）。所以这块没有手抄副本会漂移，跟 `_cstimer_sandbox.ts`
当年为硬件驱动手抄 mathlib 子集的情况不同。

### 一个陷阱

四个单独的 F2L 槽 mask **故意不提供**。上游从不单独问某一槽 —— `getCF4O2P2Progress`
只把四个加起来 —— 因为单槽 mask 在绕十字面旋转下不成立。而
`getStepProgress('f2l1', …)` 看着像判据,其实 `f2l1` 不在 `stepParams` 里,
会掉到"整体还原了吗"的兜底分支。就是这个假判据把问题暴露出来的。
以后做实时分阶段需要「已完成几组」时，照上游的写法求和。

### 测试

`tests/cube_steps.test.ts`（14 例）：几何自洽 4 例、旋转不变性 1 例（约 80 状态 × 6 步 × 7 旋转）、
行为 6 例、与真 cubeutil 对答案 2 例（约 700 次比较 + Roux 步在 13 种旋转下逐一比对）。

---

## Sprint 9 — 状态劫持 + 可插拔停表判据（已完成）

### 状态劫持

练 PLL 就是一题接一题。没有帮助的话每题都要先摆：把 case 的打乱拧到还原态的魔方上，
**再**执行。csTimer 的做法是不再问（`bluetoothutil.js:663`）：记一个偏移量，让魔方
**当前的物理状态**（通常正好是还原态，因为上一题刚拧完）被**上报**为下一题的状态。

为什么成立：偏移是一次重贴标签，而重贴标签和转动可交换。若偏移让状态 `c` 读作 `t`，
那么任意序列 `A` 之后魔方在 `c·A`、读作 `t·A` —— 于是执行解开 case `t` 的公式，
**上报**状态就会走到还原，停表就是这么来的。物理魔方反而越拧越乱，而这不重要。

`offset = target · current⁻¹`，上报 `offset · current`，与上游 `invFrom` + `CubeMult` 同序。

### 什么时候必须丢掉偏移

上报状态和物理状态已经分叉，所以回到「关心真魔方」的场合必须清：正式计时、打乱校验、
用户说"我把魔方还原了"(`resetState`)、**断连**（断连期间魔方可能被拧过，偏移量的参照
状态已经不存在了）。

**魔方自报状态不在此列** —— 偏移叠在跟踪器之上，所以每帧都报状态的品牌（QiYi）
会持续修正底层的物理跟踪，训练视图跟着走。这条最初写反了，改对了。

### 可插拔判据

`useBluetoothCube` 新增 `solvedStep`（默认 `'solved'`）。原来 `onSolved` 由
`tracker.isSolved()` 决定；现在由 `stepSolved(step, 上报状态)` 决定 —— 有偏移在时，
跟踪器对"还原"的意见说的是没人在看的那个魔方。

配套：所有发布路径收拢到一个 `publishState()`，于是「魔方报什么」变成「计时器看什么」
只有一个入口，`facelets` 与 `getFaces()` 不可能各说一套。

### 测试

`tests/state_hijack.test.ts`（10 例）：偏移把当前态映射成目标态（含从非还原态出发）、
已在目标态时无事可做、物理不可达状态直接拒、畸形输入原样返回；
**可交换性** `view(cur·A) === target·A`；四个真 case 执行公式后上报还原而物理不还原；
子步（OLL case 拧完 oll 成立 / PLL case 一开始 oll 就成立 —— 按 case 选错步骤是最可能的接线错误）；
清除后视图回到物理魔方；**连续四题不碰魔方地换题**（这就是连续训练的机制）。

写测试时我手写的 T perm 解法是错的（T perm 是自逆的），而这种错误的失败表现
和劫持写错**一模一样**。现在每个 case 的解法由 setup 求逆得到，不靠记忆。

### 未测到的部分（说清楚）

hook 里那段接线本身没有单元测试 —— 仓库没有 jsdom / testing-library，
为这一个测试引依赖不值得。已做的是：两个纯函数各自有测试（24 例），
并在浏览器里用假 GAN v4 确认**换判据没有弄坏原有的还原停表**：
打乱 → 按空格起表 → 拧回还原 → LCD 停在 1.531 不再动。
劫持本身要等 Sprint 10 的 UI 接上才能在浏览器里走通。

### 状态

- [x] 劫持代数 + 可交换性（测试钉死）
- [x] `solvedStep` 可插拔判据
- [x] 发布路径收拢到 `publishState()`
- [x] 断连 / 重连 / `resetState` 清偏移
- [x] 浏览器复验：原有还原停表未受影响
- [ ] Sprint 10：训练 UI（题目来自 `/alg` + SRS、连续循环、不记成绩）

---

## Sprint 10 — 训练模式接上智能魔方（已完成，待实体复验）

迁移表 D 节整块，也就是 P0 的最后一条。做完之后：连上魔方，`/alg/3x3/oll/run`
每出一题，**魔方自己就变成那个 case**；第一下转动起表，OLL 拧完停表，
放一下手就是下一题。魔方本体越练越乱，从头到尾不用还原一次。

### 先修掉 Sprint 9 的一个 bug

Sprint 9 说「所有发布路径收拢到 `publishState()`」，实际上**两条实时路径都绕过了它**：

```ts
// index.ts handleMove（改之前）
trackerRef.current.applyMove(move);
setSolved(trackerRef.current.isSolved());   // ← 跟踪器自己的意见
```

`tracker.isSolved()` 是精确全等，既不知道有偏移，也不知道要停在子步上。
于是 Sprint 9 那套判据只在「快照事件」这条冷路径上生效，而正常拧魔方走的是热路径
—— 劫持和子步停表**一次也不会成立**。`handleCubeState` 同样直接 `setSolved`。

两条都改成走 `publishState()`。顺带一个正向副作用：`stepSolved` 判的是「每面同色」，
所以整体旋转不再影响判定，与上游行为一致。

### 步骤 → 题库的对应表

`_trainer/smartcube.ts` 一张 `SET_STEP` 表，把公式库的 set 映到停表判据：

| set | 停在 | 为什么 |
|---|---|---|
| `f2l` `adv-f2l` | `f2l` | 槽位插完 |
| `sbls` | `sb` | Roux 第二块 |
| `zbls` | `eoll` | ZBLS 结束时顶层棱已朝上 |
| `wv` `sv` `vls` | `oll` | 插槽顺带朝向 |
| `cls` | `ocll` | 只朝向角块 |
| `oll` | `oll` | — |
| `coll` `ollcp` | `cpll` | 朝向 + 角块排列 |
| `cmll` | `cmll` | — |
| `pll` `ell` `zbll` `1lll` | `solved` | — |

`ocll`（顶层角朝上、棱不管）是**我们加的 mask**，上游没有 —— 上游没有公式库，
不需要为 CLS 这种「只朝角」的 set 立判据。它正好是 `eoll` 在顶层上的补集。

三个 set **故意不进表**，理由写在代码里：`eo4a`（M 层中心自由，mask 说不出「朝向了」）、
`anti-pll` 和 `fruf`（结束状态本身没定义清楚，猜 `solved` 会变成永远不停表）。
不在表里的 set 退回「整体还原或按空格」，不会假装能判。

### 题库数据不是按 AUF 配对的

写测试时才发现的，也是这一节唯一的意外。库里的 scramble 把 case 摆在**任意 AUF**上
（F2L 家族还带任意 `y`），而库里的公式带的是**某一种标准摆法**的 AUF。
两者不成对，直接「打乱 → 套公式」有 3 个 set 判不出停表。

正确的模型不是修数据，是照人的做法：`y^a U^i · alg · U^j` —— 转个身、调个 AUF、
执行、再调 AUF。测试搜这 16×4 种组合，四个 set 全部通过。产品侧不受影响
（人本来就会自己调），但这条得记下来，`/alg` 以后要做「显示 AUF 提示」会再撞上。

### 一个只有活人能发现的 bug

浏览器里第一次跑 OLL：第 0 题在**倒数第二步**就停了表（正确 —— OLL 判据在最后一步
之前就成立），剩下那一步落到了第 1 题上，于是第 1 题起手状态被污染，怎么拧都不结束。

修法不是数「还剩几步」（拧错、多拧、拧一半都会让计数失效），而是给上一题一个
**收尾窗口**：停表后 500ms 内的每一次转动都重新劫持一次（把魔方重新变成新题，
并把窗口重新计时）。这样不管余下几步、拧对拧错，都算上一题的尾巴。

剩下的洞是「一直不停手的人」—— 每一下都被当成收尾，永远开不了下一题。
这个没有正确答案（哪一下是收尾只有人知道），所以选了**说出来**而不是默默卡住：
`reason === 'settling'` 时状态行写「把魔方停一下，下一题就开始」。

### `timing` 与 `enabled` 分开

一开始整块功能都压在「计时开着」上。但「魔方直接变成这一题」在不计时的背诵模式下
也有用，所以拆开：`enabled` 管出题（劫持），`timing` 管时钟。不计时时拧完只
`nextScramble()`，不写任何成绩 —— 迁移表 D 节「训练时不记成绩」由构造满足，
trainer 有自己的 store，压根不碰 `/timer` 的成绩表。

### 测试

`tests/alg_smartcube.test.ts`（22 例）跑的是**真题库数据**，不是构造状态：

- 850 个 case 逐个验双向 —— 拧到该停的地方成立、没拧完不成立：
  OLL 57、PLL 21、ZBLL 472、ZBLS 302；
- **57 个 OLL 互不混淆**：57 条公式里恰好只有一条能朝向对应的 case（真正会漏的是
  「随便哪条 OLL 都算完成」）；
- PLL 的 case 一开始就已经朝向 —— 所以要是把 `pll` 映成 `oll`，第一下就会停表；
- ZBLS 有 1/302 个 case（`34-1`，且只在它 4 条 scramble 中的 2 条上）**开局就满足
  `eoll`**。这不是测试问题，是产品问题：`autoStopStep` 现在检查「目标状态是否已经
  满足停表判据」，是就退回手动，不让它在第一下转动上停表。

`tests/cube_steps.test.ts` 加了一例记录一件我原先写错的事：**U 转动可以改变判定结果**。
6 朝向扫描可能是在拿 U 面当完成面匹配上的（`R U R' U'` 转 `x2` 之后 `cross` 成立，
再拧一下 U 就不成立了）。原先据此做的一个优化因此撤掉。

顺手修掉两个全量跑才会红的偶发：`scramble_fixup` / `kociemba_hard_timeout` 里
`solveCube` 用默认 200ms **墙上时钟**预算，250 个测试文件抢 CPU 时会在出解前到点抛异常。
测试里显式给 10s。生产路径不受影响（`fixupScramble` 本来就 try/catch）。

### 假魔方实测（GAN v4）

- OLL 连续 4 题：`15/16 → 15/16 → 17/18 → 13/14` 步停表，每题 1 步余量被收尾窗口吃掉，
  4 题全部结束，0.54 / 0.70 / 0.62 / 0.68s；
- 再跑 3 题确认加了 `settling` 这个 state（每吃一步转动多一次 render）不会误触发重新出题：
  `17/18 → 16/17 → 18/19`，全部结束；
- PLL 不停手：第 1 题 `advanced: false` + 状态行提示「把魔方停一下」；停一下：两题都 `advanced: true`。

### 未测到的部分（说清楚）

- `useTrainerCube` 的 React 接线没有单元测试 —— 仓库没有 jsdom / testing-library。
  纯函数层（`smartcube.ts` + `steps.ts`）有 36 例，整条循环靠浏览器 + 假魔方；
- 只验过假 GAN v4。其余品牌走的是同一个 `publishState`，但没有实测；
- 需要实体魔方的部分（设备时钟精度、真实丢包下的收尾窗口）等一起测。

### 状态

- [x] Sprint 9 热路径绕过 `publishState` 的 bug（这是决定性的）
- [x] `SET_STEP` 表 + `ocll` mask + 判不了就不假装（3 个 set 明确不进表）
- [x] `autoStopStep` 拦「开局即满足」的 case 数据
- [x] `useTrainerCube`：劫持出题、起表停表、连续循环、收尾窗口、MAC 提示
- [x] `SmartCubeRow`：开关 / 连接 / 电量 / 状态行（**停在哪里**必须写在屏幕上）
- [x] 850 个真 case 双向验证 + 57 OLL 互不混淆
- [x] 浏览器复验（假 GAN v4）：早停、余量吸收、不停手的提示
- [ ] 实体 GAN 16 UI 复验（等用户回来）

---

## Sprint 11 — 让魔方接管整把（已完成，待实体复验）

迁移表 P1 的第 4、5、7 条，以及一个**只有实测才会发现的死路**。

### 自动预备是个死路（先修这个）

开了「蓝牙自动预备」之后，魔方替你按下预备键 —— 然后就没有然后了。
`useTimer` 的起表条件是**松开按键**（`onPressUp` 的 `ready` 分支），而这条路上
根本没有人按过键。实测（假 GAN v4，观察 15 秒）：

```
armed → 观察倒计时开始 → 拧魔方 → 计时器不动 → 15 秒 → "+2" → 17 秒 → "DNF"
```

用户拧完整把，屏幕上写着 DNF，时间从没走过。上游没有这个问题，因为上游的
起表条件本来就是**预备后的第一下转动**（`timer/giiker.js:166`：状态 -3/-2 收到
move 就 `timer.startTime(locTime)`）。我们照抄了预备，没抄起表。

### 第一下转动即起表

`useTimer` 新增 `startFromCube(atMs)`：

- **只在已预备时接受**（`inspecting` / `holding` / `ready`）。`idle` 不接受 ——
  否则连着魔方随手拧两下就开始计时；
- 起表时刻**回拨到魔方自己的时间戳**。BLE 按连接间隔成批送达，等我们收到通知时
  这一把已经开始了几十毫秒。回拨上限 2000ms，与 `MoveClock` 的重锚阈值同一个数：
  比那更旧的时间戳不是「通知晚了」，是时钟不能信；
- **不清观察状态** —— 这正是判罚要用的量（下一节）。

三条起表路径（松开空格 / 同时起表倒计时 / 魔方第一下）现在都走同一个
`beginRunning(startTs)`，只在「清什么」和「从哪一刻算」上不同。原先各写一遍，
迟早会在显示和记录上分叉。

**起表那一下转动本身要记进成绩**。这条差点漏掉：它到达时 React 还没重渲染，
按 `phase` 判定的订阅者会把它丢掉，而少了第一步的复盘比没有复盘更坏（分析层
会按错位的序列算）。所以起表在 `onMove` 里、广播**之前**同步做完
（`phaseSnapshotRef` 直接置 `running`、重置 `movesRef`、把起点设成这一下的时间戳），
相位 effect 由 `cubeStartedRef` 挡住不再重置。上游同样把这一步记进
`rawMoves`（`giiker.js:185-187`）。

### 观察超时自动判罚

有了「起表时刻」，判罚就是它减去观察开始 —— 与倒计时后来跑到哪无关。
判据抽成 `_shared/inspection.ts` 的 `inspectionPenalty(inspectionMs, limitSec)`，
键盘和魔方两条路共用。上游把 15/17 硬编码（`giiker.js:173`），我们读设置里的
限制值，规则同构。

边界是这条唯一会错的地方，所以全在测试里钉住：15.000 不罚、15.001 才 +2、
17.000 还是 +2、17.001 才 DNF；`limit=0`（不用观察）永不判罚；负数 / NaN 不判罚
（那种数只可能来自算错的差值，凭垃圾数据判 DNF 是最坏的失败方式）。

### 「打乱正确即预备」并设为默认

上游默认就是这个（`giiSD='s'`）。魔方能看见自己已经和打乱一致了，再要求按一下
空格，这个动作只是因为过去软件看不见。**预备是被动的**（时钟仍等第一下转动），
所以它能当默认而不会突然开始计时。

**这里踩了一个自己造的 bug，值得写下来。** 第一版把它写成对 `scrambleMatch`
状态的 effect，实测每把结束后下一把的**打乱动作本身**就把表开起来了
（记录到 48-52 个动作、时间里含拧打乱的 1.4 秒）。原因：打乱校验在计时中会
提前 return，所以 `scrambleMatch` 在整把期间一直是上一次的 `true`；等停表那一帧
effect 跑起来，它读到的就是这个陈旧的 `true` + 新的 `stopped` 相位 → 立刻预备。

「打乱变正确」是**事件**，不是状态。改成在打乱校验里当场判（`facesEqual` 刚算完
那一行），这一类陈旧状态的 bug 就整类消失了。

### 断连：说出来，不是作废

上游断连即合成 ESC（`timer.js:715`），也就是记一个 DNF。这里**故意不照抄**：
我们有它没有的重连梯（1/2/4/8/16 秒），GATT 掉线通常一两秒就回来、魔方重新自报
状态、这把能正常拧完；而作废是不可逆的 —— 一个五分钟的盲拧被无线电抖动杀掉，
比任何文案都糟。计时中断连改为提示「这把不会自动停表 —— 按空格自己停」，
空格本来就能停表，所以这句话是个完整的答案。

### 测试

- `tests/inspection_penalty.test.ts`（7 例）：上面那些边界。
- 假 GAN v4 实测（`/timer`，默认设置）：
  - 连续 4 把「打乱 → 第一下起表 → 还原停表」，起表滞后 51-62ms（采样间隔 50ms，
    即测不出滞后），计时 0.51-0.53s 与真实间隔一致（**不含**拧打乱的时间），
    每把第一步都记成 `R@0`，4 把全部落库；
  - 观察限制设 3 秒：1.5 秒起表 `ok`、4 秒起表 `+2`、6 秒起表 `DNF`；
  - 模式设回 `off`：拧魔方**不**起表，空格路径（按住 → 松开 → 还原停表）一切照旧；
  - `/stroop`（同一个 `useTimer`，走 `startNow`）计时正常，重构没碰坏它。

### 未测到的部分（说清楚）

- 断连提示没在浏览器里触发过 —— 假外设没法制造 GATT 掉线，只能改文案那一支；
- `NetBattleView` 的「第一下起表」按同一条规则接了（门控 / 倒计时 / 已交卷三种
  房间态挡掉），但需要一个真房间才能验，没验；
- 实体魔方：设备时钟回拨的实际幅度、真实丢包下的起表。

### 状态

- [x] `startFromCube`：只在已预备时起表、回拨到设备时间、保留观察状态
- [x] 起表那一下转动记进成绩（差点漏）
- [x] `inspectionPenalty` 抽成纯函数，键盘与魔方共用，边界有测试
- [x] 「打乱正确即预备」+ 设为默认（并修掉自己写出来的陈旧状态 bug）
- [x] 计时中断连给出可操作的提示（不作废、不记 DNF）
- [x] 三条起表路径收拢到 `beginRunning`
- [ ] 实体 GAN 16 UI 复验（等用户回来）

---

## Sprint 12 — 补齐动作的时间 + 实况展开图（已完成）

迁移表「地基」那节剩下的一半，和 P1 第 9 条。

### 「不编造时间」编造了更糟的时间

GAN 的历史帧（0xD1）只说丢的是哪一下，不说什么时候。之前的选择是留空，测试里
写着理由：「猜一个数会把编造的间隔塞进每个指标」。**这个前提是错的** —— 留空在
下游不是没有数字：`MoveClock.stamp(undefined, …)` 退回**到达时间**，也就是历史
回复送达的那一刻，而那一刻在这一下之后、甚至在触发补齐的那个更晚的动作之后。
顺带它还会丢掉时钟锚点，于是同一批里那个**本来有设备时间**的动作也退回到达时间。

净效果：一次丢包凭空造出一个停顿（上一个动作 → 补齐动作），紧跟着把一个真实
间隔压成 0（补齐动作 → 触发补齐的动作）。恰好是 TPS / 停顿 / 分阶段全都建立在
上面的那个量。「不编造」编造了两个数，而且都错。

补齐回来的这一下**确实**发生在「上一个有时间的动作」和「下一个有时间的动作」
之间。`GanMoveSync.fillRecoveredTimes` 把这一段按个数均分：顺序对、总量对、
误差被这段区间自己的长度框住，猜的只是间隔分布。两端缺一个就仍然留空 ——
那种情况连区间都没有。上游做同一件事（`tsLinearFit`，线性回归而非均分；一次
真实丢包只涉及两三下，两者答案一样）。

**漂移斜率没有照抄，这是有意的**：设备晶振漂移约 50-100 ppm，一把两分钟的三阶
上就是 12ms，而我们所有指标都是**把内的差值**，0.01% 的尺度误差没有意义；跨会话
的绝对偏差由 `MoveClock` 的 2 秒重锚封住。上游需要斜率是因为它面板上要显示
slope %，并且用一个全局拟合去改写分阶段时间。

### 实况小窗：展开图

设置项 `liveCubeView` 原先写着「展开图 / Net」，实际渲染的是 visualcube 的
**立体图** —— 三个面看得见、三个看不见，而这个小窗的用途正是「逐面和手里的
魔方对」。标签和实现不符，先修实现：新增 `net` 并设为默认，`2d` 保留为立体图
（值名是历史名，存过设置的用户行为不变），`3d` 不变。

**没有另画一遍**：`app/[lang]/sim/sim_net_export.ts` 已经在做「URFDLB 串 →
展开图 SVG」，与 /timer 要的是同一件事，所以按仓库规矩先 `git mv` 到
`lib/cube-net-svg.ts` 再 import（顺带更新 /sim 的 4 处引用和 4 个测试）。
渲染器一路通到 shared 的 `renderUnfoldedStateSvg`，也就是打乱预览用的那份
tnoodle 参照 emitter，所以布局、描边、字节格式天然一致。

尺寸按**高度**对齐它替掉的立体图（96px 高 → 127px 宽），角落那块牌子在屏幕上
没变大，而每张贴纸更大了 —— 这正是换成展开图的全部理由。

### 测试

- `tests/gan_recovered_move_times.test.ts`（7 例）：单个补齐动作落在区间中点、
  一串补齐动作均分、时间戳严格递增（这正是旧回退破坏的性质）、没有左端不猜、
  设备计数器回绕不猜、区间跨批次仍然成立，以及一条端到端：经 `MoveClock` 之后
  两个动作相差 60ms 而不是「一个停顿 + 一个 0」。
- `tests/live_cube_net.test.ts`（3 例）：**打乱态**下与 tnoodle 参照网逐字节相同
  （9 个打乱，含 `L'` / `B2` / `D` —— 内部 posit 里做水平/垂直镜像的三个面，
  映射错了只有打乱态才看得出来，而已有 parity 测试只锁复原态）；54 张贴纸只用
  站内配色；任意打乱下每色恰好 9 张。
- `tests/bluetooth_parity_gan_v34.test.ts`：**主动改 baseline** —— 原来断言
  补齐动作 `undefined`，现在断言 500_060，注释写清前提哪里错了（按 CLAUDE.md
  「改算法主动改 baseline 当 review 信号」）。
- 浏览器：`/timer` 实况小窗确认渲染展开图（viewBox `0 0 13 9.8`、54 rect、
  站内配色，127×96）；`/sim` 的引擎伴图在模块搬家后照常渲染。

### 状态

- [x] 补齐动作按区间均分插值，两端缺失则不猜
- [x] 漂移斜率明确不做，理由写下来（数量级论证）
- [x] 实况小窗展开图 + 设为默认，标签与实现对齐
- [x] 展开图渲染器提到 `lib/` 共用,不平行自绘
- [x] 打乱态逐字节对照 tnoodle 参照网

## Sprint 13 — 谁在什么状态下解的（P0-1）+ 识别/执行拆分（P0-2）（已完成）

研究文档 P0 表的头两项。方向：先把**数据落对**（P0-1），再把**行业里只有一家有
的指标算出来**（P0-2）。两者都不做迁移 —— P0-1 是纯可选字段，P0-2 完全按需
从 `(scramble, moves, timeMs)` 推导，定义修一次，历史成绩的报告跟着全对。

### P0-1 `Solve` 数据模型扩展

- `inspectionMs?: number`：起表前实际用掉的观察时间。`useTimer` 本来就把它递给
  `onSolve`（罚时判定用的同一个数），`recordSolve` 原样落盘（>0 才写）。
- `device?: { model, name }`：这把是哪颗魔方解的。在 attempt **开始**时随
  `scrambleAtStartRef` 一起快照（`deviceAtStartRef`）—— 解到一半断连不该抹掉
  「是它解的」这个事实；只有真的带动作流的 solve 才写。model 是协议族
  （CubeBrand：`gan-v4` / `qiyi` / …），name 是 BLE 广播名。
- 研究文档里的 `pickupMs` / `putDownMs` **决定不落盘**：两者由 `moves` + `timeMs`
  可完全推导（P0-2 的模块现算），单一来源，不会漂移。
- 「观察阶段的转动也落盘」**按设计不存在**：Sprint 11 之后预备状态下第一下转动
  就是起表信号,没有「观察期转了但没起表」这个窗口可记录。
- 复盘 modal 标题栏显示设备名；分阶段面板下新增一行
  `观察 X · 拿起 X · 识别 X · 执行 X · 放下 X · N 步/秒(执行)`。

### P0-2 识别 / 执行拆分（`_lib/reconstruct/step_metrics.ts`）

Cubeast 定义逐字采用（见 SMART_CUBE_RESEARCH.md「step 级五个时间字段」）：

- 识别 = 上一阶段最后一转落定 → 本阶段第一个**非 AUF** 转动（AUF 计入识别）；
- 执行 = 该转动 → 本阶段最后一转；`step_time = 识别 + 执行`，精确二分；
- TPS = STM 步数 / **执行**时间 —— 手速，不被思考稀释。同一把 fixture 里
  整解 TPS 4.87、执行 TPS 11.2,这个差就是这个指标存在的理由;
- 拿起 = 起表 → 第一转（第一阶段的钟从第一转起走，拿起自成一段，
  与 Cubeast 堆叠柱状图的 Pickup 段一致）；放下 = 最后一转 → 停表。

公开材料没写死的三个边界,自己定并测死:全 AUF 阶段(PLL 只有一个 U)识别走到
第一转、AUF 本身当执行;单转阶段执行 0ms 时 TPS 为 null 不是 Infinity;
rotation(x/y/z)计 0 步且不结束识别(regrip 不是公式开始)。
步数天然「停顿感知」:智能魔方报的就是 90° 转,从不合并成 U2。

阶段边界不重走一遍:`computeStageSegments` 增补 `*EndIdx` 动作下标
(可选字段,旧存档没有就现算),step_metrics 在它上面纯函数推导。

### 顺手修的一个真 bug(根因,不是打补丁)

从成绩详情打开复盘时,控制台报 React duplicate key。根因:`SolveModal` 与
`ReconstructModal` 是**兄弟节点**,都拿 `solve.id` 当 key —— 同一把从详情打开
复盘,两个兄弟同 key,React 会把一个组件的身份复用给另一个。fixture 场景下
100% 复现(先开详情再开复盘必报)。修法:key 加命名空间前缀
(`detail-` / `recon-`),换 solve 重挂载的语义不变。浏览器按原复现路径验证
0 error。

### 测试

- `tests/step_metrics.test.ts`(14 例):fixture 按阶段写好**解法**、打乱取逆,
  边界由真实 CFOP 检测器算出来再断言(边界错一步整组数字全错):
  AUF 计入识别(F2L/OLL/PLL 三处)、TPS 只除执行、每步 识别+执行=step_time、
  拿起+四段+放下=总时长、OLL skip 零步零时、全 AUF PLL、DNF 中途 null 化、
  rotation 不结束识别不计步、无动作返回 null、token 分类表。
- 浏览器(fake GAN v4 全链路):观察 1.2s → 第一转起表 → 复原自动停,落盘
  `inspectionMs: 1212` + `device: { model: 'gan-v4', name: 'GAN14-FAKE00' }`;
  复盘 modal 标题带设备名,meta 行 `观察 1.21s · 识别 … · 执行 …`;
  en / zh 两侧都验过。

### 未测到的部分

- 真机的 device 快照(fake 的 brand 恒为 gan-v4;GAN 16 UI 回来后看一眼
  详情页设备名即可)。
- 识别/执行的数值只在 fixture 时间戳上验证过;真人解一把后应 sanity check
  一眼(识别应该在几百 ms 量级,不该是 0 或十几秒)。

### 状态

- [x] `inspectionMs` / `device` 落盘 + 复盘展示
- [x] pickup / put-down 决定推导不落盘,理由写下来
- [x] step_metrics 纯函数模块,Cubeast 定义逐字采用
- [x] 三个未定义边界自己定死并各有测试
- [x] duplicate-key 根因修复(命名空间 key)
- [ ] 真机 sanity check(等用户回来)

## Sprint 14 — 废步检测（P0-5）（已完成）

研究文档 P0-5:「这里多花了 0.8s 和 4 步」。全行业空白 —— Cubeast 的错误模型
只有罚时形状,国产 App 只有整题对错。

### 设计:一条规则,不做模式目录

**状态重现 = 中间那段转动净效果为零。** 撤销(R R')、走错公式逐步退掉、
绕一圈回来,全是这一件事的三种长相;也因此不会误报 —— 状态真的回来了,
那些转动就真的什么都没达成(AUF 会移动贴纸,对齐顶层不会被标)。

记账上踩过一个坑,修正后测死:
- 第一版「报出环就清 map」只能看见**最内层**退步(F F' 报 2 步,外面的
  U…U' / R…R' 全丢);
- 改成**每次回到已见状态记原始区间,重叠区间合并成极大段**:逐步退掉的
  6 步整段报出,嵌套区间也不会重复数成 12 步;
- map 每次访问都**重新锚定**到最近一次出现:R R' 后又 D D',第二个环从
  重新闭合处起算,两个错误分开报,不融合成一段。
- 环的时间从「起点状态被到达」起算 —— 想错路的思考时间也是这个错误的成本;
  从打乱起始状态出发的环从第一转起算。

明确看不见的(写进模块头注):走错公式后**顺势解下去**没有状态重现,
不报 —— 那本来就该由最优解对比(P0-4)来定价,不是错误检测的事。

`applyOneToken` 从 stage_segments 导出共用,reconstruct 层只有一份
容错的 token 应用。

### UI

复盘 modal 统计区下一行(`--signal-warning` 色):
`废步 N 步 · 多花 Xs(M 处,动作表中已标出)`;动作表里废步行加左侧
警示条(box-shadow,不占背景 —— 与 `.slow` 行的背景可叠加)。

### 测试

`tests/error_detect.test.ts`(10 例):撤销对及其计时起点、逐步退掉的
6 步极大段、R R' R R' 合并为一段 4 步、背靠背两个环分开报、六遍 sexy
= 24 步废、干净解法与 AUF 静默、U U ≠ 废步而 U U' 是、同向四个 90° 一圈
= 4 步废、无动作返回 null。浏览器:replay 路径验证 zh 文案行 + 行标记,
0 console error。

### 状态

- [x] 状态重现检测 + 区间合并,三种记账约定各有测试
- [x] 复盘 modal 展示 + 动作行标记
- [x] 第一版只见最内层的坑记录在案(测试锁住正确行为)
- [ ] 真机一把带失误的解法 sanity check(等用户回来)
