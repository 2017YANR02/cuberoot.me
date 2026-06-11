-- 回填卡片正面背景图的 16 个默认「生图提示词」模板(单一数据源:lib/qr/prompt.ts DEFAULT_PROMPT_TEMPLATES)。
-- 由 .tmp/gen-prompt-seed.ts 生成。按 name 幂等,不覆盖后台已增删改的模板;库非空时同名跳过。
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
