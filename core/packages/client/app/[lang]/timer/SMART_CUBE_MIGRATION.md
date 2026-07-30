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
| 断连时取消进行中的计时 | ✅ 合成 ESC（`timer.js:712-717`）= 记 DNF | ⚠️ **有意不同**：不作废、不记 DNF，提示「这把不会自动停表 —— 按空格自己停」（Sprint 11） | — | 已定案：我们有重连梯(1/2/4/8/16s)能把这把救回来,而作废不可逆(想想五分钟的盲拧) |
| 电量 | ✅ 60s 轮询 | ⚠️ 连接时读一次 | 不刷新 | P2：连接后定期刷新 |
| 硬件/固件版本显示 | ✅ GAN/MoYu32 | ❌（驱动能解，UI 不显示） | 型号细节 | P2 |
| 蓝牙调试日志面板 | ✅ 1000 行环形缓冲 + 弹窗 | ❌ | 排障靠 console | P2：dev 面板（已有 `fake_cube` 顶了一部分） |
| 连接时把魔方标记为已还原 | ✅ `giiRST`（总是/询问/从不） | ✅ **更好**：读魔方自报状态，不用标记 | — | 我们不需要这个设置 |

### B. 打乱阶段

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 打乱正确性校验 | ✅ `checkScramble()` | ✅ 「打乱已就绪 / 与打乱不符」 | — | — |
| **逐步打乱提示**（已完成的变暗、当前步高亮、✓） | ✅ `scrHinter.checkState` + `scrambleToHtml`（`bluetoothutil.js:74/108`） | ✅ `_lib/bluetooth/scramble_hint.ts`（Sprint 6） | — | 已完成；半步未拧完时显示**剩余**转量，比上游更准（上游只在第一步这么做） |
| 拧错时给一条回到同一打乱的路径 | ✅ `genState`/`genScr` → `scramble_333.genFacelet` | ✅ `_lib/bluetooth/scramble_fixup.ts`（Sprint 7） | — | 已完成；求解期间又转动会从新状态重解（上游求解器同步，没这个问题） |
| 自由打乱：完成时按实际状态反推打乱记入成绩 | ✅ `markScrambled` 内 `genFacelet` + 替换打乱 | ❌ | 必须精确照拧 | P1 |
| 静止 N 秒自动预备 | ✅ `giiSD` 2/3/4/5s | ✅ `bluetoothAutoReady: 'still'` | 秒数不可调 | P2：把 2/3/4/5s 做成可选 |
| 「打乱正确即预备」 | ✅ `giiSD='s'`（默认） | ✅ `bluetoothAutoReady: 'scrambled'`，**已设为默认**（Sprint 11） | — | 已完成 |
| **预备后第一下转动即起表** | ✅ `giiker.js:166`（状态 -3/-2 收到 move 即起表） | ✅ `useTimer.startFromCube`（Sprint 11），起表时刻回拨到魔方时间戳 | — | 已完成；原先缺这条,自动预备等于死路(见 progress Sprint 11) |
| 空格手动标记打乱完成 | ✅ `giiSK` | ✅（空格即预备） | — | — |
| 抖动手势标记（U4 / (U U')2） | ✅ `giiSM` | ⚠️ `double-flick` | 手势种类不同 | P2 |
| 预备时提示音 | ✅ `giiBS` | ✅ `warmupSound()` | — | — |

### C. 计时中

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 还原瞬间自动停表 | ✅ `isGiiSolved` | ✅ 实测 0.934s 停 | — | — |
| **观察超时自动判罚**（>15s +2、>17s DNF） | ✅ `giiker.js:167-174` | ✅ `_shared/inspection.ts`（Sprint 11） | — | 已完成；限制值读设置(上游硬编码 15/17),判罚按**魔方给的起表时刻**算 |
| ESC 中断记 DNF 并保留已录动作 | ✅ `giiker.js:310-320` | ⚠️ ESC 取消，不保留动作 | 动作丢弃 | P2 |
| **实时分阶段计时**（拧的过程中就记 cross/F2L/OLL/PLL 分段） | ✅ `getProgress` + `updateMulPhase`，方法可选 CFOP / CF+OP / CFFFFOP / CFFFFOOPP / Roux | ⚠️ **事后**算（`computeStageSegments`） | 实时性 + Roux 等方法 | P1：事后算够用，但 Roux/多方法要补 |
| 自定义「已还原」基准状态 | ✅ `giiSolved` | ❌ | 贴纸错位的魔方没法用 | P2 |
| 掉包自愈（几乎还原就当还原） | ✅ `giiAED` | ✅ **更好**：GAN v3/v4 走历史补齐，QiYi 走状态回填 | — | 我们是精确恢复，不是启发式 |

### D. 训练模式（Sprint 10 已打通）

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 子步自动停表（只练 OLL 就 OLL 完成即停） | ✅ `giiMode='t'` + `getStepProgress`，覆盖 coll/cmll/oll/eols/wvls/zbls/f2l/lsll2 | ✅ `_trainer/smartcube.ts` 的 `SET_STEP`（Sprint 10），覆盖 17 个 set | — | 已完成；比上游多 `ocll`（CLS 用），且判不了的 set 明确不进表 |
| **状态劫持**：不用把魔方还原就能重复练同一个 case | ✅ `hackedSolvedCubieInv`（`bluetoothutil.js:663`） | ✅ `hijackTo`（Sprint 9）+ 每题自动重新劫持（Sprint 10） | — | 已完成 |
| 连续训练：练完自动出下一题、自动预备 | ✅ `giiMode='at'` | ✅ `useTrainerCube`（Sprint 10），带 500ms 收尾窗口 | — | 已完成；收尾窗口是上游没有的（上游不停在子步前一步，撞不到这个问题） |
| 训练时不记成绩、只推进 | ✅ 零耗时即 `scramble/next` | ✅ 由构造满足：trainer 有自己的 store，不碰 `/timer` 成绩表 | — | — |
| 训练题目来自公式库 + SRS 排序 | ❌ 上游没有公式库 | ✅ `/alg` 全部 set + 已有 SRS | — | 我们独有 |

> `/alg` 公式库 + SRS + trainer 页面与智能魔方已在 Sprint 10 打通：
> 拿真魔方练 PLL，魔方自己变成那一题，拧完自动判定、自动下一题，全程不用还原。
> 这是我们相对 csTimer 唯一能明显做得更好的地方（它没有公式库和 SRS）。
> 还差的是「识别/执行时间分离」——归 `SMART_CUBE_RESEARCH.md` 的 P0，不在本表。
>
> 一个数据侧的坑：库里的 scramble 与库里的公式**不按 AUF 配对**
> （scramble 把 case 摆在任意 AUF，F2L 家族还带任意 `y`；公式带的是某一标准摆法的 AUF）。
> 产品侧无影响（人本来就自己调 AUF），但要做「AUF 提示」会撞上。
> 另有 1/302 个 ZBLS case 的部分 scramble **开局就满足停表判据**，
> `autoStopStep` 已拦下退回手动。

### E. 可视化

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 实时魔方状态图 | ✅ 2D 展开图（canvas，用户配色） | ✅ 展开图（默认，Sprint 12）+ 立体图 + 3D 三选 | — | 已完成；展开图直调打乱预览那份 tnoodle 参照 emitter,不平行自绘 |
| 3D 虚拟伴随魔方 | ✅ `giiVRC`：完整 3D / qCube / 只看顶层 / 看两层 | ⚠️ 3D 陀螺视图，且**公式驱动**（非任意状态） | 顶层/两层视图；任意状态 3D | P1：给 /sim 加 facelet 入口后就能做全 |
| 朝向设置（24 种） | ✅ `giiOri` | ⚠️ 校准按钮 | 固定朝向选择 | P2 |
| 回放播放器（进度条 / 0.2-5x 变速 / 单步） | ✅ `twistyreplay.js` | ✅ `PlaybackPanel` + 3D 回放 + 分享链接 | 变速档位 | P2 |

### F. 成绩数据

| 功能 | cstimer 已有 | timer 已有 | 缺失 | 计划 |
|---|---|---|---|---|
| 逐步动作 + 时间戳存进成绩 | ✅ `time[4] = "U@120 R'@340 ..."` | ✅ `solve.moves = [{m, ts}]` | — | — |
| 分阶段分段时间存进成绩 | ✅ `curTime[1..N]` | ✅ `solve.stageSegments`（更细：HTM/十字面/OLL/PLL case） | — | 我们更细 |
| **设备时间戳** | ✅ 全品牌 | ✅ GAN v3/v4（Sprint 3）+ QiYi / MoYu32（Sprint 5） | GAN gen2 的 `timeOffs` | P1：见下节 |
| 设备时钟对齐（偏差 >2000ms 重锚） | ✅ `updateMoveTimes` | ✅ `MoveClock` | — | — |
| 时钟漂移回归校正 + 给补齐动作插值时间 | ✅ `tsLinearFit`/`tsLinearFix`（线性回归），面板显示 slope % | ❌ | 漂移斜率不校正；GAN 历史补齐的动作没有设备时间 | P1：见下节 |
| 非蓝牙计时的成绩事后补复盘 | ✅ `reconsSolve()`：从动作缓冲里按时间窗匹配 | ❌ | 手动/键盘计时的成绩没有复盘 | P1 |
| 复盘导出 alg.cubing.net | ✅ Raw / Pretty 两个链接 | ⚠️ 有站内分享链接 | 外部工具互通 | P2 |
| 步法标注的漂亮复盘 | ✅ `getPrettyReconstruction`（每阶段加注释） | ✅ ReconstructModal 分阶段列表 | — | — |

---

## 「地基」：设备时间戳（Sprint 3 / 5 已落地，剩两块）

这一条单独拎出来，因为**后面所有分析指标的精度都压在它上面**。
`performance.now()` 记的是 **BLE 通知的到达时刻**，而 BLE 按连接间隔
（7.5-30ms）成批送达，一个间隔内的几步会挤在一起到，抖动量级 10-50ms。
用它算 TPS 尚可，用它算「识别用了多久 / 执行用了多久」就是拿噪声当信号。

魔方自己带时钟，move 帧里就有：

| 协议 | 时间戳位置 | 我们的现状 |
|---|---|---|
| GAN v4 | move 帧 bits 16..47，32-bit LE ms | ✅ `gan_v4.ts` → `TimedMove.ts` |
| GAN v3 | move 帧 bits 24..55，32-bit LE ms | ✅ `gan_v3.ts` |
| GAN gen2 | 帧内 7 个 u16 逐步间隔（`gancube.js:580`） | ❌ **还没读**，gen2 的 move 无 ts |
| GAN gen1 | `f6val` 读出的 9 个 u16 间隔 | ❌（我们不支持 gen1 轮询协议） |
| QiYi | 帧头 msg[3..6]，1.6 tick/ms | ✅ 含历史槽逐步时间，`qiyi.ts` |
| MoYu32 | 0xA5 帧五个 u16 **增量**，需累加 | ✅ `moyu32.ts` 的 `deviceTime` |
| GoCube / Giiker | 协议里没有 | — |

csTimer 拿到后做两件事（`gancube.js:461-488`、`bluetoothutil.js:407-475`）：

1. `updateMoveTimes()`：`calcTs = deviceTime + deviceTimeOffset`，
   与本地时钟偏差 >2000ms 时重新对齐，防止设备时钟漂移累积
   —— 这块我们有，就是 `MoveClock`；
2. `tsLinearFit()`：对最近若干步的（设备时间, 本地时间）做**线性回归**，
   既校正漂移斜率，也给「历史补齐回来、本身没有设备时间」的动作插值出时间戳。
   工具面板上的 "slope %" 就是这个回归的斜率
   —— **这块我们没有**。

所以还差两块，都归 P1：

- **GAN gen2 的 `timeOffs`**：gen2 帧本身带逐步间隔，读法与 MoYu32 同构
  （u16 增量累加），补上就是全品牌覆盖；
- **回归校正**：影响两处 —— 长时间连接的漂移斜率，以及 GAN v3/v4
  历史补齐（0xD1 帧只给动作不给时间）的动作现在没有设备时间。
  QiYi 不受这条影响（它每个历史槽自带时间戳）。

---

## 优先级汇总

**P0（做智能魔方训练平台的前提）—— 已全部完成**
1. ~~设备时间戳~~ ✅ Sprint 3 / 5（GAN v3/v4 + QiYi + MoYu32）
2. ~~逐步打乱提示（变暗/高亮/✓）+ 拧歪时给回到同一打乱的路径~~ ✅ Sprint 6 / 7
3. ~~训练模式：子步自动停表 + 状态劫持 + 连续训练循环，并接上已有的 `/alg` 公式库和 SRS~~
   ✅ Sprint 8（判定引擎）/ 9（劫持）/ 10（接线 + UI）

> 迁移表的 P0 到此清空。**下一批 P0 在 `SMART_CUBE_RESEARCH.md`** —— 那份是
> 对标 XC大师 / GAN 魔方星球 / Cubeast 的平台化清单（识别与执行分离、分层复盘、
> 每阶段与最优解的差距、废动作检测），与「对齐 csTimer」是两件事。

**P1**
4. ~~观察超时自动 +2 / DNF~~ ✅ Sprint 11（`inspectionPenalty`，判罚按**起表时刻**算）
5. ~~断连打断计时~~ ✅ Sprint 11，但**故意没照抄**：改为提示「按空格自己停」而不是
   作废/记 DNF —— 我们有重连梯能救回这把，而作废不可逆（理由见 progress Sprint 11）
6. 自由打乱（按实际状态反推记录）
7. ~~「打乱正确即预备」并设为默认~~ ✅ Sprint 11。顺带补上上游有、我们**整条缺失**的
   「预备后第一下转动即起表」—— 没有它,自动预备是条死路
8. 实时分阶段 + Roux/ZZ 等方法识别
9. 展开图实时视图
10. 非蓝牙成绩事后补复盘
11. GAN gen2 的 `timeOffs` + 时钟漂移回归校正（上面那节剩的两块）

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
- 2026-07-30：D 节（训练模式）随 Sprint 8/9/10 全部落地，本表 P0 清空。
  记下两条数据侧事实：库里 scramble 与公式不按 AUF 配对；1/302 个 ZBLS case
  的部分 scramble 开局即满足停表判据。
- 2026-07-30（Sprint 11）：B/C 节补齐 —— 「预备后第一下转动即起表」原先**整条缺失**
  （自动预备因此是死路，实测会一路跑到 DNF），观察超时判罚、「打乱正确即预备」并设为默认。
  断连一条有意不照抄上游，理由记在表里。
- 2026-07-30（Sprint 12）：GAN 历史补齐动作按区间插值时间戳（原先空戳会让
  MoveClock 掉锚，伪造一次停顿）；实况小窗默认展开图（上游唯一形态），渲染器
  提到 `lib/cube-net-svg.ts` 与打乱预览共用一份 emitter。
- 2026-07-30（Sprint 13）：进入研究文档 P0（超出 csTimer 的部分）——
  `Solve` 落盘 `inspectionMs` + `device{model,name}`；识别/执行拆分按 Cubeast
  定义落地（`step_metrics.ts`，AUF 计入识别、TPS 只除执行时间），复盘 modal
  展示。顺手根因修复详情/复盘两个兄弟 modal 同 key 的 React duplicate-key bug。
- 2026-07-30（Sprint 14）：废步检测（P0-5，`error_detect.ts`）—— 状态重现
  = 净零环,重叠区间合并;复盘 modal 报「废步 N 步 · 多花 Xs」并在动作表
  标出。全行业没有的指标。
- 2026-07-30（Sprint 15）：每阶段参考解法 + 0-100 质量分（P0-4）、复盘报告
  分层（P0-3）。顺带修掉一个已上线的展示缺陷：PLL 精确识别只覆盖 288 种合法
  局面里的 85 种（表里每个 case 只登记一种摆法,而公式前 / 后各能 AUF 一次,
  前者转 U 到不了),约 70% 的 solve 看不到 PLL case 标签 —— 原自检是循环的
  所以一直没露头。现在穷举测试锁住 288/288 与 216/216。
  也修了 `packages/shared/data/oll.json` 里 OLL 29 `alg2` 的少空格 typo。

> 状态一律看 `SMART_CUBE_PROGRESS.md` 的「状态总表」,本表只描述该做什么。
