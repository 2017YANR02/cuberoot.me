# /stack 后续待办

> 本目录:**虚拟魔方 Playground / Alg Player / Algs 训练 / Director 录制**
> 核心 `cuber/*` 移植自 huazhechen/cuber (MIT),渲染层重写为 `InstancedRenderer` 支持任意 N 阶。

## 当前架构(给后续 AI 的快速 onboard)

| 文件 | 角色 |
|---|---|
| `StackPage.tsx` | 顶层 React 容器,header(modes/undo/redo/scramble/reset/settings)+ 左 cube canvas + 右常驻面板 |
| `cuber/world.ts` | Three.js scene / camera / controller,cube 渲染主入口 |
| `cuber/cube.ts` | logical state(`cubelets` / `initials` Map),只创建表面 cubelet |
| `cuber/cubelet.ts` | per-cubelet state(position / colors / vector),不再持 Mesh |
| `cuber/group.ts` | (axis, layer) slice,`twist()` 启 tween,`drag()` 用于 user drag |
| `cuber/twister.ts` | `TwistNode` parser + queue,`twist(action, fast, force)` 是接力主入口 |
| `cuber/instanced.ts` | InstancedRenderer:static + moving InstancedMesh 各 4 套(frame/inner/sticker/hint) |
| `cuber/controller.ts` | mouse/touch → drag / rotate / tap callback |
| `Toucher.ts` | 鼠标 / 触摸事件分发器,带 shift / button 字段 |
| `keymap.ts` | 键盘 KEYMAP + 持久化(localStorage `stack.keymap`)+ KEYBOARD_ROWS 数据 |
| `PlayerControls.tsx` | 右侧 alg playground 面板:setup/alg AlgInput + 工具按钮 + CubeKeyboardSection |
| `SettingDrawer.tsx` | 右滑设置抽屉 + keymap modal |

**共享组件**(必须复用,不造轮子):
- `components/AlgInput` — alg 文本框,markable / autoSpace / autoResize / onCaretChange / elementRef
- `components/CubeKeyboardSection` — 虚拟键盘 toggle + CubeVirtualKeyboard
- `utils/recon_alg_utils.ts` — `cleanForPlayer` / `extractAlgFromText` / `syncPlayerToMoveCount`
- `utils/cube3.ts` — `invertAlg` / `simplifyAlg` / `mirrorAlg` / `countMoves`

## 已完成(这一轮)

- 单击转面 + 高阶魔方内层支持(cubesim 风格,U/F/R 各自映射到不同切片轴)
- 完整可自定义键盘快捷键 + 键盘 grid UI + 虚拟键盘
- 转速 setting(slider 控 `CubeGroup.frames`)
- Hint facelets(背面提示贴片,ShapeGeometry + BackSide,只显示背向相机的 3 面)
- 滚轮缩放不再 round 误差突跳
- 连按 I/J:截断前动画 + 立刻开始下一个 (twist force=true)
- 同轴并发 slice 完全独立(per-instance instance matrix 替代共享 mesh.quaternion)
- 鼠标 / 键盘快捷键 modal(从设置抽屉里弹出独立窗口,带键盘 grid + move picker + 鼠标说明)
- 左右分栏布局(桌面 50/50,移动端 < 768px 退回上下)
- alg playground:setup + alg 双输入 + cubing.js Alg parser + 工具按钮(Invert/Simplify/Mirror M/Mirror S/Clear)+ 速度 slider + caret 跟随 cube 状态

## 待办(按 ROI 排序)

### 高 ROI

#### 1. Solve Statistics + Timer
- header 现有 moves counter,**加 timer**:第一个 user move 启动,`cube.complete && moves > 0` 时停
- 实时显示 time / TPS(moves / elapsed seconds)
- solved 时 toast 升级成面板,显示 final time / avg TPS / PPS(N>3 才有意义)
- 文件:`StackPage.tsx`(state),新建 `Statistics.tsx`(显示组件)
- 验收:打乱→开始转→solve 时面板弹出,数字对得上

#### 2. Reconstruction with timestamps
- 现 `cube.history` 只存 TwistAction,**加时间戳**(ms since timer start)
- 能算 TPS 曲线 / 思考时间(长间隔 = thinking time)
- 改 `cuber/history.ts`(看 ReconSubmit 的 `Reconstruction` 类做参考)
- 验收:每个 move 带 timestamp,solved 后可 dump JSON

#### 3. Save / Load 完整状态
- 刷新就丢,要持久化
- localStorage 自动保存 cube state(stickers 排列)+ history + settings
- 可选:下载 .json 文件,粘贴恢复
- 文件:`StackPage.tsx`(auto save on unload)+ 新工具 `stackSave.ts`(JSON 序列化)
- 验收:reload 后 cube 状态保留

#### 4. Examples 预设
- 借 `D:\cube\cubing.js\src\sites\alpha.twizzle.net\edit\examples.ts`(WR / T-Perm / Sune / Notation)
- 在 PlayerControls 加 "示例" 折叠区,点击一键载入 setup + alg
- 文件:`PlayerControls.tsx`,新数据 `examples.ts`
- 验收:点 T-Perm → setup 自动设、alg 自动填、cube 显示 T-Perm 初始状态

### 中 ROI

#### 5. Guide lines toggle
- alg.cubing.net 风格:face 上画 cross / plus / box,辅助 BLD / 配色感
- InstancedRenderer 加可选 overlay line mesh(参考 cubesim `cubegraphicsobject.cpp:342-412`)
- setting 加三个 toggle
- 文件:`instanced.ts`、`SettingDrawer.tsx`

#### 6. 3D 直觉 vs cubesim 单击语义切换
- 现在 3x3 点 U center → 转 S 层(cubesim 风格,支持内层但反直觉)
- 加 setting:`clickStyle: 'cubesim' | 'face'`
- 'face' 模式:点 U sticker → 转 U layer(直觉但只能转外层)
- 文件:`StackPage.tsx`(tap callback)、`SettingDrawer.tsx`

#### 7. Move counter metric 切换
- 现 PlayerControls 右侧只有 H(leaf 数)
- 加切换 H / Q(quarter)/ S(slice)/ E(execution)
- 文件:`PlayerControls.tsx`,helper:`utils/cube3.ts` 加 metric 计数

#### 8. Expand 按钮
- `[R, U]` → `R U R' U'`(展开 commutator)
- `cubing.js Alg.expand()` 直接调
- PlayerControls 工具栏加按钮

#### 9. Move list 进度高亮
- 之前 PlayerControls 有 `.stack-player-moves` 把每个 leaf move 列出来 done / current 高亮,重写时去掉了
- 加回去,但放在 alg input 下方折叠区(挤就折)
- 文件:`PlayerControls.tsx` + `player-controls.css`

#### 10. alg 文本输入失败显示错误位置
- cubing.js `Alg` 解析失败抛 `Unexpected character at index N. Are you missing a space?`
- 现在静默 actions=[],应该显示在 UI 上让用户知道哪里错
- 文件:`PlayerControls.tsx`(catch error,加 errorMessage state)

### 低 ROI / 长期

#### 11. Supercube 模式(差异化)
- 每个 sticker 带 orientation(0-3 转角),解魔方时颜色 + 朝向都对才算
- 视觉:中心画 Pochmann bar 或方向箭头
- 文件:`instanced.ts` 改 sticker shader/UV
- 工作量大,差异化亮点

#### 12. 大 N 阶 hint 性能保护
- 现所有 N 都创建 hint mesh,N=2000 占内存翻倍
- 加 N ≤ 阈值才 alloc;或者 hint 单独 lazy init
- 文件:`instanced.ts`

#### 13. 2D Net 视图
- alg.cubing.net 的 `Show 2D view` checkbox
- 复用 `@cuberoot/visualcube` 渲染
- 文件:`StackPage.tsx`、`PlayerControls.tsx`

#### 14. Replay 视频导出
- 我们已有 `/frame-count` 用 WebCodecs,真要做 stack replay 要复用那边
- 工作量大且跟 `/director` 重叠,优先级最低

## 已知 issue / 不修

- **3x3 整体旋转 cube 朝向变了但算复原**(memory `feedback_cube_orientation_not_bug`)— 设计如此,不算 bug
- **stats-build `nemesizer.ts` 用 `@cuberoot/shared` subpath** — 已修(`shared/package.json` 加 node→dist/.js condition + CI build shared first,见 memory `feedback_shared_subpath_node_condition`、`feedback_tsc_references_ci_build`)
- **prod core-api 反复重启** — 上次会话提到 `sr-puzzlegen` 内部 ESM import 路径错(`Cannot find module .../dist/lib/algorithms/algorithm` 无扩展名),用户说已修。后续若再现,看 `reference_sr_puzzlegen` memory + `/root/core-api/node_modules/.pnpm/sr-puzzlegen@*/...`

## 上手提示(给新 AI)

1. 调用 skill `cubing-anim-alg` 前读完(alg / TwistyPlayer / AlgInput / 虚拟键盘 / sq1 特殊等)
2. `feedback_typecheck_frequency`:UI 小改不要每次 typecheck,批量收尾或 push 前再跑
3. `cubing-anim-alg` 里明令 "不要 `new TwistyPlayer({...})`",一律走 `<TwistySection>` / `<AlgPlayer>`
4. stack 的 cube 渲染是自有 `World` + huazhechen 派生 + InstancedRenderer,**不是** TwistyPlayer。alg playground 那边用 cubing.js Alg parser 解析,move 喂给 stack twister
5. 测试 4x4+ 单击内层时,记得 `world.cube.order = 4`(header 阶数输入)
6. `D:\cube\cuber`(huazhechen 原版)、`D:\cube\cubesim`(benwh1 cubesim)、`D:\cube\cubing.js`(twizzle/alg.cubing.net 源码)都已 clone,参考实现先去那里看
