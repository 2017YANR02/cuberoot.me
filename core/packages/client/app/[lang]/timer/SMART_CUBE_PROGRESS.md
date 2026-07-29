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
