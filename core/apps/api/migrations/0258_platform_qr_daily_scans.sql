-- Daily facts start at deployment: lifetime aggregates cannot reconstruct past days.
CREATE TABLE platform_qr_scan_daily (
  qr_code_id UUID NOT NULL REFERENCES platform_qr_codes(id) ON DELETE RESTRICT,
  scan_day DATE NOT NULL,
  visitor_hash BYTEA NOT NULL CHECK (octet_length(visitor_hash) = 32),
  scan_count BIGINT NOT NULL DEFAULT 1 CHECK (scan_count BETWEEN 1 AND 9007199254740991),
  PRIMARY KEY (qr_code_id, scan_day, visitor_hash)
);
CREATE INDEX idx_platform_qr_scan_daily_day ON platform_qr_scan_daily(scan_day);

-- Preserve the complete original prompt collection as editable records.
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-0', '科技发光感', 'prompt', 0, '{"body":"深蓝到品牌蓝渐变背景,一个悬浮、边缘发光的等距三阶魔方,周围细微光粒子与光束,极淡的科技网格,冷调高级质感。\nEN: futuristic tech poster, deep blue to electric blue gradient, a floating glowing isometric Rubik''s cube, subtle light particles and rays, faint tech grid, premium cold cinematic lighting, clean lower negative space --ar 1:2","category":"通用"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '科技发光感' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-1', '3D 渲染质感', 'prompt', 1, '{"body":"C4D/OC 渲染的立体魔方,亚克力 / 玻璃光泽,柔和影棚布光,品牌蓝渐变背景,轻微景深,细腻高级。\nEN: 3D rendered glossy Rubik''s cube, acrylic glass material, soft studio lighting, blue gradient backdrop, shallow depth of field, octane render, premium product shot --ar 1:2","category":"通用"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '3D 渲染质感' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-2', '孟菲斯撞色波普', 'prompt', 2, '{"body":"孟菲斯设计风,大胆几何形 + 魔方撞色块(红橙黄绿蓝),平涂矢量,波普趣味,适合年轻人。\nEN: Memphis design style, bold geometric shapes and Rubik''s cube color blocks, flat vector pop art, energetic youthful, vibrant --ar 1:2","category":"通用"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '孟菲斯撞色波普' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-3', '国潮中国风', 'prompt', 3, '{"body":"国潮风,魔方融合祥云与传统几何纹样,红蓝配金箔点缀,大气有东方感。\nEN: Chinese guochao style, Rubik''s cube merged with auspicious cloud and traditional geometric patterns, red blue with gold foil accents, bold oriental aesthetic --ar 1:2","category":"通用"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '国潮中国风' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-4', '极简高级(杂志留白)', 'prompt', 4, '{"body":"极简主义,大面积品牌蓝单色或柔和渐变,一个精致小魔方,大量负空间,克制高级,杂志编排感。\nEN: minimalist editorial poster, large negative space, single refined isometric cube, soft gradient, restrained premium magazine aesthetic --ar 1:2","category":"通用"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '极简高级(杂志留白)' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-5', '体素像素风', 'prompt', 5, '{"body":"体素 / 像素风立体魔方,8-bit 复古游戏感,撞色,几何趣味。\nEN: voxel pixel-art Rubik''s cube, retro 8-bit game vibe, vibrant blocky colors, playful geometric --ar 1:2","category":"通用"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '体素像素风' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-6', '影棚光束悬浮魔方', 'prompt', 6, '{"body":"深黑到深蓝的影棚背景,一颗 WCA 魔方悬浮于画面中上方,边缘描上冷蓝高光;四周放射动感光束与漂浮微粒,体积光、轻微景深与镜面反射;高端、电影感、产品 key visual 质感,克制而震撼。","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '影棚光束悬浮魔方' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-7', '碎裂粒子分解魔方', 'prompt', 7, '{"body":"一颗 WCA 魔方正在爆裂分解,小方块与彩色碎屑向四周飞散并拖出动态轨迹;暗色戏剧化背景,强逆光与边缘高光勾勒轮廓,速度感与能量感十足,粒子、烟尘、景深虚化,商业海报级。","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '碎裂粒子分解魔方' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-8', '微缩魔方马赛克拼贴', 'prompt', 8, '{"body":"画面上半由成百上千颗微缩 WCA 魔方整齐拼贴,组成一片由六色渐变过渡的马赛克色域(可隐约拼出一个大魔方轮廓);俯视平铺、光影细腻;越往下密度越低、过渡到干净深色区域留白放文字,精致高级的拼贴艺术。","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '微缩魔方马赛克拼贴' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-9', '六色光轨漩涡隧道', 'prompt', 9, '{"body":"画面中心一颗清晰锐利的 WCA 魔方,周围是由魔方六色构成的螺旋光轨 / 隧道向中心汇聚旋转,催眠般的纵深与速度感;深色背景 + 霓虹辉光、长曝光光绘质感,炫酷、未来、视觉冲击强。","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '六色光轨漩涡隧道' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-10', '流彩泼墨环绕魔方', 'prompt', 10, '{"body":"一颗干净利落的 WCA 魔方为主角,周围是红橙黄绿蓝六色颜料 / 水墨在空中泼溅流动、丝缕飞扬环绕,东方写意 + 现代撞色;留白讲究、构图大气,墨色与彩液质感细腻,高级国潮艺术海报。(线上在用)","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '流彩泼墨环绕魔方' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-11', '魔方微缩等距世界', 'prompt', 11, '{"body":"等距俯视的微缩城市,整座城市由魔方搭建:魔方造型的摩天楼、商店、研发实验室与图书馆,螺旋滑梯、悬浮单轨列车、待发射的小火箭、长长的自动扶梯、搬运立方体包裹的机器人;几十个卡通小人在拧魔方、比赛、逛街;高饱和撞色、干净黑色描边、海量趣味细节,欢乐繁忙的节庆气氛。(线上在用)","category":"场景"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '魔方微缩等距世界' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-12', '旭日放射撞色波普海报', 'prompt', 12, '{"body":"暖色旭日放射光芒铺满整幅背景(橙红渐金黄),复古波普促销大片氛围;空中漂浮热气球、纸飞机与彩带,前景散落多颗 WCA 魔方和速拧小道具(计时器、润滑油、钥匙扣);扁平矢量 + 半调网点纹理,强对比、动感、喜庆热闹,冲击力拉满。","category":"场景"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '旭日放射撞色波普海报' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-13', '节日主题氛围 3D 渲染', 'prompt', 13, '{"body":"电影感 3D 渲染的节日场景,一颗 WCA 魔方为绝对主角悬浮于氛围光里;主题可换(万圣节月夜墓园剪影 / 圣诞雪夜松枝与礼盒 / 春节红灯笼与烟花);暖光、薄雾、柔和长投影、浅景深,OC/C4D 精致质感,温馨梦幻、产品海报级。","category":"场景"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '节日主题氛围 3D 渲染' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-14', '魔方主题乐园嘉年华', 'prompt', 14, '{"body":"盛大的魔方主题游乐园鸟瞰:由魔方拼成的过山车、摩天轮、旋转木马、城堡与拱门,彩旗、气球与喷泉,熙攘的卡通人群;糖果色调、明快布光、丰富细节的 3D 渲染插画,节日欢乐感拉满。","category":"场景"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '魔方主题乐园嘉年华' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-15', '赛博霓虹魔方都市夜景', 'prompt', 15, '{"body":"未来赛博都市雨夜,鳞次栉比的高楼由发光魔方堆叠而成,霓虹招牌、全息光带、穿梭的飞行器,湿润地面映出彩色倒影;城中央矗立一颗巨型 WCA 魔方并透出体积光;以蓝紫青为基调、六色霓虹点缀,电影级光影、超清细节,酷炫震撼。","category":"场景"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '赛博霓虹魔方都市夜景' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-16', '水彩手绘', 'prompt', 16, '{"body":"水彩晕染手绘风,透明水痕与自然笔触,一颗魔方为主体,六色淡彩点染,清新文艺、通透留白。\nEN: watercolor hand-painted illustration, transparent washes and bleeds, a Rubik''s cube subject, fresh artsy, airy negative space --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '水彩手绘' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-17', '低多边形几何', 'prompt', 17, '{"body":"Low Poly 低多边形风格,魔方与背景由三角面拼成,柔和渐变着色,简洁现代、棱面光影。\nEN: low poly geometric art, faceted triangular Rubik''s cube and backdrop, gradient shading, clean modern --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '低多边形几何' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-18', '单线描线条艺术', 'prompt', 18, '{"body":"极简连续单线线描,在浅底或品牌蓝底上勾出魔方轮廓,优雅克制,大量留白,杂志感。\nEN: minimalist single continuous line art, elegant outline of a Rubik''s cube, lots of negative space, editorial --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '单线描线条艺术' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-19', '童趣手绘涂鸦', 'prompt', 19, '{"body":"马克笔涂鸦手绘风,活泼线条 + 撞色填充,魔方拟人冒个俏皮表情,可爱有趣,适合校园与少儿。\nEN: playful marker doodle sketch, lively lines and vibrant fills, cute anthropomorphic cube, campus vibe --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '童趣手绘涂鸦' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-20', '水墨国画意境', 'prompt', 20, '{"body":"中国水墨写意,留白与飞白笔触,淡彩点染六色,一颗魔方如山石静物般沉静,东方禅意、大气留白。","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '水墨国画意境' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-21', '浮世绘日本风', 'prompt', 21, '{"body":"日本浮世绘版画风,波浪云纹与粗描线条,魔方融入和风构图,复古沉稳配色,木刻肌理。\nEN: Japanese ukiyo-e woodblock print style, waves and clouds, Rubik''s cube motif, retro palette, woodcut texture --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '浮世绘日本风' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-22', '剪纸叠层', 'prompt', 22, '{"body":"多层剪纸叠纸艺术,纸张层次与柔和投影,魔方与几何形分层堆叠,手工质感、撞色明快。\nEN: layered paper-cut craft art, stacked paper depth and soft shadows, geometric Rubik''s cube, vibrant --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '剪纸叠层' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-23', '黏土定格', 'prompt', 23, '{"body":"黏土 / 橡皮泥定格动画质感,圆润捏制的魔方,柔软手作肌理,柔光布光,可爱治愈。\nEN: claymation stop-motion style, soft handmade clay Rubik''s cube, plasticine texture, soft lighting, cute --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '黏土定格' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-24', '液态铬金属 Y2K', 'prompt', 24, '{"body":"Y2K 千禧风液态铬金属,镜面流动的金属魔方,彩虹反光与高光,科幻未来、强反射质感。\nEN: Y2K liquid chrome metal, mirror-finish flowing metallic cube, iridescent reflections, futuristic --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '液态铬金属 Y2K' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-25', '全息镭射', 'prompt', 25, '{"body":"全息镭射薄膜质感,虹彩渐变光泽,魔方泛七彩反光,梦幻未来、潮流高级。\nEN: holographic iridescent foil, rainbow gradient sheen, prismatic glowing cube, dreamy trendy --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '全息镭射' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-26', '微距真实魔方', 'prompt', 26, '{"body":"真实摄影微距特写,实拍三阶魔方一角,浅景深虚化,贴纸纹理、缝隙与高光细腻真实,产品质感。\nEN: macro photography close-up of a real speedcube corner, shallow depth of field, crisp sticker texture --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '微距真实魔方' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-27', '毛绒针织', 'prompt', 27, '{"body":"毛绒 / 针织手作质感,魔方像毛线编织的玩偶,柔软纤维细节,暖萌治愈、柔和布光。\nEN: fluffy knitted yarn craft, plush woven Rubik''s cube toy, cozy fiber details, warm cute --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '毛绒针织' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-28', '蒸汽波故障', 'prompt', 28, '{"body":"Vaporwave 蒸汽波 + glitch 故障艺术,网格地平线、落日、紫粉霓虹,魔方带 RGB 错位与扫描线,复古赛博。\nEN: vaporwave glitch art, retro grid horizon, sunset, pink purple neon, RGB-shifted cube, scanlines --ar 1:2","category":"氛围"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '蒸汽波故障' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-29', '合成器浪潮 80s', 'prompt', 29, '{"body":"Synthwave 80 年代复古未来,霓虹日落网格、棕榈剪影、扫描线,魔方悬浮发光,怀旧炫酷。\nEN: 80s synthwave retrowave, neon sunset grid, palm silhouettes, glowing floating cube, nostalgic --ar 1:2","category":"氛围"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '合成器浪潮 80s' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-30', '极光星空宇宙', 'prompt', 30, '{"body":"浩瀚星空与极光,魔方漂浮于深空,星云透出六色辉光、星轨流转,梦幻宏大、深邃神秘。\nEN: cosmic galaxy with aurora, Rubik''s cube floating in deep space, six-color nebula glow, dreamy epic --ar 1:2","category":"氛围"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '极光星空宇宙' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-31', '抽象流体渐变', 'prompt', 31, '{"body":"抽象流体渐变,品牌蓝到六色丝滑融合的色块与气泡,弥散柔光晕染,现代杂志感,主体留一颗精致小魔方。\nEN: abstract fluid gradient, smooth blobs blending brand blue into six colors, soft diffuse glow, editorial --ar 1:2","category":"氛围"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '抽象流体渐变' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-32', '伦勃朗暗调速度感', 'prompt', 32, '{"body":"伦勃朗光影布光,仅一束硬光打亮魔方的一面与棱角,其余面没入深邃阴影;整体暗调、明暗对比强烈;魔方身后拉出横向动态模糊拖影,营造疾速旋拧、飞速复原的速度感;纯黑背景,电影级质感,细节丰富,写实摄影质感。\nEN: Rembrandt lighting, a single hard key light on one face and edges of a Rubik''s cube, rest in deep shadow, low-key high-contrast, horizontal motion-blur streaks behind it for speed, pure black background, cinematic, photorealistic --ar 1:2","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '伦勃朗暗调速度感' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-33', '高速水花定格', 'prompt', 33, '{"body":"一颗 WCA 魔方坠入彩色液体激起皇冠状水花四溅,高速摄影瞬间定格,深色背景,水珠晶莹剔透、动感凝固,商业广告级超清。\nEN: high-speed splash photography, a Rubik''s cube hitting colorful liquid, crown-shaped splash frozen mid-air, dark backdrop, glossy droplets, commercial grade --ar 1:2","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '高速水花定格' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-34', '逆光黄昏剪影', 'prompt', 34, '{"body":"黄昏暖金逆光,一颗魔方逆光剪影、边缘镶一圈金边,空气中浮尘与丁达尔光束,温暖电影感、氛围浓郁、浅景深。\nEN: golden hour backlight, a Rubik''s cube rim-lit silhouette with glowing edge, floating dust and god rays, warm cinematic atmosphere --ar 1:2","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '逆光黄昏剪影' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-35', '长曝光光绘', 'prompt', 35, '{"body":"暗背景下用魔方六色光线长曝光绘出环绕魔方的流动光轨与笔触,光绘摄影质感,炫彩流动、动感拖尾。\nEN: long-exposure light painting, six-color luminous trails swirling around a cube, dark background, glowing motion streaks --ar 1:2","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '长曝光光绘' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-36', '双重曝光', 'prompt', 36, '{"body":"双重曝光艺术,一颗魔方的轮廓里叠映城市天际线或浩瀚星空,黑白到品牌蓝过渡,文艺高级、留白讲究。\nEN: double exposure art, a Rubik''s cube silhouette filled with a city skyline or starfield, monochrome to brand blue, editorial --ar 1:2","category":"大片"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '双重曝光' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-37', '移轴微缩摄影', 'prompt', 37, '{"body":"移轴镜头微缩效果,俯拍像玩具模型般的速拧桌面/赛场,魔方与小人前后景深虚化成「迷你世界」,清新可爱、明快布光。\nEN: tilt-shift miniature photography, toy-like cubing desk from above, shallow blur into a tiny world, cute bright --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '移轴微缩摄影' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-38', '黑金奢华', 'prompt', 38, '{"body":"纯黑背景配金色描边与流光,一颗魔方点缀金箔与镜面反光,低调奢华、高端克制、强反射质感。\nEN: black and gold luxury, pure black background, gold accents, gold-foil and mirror reflections on a cube, premium --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '黑金奢华' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-39', '复古胶片颗粒', 'prompt', 39, '{"body":"35mm 胶片质感,暖旧色调、轻微颗粒与漏光,一颗魔方静物,怀旧文艺、复古摄影氛围。\nEN: 35mm film grain photography, warm vintage tones, subtle grain and light leaks, a cube still life, nostalgic --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '复古胶片颗粒' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-40', '极简纯色产品摄影', 'prompt', 40, '{"body":"极简产品摄影,纯品牌蓝或柔色背景,一颗魔方居中,柔和投影与高光,干净留白、电商主图级。\nEN: minimal product photography, solid pastel or brand-blue backdrop, centered Rubik''s cube, soft shadow and highlight, clean ecommerce --ar 1:2","category":"质感"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '极简纯色产品摄影' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-41', '扁平吉祥物卡通', 'prompt', 41, '{"body":"扁平矢量卡通,一颗拟人魔方吉祥物有手脚和俏皮表情,活泼友好、品牌 IP 感,撞色简洁、干净描边。\nEN: flat vector cartoon mascot, cute anthropomorphic Rubik''s cube character with limbs and face, brand IP, vibrant --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '扁平吉祥物卡通' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-42', '包豪斯几何', 'prompt', 42, '{"body":"包豪斯 / 构成主义平面设计,红黄蓝基本几何形与粗线条网格,魔方融入构成,理性现代、克制有秩序。\nEN: Bauhaus constructivist graphic design, primary geometric shapes and bold grid lines, cube integrated, modern --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '包豪斯几何' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-43', '等距桌面场景', 'prompt', 43, '{"body":"等距 2.5D 插画,一张速拧玩家的桌面:魔方、计时器、键盘、奖牌、绿植与台灯,干净描边、柔和阴影,温馨整洁。\nEN: isometric 2.5D illustration of a cuber''s desk: cube, timer, keyboard, medal, plant, lamp, clean lines, cozy --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '等距桌面场景' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-44', '新中式金箔', 'prompt', 44, '{"body":"新中式设计,水墨留白配金箔线条与几何窗棂纹样,一颗魔方典雅居中,东方高级、克制大气。","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '新中式金箔' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-45', '街头涂鸦嘻哈', 'prompt', 45, '{"body":"街头涂鸦 / 喷漆风,粗犷字符纹理与六色喷溅,魔方带潮流贴纸炸街感,叛逆活力、嘻哈街头。\nEN: street graffiti spray-paint style, gritty textures and color splatter, sticker-bomb Rubik''s cube, hip-hop street --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '街头涂鸦嘻哈' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-preset-46', '蒸汽朋克齿轮', 'prompt', 46, '{"body":"蒸汽朋克,黄铜齿轮、管道与铆钉机械构造环绕一颗机械感魔方,暖棕金属色、复古工业、精密细节。\nEN: steampunk brass gears, pipes and rivets around a mechanical Rubik''s cube, warm copper, vintage industrial, intricate --ar 1:2","category":"插画"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '蒸汽朋克齿轮' AND COALESCE(template->>'dimension', '') = '')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-47', '科技发光', 'prompt', 47, '{"body":"科技未来风,边缘发光、细微光粒子与极淡科技网格,冷调高级质感","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '科技发光' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-48', '3D 渲染', 'prompt', 48, '{"body":"C4D / OC 立体渲染,亚克力玻璃光泽、柔和影棚布光,产品级精致","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '3D 渲染' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-49', '写实摄影', 'prompt', 49, '{"body":"写实原生摄影质感,真实材质、细腻高光与景深,电影级超清","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '写实摄影' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-50', '水彩手绘', 'prompt', 50, '{"body":"水彩晕染手绘,透明水痕与自然笔触,清新文艺通透","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '水彩手绘' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-51', '水墨国风', 'prompt', 51, '{"body":"中国水墨写意,留白与飞白笔触、淡彩点染,东方意境","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '水墨国风' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-52', '赛博霓虹', 'prompt', 52, '{"body":"赛博朋克霓虹,蓝紫青基调、霓虹辉光与全息光带,炫酷未来","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '赛博霓虹' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-53', '扁平矢量', 'prompt', 53, '{"body":"扁平矢量插画,平涂色块与干净描边,简洁现代","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '扁平矢量' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-54', '像素体素', 'prompt', 54, '{"body":"体素 / 像素 8-bit 复古游戏风,撞色方块、几何趣味","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '像素体素' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-55', '黏土定格', 'prompt', 55, '{"body":"黏土 / 橡皮泥定格质感,圆润手作肌理、柔光,可爱治愈","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '黏土定格' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-56', '伦勃朗暗调', 'prompt', 56, '{"body":"伦勃朗硬光暗调,强明暗对比、深邃阴影,电影级戏剧感","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '伦勃朗暗调' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-57', '复古胶片', 'prompt', 57, '{"body":"35mm 胶片质感,暖旧色调、轻微颗粒与漏光,怀旧文艺","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '复古胶片' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-58', '蒸汽朋克', 'prompt', 58, '{"body":"蒸汽朋克,黄铜齿轮管道铆钉机械构造,暖棕金属、复古工业精密","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '蒸汽朋克' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-59', '全息镭射', 'prompt', 59, '{"body":"全息镭射虹彩薄膜光泽,七彩反光,梦幻潮流","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '全息镭射' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-60', '极简留白', 'prompt', 60, '{"body":"极简主义,大面积留白与柔和渐变,克制高级、杂志编排感","dimension":"风格"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '极简留白' AND COALESCE(template->>'dimension', '') = '风格')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-61', '单颗悬浮魔方', 'prompt', 61, '{"body":"一颗 WCA 三阶魔方悬浮于画面中上方,边缘高光、主体清晰锐利","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '单颗悬浮魔方' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-62', '散落魔方与道具', 'prompt', 62, '{"body":"几颗 WCA 魔方与速拧道具(计时器、润滑油、钥匙扣)错落散布","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '散落魔方与道具' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-63', '魔方城市', 'prompt', 63, '{"body":"由魔方搭建的微缩城市与建筑群,海量趣味细节、欢乐繁忙","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '魔方城市' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-64', '魔方爆裂分解', 'prompt', 64, '{"body":"一颗魔方爆裂分解,小方块与彩色碎屑向四周飞散并拖出动态轨迹","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '魔方爆裂分解' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-65', '拟人魔方吉祥物', 'prompt', 65, '{"body":"一颗拟人魔方吉祥物,有手脚和俏皮表情,活泼友好、品牌 IP 感","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '拟人魔方吉祥物' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-66', '魔方拼成大图案', 'prompt', 66, '{"body":"成百上千颗微缩魔方整齐拼贴成六色渐变的马赛克色域","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '魔方拼成大图案' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-67', '速拧手部特写', 'prompt', 67, '{"body":"速拧选手手部正飞快转动魔方的特写,手指利落、动感十足","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '速拧手部特写' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-68', '各阶魔方一排', 'prompt', 68, '{"body":"二阶到七阶各种阶数魔方整齐排开,层次丰富、阵列感","dimension":"主体"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '各阶魔方一排' AND COALESCE(template->>'dimension', '') = '主体')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-69', '春节', 'prompt', 69, '{"body":"春节氛围,红灯笼、烟花、祥云与中国红配金点缀,喜庆热闹","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '春节' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-70', '圣诞', 'prompt', 70, '{"body":"圣诞氛围,雪花、松枝、礼盒与暖色灯串,温馨梦幻","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '圣诞' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-71', '万圣节', 'prompt', 71, '{"body":"万圣节氛围,月夜、南瓜灯与剪影,神秘俏皮","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '万圣节' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-72', '校园青春', 'prompt', 72, '{"body":"校园青春场景,书本、社团与活力气息,清新阳光","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '校园青春' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-73', '电竞赛事', 'prompt', 73, '{"body":"电竞 / 赛事舞台,聚光灯、看台与夺冠氛围,热血竞技","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '电竞赛事' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-74', '未来太空', 'prompt', 74, '{"body":"未来太空场景,星空、星云与失重悬浮,宏大科幻","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '未来太空' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-75', '暑期夏日', 'prompt', 75, '{"body":"夏日清凉,海浪、椰树、冰饮与明媚阳光,活力满满","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '暑期夏日' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-76', '生日庆典', 'prompt', 76, '{"body":"生日派对,气球、彩带、蛋糕与撒花,欢乐温暖","dimension":"主题"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '生日庆典' AND COALESCE(template->>'dimension', '') = '主题')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-77', '居中特写', 'prompt', 77, '{"body":"主体居中偏上特写,中下大量负空间留白用于叠文字","dimension":"构图"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '居中特写' AND COALESCE(template->>'dimension', '') = '构图')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-78', '等距俯视', 'prompt', 78, '{"body":"等距 2.5D 俯视视角,模型般整齐排布、纵深规整","dimension":"构图"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '等距俯视' AND COALESCE(template->>'dimension', '') = '构图')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-79', '微距浅景深', 'prompt', 79, '{"body":"微距特写浅景深,主体锐利、背景奶油般柔化虚化","dimension":"构图"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '微距浅景深' AND COALESCE(template->>'dimension', '') = '构图')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-80', '大场景鸟瞰', 'prompt', 80, '{"body":"大场景鸟瞰全景,丰富细节与空间纵深","dimension":"构图"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '大场景鸟瞰' AND COALESCE(template->>'dimension', '') = '构图')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-81', '低角仰视', 'prompt', 81, '{"body":"低角度仰视,主体高大、英雄气势","dimension":"构图"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '低角仰视' AND COALESCE(template->>'dimension', '') = '构图')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-82', '对称构图', 'prompt', 82, '{"body":"严格对称构图,均衡稳重、秩序感强","dimension":"构图"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '对称构图' AND COALESCE(template->>'dimension', '') = '构图')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-83', '影棚硬光暗调', 'prompt', 83, '{"body":"影棚单束硬光配深色背景,强高光与深阴影对比,戏剧暗调","dimension":"光影"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '影棚硬光暗调' AND COALESCE(template->>'dimension', '') = '光影')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-84', '柔和晨光', 'prompt', 84, '{"body":"柔和自然晨光,通透明亮、淡淡光晕,清新干净","dimension":"光影"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '柔和晨光' AND COALESCE(template->>'dimension', '') = '光影')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-85', '霓虹辉光', 'prompt', 85, '{"body":"霓虹辉光打光,冷蓝紫与品牌蓝交映,赛博炫彩","dimension":"光影"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '霓虹辉光' AND COALESCE(template->>'dimension', '') = '光影')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-86', '暖金黄昏', 'prompt', 86, '{"body":"暖金黄昏逆光,丁达尔光束与边缘镶光,温暖氛围","dimension":"光影"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '暖金黄昏' AND COALESCE(template->>'dimension', '') = '光影')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-87', '品牌蓝主调', 'prompt', 87, '{"body":"以品牌蓝 #2A5DF4 为主的统一蓝调,点缀魔方六色","dimension":"光影"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '品牌蓝主调' AND COALESCE(template->>'dimension', '') = '光影')
ON CONFLICT (template_key) DO NOTHING;
INSERT INTO platform_qr_templates (template_key, name_zh, template_kind, sort_order, template)
SELECT 'builtin-block-88', '六色撞色', 'prompt', 88, '{"body":"高饱和魔方六色撞色,明快活泼、对比强烈","dimension":"光影"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM platform_qr_templates WHERE template_kind = 'prompt' AND name_zh = '六色撞色' AND COALESCE(template->>'dimension', '') = '光影')
ON CONFLICT (template_key) DO NOTHING;
