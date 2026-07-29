# Smart Cube Migration — csTimer 功能对齐

csTimer 是这块的**正确基线**：它的智能魔方链路被上万人用了很多年，
行为是被验证过的。这份文档逐项列出它有什么、我们有什么、差什么、怎么补。

方法：读 csTimer 源码（`D:\cube\cstimer\src\js\`）与我们自己的源码，
不靠印象。每条都能指到 file:line。

- csTimer 侧主要文件：`hardware/bluetooth.js`（连接管理）、`timer/giiker.js`（**计时集成，最关键**）、
  `tools/bluetoothutil.js`（工具面板 + 打乱提示 + 时间戳回归）、`hardware/*.js`（各品牌驱动）
- 我们侧：`_lib/bluetooth/*`、`_shell/SoloView.tsx`、`_lib/reconstruct/*`、`_components/*`

> 一个前提差异：csTimer 的智能魔方能力**只对 3x3 开放**
> （`bluetoothutil.js:76` 判 `getCurPuzzle() != '333'` 直接 return，
> 虚拟伴随魔方硬编码 `puzzle: "cube3"`，`timer/giiker.js:24`）。
> 我们目前也是 3x3 为主，这条不算差距。

---

## 总表

标记：✅ 有 ｜ ⚠️ 部分 ｜ ❌ 无

### A. 连接

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 多品牌统一选择器（一次弹窗列出所有品牌） | ✅ `bluetooth.js:79-87` | ✅ | — | — |
| 按设备名前缀识别品牌 | ✅ `bluetooth.js:93-98` | ✅ `driver.matches()` | — | — |
| MAC 自动发现（广播厂商数据） | ✅ `waitForAdvs` | ✅ `mac.ts` + `macAdv` | — | — |
| MAC 手输兜底 + 按设备名缓存 | ✅ `giiMacMap` | ✅ `saveMac`，首个成功解码的 move 才落盘 | — | 我们更严（避免缓存错 MAC） |
| 重连（不重开选择器） | ✅ `waitUntilDeviceAvailable` | ✅ `attemptReconnect` + 次数上限 | — | — |
| 断连提示 / 重连进度提示 | ✅ toast | ✅ `onConnectionEvent` → toast（含第 N/M 次） | — | — |
| 断连时取消进行中的计时 | ✅ 合成 ESC（`timer.js:712-717`） | ❌ | **断连不打断计时** | P1：断连即 DNF 或停表并提示 |
| 电量 | ✅ 60s 轮询 | ⚠️ 连接时读一次 | 不刷新 | P2：连接后定期刷新 |
| 硬件/固件版本显示 | ✅ GAN/MoYu32 | ❌（驱动能解，UI 不显示） | 型号细节 | P2 |
| 蓝牙调试日志面板 | ✅ 1000 行环形缓冲 + 弹窗 | ❌ | 排障靠 console | P2：dev 面板（已有 `fake_cube` 顶了一部分） |
| 连接时把魔方标记为已还原 | ✅ `giiRST`（总是/询问/从不） | ✅ **更好**：读魔方自报状态，不用标记 | — | 我们不需要这个设置 |

### B. 打乱阶段

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 打乱正确性校验 | ✅ `checkScramble()` | ✅ 「打乱已就绪 / 与打乱不符」 | — | — |
| **逐步打乱提示**（已完成的变暗、当前步高亮、✓） | ✅ `scrHinter.checkState` + `scrambleToHtml`（`bluetoothutil.js:74/108`） | ❌ | **只有二元对错** | **P0**：这是智能魔方最直观的价值，新手照着拧不会错 |
| 拧错时动态换一条等价打乱 | ✅ `genState`/`genScr` → `scramble_333.genFacelet` | ❌ | 拧歪只能重来 | P0（同上，一起做） |
| 自由打乱：完成时按实际状态反推打乱记入成绩 | ✅ `markScrambled` 内 `genFacelet` + 替换打乱 | ❌ | 必须精确照拧 | P1 |
| 静止 N 秒自动预备 | ✅ `giiSD` 2/3/4/5s | ✅ `bluetoothAutoReady: 'still'` | 秒数不可调 | P2：把 2/3/4/5s 做成可选 |
| 「打乱正确即预备」 | ✅ `giiSD='s'`（默认） | ❌ | — | P1：默认应当是这个 |
| 空格手动标记打乱完成 | ✅ `giiSK` | ✅（空格即预备） | — | — |
| 抖动手势标记（U4 / (U U')2） | ✅ `giiSM` | ⚠️ `double-flick` | 手势种类不同 | P2 |
| 预备时提示音 | ✅ `giiBS` | ✅ `warmupSound()` | — | — |

### C. 计时中

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 还原瞬间自动停表 | ✅ `isGiiSolved` | ✅ 实测 0.934s 停 | — | — |
| **观察超时自动判罚**（>15s +2、>17s DNF） | ✅ `giiker.js:167-174` | ❌ | **无自动判罚** | P1：智能魔方能精确知道起手时刻 |
| ESC 中断记 DNF 并保留已录动作 | ✅ `giiker.js:310-320` | ⚠️ ESC 取消，不保留动作 | 动作丢弃 | P2 |
| **实时分阶段计时**（拧的过程中就记 cross/F2L/OLL/PLL 分段） | ✅ `getProgress` + `updateMulPhase`，方法可选 CFOP / CF+OP / CFFFFOP / CFFFFOOPP / Roux | ⚠️ **事后**算（`computeStageSegments`） | 实时性 + Roux 等方法 | P1：事后算够用，但 Roux/多方法要补 |
| 自定义「已还原」基准状态 | ✅ `giiSolved` | ❌ | 贴纸错位的魔方没法用 | P2 |
| 掉包自愈（几乎还原就当还原） | ✅ `giiAED` | ✅ **更好**：GAN v3/v4 走历史补齐，QiYi 走状态回填 | — | 我们是精确恢复，不是启发式 |

### D. 训练模式（**我们整块没有**）

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 子步自动停表（只练 OLL 就 OLL 完成即停） | ✅ `giiMode='t'` + `getStepProgress`，覆盖 coll/cmll/oll/eols/wvls/zbls/f2l/lsll2 | ❌ | 全部 | **P0** |
| **状态劫持**：不用把魔方还原就能重复练同一个 case | ✅ `hackedSolvedCubieInv`（`bluetoothutil.js:663`） | ❌ | 全部 | **P0**，这是智能魔方训练器的核心机关 |
| 连续训练：练完自动出下一题、自动预备 | ✅ `giiMode='at'` | ❌ | 全部 | P0（同上） |
| 训练时不记成绩、只推进 | ✅ 零耗时即 `scramble/next` | ❌ | — | P0（同上） |

> 我们已有 `/alg` 公式库 + SRS 记忆系统 + trainer 页面，但**没有和智能魔方打通**。
> 打通之后是「拿真魔方练 PLL，拧完自动判定、自动下一题、自动记录识别/执行时间」——
> 这是我们相对 csTimer 唯一能明显做得更好的地方（它没有公式库和 SRS）。

### E. 可视化

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 实时魔方状态图 | ✅ 2D 展开图（canvas，用户配色） | ✅ 立体图（visualcube） | **展开图** | P1：展开图更适合逐面对照实体魔方 |
| 3D 虚拟伴随魔方 | ✅ `giiVRC`：完整 3D / qCube / 只看顶层 / 看两层 | ⚠️ 3D 陀螺视图，且**公式驱动**（非任意状态） | 顶层/两层视图；任意状态 3D | P1：给 /sim 加 facelet 入口后就能做全 |
| 朝向设置（24 种） | ✅ `giiOri` | ⚠️ 校准按钮 | 固定朝向选择 | P2 |
| 回放播放器（进度条 / 0.2-5x 变速 / 单步） | ✅ `twistyreplay.js` | ✅ `PlaybackPanel` + 3D 回放 + 分享链接 | 变速档位 | P2 |

### F. 成绩数据

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 逐步动作 + 时间戳存进成绩 | ✅ `time[4] = "U@120 R'@340 ..."` | ✅ `solve.moves = [{m, ts}]` | — | — |
| 分阶段分段时间存进成绩 | ✅ `curTime[1..N]` | ✅ `solve.stageSegments`（更细：HTM/十字面/OLL/PLL case） | — | 我们更细 |
| **设备时间戳 + 时钟漂移校正** | ✅ `tsLinearFit`/`tsLinearFix`（线性回归），面板显示 slope % | ❌ **完全没读** | **只有 BLE 到达时刻** | **P0**，见下节 |
| 非蓝牙计时的成绩事后补复盘 | ✅ `reconsSolve()`：从动作缓冲里按时间窗匹配 | ❌ | 手动/键盘计时的成绩没有复盘 | P1 |
| 复盘导出 alg.cubing.net | ✅ Raw / Pretty 两个链接 | ⚠️ 有站内分享链接 | 外部工具互通 | P2 |
| 步法标注的漂亮复盘 | ✅ `getPrettyReconstruction`（每阶段加注释） | ✅ ReconstructModal 分阶段列表 | — | — |

---

## 唯一的「地基」缺口：设备时间戳

这一条单独拎出来，因为**后面所有分析指标的精度都压在它上面**。

魔方自己带时钟，move 帧里就有：

| 协议 | 时间戳位置 | 我们的现状 |
|---|---|---|
| GAN v4 | move 帧 bits 16..47，32-bit LE | `gan_v4.ts:211` 注释写着 "unused here" |
| GAN v3 | move 帧 bits 24..55，32-bit LE | `gan_v3.ts:171` 同样只有注释 |
| GAN v1/v2 | `timeOffs[]` 逐步间隔 | 没读 |
| QiYi | 帧头 bits 24..55（1.6us/tick） | 没读 |

csTimer 拿到后做两件事（`gancube.js:461-488`、`bluetoothutil.js:407-475`）：

1. `updateMoveTimes()`：`calcTs = deviceTime + deviceTimeOffset`，
   与本地时钟偏差 >2000ms 时重新对齐，防止设备时钟漂移累积；
2. `tsLinearFit()`：对最近若干步的（设备时间, 本地时间）做**线性回归**，
   既校正漂移斜率，也给「历史补齐回来、本身没有设备时间」的动作插值出时间戳。
   工具面板上的 "slope %" 就是这个回归的斜率。

我们现在用的是 `performance.now()` —— **BLE 通知的到达时刻**。
问题在于 BLE 按连接间隔成批送达，一个间隔内的几步会挤在一起到，
到达时间的抖动量级是 10-50ms。用它算 TPS 尚可，用它算
「识别用了多久 / 执行用了多久」就是拿噪声当信号。

**所以 P0 是：先上设备时间戳 + 回归校正，再做任何逐步时序分析。**
顺序反了的话，后面所有指标都建在沙子上。

---

## 优先级汇总

**P0（做智能魔方训练平台的前提）**
1. 设备时间戳 + 时钟回归校正（上面那节）
2. 逐步打乱提示（变暗/高亮/✓）+ 拧歪时换等价打乱
3. 训练模式：子步自动停表 + 状态劫持 + 连续训练循环，并接上已有的 `/alg` 公式库和 SRS

**P1**
4. 观察超时自动 +2 / DNF
5. 断连打断计时
6. 自由打乱（按实际状态反推记录）
7. 「打乱正确即预备」并设为默认
8. 实时分阶段 + Roux/ZZ 等方法识别
9. 展开图实时视图
10. 非蓝牙成绩事后补复盘

**P2**
11. 电量轮询、固件版本、调试面板、自定义还原基准、朝向选择、回放变速、alg.cubing.net 导出、ESC 保留动作、静止秒数可调、抖动手势种类

---

## 已经对齐 / 我们更强的地方（不要重做）

- 丢包恢复：我们是精确恢复（GAN 历史补齐 / QiYi 状态回填），csTimer 的 `giiAED` 是启发式兜底
- 连接时的状态基准：我们读魔方自报状态，csTimer 需要用户「标记已还原」
- 分阶段数据：我们额外有 HTM 计数、十字面、OLL/PLL 精确 case 标签
- 按 case 聚合的统计（`CfopCaseStatsPanel`）：csTimer 没有
- 复盘指标：HTM/QTM/HTPS/QTPS、首动延迟、最长停顿、停顿次数、BLD 记忆段自动检测
- 公式库 + SRS + 3D 模拟器 + WCA 真题打乱：csTimer 都没有

---

## 变更记录

- 2026-07-29：首版。Sprint 1 修好的 GAN v3/v4 状态同步、Sprint 3 修好的
  QiYi 状态采纳，均已反映在表里。
