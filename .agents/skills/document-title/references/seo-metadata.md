## 页面标题 / SEO metadata

- 新路由必做两步:`lib/page-meta.ts` 加一条双语 `title`(内容页顺带 `description`)+ 该路由建 3 行 server `layout.tsx` 调 `pageMetadata('<route>')`。守卫 `tests/page-metadata-coverage.test.ts`(漏配 / key 拼错 / PAGE_META 孤儿条目都直接红;哨兵壳走该文件 ALLOWLIST 并写理由)。
- 标题里别出现第二个破折号:`metadataFromEntry` 会前缀 `CubeRoot — `(品牌在前),自己再写 ` — ` 就成了双破折号,改用冒号。
- `page.tsx` 保持 `'use client'` 不用拆 —— client page 不能 export metadata,但同目录 server `layout.tsx` 可以,metadata 向下合并。
- 禁在 `[lang]/layout.tsx` 或 metadata 里用 `headers()` 判路径(全站转 dynamic,直接撞 Vercel CPU 上限);语言一律取 `params.lang`,`tr()`/`useT()` 是 client-only 用不了。
- 一处只留一个标题源:页面已有 layout metadata 就删掉它的 `useDocumentTitle`,否则 hydration 后被客户端覆盖回旧文案。仅「服务端看不见的运行时状态」(`?event=` 分发等)才留 hook,此时路由 metadata 写通用名。
- `[param]` 路由先看 `generateStaticParams`:静态可枚举(数组来自代码)就写动态 layout 逐个发 metadata + 进 sitemap;哨兵壳(`dynamicParams=false` + 返回 `_`)服务端拿不到 param,别为它转 dynamic 渲染(唯一会撞 Vercel 配额的改动)。
- 标题用 `eventProseName` 不用 `eventDisplayName`:后者是 chip/表头的紧凑名(`Mega`/`3×3`),标题和搜索要写全名。
- 数据在 static origin 的路由(教程等)可在 `generateMetadata` 里 fetch —— 前提是该路由 `generateStaticParams` 返回空,build 期不会发请求;枚举进 sitemap 则另开 `force-dynamic` 的 `*-sitemap.xml/route.ts`(`app/sitemap.ts` 必须无网络 I/O)。
- 只在部分语言存在的内容(教程 609 篇里仅 60 篇双语):缺失语言那侧发 `noindex, follow`,sitemap 只列真实存在的语言,hreflang 只在双语条目成对出现。
- 长文页(math/regulation 等)配 `<h1>` + `components/JsonLd` 的 `Article`;禁编造 `SearchAction`/日期/评分。
- 背景与实测数据见 `docs/seo-geo-plan.md`。

