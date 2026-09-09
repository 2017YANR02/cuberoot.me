---
name: timeline-update
description: "Use when updating /dev/architecture history, commit calendar, TIMELINE or the interactive Three.js history scroll, its video export or temporary homepage feature; cover every recorded date with bilingual facts and a unique carefully crafted 3D scene. Triggers: 时间线, 历史画卷, 日期模型, 画卷视频下载, 首页画卷推荐, 补日历, 补 timeline, /timeline-update, update commit calendar."
---

# /timeline-update — 补 /dev/architecture 日历 + 列表

同一历史的三个视图:
- 日历 → `core/packages/client/app/[lang]/dev/architecture/timeline_commits.json` (升序, 每天 1 行 `{date, zh, en}`)
- 列表 → `app/[lang]/dev/architecture/_lib/arch-data.tsx` 里 `TIMELINE` (降序 newest-first, 产品级 changelog)
- 交互画卷 → `core/packages/client/app/[lang]/dev/architecture/history/` 与 `_components/HistoryJourney.tsx`, 日期和正文复用日历与 TIMELINE

## 画卷硬要求

- 每个日期必须独立精雕主体模型、轮廓和空间构图,与当天真实内容对应;所有日期都不能重复主体场景,纯数据更新日也不例外。
- 禁止按关键词循环套用少数预制场景,改色、缩放、旋转、随机种子、地形或配饰不能冒充新模型;允许复用杆件、纸层等基础几何与已有渲染能力。
- 每日模型须有可近看的结构与细节,保持纸雕山水画风;新增日期必须显式补齐设计和模型,缺失时校验失败,不得静默退回通用模型。
- 用真实 Three.js 几何生成可交互长画卷,每日期一个点,地图文字简洁且正文完整;保留人物行走、前后移动和播放暂停,到终点停止,不得自动倒退。
- 彩虹等有固定位置的景物必须锚定地图世界坐标,不能挂在跟随人物或镜头的天气层上一起平移。
- 修改模型后检查全部日期的覆盖与几何重复,并生成逐日对照图检查轮廓、构图、细节及内容对应;唯一 ID、哈希或少量截图不能单独证明视觉不重复。
- 桌面和窄屏均验证清晰度与交互,长画卷只加载附近场景并释放离开视野的资源。
- 日期跳转后人物停在点的左侧一点;保留暂停与倍速选择,基础速度复用 `history-days.ts` 的 `HISTORY_WALK_SPEED`。
- 保留主要地貌、昼夜变化、雷电等气候和至少 30 种水陆空动物;动物须稀疏分布并运动,雨雪覆盖当前整个可见场景,水流保持细节且不得异常隆起,船只须在实页可见。
- 彩蛋复用站内真实内容入口,内部跳转使用 AppLink,支持中键和 Ctrl 点击。

## 画卷维护入口

- 每日设计与主体模型分别在 `history/history-designs-{early,middle,late}.ts`、`history/history-models-{early,middle,late}.ts`;新增日期同时补设计、模型和事实数据。
- 场景入口为 `history-scene.ts`;地貌、天气、昼夜、水流、动物、彩蛋分别维护现有 `history-landforms*`、`history-weather.ts`/`history-climate-effects.ts`、`history-lighting.ts`、`history-water.ts`、`history-fauna*`/`history-wildlife.ts`、`history-secrets.ts`。
- 视频界面在 `_components/HistoryVideoExport.tsx`,渲染在 `history/history-video.ts`;复用 `lib/canvas-video-export.ts` 与同一 Three.js 场景,导出或取消不改变当前游览位置;下载入口仅图标,保留双语 title/aria-label。
- 首页临时推荐复用 `app/[lang]/LandingClient.tsx` 的推荐位与 `HISTORY_HOME_FEATURE`,截至 `2026-09-17T00:00:00+08:00` 自动隐藏并恢复托管通知;延期只改 `endsAt`,不得覆盖后台原推荐。
- 首页预览为 `client/public/assets/history-home-v1.webp`,样式在 `app/landing.css`;使用真实画卷截图和 AppLink,不在首页加载整套 Three.js,换图同步版本文件名与引用。
- 按改动运行 `client/tests/history-*.test.ts` 对应测试,改编码器加 `canvas-video-export.test.ts`;视频须实导出验收,首页须验证到期切换及桌面/窄屏入口。

## 三条铁律

1. **标准书面语 + 客观陈述**(日历 / TIMELINE 的 title·body·expand 全适用,写成产品更新公告,不是朋友圈 / 开发日志)。四类禁区:
   - **主观 / 夸张词**:史诗 / Epic / 大日 / 大改造 / 全量上线 / 喷涌 / 跃变 / 冲刺 / 密集 / 正式 / multi-event / `!`
   - **口语俏皮话**:玩出花 / 上新花样 / 一口气 / 安排上了 这类
   - **件数当卖点**:`一天六件大事` / `同天五件` / `单日七项` / `X 页两天上线` —— 标题只写做了什么,绝不写"几件";body 要列就平铺 ` + ` 串,不加"同天 N 件:"前缀
   - **开发日志口吻**:`一天打了 116 个提交` / `第二天就…` / 比提交数 —— 只讲用户能感知的产品变化
2. **有非 merge 提交的日子一律写, 不留空白日** (用户硬要求: 只要当天有提交, 日历就不能空)。纯 cron 日 (当天只有 `chore: update upcoming/wca` 之类) 也要写, 用据实一句「刷新近期比赛数据 / 中文赛名 / WCA 统计」, 这是事实不是填充废话。真有开发的日子禁泛词 (小修 / 持续迭代 / 收尾 / 微调) — 钻 diff 写具体组件
3. **每个新页面/路由上线都进 TIMELINE 列表** (LandingPage 卡片 + App.tsx 重要 sub-route 全覆盖)

> 反例 → 正例(必照此口径):
> `名次和玩出花:可以分解项目组合` → `名次和可拆分到各项目;计时器接入真实 WCA 打乱`
> `一天六件大事:英文网址去前缀、繁体全覆盖…` → `英文网址去前缀、繁体中文移除、桥式训练器上线`
> `速拧计时器正式上线,第二天一天打了 116 个提交` → `速拧计时器重写上线,随后补齐盲拧 / 蓝牙 / 3D / 观察时间`

## 工作流

1. 读 `timeline_commits.json` 最后日期 → `git log --format='%ad' --date=short --since=<LAST+1d> | sort | uniq -c` 列每个待调研日
2. 每日 `git log --format='%ai|%H|%s' --since=DAY --until=DAY --no-merges`
3. **只 SKIP 整天纯 `^Merge`** (零非 merge 提交) 的日子。cron / 构建噪音 (`chore: update upcoming/wca`, `ci: rebuild SPA`, `^backup:`, `^Update .*\.(md|html|json)$`) 不再是 SKIP 理由: 同日有真实改动→只写改动、忽略噪音; 整天只有这些→写一句据实数据/构建刷新, 仍不留空
4. **placeholder commit 必解码**: subject 是 `update` / `1` / `i18n` / 单字 → `git show --stat HASH` + `git show HASH -- <key-file>` 看实际改动。大日 (>20 commits) 里常藏整页新增, 漏掉 = entry 写错
5. 写日历 entry: 中文 1 行 + 英文 1 行, ` + ` 串多主题, 写组件名 (`/recon`, `GlobePage` 等), 中文标点, 无 emoji, 无句号收尾, 厂商身份 → "自有云服务器"。**禁子编号** (`(1)..(8)`) 和嵌套括号细节 (行数 / commit hash / 子组件清单) — 那些进 TIMELINE expand。日历一句话只列**主题词**, 哪怕一天 8 件也保持"+串"扁平。看到 entry 长得像段落 = 改
6. 审 TIMELINE: 凡新 LandingPage 卡片 / 新顶层路由 / 新重要 sub-route / 框架换栈 / 整片基础设施变更 → 都加一条。新加前先 `grep -nE "id:|href:" LandingPage.tsx` + `grep -nE "path=" App.tsx` 防漏
7. 已有 entry 太单薄 (placeholder 揭出隐藏改动) → **改写**而非追加
8. **直接写入两个文件, 不发预览等用户点头**
9. 本 Skill 保留本地交付例外:完成编辑与适用验证后交付,不主动 commit/push;用户另有明确授权时执行,不因等待提交授权暂停本地工作

## TIMELINE schema

```ts
interface TLEntry {
  date: string;  // 'YYYY-MM-DD' / 'YYYY-MM' / 'YYYY-MM-DD ~ DD'
  tag: 'migration' | 'dx' | 'feature' | 'infra';
  zh: { title: string; body: string; expand: string };
  en: { title: string; body: string; expand: string };
}
```

tag: `migration` 换栈/迁数据 · `dx` 开发流程 · `feature` 新页/新模块 · `infra` 部署/CI/SSL

新条目插数组**最前**;纯文案/数据条目更新不跑 typecheck,涉及 TS/TSX 逻辑时按根 AGENTS 执行。

## Calibration

条目数从当前数据读取,不依赖旧快照;每个有非 merge 提交的日子全覆盖,每个新页面据实补充 TIMELINE 与画卷。

## 验收

`/dev/architecture` 第 11 节:
- 日历: 新日期有日期数 + 文字
- 列表: 新条目 tag 颜色对, expand 内容对, 头部 "List · N 件重大" 数字反映新长度
