import type { LocalizedText } from './types';

export const SNAPSHOT_DATE = '2026-10-07';
export const BRANDS: Record<string, LocalizedText> = {
  "Type D": {"zh":"Type D（历史称谓）","en":"Type D (historical label)"},
  "HaiYan": {"zh":"海燕 HaiYan","en":"HaiYan"},
  "MoreTry": {"zh":"MoreTry 天马","en":"MoreTry"},
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
  GiiKER: { zh: '计客 GiiKER', en: 'GiiKER' },
  Particula: { zh: 'Particula / GoCube', en: 'Particula / GoCube' },
  "Rubik's": { zh: "Rubik's 鲁比克", en: "Rubik's" },
};
export const CATEGORIES: Record<string, LocalizedText> = {
  speed: { zh: '速拧三阶', en: 'Speed cube' },
  smart: { zh: '智能三阶', en: 'Smart cube' },
  classic: { zh: '历史原版', en: 'Classic' },
  mini: { zh: '小尺寸三阶', en: 'Mini 3×3' },
  educational: { zh: '教学与无障碍', en: 'Learning & accessibility' },
};
export const RELEASE_LABELS: Record<string, LocalizedText> = {
  official: { zh: '官方日期', en: 'Official date' },
  retailer: { zh: '商家日期', en: 'Retailer date' },
  documented: { zh: '已见于资料', en: 'Documented by' },
  approximate: { zh: '约略年份', en: 'Approximate' },
  unknown: { zh: '时间待核', en: 'Date unverified' },
};
export const PRICE_LABELS: Record<string, LocalizedText> = {
  launch: { zh: '首发价', en: 'Launch price' },
  current: { zh: '页面标价', en: 'Displayed price' },
  historical: { zh: '历史目录价', en: 'Archived price' },
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
  { title: { zh: '收录单位', en: 'What counts as a model' }, text: { zh: '以可辨识型号或结构修订为单位。磁力、磁悬浮、尺寸等重大版本保留差异；纯限定色、涂层或礼包通常归入版本。技术筛选表示家族中存在该配置，不保证最低配具备。记录数不等于全部 SKU 数，也不表示全球所有产品已收齐。', en: 'Entries represent identifiable models or structural revisions. Significant magnetic, MagLev and size variants remain visible; colors, finishes and bundles are usually grouped. A technology filter means that a configuration exists within the family, not that its base version includes it. The entry count is neither a SKU count nor a claim of exhaustive global coverage.' } },
  { title: { zh: '日期的证据', en: 'Date evidence' }, text: { zh: '官方日期、商家开售或上架日、当年资料出现时间分别标注。精确到天不代表证据更权威。旧商店“2018-09-11”等集中迁移日期不当作历史首发；样品、预售和地区差异写在备注中。', en: 'Official dates, retailer dates and contemporary documentary evidence are labeled separately. Day-level precision does not imply greater authority. Mass store migration dates are excluded as launch dates; samples, preorders and regional differences are explained.' } },
  { title: { zh: '价格的口径', en: 'Price basis' }, text: { zh: '逐条保留币种、市场、版本、时间和来源。首发价、查阅时页面价、旧目录价分开记录；不把美元换算当国行价，不把零元占位当免费，不跨币种自动排名。', en: 'Each quote retains currency, market, variant, time and source. Launch, displayed and archived prices are distinct. Currency conversion is not presented as a Chinese retail price; zero-value placeholders are excluded and currencies are not ranked together.' } },
  { title: { zh: '参数与评价', en: 'Specifications and opinions' }, text: { zh: '重量只记录可确认的本体净重；包装毛重不填入净重。厂商的磁铁数、容错或自复位角度属于标称参数。评价注明亲历测评或编辑分析；没有统一实测条件，不编造分数和销量排名。', en: 'Only identifiable item weights are recorded as net weight. Magnet counts and corner-cutting or auto-alignment angles from brands remain advertised specifications. Opinions distinguish first-hand reviews from editorial analysis; no synthetic scores or sales ranks are invented.' } },
  { title: { zh: '品牌与时间', en: 'Brands over time' }, text: { zh: '品牌、子系列、设计者和经销商不是同一概念。不同年代的归属可能变化，早期 Type A / Type C 等代号还可能指不同模具。当前目录中的厂商标签不能倒推全部历史。', en: 'Brands, sub-lines, designers and distributors are different concepts. Ownership and naming change; early Type A / Type C labels may denote different molds. Present catalog labels do not establish every historical relationship.' } },
  { title: { zh: '已知缺口', en: 'Known gaps' }, text: { zh: '1980–2000 年代各地原版批次、早期国产全部模具、停产小品牌、部分小尺寸与低价型号仍有缺口。蓝蓝、QJ、乐方及更多地方品牌需要继续查旧目录；中国历史成交价与原厂照片也有大量缺失。', en: 'Gaps remain in regional 1980–2000s batches, early Chinese molds, discontinued small brands, and some miniature and budget models. LanLan, QJ, LeFun and other local brands need further catalog work. Many historical Chinese transaction prices and original product photographs remain missing.' } },
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
  "all": {
    "zh": "全部记录",
    "en": "All records"
  },
  "official": {
    "zh": "有官方日期",
    "en": "Official date evidence"
  },
  "cny": {
    "zh": "有人民币报价",
    "en": "Has a CNY quote"
  },
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
  "newest": {
    "zh": "由新到旧",
    "en": "Newest first"
  },
  "oldest": {
    "zh": "由旧到新",
    "en": "Oldest first"
  },
  "name": {
    "zh": "型号名称",
    "en": "Model name"
  }
};
