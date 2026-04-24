● Plan final（已全局禁用 MCP / 浏览器自动化）。整个 plan 覆盖：

  - Phase 0.5：4 subagent 并行调研 17 个公式库站点 → 写 DESIGN.md
  - Phase 1-1.5：alg-build 包 + 矢量 SVG 配对 + ZBLL/ZBLS/1LLL 专项 algset 视图
  - Phase 2-3：SPA 页面 + AlgChip + 落地页卡片
  - Phase 4：deploy 双白名单
  - Phase 5/5.5：3 份报告 + 3 维度 review × 至少 3 轮（UI 审美由用户肉眼）
  - Phase 6：typecheck / build 0 错 + 用户肉眼验收
  - 工程实践：feature/alg branch + per-phase commit + 不 push
  - 预算：8-11h 工作量 / 1.5-3h 墙钟

● User approved Claude's plan
  ⎿  Plan saved to: C:\Users\CubeRoot\.claude\plans\wondrous-seeking-ritchie.md · /plan to edit
     Plan v3: /alg — 纯 Word 源构建魔方教程站

     Context

     用户多年积累的魔方教程/公式源文件全部在 D:\cube\CubeRoot\ 的 docx 中，按项目（3x3 / Roux /
     Mehta…）+ 子方法（CFOP / OLL / PLL…）目录组织，约 600 docx + 240 pdf + 26 xlsx。Word
     文档里文字本身就是文字（公式 R U R'… 是 Word 段落字符），公式可被 100% 提取为可复制文本。

     老 WordPress 站 https://www.cuberoot.me/blog/ 一字不动保留作为后路，不再作为内容源。新 /alg
     完全用 TypeScript / React 在 SPA 内渲染，源唯一 = docx。

     目标：建 /alg 路由，从 docx 自动生成完整教程站，公式作为可点击复制 chip，全平台/浏览器适配。

     ---
     决策矩阵（已锁定，不再问）

     ┌──────────────────────┬────────────────────────────────────────────────────────────────────┐
     │          项          │                                决策                                │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 内容唯一源           │ D:\cube\CubeRoot\*.docx                                            │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │                      │ *.pdf / *.ai / *.eps / *.xlsx / **/Images/** / **/framecount/** /  │
     │ 跳过规则             │ **/old/** / **/未发布/** / **/need translate/** / ~$* Word 锁文件  │
     │                      │ / 启发式判定为中间产物的（见下）                                   │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │                      │ 文件名 草稿|临时|test|tmp|备份|backup|copy                         │
     │ 中间产物启发判定     │ of|副本|未完成|wip|draft / 文件名以 ~ 或 _ 开头 / 同 slug 多版本中 │
     │                      │  mtime 最旧那个 / mammoth 提取后 plain text < 50 字符 —            │
     │                      │ 命中即跳过并 log                                                   │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 提取库               │ mammoth（docx → HTML + media）                                     │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │                      │ docx 已内嵌 SVG（ECMA-376 svgBlip 扩展），PNG 仅作 fallback。解    │
     │ 案例图矢量化         │ word/document.xml 找 <a:blip><asvg:svgBlip> 配对关系，HTML         │
     │                      │ 里全部用 SVG，PNG 仅留作 <img onerror> 兜底                        │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ EMF/WMF（罕见旧      │ LibreOffice headless soffice --convert-to svg；失败保留 EMF        │
     │ docx）               │ 让浏览器自己处理                                                   │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 一级分类             │ 顶层目录名（保留原中英文）                                         │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 二级分类             │ 二级目录名（如 3x3/CFOP）                                          │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 跳过目录             │ Images/（矢量源）、framecount/（已有 /frame-count 模块）           │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ Slug                 │ slugify(filename)：去 -CHS / 去版本号 / 中文 pinyin / 非字符→- /   │
     │                      │ 去重连号                                                           │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 中英配对             │ X.docx (en) + X-CHS.docx (zh) → 同 slug，详情页按 i18n 切换；缺则  │
     │                      │ fallback                                                           │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 重复处理             │ 同 slug 取 mtime 最新；旧版进 archived 不出现在列表                │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 标题                 │ docx 内第一段 H1/标题样式；fallback filename（清洗后）             │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 路由                 │ /alg（列表 + 搜索 + 分类）+ /alg/:slug（详情）                     │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ HTML 渲染            │ html-react-parser 解析 + 替换公式 chip 节点 + DOMPurify 清洗       │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 公式识别             │ 启发式正则 + 字符集 + 长度门槛；输出 <AlgChip> 组件（点击复制）    │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 案例图               │ 保留原图，不做文本化（用户已确认 OK）                              │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 排版风格             │ 响应式单栏，max-width 720px，字号 16-17px / line-height            │
     │                      │ 1.7，浅色系，跟 LandingPage 一致                                   │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 落地页卡片           │ tier='standard'，Lucide BookOpen，nameKey 'alg'                    │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ Section 名           │ en Algorithms / zh 公式教程                                        │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 搜索                 │ 本地 fuse.js：title + category + alg text                          │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 隐藏过滤             │ hidden_slugs.json 黑名单；hidden 项 catalog 标 hidden:true         │
     │                      │ 但详情仍可访问                                                     │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │                      │ 列表排序权重：CFOP Tutorial / Roux / 魔方根 / ZBLL / ZBLS / 1LLL / │
     │ 核心内容置顶         │  OLL / PLL / F2L / COLL / CMLL 优先；order: number 字段在 catalog  │
     │                      │ 控制                                                               │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │                      │ 长文教程 (CFOP Tutorial 等) 内提到 PLL/OLL/F2L/COLL 等 →           │
     │ 信息架构（避免拥挤） │ 自动加链到对应 algset 页（不内嵌全部 case），只保留概念性段落 +    │
     │                      │ 链接 → "see also"                                                  │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 关联推荐             │ 详情页底部"相关教程 / 相关公式集"4-6 条，按 category + tag overlap │
     │                      │  推                                                                │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ Build 包             │ 新建 core/packages/alg-build/                                      │
     ├──────────────────────┼────────────────────────────────────────────────────────────────────┤
     │ 部署                 │ 双 workflow 加 stats/data/alg/** 白名单                            │
     └──────────────────────┴────────────────────────────────────────────────────────────────────┘

     ---
     Phase 0 — 用户准备 ✅ 已就位

     - D:\cube\CubeRoot\ 已存在，842 个 docx/pdf
     - 不需要 WXR、不需要 .wpress、不需要 SSH

     唯一软依赖：本地装 LibreOffice（用于 EMF/WMF→SVG）。如果没装，跑 build 会跳过这一步且 log
     警告，前端 EMF 显示 broken — 推荐你装一下：
     winget install TheDocumentFoundation.LibreOffice

     ---
     Phase 0.5 — 参考站调研 + 撰写 DESIGN.md

     D:\cube\CubeRoot\CubeSites.xlsx 共 124 个 URL（已 unzip 提取）。我从中挑出 ~15-18 个公式库 /
     case database / 训练器类型的代表站，分 4 组并行 spawn Explore subagent 调研，每个 agent
     输出视觉/交互/UX 模式的紧凑总结。

     调研 batch（4 个 subagent 并行）

     Batch A — 公式数据库（核心参考）
     - speedcubedb.com（含 /analyze / /htr 子路径）
     - algdb.net （知名公式库，xlsx 没列我自己加）
     - crystalcuber.com
     - skewbdb.com
     - twoobytwoo.com

     Batch B — 公式专项训练器 / 浏览器
     - morganyeh06.github.io/zbls-trainer/（ZBLS 训练，正中目标）
     - pepkin88.me/zbll-explorer/（ZBLL 浏览，正中目标）
     - cube.rider.biz/zz.php?p=eoline
     - duplex.kirjava.xyz/

     Batch C — 单 puzzle 数据库
     - clockdb.net（Clock 公式）
     - zzmethod.com（ZZ 方法）
     - lowcubes.com/fto（FTO）
     - mycube.club/tools/sq1-d（SQ1 工具）
     - cubiclealgdbimagegen（image gen，看怎么生成 case 图）

     Batch D — 工具站 / 3D 可视化
     - huazhechen.github.io/cuber/dist/?mode=director（3D cube viewer）
     - experiments.cubing.net/cubing.js/mark3/（cubing.js 官方实验）
     - nissy.tronto.net（FMC solver）
     - fmcworkshop.com（FMC 教程）

     每个 subagent 的任务模板

     ▎ "fetch 这 4-5 个 URL，每站快速浏览，按以下维度总结（每站 ≤ 80 字）：
     ▎ 1. 配色（背景 / 文字 / accent，最好 hex）
     ▎ 2. 字体 / 字号 / 行距
     ▎ 3. 布局结构（网格 / sidebar / tab）
     ▎ 4. case 图渲染方式（静态 SVG / 动态 cubing.js / 颜色矩阵）
     ▎ 5. alg 显示与复制交互
     ▎ 6. 筛选/搜索 UI
     ▎ 7. 任何让人惊艳或反人类的细节
     ▎ 输出 markdown，不超过 800 字。如某站打不开，标注'inaccessible'跳过。"

     我合并后写 DESIGN.md

     位置：core/packages/alg-build/DESIGN.md（紧靠 build 包，迁移开发者也能看到）

     内容大纲：
     1. 核心理念：实用 / 便捷 / 精美（用户原话），cuber-first
     2. 视觉系统：色板（含 hex）/ 字体栈 / 间距阶梯 / 圆角 / 阴影 / 动效
     3. 组件库：AlgChip / CaseCard / CategoryBadge / LangSwitch 等的视觉规范 + 交互态
     4. 页面模板：列表页 / 文章页 / algset 页的 wireframe (ASCII)
     5. 公式库视图详细规范：case 排序 / group 划分 / 多 alg 折叠 / 导出格式
     6. 响应式断点：≥1280 / 768-1280 / 480-768 / <480 各档行为
     7. 可访问性：WCAG AA 对比度 / 键盘导航 / aria 标签 / 触摸目标 ≥ 44px
     8. 暗色模式（V1 不实现但留 hook）的色板预备
     9. 品牌一致性：与现有 LandingPage / Recon / Battle 等模块在 token 上对齐
     10. 不要做什么（反模式）：不做 SEO 弹窗 / 不做强制注册 / 不做广告位 / 不做 OAuth 浮层

     DESIGN.md 完稿后是后续 Phase 1-5 实施的"宪法"，所有视觉/交互决策必须依据它。

     ---
     Phase 1 — Build pipeline core/packages/alg-build/

     文件结构

     core/packages/alg-build/
     ├── package.json     # deps: mammoth, fs-extra, fast-glob, pinyin-pro, jsdom, cheerio
     ├── tsconfig.json
     ├── src/
     │   ├── cli.ts                  # CLI 入口
     │   ├── walkDocx.ts             # 递归扫 src，输出 DocxFile[]
     │   ├── slugify.ts              # filename → slug (含 pinyin、去 CHS / 版本号)
     │   ├── pairCnEn.ts             # 配对 -CHS 与原版，按 slug 聚合 → SlugGroup[]
     │   ├── extractDocx.ts          # mammoth → HTML + media bytes
     │   ├── normalizeMedia.ts       # EMF/WMF → SVG（LibreOffice headless）
     │   ├── detectAlgs.ts           # HTML 后处理：识别公式段落 → <span class="alg-chip">
     │   ├── transformHtml.ts        # cheerio：cleanup、外链 target、表格包 .table-wrap
     │   ├── inferCategory.ts        # path → { category, subcategory }
     │   ├── writeCatalog.ts         # 输出 catalog.json + posts/<slug>.json + media/
     │   └── types.ts
     └── data/
         ├── manual_overrides.json   # 手工 override：{ slug → { title?, category?, hidden?,
     archived? } }
         ├── titles_zh.json          # 已知英文标题 → 中文 override
         └── hidden_slugs.json       # 黑名单（也可在 manual_overrides 里设 hidden）

     CLI

     pnpm --filter @cuberoot/alg-build build -- \
       --src D:/cube/CubeRoot \
       --out ../../../stats/data/alg \
       [--incremental]   # 只重处理 mtime 比上次新的 docx

     步骤详解

     1. 扫描 (walkDocx.ts)

     - fast-glob 模式 **/*.docx，cwd=--src
     - 排除：Images/**、framecount/**、**/~$*（Word 锁文件）、**/未发布/**、**/need translate/**
     - 对每个 docx 取 { relPath, absPath, filename, mtime, sizeBytes }

     2. 分类推断 (inferCategory.ts)

     - relPath 第一段 = category
     - 第二段（若是目录）= subcategory，否则 null
     - 原始顶层目录中文名映射（用于 zh 显示）：
       - Big → 大魔方 / Big BLD → 大魔方盲拧 / Blogs → 文章 / Hardware → 硬件
       - Megaminx → 五魔 / Misc → 杂项 / Non-WCA → 非WCA / Pretty Patterns → 花样
       - Pyraminx → 金字塔 / Skewb → 斜转 / Solves → 解法分析
       - Stats → 统计 / Theory → 理论 / Tools → 工具 / WCA Scrambles → WCA打乱
       - 魔方根 → CubeRoot方法（重要内容，特别 highlight）
       - 其他（2x2/3x3/3BLD/Roux/Mehta/CFOP/...）保留原名

     3. Slug 化 (slugify.ts)

     function slugify(filename: string): string {
       let s = filename.replace(/\.docx$/i, '');
       s = s.replace(/[-_\s]?CHS\b/i, '');     // 去 CHS 后缀
       s = s.replace(/\s*\(v?\d+(\.\d+)?\)\s*$/i, ''); // 去 (v2)/(2024) 之类
       s = s.replace(/\s*\d{6,8}$/, '');        // 去尾部 240203 这类日期
       // 中文转 pinyin（无声调，连字符分隔）
       s = pinyin(s, { toneType: 'none', separator: '-', nonZh: 'consecutive' });
       s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
       return s || 'untitled';
     }
     碰撞处理：同 slug 不同源（如 PLL.docx 在 3x3/ 和 Roux/ 都有）→ 加 category 前缀
     3x3-pll、roux-pll。

     4. 中英配对 (pairCnEn.ts)

     input:  ["3x3/PLL.docx" (mtime A), "3x3/PLL-CHS.docx" (mtime B), "3x3/PLL old.docx" (mtime C,
      older)]
     output: [{
       slug: "3x3-pll",
       category: "3x3",
       versions: {
         en: "3x3/PLL.docx",
         zh: "3x3/PLL-CHS.docx"
       },
       archived: ["3x3/PLL old.docx"],
       primaryMtime: max(A, B)
     }]
     配对规则：
     - 同目录 + filename 去 CHS 后相等 → 同 slug
     - 优先 -CHS 标 zh，无 -CHS 标 en
     - 全英文文档（如 "Lookahead Progression Framework"）只有 en；全中文文档（如 "复盘.docx"）只有
      zh
     - 同语言多版本 → mtime 最新为主，其他进 archived

     5. 提取 (extractDocx.ts) — 矢量优先

     mammoth 配置：
     - convertImage: 写到 stats/data/alg/media/<slug>/<lang>/<idx>.<ext>，HTML src 改成绝对路径
     - styleMap: 默认（H1-H4、b/i/u、ul/ol、table/tr/td、p）
     - 收集 mammoth.warnings，超阈值（>10）标 quality:'degraded'

     SVG 配对替换（关键，自研） —— mammoth 默认输出 PNG，我们后处理：
     1. unzip docx → 拿 word/document.xml + word/_rels/document.xml.rels + word/media/
     2. 解 XML 找所有 <a:blip r:embed="rId-png"> 内嵌 <asvg:svgBlip r:embed="rId-svg"/> 的关系
     3. 拿 rels 表把 rId 转成实际 media 文件路径
     4. 建立 png↔svg 配对表
     5. cheerio 扫 mammoth 输出的 <img src="...image1.png">，有配对则换成 image1.svg
     6. PNG 文件仍复制（前端 <img> 加 onerror="this.src='...png'" 作为兜底，应对老浏览器或 SVG
     损坏）

     6. 媒体规范化 (normalizeMedia.ts)

     - SVG/PNG/JPG/GIF：直接落盘
     - EMF/WMF（罕见，旧 docx 才有）：调 soffice --headless --convert-to svg，失败保留 EMF + log
     - 大图（>500KB）暂不压缩；用户教程图通常 < 100KB

     7. 公式识别 (detectAlgs.ts)

     核心启发式：
     ALG_CHARS = R U F L D B M E S r u f l d b m e s x y z 0-9 ' 2 w + space , ( ) /
     判断条件（要全部满足才算公式）：
     - 段落或 cell 文本去空白后非空
     - 100% 字符 ∈ ALG_CHARS
     - 至少包含一个 cube 字母 + 至少一个修饰符（' / 2 / w）
     - 长度 ≥ 4 字符 + ≥ 2 个 token（空格分割）
     - 排除：纯数字、纯单字母、F2L PLL 这种 < 5 字符的纯标签

     匹配后用 cheerio 把节点替换：
     <p>R U R' U' R' F R F'</p>
     ↓
     <p><span class="alg-chip" data-alg="R U R' U' R' F R F'">R U R' U' R' F R F'</span></p>
     所有决策记到 alg_detections.log，可后续用 manual_alg_overrides.json 强制 add/remove。

     8. HTML 整理 (transformHtml.ts)

     - 去除 mammoth 输出里的 class 属性
     - 表格外包 <div class="table-wrap"> 给 CSS overflow-x: auto
     - <a href="http..."> 加 target="_blank" rel="noopener noreferrer"
     - <img> 加 loading="lazy" + decoding="async"
     - 长 URL 变 <a> 自动 wrap
     - see-also 自动链接：扫文本节点匹配 cube method
     关键词（PLL/OLL/F2L/COLL/CMLL/ZBLL/ZBLS/1LLL/AOLLCP/WV/SV/EOLL/...），且当前 slug 不是该
     method → 包成 <a href="/alg/<method-slug>" data-see-also="true">PLL</a>；同段不重复加链（最多
      1 次）
     - 检测到内嵌过多公式 case（>20 个 case 节点）→ 标 recommend-link-out，下次重跑时自动生成
     see-also 替代内嵌（防"长文教程拥挤"）

     9. 写产物 (writeCatalog.ts)

     stats/data/alg/
     ├── catalog.json
     │   [{
     │     slug, title: { en?, zh? }, category, subcategory?, tags?,
     │     thumb?, mtime, hasZh, hasEn, hidden, quality, algCount
     │   }, ...]
     ├── posts/<slug>.json
     │   {
     │     slug, title: { en?, zh? }, category, subcategory?,
     │     content: { en?: html, zh?: html },
     │     algs: ["R U R'", ...],   // 唯一公式列表（用于搜索）
     │     mtime, quality
     │   }
     └── media/<slug>/{en,zh}/...

     ---
     Phase 1.5 — 公式集 (algset) 专项处理（重中之重）

     ZBLL / ZBLS / 1LLL / OLL / PLL / COLL / CMLL / WV / SV / OLLCP / EOLL / 1LLSLL 这类 docx
     不是"长文教程"，而是"case 数据库"。用户原话："ZBLL, ZBLS, 1LLL
     是非常重要的公式库，更应该好好做。" 因此用专门的 algset 视图渲染（参考 speedcubedb /
     pepkin88）。

     识别 algset

     build 时按下列规则之一即认定为 algset：
     1. 白名单匹配（最强信号）：filename 含
     ZBLL|ZBLS|1LLL|OLL|PLL|COLL|CMLL|WV|SV|VLS|VHLS|HLS|OLS|OLLCP|EOLL|EPLL|F2L|G perm|J
     perm|...（cube method 名字大全）
     2. 结构启发：mammoth 输出含表格 + 表格里有 ≥ 5 行符合 alg 字符集 + 行旁有图片 — 自动归 algset
     3. 手工 override：manual_overrides.json 里 view: 'algset' 强制

     algset 数据 schema

     普通 post 的 content.html 改为 cases[]：
     {
       "slug": "zbll",
       "view": "algset",
       "title": { "en": "ZBLL", "zh": "ZBLL" },
       "cases": [
         {
           "id": "zbll-h-1",
           "label": "H1",
           "group": "H",
           "image": "/stats/data/alg/media/zbll/cases/h1.svg",
           "algs": [
             { "alg": "R U R' U R U' R' U R U2 R'", "author": "...", "primary": true },
             { "alg": "R' U' R U' R' U R U' R' U2 R", "author": "..." }
           ],
           "notes": "html"
         }
       ],
       "groups": [{ "id": "H", "label": "H group", "count": 72 }, ...]
     }

     algset build 步骤（extractAlgset.ts）

     1. mammoth 拿到原 HTML 不直接落盘
     2. cheerio 扫每个 <table>：
       - 找含 alg 字符的 cell 列（公式列） + 含 <img> 的 cell 列（case 图列） + 含 case label 的
     cell 列（H1, U2, etc）
       - 拼成 case[] 数据
     3. 同 case 的多个 alg 收进 algs[]
     4. case label 推 group（H1-H72 → H group, Pi1-Pi72 → Pi group, ...）
     5. 案例图复制到 media/<slug>/cases/<caseId>.<ext>

     algset 详情页 (AlgsetPage.tsx)

     独立组件，不走 <AlgContent>：
     - 顶部：group filter chip 行（点击只显示该 group 的 case）
     - 搜索框：按 case label 或 alg 文本
     - Case 网格：每张卡 = case 图 (大显示) + label + 主公式 chip + "更多" (展开 alt algs)
     - 卡片点击 → 展开浮层显示全部 algs + notes + 复制全部按钮
     - 顶部还有 "导出 csTimer 格式" / "导出 cubedb 格式" 按钮（V1 实现 csTimer .alg 格式）

     algset 列表页特殊呈现

     首页列表里 algset 卡片用特殊视觉（左下角 corner badge "PUBLIC LIB" + case 数 "493
     cases"），便于扫描。

     ---
     Phase 2 — SPA 页面 core/packages/client/src/pages/alg/

     文件

     src/pages/alg/
     ├── AlgIndexPage.tsx       # /alg 列表
     ├── AlgPostPage.tsx        # /alg/:slug 详情（article 视图调度入口，根据 view 字段分发）
     ├── AlgArticleView.tsx     # 文章视图（长文教程）
     ├── AlgsetView.tsx         # 公式集视图（ZBLL/PLL 等）
     ├── CaseCard.tsx           # algset 单个 case 卡片
     ├── CaseModal.tsx          # 点击 case 展开的浮层
     ├── AlgCard.tsx            # 列表卡片
     ├── AlgChip.tsx            # 公式 chip（点击复制）
     ├── AlgContent.tsx         # 渲染 article HTML（html-react-parser + chip 替换）
     ├── alg.css                # 排版样式
     ├── algset.css             # 公式集网格样式
     ├── useAlgCatalog.ts       # fetch + 缓存 catalog.json
     └── exportFormats.ts       # csTimer / cubedb 等导出工具

     <AlgChip> 组件

     function AlgChip({ alg }: { alg: string }) {
       const [copied, setCopied] = useState(false);
       const handleClick = (e: React.MouseEvent) => {
         e.stopPropagation();
         navigator.clipboard.writeText(alg);
         setCopied(true);
         setTimeout(() => setCopied(false), 1200);
       };
       return (
         <span className="alg-chip" onClick={handleClick} title="点击复制 / Click to copy">
           <code>{alg}</code>
           {copied ? <Check size={12} aria-label="copied"/> : <Copy size={12} aria-hidden/>}
         </span>
       );
     }

     <AlgContent> 组件

     - 用 html-react-parser，replace 函数：遇到 <span class="alg-chip"> → 渲染 <AlgChip
     alg={...}/>；遇到 <table> → 包 .table-wrap（如果 build 阶段没包好兜底）
     - DOMPurify 清洗后再交给 parser

     <AlgIndexPage>

     - 顶部：搜索框（fuse.js）+ 一级分类 chip 行（点击切换）+ 二级分类下拉/折叠
     - Grid：grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))，gap 16px
     - 卡片：缩略图 16:10（首张图，无图用 category icon 占位）+ 标题（按 i18n 取 zh/en） +
     category badge
     - 空态：友好提示
     - ?show=hidden 显示 hidden 项

     <AlgPostPage>

     - useParams 拿 slug，fetch /stats/data/alg/posts/<slug>.json
     - 顶部：面包屑 公式教程 / <category> / <subcategory> / <title> + 语言切换按钮（如果有
     zh+en，否则禁用并 tooltip "no translation"）
     - <AlgContent> 渲染 content[currentLang]
     - 底部：相关 / 同分类的其他 post 链接 3-5 个

     视觉系统 / UX 设计原则

     参考 https://speedcubedb.com/（暗色 + 横向 tab + card grid）和
     https://pepkin88.me/zbll-explorer/（浅色 + 紧凑 case 网格 + 动态 cube
     state）的精华，结合本站现有浅色 LandingPage 风格：

     整体风格
     - 浅色主题为主（与现有 LandingPage 一致，未来可加暗色 toggle）
     - WCA 6 色作为 accent（白/黄/红/橙/绿/蓝），用于分类 badge、chip 高亮、悬浮反馈
     - 大量留白 + 紧凑信息密度：cuber 友好的 scanability
     - 字体：UI 用系统字体栈；公式/代码用 JetBrains Mono / Consolas
     - 圆角统一：8px (卡片) / 6px (chip) / 4px (code)

     组件设计
     - AlgChip：monospace + 浅灰 bg + 1px border + hover 加深 + click 短暂 ✓ 反馈 + 复制成功 toast
      (右下角)
     - 列表卡：缩略图（3:2 cube-friendly aspect）+ 标题（2 行截断）+ category badge（6色） +
     公式数 badge（"21 algs"）
     - 顶部分类 tab：水平 scroll，当前 active 用底部 underline + 6 色 accent
     - 详情页右上：语言切换 chip（zh/en）+ 复制全部公式按钮 + 打印按钮

     便捷性 (cuber-first 体验)
     - 列表页 ? 弹起键盘快捷键 help：/ 聚焦搜索 / Esc 清空
     - [ ] 在分类间切换
     - 详情页 c 复制当前页所有公式（一次性导出 to clipboard）
     - 公式列表项 hover 显示 cube state mini preview（如果是公认 case，比如 PLL/OLL — V1
     不实现，留 hook）
     - 移动端：底部固定 "返回列表" + 当前 category 面包屑

     精美
     - 卡片 hover：阴影 + 1px 上浮（200ms ease-out）
     - 全局 transition: 150ms ease；尊重 prefers-reduced-motion
     - 列表→详情：fade-in 100ms（避免闪屏）
     - alg chip 复制成功：背景闪一下 6 色之一（绿）

     实用
     - 详情页底部"相关教程"4-6 个同 category 的 post
     - 顶部面包屑全部可点
     - URL 友好（/alg/pll），方便分享 / 收藏 / SEO
     - <meta> description 用 post 第一段 plain text，分享时有摘要

     排版 CSS（关键）

     .alg-content 容器：
     .alg-content {
       max-width: 720px;
       margin: 0 auto;
       padding: 16px;
       font-family: system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
       font-size: 17px;
       line-height: 1.7;
       color: #1a1a1a;
     }
     .alg-content h1 { font-size: 28px; margin: 1.4em 0 0.6em; font-weight: 700; }
     .alg-content h2 { font-size: 22px; margin: 1.4em 0 0.5em; font-weight: 700; }
     .alg-content h3 { font-size: 18px; margin: 1.2em 0 0.4em; font-weight: 600; }
     .alg-content p  { margin-block: 0.8em; }
     .alg-content img { max-width: 100%; height: auto; display: block; margin: 1.2em auto; }
     .alg-content .table-wrap { overflow-x: auto; margin: 1em 0; }
     .alg-content table { border-collapse: collapse; }
     .alg-content th, .alg-content td { padding: 6px 10px; border: 1px solid #e5e5e5; }
     .alg-content a { color: #0066cc; text-decoration: underline; text-underline-offset: 2px; }
     .alg-content code, .alg-content pre {
       font-family: "JetBrains Mono", Consolas, "Courier New", monospace;
       background: #f5f5f7; padding: 0.1em 0.4em; border-radius: 4px;
     }
     .alg-content pre { padding: 12px; overflow-x: auto; }
     .alg-chip {
       display: inline-flex; align-items: center; gap: 4px;
       background: #eef1f6; border: 1px solid #d8deea;
       padding: 2px 8px; border-radius: 6px;
       font-family: "JetBrains Mono", Consolas, monospace;
       font-size: 0.95em; cursor: pointer; user-select: text;
       transition: background 0.15s;
     }
     .alg-chip:hover { background: #e3e8f1; }
     .alg-chip code { background: transparent; padding: 0; }

     @media (max-width: 600px) {
       .alg-content { font-size: 16px; padding: 12px; }
       .alg-content h1 { font-size: 24px; }
       .alg-content h2 { font-size: 20px; }
     }
     - 全平台：测试 Chrome / Firefox / Edge / Safari iOS / Android Chrome
     - 触屏 chip 点击有反馈（active 态背景再深一档）
     - 大字图省力：prefers-reduced-motion 时取消所有动画

     路由（编辑 src/App.tsx）

     const AlgIndexPage = lazy(() => import('./pages/alg/AlgIndexPage'));
     const AlgPostPage  = lazy(() => import('./pages/alg/AlgPostPage'));
     <Route path="/alg" element={...}/>
     <Route path="/alg/:slug" element={...}/>

     i18n

     src/i18n/{en,zh}.json 加 alg
     namespace（title/search/categoryAll/noResults/backToList/copyAlg/copied/noTranslation/...）。

     ---
     Phase 3 — 落地页卡片

     src/pages/LandingPage.tsx：
     - TEXTS 加 alg: { en: 'Algorithms', zh: '公式教程' }
     - CARDS 在 recon 旁边插：
     { id: 'alg', href: '/alg', internal: true, tier: 'standard', Icon: BookOpen, nameKey: 'alg'
     },
     - 14→15 张卡，看 grid 是否需要 tier 重排

     ---
     Phase 4 — Deploy 白名单

     - .github/workflows/deploy_core.yml
     - .github/workflows/deploy_mirror.yml

     加 stats/data/alg/** 路径白名单（覆盖 catalog/posts/media 全子树）。

     ---
     Phase 5 — 报告 & 你的审核

     build 跑完后我会输出三份报告：

     1. build_report.md — 总览：扫描 docx 数 / 成功 N / 跳过 N / mammoth 警告统计 / EMF 转换情况 /
      总产物大小
     2. alg_detections.log — 自动识别为 chip 的公式列表（slug + 上下文）—— 抽样找误判
     3. hidden_candidates_review.md — 我浏览 catalog 后建议 hide 的 slug +
     理由（草稿、纯目录、明显非教程）

     我贴给你逐条 confirm，写进对应 JSON 重跑 build。

     ---
     Phase 5.5 — 多轮 subagent review（3 维度并行）

     每个迭代轮次 spawn 3 个 subagent 并行（UI 审美由用户肉眼完成）：

     1. 代码质量 review（general-purpose agent）：读 alg-build/src/** + client/src/pages/alg/**
       - mammoth/cheerio/svgBlip 解析是否健壮
       - chip 识别正则 false positive/negative
       - i18n 缺漏 / null safety
       - 大 catalog 下 fuse.js 索引时机 + memo 策略
       - CSS 层面做静态 review（排版 / 配色 / 响应式断点 / 触摸目标 ≥ 44px 等）— 仅限代码层面，不启动浏览器
     2. 数据完整性 review：抽样 15 个不同类型 docx（10 普通 + 5 algset）对比原文 vs
     posts/<slug>.json：
       - 文字遗漏 / 顺序
       - 图片缺失 / 错位 / SVG/PNG 配对正确性
       - 公式识别 false pos/neg 抽样
       - 表格结构破坏
     3. ZBLL/ZBLS/1LLL/PLL/OLL 专项：case 数 vs 公认值（ZBLL=493 / OLL=57 / PLL=21 / COLL=42 /
     CMLL=42 / WV=27 / ZBLS=302）；缺漏写 manual_overrides.json

     每轮反馈写 review_round_<n>.md，处理 P0/P1 后跑下一轮。至少 3 轮直到无重大 issue。

     ---
     工程实践（贯穿所有 Phase）

     Branch 策略

     - 一开始 git checkout -b feature/alg（基于 main）
     - 所有 commit 进这个 branch
     - 不 push，最终用户审完合并

     Per-phase commit 协议

     每完成一个 phase 或一个独立可工作的功能：
     1. 跑 pnpm --filter @cuberoot/client typecheck:ci（CI 对齐）
     2. 跑 pnpm --filter @cuberoot/client build
     3. 如果新加了 alg-build：跑 pnpm --filter @cuberoot/alg-build build -- ...
     4. 全过 → git add <specific files> + git commit -m "alg: <phase 描述>"（不用 git add
     -A，按文件名加避免误带）
     5. 任一步失败 → 修，不 commit；不行就 git stash 标记问题

     失败回退

     任何 phase 出大 bug 触发回滚：
     - 优先 git revert <commit> 创建反向 commit（保留历史）
     - 极端情况 git reset --hard <prev-commit>，先确认没有 uncommitted 工作
     - 整个 branch 出问题：用户回 main git checkout main + 删 branch

     验证手段（全局禁用 MCP / 浏览器自动化，由用户肉眼完成视觉验收）

     ┌──────────────────────────────────┬──────────────────────────┬────────────────────────────┐
     │               手段               │           覆盖           │           我能做           │
     ├──────────────────────────────────┼──────────────────────────┼────────────────────────────┤
     │ typecheck:ci                     │ TS 错误                  │ ✅ Bash 跑                 │
     ├──────────────────────────────────┼──────────────────────────┼────────────────────────────┤
     │ vite build                       │ 构建错误                 │ ✅ Bash 跑                 │
     ├──────────────────────────────────┼──────────────────────────┼────────────────────────────┤
     │ WebFetch                         │ server 响应 + initial    │ ✅ 但 SPA rendered DOM     │
     │ http://localhost:5173/alg        │ HTML                     │ 拿不到                     │
     ├──────────────────────────────────┼──────────────────────────┼────────────────────────────┤
     │ 代码 review subagent             │ 逻辑/边界/性能 + 静态 CSS│ ✅                         │
     ├──────────────────────────────────┼──────────────────────────┼────────────────────────────┤
     │ 数据完整性 review subagent       │ docx → JSON 抽样对比     │ ✅                         │
     ├──────────────────────────────────┼──────────────────────────┼────────────────────────────┤
     │ 真实浏览器视觉验收 / 全平台适配  │ 是否好看 / 真实交互 /    │ ❌ 靠你肉眼               │
     │                                  │ 移动端 / Firefox / Safari│                            │
     └──────────────────────────────────┴──────────────────────────┴────────────────────────────┘

     Dev server

     - 你已开 http://localhost:5173/ — 我不另起
     - Vite HMR 会在我修代码后自动推送到你浏览器
     - 我每完成一个 visible 功能会写一句 "现在可以打开 http://localhost:5173/alg 看
     X"，你方便时刷新看一眼即可
     - 完全不要求你边看边反馈 — 你只要在 phase 间空隙瞄一眼即可

     不做的事

     - ❌ 不 push 到远程
     - ❌ 不 amend commit（每次新 commit）
     - ❌ 不 force push（即使在 feature branch）
     - ❌ 不跑 destructive 命令（rm -rf / reset --hard）除非显式必要 + 先 stash

     ---
     Phase 6 — 验证清单

     我能做的自动验证：
     1. pnpm --filter @cuberoot/alg-build build -- --src D:/cube/CubeRoot --out
     ../../../stats/data/alg — 0 error
     2. pnpm --filter @cuberoot/client typecheck (日常) → typecheck:ci (push 前) — 0 error
     3. pnpm --filter @cuberoot/client build — 0 error
     4. 检查 build_report.md 警告条数；> 阈值则修

     用户肉眼验证（我把 checklist 交给你，你按方便节奏跑）：

     在 http://localhost:5173/ 上过一遍：

     Desktop Chrome（大屏 / 1280 / 窄）
     - / 看到 Algorithms 卡，点进 /alg
     - 列表：搜索 / 分类切换 / 卡片 hover/active 三态 OK
     - 随机点 5 个 post：H1/H2/段落/图片/表格排版正常
     - 公式 chip 点击复制成功 + ✓ 反馈可见
     - 至少 1 个 algset 页（如 /alg/pll）：case 网格 + group filter + 点 case 看 alg list
     - 中英切换：有 zh+en 切换正常；单语 post 按钮置灰 + tooltip
     - 内链：/alg/... 保持 SPA；/blog/... 外链打开
     - 键盘快捷键：/ 聚焦搜索 / Esc 清空 / [ ] 切分类 / c 复制全部
     - 控制台 0 error 0 warning

     Firefox / Edge（spot check）
     - 字体渲染 / clipboard API / 动效

     移动端（Chrome DevTools 模拟 375×812 / 360×640，或真机）
     - 单栏排版 / 表格滚动 / chip 触摸 ≥44px / 极窄屏不破
     - 触摸高亮反馈

     iOS Safari / Android Chrome 真机（如方便）
     - iOS clipboard 权限（可能需要 user gesture）
     - safe-area-inset / momentum scroll
     - 输入法弹起时布局

     5. 不 commit，push 前等你 review

     ---
     待你触发

     1. 可选 装 LibreOffice（处理罕见 EMF/WMF）：winget install TheDocumentFoundation.LibreOffice
     2. 我立刻跑 Phase 0.5（参考站调研 + 写 DESIGN.md）→ Phase 1-5
     3. Phase 5.5（多轮 subagent review）和最终报告也由我自主完成
     4. 整个跑完后，才停下来交所有产物 + 三份报告 + DESIGN.md 给你 review

     期间我会用文字状态更新告诉你"现在做到 Phase X / Y%"，但不打断流程让你做决定。无中断点。

     ---
     关键文件路径

     - 路由：core/packages/client/src/App.tsx
     - 落地：core/packages/client/src/pages/LandingPage.tsx
     - i18n：core/packages/client/src/i18n/{en,zh}.json
     - 模板参考：UpcomingCompsPage.tsx / scramble_stats/ / stats-build/
     - Vite 静态托管：core/packages/client/vite.config.ts serveRepoRoot
     - 部署白名单：.github/workflows/deploy_core.yml、.github/workflows/deploy_mirror.yml

     风险登记

     - mammoth 中文 docx：有时表格嵌套样式丢失。监测 warnings 数，超阈值标 quality:'degraded'，UI
     加提示
     - EMF→SVG 失败：用户机没装 LibreOffice 跳过；后续可手补 PNG
     - chip 误识别：log 全量审 + manual override JSON
     - 碰撞 slug：自动加 category 前缀；极端情况 manual_overrides 再纠
     - docx 里链接到 cuberoot.me/blog/：保留为外链，不做 SPA rewrite（毕竟 /blog/ 仍存在）
     - 大图加载性能：lazy + async；后续如有需要可加 sharp build-time 压缩

     工作量预算与质量承诺

     用户原话："这是我 10 年来的心血，我毕生的东西。" + "6+ 小时持续工作，时间太短就是偷懒。"

     工作量分配（粗估）：
     1. Phase 0.5 调研 4 batch + 写 DESIGN.md：45-60 min
     2. Build pipeline 包搭骨架：30-45 min
     3. mammoth + chip 识别 + 媒体处理：1.5-2 h（核心逻辑 + 边界 case）
     4. algset 专项（ZBLL/ZBLS/1LLL/OLL/PLL/...）解析 + 网格视图：1.5-2 h（重中之重）
     5. SPA 页面（列表 + 文章视图 + 公式集视图）：1.5-2 h
     6. 视觉打磨 + 全平台适配：1-1.5 h
     7. 3 轮 subagent review + 修 issue：1-1.5 h
     8. 最终验证 + 报告生成：30 min

     工作内容总计 8-11 h equivalent（按人类工程师工作量估）。

     墙钟时间预期：1.5-3 小时（受 tool call latency 限制 — 几百次工具调用 ×
     5-30s/次）。期间我每完成一个 phase 用一两句文字状态更新告诉你进度，不打断你。

     Subagent 调度总览：
     - Phase 0.5：4 个并行 Explore agent（参考站调研，用 Sonnet 省配额）
     - Phase 5.5：3 个并行 review agent（代码+静态CSS / 数据 / algset）× 至少 3 轮 = 9 次
     - 实施期间辅助 spawn ~2 次（找模板组件 / 查 mammoth API 边界）
     - 总计 ~15 次 subagent 调用，分批并行 + 等结果，能管。

     质量底线：
     - 任何能可视化的内容一定要看上去很专业（不是占位级别）
     - ZBLL/ZBLS/1LLL/PLL/OLL 的 case 数要对得上公认值，缺的我自己补
     - 每个 docx 至少打开过一次，看产物是否合理（采样 + 抽检）
     - 移动端真机思维（虚拟测试）：iPhone Safari、Android Chrome
     - 任何 console error / warning 全部清理掉

     ---
     我自主决策的范围（用户授权"非常高的自由度"）

     以下不再回头问，直接按 plan 执行；做完展示成品时一起 review：
     - 视觉系统全部细节（具体配色 hex / 间距 / 动效曲线 / icon 选型）
     - HTML 结构 / class 命名 / CSS 组织方式
     - 组件粒度划分（AlgChip / AlgCard / AlgContent / 面包屑等）
     - 键盘快捷键的具体绑定
     - 错误态 / 空态 / loading 态的具体文案 + 视觉
     - "相关教程"推荐算法（同 category 取最近 4 篇即可）
     - 列表页分类排序优先级（重点 category 如 3x3 / Roux / 魔方根 在前）
     - mammoth styleMap 微调（保留某些 Word 样式 / 丢弃某些）
     - AlgChip 自动识别的边界 case 调参（误判时拿来 review）
     - i18n key 的具体命名
     - meta tag / OG image / favicon 沿用现有项目设置