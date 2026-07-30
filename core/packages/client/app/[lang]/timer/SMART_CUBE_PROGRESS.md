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
