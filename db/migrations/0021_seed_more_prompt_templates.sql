-- 回填卡片正面背景图默认「生图提示词」模板(单一数据源:lib/qr/prompt.ts DEFAULT_PROMPT_TEMPLATES)。
-- 由 .tmp/gen-prompt-seed.ts 生成。按 name 幂等:已存在同名模板跳过,只插新增的;不覆盖后台改过的。
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '科技发光感', '通用', '深蓝到品牌蓝渐变背景,一个悬浮、边缘发光的等距三阶魔方,周围细微光粒子与光束,极淡的科技网格,冷调高级质感。
EN: futuristic tech poster, deep blue to electric blue gradient, a floating glowing isometric Rubik''s cube, subtle light particles and rays, faint tech grid, premium cold cinematic lighting, clean lower negative space --ar 1:2', 10, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '科技发光感');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '3D 渲染质感', '通用', 'C4D/OC 渲染的立体魔方,亚克力 / 玻璃光泽,柔和影棚布光,品牌蓝渐变背景,轻微景深,细腻高级。
EN: 3D rendered glossy Rubik''s cube, acrylic glass material, soft studio lighting, blue gradient backdrop, shallow depth of field, octane render, premium product shot --ar 1:2', 20, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '3D 渲染质感');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '孟菲斯撞色波普', '通用', '孟菲斯设计风,大胆几何形 + 魔方撞色块(红橙黄绿蓝),平涂矢量,波普趣味,适合年轻人。
EN: Memphis design style, bold geometric shapes and Rubik''s cube color blocks, flat vector pop art, energetic youthful, vibrant --ar 1:2', 30, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '孟菲斯撞色波普');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '国潮中国风', '通用', '国潮风,魔方融合祥云与传统几何纹样,红蓝配金箔点缀,大气有东方感。
EN: Chinese guochao style, Rubik''s cube merged with auspicious cloud and traditional geometric patterns, red blue with gold foil accents, bold oriental aesthetic --ar 1:2', 40, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '国潮中国风');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '极简高级(杂志留白)', '通用', '极简主义,大面积品牌蓝单色或柔和渐变,一个精致小魔方,大量负空间,克制高级,杂志编排感。
EN: minimalist editorial poster, large negative space, single refined isometric cube, soft gradient, restrained premium magazine aesthetic --ar 1:2', 50, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '极简高级(杂志留白)');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '体素像素风', '通用', '体素 / 像素风立体魔方,8-bit 复古游戏感,撞色,几何趣味。
EN: voxel pixel-art Rubik''s cube, retro 8-bit game vibe, vibrant blocky colors, playful geometric --ar 1:2', 60, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '体素像素风');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '影棚光束悬浮魔方', '大片', '深黑到深蓝的影棚背景,一颗 WCA 魔方悬浮于画面中上方,边缘描上冷蓝高光;四周放射动感光束与漂浮微粒,体积光、轻微景深与镜面反射;高端、电影感、产品 key visual 质感,克制而震撼。', 70, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '影棚光束悬浮魔方');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '碎裂粒子分解魔方', '大片', '一颗 WCA 魔方正在爆裂分解,小方块与彩色碎屑向四周飞散并拖出动态轨迹;暗色戏剧化背景,强逆光与边缘高光勾勒轮廓,速度感与能量感十足,粒子、烟尘、景深虚化,商业海报级。', 80, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '碎裂粒子分解魔方');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '微缩魔方马赛克拼贴', '大片', '画面上半由成百上千颗微缩 WCA 魔方整齐拼贴,组成一片由六色渐变过渡的马赛克色域(可隐约拼出一个大魔方轮廓);俯视平铺、光影细腻;越往下密度越低、过渡到干净深色区域留白放文字,精致高级的拼贴艺术。', 90, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '微缩魔方马赛克拼贴');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '六色光轨漩涡隧道', '大片', '画面中心一颗清晰锐利的 WCA 魔方,周围是由魔方六色构成的螺旋光轨 / 隧道向中心汇聚旋转,催眠般的纵深与速度感;深色背景 + 霓虹辉光、长曝光光绘质感,炫酷、未来、视觉冲击强。', 100, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '六色光轨漩涡隧道');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '流彩泼墨环绕魔方', '大片', '一颗干净利落的 WCA 魔方为主角,周围是红橙黄绿蓝六色颜料 / 水墨在空中泼溅流动、丝缕飞扬环绕,东方写意 + 现代撞色;留白讲究、构图大气,墨色与彩液质感细腻,高级国潮艺术海报。(线上在用)', 110, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '流彩泼墨环绕魔方');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '魔方微缩等距世界', '场景', '等距俯视的微缩城市,整座城市由魔方搭建:魔方造型的摩天楼、商店、研发实验室与图书馆,螺旋滑梯、悬浮单轨列车、待发射的小火箭、长长的自动扶梯、搬运立方体包裹的机器人;几十个卡通小人在拧魔方、比赛、逛街;高饱和撞色、干净黑色描边、海量趣味细节,欢乐繁忙的节庆气氛。(线上在用)', 120, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '魔方微缩等距世界');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '旭日放射撞色波普海报', '场景', '暖色旭日放射光芒铺满整幅背景(橙红渐金黄),复古波普促销大片氛围;空中漂浮热气球、纸飞机与彩带,前景散落多颗 WCA 魔方和速拧小道具(计时器、润滑油、钥匙扣);扁平矢量 + 半调网点纹理,强对比、动感、喜庆热闹,冲击力拉满。', 130, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '旭日放射撞色波普海报');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '节日主题氛围 3D 渲染', '场景', '电影感 3D 渲染的节日场景,一颗 WCA 魔方为绝对主角悬浮于氛围光里;主题可换(万圣节月夜墓园剪影 / 圣诞雪夜松枝与礼盒 / 春节红灯笼与烟花);暖光、薄雾、柔和长投影、浅景深,OC/C4D 精致质感,温馨梦幻、产品海报级。', 140, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '节日主题氛围 3D 渲染');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '魔方主题乐园嘉年华', '场景', '盛大的魔方主题游乐园鸟瞰:由魔方拼成的过山车、摩天轮、旋转木马、城堡与拱门,彩旗、气球与喷泉,熙攘的卡通人群;糖果色调、明快布光、丰富细节的 3D 渲染插画,节日欢乐感拉满。', 150, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '魔方主题乐园嘉年华');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '赛博霓虹魔方都市夜景', '场景', '未来赛博都市雨夜,鳞次栉比的高楼由发光魔方堆叠而成,霓虹招牌、全息光带、穿梭的飞行器,湿润地面映出彩色倒影;城中央矗立一颗巨型 WCA 魔方并透出体积光;以蓝紫青为基调、六色霓虹点缀,电影级光影、超清细节,酷炫震撼。', 160, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '赛博霓虹魔方都市夜景');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '水彩手绘', '插画', '水彩晕染手绘风,透明水痕与自然笔触,一颗魔方为主体,六色淡彩点染,清新文艺、通透留白。
EN: watercolor hand-painted illustration, transparent washes and bleeds, a Rubik''s cube subject, fresh artsy, airy negative space --ar 1:2', 170, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '水彩手绘');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '低多边形几何', '插画', 'Low Poly 低多边形风格,魔方与背景由三角面拼成,柔和渐变着色,简洁现代、棱面光影。
EN: low poly geometric art, faceted triangular Rubik''s cube and backdrop, gradient shading, clean modern --ar 1:2', 180, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '低多边形几何');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '单线描线条艺术', '插画', '极简连续单线线描,在浅底或品牌蓝底上勾出魔方轮廓,优雅克制,大量留白,杂志感。
EN: minimalist single continuous line art, elegant outline of a Rubik''s cube, lots of negative space, editorial --ar 1:2', 190, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '单线描线条艺术');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '童趣手绘涂鸦', '插画', '马克笔涂鸦手绘风,活泼线条 + 撞色填充,魔方拟人冒个俏皮表情,可爱有趣,适合校园与少儿。
EN: playful marker doodle sketch, lively lines and vibrant fills, cute anthropomorphic cube, campus vibe --ar 1:2', 200, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '童趣手绘涂鸦');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '水墨国画意境', '插画', '中国水墨写意,留白与飞白笔触,淡彩点染六色,一颗魔方如山石静物般沉静,东方禅意、大气留白。', 210, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '水墨国画意境');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '浮世绘日本风', '插画', '日本浮世绘版画风,波浪云纹与粗描线条,魔方融入和风构图,复古沉稳配色,木刻肌理。
EN: Japanese ukiyo-e woodblock print style, waves and clouds, Rubik''s cube motif, retro palette, woodcut texture --ar 1:2', 220, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '浮世绘日本风');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '剪纸叠层', '插画', '多层剪纸叠纸艺术,纸张层次与柔和投影,魔方与几何形分层堆叠,手工质感、撞色明快。
EN: layered paper-cut craft art, stacked paper depth and soft shadows, geometric Rubik''s cube, vibrant --ar 1:2', 230, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '剪纸叠层');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '黏土定格', '质感', '黏土 / 橡皮泥定格动画质感,圆润捏制的魔方,柔软手作肌理,柔光布光,可爱治愈。
EN: claymation stop-motion style, soft handmade clay Rubik''s cube, plasticine texture, soft lighting, cute --ar 1:2', 240, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '黏土定格');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '液态铬金属 Y2K', '质感', 'Y2K 千禧风液态铬金属,镜面流动的金属魔方,彩虹反光与高光,科幻未来、强反射质感。
EN: Y2K liquid chrome metal, mirror-finish flowing metallic cube, iridescent reflections, futuristic --ar 1:2', 250, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '液态铬金属 Y2K');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '全息镭射', '质感', '全息镭射薄膜质感,虹彩渐变光泽,魔方泛七彩反光,梦幻未来、潮流高级。
EN: holographic iridescent foil, rainbow gradient sheen, prismatic glowing cube, dreamy trendy --ar 1:2', 260, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '全息镭射');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '微距真实魔方', '质感', '真实摄影微距特写,实拍三阶魔方一角,浅景深虚化,贴纸纹理、缝隙与高光细腻真实,产品质感。
EN: macro photography close-up of a real speedcube corner, shallow depth of field, crisp sticker texture --ar 1:2', 270, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '微距真实魔方');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '毛绒针织', '质感', '毛绒 / 针织手作质感,魔方像毛线编织的玩偶,柔软纤维细节,暖萌治愈、柔和布光。
EN: fluffy knitted yarn craft, plush woven Rubik''s cube toy, cozy fiber details, warm cute --ar 1:2', 280, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '毛绒针织');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '蒸汽波故障', '氛围', 'Vaporwave 蒸汽波 + glitch 故障艺术,网格地平线、落日、紫粉霓虹,魔方带 RGB 错位与扫描线,复古赛博。
EN: vaporwave glitch art, retro grid horizon, sunset, pink purple neon, RGB-shifted cube, scanlines --ar 1:2', 290, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '蒸汽波故障');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '合成器浪潮 80s', '氛围', 'Synthwave 80 年代复古未来,霓虹日落网格、棕榈剪影、扫描线,魔方悬浮发光,怀旧炫酷。
EN: 80s synthwave retrowave, neon sunset grid, palm silhouettes, glowing floating cube, nostalgic --ar 1:2', 300, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '合成器浪潮 80s');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '极光星空宇宙', '氛围', '浩瀚星空与极光,魔方漂浮于深空,星云透出六色辉光、星轨流转,梦幻宏大、深邃神秘。
EN: cosmic galaxy with aurora, Rubik''s cube floating in deep space, six-color nebula glow, dreamy epic --ar 1:2', 310, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '极光星空宇宙');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `category`, `body`, `sort_order`, `created_at`)
SELECT '抽象流体渐变', '氛围', '抽象流体渐变,品牌蓝到六色丝滑融合的色块与气泡,弥散柔光晕染,现代杂志感,主体留一颗精致小魔方。
EN: abstract fluid gradient, smooth blobs blending brand blue into six colors, soft diffuse glow, editorial --ar 1:2', 320, 1781164700
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `name` = '抽象流体渐变');
