---
name: benchmark-sites
description: "Use when comparing how mainstream sites or major companies handle a UX, i18n, SEO, routing, pricing, or product pattern. Verify 6–10 relevant sites across major and adjacent products before concluding."
---

# 主流网站对标

用户问「主流网站 / 大厂 / 业界怎么做 X」时:按用途从下表挑 **6-10 个**,**逐个 WebFetch/WebSearch 实证**后给对比表 + source 链接。

## 用途 → 站点
| 用途 | 站点 |
|---|---|
| 本地化 / 多语言 / i18n | Apple、Microsoft、Google、Wikipedia(自动转换)、MDN、Netflix、Steam |
| SEO / 路由 / canonical / hreflang | Apple、MDN、Wikipedia、Stripe docs、Next.js/Vercel |
| 文档站 | MDN、Stripe、Cloudflare、Tailwind、React/Next docs |
| AI 产品(本站近邻) | OpenAI/ChatGPT、Google Gemini、Perplexity |
| 开发者工具 / SaaS(本站近邻) | GitHub、Vercel、Stripe、Linear、Notion、Figma、Supabase |
| 消费 / 媒体 | Netflix、Steam、Spotify、YouTube |

## 禁区
- 禁凭记忆下结论:站点常改版,每条都要 fetch/search 实证。
- 必跨两类:**巨头 + 本站近邻(开发者工具/SaaS/AI)**,别只列巨头。
- AI/产品站区分「界面本地化」与「模型能力」,别混为一谈。
- 站点 fetch 被 403/SPA 挡时改 WebSearch 旁证,并标注置信度。
