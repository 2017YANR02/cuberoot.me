# 沉境 · Undertow

商品名称预案：**CubeRoot 沉境 · 魔方垫 / 鼠标垫**。英文：**CubeRoot Undertow · Cubing & Mouse Mat**。预留商品 slug：`undertow-mat`。

2026-11-05 新稿，待用户看稿，尚未加入店铺。原生 SVG、预览与可复现源码保存在本机 `/Users/eula/Downloads/CubeRoot-SVG/Undertow-04/`。

## 画面描述

一枚银灰色魔方倾斜着沉入冷青色水域。左侧绯红墨流铺展开来，细丝与分岔穿过水光；右侧黑色液流掠过破碎镜面，镜中映出大小、方向各异的魔方重影。远处的微弱轮廓、上方下射的光束、细小气泡与底部暗影共同建立纵深。画面延伸到四边，Logo 只在右下角小面积出现，没有标题、编号或宣传语。

购买页短描述预案：冷青深水、绯红墨流与破镜重影，围绕一枚缓缓下沉的银灰魔方。

English summary: A silver-grey cube sinks through teal water, surrounded by crimson ink and fractured reflections.

## 保留的创作提示词

为 CubeRoot 创作一款原创 2:1 横向魔方垫 / 鼠标垫，名为「沉境 / Undertow」。参考《Skyfall》开场片头的水下失重、液态墨影、强烈明暗和镜面重影的视觉语言。画面以近黑色深青、冷青水光、银灰高光与绯红墨流组成，采用不对称、充满纵深的电影式构图。一枚倾斜的三阶魔方在中前景下沉，左侧绯红染料形成层层舒展的流动薄片、细丝和分岔，右侧黑色液流穿过大块破碎镜片；镜片中的魔方以不同大小与角度叠映，向水下深处消失。上方光束穿过水面，远处轮廓压暗，极少量透明气泡补充尺度。画面要丰富、满幅且有明确焦点，阴影保持青色层次。所有魔方使用 CubeRoot SIM 的真实几何，用原生矢量渐变表现银灰材质。Logo 保持品牌原形，只放在右下角。不要把品牌标志放在中央，不加装饰小字、编号、口号、星空或城市元素；不使用电影角色、007 标识、截图或现成镜头构图。交付真正可编辑的纯 SVG，使用路径、渐变、裁剪与复用图形，无嵌入位图、外部图片、外部字体和滤镜。

## 制作说明

- 2400 × 1200，2:1 比例；10 个命名图层。覆盖整个画布，没有白色外框。
- 三阶模型来自 `core/packages/puzzle-render-core/src/engine/nxn/cube.ts`；通过同包 `exportSimSvgSchematic` 导出矢量几何，镜面重影复用同一图形。
- 交付文件：`cuberoot-undertow-04.svg`；预览：`cuberoot-undertow-04-preview.png`；源码与重建入口：`source/design.mts`、`source/build.mjs`。
- 检查完整画面与 2 倍局部，并用 `source/verify.mjs` 检查 XML 结构、重复 ID、内部引用及无位图/字体依赖。
- 此处尺寸是设计画布，不代表实物规格；生产前根据实际尺寸设置出血、圆角和包边安全区，打样核对深色层次与墨流细线。银灰高光不代表金属油墨工艺。

## 视觉研究来源

- [Framestore：Bond Archive Collection](https://www.framestore.com/work/bond-archive-collection)：片头制作及水下视觉背景。
- [SideFX：Framestore's Skyfall](https://www.sidefx.com/community/framestore-skyfall/)：水下、液体与镜面段落的制作资料。

本款根据上述视觉语言重新构图，设计文件不包含影片素材。
