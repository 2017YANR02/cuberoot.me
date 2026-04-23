# Hidden 候选 review (Phase 5)

build 跑完后我扫了 609 entry 的 catalog，挑出以下建议 hide 的 slug + 理由。
**请逐条 confirm**（✅ 同意 hide / ❌ 保留 / ✳️ 改动 title/category 而不 hide），
之后我把 confirmed 的写进 `hidden_slugs.json` 重跑一次 build 生效。

被 hidden 的 slug 仍存 `posts/<slug>.json`（详情页可访问），只是
不在列表 `/alg` 出现。`?show=hidden` 可强制看全量（我自己 review 用）。

---

## A 类：明显非教程 / 封面 / 目录 / 名片（强建议 hide）

| slug | 理由 |
|---|---|
| `cover` | 魔方根 docx 的封面页 |
| `preface` | 前言 |
| `contents` | 目录页 |
| `mo-fang-gen-contents` | 魔方根书的目录 |
| `back-cover` | 封底（在跳过列表里，已自动 empty-content 过滤） |
| `bussiness-card` | 公众号名片 |
| `cuberoot-t-shirt` | T 恤宣传材料 |
| `cuberoot-post` | 微信公众平台图文模板 |
| `cuberoot-history-1` | 个人史第一篇（非教程） |
| `cuberoot-history-2` | 个人史第二篇 |
| `cuberoot-website` | 站点维护说明（内部文档） |
| `template-feliks-zemdegs` | 文档模板 |
| `ols05-template` | OLS-* 模板 docx |
| `school-cube-record-template-thr` | 校记录模板 |
| `school-cube-record-template-nkr` | 校记录模板 |
| `contributors` | 贡献者名单（title 为空, algCount=0） |
| `order-of-yujian-song-s-doc` | 文档排序标注（非内容） |
| `mo-fang-gen-shuang-pin-tu-qi-ta-tu` | 魔方根双拼图 — 纯图像装饰 |

**小计**: 18 条

## B 类：明显是 WCA/个人记录更新，非公式教程（建议 hide 或单独分 "Records" 子类）

以下都在 `Stats` category 下，内容是各高校 / 个人 WCA 记录表。用户 docx 正常归档，
但在"公式教程"入口出现有点噪；建议要么 hide，要么未来可单独做一个 `/alg?category=records` 视图。

| slug 前缀 | 数量 | 说明 |
|---|---|---|
| `*-r` / `*-r-*`（XX 大学 Cube Record） | ~50 | 各校 cube record 表 |
| `wr-predictions` | 1 | WR 预测 |
| `2020-goals-predictions` / `2019-*` / `2018-*` | 3 | 年度目标 |
| `summary-learning-from-*` | 2 | 学习总结 |
| `red-bull-rubik-s-cube-world-cup-2019` | 1 | 比赛报告 |

**建议**: V1 暂不 hide（量大，你过一眼可能反而想保留作为"归档"）；
如果你想 hide，我批量加白名单。

## C 类：AI 噪声 / 过时文档

| slug | 理由 |
|---|---|
| `deepseek-yu-ce-san-jie-mo-fang-dan-ci-shi-jie-ji-lu-wr` | DeepSeek AI 预测文章（娱乐性，非教程） |
| `misc-17x17-wo-ai-ni` | 17x17 "我爱你" 花样（恶搞性质） |

**小计**: 2 条（可选）

## D 类：algCount=0 但可能有教程内容（不 hide，保留）

以下 algset 虽然 case 没解析出来（`(no alg found)` 占位），但
docx 有图片 + 文字说明，是教程性质内容，应保留：

- `oll-recognition` / `oll-time-attack` / `oll-skip-prediction` — OLL 辅助训练
- `easy-zbll` / `3x3-easy-zbll` / `more-1lll` / `easy-1lll` / `10-htm-1lll` — 简易公式集
- `wv` / `sv` / `3x3-sv` — WV / SV 公式（labels 全是 Case N）
- `cn-pll` / `cn-coll` / `cn-cll` / `cn-oll-full-images` — 中文版公式库
- `2x2-ols` / `ols` / `ols-c` / `ols-else` — 2x2/OLS

这些是**我的 parser 没解析出 alg 但内容确实有价值** —— 应保留。
未来改进 parseRow 启发或用户手工在 `manual_overrides.json` 给 view='article' 即可。

---

## 执行方式

请在本文件末端填 **确认删除** 的 slug 列表（每行一个）：

```
<!-- 格式:
-- CONFIRMED HIDDEN --
slug-1
slug-2
...
-->
```

我看到你填完后会把它们写进 `hidden_slugs.json`，重跑一次 build 生效。
