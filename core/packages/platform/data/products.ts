export type ProductCategory = "竞速魔方" | "配件" | "周边" | "异形";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  brand: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  description: string;
  features: string[];
  inStock: boolean;
};

export const PRODUCTS: Product[] = [
  {
    id: "speed-pro-v5",
    name: "竞速 Pro V5 三阶磁力魔方",
    category: "竞速魔方",
    brand: "PlatformChoice",
    price: 268,
    originalPrice: 328,
    rating: 4.92,
    reviews: 1842,
    description: "面向 sub-10 选手的磁感 + 磁悬调节,出厂润滑可即开即用。",
    features: ["双调节磁力档位", "工厂润滑无需调试", "竞赛通过认证", "附带定制收纳袋"],
    inStock: true,
  },
  {
    id: "blind-train-kit",
    name: "盲拧训练套装",
    category: "周边",
    brand: "OpenCommunity",
    price: 158,
    rating: 4.85,
    reviews: 412,
    description: "贴码模板 + 镜像练习卡 + 字母对照册,盲拧入门一站式工具。",
    features: ["全 24 位棱角贴纸", "镜像练习 50 题", "字母对照册 PDF + 实体"],
    inStock: true,
  },
  {
    id: "timer-pro",
    name: "Pro 触感专业计时器",
    category: "配件",
    brand: "PlatformChoice",
    price: 198,
    rating: 4.78,
    reviews: 624,
    description: "WCA 认证标准计时器,毫秒级精度 + 蓝牙数据同步。",
    features: ["WCA 比赛通用", "蓝牙连接训练 APP", "千次电池续航"],
    inStock: true,
  },
  {
    id: "4x4-magnet",
    name: "四阶磁感竞速魔方",
    category: "竞速魔方",
    brand: "PlatformChoice",
    price: 358,
    rating: 4.81,
    reviews: 286,
    description: "升级磁条结构,大幅减少四阶错位,适合 sub-30 选手。",
    features: ["内置 48 颗磁铁", "防错位卡扣", "贴片可拆换"],
    inStock: true,
  },
  {
    id: "tee-cuber",
    name: "Cuber 限定 Tee",
    category: "周边",
    brand: "OpenCommunity",
    price: 89,
    rating: 4.7,
    reviews: 158,
    description: '原创"魔方开放社群"限定文化衫,亲肤纯棉。',
    features: ["纯棉 220g", "限量编号", "城市赛事限量配色"],
    inStock: true,
  },
  {
    id: "pyraminx-pro",
    name: "金字塔异形磁感魔方",
    category: "异形",
    brand: "PlatformChoice",
    price: 178,
    rating: 4.75,
    reviews: 209,
    description: "异形竞速主力,新选手友好的磁感与转动手感。",
    features: ["大角度容错", "磁感无段位", "色块大面积识别"],
    inStock: true,
  },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
