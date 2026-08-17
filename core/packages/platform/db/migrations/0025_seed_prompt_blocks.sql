-- 回填卡片提示词「维度组合积木」(单一数据源:lib/qr/prompt.ts DEFAULT_PROMPT_BLOCKS)。
-- 由 .tmp/gen-block-seed.ts 生成。按 (dimension,name) 幂等;不覆盖后台改过的。preset 模板 dimension 为 NULL。
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '科技发光', '风格', '科技未来风,边缘发光、细微光粒子与极淡科技网格,冷调高级质感', 10, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '科技发光');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '3D 渲染', '风格', 'C4D / OC 立体渲染,亚克力玻璃光泽、柔和影棚布光,产品级精致', 20, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '3D 渲染');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '写实摄影', '风格', '写实原生摄影质感,真实材质、细腻高光与景深,电影级超清', 30, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '写实摄影');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '水彩手绘', '风格', '水彩晕染手绘,透明水痕与自然笔触,清新文艺通透', 40, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '水彩手绘');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '水墨国风', '风格', '中国水墨写意,留白与飞白笔触、淡彩点染,东方意境', 50, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '水墨国风');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '赛博霓虹', '风格', '赛博朋克霓虹,蓝紫青基调、霓虹辉光与全息光带,炫酷未来', 60, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '赛博霓虹');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '扁平矢量', '风格', '扁平矢量插画,平涂色块与干净描边,简洁现代', 70, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '扁平矢量');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '像素体素', '风格', '体素 / 像素 8-bit 复古游戏风,撞色方块、几何趣味', 80, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '像素体素');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '黏土定格', '风格', '黏土 / 橡皮泥定格质感,圆润手作肌理、柔光,可爱治愈', 90, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '黏土定格');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '伦勃朗暗调', '风格', '伦勃朗硬光暗调,强明暗对比、深邃阴影,电影级戏剧感', 100, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '伦勃朗暗调');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '复古胶片', '风格', '35mm 胶片质感,暖旧色调、轻微颗粒与漏光,怀旧文艺', 110, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '复古胶片');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '蒸汽朋克', '风格', '蒸汽朋克,黄铜齿轮管道铆钉机械构造,暖棕金属、复古工业精密', 120, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '蒸汽朋克');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '全息镭射', '风格', '全息镭射虹彩薄膜光泽,七彩反光,梦幻潮流', 130, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '全息镭射');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '极简留白', '风格', '极简主义,大面积留白与柔和渐变,克制高级、杂志编排感', 140, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '风格' AND `name` = '极简留白');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '单颗悬浮魔方', '主体', '一颗 WCA 三阶魔方悬浮于画面中上方,边缘高光、主体清晰锐利', 150, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '单颗悬浮魔方');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '散落魔方与道具', '主体', '几颗 WCA 魔方与速拧道具(计时器、润滑油、钥匙扣)错落散布', 160, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '散落魔方与道具');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '魔方城市', '主体', '由魔方搭建的微缩城市与建筑群,海量趣味细节、欢乐繁忙', 170, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '魔方城市');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '魔方爆裂分解', '主体', '一颗魔方爆裂分解,小方块与彩色碎屑向四周飞散并拖出动态轨迹', 180, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '魔方爆裂分解');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '拟人魔方吉祥物', '主体', '一颗拟人魔方吉祥物,有手脚和俏皮表情,活泼友好、品牌 IP 感', 190, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '拟人魔方吉祥物');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '魔方拼成大图案', '主体', '成百上千颗微缩魔方整齐拼贴成六色渐变的马赛克色域', 200, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '魔方拼成大图案');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '速拧手部特写', '主体', '速拧选手手部正飞快转动魔方的特写,手指利落、动感十足', 210, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '速拧手部特写');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '各阶魔方一排', '主体', '二阶到七阶各种阶数魔方整齐排开,层次丰富、阵列感', 220, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主体' AND `name` = '各阶魔方一排');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '春节', '主题', '春节氛围,红灯笼、烟花、祥云与中国红配金点缀,喜庆热闹', 230, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '春节');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '圣诞', '主题', '圣诞氛围,雪花、松枝、礼盒与暖色灯串,温馨梦幻', 240, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '圣诞');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '万圣节', '主题', '万圣节氛围,月夜、南瓜灯与剪影,神秘俏皮', 250, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '万圣节');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '校园青春', '主题', '校园青春场景,书本、社团与活力气息,清新阳光', 260, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '校园青春');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '电竞赛事', '主题', '电竞 / 赛事舞台,聚光灯、看台与夺冠氛围,热血竞技', 270, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '电竞赛事');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '未来太空', '主题', '未来太空场景,星空、星云与失重悬浮,宏大科幻', 280, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '未来太空');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '暑期夏日', '主题', '夏日清凉,海浪、椰树、冰饮与明媚阳光,活力满满', 290, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '暑期夏日');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '生日庆典', '主题', '生日派对,气球、彩带、蛋糕与撒花,欢乐温暖', 300, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '主题' AND `name` = '生日庆典');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '居中特写', '构图', '主体居中偏上特写,中下大量负空间留白用于叠文字', 310, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '构图' AND `name` = '居中特写');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '等距俯视', '构图', '等距 2.5D 俯视视角,模型般整齐排布、纵深规整', 320, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '构图' AND `name` = '等距俯视');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '微距浅景深', '构图', '微距特写浅景深,主体锐利、背景奶油般柔化虚化', 330, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '构图' AND `name` = '微距浅景深');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '大场景鸟瞰', '构图', '大场景鸟瞰全景,丰富细节与空间纵深', 340, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '构图' AND `name` = '大场景鸟瞰');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '低角仰视', '构图', '低角度仰视,主体高大、英雄气势', 350, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '构图' AND `name` = '低角仰视');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '对称构图', '构图', '严格对称构图,均衡稳重、秩序感强', 360, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '构图' AND `name` = '对称构图');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '影棚硬光暗调', '光影', '影棚单束硬光配深色背景,强高光与深阴影对比,戏剧暗调', 370, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '光影' AND `name` = '影棚硬光暗调');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '柔和晨光', '光影', '柔和自然晨光,通透明亮、淡淡光晕,清新干净', 380, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '光影' AND `name` = '柔和晨光');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '霓虹辉光', '光影', '霓虹辉光打光,冷蓝紫与品牌蓝交映,赛博炫彩', 390, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '光影' AND `name` = '霓虹辉光');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '暖金黄昏', '光影', '暖金黄昏逆光,丁达尔光束与边缘镶光,温暖氛围', 400, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '光影' AND `name` = '暖金黄昏');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '品牌蓝主调', '光影', '以品牌蓝 #2A5DF4 为主的统一蓝调,点缀魔方六色', 410, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '光影' AND `name` = '品牌蓝主调');
--> statement-breakpoint
INSERT INTO `prompt_templates` (`name`, `dimension`, `body`, `sort_order`, `created_at`)
SELECT '六色撞色', '光影', '高饱和魔方六色撞色,明快活泼、对比强烈', 420, 1781169100
WHERE NOT EXISTS (SELECT 1 FROM `prompt_templates` WHERE `dimension` = '光影' AND `name` = '六色撞色');
