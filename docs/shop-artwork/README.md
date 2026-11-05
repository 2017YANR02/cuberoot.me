# 店铺图案档案

商品名称统一为 `CubeRoot + 款式名 · 魔方垫 / 鼠标垫`，英文使用对应款式名加 `Cubing & Mouse Mat`。购买页保留名称、图片与简短画面介绍；创作提示词和制作信息只保存在本档案。

| 款式 | 商品 slug | 状态 | 制作档案 |
| --- | --- | --- | --- |
| 魔方游乐城 / Cubetown | `cubetown-mat` | 用户已确认，本地店铺展示，未定价 | [魔方游乐城](cubetown.md) |
| 逐梦星图 / Dreamscape | `dreamscape-mat` | 原已确认蓝色图，本地店铺展示，未定价 | 原 SVG 在 `core/packages/client/public/images/shop/cuberoot-poster-ced7ef25.svg`；名称与介绍见 `lib/shop-designs.ts` |
| 魔方夜宴 / Nocturne | 预留 `nocturne-mat` | 待用户看稿，未加入店铺 | [魔方夜宴](nocturne.md) |
| 沉境 / Undertow | 预留 `undertow-mat` | 待用户看稿，未加入店铺 | [沉境](undertow.md) |

当前名称和描述的前台事实源是 `core/packages/client/lib/shop-designs.ts`。实际销售由后台商品维护；创建同 slug 商品后，真实商品数据优先。发布前配置实际规格、SKU、价格和库存，不从设计文件推断实物尺寸或材料。

图案文件必须是真正的 SVG；无嵌入位图、外部图片和字体依赖。交付前检查全图、2–4 倍局部及 XML 引用。Logo 保持品牌原形，只在新设计角落小面积出现。满幅画面需要主次，不能靠随机粒子和口号填空。每款改变构图、题材和配色，不只换颜色。
