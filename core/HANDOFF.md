# 🔄 Trainer 迁移 Handoff 文档

> 上一轮对话结束时间：2026-03-23 04:00
> 项目位置：`D:\cube\ruiminyan.github.io\trainer\`
> 线上地址：`https://ruiminyan.github.io/app/`（GitHub Pages）
> Dev server: `pnpm --filter @cuberoot/client dev` → `http://localhost:5176/app/`

---

## 一、项目概述

将四个独立的魔方训练器迁移到统一的 React + TypeScript monorepo。

### 参考项目（源码在 `D:\cube\`）

| 项目 | 位置 | 公式集 | 训练模式 | 迁移状态 |
|------|------|--------|----------|---------|
| `bestsiteever/oll/` | D:\cube\bestsiteever\oll | OLL 57 cases | **计时器**（空格/触摸启停） | ⚠️ 基本完成，有 bug |
| `core/pll_recognition_core/` | D:\cube\trainer\pll_recognition_trainer | PLL 21 cases | **识别**（看图选答案）| ⚠️ 基本完成，有 bug |
| `core/zbll_core/` | D:\cube\trainer\zbll_trainer | ZBLL 493 cases | 计时器 + 预设集合 | ❌ 未开始 |
| `core/zbls-core/` | D:\cube\trainer\zbls-trainer | ZBLS | 简单选择+训练 | ❌ 未开始 |

### 技术栈

- **框架**: React 19 + TypeScript + Vite
- **状态管理**: Zustand
- **路由**: React Router v7
- **包管理**: pnpm monorepo（`packages/client` + `packages/shared`）
- **SVG 渲染**: `sr-puzzlegen-pll`（PLL 用 3D 魔方图），OLL 用静态 SVG 文件
- **OLL 图片**: `packages/client/public/oll_pic/1-57.svg`（从 bestsiteever 复制的 2D 顶面朝向图）

---

## 二、当前文件结构

```
core/packages/client/src/
├── App.tsx                    # 路由：/train/oll → OllTrainingPage, /train/:id → TrainingPage
├── main.tsx
├── index.css                  # 全局样式（含 on-screen keyboard、按钮、headShake 动画）
├── pages/
│   ├── HomePage.tsx           # 首页，显示 PLL/OLL 卡片入口
│   ├── CaseSelectPage.tsx     # 通用选择页，PLL 用 CubeView 缩略图，OLL 用静态 SVG
│   ├── TrainingPage.tsx       # PLL 识别训练页（看图→按键选答案→绿/红反馈）
│   ├── OllTrainingPage.tsx    # OLL 计时训练页（显示打乱→空格/触摸启停→右侧分组统计）
│   └── StatsPage.tsx          # 统计页
├── components/
│   ├── CubeView.tsx           # sr-puzzlegen-pll SVG 渲染封装
│   └── OnScreenKeyboard.tsx   # 21 个 PLL 按钮屏幕键盘
├── stores/
│   ├── sessionStore.ts        # PLL 识别训练的状态机（Paused→Playing→EvaluationDone）
│   ├── settingsStore.ts       # 设置（语言、主题等）
│   └── statsStore.ts          # 统计数据
├── utils/
│   ├── scrambleGenerator.ts   # inverseScramble, scrambleForCase, crossColor→rotation 映射
│   ├── pllHelpers.ts          # allPllKeys, keysToCases, evalResultsToNewQueue 自适应算法
│   └── adaptiveQueue.ts       # 自适应队列工具
├── hooks/
│   ├── useKeyboard.ts         # 键盘事件 hook
│   └── useTimer.ts            # 计时器 hook
└── types/
    └── sr-puzzlegen-pll.d.ts  # sr-puzzlegen-pll 类型声明

core/packages/shared/data/
├── pll.json                   # PLL 21 cases 的算法映射（Aa: {noAuf, U, U', U2}）
├── oll.json                   # OLL 57 cases（name, alg, alg2, group）
└── oll_scrambles.json         # OLL 57 cases × 20 预生成打乱序列
```

---

## 三、已知 Bug 和问题

### 🔴 PLL 识别训练页（TrainingPage.tsx）

1. **TrainingPage 仍有 OLL 相关代码残留**—— 之前尝试让它兼容 OLL，import 了 `ollMap` 和 `inverseScramble`，但 OLL 已有专用页面，这些代码应清理掉
2. **进度条显示 `!28`**（截图可见）—— `totalCases` 计算有 bug，可能是 `queue.length + results.length` 的边界问题
3. **keyboard 输入在答对/答错后需要测试**—— 两字母 PLL（如 Aa/Ab）的 pending key 缓冲机制移植自原版但未充分测试
4. **答错后的 SVG 应切换到 `cube-pll` 视图显示正确颜色**—— 目前代码里有但效果未验证

### 🔴 OLL 计时训练页（OllTrainingPage.tsx）

1. **用户反馈"bug 还很多"**—— 未来得及详细排查具体是哪些
2. **打乱序列生成可能有问题**—— `inverseScramble` + `applyRotation` 是从原版 JS 移植，需要对比验证
3. **Recap 模式未接入 UI**—— 代码里有 `recapArray.current` 但没有切换按钮
4. **选中 case 传递可能不正确**—— 从 `sessionStore.queue` 提取 OLL 编号的逻辑需要验证
5. **右侧统计面板可能溢出或样式问题**

### 🟡 CaseSelectPage

1. **OLL 的"开始识别训练"按钮文案不准确**—— OLL 是计时训练不是识别训练，应改为"开始训练"
2. **分组标题点击全选功能未实现**（原版 oll_trainer 有此功能）

### 🟡 Vite 配置

- `vite.config.ts` 有 `resolve.alias` 把 `sr-puzzlegen-pll` 指向 `dist/bundle/puzzleGen.min.js`（因为 package.json main 字段错误）
- `background-clip` CSS lint 警告未修复（severity: warning，不影响功能）

---

## 四、未完成任务

### P1（高优先级）

- [ ] **修复上述已知 bug**
- [ ] **触摸计时完整测试**（移动端 touchstart/touchend）
- [ ] **OLL Recap 模式 UI**（原版有 Train/Recap 两个按钮）
- [ ] **分组标题点击全选/取消**

### P2

- [ ] **ZBLL 493 cases 数据迁移**（from `D:\cube\trainer\zbll_trainer\src\assets\zbll_map_next.json`）
- [ ] **ZBLL 预设集合系统**（from `zbll_core/src/stores/PresetStore.js`）
- [ ] **ZBLS 数据迁移**（from `D:\cube\trainer\zbls-trainer\Classes and Data Files\`）
- [ ] **i18n 国际化**（zh/en 语言切换，框架已搭好 `i18n/` 目录）
- [ ] **深色/浅色主题切换**

### P3

- [ ] **StatsPage 完善**（目前基本框架在但功能简陋）
- [ ] **GitHub Pages 部署配置**
- [ ] **PWA 离线支持**

---

## 五、关键注意事项

### 原汁原味原则

**用户强调必须按原版完整迁移**，不能自作主张改功能。例如：
- OLL trainer 原版是计时器模式，不能套用 PLL 的识别训练 UI
- OLL 的缩略图必须是 2D 顶面朝向图（黄/灰方格），不能用 3D 魔方
- 每个训练器有自己独特的训练流程，不能强行统一

### `sr-puzzlegen-pll` 的坑

- 该 npm 包的 `package.json` 的 `main` 字段指向不存在的 `dist/lib/index.js`
- 实际 UMD bundle 在 `dist/bundle/puzzleGen.min.js`
- 必须在 `vite.config.ts` 中配置 alias，否则 Vite 找不到模块
- 没有 TypeScript 类型定义，需要用 `src/types/sr-puzzlegen-pll.d.ts` 自行声明

### 原版参考文件路径

```
PLL 识别训练核心逻辑:
  D:\cube\trainer\pll_recognition_trainer\src\stores\SessionStore.js
  D:\cube\trainer\pll_recognition_trainer\src\views\TrainerView.vue
  D:\cube\trainer\pll_recognition_trainer\src\components\OnScreenKeyboard.vue
  D:\cube\trainer\pll_recognition_trainer\src\scripts\helpers.js

OLL 计时训练核心逻辑:
  D:\cube\bestsiteever\oll\scripts\timer.js     (624 行，计时器 + 统计 + hint)
  D:\cube\bestsiteever\oll\scripts\practice.js   (42 行，模式切换 + 队列)
  D:\cube\bestsiteever\oll\scripts\algsinfo.js   (307 行，57 case 数据)
  D:\cube\bestsiteever\oll\scripts\algsmap.js    (1530 行，预生成打乱)
  D:\cube\bestsiteever\oll\scripts\selection.js   (case 选择 UI)

ZBLL（尚未迁移）:
  D:\cube\trainer\zbll_trainer\src\assets\zbll_map_next.json
  D:\cube\trainer\zbll_trainer\src\stores\PresetStore.js

ZBLS（尚未迁移）:
  D:\cube\trainer\zbls-trainer\
```

---

## 六、Git 历史

```
ea1869c feat(trainer): add OLL timer training page (ported from bestsiteever/oll)
        ← OllTrainingPage + oll_scrambles.json + 路由分离
(中间) fix(trainer): use original OLL 2D SVG thumbnails  
        ← 57 个 SVG 复制到 public/oll_pic/
(中间) feat(trainer): add OLL 57 cases + multi-algset architecture
        ← oll.json + CaseSelectPage 通用化 + HomePage OLL 入口
696ae81 feat(trainer): migrate PLL recognition training
        ← scrambleGenerator + pllHelpers + sessionStore + OnScreenKeyboard
        ← CubeView(sr-puzzlegen-pll) + TrainingPage + CaseSelectPage
b8f22fb feat(trainer): add training engine, UI pages, and styles
b918e7c feat(trainer): integrate cubing.js (later replaced)
6faa044 feat(trainer): initialize React+TS monorepo scaffold
a85b8fd feat(trainer): add backend API with MariaDB + WCA OAuth + JWT
```

---

## 七、给下一个 AI 的提示词

```
你要继续完成 D:\cube\ruiminyan.github.io\trainer\ 的魔方训练器迁移工作。

请先阅读 core/HANDOFF.md 了解项目背景、当前状态、已知bug和剩余任务。

关键规则：
1. 必须按原版项目原汁原味迁移，不能自作主张改功能或 UI 流程
2. 原版参考代码在 D:\cube\bestsiteever\oll\ 和 D:\cube\trainer\ 下
3. 每次改完必须 typecheck (pnpm --filter @cuberoot/client typecheck)
4. 每个小任务完成后 git commit
5. dev server: pnpm --filter @cuberoot/client dev

当前最紧急的工作：修复 PLL 和 OLL 训练页的已知 bug（见 HANDOFF.md 第三节）。
修完 bug 后继续 P2 任务（ZBLL 493 cases 迁移）。
```

