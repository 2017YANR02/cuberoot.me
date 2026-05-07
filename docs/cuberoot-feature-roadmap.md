# cuberoot.me Feature Roadmap

Status: drafted 2026-04-30 from peer-site survey + current code audit.
Audience: site author (sole maintainer). Format: prioritized, actionable.

---

## 1. Executive summary

cuberoot.me已经在两个方向上甩开同类站点：**WCA统计的深度与可视化** (`/wca-stats`, `/viz`, `/globe`, `/calendar`, `/scramble-stats`) 和 **基于视频的复盘工具** (`/frame-count`, `/recon`)。同类站点(cstimer / jperm / cubeskills / cubingapp)在这两块上要么没有要么很弱。空白主要集中在三处：

1. **P0 — BLE 智能魔方接入** (timer + recon + trainer)。这是 cstimer / cubingapp / reco.nz 都有而 cuberoot 完全没有的能力，且能直接喂养已有的 recon / 训练器，杠杆最大。
2. **P0 — Cuber 个人主页 / 关注 / 对位 (rivalries / H2H)**。WCA 数据已经全在本地，只差一层"以人为索引"的视图；wcadb 和 cubingchina 有但都做得很糙。
3. **P0 — Trainer 接 BLE + 子步骤训练 (Cross / F2L / OLL recognition-only / sub-OLL)**。当前 trainer 只覆盖识别 + 看 alg，没有 driller / 进度 / 错题本，cubeskills 和 cubingapp 有简陋版本，cuberoot 可以做得更好。

Top 3 surprises from peer research:

- **alg.cubing.net 已经把 twisty player 标准化**，自己再造没价值；该接入 `cubing.js`（依赖里已有）做 alg embed。
- **reco.nz 没有 auto-recon，没有 BLE**；它就是一个手动录入数据库 + 排序界面。这个赛道上手动+自动结合的产品几乎无人。
- **cubingchina/cubing.com** 内容极为单薄(就是 WCA 数据的中文壳 + 比赛新闻)。中文深度内容是真空地带。

---

## 2. 当前已有的独特优势

读过 `LandingPage.tsx`、`App.tsx`、`pages/` 后梳理：

- **WCA Stats 全量重写为 TS 管道** (`packages/stats-build`)，80+ 自定义 stat、StatJson schema 标准化。同类(jonatanklosko原版)是 elixir 周更，UI 单薄；cuberoot 自己渲染。
- **`/viz` 时间序列分布、`/globe` 全球地图、`/calendar` 日历堆叠** —— 三个独立维度叠在 WCA 数据上，竞品没有同等深度。
- **`/frame-count` 用 WebCodecs + mp4box.js 做帧级分析** —— 这是 reco.nz 完全没有的能力，是一个独立护城河。
- **`/scramble-stats`** 来自本地 C++ 求解器跑出的 CSV，给打乱"难度分布"建模 —— 全网没看到第二家。
- **中英双语 + 中国比赛名中文化 + 中国镜像**(cuberoot.me 备案 + ruiminyan.github.io 备线)，国内访问体验唯一。
- **WCA OAuth 已通**(`WcaAuth` 组件 + Hono server)，未来个人化功能不需要再搭一遍登录。

任何新功能必须复用以上资产，不要平起一个新栈。

---

## 3. 推荐功能

### A. Training（公式与子步骤训练）

#### A1. BLE 智能魔方训练器 (智能魔方训练 / Smart Cube Trainer)
- **Description**: 在现有 ZBLL / OLL / PLL trainer 基础上接入 BLE (GAN / MoYu AI) 智能魔方，自动识别 case 完成、自动算 recognition time / execution time / TPS 切分，错的 case 自动加权重新出。
- **Reference sites**: [csTimer 智能魔方支持](https://cstimer.net) (录 move sequence 但训练流程少)、[cubingapp.com](https://cubingapp.com)（有简单 BLE drill）、[reco.nz](https://reco.nz) 的 TPS / move count 展示。
- **Implementation sketch**: BLE 协议参考 `D:\cube\cstimer` 源码（gan356 / gancube / moyu）；在 `packages/client/src/utils/ble/` 建立连接层；trainer 页面注入 `useBleCube()` hook，监听 move stream，比对目标 alg。能直接喂 `/recon` 自动复盘。
- **Priority**: P0
- **Effort**: L (BLE 协议碎片化，多型号；首版只支持一两款)

#### A2. 子步骤识别训练器 (子步骤识别 / Sub-step Recognition)
- **Description**: 拆开 recognition 和 execution，只做"看打乱→报 case 名/编号"，不要求实拧。当前 trainer 是混合的。
- **Reference sites**: [CubeSkills PLL Recognition Trainer](https://cubeskills.com)、[J Perm trainers](https://jperm.net)。
- **Implementation sketch**: 复用 `CaseSelectPage` 选集 + 现有 PLL/OLL/ZBLL 数据；新增 `RecognitionOnlyPage`，只展 sticker 图、按钮选项 → 计时 + 错题本 LocalStorage。
- **Priority**: P1
- **Effort**: S

#### A3. Cross / F2L 训练器 (跨色 Cross / F2L 训练)
- **Description**: 给定打乱，要求做出指定 cross 或 F2L slot；lookahead 训练。当前没有这一层。
- **Reference sites**: [csTimer 子步骤打乱](https://cstimer.net) 有但只生成打乱不评估、[cubingapp F2L pairs](https://cubingapp.com)。
- **Implementation sketch**: 用 `cubing.js` (依赖已在) 模拟到 cross/F2L 状态，BLE 接入时可自动判定；无 BLE 时显示参考解。
- **Priority**: P1
- **Effort**: M

#### A4. 跨色训练 / Cross Color Neutrality
- **Description**: 强制随机出 cross 颜色；统计每种颜色平均时间、识别哪种颜色最弱。
- **Reference sites**: 无成熟竞品（这是数据型用户的痒点）。
- **Implementation sketch**: timer/recon 页加 "force cross color" 设置；session 数据按 cross color 分桶汇总到 `/viz`。
- **Priority**: P2
- **Effort**: S

---

### B. Analysis / Recon

#### B1. BLE 自动复盘 (BLE 自动复盘 / Auto-Recon from Smart Cube)
- **Description**: 用 BLE 录每一刀，结束后自动跑 cube-state diff → 给出 cross/F2L1-4/OLL/PLL 切分 + 每段 TPS/移动数/思考时间。
- **Reference sites**: [reco.nz](https://reco.nz)（手动）、[csTimer 多阶段分时](https://cstimer.net)。
- **Implementation sketch**: 接 A1 的 move stream；用现有 `recon_stats.ts` / `recon_utils.ts` 切分逻辑；写入 `recon_db`(已有 server)。新加 `/recon/live`。
- **Priority**: P0（依赖 A1）
- **Effort**: M（A1 完成后）

#### B2. 复盘按方法分组 (按方法聚合 / Group Recon by Method)
- **Description**: 现有 recon list 没法按 CFOP/Roux/ZZ 聚合、没法对比"同一打乱不同 solver"。
- **Reference sites**: [reco.nz](https://reco.nz) 有 method filter 但浅。
- **Implementation sketch**: ReconListPage 加 facet (method / event / cuber)；服务端 `/api/recon` 加索引。
- **Priority**: P1
- **Effort**: S

#### B3. 复盘对比模式 (复盘并排对比 / Side-by-Side Recon Diff)
- **Description**: 选两条 solve 并排播放（共享时间轴），横向对比每段。配合 frame-count 做视频版。
- **Reference sites**: 暂无站点做。
- **Implementation sketch**: ReconDetailPage 升级为可双栏；播放器复用 cubing.js TwistyPlayer。
- **Priority**: P2
- **Effort**: M

---

### C. Statistics（WCA 数据深挖）

#### C1. Cuber 个人主页 (选手主页 / Cuber Profile Pages)
- **Description**: `/cuber/:wcaId` 路由：基础信息 + PR 时间线 + 参赛地图 + Kinch + sum-of-ranks + 同期同国家排名变化。WCA 官网有但很丑、没图。
- **Reference sites**: [WCA 官方](https://www.worldcubeassociation.org/persons)、[wcadb.org](https://wcadb.org)、[cubingapp ranks](https://cubingapp.com)。
- **Implementation sketch**: 新页 `pages/cuber/CuberProfile.tsx`；数据走 stats-build 预生成 per-person JSON 或 server 实时查 PostgreSQL。复用 `<EventIcon>` `<Flag>` `displayCuberName`。
- **Priority**: P0
- **Effort**: M

#### C2. 对位与对手 (头对头 / Rivalries & H2H)
- **Description**: 输入两人 WCA ID → 同场比赛胜率、各项目对比、首次相遇日期、最近交手。
- **Reference sites**: 无成熟站点（cubingchina 没有，wcadb 浅）。
- **Implementation sketch**: 一条 SQL：`results r1 JOIN results r2 ON r1.competition_id=r2.competition_id`，按 round/event 聚合；前端 `/h2h?a=...&b=...`。
- **Priority**: P0（差异化大、SQL 简单）
- **Effort**: S

#### C3. 区域 Kinch 与 Sum-of-Ranks (区域 Kinch / Regional Kinch)
- **Description**: Kinch 排行可按 country / continent / 省份过滤；"中国男子 Kinch top 10"。
- **Reference sites**: [cubingapp Kinch ranks](https://cubingapp.com)、[wca.link](https://wca.link)。
- **Implementation sketch**: stats-build 已有 Kinch 算子；扩展 group-by 维度，写到 `stats/kinch_by_region.json`。
- **Priority**: P1
- **Effort**: S

#### C4. 首破 sub-X 排行 (首位 Sub-X / First Sub-X by Country)
- **Description**: "中国第一个 sub-7 单次"、"全球第一个 sub-5 平均"，按 event × threshold × region。
- **Reference sites**: [r/cubers](https://reddit.com/r/cubers) 经常手动统计，没站点固化。
- **Implementation sketch**: stats-build 新算子 `first_sub_x.ts`；UI 一张可筛选表。
- **Priority**: P1
- **Effort**: S

#### C5. 复出与停赛分析 (回归选手 / Comeback & Hiatus)
- **Description**: 找停赛 ≥N 月后回归还能创 PR 的选手；找退赛趋势。
- **Reference sites**: 无。
- **Implementation sketch**: 已有 streak 算子；扩展为 gap 算子。
- **Priority**: P2
- **Effort**: S

#### C6. Motion chart / Bar chart race（条形竞赛动画 / Bar Chart Race）
- **Description**: 从 1982-06-05 到今天，国家奖牌数 / 注册选手数 / 平均成绩的逐年动画。
- **Reference sites**: [Flourish](https://flourish.studio) 上常见，但 WCA 数据无人做。
- **Implementation sketch**: 复用 `/viz` D3 栈；时间锚点严格按 CLAUDE.md 默认 2003-08-22 起，但聚合包含 1982。
- **Priority**: P1
- **Effort**: M

---

### D. Competition Tools

#### D1. 赛前打乱预演 (赛前打乱预演 / Pre-Comp Scramble Drill)
- **Description**: 输入比赛 → 自动推送同 event 历史打乱风格分布、推荐练习集；倒计时。
- **Reference sites**: 无。基于 `/scramble-stats` 自然延伸。
- **Implementation sketch**: `/upcoming-comps` 卡片新加 "drill" 按钮 → 注入 timer 用真实 WCA 风格 scrambles。
- **Priority**: P2
- **Effort**: M

#### D2. 比赛结果预测 (比赛预测 / Comp Predictions)
- **Description**: 报名表 → 用每人近 12 个月成绩分布模拟 round → 给出每人晋级 / 夺冠概率。
- **Reference sites**: [cubeforecaster.com](https://cubeforecaster.com) 有但常挂。
- **Implementation sketch**: server 端 Monte Carlo；结果缓存到 JSON。
- **Priority**: P1
- **Effort**: M

#### D3. 我的赛季页 (我的赛季 / My Season Dashboard)
- **Description**: 登录 WCA 后，"接下来 90 天我有 N 场比赛、距 PR 还差 X、对手是谁"。
- **Reference sites**: 无。
- **Implementation sketch**: 复用 WcaAuth；聚合 upcoming + 个人历史。
- **Priority**: P1
- **Effort**: M

---

### E. Hardware / Smart Cube

(已并入 A1 / B1)

---

### F. Community / Social

#### F1. 关注选手 (关注 / Follow Cubers)
- **Description**: 登录后关注一组 WCA ID，首页显示他们最近 PR / 即将参赛。
- **Reference sites**: 无成熟竞品。
- **Implementation sketch**: server 加 `follows` 表；首页加 "Following" feed 区。
- **Priority**: P1
- **Effort**: S

#### F2. 周赛 / 月赛 (周赛 / Weekly Comp)
- **Description**: 类似 [speedsolving weekly](https://www.speedsolving.com/forum/forums/weekly-competition.27/) 但带 timer 集成 + 自动结算。
- **Reference sites**: speedsolving 论坛、[cubers.io](https://cubers.io)。
- **Implementation sketch**: server 出周打乱，timer 提交结果，周日结算。
- **Priority**: P2
- **Effort**: L

---

### G. Content

#### G1. Alg 浏览器 (公式浏览器 / Algorithm Browser)
- **Description**: 当前 `/alg` 是 "coming soon"。落地为：PLL/OLL/ZBLL/COLL/EOLL 全集 + alt algs + 内嵌 TwistyPlayer + 收藏。
- **Reference sites**: [alg.cubing.net](https://alg.cubing.net)、[cubedb.net](https://cubedb.net)、[J Perm](https://jperm.net)。
- **Implementation sketch**: `cubing.js` 已在依赖；shared 包已有 PLL/ZBLL/ZBLS JSON；只缺 UI。注意不要重造 twisty player。
- **Priority**: P0（landing 上已经占位但 disabled，用户最容易期待）
- **Effort**: M

#### G2. 可嵌入可视化 (Embed / Embeddable Charts)
- **Description**: `/viz/embed?stat=...` 提供 iframe，方便 r/cubers / 微信文章引用。
- **Reference sites**: [Flourish](https://flourish.studio), [Datawrapper](https://datawrapper.de)。
- **Implementation sketch**: 现有 viz 页加 `?embed=1` query → 隐藏导航 + 透明背景；CSP 允许 iframe。
- **Priority**: P2
- **Effort**: S

---

### H. Internationalization

#### H1. 中文方法名 / 公式名词典 (中文方法术语 / Chinese Method Glossary)
- **Description**: F2L=面层对、OLL=顶面定向、Pochmann=波赫曼。术语词典 + 文章页内 hover 解释。
- **Reference sites**: 无系统化。taozhe / cubingchina 不做术语层。
- **Implementation sketch**: `shared/cube_terms_zh.json`；MDX 文章中可 `<Term>OLL</Term>`。
- **Priority**: P2
- **Effort**: S

#### H2. 中国选手专题页 (中国选手专题 / China Spotlight)
- **Description**: 中国 top 100、各省排行、新晋 sub-X 名单。
- **Reference sites**: [cubingchina](https://cubing.com) 有零散数据但难导航。
- **Implementation sketch**: 复用 stats-build；前端 `/cn` 入口。
- **Priority**: P1
- **Effort**: S

---

### I. Mobile UX

#### I1. PWA / 离线 (PWA / 离线模式)
- **Description**: 训练器 + timer 离线可用；安装到手机主屏。
- **Reference sites**: [csTimer offline](https://cstimer.net), [cubingapp](https://cubingapp.com) 是原生 app。
- **Implementation sketch**: `vite-plugin-pwa`，预缓存 alg JSON / icons；stats JSON 大不预缓存。
- **Priority**: P1
- **Effort**: S

---

### J. Developer / Data

#### J1. 公开 stats JSON API (公开数据 API / Public Stats API)
- **Description**: 现有 `stats/*.json` 已是静态文件，正式声明为 API + 文档 + CORS 允许。
- **Reference sites**: 无站点这么做。
- **Implementation sketch**: 写一页 `/api-docs` 列举每个 JSON 的 schema；nginx CORS。
- **Priority**: P2
- **Effort**: S

---

## 4. Quick wins（1-3 天可做）

1. **Alg page 落地最小版**：占位换成只读 PLL grid + TwistyPlayer。
2. **Cuber profile 桩页**：`/cuber/:id` 先只渲染 PR + 比赛历史表，CN 化 + Flag + EventIcon 复用。
3. **H2H 页**：单 SQL + 表，2 天内可上。
4. **首页加 "Following" 区域**（如已登录），先列空状态。
5. **Recon list facet**：method / event / cuber 过滤。
6. **Embed 模式**：viz 加 `?embed=1` 隐导航。
7. **PWA manifest**：vite-plugin-pwa 加上，先不离线。
8. **Cross color stats**：trainer / timer 把 cross 颜色记入 LocalStorage。
9. **Region Kinch**：stats-build 加一个 group-by。
10. **First sub-X 表**：stats-build 一个新算子 + 一页表。

## 5. 不要做（成熟竞品已占领）

- **不要重写计时器**：已嵌 csTimer iframe + 有最小 `/timer`。csTimer 的 BLE / session / 多阶段是十几年的积累，重写性价比为零。
- **不要做通用 alg viewer player**：alg.cubing.net + cubing.js 是事实标准，直接 import `<TwistyPlayer>`。
- **不要做 WCA 官方数据镜像**：worldcubeassociation.org 已有；cuberoot 的价值是"用 WCA 数据做官方不做的视图"。
- **不要做视频教程站**：jperm / cubeskills / B站 已经覆盖；cuberoot 是 tools 站。
- **不要做电商 / 装备评测**：thecubicle / speedcubeshop / 淘者；不是 cuberoot 风格。
- **不要做 BLD memo trainer 全套**：ScramBLD 已经做得很好；只需链接。

## 6. References

- [csTimer](https://cstimer.net) — 事实标准计时器，BLE / 多阶段 / 子步骤打乱。已 iframe 集成。
- [alg.cubing.net](https://alg.cubing.net) — Lucas Garron 的 alg 渲染器，twisty player 标准。
- [reco.nz](https://reco.nz) — 手动复盘库，TPS / move / method 排序，无自动化。
- [cubedb.net](https://cubedb.net) — alg 探索 + 多种计数法 + 自动 critique。
- [cubingchina (cubing.com)](https://cubing.com) — 中国 WCA 比赛 / 排名门户，内容深度浅。
- [wcadb.org](https://wcadb.org) — WCA 结果浏览，UI 一般。
- [cubeskills.com](https://cubeskills.com) — Feliks 教程站，PLL recognition trainer + 视频。已陷入更新停滞。
- [jperm.net](https://jperm.net) — 教程 + alg trainer + alg sheet，无 timer。
- [cubingapp.com](https://cubingapp.com) — 现代训练 app，Kinch / sum-of-ranks / 比赛查找。
- [cubing.net](https://cubing.net) — Garron 的工具集合，twizzle / alg / scramble / FMC duel。
- [taozhe.com](https://taozhe.com) — 中国老牌门户（证书过期，访问受限）。
- [twistypuzzles.com](https://twistypuzzles.com) — 异形博物馆与论坛（403）。
- [wiki.speedsolving.com](https://wiki.speedsolving.com) — 方法 wiki（abort）。
