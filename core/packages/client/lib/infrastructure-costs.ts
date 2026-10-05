// Shared cost inventory for the expenses and partner-brief pages.
// These are owner-recorded figures, not live vendor prices or a project expense ledger.
export type LocalizedText = { zh: string; en: string };

export type RecurringAmount = { value: number; currency: 'CNY' | 'USD'; period: 'month' | 'year'; plusUsage?: boolean; displayValue?: string };

export type EquipmentAmount =
  | number
  | { value: number; qualifier: 'approx' | 'launchedFrom' }
  | { label: LocalizedText };

export type EquipmentGroup = {
  category: LocalizedText;
  items: readonly {
    name: LocalizedText;
    detail: LocalizedText;
    amount: EquipmentAmount;
    imageSrc: string;
    imageScale?: number;
    href?: string;
  }[];
};

export const RMB_PER_USD = 6.7840;

export const EXPENSES: readonly { name: LocalizedText; amount: RecurringAmount; purpose: LocalizedText }[] = [
  {
    name: { zh: '实习生', en: 'Internship' },
    amount: { value: 3600, currency: 'CNY', period: 'month' },
    purpose: {
      zh: '¥300/天，每周 3 天、每月约 12 天；预计月支出',
      en: 'CN¥300/day, three days/week and approximately 12 days/month; estimated monthly cost',
    },
  },
  {
    name: { zh: '阿里云服务器', en: 'Alibaba Cloud server' },
    amount: { value: 300, currency: 'CNY', period: 'month' },
    purpose: { zh: '主站、API 与数据服务', en: 'Primary web, API, and data services' },
  },
  {
    name: { zh: 'Codex Pro', en: 'Codex Pro' },
    amount: { value: 300, currency: 'USD', period: 'month', displayValue: '200+100' },
    purpose: { zh: 'AI 开发工具', en: 'AI development tooling' },
  },
  {
    name: { zh: 'Apple 开发者计划', en: 'Apple Developer Program' },
    amount: { value: 688, currency: 'CNY', period: 'year' },
    purpose: { zh: 'iOS App 签名与发布', en: 'iOS app signing and distribution' },
  },
  {
    name: { zh: 'Vercel Pro', en: 'Vercel Pro' },
    amount: { value: 20, currency: 'USD', period: 'month', plusUsage: true },
    purpose: { zh: 'Web 构建与托管', en: 'Web builds and hosting' },
  },
  {
    name: { zh: '微信开放平台认证', en: 'WeChat Open Platform verification' },
    amount: { value: 300, currency: 'CNY', period: 'year' },
    purpose: {
      zh: '维持网站应用的微信扫码登录与电脑端直发微信能力',
      en: 'Maintains WeChat QR sign-in and direct desktop sharing for the Website App',
    },
  },
  {
    name: { zh: '剪映', en: 'CapCut Chinese version' },
    amount: { value: 208, currency: 'CNY', period: 'year' },
    purpose: { zh: '视频剪辑软件', en: 'Video editing software' },
  },
  {
    name: { zh: '企业网银服务费', en: 'Business online banking service fee' },
    amount: { value: 25, currency: 'CNY', period: 'month' },
    purpose: { zh: '对公账户网上银行服务', en: 'Online banking for the business account' },
  },
] as const;

export const ANNUAL_RECURRING_CNY = EXPENSES.reduce((total, expense) => total + annualExpenseCny(expense.amount), 0);

export const EQUIPMENT_GROUPS: readonly EquipmentGroup[] = [
  {
    category: { zh: '供电与存储', en: 'Power and storage' },
    items: [
      {
        name: { zh: 'SanDisk Extreme 128GB SD 存储卡', en: 'SanDisk Extreme 128GB SD card' },
        detail: { zh: '含数据恢复软件；实付款', en: 'Includes data recovery software; amount paid' },
        amount: 168.16,
        imageSrc: '/images/dev/infrastructure/sandisk-extreme-128gb-cutout.webp',
      },
      {
        name: { zh: '沣标 FB LP-E6P 相机电池 ×4', en: 'FB LP-E6P camera batteries ×4' },
        detail: {
          zh: 'Type-C 直充；已确认 2400mAh 两块、2600mAh 一块。金额为三笔已完成订单合计（¥164.87 + ¥156.10 + ¥191）；第 4 块规格和价格待补，未计入合计。',
          en: 'USB-C charging; two 2400mAh and one 2600mAh batteries confirmed. Amount covers three completed orders (CN¥164.87 + CN¥156.10 + CN¥191); the fourth battery’s specifications and price are pending and excluded from the total.',
        },
        amount: 511.97,
        imageSrc: '/images/dev/infrastructure/fb-lp-e6p-cutout.webp',
      },
      {
        name: { zh: '影视飓风 × 闪极 随行 Mini 充电宝', en: 'Mediastorm × SHARGE Mini power bank' },
        detail: { zh: '胶卷绿，5000mAh；自带线、USB-C 接口与 Lightning 转接；实付款', en: 'Film green, 5000mAh; built-in cable, USB-C connector and Lightning adapter; amount paid' },
        amount: 149,
        imageSrc: '/images/dev/infrastructure/sharge-mediastorm-mini-cutout.webp',
      },
      {
        name: { zh: 'Anker 能量舱 165W 充电宝', en: 'Anker 165W power bank' },
        detail: { zh: '25000mAh；70cm 伸缩线、30cm 挂绳线，四口同充；实付款', en: '25000mAh; 70cm retractable cable, 30cm lanyard cable, four-device charging; amount paid' },
        amount: 469,
        imageSrc: '/images/dev/infrastructure/anker-165w-25000mah-cutout.webp',
      },
      {
        name: { zh: 'CHIPFANCIER × 影视飓风 Gold4 2TB', en: 'CHIPFANCIER × Mediastorm Gold4 2TB' },
        detail: { zh: 'CFexpress Type B 4.0 存储卡，含 USB 3.2 单卡槽读卡器；套装实付款', en: 'CFexpress Type B 4.0 card with USB 3.2 single-slot reader; bundle amount paid' },
        amount: 2309,
        imageSrc: '/images/dev/infrastructure/chipfancier-gold4-2tb-cutout.webp',
      },
    ],
  },
  {
    category: { zh: '影像设备', en: 'Imaging' },
    items: [
      {
        name: { zh: 'Canon EOS R5 Mark II', en: 'Canon EOS R5 Mark II' },
        detail: { zh: '当前相机机身', en: 'Current camera body' },
        amount: 24000,
        imageSrc: '/images/dev/infrastructure/canon-eos-r5-mark-ii-cutout.webp',
        // Match R6's physical scale while compensating for transparent canvas padding.
        // Alpha bounds: R5 II 466px, R6 673px; body widths: 138.5mm / 138.4mm.
        // Canon specs: https://personal.canon.jp/product/camera/eos/r5mk2/spec
        // https://cam.start.canon/en/C004/manual/html/UG-09_Reference_0100.html
        imageScale: (673 / 466) * (138.5 / 138.4),
      },
      {
        name: { zh: 'Canon EOS R6', en: 'Canon EOS R6' },
        detail: { zh: '曾用相机机身', en: 'Former camera body' },
        amount: 14000,
        imageSrc: '/images/dev/infrastructure/canon-eos-r6.webp',
      },
      {
        name: { zh: 'Canon EF 100–400mm f/4.5–5.6L IS II USM', en: 'Canon EF 100–400mm f/4.5–5.6L IS II USM' },
        detail: { zh: '长焦镜头', en: 'Telephoto lens' },
        amount: 13900,
        imageSrc: '/images/dev/infrastructure/canon-ef-100-400.webp',
      },
      {
        name: { zh: '丛林迷彩炮衣', en: 'Jungle-camouflage lens cover' },
        detail: { zh: '镜头保护与伪装', en: 'Lens protection and camouflage' },
        amount: 300,
        imageSrc: '/images/dev/infrastructure/jungle-camo-lens-cover.webp',
      },
      {
        name: { zh: 'Canon EF–EOS R 卡口适配器', en: 'Canon EF–EOS R mount adapter' },
        detail: { zh: 'EF 镜头转 RF 卡口', en: 'Adapts EF lenses to the RF mount' },
        amount: 600,
        imageSrc: '/images/dev/infrastructure/canon-ef-eos-r-adapter.webp',
      },
      {
        name: { zh: 'Canon BR-E1 无线遥控快门', en: 'Canon BR-E1 wireless remote control' },
        detail: { zh: '无线相机快门控制', en: 'Wireless camera shutter control' },
        amount: 278,
        imageSrc: '/images/dev/infrastructure/canon-br-e1.webp',
      },
      {
        name: { zh: 'SmallRig 斯莫格 CT210', en: 'SmallRig CT210' },
        detail: { zh: '三脚架', en: 'Tripod' },
        amount: 677,
        imageSrc: '/images/dev/infrastructure/smallrig-ct210.webp',
      },
    ],
  },
  {
    category: { zh: '收音与监听', en: 'Audio and monitoring' },
    items: [
      {
        name: { zh: 'DJI Mic 3', en: 'DJI Mic 3' },
        detail: { zh: '两收一发', en: 'Two receivers and one transmitter' },
        amount: 2299,
        imageSrc: '/images/dev/infrastructure/dji-mic-3.webp',
      },
      {
        name: { zh: 'DJI Mic Mini', en: 'DJI Mic Mini' },
        detail: { zh: '两发一收', en: 'Two transmitters and one receiver' },
        amount: 1096.5,
        imageSrc: '/images/dev/infrastructure/dji-mic-mini.webp',
      },
      {
        name: { zh: 'DJI Mic 2', en: 'DJI Mic 2' },
        detail: { zh: '一收一发', en: 'One receiver and one transmitter' },
        amount: 1499,
        imageSrc: '/images/dev/infrastructure/dji-mic-2.webp',
      },
      {
        name: { zh: 'Newmine 无线监听耳机', en: 'Newmine wireless monitoring headphones' },
        detail: { zh: '无线音频监听', en: 'Wireless audio monitoring' },
        amount: 399,
        imageSrc: '/images/dev/infrastructure/newmine-monitor-earphones.webp',
      },
    ],
  },
  {
    category: { zh: '手机与电脑', en: 'Phones and computers' },
    items: [
      {
        name: { zh: 'iPhone 15 Pro Max 512 GB', en: 'iPhone 15 Pro Max 512 GB' },
        detail: { zh: '手机；中国大陆发售价', en: 'Phone; mainland China launch price' },
        amount: 11999,
        imageSrc: '/images/dev/infrastructure/iphone-15-pro-max.webp',
      },
      {
        name: { zh: 'iPhone 12 Pro Max 512 GB', en: 'iPhone 12 Pro Max 512 GB' },
        detail: { zh: '手机；中国大陆发售价', en: 'Phone; mainland China launch price' },
        amount: 11899,
        imageSrc: '/images/dev/infrastructure/iphone-12-pro-max.webp',
      },
      {
        name: { zh: 'LEAPLIGHT 力普莱多功能手机夹', en: 'LEAPLIGHT multifunction phone holder' },
        detail: { zh: '双冷靴口', en: 'Dual cold-shoe mounts' },
        amount: 57.5,
        imageSrc: '/images/dev/infrastructure/leaplight-phone-holder.webp',
      },
      {
        name: { zh: 'Alienware M17 R4', en: 'Alienware M17 R4' },
        detail: { zh: 'Windows 11 笔记本电脑', en: 'Windows 11 laptop' },
        amount: 25000,
        imageSrc: '/images/dev/infrastructure/alienware-m17-r4.webp',
      },
      {
        name: { zh: '小米曲面显示器 34 英寸', en: 'Mi Curved Gaming Monitor 34"' },
        detail: { zh: '黑色；WQHD 带鱼屏、144Hz；实付款', en: 'Black; WQHD ultrawide display, 144Hz; amount paid' },
        amount: 2190,
        imageSrc: '/images/dev/infrastructure/xiaomi-curved-monitor-34.webp',
        href: 'https://www.mi.com/monitor34',
      },
      {
        name: { zh: '狼蛛 S98 无线三模机械键盘', en: 'AULA S98 tri-mode wireless mechanical keyboard' },
        detail: { zh: '银白三模、红轴（静音线性手感）', en: 'Silver-white, red switches (quiet linear feel)' },
        amount: 159,
        imageSrc: '/images/dev/infrastructure/aula-s98-cutout.webp',
      },
      {
        name: { zh: 'HUKE Windows 触控板', en: 'HUKE Windows touchpad' },
        detail: { zh: '银色，支持 Windows 10/11 原生手势；实付款', en: 'Silver, supports native Windows 10/11 gestures; amount paid' },
        amount: 259,
        imageSrc: '/images/dev/infrastructure/huke-windows-touchpad-cutout.webp',
      },
      {
        name: { zh: 'Mac mini（M5 Pro）', en: 'Mac mini (M5 Pro)' },
        detail: {
          zh: '18 核 CPU、20 核 GPU、16 核神经网络引擎；64GB 统一内存、1TB 存储；10Gb 以太网；前置两个 USB-C 和 3.5 毫米耳机插孔，后置三个雷雳 5、HDMI 和以太网端口；支持最多三台外接显示器，含配件套装',
          en: '18-core CPU, 20-core GPU, 16-core Neural Engine; 64GB unified memory, 1TB storage; 10Gb Ethernet; two front USB-C ports and a 3.5mm headphone jack; three rear Thunderbolt 5 ports, HDMI, and Ethernet; supports up to three external displays; accessory kit included',
        },
        amount: 24999,
        imageSrc: '/images/dev/infrastructure/mac-mini-m5-pro.webp',
        href: 'https://www.apple.com.cn/shop/buy-mac/mac-mini/m5-pro-chip-18-core-cpu-20-core-gpu-64gb-memory-1tb-storage',
      },
      {
        name: { zh: '带触控 ID 和数字小键盘的妙控键盘（USB-C）', en: 'Magic Keyboard with Touch ID and Numeric Keypad (USB-C)' },
        detail: { zh: '适用于 Apple 芯片 Mac；中文拼音布局、黑色按键', en: 'For Apple silicon Macs; Chinese Pinyin layout, black keys' },
        amount: 1399,
        imageSrc: '/images/dev/infrastructure/apple-magic-keyboard-touch-id-numeric-black.webp',
        href: 'https://www.apple.com.cn/shop/product/mxk83ch/a',
      },
      {
        name: { zh: '妙控板（USB-C）', en: 'Magic Trackpad (USB-C)' },
        detail: { zh: '黑色多点触控表面', en: 'Black Multi-Touch surface' },
        amount: 1049,
        imageSrc: '/images/dev/infrastructure/apple-magic-trackpad-black.webp',
        href: 'https://www.apple.com.cn/shop/product/mxka3ch/a',
      },
      {
        name: { zh: '妙控鼠标（USB-C）', en: 'Magic Mouse (USB-C)' },
        detail: { zh: '黑色多点触控表面', en: 'Black Multi-Touch surface' },
        amount: 699,
        imageSrc: '/images/dev/infrastructure/apple-magic-mouse-black.webp',
        href: 'https://www.apple.com.cn/shop/product/mxk63ch/a',
      },
      {
        name: { zh: 'MacBook Pro 13 英寸（2020）', en: '13-inch MacBook Pro (2020)' },
        detail: {
          zh: '四个雷雳 3 端口；2 GHz 四核 Intel Core i5、16GB LPDDR4X、Intel Iris Plus Graphics；截图未显示存储容量',
          en: 'Four Thunderbolt 3 ports; 2GHz quad-core Intel Core i5, 16GB LPDDR4X, Intel Iris Plus Graphics; storage capacity not shown',
        },
        amount: 14499,
        imageSrc: '/images/dev/infrastructure/macbook-pro-13-2020.webp',
        href: 'https://support.apple.com/zh-cn/111339',
      },
    ],
  },
] as const;

export const ONE_TIME_EXPENSES = [
  {
    name: { zh: '公司注册工位（一年）', en: 'Company registration workspace (one year)' },
    detail: {
      zh: '上海徐汇站 1 期开放工位；租期一年，计划仅租这一年。订单总额含 ¥2,200 押金。',
      en: 'Open workspace at Shanghai Xuhui Station Phase 1; a single planned one-year lease. The order total includes a CN¥2,200 deposit.',
    },
    amount: 20152,
  },
] as const;

export const ONE_TIME_TOTAL = EQUIPMENT_GROUPS.reduce((total, group) => total + equipmentGroupTotal(group), 0)
  + ONE_TIME_EXPENSES.reduce((total, expense) => total + expense.amount, 0);


export function annualExpenseCny(amount: RecurringAmount): number {
  return amount.value * (amount.period === "month" ? 12 : 1) * (amount.currency === "USD" ? RMB_PER_USD : 1);
}

export function equipmentGroupTotal(group: EquipmentGroup): number {
  return group.items.reduce((total, { amount }) => total + (typeof amount === "number" ? amount : "value" in amount ? amount.value : 0), 0);
}
