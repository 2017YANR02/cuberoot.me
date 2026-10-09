import type { LocalizedText, PriceKind } from './types';

export const SNAPSHOT_DATE = '2026-10-07';
export const PRICE_SNAPSHOT_DATE = '2026-10-09';
export const BRANDS: Record<string, LocalizedText> = {
  "Calvin's Puzzle": { zh: "Calvin's Puzzle", en: "Calvin's Puzzle" },
  "Cong's Design": { zh: "丛氏 Cong's Design", en: "Cong's Design" },
  'Cube Lab': { zh: 'Cube Lab', en: 'Cube Lab' },
  CubeStyle: { zh: 'CubeStyle', en: 'CubeStyle' },
  "Cuber's Home": { zh: "Cuber's Home 加磁成品", en: "Cuber's Home" },
  ESCube: { zh: 'ESCube', en: 'ESCube' },
  Eastsheen: { zh: '东贤 Eastsheen', en: 'Eastsheen' },
  FanXin: { zh: '樊鑫 FanXin', en: 'FanXin' },
  FangCun: { zh: '方寸 FangCun', en: 'FangCun' },
  Formula: { zh: 'Formula', en: 'Formula' },
  'Ghost Hand': { zh: 'Ghost Hand 鬼手', en: 'Ghost Hand' },
  HeShu: { zh: 'HeShu', en: 'HeShu' },
  HeyKube: { zh: 'HeyKube', en: 'HeyKube' },
  HuDong: { zh: 'HuDong', en: 'HuDong' },
  HuaMeng: { zh: '华梦 HuaMeng', en: 'HuaMeng' },
  KungFu: { zh: '功夫 KungFu', en: 'KungFu' },
  LeFun: { zh: '乐方 LeFun', en: 'LeFun' },
  MF8: { zh: 'MF8', en: 'MF8' },
  Maru: { zh: '小丸号 Maru', en: 'Maru' },
  "Meffert's": { zh: "Meffert's", en: "Meffert's" },
  'MoHuan ShouSu': { zh: '魔幻手速', en: 'MoHuan ShouSu' },
  MoJue: { zh: '魔爵 MoJue', en: 'MoJue' },
  MsCube: { zh: 'MsCube', en: 'MsCube' },
  Newisland: { zh: 'Newisland', en: 'Newisland' },
  Other: { zh: '厂牌待核', en: 'Unverified manufacturer' },
  'Peak Cube': { zh: 'Peak Cube', en: 'Peak Cube' },
  QJ: { zh: '奇积 QJ', en: 'QJ' },
  Rephael: { zh: 'Rephael', en: 'Rephael' },
  SAOCube: { zh: 'SAOCube', en: 'SAOCube' },
  'Stellar Cube': { zh: '星耀 Stellar Cube', en: 'Stellar Cube' },
  SenHuan: { zh: '森幻 SenHuan', en: 'SenHuan' },
  'Smart Cube Labs': { zh: 'Smart Cube Labs', en: 'Smart Cube Labs' },
  'Tao Cube': { zh: 'Tao Cube', en: 'Tao Cube' },
  TheCubicle: { zh: 'TheCubicle 商家定制', en: 'TheCubicle editions' },
  YZ: { zh: 'YZ', en: 'YZ' },
  YanCheng: { zh: '燕成 YanCheng', en: 'YanCheng' },
  YiSheng: { zh: 'YiSheng', en: 'YiSheng' },
  ZCube: { zh: 'ZCube', en: 'ZCube' },
  ZhiChen: { zh: 'ZhiChen', en: 'ZhiChen' },
  Ziina: { zh: 'Ziina', en: 'Ziina' },
  "Type D": {"zh":"Type D（历史称谓）","en":"Type D (historical label)"},
  "HaiYan": {"zh":"海燕 HaiYan","en":"HaiYan"},
  "MoreTry": {"zh":"梦图 MoreTry","en":"MoreTry"},
  "VIN": {"zh":"VIN","en":"VIN"},
  "HaiTun": {"zh":"海豚 HaiTun","en":"HaiTun"},
  GAN: { zh: 'GAN', en: 'GAN' },
  'Monster Go': { zh: 'Monster Go', en: 'Monster Go' },
  'Swift Block': { zh: 'Swift Block', en: 'Swift Block' },
  MoYu: { zh: '魔域 MoYu', en: 'MoYu' },
  MoFangJiaoShi: { zh: '魔方教室 MFJS', en: 'MoFangJiaoShi' },
  GuoGuan: { zh: '国冠 GuoGuan', en: 'GuoGuan' },
  YJ: { zh: '永骏 YJ', en: 'YJ' },
  QiYi: { zh: '奇艺 QiYi', en: 'QiYi' },
  'X-Man Design': { zh: '魔侠 X-Man Design', en: 'X-Man Design' },
  DaYan: { zh: '大雁 DaYan', en: 'DaYan' },
  YuXin: { zh: '裕鑫 YuXin', en: 'YuXin' },
  ShengShou: { zh: '圣手 ShengShou', en: 'ShengShou' },
  DianSheng: { zh: '点盛 DianSheng', en: 'DianSheng' },
  Alpha: { zh: '国甲 Alpha', en: 'Alpha / GuoJia' },
  WitEden: { zh: '智胜 / 国丙 WitEden', en: 'WitEden / Type C' },
  ShengEn: { zh: '圣恩 ShengEn', en: 'ShengEn / Type F' },
  FangShi: { zh: '方是 FangShi', en: 'FangShi / Funs Puzzle' },
  'Cyclone Boys': { zh: '旋风小子 Cyclone Boys', en: 'Cyclone Boys' },
  Cube4You: { zh: 'Cube4You', en: 'Cube4You' },
  'V-CUBE': { zh: 'V-CUBE', en: 'V-CUBE' },
  GiiKER: { zh: '计客 GiiKER', en: 'GiiKER' },
  Particula: { zh: 'Particula / GoCube', en: 'Particula / GoCube' },
  "Rubik's": { zh: "Rubik's 鲁比克", en: "Rubik's" },
};
export const CATEGORIES: Record<string, LocalizedText> = {
  speed: { zh: '速拧三阶', en: 'Speed cube' },
  smart: { zh: '智能三阶', en: 'Smart cube' },
  classic: { zh: '经典与原版', en: 'Classic' },
  mini: { zh: '小尺寸三阶', en: 'Mini 3×3' },
  educational: { zh: '教学与无障碍', en: 'Learning & accessibility' },
  collectible: { zh: '图案与收藏三阶', en: 'Picture & collectible cubes' },
};
export const TIERS: Record<string, LocalizedText> = {
  all: { zh: '所有定位', en: 'All positions' },
  flagship: { zh: '旗舰', en: 'Flagship' },
  mainstream: { zh: '主流', en: 'Mainstream' },
  budget: { zh: '入门', en: 'Budget' },
  specialty: { zh: '专门用途 / 收藏', en: 'Specialty / collectible' },
  unknown: { zh: '定位待核', en: 'Position unverified' },
};
export const RELEASE_LABELS: Record<string, LocalizedText> = {
  official: { zh: '官方日期', en: 'Official date' },
  retailer: { zh: '商家日期', en: 'Retailer date' },
  documented: { zh: '已见于资料', en: 'Documented by' },
  approximate: { zh: '约略年份', en: 'Approximate' },
  unknown: { zh: '时间待核', en: 'Date unverified' },
};
export const PRICE_LABELS: Record<PriceKind, LocalizedText> = {
  launch: { zh: '中国首发价', en: 'China launch price' },
  current: { zh: '当前参考价', en: 'Current reference price' },
};
export const SOURCE_LABELS: Record<string, LocalizedText> = {
  official: { zh: '官方', en: 'Official' },
  retailer: { zh: '零售商', en: 'Retailer' },
  review: { zh: '亲历 / 测评', en: 'First-hand / review' },
  archive: { zh: '历史档案', en: 'Archive' },
};
export const STATUS_LABELS: Record<string, LocalizedText> = {
  released: { zh: '已发布', en: 'Released' },
  announced: { zh: '预告 / 预售', en: 'Announced / preorder' },
  unverified: { zh: '待证实', en: 'Unverified' },
};
export const MECHANISMS: Record<string, LocalizedText> = {
  hollow: { zh: '镂空结构', en: 'Hollow construction' },
  pillowed: { zh: '凸面外形', en: 'Pillowed exterior' },
  'ball-detent': { zh: '滚珠定位', en: 'Ball detents' },
  'ball-bearing': { zh: '微型滚珠轴承', en: 'Micro ball bearings' },
  'electronic-timer': { zh: '内置电子计时', en: 'Built-in electronic timer' },
  'screw-tension': { zh: '螺丝调节', en: 'Screw adjustment' },
  'sanded-internals': { zh: '内部打磨', en: 'Sanded internals' },
  "ges": {"zh":"GES 弹力系统","en":"GES elasticity system"},
  "replaceable-battery": {"zh":"可更换电池","en":"Replaceable battery"},
  "tiles": {"zh":"色片","en":"Tiles"},
  "carbon-core": {"zh":"碳纤维轴心","en":"Carbon-fiber core"},
  "wing-magnets": {"zh":"翼部磁力","en":"Wing magnets"},
  "magnet-option": {"zh":"磁力可选版本","en":"Magnetic version available"},
  "magnet-optional": {"zh":"磁力可选版本","en":"Magnetic version available"},
  "uv-option": {"zh":"UV 可选版本","en":"UV version available"},
  "uv-optional": {"zh":"UV 可选版本","en":"UV version available"},
  "center-edge-magnets": {"zh":"中心与棱块磁力","en":"Center-edge magnets"},
  "maglev-optional": {"zh":"磁悬浮可选版本","en":"MagLev version available"},
  "core-magnets-optional": {"zh":"轴心磁力可选版本","en":"Core-magnetic version available"},
  "anti-pop": {"zh":"防飞棱结构","en":"Piece-retention structure"},
  "adjustable-weight": {"zh":"可调重量","en":"Adjustable weight"},
  "led": {"zh":"灯光指引","en":"LED guidance"},
  "rechargeable": {"zh":"充电电池","en":"Rechargeable battery"},
  "center-corner-magnets": {"zh":"中心与角块磁力","en":"Center-corner magnets"},
  magnet: { zh: '磁定位', en: 'Magnetic alignment' },
  magnetic: { zh: '磁定位', en: 'Magnetic alignment' },
  'non-magnetic': { zh: '无磁定位', en: 'Non-magnetic' },
  spring: { zh: '弹簧', en: 'Springs' },
  maglev: { zh: '磁悬浮', en: 'MagLev' },
  'core-magnets': { zh: '轴心磁力', en: 'Core magnets' },
  'ball-core': { zh: '球轴', en: 'Ball core' },
  adjustable: { zh: '可调节', en: 'Adjustable' },
  uv: { zh: 'UV 表面', en: 'UV finish' },
  bluetooth: { zh: '蓝牙', en: 'Bluetooth' },
  gyroscope: { zh: '空间方向追踪', en: 'Orientation tracking' },
  tiled: { zh: '色片', en: 'Tiles' },
  stickerless: { zh: '免贴纸', en: 'Stickerless' },
  tactile: { zh: '触觉识别', en: 'Tactile recognition' },
  'metallic-finish': { zh: '电镀效果', en: 'Metallic finish' },
};
export const PERIODS = [
  { id: 'all', from: 1974, to: 2026, label: { zh: '所有年代', en: 'All years' } },
  { id: 'origins', from: 1974, to: 2005, label: { zh: '1974–2005 · 起源', en: '1974–2005 · Origins' } },
  { id: 'diy', from: 2006, to: 2012, label: { zh: '2006–2012 · DIY 与结构', en: '2006–2012 · DIY & geometry' } },
  { id: 'speed', from: 2013, to: 2016, label: { zh: '2013–2016 · 速拧竞争', en: '2013–2016 · Speed' } },
  { id: 'magnetic', from: 2017, to: 2020, label: { zh: '2017–2020 · 磁力与智能', en: '2017–2020 · Magnets & connectivity' } },
  { id: 'core', from: 2021, to: 2023, label: { zh: '2021–2023 · 球轴与磁悬浮', en: '2021–2023 · Cores & MagLev' } },
  { id: 'recent', from: 2024, to: 2026, label: { zh: '2024–2026 · 最新迭代', en: '2024–2026 · Recent generations' } },
  { id: 'unknown', from: 0, to: 0, label: { zh: '年份待核', en: 'Year unverified' } },
];
export const METHODOLOGY: { title: LocalizedText; text: LocalizedText }[] = [
  {"title":{"zh":"型号与子版本","en":"Models and distinct versions"},"text":{"zh":"同一型号的涂层、磁力配置和明确的限定版放在一张卡片内切换；不同代际或独立命名产品分别展示。标题保持型号名，各版本保留自己的日期、价格、参数和图片。系列筛选用于查看更宽的产品线，不决定卡片分组；记录数不等于全球全部 SKU。","en":"Finishes, magnetic configurations and documented special editions of the same model share a card. Distinct generations and independently named products have separate cards. The model title stays fixed, while every version retains its own dates, prices, specifications and photo. Family filters browse broader product lines and do not determine card grouping; record counts are not a worldwide SKU total."}},
  { title: { zh: '图片的对应关系', en: 'Photo provenance' }, text: { zh: '产品图取自可核查的原始商品页、品牌资料及其公开图片信息，并保留出处。来源本身为多个版本共用图片时明确标注；无法确认旧型号图片时保留缺口，不拿相似的新型号照片替代。图片展示和资料核对不代表取得图片的额外使用授权。', en: 'Product photos come from verifiable product pages, brand material and their public image metadata, with attribution retained. Shared source photography is labeled. Missing historical photos remain a gap instead of being replaced by a similar newer cube. Display and attribution do not imply an additional image-use license.' } },
  {"title":{"zh":"日期的证据","en":"Date evidence"},"text":{"zh":"型号年代按该型号全部版本中最早的有据记录排序；筛选或切换新版不会改写它。所选版本日期另行展示，也可选择按最新版本排序。官方、商家上架和当年资料分别标注；精确到天不代表官方首发。旧商店集中迁移日期不当作首发，样品、预售和地区差异保留说明。","en":"Model chronology uses the earliest evidenced record across all of its versions and stays fixed when filters or versions change. The selected version has its own date, and latest-version sorting is available separately. Official, retailer and contemporary records retain their evidence labels; day-level precision does not imply an official launch. Store migration dates are excluded as launches, and sample, preorder and regional qualifications are preserved."}},
  { title: { zh: '首发价与当前参考价', en: 'Launch and current prices' }, text: { zh: '优先展示可核实的中国大陆首发人民币价格；缺少首发价时，展示对应版本的当前参考价。每条报价保留价格类型、原币种、市场、日期和来源，海外价格显式标注。预售、批发或售罄列示价会说明条件；跨配置起价不套用于具体版本，运费及税费以商家结算为准。', en: 'A verified mainland-China launch price is shown first; otherwise an observed current quote for the exact version is used. Every quote keeps its type, original currency, market, date and source, with overseas prices labeled. Preorder, wholesale or sold-out listing conditions are shown. A family starting price is not assigned to individual versions; shipping and taxes follow the merchant checkout.' } },
  { title: { zh: '参数与评价', en: 'Specifications and opinions' }, text: { zh: '重量只记录可确认的本体净重；包装毛重不填入净重。厂商的磁铁数、容错或自复位角度属于标称参数。亲历测评、编辑分析和商家页用户评分分别注明。商家评分保留评论数、采样日期及合并配置的可能性，不作为统一性能分数。', en: 'Only identifiable item weights are recorded as net weight. Manufacturer magnet counts and corner-cutting or alignment angles remain advertised specifications. First-hand reports, editorial analysis and merchant-page ratings are labeled separately. Merchant ratings retain the sample count, date and possible pooling of configurations; they are not standardized performance scores.' } },
  { title: { zh: '品牌与时间', en: 'Brands over time' }, text: { zh: '品牌、子系列、设计者和经销商不是同一概念。不同年代的归属可能变化，早期 Type A / Type C 等代号还可能指不同模具。当前目录中的厂商标签不能倒推全部历史。', en: 'Brands, sub-lines, designers and distributors are different concepts. Ownership and naming change; early Type A / Type C labels may denote different molds. Present catalog labels do not establish every historical relationship.' } },
  { title: { zh: '逐年核查与缺口', en: 'Annual checks and remaining gaps' }, text: { zh: '用品牌资料、现售目录与停产档案互相查漏，同时展示每个品牌的日期与图片覆盖情况。年度表按有证据的资料年份排列；空白不代表当年没有新品。早期地区批次、国产模具修订、OEM 换标、中国历史成交价与旧实物照片仍可能缺失，不能用目录数量证明全球已经收齐。', en: 'Brand material, current catalogs and discontinued archives are cross-checked, with date and photo coverage shown by brand. Annual tables use evidenced dates; an empty cell does not establish that no product was released. Early regional batches, mold revisions, OEM rebadges, historical Chinese transaction prices and old photographs may still be missing. Catalog counts cannot prove worldwide completeness.' } },
];

export const TECHNOLOGIES: Record<string, LocalizedText> = {
  "all": {
    "zh": "所有技术",
    "en": "All technologies"
  },
  "magnet": {
    "zh": "磁力",
    "en": "Magnetic"
  },
  "maglev": {
    "zh": "磁悬浮",
    "en": "MagLev"
  },
  "core": {
    "zh": "轴心磁力 / 球轴",
    "en": "Core magnets / ball core"
  },
  "smart": {
    "zh": "智能连接",
    "en": "Connected"
  }
};

export const EVIDENCE_LABELS: Record<string, LocalizedText> = {
  "with-image": { "zh": "有来源图片", "en": "Has a sourced photo" },
  "missing-image": { "zh": "图片待补", "en": "Photo missing" },
  "all": {
    "zh": "全部记录",
    "en": "All records"
  },
  "official": {
    "zh": "有官方日期",
    "en": "Official date evidence"
  },
  "cny": {
    "zh": "有人民币价格",
    "en": "Has a mainland CNY price"
  },
  "launch-price": { "zh": "有首发价", "en": "Has a launch price" },
  "current-price": { "zh": "有当前参考价", "en": "Has a current price" },
  "has-price": { "zh": "有价格", "en": "Has a price" },
  "missing-price": {
    "zh": "价格待补",
    "en": "Price missing"
  },
  "announced": {
    "zh": "预告 / 预售",
    "en": "Announced / preorder"
  }
};

export const SORT_LABELS: Record<string, LocalizedText> = {
  relevance: { zh: '相关度优先', en: 'Most relevant' },
  'latest-version': { zh: '最近推出的版本', en: 'Latest versions first' },
  "newest": {
    "zh": "型号由新到旧",
    "en": "Newest models first"
  },
  "oldest": {
    "zh": "型号由旧到新",
    "en": "Oldest models first"
  },
  "name": {
    "zh": "型号名称",
    "en": "Model name"
  }
};
