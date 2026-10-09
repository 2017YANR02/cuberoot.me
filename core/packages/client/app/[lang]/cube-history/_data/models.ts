import type { Cube, LocalizedText } from './types';

/**
 * Display model identities reviewed against all 128 multi-record families in
 * the 2026-10-09 archive. familyId remains a broader navigation relationship.
 * Generation changes and independently named products have their own model;
 * coatings, magnetic configurations, factory editions and size options remain
 * versions where the existing evidence identifies the same model.
 *
 * Membership uses exact record IDs. A future unreviewed record gets its own
 * card until explicitly assigned here; names and familyId never auto-merge it.
 * The first tuple is the preferred base version, not an inferred launch date.
 * Unnumbered Tianma X3+ records do not inherit a V2/V3/V4 generation.
 */
export interface CubeModelDefinition {
  id: string;
  name: LocalizedText;
  variants: readonly (readonly [id: string, zh: string, en: string])[];
}

export const CUBE_MODEL_DEFINITIONS: readonly CubeModelDefinition[] = [
  { id: "archive-saocube-v56-3x3-magnetic", name: { zh: "SAOCube V56", en: "SAOCube V56" }, variants: [
    ["archive-saocube-v56-3x3-magnetic", "磁力版", "Magnetic"],
    ["archive-saocube-v56-3x3-20-magnet-ball-core", "20 磁球轴", "20-Magnet Ball-Core"],
  ] },
  { id: "giiker-i3s", name: { zh: "计客 i3S", en: "GiiKER i3S" }, variants: [
    ["giiker-i3s", "i3S", "i3S"],
    ["giiker-i3se", "i3SE · 特别版", "i3SE · Special Edition"],
    ["giiker-i3s-light", "i3S Light / Lite", "i3S Light / Lite"],
  ] },
  { id: "archive-newisland-lightning-v2", name: { zh: "Newisland 闪电 V2", en: "Newisland Lightning V2" }, variants: [
    ["archive-newisland-lightning-v2", "原版", "Original"],
  ] },
  { id: "archive-newisland-lightning", name: { zh: "Newisland 闪电", en: "Newisland Lightning" }, variants: [
    ["archive-newisland-lightning", "原版", "Original"],
  ] },
  { id: "archive-alpha-cc3", name: { zh: "Alpha CC3", en: "Alpha CC3" }, variants: [
    ["archive-alpha-cc3", "原版", "Original"],
  ] },
  { id: "archive-alpha-cc1", name: { zh: "Alpha CC1", en: "Alpha CC1" }, variants: [
    ["archive-alpha-cc1", "原版", "Original"],
  ] },
  { id: "cube4you-tile-matte", name: { zh: "Cube4You 色片三阶", en: "Cube4You Tile Cube" }, variants: [
    ["cube4you-tile-matte", "哑光色片", "Matte tiles"],
    ["cube4you-maze-colored-tiles", "白底彩色迷宫", "Maze · White body / Colored tiles"],
    ["cube4you-maze-white-tiles", "黑底白色迷宫", "Maze · Black body / White tiles"],
    ["cube4you-tile-glossy", "亮光色片", "Glossy tiles"],
  ] },
  { id: "v-cube-3", name: { zh: "V-CUBE 3", en: "V-CUBE 3" }, variants: [
    ["v-cube-3", "平面", "Flat"],
    ["v-cube-3b", "凸面", "Pillowed"],
    ["v-cube-3-magnetic", "磁力版", "Magnetic"],
  ] },
  { id: "v-cube-keychain-flat", name: { zh: "V-CUBE 钥匙扣", en: "V-CUBE Keychain" }, variants: [
    ["v-cube-keychain-flat", "平面", "Flat"],
    ["v-cube-keychain-pillow", "凸面", "Pillowed"],
  ] },
  { id: "moretry-tianma-x3-plus-unversioned", name: { zh: "天马 X3+（代际未注明）", en: "Tianma X3+ (generation unspecified)" }, variants: [
    ["archive-moretry-tianma-x3-3x3-single-track-magnetic-frosted", "单重磁力 + 磨砂", "Single-Magnetic + Frosted"],
    ["archive-moretry-tianma-x3-zcube-edition-3x3-enhanced", "ZCube Edition (增强版)", "ZCube Edition (Enhanced)"],
    ["archive-moretry-tianma-x3-zcube-edition-3x3-standard", "ZCube Edition (标准版)", "ZCube Edition (Standard)"],
    ["archive-moretry-tianma-x3-3x3-double-track-magnetic-frosted", "双重磁力 + 磨砂", "Double-Magnetic + Frosted"],
    ["archive-moretry-tianma-x3-3x3-super-maglev-frosted", "Super-磁悬浮 + 磨砂", "Super-MagLev + Frosted"],
    ["archive-moretry-tianma-x3-3x3-triple-track-magnetic-frosted", "三重磁力 + 磨砂", "Triple-Magnetic + Frosted"],
    ["archive-moretry-tianma-x3-3x3-full-magnetic-uv", "全磁版", "Full-Magnetic"],
    ["archive-moretry-tianma-x3-3x3-8-magnet-ball-core-maglev-saocube-special-edition", "8 磁球轴 + 磁悬浮 SAOCube 特别版", "8-Magnet Ball-Core + MagLev SAOCube SE"],
    ["archive-moretry-tianma-x3-3x3-core-magnetic-uv-zcube-se", "轴心磁力 + UV ZCube 特别版", "Core-Magnetic + UV ZCube SE"],
    ["archive-moretry-tianma-x3-3x3-32-magnet-ball-core-saocube-se", "32 磁球轴 + 磁悬浮 SAOCube 特别版", "32-Magnet Ball-Core + MagLev SAOCube SE"],
    ["archive-moretry-tianma-x3-3x3-8-magnet-ball-core-maglev-uv-saocube-se", "8 磁球轴 + 磁悬浮 + UV SAOCube 特别版", "8-Magnet Ball-Core + MagLev + UV SAOCube SE"],
    ["archive-moretry-tianma-x3-3x3-8-magnet-ball-core-maglev-uv-saocube-se-year-of-the-horse-edition", "8 磁球轴 + 磁悬浮 + UV SAOCube 特别版, 马年限定版", "8-Magnet Ball-Core + MagLev + UV SAOCube SE, Year of the Horse Edition"],
    ["archive-moretry-tianma-x3-3x3-8-magnet-ball-core-uv-saocube-se", "8 磁球轴 + UV SAOCube 特别版", "8-Magnet Ball-Core + UV SAOCube SE"],
    ["archive-moretry-tianma-x3-3x3-32-magnet-ball-core-magnetic-saocube-se", "32 磁球轴 + 磁力版 SAOCube 特别版", "32-Magnet Ball-Core + Magnetic SAOCube SE"],
  ] },
  { id: "moretry-tianma-x3-plus-v4", name: { zh: "天马 X3+ V4", en: "Tianma X3+ V4" }, variants: [
    ["archive-moretry-tianma-x3-v4-3x3-maglev-1", "磁悬浮", "MagLev"],
    ["archive-moretry-tianma-x3-v4-3x3-maglev-uv", "磁悬浮 + UV", "MagLev + UV"],
  ] },
  { id: "moretry-tianma-x3-plus-v2", name: { zh: "天马 X3+ V2", en: "Tianma X3+ V2" }, variants: [
    ["archive-moretry-tianma-x3-v2-3x3-enhanced-1", "增强版", "Enhanced"],
  ] },
  { id: "moretry-tianma-x3-plus", name: { zh: "天马 X3+ V3", en: "Tianma X3+ V3" }, variants: [
    ["moretry-tianma-x3-plus", "普通表面版", "uncoated"],
    ["archive-moretry-tianma-x3-v3-plus-3x3-uv-coated", "UV 涂层", "UV Coated"],
  ] },
  { id: "cyclone-metallic-m", name: { zh: "旋风小子电镀三阶", en: "Cyclone Boys Metallic" }, variants: [
    ["cyclone-metallic-m", "电镀磁力版", "Metallic magnetic"],
    ["archive-cyclone-boys-metallic-3x3", "电镀版", "Metallic"],
    ["archive-cyclone-boys-metallic-3x3-m-macaron", "电镀磁力 · 马卡龙", "Metallic magnetic · Macaron"],
    ["archive-cyclone-boys-metallic-3x3-m-gradient", "电镀磁力 · 渐变", "Metallic magnetic · Gradient"],
  ] },
  { id: "archive-maru-vx-3", name: { zh: "Maru VX-3", en: "Maru VX-3" }, variants: [
    ["archive-maru-vx-3", "原版", "Original"],
    ["archive-maru-vx-3-core-m", "Core M", "Core M"],
    ["archive-maru-vx-3-m", "M", "M"],
    ["archive-maru-vx-3-core-m-maglev", "Core M 磁悬浮", "Core M MagLev"],
  ] },
  { id: "vin3-lite", name: { zh: "VIN3", en: "VIN3" }, variants: [
    ["vin3-lite", "Lite 标准版", "Lite Standard Edition"],
    ["vin3-nova", "Nova 旗舰版", "Nova Flagship"],
    ["vin3-racer", "Racer 竞速版", "Racer Speed Edition"],
  ] },
  { id: "haitun-waverider-v2", name: { zh: "斩浪 V2", en: "Waverider V2" }, variants: [
    ["haitun-waverider-v2", "标准版", "Standard"],
    ["archive-haitun-waverider-3x3-v2-flagship", "旗舰版", "Flagship"],
    ["archive-haitun-waverider-3x3-v2-pioneer", "先锋版", "Pioneer"],
    ["archive-haitun-waverider-v2-3x3-ultimate", "至尊版", "Ultimate"],
  ] },
  { id: "archive-escube-air-3x3-8-magnet-ball-core", name: { zh: "ESCube Air", en: "ESCube Air" }, variants: [
    ["archive-escube-air-3x3-8-magnet-ball-core", "8 磁球轴", "8-Magnet Ball-Core"],
    ["archive-escube-air-3x3-20-magnet-ball-core", "20 磁球轴", "20-Magnet Ball-Core"],
    ["archive-escube-air-3x3-20-magnet-ball-core-transparent-core-edition", "20 磁球轴 + 透明轴版本", "20-Magnet Ball-Core + Transparent Core Edition"],
  ] },
  { id: "archive-escube-es3-3x3-magnetic", name: { zh: "ESCube ES3", en: "ESCube ES3" }, variants: [
    ["archive-escube-es3-3x3-magnetic", "磁力版", "Magnetic"],
    ["archive-escube-es3-3x3-magnetic-20-magnet-ball-core-uv-coated", "磁力版 + 20 磁球轴 + UV 涂层", "Magnetic + 20-Magnet Ball-Core + UV Coated"],
    ["archive-escube-es3-3x3-magnetic-8-magnet-ball-core", "磁力版 + 8 磁球轴", "Magnetic + 8-Magnet Ball-Core"],
  ] },
  { id: "archive-fanxin-hudong-light-3x3-standard", name: { zh: "HuDong Light", en: "HuDong Light" }, variants: [
    ["archive-fanxin-hudong-light-3x3-standard", "标准版", "Standard"],
    ["archive-fanxin-hudong-light-3x3-flagship-uv", "旗舰版 (UV)", "Flagship (UV)"],
    ["archive-fanxin-hudong-light-3x3-ultra-maglev-uv", "Ultra (磁悬浮 + UV)", "Ultra (MagLev + UV)"],
  ] },
  { id: "haitun-waverider-v1-standard", name: { zh: "斩浪 V1", en: "Waverider V1" }, variants: [
    ["haitun-waverider-v1-standard", "标准版", "Standard"],
    ["haitun-waverider-v1-flagship", "旗舰版", "Flagship"],
    ["archive-haitun-waverider-v1-3x3-limited-edition", "限定版", "Limited Edition"],
  ] },
  { id: "moretry-tianma-x3-v3", name: { zh: "天马 X3 V3", en: "Tianma X3 V3" }, variants: [
    ["archive-moretry-tianma-x3-v3-3x3-snap", "Snap", "Snap"],
    ["archive-moretry-tianma-x3-v3-3x3-limited-edition", "限定版", "Limited Edition"],
  ] },
  { id: "moretry-tianma-x3-v4", name: { zh: "天马 X3 V4", en: "Tianma X3 V4" }, variants: [
    ["archive-moretry-tianma-x3-v4-3x3-maglev", "磁悬浮", "MagLev"],
  ] },
  { id: "moretry-tianma-x3-v2", name: { zh: "天马 X3 V2", en: "Tianma X3 V2" }, variants: [
    ["archive-moretry-tianma-x3-v2-3x3-enhanced", "增强版", "Enhanced"],
  ] },
  { id: "moretry-tianma-x3", name: { zh: "天马 X3 V1", en: "Tianma X3 V1" }, variants: [
    ["moretry-tianma-x3", "标准版", "Standard"],
  ] },
  { id: "gan3", name: { zh: "GAN3", en: "GAN3" }, variants: [
    ["gan3", "初版", "Original"],
  ] },
  { id: "gan3-v2", name: { zh: "GAN3 V2 / Ganspuzzle III V2", en: "GAN3 V2 / Ganspuzzle III V2" }, variants: [
    ["gan3-v2", "无磁版", "Non-magnetic"],
  ] },
  { id: "gan357", name: { zh: "GAN357", en: "GAN357" }, variants: [
    ["gan357", "无磁版", "Non-magnetic"],
    ["gan357-ultimate", "Ultimate", "Ultimate"],
  ] },
  { id: "gan356-s", name: { zh: "GAN356S", en: "GAN356S" }, variants: [
    ["gan356-s", "无磁版", "Non-magnetic"],
  ] },
  { id: "gan356-original", name: { zh: "GAN356 初代", en: "GAN356 Original" }, variants: [
    ["gan356-original", "无磁版", "Non-magnetic"],
  ] },
  { id: "gan356-air", name: { zh: "GAN356 Air", en: "GAN356 Air" }, variants: [
    ["gan356-air", "Advanced", "Advanced"],
    ["gan356-air-grand-master", "Grand Master 四色限定", "Grand Master Limited Colors"],
  ] },
  { id: "gan356-air-master-2019", name: { zh: "GAN356 Air Master 2019 Edition", en: "GAN356 Air Master 2019 Edition" }, variants: [
    ["gan356-air-master-2019", "无磁版", "Non-magnetic"],
  ] },
  { id: "gan356-air-um", name: { zh: "GAN356 Air UM", en: "GAN356 Air UM" }, variants: [
    ["gan356-air-um", "磁力版", "Magnetic"],
    ["gan356-air-um-maxpark", "Max Park 签名版", "Max Park Signature"],
  ] },
  { id: "gan356-air-s", name: { zh: "GAN356 Air S", en: "GAN356 Air S" }, variants: [
    ["gan356-air-s", "无磁版", "Non-magnetic"],
    ["gan356-air-s-floral-blue", "Floral Blue 花木蓝", "Floral Blue"],
    ["gan356-air-s-love-pink", "Love Pink 真爱粉", "Love Pink"],
  ] },
  { id: "gan356-air-sm", name: { zh: "GAN356 Air SM", en: "GAN356 Air SM" }, variants: [
    ["gan356-air-sm", "磁力版", "Magnetic"],
    ["gan356-air-sm-floral-blue", "Floral Blue 花木蓝", "Floral Blue"],
    ["gan356-air-sm-love-pink", "Love Pink 真爱粉", "Love Pink"],
  ] },
  { id: "gan356-air-sm-2019", name: { zh: "GAN356 Air SM 2019 Edition", en: "GAN356 Air SM 2019 Edition" }, variants: [
    ["gan356-air-sm-2019", "磁力版", "Magnetic"],
  ] },
  { id: "gan354-m", name: { zh: "GAN354 M", en: "GAN354 M" }, variants: [
    ["gan354-m", "磁力版", "Magnetic"],
    ["gan354-m-infinity", "INFINITY 原厂定制", "INFINITY factory custom"],
  ] },
  { id: "gan356-x", name: { zh: "GAN356 X", en: "GAN356 X" }, variants: [
    ["gan356-x", "Numerical IPG", "Numerical IPG"],
    ["gan356-x-ipg-v5", "IPG V5", "IPG V5"],
    ["gan356-x-crystal-blue", "Crystal Blue 小透蓝", "Crystal Blue"],
    ["gan356-x-infinity", "INFINITY 原厂定制", "INFINITY factory custom"],
  ] },
  { id: "gan356-x-v2", name: { zh: "GAN356 X V2", en: "GAN356 X V2" }, variants: [
    ["gan356-x-v2", "磁力版", "Magnetic"],
  ] },
  { id: "gan356-xs", name: { zh: "GAN356 XS", en: "GAN356 XS" }, variants: [
    ["gan356-xs", "磁力版", "Magnetic"],
    ["gan356-xs-evergreen", "Evergreen 圣诞绿", "Evergreen"],
    ["gan356-xs-vita-c", "Vita C 维C", "Vita C"],
    ["gan356-xs-primary-special", "Special 原色内核", "Special / Primary Internals"],
    ["gan356-xs-lite", "Lite", "Lite"],
  ] },
  { id: "gan356-m", name: { zh: "GAN356 M", en: "GAN356 M" }, variants: [
    ["gan356-m", "磁力版", "Magnetic"],
    ["gan356-m-lite", "Lite", "Lite"],
    ["gan356-m-niu", "Niu 牛年限定", "Niu / Year of the Ox"],
    ["gan356-m-uv", "UV", "UV"],
  ] },
  { id: "gan11-m-pro", name: { zh: "GAN11", en: "GAN11" }, variants: [
    ["gan11-m-pro", "M Pro · 雾面原色内核", "M Pro · Frosted / Primary Internals"],
    ["gan11-m-pro-soft", "M Pro 软触涂层", "M Pro Soft Texture"],
    ["gan11-m-pro-uv", "M Pro UV", "M Pro UV"],
    ["gan11-m-pro-kun", "M Pro Kun 有鱼限定", "M Pro Kun Winter Edition"],
    ["gan11-m-duo", "M Duo", "M Duo"],
    ["gan11-m-pro-ambition", "M Pro Ambition 夏日限定", "M Pro Ambition Summer Edition"],
    ["gan11-m-pro-chaser", "M Pro Chaser 夏日限定", "M Pro Chaser Summer Edition"],
    ["gan11-m-pro-glimmer", "M Pro Glimmer 夏日限定", "M Pro Glimmer Summer Edition"],
    ["gan11-m-pro-zenith", "M Pro Zenith 夏日限定", "M Pro Zenith Summer Edition"],
    ["gan11-air", "Air · 无磁", "Air · Non-magnetic"],
    ["gan11-m", "M", "M"],
    ["gan11-m-pro-frosted-black", "M Pro 雾面黑色内核", "M Pro Frosted / Black Internals"],
    ["gan11-m-pro-stickered-black", "M Pro 黑色贴纸版", "M Pro Black / Stickered"],
  ] },
  { id: "gan-mini-m-pro", name: { zh: "GAN Mini M Pro", en: "GAN Mini M Pro" }, variants: [
    ["gan-mini-m-pro", "雾面", "Frosted"],
    ["gan-mini-m-pro-uv", "UV", "UV"],
  ] },
  { id: "gan12", name: { zh: "GAN12", en: "GAN12" }, variants: [
    ["gan12", "MagLev UV", "MagLev UV"],
    ["gan12-m-leap", "M Leap 弹簧版", "M Leap"],
    ["gan12-maglev-frosted", "MagLev 雾面", "MagLev Matte"],
    ["gan12-peacock", "MagLev Peacock 雀灵", "MagLev Peacock Emerald"],
    ["gan12-chan-green", "MagLev CHAN 绿", "MagLev CHAN Green"],
    ["gan12-chan-red", "MagLev CHAN 红", "MagLev CHAN Red"],
    ["gan12-greninja", "MagLev 宝可梦 甲贺忍蛙", "MagLev Pokémon Greninja"],
    ["gan12-maglev-stickered-black", "MagLev 黑色贴纸版", "MagLev Black / Stickered"],
  ] },
  { id: "gan13", name: { zh: "GAN13", en: "GAN13" }, variants: [
    ["gan13", "MagLev 雾面", "MagLev Matte"],
    ["gan13-maglev-uv", "MagLev UV", "MagLev UV"],
    ["gan13-kunlun", "MagLev Kunlun 昆仑", "MagLev Kunlun"],
    ["gan13-maglev-fx", "MagLev FX", "MagLev FX"],
    ["gan13-colore", "MagLev Coloré 游澜", "MagLev Coloré"],
  ] },
  { id: "gan14", name: { zh: "GAN14", en: "GAN14" }, variants: [
    ["gan14", "MagLev UV", "MagLev UV"],
    ["gan14-maglev-frosted", "MagLev 雾面", "MagLev Matte"],
    ["gan14-galaxy", "MagLev Galaxy 星巡", "MagLev Galaxy"],
    ["gan14-pro", "MagLev Pro 雾面", "MagLev Pro Matte"],
    ["gan14-pro-uv", "MagLev Pro UV", "MagLev Pro UV"],
    ["gan14-pro-aurora", "Pro Aurora 瑶光", "MagLev Pro Aurora"],
  ] },
  { id: "gan15", name: { zh: "GAN15", en: "GAN15" }, variants: [
    ["gan15", "MagLev UV", "MagLev UV"],
    ["gan15-10th", "MagLev UV 十周年版", "MagLev UV 10th Anniversary"],
    ["gan15-maglev-frosted", "MagLev 雾面", "MagLev Frosted"],
    ["gan15-zenith", "MagLev Zenith 峰芒", "MagLev Zenith"],
    ["gan15-newblack", "NewBlack 黑核", "NewBlack"],
    ["gan15-emeraldox", "MagLev EmeraldoX 晶玺", "MagLev EmeraldoX"],
  ] },
  { id: "gan16", name: { zh: "GAN16", en: "GAN16" }, variants: [
    ["gan16", "MagLev MAX UV", "MagLev MAX UV"],
    ["gan16-maglev-standard", "MagLev 标准版 UV", "MagLev Standard UV"],
    ["gan16-max-amyth", "MAX Amyth 冬季限定", "MAX Amyth Winter Edition"],
    ["gan16-max-dual-wr", "MAX 耿暄一双世界纪录纪念版", "MAX Geng Xuanyi Dual-WR Edition"],
    ["gan16-max-l", "MagLev MAX-L UV", "MagLev MAX-L UV"],
    ["gan16-max-aqualis", "MAX AQUALIS 夏季限定", "MAX AQUALIS Summer Edition"],
  ] },
  { id: "gan17", name: { zh: "GAN17", en: "GAN17" }, variants: [
    ["gan17", "MagDrive", "MagDrive"],
    ["gan17-jurassic-world", "MagDrive 侏罗纪世界联名版", "MagDrive Jurassic World"],
  ] },
  { id: "gan356-me", name: { zh: "GAN356 ME", en: "GAN356 ME" }, variants: [
    ["gan356-me", "雾面", "Frosted"],
    ["gan356-me-lunar-2024", "春节限定", "Lunar New Year Edition"],
    ["gan356-me-brainstorm", "Brainstorm Voyage", "Brainstorm Voyage"],
    ["gan356-me-uv", "UV", "UV"],
    ["gan356-me-10th", "UV 十周年版", "UV 10th Anniversary"],
    ["gan356-me-lunar-2025", "2025 新年限定", "2025 Lunar New Year"],
    ["gan356-me-christmas", "圣诞版", "Christmas Edition"],
    ["gan356-me-minions", "小黄人雾面版", "Minions Frosted"],
    ["gan356-me-jurassic-world", "侏罗纪世界联名版", "Jurassic World"],
    ["gan356-me-charmander", "宝可梦 小火龙", "Pokémon Charmander"],
    ["gan356-me-pikachu", "宝可梦 皮卡丘", "Pokémon Pikachu"],
    ["gan356-me-sprigatito", "宝可梦 新叶喵", "Pokémon Sprigatito"],
  ] },
  { id: "gan356-me-v2", name: { zh: "GAN356 ME V2", en: "GAN356 ME V2" }, variants: [
    ["gan356-me-v2", "UV", "UV"],
    ["gan356-me-v2-frosted", "雾面", "Frosted"],
  ] },
  { id: "gan356-maglev", name: { zh: "GAN356 MagLev", en: "GAN356 MagLev" }, variants: [
    ["gan356-maglev", "雾面", "Frosted"],
    ["gan356-maglev-uv", "UV", "UV"],
  ] },
  { id: "gan-v100", name: { zh: "GAN V100", en: "GAN V100" }, variants: [
    ["gan-v100", "MagLev UV", "MagLev UV"],
    ["gan-v100-gengar", "MagLev UV 宝可梦 耿鬼", "MagLev UV Pokémon Gengar"],
    ["gan-v100-leap-horse", "Leap 2026 马年版", "Leap Year of the Horse"],
    ["gan-v100-maglev-frosted", "MagLev 雾面", "MagLev Frosted"],
    ["gan-v100-leap", "Leap 雾面", "Leap Frosted"],
    ["gan-v100-maglev-minions", "MagLev UV 小黄人版", "MagLev UV Minions"],
  ] },
  { id: "gan330", name: { zh: "GAN330", en: "GAN330" }, variants: [
    ["gan330", "钥匙扣", "Keychain"],
    ["gan330-shanhe", "× 山河社稷图联名版", "× ShanHeSheJiTu"],
    ["gan330-special-colors", "国色 / 特别配色系列", "Antique Rhyme / Special Color Editions"],
    ["gan330-10th", "十周年版", "10th Anniversary"],
    ["gan330-pokemon-bulbasaur", "宝可梦 妙蛙种子", "Pokémon Bulbasaur"],
    ["gan330-pokemon-charmander", "宝可梦 小火龙", "Pokémon Charmander"],
    ["gan330-pokemon-pikachu", "宝可梦 皮卡丘", "Pokémon Pikachu"],
    ["gan330-pokemon-squirtle", "宝可梦 杰尼龟", "Pokémon Squirtle"],
  ] },
  { id: "monstergo-3x3", name: { zh: "Monster Go 三阶", en: "Monster Go 3×3" }, variants: [
    ["monstergo-3x3", "六色磁力版", "Six-color magnetic"],
    ["monstergo-cloud", "Cloud · 云顶教学", "Cloud"],
    ["monstergo-rainbow", "Rainbow · 彩虹教学", "Rainbow"],
    ["monstergo-traditional", "Traditional · 无磁", "Traditional · Non-magnetic"],
    ["monstergo-ut", "UT · 教学", "UT"],
  ] },
  { id: "monstergo-m-edu", name: { zh: "Monster Go M EDU 磁力教学版", en: "Monster Go M EDU" }, variants: [
    ["monstergo-m-edu", "磁力版", "Magnetic"],
  ] },
  { id: "monstergo-352m", name: { zh: "Monster Go 352M 52 mm", en: "Monster Go 352M 52 mm" }, variants: [
    ["monstergo-352m", "磁力版", "Magnetic"],
  ] },
  { id: "monstergo-328-spelling", name: { zh: "Monster Go 328 拼画小", en: "Monster Go 328 Spelling / Mosaic Cube" }, variants: [
    ["monstergo-328-spelling", "无磁版", "Non-magnetic"],
  ] },
  { id: "swift-355s", name: { zh: "Swift Block 355S", en: "Swift Block 355S" }, variants: [
    ["swift-355s", "磁力版", "Magnetic"],
    ["swift-355s-pikachu", "宝可梦 皮卡丘", "Pokémon Pikachu"],
  ] },
  { id: "swift-maglev", name: { zh: "Swift Block MagLev 初代", en: "Swift Block MagLev Original" }, variants: [
    ["swift-maglev", "磁悬浮版", "MagLev"],
  ] },
  { id: "swift-super-maglev", name: { zh: "Swift Block Super MagLev", en: "Swift Block Super MagLev" }, variants: [
    ["swift-super-maglev", "UV", "UV"],
    ["swift-super-maglev-frosted", "雾面", "Frosted"],
    ["swift-super-maglev-umbreon", "宝可梦 月亮伊布", "Pokémon Umbreon"],
  ] },
  { id: "gan-rsc-gsc", name: { zh: "Rubik's × GAN RSC", en: "Rubik's × GAN RSC" }, variants: [
    ["gan-rsc-gsc", "无磁版", "Non-magnetic"],
  ] },
  { id: "gan-gsc", name: { zh: "GAN GSC / GAN Speed Cube", en: "GAN GSC / GAN Speed Cube" }, variants: [
    ["gan-gsc", "无磁版", "Non-magnetic"],
  ] },
  { id: "gan356-i", name: { zh: "GAN356 i", en: "GAN356 i" }, variants: [
    ["gan356-i", "磁力版", "Magnetic"],
    ["gan356-i-5th-white", "五周年白色限定版", "White 5th Anniversary"],
  ] },
  { id: "gan356-i-carry", name: { zh: "GAN356 i Carry", en: "GAN356 i Carry" }, variants: [
    ["gan356-i-carry", "磁力版", "Magnetic"],
    ["gan356-i-carry-brainstorm", "Brainstorm Voyage", "Brainstorm Voyage"],
  ] },
  { id: "gan-i3", name: { zh: "GAN i3", en: "GAN i3" }, variants: [
    ["gan-i3", "基础版", "Base"],
    ["gan-i3-uv", "UV 智能", "UV"],
  ] },
  { id: "gan-i3-v2", name: { zh: "GAN356 i3 V2", en: "GAN356 i3 V2" }, variants: [
    ["gan-i3-v2", "磁力版", "Magnetic"],
  ] },
  { id: "gan356-i-carry2", name: { zh: "GAN356 i Carry 2", en: "GAN356 i Carry 2" }, variants: [
    ["gan356-i-carry2", "磁力版", "Magnetic"],
    ["gan356-i-carry2-uv", "UV", "UV"],
    ["gan356-i-carry2-10th", "UV 十周年版", "UV 10th Anniversary"],
  ] },
  { id: "gan356-i-carry-e", name: { zh: "GAN356 i Carry E", en: "GAN356 i Carry E" }, variants: [
    ["gan356-i-carry-e", "磁力版", "Magnetic"],
    ["gan356-i-carry-e-uv", "UV", "UV"],
  ] },
  { id: "gan-i-carry4", name: { zh: "GAN i Carry 4", en: "GAN i Carry 4" }, variants: [
    ["gan-i-carry4", "磁力版", "Magnetic"],
    ["gan-i-carry4-horse", "2026 马年版", "Year of the Horse"],
    ["gan-i-carry4-ssl", "SSL UV 限定", "SSL UV Limited"],
    ["gan-i-carry4-minions", "小黄人版", "Minions"],
  ] },
  { id: "gan-i4", name: { zh: "GAN i4", en: "GAN i4" }, variants: [
    ["gan-i4", "Leap 雾面", "Leap Frosted"],
    ["gan-i4-maglev-uv", "MagLev UV", "MagLev UV"],
    ["gan-i4-maglev-minions", "MagLev UV 小黄人版", "MagLev UV Minions"],
    ["gan-i4-maglev-frosted", "MagLev 雾面", "MagLev Frosted"],
  ] },
  { id: "gan12-ui-freeplay", name: { zh: "GAN12 ui Free Play", en: "GAN12 ui Free Play" }, variants: [
    ["gan12-ui-freeplay", "磁力版", "Magnetic"],
  ] },
  { id: "gan-mini-ui-freeplay", name: { zh: "GAN Mini ui Free Play 53 mm", en: "GAN Mini ui Free Play 53 mm" }, variants: [
    ["gan-mini-ui-freeplay", "磁力版", "Magnetic"],
  ] },
  { id: "gan12-ui-maglev", name: { zh: "GAN12 ui MagLev", en: "GAN12 ui MagLev" }, variants: [
    ["gan12-ui-maglev", "磁悬浮版", "MagLev"],
    ["gan12-ui-maglev-10th", "十周年版", "10th Anniversary"],
  ] },
  { id: "gan12-ui-maglev-v2", name: { zh: "GAN12 ui MagLev V2（商家命名）", en: "GAN12 ui MagLev V2 (retailer designation)" }, variants: [
    ["gan12-ui-maglev-v2", "GAN12 ui MagLev V2 UV（2026 商家命名）", "GAN12 ui MagLev V2 UV (retailer 2026 designation)"],
  ] },
  { id: "gan16-ui", name: { zh: "GAN16 ui", en: "GAN16 ui" }, variants: [
    ["gan16-ui", "MagLev MAX", "MagLev MAX"],
    ["gan16-ui-max-minions", "MAX UV 小黄人版", "MAX UV Minions"],
  ] },
  { id: "moyu-aolong-v5", name: { zh: "傲龙 V5", en: "AoLong V5" }, variants: [
    ["moyu-aolong-v5", "磁力", "Magnetic"],
    ["moyu-aolong-v5-20-magnet-ball-core-maglev-uv", "20 磁 球轴 + 磁悬浮 + UV", "20-Magnet Ball-Core + MagLev + UV"],
    ["moyu-aolong-v5-3x3-magnetic-uv", "磁力 + UV", "Magnetic + UV"],
    ["moyu-aolong-v5-8-magnet-ball-core-maglev-uv", "8 磁 球轴 + 磁悬浮 + UV", "8-Magnet Ball-Core + MagLev + UV"],
  ] },
  { id: "moyu-huameng-tg-v2", name: { zh: "TG V2", en: "TG V2" }, variants: [
    ["moyu-huameng-tg-v2", "8 磁 球轴 + UV", "8-Magnet Ball-Core + UV"],
    ["huameng-tg-v2-3x3-20-magnet-ball-core", "20 磁 球轴 + UV", "20-Magnet Ball-Core + UV"],
  ] },
  { id: "moyu-weilong-wrm-2021", name: { zh: "威龙 WR M 2021", en: "WeiLong WR M 2021" }, variants: [
    ["moyu-weilong-wrm-2021", "弹簧版", "Spring"],
    ["moyu-weilong-wr-m-2021-lite-3x3", "Lite", "Lite"],
    ["moyu-weilong-wr-m-maglev-3x3", "磁悬浮", "MagLev"],
  ] },
  { id: "moyu-rs3m-2020", name: { zh: "RS3 M 2020", en: "RS3 M 2020" }, variants: [
    ["moyu-rs3m-2020", "磁力版", "Magnetic"],
    ["moyu-rs3-m-2020-3x3-uv-coated", "UV", "UV Coated"],
    ["moyu-rs3-m-2020-3x3-picube-core-magnetic", "PiCube 磁轴", "PiCube Core-Magnetic"],
    ["moyu-rs3-m-2020-3x3-uv-picube-core-magnetic", "UV + PiCube 磁轴", "UV + PiCube Core-Magnetic"],
  ] },
  { id: "yj-mgc3-elite", name: { zh: "MGC3 Elite", en: "MGC3 Elite" }, variants: [
    ["yj-mgc3-elite", "磁力版", "Magnetic"],
  ] },
  { id: "yj-mgc3-elite-v2-3x3", name: { zh: "MGC3 Elite V2", en: "MGC3 Elite V2" }, variants: [
    ["yj-mgc3-elite-v2-3x3", "磁力版", "Magnetic"],
  ] },
  { id: "guoguan-yuexiao-edm", name: { zh: "月晓 E", en: "YueXiao E" }, variants: [
    ["guoguan-yuexiao-edm", "EDM · 磁力", "EDM · Magnetic"],
    ["guoguan-yuexiao-e", "E", "E"],
  ] },
  { id: "moyu-weilong-wrm", name: { zh: "威龙 WR", en: "WeiLong WR" }, variants: [
    ["moyu-weilong-wrm", "WR M · 磁力", "WR M · Magnetic"],
    ["moyu-weilong-wr", "WR", "WR"],
  ] },
  { id: "mfjs-mf3rs3", name: { zh: "MF3RS3", en: "MF3RS3" }, variants: [
    ["mfjs-mf3rs3", "原版", "Original"],
    ["mfjs-mf3rs3-m", "M", "M"],
  ] },
  { id: "yj-mini-pillowed", name: { zh: "永骏枕形迷你三阶", en: "YJ Mini Pillowed" }, variants: [
    ["yj-mini-pillowed", "4.5cm", "4.5cm"],
    ["yj-mini-pillowed-35mm", "35 mm（YJ8351）", "35 mm (YJ8351)"],
    ["yj-mini-pillowed-3x3-keychain-cube-2-0cm", "钥匙扣 (2.0cm)", "Keychain Cube (2.0cm)"],
  ] },
  { id: "yj-guanlong", name: { zh: "冠龙", en: "GuanLong" }, variants: [
    ["yj-guanlong", "原版", "Original"],
  ] },
  { id: "yj-guanlong-v3", name: { zh: "冠龙 V3 / Plus V3（YJ8358）", en: "GuanLong V3 / Plus V3 (YJ8358)" }, variants: [
    ["yj-guanlong-v3", "原版", "Original"],
  ] },
  { id: "yj-guanlong-plus", name: { zh: "冠龙 Plus / V2（YJ8335）", en: "GuanLong Plus / V2 (YJ8335)" }, variants: [
    ["yj-guanlong-plus", "原版", "Original"],
  ] },
  { id: "yj-chilong", name: { zh: "驰龙", en: "ChiLong" }, variants: [
    ["yj-chilong", "原版", "Original"],
  ] },
  { id: "yj-chilong-v2", name: { zh: "ChiLong V2", en: "ChiLong V2" }, variants: [
    ["yj-chilong-v2", "原版", "Original"],
  ] },
  { id: "yj-3x3-ball-cube", name: { zh: "永骏 Ball Cube", en: "YJ Ball Cube" }, variants: [
    ["yj-3x3-ball-cube", "Ball Cube", "Ball Cube"],
  ] },
  { id: "yj-mini-bead-keychain-35mm", name: { zh: "圆珠面钥匙扣 35 mm（YJ8396）", en: "Mini Bead Keychain 35 mm (YJ8396)" }, variants: [
    ["yj-mini-bead-keychain-35mm", "原版", "Original"],
  ] },
  { id: "moyu-weilong-v2", name: { zh: "威龙 V2", en: "WeiLong V2" }, variants: [
    ["moyu-weilong-v2", "原版", "Original"],
  ] },
  { id: "mini-moyu-weilong-v2-54-5mm", name: { zh: "迷你 威龙 V2 (54.5mm)", en: "Mini MoYu WeiLong V2 (54.5mm)" }, variants: [
    ["mini-moyu-weilong-v2-54-5mm", "原版", "Original"],
  ] },
  { id: "moyu-weilong-gts3", name: { zh: "威龙 GTS3", en: "WeiLong GTS3" }, variants: [
    ["moyu-weilong-gts3", "原版", "Original"],
    ["moyu-weilong-gts3-m", "M", "M"],
    ["moyu-weilong-gts3-lm", "LM", "LM"],
    ["moyu-weilong-gts3-m-le", "M (LE)", "M (LE)"],
  ] },
  { id: "moyu-weilong-gts2", name: { zh: "威龙 GTS2", en: "WeiLong GTS2" }, variants: [
    ["moyu-weilong-gts2", "原版", "Original"],
    ["moyu-weilong-gts2-m", "M", "M"],
    ["moyu-weilong-gts2-m-le", "M (LE)", "M (LE)"],
    ["moyu-weilong-gts2-m-2019", "M 2019 更新版", "M 2019 Edition"],
    ["moyu-weilong-gts2-m-wca-record-edition", "M (WCA 纪录纪念版)", "M (WCA Record Edition)"],
  ] },
  { id: "moyu-aolong-v2", name: { zh: "傲龙 V2", en: "AoLong V2" }, variants: [
    ["moyu-aolong-v2", "原版", "Original"],
    ["moyu-aolong-v2-le", "LE", "LE"],
  ] },
  { id: "moyu-aolong", name: { zh: "傲龙", en: "AoLong" }, variants: [
    ["moyu-aolong", "原版", "Original"],
  ] },
  { id: "mini-moyu-aolong-54-5mm", name: { zh: "迷你 傲龙 (54.5mm)", en: "Mini MoYu AoLong (54.5mm)" }, variants: [
    ["mini-moyu-aolong-54-5mm", "原版", "Original"],
  ] },
  { id: "guoguan-yuexiao-pro", name: { zh: "月晓 Pro", en: "YueXiao Pro" }, variants: [
    ["guoguan-yuexiao-pro", "原版", "Original"],
    ["guoguan-yuexiao-pro-m", "M", "M"],
  ] },
  { id: "moyu-super-aolong-ai", name: { zh: "超级傲龙 AI", en: "Super AoLong AI" }, variants: [
    ["moyu-super-aolong-ai", "8 磁 球轴 + 磁悬浮 + UV", "8-Magnet Ball-Core + MagLev + UV"],
    ["moyu-super-aolong-ai-3x3-19th-anniversary-edition-smart-cube", "智能, 19 周年版", "Smart Cube, 19th Anniversary Edition"],
  ] },
  { id: "moyu-super-aolong", name: { zh: "超级傲龙", en: "Super AoLong" }, variants: [
    ["moyu-super-aolong", "20 磁 球轴 + 磁悬浮", "20-Magnet Ball-Core + MagLev"],
    ["moyu-super-aolong-3x3-20-magnet-ball-core-maglev-uv", "20 磁 球轴 + 磁悬浮 + UV", "20-Magnet Ball-Core + MagLev + UV"],
    ["moyu-super-aolong-3x3-19th-anniversary-edition", "19 周年版", "19th Anniversary Edition"],
  ] },
  { id: "yj-meta3", name: { zh: "Meta3", en: "Meta3" }, variants: [
    ["yj-meta3", "侧翼定位标准版", "Wing-Magnetic Standard"],
    ["yj-meta3-3x3-8-magnet-ball-core-uv", "8 磁 球轴 + UV", "8-Magnet Ball-Core + UV"],
    ["yj-meta3-3x3-wing-magnetic-8-magnet-ball-core-uv", "翼磁 + 8 磁 球轴 + UV", "Wing-Magnetic + 8-Magnet Ball-Core + UV"],
  ] },
  { id: "moyu-weilong-v11-ai", name: { zh: "威龙 V11 AI", en: "WeiLong V11 AI" }, variants: [
    ["moyu-weilong-v11-ai", "磁悬浮 + UV", "MagLev + UV"],
    ["moyu-weilong-v11-ai-3x3-8-magnet-ball-core-maglev-18th-anniversary-edition", "(8 磁 球轴 + 磁悬浮 + UV) - 18 周年版", "(8-Magnet Ball-Core + MagLev + UV) - 18th Anniversary Edition"],
    ["moyu-weilong-v11-ai-3x3-smart-cube-guided-recovery-edition", "智能, 指示复原版", "Smart Cube, Guided Recovery Edition"],
  ] },
  { id: "moyu-weilong-v11", name: { zh: "威龙 V11", en: "WeiLong V11" }, variants: [
    ["moyu-weilong-v11", "磁力", "Magnetic"],
    ["moyu-weilong-v11-3x3-20-magnet-ball-core-maglev-uv", "20 磁 球轴 + 磁悬浮 + UV", "20-Magnet Ball-Core + MagLev + UV"],
    ["moyu-weilong-v11-3x3-8-magnet-ball-core-uv", "8 磁 球轴 + UV", "8-Magnet Ball-Core + UV"],
    ["moyu-weilong-v11-3x3-magnetic-uv", "磁力 + UV", "Magnetic + UV"],
    ["moyu-weilong-v11-3x3-20-magnet-ball-core-maglev-18th-anniversary-edition", "(20 磁 球轴 + 磁悬浮 + UV) - 18 周年版", "(20-Magnet Ball-Core + MagLev + UV) - 18th Anniversary Edition"],
    ["moyu-weilong-v11-se-3x3-20-magnet-ball-core-maglev-uv", "SE (20 磁 球轴 + 磁悬浮 + UV)", "SE (20-Magnet Ball-Core + MagLev + UV)"],
    ["moyu-weilong-v11-se-3x3-magnetic", "SE (磁力)", "SE (Magnetic)"],
    ["moyu-weilong-ferrocore-v2-3x3", "威龙 Ferrocore V2", "WeiLong Ferrocore V2"],
    ["moyu-weilong-ferrocore-v2-3x3-uv-coated", "威龙 Ferrocore V2 (UV)", "WeiLong Ferrocore V2 (UV Coated)"],
    ["moyu-weilong-v11-3x3-8-magnet-ball-core-maglev-edge-repulsion-uv-picube-se", "8 磁 球轴 + 磁悬浮 + 棱块排斥磁力 + UV PiCube 特别版", "8-Magnet Ball-Core + MagLev + Edge-Repulsion + UV PiCube SE"],
    ["moyu-weilong-v11-3x3-8-magnet-ball-core-maglev-uv-picube-se", "8 磁 球轴 + 磁悬浮 + UV PiCube 特别版", "8-Magnet Ball-Core + MagLev + UV PiCube SE"],
    ["moyu-weilong-v11-3x3-8-magnet-ball-core-spring-edge-repulsion-uv-picube-se", "8 磁 球轴 + 弹簧 + 棱块排斥磁力 + UV PiCube 特别版", "8-Magnet Ball-Core + Spring + Edge-Repulsion + UV PiCube SE"],
    ["moyu-weilong-v11-3x3-8-magnet-ball-core-spring-uv-picube-se", "8 磁 球轴 + 弹簧 + UV PiCube 特别版", "8-Magnet Ball-Core + Spring + UV PiCube SE"],
  ] },
  { id: "yj-yulong-2025", name: { zh: "御龙 V3 M", en: "YuLong V3 M" }, variants: [
    ["yj-yulong-2025", "磁力版", "Magnetic"],
    ["yj-yulong-3x3-v3-m-uv-coated", "UV", "UV Coated"],
    ["yj-yulong-3x3-v3-m-uv-coated-clicky", "UV + 嘀嗒发声", "UV Coated + Clicky"],
  ] },
  { id: "yj-mgc3-beta", name: { zh: "MGC3 Beta", en: "MGC3 Beta" }, variants: [
    ["yj-mgc3-beta", "磁力版", "Magnetic"],
    ["yj-mgc3-beta-8-magnet-ball-core-uv-coated", "8 磁 球轴 + UV", "8-Magnet Ball-Core + UV Coated"],
    ["yj-mgc3-beta-8-magnet-ball-core-uv-coated-maglev", "8 磁 球轴 + UV + 磁悬浮", "8-Magnet Ball-Core + UV Coated + MagLev"],
    ["yj-mgc3-beta-limited-edition", "限定版", "Limited Edition"],
    ["yj-mgc3-beta-3x3-aero-maglev-uv", "Aero (磁悬浮 + UV)", "Aero (MagLev + UV)"],
  ] },
  { id: "yj-mgc-sigma-3x3", name: { zh: "MGC Sigma", en: "MGC Sigma" }, variants: [
    ["yj-mgc-sigma-3x3", "磁力版", "Magnetic"],
  ] },
  { id: "moyu-super-weilong-v2-ai", name: { zh: "超级威龙 V2 AI", en: "Super WeiLong V2 AI" }, variants: [
    ["moyu-super-weilong-v2-ai", "8 磁 球轴 + 磁悬浮 + UV", "8-Magnet Ball-Core + MagLev + UV"],
    ["moyu-super-weilong-3x3-v2-ai-20-magnet-ball-core-maglev-18th-anniversary-edition", "(8 磁 球轴 + 磁悬浮) - 18 周年版", "(8-Magnet Ball-Core + MagLev) - 18th Anniversary Edition"],
  ] },
  { id: "moyu-super-weilong-v2", name: { zh: "超级威龙 V2", en: "Super WeiLong V2" }, variants: [
    ["moyu-super-weilong-v2", "20 磁 球轴 + 磁悬浮 + UV", "20-Magnet Ball-Core + MagLev + UV"],
    ["moyu-super-weilong-3x3-v2-20-magnet-ball-core-uv", "20 磁 球轴 + UV", "20-Magnet Ball-Core + UV"],
    ["moyu-super-weilong-3x3-v2-20-magnet-ball-core-maglev-18th-anniversary-edition", "(20 磁 球轴 + 磁悬浮) - 18 周年版", "(20-Magnet Ball-Core + MagLev) - 18th Anniversary Edition"],
  ] },
  { id: "moyu-huameng-tg", name: { zh: "TG", en: "TG" }, variants: [
    ["moyu-huameng-tg", "球轴", "Ball-Core"],
    ["huameng-tg-3x3-ball-core-uv", "球轴 UV", "Ball-Core UV"],
    ["huameng-tg-3x3-maglev-ball-core", "磁悬浮 + 球轴", "MagLev + Ball-Core"],
    ["huameng-tg-3x3-maglev-ball-core-uv", "磁悬浮 + 球轴 + UV", "MagLev + Ball-Core + UV"],
    ["huameng-tg-3x3-spirit-pearl-limited-edition", "灵珠 (限定版)", "Spirit Pearl (Limited Edition)"],
  ] },
  { id: "moyu-weilong-v10-ai", name: { zh: "威龙 V10 AI", en: "WeiLong V10 AI" }, variants: [
    ["moyu-weilong-v10-ai", "磁力版", "Magnetic"],
    ["moyu-weilong-v10-ai-3x3-uv", "UV", "UV"],
    ["moyu-weilong-v10-ai-3x3-maglev-uv", "磁悬浮 UV", "MagLev UV"],
    ["moyu-weilong-v10-ai-3x3-lite", "Lite", "Lite"],
    ["moyu-weilong-ai-3x3-uv-wcu-edition", "(UV) - WCU Edition", "(UV) - WCU Edition"],
  ] },
  { id: "moyu-weilong-wrm-v10", name: { zh: "威龙 WRM V10", en: "WeiLong WRM V10" }, variants: [
    ["moyu-weilong-wrm-v10", "磁力版", "Magnetic"],
    ["moyu-weilong-wrm-v10-3x3-20-core-magnetic-ball-core-uv", "20 磁 球轴 + UV", "20-Magnet Ball-Core + UV"],
    ["moyu-weilong-wrm-v10-3x3-20-core-magnetic-maglev-ball-core-uv", "20 磁 球轴 + 磁悬浮 + UV", "20-Magnet Ball-Core + MagLev + UV"],
    ["moyu-weilong-wrm-v10-3x3-uv", "UV", "UV"],
    ["moyu-weilong-wrm-v10-3x3-uv-special-edition", "UV PiCube 特别版", "UV PiCube SE"],
    ["moyu-weilong-ferrocore-3x3-custom-wr-m-v10", "威龙 Ferrocore (特别版 WRM V10)", "WeiLong Ferrocore (Special Edition WRM V10)"],
    ["moyu-weilong-ferrocore-uv-3x3-special-edition-wrm-v10", "威龙 Ferrocore UV (特别版 WRM V10)", "WeiLong Ferrocore UV (Special Edition WRM V10)"],
    ["moyu-weilong-wrm-v10-3x3-edge-repulsion-uv-picube-se", "棱块排斥磁力 + UV PiCube 特别版", "Edge-Repulsion + UV PiCube SE"],
  ] },
  { id: "mfjs-meilong3m-v2", name: { zh: "梅龙 3M V2", en: "MeiLong 3M V2" }, variants: [
    ["mfjs-meilong3m-v2", "磁力版", "Magnetic"],
    ["mfjs-meilong-3m-v2-lite", "Lite", "Lite"],
    ["mfjs-meilong-3m-v2-uv-coated", "UV", "UV Coated"],
  ] },
  { id: "moyu-super-weilong", name: { zh: "超级威龙", en: "Super WeiLong" }, variants: [
    ["moyu-super-weilong", "8 磁轴 磁力 + 磁悬浮 + UV", "8-Core Magnetic + MagLev + UV"],
    ["moyu-super-weilong-3x3-20-core-magnetic-maglev", "20 磁 球轴 + 磁悬浮 + UV", "20-Magnet Ball-Core + MagLev + UV"],
    ["moyu-super-weilong-3x3-8-core-magnetic-spring-tension", "8 磁轴 磁力 + 双调弹簧 + UV", "8-Core Magnetic + Spring Tension + UV"],
    ["moyu-super-weilong-3x3-lite-20-core-magnetic-maglev", "Lite (20 磁 球轴 + 磁悬浮 + UV)", "Lite (20-Magnet Ball-Core + MagLev + UV)"],
    ["moyu-super-weilong-3x3-lite-8-core-magnetic-maglev", "Lite (8 磁轴 磁力 + 磁悬浮 + UV)", "Lite (8-Core Magnetic + MagLev + UV)"],
    ["moyu-super-weilong-3x3-lite-8-core-magnetic-spring-tension", "Lite (8 磁轴 磁力 + 双调弹簧 + UV)", "Lite (8-Core Magnetic + Spring Tension + UV)"],
  ] },
  { id: "moyu-rs3m-v5", name: { zh: "RS3 M V5", en: "RS3 M V5" }, variants: [
    ["moyu-rs3m-v5", "标准版", "Standard"],
    ["moyu-rs3-m-v5-3x3-ball-core-uv-robot-cube-stand", "球轴 UV + 机器人支架", "Ball Core UV + Robot Cube Stand"],
    ["moyu-rs3-m-v5-3x3-maglev-robot-cube-stand", "磁悬浮 + 机器人支架", "MagLev + Robot Cube Stand"],
    ["moyu-rs3-m-v5-3x3-spring-tension", "双调弹簧", "Spring Tension"],
    ["moyu-rs3-m-v5-3x3-spring-tension-robot-cube-stand", "双调弹簧 + 机器人支架", "Spring Tension + Robot Cube Stand"],
    ["moyu-rs3-m-v5-3x3-picube-special-edition", "PiCube 磨砂 特别版", "PiCube Matte Special Edition"],
    ["moyu-rs3-m-v5-3x3-picube-uv-special-edition", "PiCube UV 特别版", "PiCube UV Special Edition"],
    ["moyu-rs3-m-v5-3x3-se-magnetic", "SE (磁力)", "SE (Magnetic)"],
    ["moyu-rs3-m-v5-se-3x3-magnetic-spring-tension", "SE (磁力 + 双调弹簧)", "SE (Magnetic + Spring Tension)"],
    ["moyu-rs3-m-v5-se-3x3-8-magnet-ball-core-maglev-uv", "SE (8 磁 球轴 + 磁悬浮 + UV)", "SE (8-Magnet Ball-Core + MagLev + UV)"],
    ["moyu-rs3-m-v5-spring-tension-ball-core-matte-saocube-se", "双调弹簧 + 球轴 + 磨砂 SAOCube 特别版", "Spring-Tension + Ball-Core + Matte SAOCube SE"],
    ["moyu-rs3-m-v5-spring-tension-ball-core-uv-saocube-se", "双调弹簧 + 球轴 + UV SAOCube 特别版", "Spring-Tension + Ball-Core + UV SAOCube SE"],
    ["moyu-rs3-m-v5-3x3-8-m-ball-core-transparent-core-uv-saocube-se", "双调弹簧 + 球轴 + 透明轴 + UV SAOCube 特别版", "Spring-Tension + Ball-Core + Transparent Core + UV SAOCube SE"],
  ] },
  { id: "moyu-super-rs3m-v2", name: { zh: "Super RS3 M V2", en: "Super RS3 M V2" }, variants: [
    ["moyu-super-rs3m-v2", "磁力 UV", "Magnetic UV"],
    ["moyu-super-rs3-m-v2-ball-core-uv-3x3", "球轴 UV", "Ball-Core UV"],
    ["moyu-super-rs3-m-v2-maglev-uv-3x3", "磁悬浮 UV", "MagLev UV"],
  ] },
  { id: "moyu-weilong-wrm-v9", name: { zh: "威龙 WRM V9", en: "WeiLong WRM V9" }, variants: [
    ["moyu-weilong-wrm-v9", "磁力版", "Magnetic"],
    ["moyu-weilong-wrm-v9-3x3-ball-core-uv", "球轴 + 磁悬浮 + UV", "Ball-Core + MagLev + UV"],
    ["moyu-weilong-wrm-v9-3x3-maglev", "磁悬浮", "MagLev"],
    ["moyu-weilong-wrm-v9-3x3-ball-core-uv-special-edition", "球轴 UV 特别版", "Ball-Core UV Special Edition"],
    ["moyu-weilong-wrm-v9-3x3-20-core-magnetic-maglev-ball-core-uv", "20 磁 球轴 + 磁悬浮 + UV", "20-Magnet Ball-Core + MagLev + UV"],
  ] },
  { id: "yj-mgc-evo-ii", name: { zh: "MGC Evo II", en: "MGC Evo II" }, variants: [
    ["yj-mgc-evo-ii", "磁力版", "Magnetic"],
    ["yj-mgc-evo-ii-3x3-enhanced-core-positioning-edition", "磁轴增强版", "Enhanced Core Positioning Edition"],
    ["yj-mgc-evo-ii-3x3-uv-coated", "UV", "UV Coated"],
  ] },
  { id: "moyu-huameng-ys3m", name: { zh: "YS3M", en: "YS3M" }, variants: [
    ["moyu-huameng-ys3m", "磁力版", "Magnetic"],
    ["huameng-ys3m-3x3-ball-core-magnetic-core-maglev", "球轴 (磁轴 + 磁悬浮)", "Ball-Core (Magnetic Core + MagLev)"],
    ["huameng-ys3m-3x3-maglev", "磁悬浮", "MagLev"],
    ["huameng-ys3m-3x3-ball-core-uv-magnetic-core-maglev", "球轴 UV (磁轴 + 磁悬浮)", "Ball-Core UV (Magnetic Core + MagLev)"],
    ["huameng-ys3-m-20-core-magnetic-maglev-ball-core-uv", "YS3 M (20 磁 球轴 + 磁悬浮 + UV)", "YS3 M (20-Magnet Ball-Core + MagLev + UV)"],
  ] },
  { id: "moyu-super-rs3m-2022", name: { zh: "Super RS3 M 2022", en: "Super RS3 M 2022" }, variants: [
    ["moyu-super-rs3m-2022", "磁力版", "Magnetic"],
    ["moyu-super-rs3-m-2022-3x3-ball-core-magnetic-core-maglev", "球轴 (磁轴 + 磁悬浮)", "Ball-Core (Magnetic Core + MagLev)"],
    ["moyu-super-rs3-m-2022-3x3-maglev", "磁悬浮", "MagLev"],
  ] },
  { id: "moyu-aolong-v5-ai", name: { zh: "傲龙 V5 AI", en: "AoLong V5 AI" }, variants: [
    ["moyu-aolong-v5-ai", "磁力版", "Magnetic"],
    ["moyu-aolong-v5-ai-maglev-uv", "8 磁球轴 磁悬浮 UV", "8-Magnet Ball-Core MagLev UV"],
    ["moyu-aolong-v5-ai-uv", "磁力 UV", "Magnetic UV"],
  ] },
  { id: "stellar-core-3x3", name: { zh: "星耀", en: "Stellar" }, variants: [
    ["stellar-core-3x3", "Core", "Core"],
    ["stellar-ultra-3x3", "Ultra", "Ultra"],
  ] },
  { id: "mfjs-love-u-mf8942", name: { zh: "LOVE U（MF8942）", en: "LOVE U (MF8942)" }, variants: [
    ["mfjs-love-u-mf8942", "LOVE U 爱心文字（MF8942）", "Original"],
  ] },
  { id: "mfjs-black-crystal", name: { zh: "Black Crystal 黑晶三阶", en: "Black Crystal" }, variants: [
    ["mfjs-black-crystal-diamond", "菱形", "Diamond"],
    ["mfjs-black-crystal-apple", "苹果", "Apple"],
    ["mfjs-black-crystal-clover", "四叶草", "Clover"],
  ] },
  { id: "moyu-teaching-aotu", name: { zh: "魔域教学三阶", en: "MoYu Teaching Cube" }, variants: [
    ["moyu-teaching-aotu", "凹凸", "Aotu"],
    ["moyu-teaching-fries", "薯条", "Fries"],
    ["moyu-teaching-red-riding-hood", "小红帽", "Red Riding Hood"],
    ["moyu-teaching-sandwich", "三明治", "Sandwich"],
    ["moyu-teaching-unicorn", "独角兽", "Unicorn"],
  ] },
  { id: "shengshou-lustrous", name: { zh: "圣手 Lustrous", en: "Lustrous" }, variants: [
    ["shengshou-lustrous", "Cube", "Cube"],
    ["shengshou-lustrous-cube-3x3-magnetic", "Cube (磁力)", "Cube (Magnetic)"],
    ["shengshou-lustrous-cube-3x3-jelly", "Cube (Jelly)", "Cube (Jelly)"],
    ["shengshou-lustrous-cube-3x3-jelly-magnetic", "Cube (Jelly, 磁力)", "Cube (Jelly, Magnetic)"],
  ] },
  { id: "dayan-guhong-pro-m", name: { zh: "大雁孤鸿 Pro M", en: "GuHong Pro M" }, variants: [
    ["dayan-guhong-pro-m", "55mm (标准版)", "55mm (Standard)"],
    ["dayan-guhong-pro-m-3x3-54mm-maglev", "54mm (磁悬浮)", "54mm (MagLev)"],
    ["dayan-guhong-pro-m-3x3-54mm-standard", "54mm (标准版)", "54mm (Standard)"],
    ["dayan-guhong-pro-m-3x3-55mm-maglev", "55mm (磁悬浮)", "55mm (MagLev)"],
    ["dayan-guhong-pro-m-3x3-56mm-maglev", "56mm (磁悬浮)", "56mm (MagLev)"],
    ["dayan-guhong-pro-m-3x3-56mm-standard", "56mm (标准版)", "56mm (Standard)"],
  ] },
  { id: "dayan-zhanchi-v5-m", name: { zh: "大雁展翅 V5 M", en: "ZhanChi V5 M" }, variants: [
    ["dayan-zhanchi-v5-m", "标准版", "Standard"],
    ["dayan-zhanchi-v5-m-3x3-fancy", "Fancy", "Fancy"],
    ["dayan-zhanchi-v5-m-3x3-premium", "Premium", "Premium"],
  ] },
  { id: "dayan-guhong-pro-plus", name: { zh: "大雁孤鸿 Pro+", en: "GuHong Pro+" }, variants: [
    ["dayan-guhong-pro-plus", "56mm (磁力)", "56mm (Magnetic)"],
    ["dayan-guhong-pro-3x3-54mm-maglev", "54mm (磁悬浮)", "54mm (MagLev)"],
    ["dayan-guhong-pro-3x3-54mm-magnetic", "54mm (磁力)", "54mm (Magnetic)"],
    ["dayan-guhong-pro-3x3-55mm-maglev", "55mm (磁悬浮)", "55mm (MagLev)"],
    ["dayan-guhong-pro-3x3-55mm-magnetic", "55mm (磁力)", "55mm (Magnetic)"],
    ["dayan-guhong-pro-3x3-56mm-maglev", "56mm (磁悬浮)", "56mm (MagLev)"],
  ] },
  { id: "diansheng-solar-s3m-2022", name: { zh: "点盛 Solar S3M 2022", en: "Solar S3M 2022" }, variants: [
    ["diansheng-solar-s3m-2022", "磁力版", "Magnetic"],
    ["diansheng-solar-s3m-2022-3x3-maglev", "磁悬浮", "MagLev"],
  ] },
  { id: "yuxin-huanglong", name: { zh: "裕鑫黄龙", en: "HuangLong" }, variants: [
    ["yuxin-huanglong", "M", "M"],
    ["yuxin-huanglong-nonmag", "原版", "Original"],
  ] },
  { id: "yuxin-little-magic-v3-maglev", name: { zh: "裕鑫小魔法 V3", en: "Little Magic V3" }, variants: [
    ["yuxin-little-magic-v3-maglev", "磁悬浮", "MagLev"],
    ["yuxin-little-magic-3x3-v3-maglev-uv", "磁悬浮 + UV", "MagLev + UV"],
  ] },
  { id: "yuxin-kylin-v2", name: { zh: "裕鑫 Kylin V2", en: "Kylin V2" }, variants: [
    ["yuxin-kylin-v2", "M", "M"],
    ["yuxin-black-kirin-v2-tiled", "Tiled", "Tiled"],
  ] },
  { id: "diansheng-ms3r", name: { zh: "点盛 MS3R", en: "MS3R" }, variants: [
    ["diansheng-ms3r", "磁力版", "Magnetic"],
    ["diansheng-ms3r-3x3-uv-coated", "UV", "UV Coated"],
  ] },
  { id: "dayan-zhanchi-mini", name: { zh: "大雁迷你展翅", en: "Mini ZhanChi" }, variants: [
    ["dayan-zhanchi-50mm", "50mm", "50mm"],
    ["dayan-zhanchi-55mm", "55mm", "55mm"],
    ["dayan-zhanchi-42mm", "42mm", "42mm"],
  ] },
  { id: "dayan-zhanchi", name: { zh: "大雁展翅", en: "ZhanChi" }, variants: [
    ["dayan-zhanchi", "大雁 展翅", "Non-magnetic"],
  ] },
  { id: "diansheng-mscube-ms3l", name: { zh: "MSCube MS3L", en: "MSCube MS3L" }, variants: [
    ["diansheng-mscube-ms3l", "标准版", "Standard"],
    ["diansheng-mscube-ms3l-enhanced", "增强版", "Enhanced"],
  ] },
  { id: "yuxin-little-magic-m", name: { zh: "裕鑫小魔法 M", en: "Little Magic M" }, variants: [
    ["yuxin-little-magic-m", "磁力版", "Magnetic"],
    ["yuxin-little-magic-3x3-m-uv", "UV", "UV"],
  ] },
  { id: "shengshou-legend", name: { zh: "圣手 Legend", en: "Legend" }, variants: [
    ["shengshou-legend", "无磁版", "Non-magnetic"],
    ["shengshou-legend-3x3-m-metallic", "M (Metallic)", "M (Metallic)"],
    ["shengshou-legend-3x3-metallic", "Metallic", "Metallic"],
  ] },
  { id: "diansheng-3x3-m", name: { zh: "点盛三阶", en: "DianSheng 3×3" }, variants: [
    ["diansheng-3x3-m", "磁力版", "Magnetic"],
    ["diansheng-3x3-m-uv-coated", "磁力 · UV", "Magnetic · UV"],
    ["diansheng-3x3-metal-cube", "Metal Cube", "Metal Cube"],
  ] },
  { id: "yuxin-little-magic-v2-m", name: { zh: "裕鑫小魔法 V2 M", en: "Little Magic V2 M" }, variants: [
    ["yuxin-little-magic-v2-m", "磁力版", "Magnetic"],
    ["yuxin-little-magic-3x3-v2-m-uv", "UV", "UV"],
  ] },
  { id: "yuxin-huanglong-v2-m", name: { zh: "裕鑫黄龙 V2 M", en: "HuangLong V2 M" }, variants: [
    ["yuxin-huanglong-v2-m", "磁力版", "Magnetic"],
    ["yuxin-huanglong-3x3-v2-m-uv-coated", "UV", "UV Coated"],
  ] },
  { id: "diansheng-mscube-ms3-v1", name: { zh: "MSCube MS3-V1 M", en: "MSCube MS3-V1 M" }, variants: [
    ["diansheng-mscube-ms3-v1", "标准版", "Standard"],
    ["diansheng-mscube-ms3-v1-enhanced", "增强版", "Enhanced"],
  ] },
  { id: "xman-tornado-v3", name: { zh: "风三代 / Tornado V3", en: "Tornado V3" }, variants: [
    ["xman-tornado-v3", "M 旗舰版", "M Flagship"],
    ["xman-tornado-v3-standard", "M 标准版", "M Standard"],
    ["xman-tornado-v3-pioneer", "M 先锋版 (磁力轴心 + 磁悬浮)", "M Pioneer (Magnetic Core + MagLev)"],
    ["xman-tornado-v3-pioneer-uv", "M 先锋版 UV", "M Pioneer UV"],
    ["xman-tornado-v3-m-pioneer-limited-edition", "M 先锋版 (限量版)", "M Pioneer (Limited Edition)"],
    ["xman-tornado-v3-m-pioneer-firefly-2024-limited-edition", "M 先锋版 (Firefly 2024 限量版)", "M Pioneer (Firefly 2024 Limited Edition)"],
    ["xman-tornado-v3-m-pioneer-3x3-revived-limited-edition", "M 先锋版 (Revived 限量版)", "M Pioneer (Revived Limited Edition)"],
    ["xman-tornado-v3-premium-flagship", "Premium (旗舰版 UV)", "Premium (Flagship UV)"],
    ["xman-tornado-v3-premium-pioneer", "Premium (先锋版 UV)", "Premium (Pioneer UV)"],
    ["xman-tornado-v3-premium-standard", "Premium (标准版)", "Premium (Standard)"],
    ["xman-tornado-v3-3x3-premium-flagship-uv-saocube-se", "Premium (旗舰版 UV SAOCube 特别版)", "Premium (Flagship UV SAOCube SE)"],
    ["xman-tornado-v3-3x3-premium-flagship-uv-20-m-ball-core-saocube-se", "Premium (旗舰版 UV + 20 磁球轴 SAOCube 特别版)", "Premium (Flagship UV + 20-M Ball-Core SAOCube SE)"],
  ] },
  { id: "xman-tornado-v4-ai", name: { zh: "风四代 AI / Tornado V4 AI", en: "Tornado V4 AI" }, variants: [
    ["xman-tornado-v4-ai", "UV", "UV"],
    ["xman-tornado-v4-ai-3x3-uv-zephyr-le", "UV (Zephyr LE)", "UV (Zephyr LE)"],
  ] },
  { id: "qiyi-m-pro-v3", name: { zh: "奇艺 M Pro V3", en: "M Pro V3" }, variants: [
    ["qiyi-m-pro-v3", "旗舰版", "Flagship"],
    ["qiyi-m-pro-3x3-v3-pioneer-uv", "先锋版 UV", "Pioneer UV"],
  ] },
  { id: "xman-tornado-v2", name: { zh: "风二代 / Tornado V2", en: "Tornado V2" }, variants: [
    ["xman-tornado-v2", "M", "M"],
    ["xman-tornado-v2-limited-edition", "限量版", "Limited Edition"],
    ["xman-tornado-v2-le-infinity-stone", "LE Infinity Stone", "LE Infinity Stone"],
  ] },
  { id: "qiyi-m-pro-v2", name: { zh: "奇艺 M Pro V2", en: "M Pro V2" }, variants: [
    ["qiyi-m-pro-v2", "旗舰版", "Flagship"],
    ["qiyi-m-pro-v2-3x3-pioneer-uv", "先锋版 UV", "Pioneer UV"],
  ] },
  { id: "qiyi-m-pro", name: { zh: "奇艺 M Pro", en: "M Pro" }, variants: [
    ["qiyi-m-pro", "磁力版", "Magnetic"],
    ["qiyi-m-pro-3x3-maglev", "磁悬浮", "MagLev"],
    ["qiyi-m-pro-3x3-ball-core-uv", "Ball-Core UV", "Ball-Core UV"],
    ["qiyi-m-pro-3x3-art-version", "艺术版", "Art Version"],
  ] },
  { id: "qiyi-m-pro-elite", name: { zh: "奇艺 M Pro Elite", en: "M Pro Elite" }, variants: [
    ["qiyi-m-pro-3x3-elite", "磁力版", "Magnetic"],
    ["qiyi-m-pro-3x3-elite-uv-coated", "UV", "UV Coated"],
  ] },
  { id: "xman-tornado-v4", name: { zh: "风四代 / Tornado V4", en: "Tornado V4" }, variants: [
    ["xman-tornado-v4", "M (旗舰版)", "M (Flagship)"],
    ["xman-tornado-v4-pioneer", "M (先锋版 UV)", "M (Pioneer UV)"],
    ["xman-tornado-v4-m-3x3-limited-edition", "M (限量版)", "M (Limited Edition)"],
    ["xman-tornado-v4-m-3x3-flagship-special-edition", "M (旗舰版) - 特别版", "M (Flagship) - Special Edition"],
    ["xman-tornado-v4-m-3x3-flagship-blue-core-special-edition", "M (旗舰版) - 蓝轴 特别版", "M (Flagship) - Blue Core Special Edition"],
    ["xman-tornado-v4-m-3x3-flagship-red-core-special-edition", "M (旗舰版) - 红轴 特别版", "M (Flagship) - Red Core Special Edition"],
    ["xman-tornado-v4-10th-anniversary-limited-edition", "十周年 限量版", "10th Anniversary Limited Edition"],
    ["xman-tornado-v4-3x3-flagship-picube-special-edition", "(旗舰版) - PiCube 特别版", "(Flagship) - PiCube Special Edition"],
  ] },
  { id: "qiyi-warrior-m", name: { zh: "奇艺勇士 M", en: "Warrior M" }, variants: [
    ["qiyi-warrior-m", "磁力", "Magnetic"],
    ["qiyi-warrior-m-3x3-magnetic-uv-coated", "磁力 + UV", "Magnetic + UV Coated"],
  ] },
  { id: "xman-xt3-v1", name: { zh: "X-Man XT3 V1", en: "X-Man XT3 V1" }, variants: [
    ["xman-xt3-v1", "旗舰版", "Flagship"],
    ["xman-xt3-v1-pioneer", "先锋版 磁悬浮 + UV", "Pioneer MagLev + UV"],
    ["xman-xt3-v1-flagship-uv", "旗舰版 + UV", "Flagship + UV"],
  ] },
  { id: "qiyi-valk3", name: { zh: "Valk 3", en: "Valk 3" }, variants: [
    ["qiyi-valk3", "原版", "Original"],
  ] },
  { id: "qiyi-valk3-mini", name: { zh: "Valk 3 迷你 (4.74cm)", en: "Valk 3 Mini (4.74cm)" }, variants: [
    ["qiyi-valk3-mini", "无磁版", "Non-magnetic"],
  ] },
  { id: "xman-tornado-v5", name: { zh: "风五代 / Tornado V5", en: "Tornado V5" }, variants: [
    ["xman-tornado-v5", "旗舰版 UV", "Flagship UV"],
    ["xman-tornado-v5-pioneer", "先锋版 UV", "Pioneer UV"],
    ["xman-tornado-v5-3x3-pioneer-uv-le", "先锋版 UV, LE", "Pioneer UV, LE"],
    ["xman-tornado-v5-3x3-pioneer-uv-picube-se", "先锋版 UV, PiCube 特别版", "Pioneer UV, PiCube SE"],
  ] },
  { id: "qiyi-mini-42", name: { zh: "奇艺 黑曼巴二代 42 mm", en: "QiYi Black Mamba V2 42 mm (Mini QiYi)" }, variants: [
    ["qiyi-mini-42", "原版", "Original"],
  ] },
  { id: "qiyi-black-mamba-3x3-v3", name: { zh: "奇艺 黑曼巴三代 V3", en: "QiYi Black Mamba V3" }, variants: [
    ["qiyi-black-mamba-3x3-v3", "无磁版", "Non-magnetic"],
  ] },
  { id: "qiyi-3x3", name: { zh: "奇艺黑曼巴 V1", en: "QiYi Black Mamba V1" }, variants: [
    ["qiyi-3x3", "奇艺 黑曼巴初代", "original QiYi"],
  ] },
  { id: "qiyi-valk3-power", name: { zh: "Valk 3 Power", en: "Valk 3 Power" }, variants: [
    ["qiyi-valk3-power", "无磁版", "Non-magnetic"],
    ["qiyi-valk3-power-m", "M", "M"],
  ] },
  { id: "qiyi-smart-sc-s", name: { zh: "奇艺 AI SC-S", en: "QiYi AI SC-S" }, variants: [
    ["qiyi-smart-sc-s", "彩色版", "Stickerless"],
    ["qiyi-smart-cube-3x3-uv-coated", "UV", "UV"],
    ["qiyi-smart-sc-s-art", "艺术版", "Art"],
  ] },
  { id: "qiyi-thunderclap-v3", name: { zh: "奇艺雷霆 V3", en: "Thunderclap V3" }, variants: [
    ["qiyi-thunderclap-v3", "无磁版", "Non-magnetic"],
    ["qiyi-thunderclap-v3-m", "M", "M"],
  ] },
  { id: "qiyi-bubble-3x3", name: { zh: "奇艺 Bubble 泡泡", en: "QiYi Bubble" }, variants: [
    ["qiyi-bubble-3x3", "原版", "Original"],
    ["qiyi-bubble-3x3-sandwich", "三明治教学版", "Sandwich"],
  ] },
];

const definitionsByVersion = new Map(CUBE_MODEL_DEFINITIONS.flatMap(model =>
  model.variants.map(([id, zh, en], preference) => [id, { model, label: { zh, en }, preference }] as const)));

export const getCubeModelId = (cube: Cube): string => definitionsByVersion.get(cube.id)?.model.id ?? cube.id;
export const getCubeModelName = (cube: Cube): LocalizedText => definitionsByVersion.get(cube.id)?.model.name ?? cube.name;
export const getCubeVersionLabel = (cube: Cube): LocalizedText => definitionsByVersion.get(cube.id)?.label ?? cube.name;
/** Lower values prefer a reviewed base version. Never use this as a date. */
export const getCubeVersionPreference = (cube: Cube): number => definitionsByVersion.get(cube.id)?.preference ?? 0;
