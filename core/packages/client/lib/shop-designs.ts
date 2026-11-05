import type { PlatformEntity, PlatformLocaleText } from './platform-types';
import { SHOP_POSTER } from './shop';

/** Approved artwork only. Prices, variants and stock always come from commerce. */
export interface ShopDesign {
  slug: string;
  title: PlatformLocaleText;
  summary: PlatformLocaleText;
  description: PlatformLocaleText;
  image: string;
  alt: PlatformLocaleText;
}

export const SHOP_DESIGNS: readonly ShopDesign[] = [
  {
    slug: 'cubetown-mat',
    title: { zh: 'CubeRoot 魔方游乐城 · 魔方垫 / 鼠标垫', en: 'CubeRoot Cubetown · Cubing & Mouse Mat' },
    summary: { zh: '奶油白、橘红与青绿，铺开一座热闹的微缩魔方城市。', en: 'A miniature cubing city in warm cream, terracotta and jade.' },
    description: { zh: '三阶魔方工坊、SQ1 观景台、金字塔温室与五魔方水塔串起整座城市。小火车穿过街区，机械臂搬运魔方，广场上的魔友正在练习。等距插画铺满画面，角落藏着咖啡摊、花园和小猫。', en: 'Explore a 3×3 workshop, Square-1 observatory, Pyraminx greenhouse and Megaminx water tower. Trams cross the neighbourhood, a robot moves puzzles, and cubers practise in the square. The full-bleed isometric illustration is filled with cafés, gardens and tiny cats.' },
    image: '/images/shop/cuberoot-cubetown-55bbdfbb.svg',
    alt: { zh: '魔方游乐城图案：暖色等距城市、魔方建筑、摩天轮与小火车', en: 'Cubetown artwork: a warm isometric city with puzzle buildings, a ferris wheel and trams' },
  },
  {
    slug: 'dreamscape-mat',
    title: { zh: 'CubeRoot 逐梦星图 · 魔方垫 / 鼠标垫', en: 'CubeRoot Dreamscape · Cubing & Mouse Mat' },
    summary: { zh: '蓝色星图、红色爱心与魔方，记录热爱的形状。', en: 'Blue constellations, a red heart and a collection of puzzles.' },
    description: { zh: '以蓝色为主调，魔表、金字塔、五魔方、SQ1 与三阶魔方分布在星图四周。中央的 CubeRoot 标志与红蓝方格相呼应，保留 Goodwill、Endeavor、Passion 和 Dreams come true 的原作主题。', en: 'Clock, Pyraminx, Megaminx, Square-1 and 3×3 puzzles surround a blue constellation map. The central CubeRoot mark echoes the red and blue tiles, preserving the original Goodwill, Endeavor, Passion and Dreams come true themes.' },
    image: SHOP_POSTER,
    alt: { zh: '逐梦星图图案：蓝色星图、不同魔方与红色爱心', en: 'Dreamscape artwork: blue constellations, twisty puzzles and a red heart' },
  },
];

export function findShopDesign(slug: string) { return SHOP_DESIGNS.find(design => design.slug === slug); }

/** Read-only presentation fallback, with no sellable IDs or invented offers. */
export function shopDesignPreview(design: ShopDesign): PlatformEntity {
  return {
    id: design.slug, title: design.title.en, status: 'preview',
    data: {
      slug: design.slug, titleZh: design.title.zh, titleEn: design.title.en,
      descriptionZh: design.description.zh, descriptionEn: design.description.en,
      designPreview: true, variants: [],
      presentation: { imageUrl: design.image, imageAspectRatio: '2:1', subtitleZh: design.summary.zh, subtitleEn: design.summary.en },
    },
  };
}
