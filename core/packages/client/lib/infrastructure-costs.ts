// Shared cost inventory for the infrastructure and partner-brief pages.
// These are owner-recorded figures, not live vendor prices or a project expense ledger.
export type LocalizedText = { zh: string; en: string };

export type RecurringAmount = { value: number; currency: 'CNY' | 'USD'; period: 'month' | 'year' };

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
    href?: string;
  }[];
};

export const RMB_PER_USD = 6.7840;

export const EXPENSES: readonly { name: LocalizedText; amount: RecurringAmount; purpose: LocalizedText }[] = [
  {
    name: { zh: '阿里云服务器', en: 'Alibaba Cloud server' },
    amount: { value: 300, currency: 'CNY', period: 'month' },
    purpose: { zh: '主站、API 与数据服务', en: 'Primary web, API, and data services' },
  },
  {
    name: { zh: 'Codex Pro', en: 'Codex Pro' },
    amount: { value: 200, currency: 'USD', period: 'month' },
    purpose: { zh: 'AI 开发工具', en: 'AI development tooling' },
  },
  {
    name: { zh: 'Apple 开发者计划', en: 'Apple Developer Program' },
    amount: { value: 688, currency: 'CNY', period: 'year' },
    purpose: { zh: 'iOS App 签名与发布', en: 'iOS app signing and distribution' },
  },
  {
    name: { zh: 'Vercel Pro', en: 'Vercel Pro' },
    amount: { value: 20, currency: 'USD', period: 'month' },
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
] as const;

export const ANNUAL_RECURRING_CNY = EXPENSES.reduce((total, expense) => total + annualExpenseCny(expense.amount), 0);

export const EQUIPMENT_GROUPS: readonly EquipmentGroup[] = [
  {
    category: { zh: '影像设备', en: 'Imaging' },
    items: [
      {
        name: { zh: 'Canon EOS R5 Mark II', en: 'Canon EOS R5 Mark II' },
        detail: { zh: '当前相机机身', en: 'Current camera body' },
        amount: 24000,
        imageSrc: '/images/dev/infrastructure/canon-eos-r5-mark-ii-cutout.webp',
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
        amount: { value: 16000, qualifier: 'approx' },
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
        detail: { zh: '手机', en: 'Phone' },
        amount: { label: { zh: '未标价', en: 'Price not listed' } },
        imageSrc: '/images/dev/infrastructure/iphone-15-pro-max.webp',
      },
      {
        name: { zh: 'iPhone 12 Pro Max 512 GB', en: 'iPhone 12 Pro Max 512 GB' },
        detail: { zh: '手机', en: 'Phone' },
        amount: { label: { zh: '未标价', en: 'Price not listed' } },
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
        amount: { value: 14499, qualifier: 'launchedFrom' },
        imageSrc: '/images/dev/infrastructure/macbook-pro-13-2020.webp',
        href: 'https://support.apple.com/zh-cn/111339',
      },
    ],
  },
  {
    category: { zh: '播放软件', en: 'Playback software' },
    items: [
      {
        name: { zh: 'K-Lite Codec Pack', en: 'K-Lite Codec Pack' },
        detail: { zh: '媒体播放解码包', en: 'Media playback codec bundle' },
        amount: { label: { zh: '免费', en: 'Free' } },
        imageSrc: '/images/dev/infrastructure/k-lite-codec-pack.webp',
        href: 'https://codecguide.com/download_kl.htm',
      },
    ],
  },
] as const;

export const ONE_TIME_TOTAL = EQUIPMENT_GROUPS.reduce((total, group) => total + equipmentGroupTotal(group), 0);


export function annualExpenseCny(amount: RecurringAmount): number {
  return amount.value * (amount.period === "month" ? 12 : 1) * (amount.currency === "USD" ? RMB_PER_USD : 1);
}

export function equipmentGroupTotal(group: EquipmentGroup): number {
  return group.items.reduce((total, { amount }) => total + (typeof amount === "number" ? amount : "value" in amount ? amount.value : 0), 0);
}
