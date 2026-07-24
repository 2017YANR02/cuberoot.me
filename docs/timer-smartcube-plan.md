# /timer 智能魔方全覆盖 + 功能补齐

## 从帖子学到的（要点）

- **连接四步**：扫描识别（名字 / Service UUID / Manufacturer Data）→ 建 GATT → 确认协议版本 → 初始化（含加密参数）→ 同步初态 → Notify 收流 → 应用层。协议层与应用层要分开，应用层只吃统一的「转动 + 姿态」事件。
- **三大厂协议版图**：魔域 MHC(2021) / AiCube(2023，实为 GAN Gen2) / **MoYu32(2024，当前在售全靠它)**；奇艺一套协议管 QYSC 与 Tornado V4（后者多陀螺仪）；GAN 分 Gen1-4，i4 属 Gen4 含陀螺仪。
- **Web 的死穴**：Web Bluetooth 故意不给 MAC，而 GAN/魔域/奇艺的 AES key 从 MAC 派生 —— 只能靠广播厂商数据 / 名字规律 / 手输。Android 原生 `getAddress()` 白送，所以移动端体验更好。这解释了我们为什么必须把 MAC 发现做扎实。
- **多品牌兼容是「测试 > 代码」**：作者明说要 4-5 颗不同魔方才能覆盖，且「不建议任何未经充分测试的协议上线」。我们一颗都没有 —— 所以本轮把验证换成**与 cstimer 原版实现字节级对拍**，并如实标注哪些未经真机验证。
- **应用层才是差异化**：计时/训练之外，映射类玩法（魔方当手柄、控安卓）本质就是把应用层换掉。作者结尾的「展望」正好是我们已有的东西：一个轻量、多品牌、跨平台的**在线对战/异步周赛**客户端 —— `/timer` 的联机房间已经上线，只差把 BLE 接进去。

## Context

论坛帖 `cuberoot.me/zh/forum/t/8`（胡泽亮《从原理到应用：智能魔方开发接入全景指南》）给出了智能魔方接入的完整版图。对照我们 `/timer` 现状，暴露出几个硬缺口：

1. **MoYu32 协议完全没实现**。帖子明确「目前在售的基本只有 MoYu32 系列」（威龙 V10 AI 及之后全系，`WCU_MY32_*`）。我们 `_lib/bluetooth/moyu.ts` 的注释自己承认只做了 2021 年的 MHC 老协议，MoYu32「intentionally NOT handled」。更糟的是 `index.ts` 的 `requestDevice` filters 里没有 `WCU` 前缀 —— 这类魔方**连设备选择器都不会出现**。
2. **陀螺仪全线丢弃**。`gan_v2.ts:402`、`gan_v4.ts:358`、`moyu.ts:59`、`gocube.ts:29` 一律注释「ignored」。帖子把陀螺仪列为各家新品的卖点，且点出 cstimer「暂无陀螺仪适配」—— 这是能做出差异化的地方。
3. **没有 BLE 智能计时器**。只有麦克风 Stackmat（`_lib/stackmat/`），而且它在 `moreItems` 里被 `isMobile` gate 掉了，**桌面端根本点不到**。
4. **没有打乱校验 / 引导打乱**。智能魔方能实时给出真实状态，却没拿来验证「打乱是不是拧对了」。
5. 通用计时器侧还缺 DNS、MBLD 成绩模型、FMC 解法输入、复盘外链、自定义快捷键、轮次模拟；另有 4 处死设置。

目标：把 `/timer` 做成帖子里那个「足够轻量、多品牌多平台适配」的客户端 —— 三大厂协议全覆盖 + 陀螺仪 + 智能计时器，并把通用计时器功能补到 csTimer / DCTimer-BLE 同级。

## 关键约束：没有硬件

用户**手上一个智能魔方都没有**。所以真机验证不可能，唯一可信判据是：

> **在 Node 里跑 cstimer 原版 JS 解码器，与我们的 TS 移植做字节级对拍。**

`D:\cube\cstimer\src\js\hardware\` 本机已有全部源码（`moyu32cube.js` `gancube.js` `qiyicube.js` `gantimer.js` `qiyitimer.js`）。做法：把随机合成帧（用已知 MAC 加密已知明文）同时喂给两边，断言解出的招式序列 / 状态 / 计时事件**完全一致**。写成 `tests/bluetooth_parity.test.ts`，是本轮所有驱动改动的验收线。

**harness 可行性已实测**（`node -e` 探过，非假设）：
- `lib/sha256.js` 提供 `$.aes128`，在 Node vm sandbox 里加载成功、加密输出正常（只需先塞一个 `$` 占位）
- `lib/lzstring.js` 加载成功，已用它实测解出 MoYu32 的 base key/iv（见 1.2）
- `lib/mathlib.js` / `lib/utillib.js` 依赖 `DEBUG` / `location` 等全局，**不要加载** —— `moyu32cube.js` 只用到 `mathlib` 的三个符号（`valuedArray` / `SOLVED_FACELET` / `CubieCube`），手写约 60 行 stub 即可；`CubieCube` 可写成 dummy，因为对拍只比 `GiikerCube.callback(facelet, moves, …)` 的 **moves 数组**，不比 facelet
- 驱动方式：stub 一个假 BLE device，`regCubeModel` 拿到 `init`，然后手动派发 `characteristicvaluechanged` 事件喂帧

任何没被对拍覆盖的部分（例如陀螺仪的传感器坐标系朝向）**必须在 UI 上标注为未真机验证**，并提供人工校准入口，不能假装已验证。

---

## Phase 1 — 智能魔方硬件覆盖

### 1.1 抽出共用加解密 `_lib/bluetooth/gan_crypto.ts`

`gan_v2.ts` / `gan_v3.ts` / `gan_v4.ts` 各自内联了一份约 200 行的纯 TS AES-128（`gan_v2.ts:112-298` 是其中一份，注释自己写着 "duplicated from v3"），`qiyi.ts` 又有第三份变体。MoYu32 还要再来一份 —— 先抽公共件，符合仓库「不重复造轮」。

导出：`expandKey` / `aesEncryptBlock` / `aesDecryptBlock` / `aesEcbEncrypt` / `aesEcbDecrypt` / `decryptFrame` / `encryptFrame` / `deriveKeyFromMac(base, mac)` / `toBitReader`。
`gan_v2/v3/v4` 与新 `moyu32.ts` 全部改为 import；`qiyi.ts` 复用 ECB 部分。**行为必须零变化** —— 抽取前后各跑一遍对拍。

### 1.2 新驱动 `_lib/bluetooth/moyu32.ts`

协议已完全掌握（源：cstimer `moyu32cube.js` + `lukeburong/weilong-v10-ai-protocol`，帖子推荐的那份）：

| 项 | 值 |
|---|---|
| Service | `0783b03e-7735-b5a0-1760-a305d2795cb0` |
| Notify | `…cb1` |
| Write | `…cb2` |
| 加密 | 与 GAN Gen2/Gen3 同一套（AES-128 + 反序 MAC салt，`(key[i]+mac[5-i])%255`），但 **base key/iv 不同** |
| base key | `[21,119,58,92,103,14,45,31,23,103,42,19,155,103,82,87]` |
| base iv | `[17,35,38,37,134,42,44,59,85,6,127,49,126,103,33,87]` |

（以上两组常量是我本机跑 LZString 从 cstimer `KEYS[0]/KEYS[1]` 解压出来的实测值，非记忆。）

帧：20 字节，`byte0` = msgType。
- `0xA1` 硬件信息（型号 / 版本 / 陀螺仪状态位）
- `0xA3` 状态快照：48 facelet（每格 3 bit），`bit(152,160)` = moveCnt。**只在 `prevMoveCnt == -1` 时采用**，用于播种计数器
- `0xA4` 电量（`bit(8,16)`）
- `0xA5` 招式：`moveCnt = bit(88,96)`；5 条滑窗，每条 5 bit 从 bit 96 起，`m` → `"FBUDLR"[m>>1] + " '"[m&1]`，`m>=12` 判为乱码；`timeOffs[i] = bit(8+i*16, 24+i*16)`（16 bit，5 条）；`moveDiff = (moveCnt-prevMoveCnt)&0xff` clamp 到 5，旧→新 emit
- `0xAB` 陀螺仪（见 1.3）
- `0xAC` 陀螺仪开关

握手：连上后依次发 `0xA1` / `0xA3` / `0xA4`（20 字节，`[0]=opcode` 其余补零，加密后写入）。

MAC 发现：
- 广播厂商数据，CIC 列表 = `0x0100 … 0xFF00`（`(i+1)<<8`, i∈[0,254]）；末 6 字节倒序
- 名字兜底：`WCU_MY32_XXYY` → `CF:30:16:00:XX:YY`
- 再兜底走现有手输 MAC 弹框

⚠️ **`mac.ts` 必须先参数化**（已读过确认）：现在 `extractMacFromManufacturerData` 写死只遍历 `GAN_CIC_LIST`（`mac.ts:80`），且只支持「末 6 字节倒序」这一种布局。要加：
- CIC 列表按驱动传入（GAN `(i<<8)|0x01` / MoYu32 `(i+1)<<8` / QiYi Timer `0x0504`）
- payload 布局按驱动传入：GAN 与 MoYu32 是**末 6 字节倒序**，而 QiYi Timer 是**前 6 字节倒序**（cstimer `qiyitimer.js:200-203`），两者不同，不能共用一条规则
- `watchAdvertisementsMac(device)` 增加 `{cics, layout}` 参数；`index.ts` 的 `requestDevice` 把各驱动的 CIC 合并进 `optionalManufacturerData`

接入点：
- `types.ts` 的 `CubeBrand` 加 `'moyu32'`
- `index.ts` 的 `DRIVERS` 数组加入（放在 `moyuDriver` 之前，两者 service 不同不会误路由）
- `index.ts` 的 `requestDevice` filters 加 `{ namePrefix: 'WCU' }`，`optionalManufacturerData` 合并 MoYu32 CIC 列表（`mac.ts` 现有 `GAN_CIC_LIST` 旁边加 `MOYU32_CIC_LIST`）
- `needsMac: true`，乱码帧（move 码 ≥12）累计触发现有 `onKeyError` 自愈链

### 1.3 陀螺仪

`driver.ts` 的 `CubeDriverContext` 增加 `onGyro?: (q: {w,x,y,z}, v?: {x,y,z}) => void`；`index.ts` 的 hook 增加 `onGyro` opt + `status.hasGyro`。

各协议位布局（源：`afedotov/gan-web-bluetooth`，帖子推荐的那份，已逐字核对）：

- **GAN Gen2**（`gan_v2.ts`，mode `bit(0,4) === 1`）：qw@bit4, qx@20, qy@36, qz@52（各 16 bit）；vx@68, vy@72, vz@76（各 4 bit）
- **GAN Gen4**（`gan_v4.ts`，`frame[0] === 0xEC`）：qw@bit16, qx@32, qy@48, qz@64；vx@80, vy@84, vz@88
- 归一化（两代相同）：`(1 - (q>>15)*2) * (q & 0x7FFF) / 0x7FFF`；速度 `(1 - (v>>3)*2) * (v & 0x7)`
- **GAN Gen3 无陀螺仪** —— `gan_v3.ts` 不动
- **MoYu32**（`0xAB`）：4 个有符号 int32 小端，序列为 `(w, x, -z, y)`，各除以 `2^30`。连接时发 `AC 00 01 00…`（20 字节）开启，`AC 00 00 00…`关闭
- **QiYi Tornado V4**：cstimer 未实现，本轮不做，代码里留 TODO 注明原因

⚠️ 传感器坐标系到屏幕坐标系的基变换**没有硬件无法确定**。设计上不硬编码：UI 提供「校准」按钮，按下时把当前四元数记为参考姿态，之后只显示相对姿态。这样即便基变换未知，功能依然可用。

### 1.4 BLE 智能计时器 `_lib/bluetooth/timer/`

新增统一抽象 `ExternalTimerSource`，状态机沿用 cstimer 的语义（`bluetooth.js:178-191`）：
`DISCONNECT / GET_SET / HANDS_OFF / RUNNING / STOPPED / IDLE / HANDS_ON / FINISHED / INSPECTION / GAN_RESET`，
并把现有麦克风 Stackmat（`_lib/stackmat/index.ts` 的 `StackmatPhase`）也归到同一接口下，`SoloView` 只对接一个 source。

- **GAN Smart Timer**（`gan_timer.ts`）：service `0000fff0-…`，notify `0000fff5-…`，**明文**。`data[3]` 索引状态表；`STOPPED` 时 `min=[4] sec=[5] msec=getUint16(6,true)`。CRC-16/CCITT-FALSE 校验（magic `0xFE`，CRC 在末 2 字节小端，覆盖 `buffer.slice(2, len-2)`）。约 120 行，最容易的一个。
- **QiYi Timer / Adapter**（`qiyi_timer.ts`）：service `0000fd50-…`，write `00000001-0000-1001-8001-00805f9b07d0`，read `…0002…`。AES-128-ECB，**固定密钥 `0x77` × 16**（不需要 MAC 解密，MAC 只用于 hello 报文内容）。分片重组（首包 `[0x00, len+2, 0x40, 0x00]`，续包 `[i>>4]`）+ CRC-16/MODBUS。`cmd 0x1003`：`dpId==1` 给成绩（solveTime + inspectTime），`dpId==4` 给状态。名字 `QY-Timer-XXXX` → MAC `CC:A1:00:00:XX:XX`；`QY-Adapter-…` → `CC:A8:…`。CIC `0x0504`。

### 1.5 鸣谢（仓库硬规则）

`app/[lang]/about/credits_data.json` 已有 `cs0x7f/cstimer` 条目 —— 扩写它，补上「智能魔方 / 智能计时器协议移植」。另新增两条（都是论坛帖推荐的参考源）：
- `afedotov/gan-web-bluetooth` —— GAN Gen2/Gen4 陀螺仪位布局
- `lukeburong/weilong-v10-ai-protocol` —— MoYu32 (威龙 V10 AI) 协议与陀螺仪

⚠️ 该文件当前被别的 AI 改着（`git status` 已见 M），**只 add 自己那几行**，动前先重读。

### 1.6 修 Stackmat 桌面不可达

`_shell/SoloView.tsx` 的 `moreItems` 里 Stackmat 项被 `isMobile` 挡住。改为始终可见，并入新的「外接计时器」入口（麦克风 Stackmat / GAN Timer / QiYi Timer 三选一）。

---

## Phase 2 — 智能魔方新功能

### 2.1 打乱校验 / 引导打乱

连接智能魔方后，把「显示的打乱」当作目标状态：实时比对 BLE 推出的魔方状态，
- 完全一致 → 打乱条变绿 + 「已就绪」
- 不一致 → 提示还差几步 / 高亮偏差（QiYi 与 MoYu32 直接给 facelet 快照，可硬校验；GAN 由招式模型推算）

实现不需要新机制（已读过确认）：`_lib/cube/state.ts` 有 `solved` / `applyMoves` / `facesEqual`，`_lib/cube/moves.ts` 有 `parseScramble`，`CubeStateTracker` 已暴露 `getFaces()`。
- 目标态 = `applyMoves(solved(3), parseScramble(打乱))`
- 现态 = `tracker.getFaces()`（前提是打乱前调过 `resetState()`）
- `CubeStateTracker` 增加一个 `setFaces()`，给能直接上报 facelet 快照的 QiYi / MoYu32 用（硬校验，不依赖招式模型）

### 2.1b BluetoothModal 文案与设备表

`_components/BluetoothModal.tsx:33-46` 的支持列表要补 `MoYu 32（威龙 V10 AI 及之后全系）`，带陀螺仪的型号标一个「陀螺仪」小标；再加一节「智能计时器」。
`:138` 的手输 MAC 提示写死了「GAN 用它解码」，要改成 GAN / MoYu32 / QiYi 通用措辞，并按品牌给出各自 App 里查 MAC 的位置。

### 2.2 陀螺仪实况 3D（复用 `/sim` Three.js 引擎）

**先抽公共件**：`ReconPlayerBase.tsx` / `scramble/solver/_Interactive3DCube.tsx` / `PllPerformerOverlay.tsx` / `EnginePuzzleSVG.tsx` 各自手抄了一份约 90 行的「建 renderer → 建 World → 自己跑 rAF → dispose」生命周期。抽成 `components/sim-embed/mountSimWorld.ts`（普通函数，不放 `hooks/`——那目录每个导出都要登记 catalog，且非 React 路径也要用）。第一步只抽 + 新用，**不动那四个老调用点**，降风险。

引擎实情（agent 已逐行核对）：
- `sim/engine/world.ts` 的 `World` 构造即含 3x3；**没有 `mount(el)`**，renderer 由调用方建
- 引擎**自己不跑渲染循环**，各消费方各跑各的 rAF，只在 `world.dirty` 时渲染
- `world.cube` 是 `THREE.Group` 且 `matrixAutoUpdate = false`，层转发生在子 `CubeGroup` 上 —— **`cube.quaternion` 完全归我们，不会打架**
- 落招式：`(world.cube as NxnCube).twister.push(move)`，范本 `components/CuberReconPlayer.tsx:48-61`
- 绝不用 `scene.rotation` 表姿态（那是 orbit 通道，会把灯一起转）。分工：`scene.rotation` = 固定视角倾斜，`cube.quaternion` = 物理姿态，灯固定于世界坐标
- 每帧写完 quaternion 必须 `updateMatrix()`；只在四元数变化超过阈值时标 dirty，否则角落小窗会 60fps 空烧 GPU

**姿态数学单独成纯模块** `_lib/bluetooth/orientation.ts`（无 DOM、无硬件、可单测）：
- 校准：记 `q0`，之后 `qDisplay = qRaw ⊗ q0⁻¹`（**世界系左乘**，这样物理魔方偏航 90° 对应屏幕上绕竖直轴 90°；写成体坐标系右乘是错的）
- 传感器基变换：`qDisplay = B ⊗ (qRaw ⊗ q0⁻¹) ⊗ B⁻¹`，`B` 来自一张按 `CubeBrand` 索引的小表，默认 `identity` 并逐条标 `// UNVERIFIED — no hardware`
- 外加一个 `mirror` 手性开关（取负 x,y,z）。**这是校准做不到的那一半** —— 校准只能消常量偏移，消不掉坐标轴置换和左右手系不匹配（"偏航方向反了"只能靠它修）
- 平滑：`slerp`，`tau ≈ 40ms`（BLE 陀螺仪 20-50Hz，低于 60fps）

**关键：3D 路径可以先于任何蓝牙工作独立验收** —— 用 dev-only 合成四元数源驱动，整条 3D 链路在没有硬件、甚至没有陀螺仪解码的情况下就能跑通并截图验证。

**懒加载边界放在 `LiveCubeState.tsx` 内部**（不是 `SoloView`）：`mode === '3d'` 时 `next/dynamic` 拉 `LiveCubeGyroView`，否则维持现有 2D net。`SoloView.tsx:1952` 已经用 `status.connected` 门控整块，所以 three（~1.2MB）只在连上带陀螺仪的魔方时才下载。范本：`page.tsx:12-14`、`SolverHintPanel.tsx:15,23-30`。没收到过四元数就退回 2D，**绝不显示一个冻住的 3D 魔方**。

**第一个陀螺仪参考实现选 GoCube**（`gocube.ts` 的 `0x03` 四元数，**明文、无 AES、无 MAC 派生**），比 GAN 更容易在盲写状态下判断对错；再做 GAN Gen4 → Gen2 → MoYu32。另：`moyu.ts:127-172` 的陀螺仪特征**已经订阅了**，只是挂了个空回调，改成真解码不需要新 GATT 管线。

### 2.3 实时 TPS / 步数 HUD

计时中显示当前步数与滚动 TPS（现在 TPS 只在事后 `ReconstructModal` 里有）。数据源就是 `SoloView` 已有的 move recorder。

### 2.4 连接状态提示

`useBluetoothCube` 的 `onConnectionEvent`（掉线 / 重连中 attempt n/5 / 重连失败）**已完整实现但无人消费**。接到 toast 上。

### 2.5 智能魔方联机对战

现有 `_shell/NetBattleView.tsx` 房间 + BLE 自动起停 = 帖子结尾「展望」里的跨品牌在线 PK。本轮只做打通（BLE 起停事件接进网络房间的计时），异步周赛留后续。

---

## Phase 3 — 通用计时器补齐

按「价值 / 工作量」排序执行。存储层好消息：`Solve` 是可选字段扩展式设计，MBLD / FMC 都只加 optional 子对象，**不需要数据迁移**。

### 3.1 复盘导出外部工具（先做，性价比碾压）

**代码已经存在** —— `lib/recon-utils.ts:226` 的 `buildExternalLinks(event, scramble, alg)` 已返回 alg.cubing.net / alpha.twizzle.net / cubedb.net 三个 URL，且已被 `/recon` 实战验证。只差两件事：
- 它吃的是 recon 风格 event id（`'3x3'` `'oh'` `'3bld'`），加一张 12 行的 `TIMER_TO_RECON` 映射到 `_shared/event-bridge.ts`（该文件已有 `TIMER_TO_WCA`，同一位置）
- `ReconstructModal.tsx:404` 的 `modal-actions` 里加三个 `<a target="_blank" rel="noopener noreferrer">`，alg 串 = `solve.moves.map(m => m.m).join(' ')`，门控复用已算好的 `canShare`（:143）

约 15 行 + 一个 import。

### 3.2 清理死设置

| key | 处置 | 理由 |
|---|---|---|
| `showCharts` | **删** | 已被 `SoloView:1420-1424` 的 `chartKind` tab 选择器取代，全局开关无意义 |
| `showHeatmap` | **删** | 热力图就是 `chartKind === 'heatmap'`，同上 |
| `hideAllUiWhileRunning` | **实装**（约 5 行） | `shell.css` 里 `surface-chrome` / `shell-undersurface` / `shell-rail` 的淡出类都已存在，只需 `phase==='running'` 时在 shell 根上挂 `data-hide-ui` + 一条 CSS。本项最便宜的真收益 |
| `colors`（配色·魔方面） | **整节删** | 见下 |

`colors` 为什么删而不是实装（agent 已核实）：`components/CubingPreview.tsx` 不接受配色 prop，且**没有便宜的加法** —— 它走 cubing.js `TwistyPlayer`（无自定义配色 API），sq1/mega 走各自的 `renderSq1ScrambleSvg`/`renderMegaScrambleSvg` 内置常量。`@cuberoot/visualcube` 确实有 `colorScheme`，但它只支持 NxN，换过去等于金字塔/斜转/SQ1/五魔/魔表**全部丢失预览**。要正确实装得同时维护 3+ 条配色路径 —— 那是独立项目，不是一行设置。删掉这个一直在骗人的开关。

### 3.3 DNS 罚时

`Penalty` 加 `'DNS'`；`effectiveMs`（`types.ts:85`）在 DNF 判断**之前**加 `DNS → Infinity`，这一改就让 DNS 在所有平均里自动等价 DNF（`stats.ts` 除 `summarize().solved`（:385）外从不看 penalty）。
波及点各 1-3 行：`auto_tag.ts`（TagId/TAG_DEFS/ALL_TAG_IDS + :96）、`HistoryPanel.tsx:74` 的 `ALL_PENALTIES`（筛选 chip 与快捷操作都是 `.map` 驱动，自动跟上）、`SolveModal.tsx:222`、`ManualEntryModal.tsx:198` + `parseTimeStr` 认 `dns`、`SoloView.tsx:1109` 加 `Shift+D`。
**手势轮盘不动** —— `useGestureWheel` 是固定 8 向（`SoloView:837-855`），没有空位；DNS 走键盘/弹框，在 `ShortcutsModal` 里写明。
导出：csTimer 格式**没有 DNS 编码**，写成 `pen=-1` + comment 前缀 `DNS `，导入时嗅前缀还原（`import_cstimer.ts:170` / `import_export.ts:202`）。

⚠️ **动手前必须先验一件事**：`import_cstimer.ts` 把 `time[0]` 当厘秒、`time[1]` 当罚时，而真实 csTimer 导出是 `[penalty, timeMs]`（顺序相反、单位是毫秒）。目前自产自销所以往返测试能过，但**真的 csTimer 文件可能导错**。DNS 的导入导出直接压在这块上，先拿一份真实 csTimer 导出验证；若确实是 bug，先修它。

### 3.4 FMC 解法输入 + 校验

复用而非新写：`_lib/cube/state.ts` 的 `applyScramble` / `applyMoves`，`_lib/cube/moves.ts` 的 `parseScramble`（已支持宽层、`3Rw`、小写宽、`M/E/S`、`x/y/z`）。
两个小增补（加在这两个已有文件里）：
- `state.ts`: `isSolvedFaces(f)` —— 每面同色即可，**天然对整体旋转免疫**，所以 WCA 的「旋转不计」不用额外处理
- `moves.ts`: `parseScrambleStrict(s)` 返回 `{moves, bad}` —— 因为现有 `parseToken` 对垃圾 token 静默返回 `[]`（`moves.ts:72`），打错字会被当成合法解

步数按 WCA E2b（OBTM）：面转 1、宽转 1、旋转 0、`M/E/S` 算 2。新增 `obtmCount(moves)`。
⚠️ **不要复用** `_lib/reconstruct/slice.ts:150` 的 `htmCount` —— 它把中层记 **0 步**，用它会让含中层的 FMC 解法少算步数。

UI：`ManualEntryModal` 的 `isFmc` 分支里把数字输入换成 textarea，实时显示「已解出 · 26 步」/「未解出」/「无效记号: xxx」，保留数字手填（用于抄比赛纸）。解法存 `solve.comment`，不加 schema。
FMC mo3 已经有了（`stats.ts:164`），缺的是**显示** —— `timeMs = moves*1000` 会渲染成 `"27.330"`，在 `StatsModal`/`StatsPanel`/`HistoryPanel` 三处局部特判即可，**不要**把 event 参数穿进全部 122 个 `formatMs` 调用点。

### 3.5 自定义快捷键

`sim/keymap.ts` 已有 `keyLabel(code)` 与 `KEYBOARD_ROWS` 和一套改键 UI —— **直接 import 复用**，两处改键界面长得一样。它的映射形状（`code → KeyMove`）不适用，我们要 `code → TimerActionId`，这部分新写。
`settings` 加 `keymap: Partial<Record<string, TimerActionId>>`，默认值**逐字复刻**现在写死的那套。
`SoloView.tsx:1057-1138` 里 **只换尾部那 6-7 个 `if (e.code === …)` 分发**，前面的 modal 判断 / `data-no-timer` 最近祖先判断（含方向键例外）/ `Space` 长按 / running 期任意键停表 / `Escape` / `Digit1-9` 开第 N 个成绩，**全部原样保留** —— 那段是承重墙。
改完让 `ShortcutsModal` 读实时 keymap，它才真正变成速查表。

### 3.6 轮次模拟

`settings` 加 `roundMode: {on, format: 'bo1'|'bo3'|'ao5'|'mo3', cutoffMs, cutoffAttempts, limitMs, cumulative}`。
本轮的把数只放 `SoloView` 的 ephemeral state（成绩照常持久化，轮次只跟踪尾部切片），不引新持久层。
`stats.ts` 加纯函数：`roundResult` / `roundCutoffMade` / `roundProjection`。现有 `bpa`/`wpa`（`stats.ts:79/92`）硬要求 `length === n-1`，`roundProjection` 把剩余全部代入 0 / Infinity 来推广。
面板放 `SoloView:1772` 的 `shell-undersurface` 里、`GoalProgress` 旁，复用它的 pill 样式：`2/5 · ao5 进行中 9.12 · BPA 8.44 / WPA 10.31 · 想破 9.5 需 ≤ 9.87`。没过 cutoff 就把剩余格子灰掉。

### 3.7 MBLD 成绩模型（排最后）

存储用 `mbld?: { solved: number; attempted: number }`，`timeMs` 保持真实毫秒。
**明确否决** WCA 的 `DDDTTTTTMM` 打包整数方案 —— 那会污染 122 个 `formatMs` 调用点、三个图表（都把 `effectiveMs` 画在时间轴上）、`bestSingle` 和排序。保持 `timeMs` 为真毫秒，图表和历史自动正确，只有排名和标签需要特判。
`stats.ts` 加 `mbldPoints` / `isMbldDnf` / `formatMbldResult` / `compareMbld`（约 40 行）。`bestSingle` / `formatPrimary` / `formatBestPrimary` 需要多收一个 event 参数（6 个调用点，全在仓库内）。
录入走 `ManualEntryModal` 的新 `isMbld` 分支（solved / attempted / `mm:ss`）。

### 3.8 项目（魔方种类）本身也要「各种」

`EventId` 现在 36 个，但 solo 模式缺非 WCA 项目，而 battle 模式自己另有一份 18 puzzle 列表（**已核实**：`BattleView.tsx:73-80`，含 `fto` / `kilominx`）—— 两边不一致。同时 `/scramble/gen` 已 vendor 了 cstimer 的 30+ 非 WCA 打乱引擎。
做法：battle 与 solo 的项目列表统一到单一源，并从现成的 gen 引擎（`tools/cstimer-scramble/`）接入更多非 WCA 项目（Ivy / 齿轮 / Redi / 五魔变体等），**不新写打乱器**。

---

## 验证

1. `tests/bluetooth_parity.test.ts` —— 与 cstimer 原版 JS 字节级对拍（MoYu32 / GAN v2 / GAN v4 / QiYi / GAN Timer / QiYi Timer），随机种子多轮，锁 `toBe()`。
2. `tests/bluetooth_crypto.test.ts` —— `gan_crypto.ts` 抽取前后行为一致（已知向量）。
3. `tests/bluetooth_orientation.test.ts` —— 校准幂等（`calibrate(q)` 后 `apply(q)` 必须是单位四元数）、复合顺序、模长保持、基变换往返、`mirror` 取反。
4. 陀螺仪解码单测：合成帧 → 期望四元数，覆盖符号位与 ±1 边界。
5. 通用功能各配 vitest：DNS（含 csTimer 往返）、MBLD 排序值、FMC 校验 + OBTM 计数（`Rw` / `M` / `x` 三种）、轮次模拟状态机。
6. `pnpm --filter @cuberoot/client typecheck`（tsgo）+ 全量 `test`（注意 `analyzer_worker.test.ts` 单独就 ~225s）。
7. Playwright 走 `/zh/timer`：外接计时器入口在桌面可达、设置面板无死项、轮次模拟跑通、3D 小窗用合成四元数能转、无 console error。窄屏（<480px）同走一遍。

### 诚实边界（必须遵守）

**绝不写「智能魔方已验证可用」。** 没有任何一颗智能魔方。能声明的只有：
- ✅「与 cstimer 实现字节级一致」（对拍覆盖到的部分）
- ✅「3D 姿态链路已用合成四元数跑通」
- ⚠️「陀螺仪的传感器坐标系映射未经真机验证」—— 每个品牌的 `SENSOR_BASIS` 条目都要带 `// UNVERIFIED — no hardware` 注释，UI 上给校准 + 手性开关让用户自己拧对
- ⚠️ 所有驱动的真机行为未验证

交付时如实列出「已证 / 未证」两栏。

## 执行顺序与并行划分

用 workflow 并行推进，**按文件域切分，避免撞车**。`SoloView.tsx` 是所有人都想碰的热点文件 —— 它只由一个 agent 串行改，其他 agent 把需要的改动以 patch 描述交回。

**Wave 1（互不相干，全并行）**
- A `_lib/bluetooth/`：`gan_crypto.ts` 抽取 → `mac.ts` 参数化 → `moyu32.ts` → 陀螺仪解码（GoCube → GAN v4 → GAN v2 → MoYu32）
- B `_lib/bluetooth/timer/`：`gan_timer.ts` + `qiyi_timer.ts` + `ExternalTimerSource` 抽象（含把现有 mic Stackmat 归位）
- C `components/sim-embed/mountSimWorld.ts` 抽取 + `_lib/bluetooth/orientation.ts` + `LiveCubeGyroView.tsx`（用合成四元数驱动，先不依赖 A）
- D 通用功能低风险批：3.1 复盘外链、3.2 死设置清理、3.3 DNS、3.4 FMC（`types.ts` / `stats.ts` / `cube/*` / `ManualEntryModal` / `ReconstructModal`）
- E 对拍 harness `tests/bluetooth_parity.test.ts`（A 的验收线，可先于 A 完成写好骨架）

**Wave 2（依赖 Wave 1）**
- F `SoloView.tsx` 集中改：外接计时器入口 + Stackmat 桌面可达 + 3D 小窗接线 + 实时 TPS + 连接状态 toast + 打乱校验 + 轮次模拟面板
- G `_lib/settings/` + `SettingsPanel.tsx` 集中改：`liveCubeView` / `keymap` / `roundMode` / 删死设置
- H 3.5 自定义快捷键（必须在 F 之后，同一段 keydown 逻辑）
- I 3.7 MBLD、3.8 项目统一
- J `BluetoothModal.tsx` 文案与设备表、`credits_data.json` 鸣谢

**Wave 3**
- typecheck + 全量 test + Playwright 走查 + commit（分批 commit，每批只 add 自己的文件）

### 先做的两件「排雷」

1. 拿一份真实 csTimer 导出验 `import_cstimer.ts` 的元组顺序（见 3.3 的 ⚠️）—— 是 bug 就先修，否则 DNS/MBLD 全压在坏地基上
2. 先跑通 `tests/bluetooth_parity.test.ts` 的最小骨架（拿现有 `gan_v2` 或 `qiyi` 对拍一次），**证明「无硬件验证」这条路真的成立**，再往上堆 MoYu32
