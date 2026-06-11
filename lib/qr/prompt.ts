// 卡片正面背景图「生图提示词」:通用头 + 模板正文拼成完整提示词,后台一键复制喂给外部图像 AI
// (即梦 / Midjourney / SD)。本文件不含 server 依赖,client 与 server 都能 import。

// 每条提示词都自动加在最前面的「通用头」:钉死 WCA 配色 + 竖版 1:2 + 无文字水印 + 负面词。
// 模型最常画错的就是魔方六面配色,所以这段必须每次都带。
export const PROMPT_PREAMBLE = `【魔方主体·必须准确】标准 WCA 配色三阶魔方:六面为 白 / 黄 / 红 / 橙 / 蓝 / 绿,白对黄、红对橙、蓝对绿;黑色本体,鲜艳哑光贴纸,色块间黑色缝隙清晰,方块排布工整准确、不歪不糊。
【通用】竖版构图 比例 1:2(实际 2×4cm 卡片正面),满版出血无白边,画面中下方留干净负空间用于后期叠文字,画面内不要任何文字 / logo / 水印;印刷级 8K 超清,色彩鲜明。若魔方配色画错就重抽。
【主色】品牌蓝 #2A5DF4;点缀魔方六色(红 #C41E3A 橙 #FF8A00 黄 #FFD500 绿 #009E60 蓝 #0051BA 白)。
负面词:text, words, letters, watermark, blurry, low-res, cluttered
(Midjourney 末尾加 --ar 1:2;即梦 / SD 设宽高比 1:2)`;

// 通用头 + 模板正文 → 可直接喂图像模型的完整提示词
export function assemblePrompt(body: string): string {
  return `${PROMPT_PREAMBLE}\n\n${body.trim()}`;
}

// 内置 16 个默认风格(从历史会话沉淀)。库为空时由迁移回填进 prompt_templates,
// 之后用户在后台增删改都落库,这份常量只作首次种子。
export type DefaultPromptTemplate = {
  name: string;
  category: string;
  body: string;
};

export const DEFAULT_PROMPT_TEMPLATES: DefaultPromptTemplate[] = [
  // —— 通用 6 套(偏设计,带英文版,Midjourney 友好)——
  {
    name: "科技发光感",
    category: "通用",
    body: "深蓝到品牌蓝渐变背景,一个悬浮、边缘发光的等距三阶魔方,周围细微光粒子与光束,极淡的科技网格,冷调高级质感。\nEN: futuristic tech poster, deep blue to electric blue gradient, a floating glowing isometric Rubik's cube, subtle light particles and rays, faint tech grid, premium cold cinematic lighting, clean lower negative space --ar 1:2",
  },
  {
    name: "3D 渲染质感",
    category: "通用",
    body: "C4D/OC 渲染的立体魔方,亚克力 / 玻璃光泽,柔和影棚布光,品牌蓝渐变背景,轻微景深,细腻高级。\nEN: 3D rendered glossy Rubik's cube, acrylic glass material, soft studio lighting, blue gradient backdrop, shallow depth of field, octane render, premium product shot --ar 1:2",
  },
  {
    name: "孟菲斯撞色波普",
    category: "通用",
    body: "孟菲斯设计风,大胆几何形 + 魔方撞色块(红橙黄绿蓝),平涂矢量,波普趣味,适合年轻人。\nEN: Memphis design style, bold geometric shapes and Rubik's cube color blocks, flat vector pop art, energetic youthful, vibrant --ar 1:2",
  },
  {
    name: "国潮中国风",
    category: "通用",
    body: "国潮风,魔方融合祥云与传统几何纹样,红蓝配金箔点缀,大气有东方感。\nEN: Chinese guochao style, Rubik's cube merged with auspicious cloud and traditional geometric patterns, red blue with gold foil accents, bold oriental aesthetic --ar 1:2",
  },
  {
    name: "极简高级(杂志留白)",
    category: "通用",
    body: "极简主义,大面积品牌蓝单色或柔和渐变,一个精致小魔方,大量负空间,克制高级,杂志编排感。\nEN: minimalist editorial poster, large negative space, single refined isometric cube, soft gradient, restrained premium magazine aesthetic --ar 1:2",
  },
  {
    name: "体素像素风",
    category: "通用",
    body: "体素 / 像素风立体魔方,8-bit 复古游戏感,撞色,几何趣味。\nEN: voxel pixel-art Rubik's cube, retro 8-bit game vibe, vibrant blocky colors, playful geometric --ar 1:2",
  },
  // —— 大片 5 套(影棚级,WCA 配色)——
  {
    name: "影棚光束悬浮魔方",
    category: "大片",
    body: "深黑到深蓝的影棚背景,一颗 WCA 魔方悬浮于画面中上方,边缘描上冷蓝高光;四周放射动感光束与漂浮微粒,体积光、轻微景深与镜面反射;高端、电影感、产品 key visual 质感,克制而震撼。",
  },
  {
    name: "碎裂粒子分解魔方",
    category: "大片",
    body: "一颗 WCA 魔方正在爆裂分解,小方块与彩色碎屑向四周飞散并拖出动态轨迹;暗色戏剧化背景,强逆光与边缘高光勾勒轮廓,速度感与能量感十足,粒子、烟尘、景深虚化,商业海报级。",
  },
  {
    name: "微缩魔方马赛克拼贴",
    category: "大片",
    body: "画面上半由成百上千颗微缩 WCA 魔方整齐拼贴,组成一片由六色渐变过渡的马赛克色域(可隐约拼出一个大魔方轮廓);俯视平铺、光影细腻;越往下密度越低、过渡到干净深色区域留白放文字,精致高级的拼贴艺术。",
  },
  {
    name: "六色光轨漩涡隧道",
    category: "大片",
    body: "画面中心一颗清晰锐利的 WCA 魔方,周围是由魔方六色构成的螺旋光轨 / 隧道向中心汇聚旋转,催眠般的纵深与速度感;深色背景 + 霓虹辉光、长曝光光绘质感,炫酷、未来、视觉冲击强。",
  },
  {
    name: "流彩泼墨环绕魔方",
    category: "大片",
    body: "一颗干净利落的 WCA 魔方为主角,周围是红橙黄绿蓝六色颜料 / 水墨在空中泼溅流动、丝缕飞扬环绕,东方写意 + 现代撞色;留白讲究、构图大气,墨色与彩液质感细腻,高级国潮艺术海报。(线上在用)",
  },
  // —— 场景 5 套(繁复插画 / 3D 大场景)——
  {
    name: "魔方微缩等距世界",
    category: "场景",
    body: "等距俯视的微缩城市,整座城市由魔方搭建:魔方造型的摩天楼、商店、研发实验室与图书馆,螺旋滑梯、悬浮单轨列车、待发射的小火箭、长长的自动扶梯、搬运立方体包裹的机器人;几十个卡通小人在拧魔方、比赛、逛街;高饱和撞色、干净黑色描边、海量趣味细节,欢乐繁忙的节庆气氛。(线上在用)",
  },
  {
    name: "旭日放射撞色波普海报",
    category: "场景",
    body: "暖色旭日放射光芒铺满整幅背景(橙红渐金黄),复古波普促销大片氛围;空中漂浮热气球、纸飞机与彩带,前景散落多颗 WCA 魔方和速拧小道具(计时器、润滑油、钥匙扣);扁平矢量 + 半调网点纹理,强对比、动感、喜庆热闹,冲击力拉满。",
  },
  {
    name: "节日主题氛围 3D 渲染",
    category: "场景",
    body: "电影感 3D 渲染的节日场景,一颗 WCA 魔方为绝对主角悬浮于氛围光里;主题可换(万圣节月夜墓园剪影 / 圣诞雪夜松枝与礼盒 / 春节红灯笼与烟花);暖光、薄雾、柔和长投影、浅景深,OC/C4D 精致质感,温馨梦幻、产品海报级。",
  },
  {
    name: "魔方主题乐园嘉年华",
    category: "场景",
    body: "盛大的魔方主题游乐园鸟瞰:由魔方拼成的过山车、摩天轮、旋转木马、城堡与拱门,彩旗、气球与喷泉,熙攘的卡通人群;糖果色调、明快布光、丰富细节的 3D 渲染插画,节日欢乐感拉满。",
  },
  {
    name: "赛博霓虹魔方都市夜景",
    category: "场景",
    body: "未来赛博都市雨夜,鳞次栉比的高楼由发光魔方堆叠而成,霓虹招牌、全息光带、穿梭的飞行器,湿润地面映出彩色倒影;城中央矗立一颗巨型 WCA 魔方并透出体积光;以蓝紫青为基调、六色霓虹点缀,电影级光影、超清细节,酷炫震撼。",
  },
  // —— 插画 7 套(手绘 / 版画 / 平面艺术)——
  {
    name: "水彩手绘",
    category: "插画",
    body: "水彩晕染手绘风,透明水痕与自然笔触,一颗魔方为主体,六色淡彩点染,清新文艺、通透留白。\nEN: watercolor hand-painted illustration, transparent washes and bleeds, a Rubik's cube subject, fresh artsy, airy negative space --ar 1:2",
  },
  {
    name: "低多边形几何",
    category: "插画",
    body: "Low Poly 低多边形风格,魔方与背景由三角面拼成,柔和渐变着色,简洁现代、棱面光影。\nEN: low poly geometric art, faceted triangular Rubik's cube and backdrop, gradient shading, clean modern --ar 1:2",
  },
  {
    name: "单线描线条艺术",
    category: "插画",
    body: "极简连续单线线描,在浅底或品牌蓝底上勾出魔方轮廓,优雅克制,大量留白,杂志感。\nEN: minimalist single continuous line art, elegant outline of a Rubik's cube, lots of negative space, editorial --ar 1:2",
  },
  {
    name: "童趣手绘涂鸦",
    category: "插画",
    body: "马克笔涂鸦手绘风,活泼线条 + 撞色填充,魔方拟人冒个俏皮表情,可爱有趣,适合校园与少儿。\nEN: playful marker doodle sketch, lively lines and vibrant fills, cute anthropomorphic cube, campus vibe --ar 1:2",
  },
  {
    name: "水墨国画意境",
    category: "插画",
    body: "中国水墨写意,留白与飞白笔触,淡彩点染六色,一颗魔方如山石静物般沉静,东方禅意、大气留白。",
  },
  {
    name: "浮世绘日本风",
    category: "插画",
    body: "日本浮世绘版画风,波浪云纹与粗描线条,魔方融入和风构图,复古沉稳配色,木刻肌理。\nEN: Japanese ukiyo-e woodblock print style, waves and clouds, Rubik's cube motif, retro palette, woodcut texture --ar 1:2",
  },
  {
    name: "剪纸叠层",
    category: "插画",
    body: "多层剪纸叠纸艺术,纸张层次与柔和投影,魔方与几何形分层堆叠,手工质感、撞色明快。\nEN: layered paper-cut craft art, stacked paper depth and soft shadows, geometric Rubik's cube, vibrant --ar 1:2",
  },
  // —— 质感 5 套(材质 / 工艺)——
  {
    name: "黏土定格",
    category: "质感",
    body: "黏土 / 橡皮泥定格动画质感,圆润捏制的魔方,柔软手作肌理,柔光布光,可爱治愈。\nEN: claymation stop-motion style, soft handmade clay Rubik's cube, plasticine texture, soft lighting, cute --ar 1:2",
  },
  {
    name: "液态铬金属 Y2K",
    category: "质感",
    body: "Y2K 千禧风液态铬金属,镜面流动的金属魔方,彩虹反光与高光,科幻未来、强反射质感。\nEN: Y2K liquid chrome metal, mirror-finish flowing metallic cube, iridescent reflections, futuristic --ar 1:2",
  },
  {
    name: "全息镭射",
    category: "质感",
    body: "全息镭射薄膜质感,虹彩渐变光泽,魔方泛七彩反光,梦幻未来、潮流高级。\nEN: holographic iridescent foil, rainbow gradient sheen, prismatic glowing cube, dreamy trendy --ar 1:2",
  },
  {
    name: "微距真实魔方",
    category: "质感",
    body: "真实摄影微距特写,实拍三阶魔方一角,浅景深虚化,贴纸纹理、缝隙与高光细腻真实,产品质感。\nEN: macro photography close-up of a real speedcube corner, shallow depth of field, crisp sticker texture --ar 1:2",
  },
  {
    name: "毛绒针织",
    category: "质感",
    body: "毛绒 / 针织手作质感,魔方像毛线编织的玩偶,柔软纤维细节,暖萌治愈、柔和布光。\nEN: fluffy knitted yarn craft, plush woven Rubik's cube toy, cozy fiber details, warm cute --ar 1:2",
  },
  // —— 氛围 4 套(复古 / 未来 / 宇宙 / 抽象)——
  {
    name: "蒸汽波故障",
    category: "氛围",
    body: "Vaporwave 蒸汽波 + glitch 故障艺术,网格地平线、落日、紫粉霓虹,魔方带 RGB 错位与扫描线,复古赛博。\nEN: vaporwave glitch art, retro grid horizon, sunset, pink purple neon, RGB-shifted cube, scanlines --ar 1:2",
  },
  {
    name: "合成器浪潮 80s",
    category: "氛围",
    body: "Synthwave 80 年代复古未来,霓虹日落网格、棕榈剪影、扫描线,魔方悬浮发光,怀旧炫酷。\nEN: 80s synthwave retrowave, neon sunset grid, palm silhouettes, glowing floating cube, nostalgic --ar 1:2",
  },
  {
    name: "极光星空宇宙",
    category: "氛围",
    body: "浩瀚星空与极光,魔方漂浮于深空,星云透出六色辉光、星轨流转,梦幻宏大、深邃神秘。\nEN: cosmic galaxy with aurora, Rubik's cube floating in deep space, six-color nebula glow, dreamy epic --ar 1:2",
  },
  {
    name: "抽象流体渐变",
    category: "氛围",
    body: "抽象流体渐变,品牌蓝到六色丝滑融合的色块与气泡,弥散柔光晕染,现代杂志感,主体留一颗精致小魔方。\nEN: abstract fluid gradient, smooth blobs blending brand blue into six colors, soft diffuse glow, editorial --ar 1:2",
  },
];
