import { HISTORY_PLACES } from './history-days';

/** Natural scenery supplements, never replaces, the independently authored daily sculpture. */
export const LANDFORMS = {
  alpine: { zh: '角峰 雪脊', en: 'Alpine peaks', biome: 0 },
  folded: { zh: '褶皱山脉', en: 'Folded mountains', biome: 0 },
  fault: { zh: '断块山地', en: 'Fault-block mountains', biome: 0 },
  karst: { zh: '喀斯特峰林', en: 'Karst towers', biome: 0 },
  cave: { zh: '溶洞 钟乳石', en: 'Limestone caverns', biome: 0 },
  sinkhole: { zh: '天坑', en: 'Karst sinkholes', biome: 0 },
  grassland: { zh: '草原平原', en: 'Grassland plains', biome: 1 },
  savanna: { zh: '稀树草原', en: 'Savanna', biome: 1 },
  meander: { zh: '曲流 牛轭湖', en: 'Meanders & oxbow lakes', biome: 1 },
  braided: { zh: '辫状河 沙洲', en: 'Braided rivers', biome: 1 },
  alluvial: { zh: '冲积扇', en: 'Alluvial fans', biome: 1 },
  dunes: { zh: '沙海 新月形沙丘', en: 'Dune seas', biome: 2 },
  yardang: { zh: '雅丹 风蚀脊', en: 'Yardangs', biome: 2 },
  mesa: { zh: '台地 孤峰', en: 'Mesas & buttes', biome: 2 },
  badlands: { zh: '劣地 沟壑', en: 'Badlands', biome: 2 },
  saltpan: { zh: '盐湖 盐壳', en: 'Salt pans', biome: 2 },
  oasis: { zh: '沙漠绿洲', en: 'Desert oases', biome: 2 },
  hills: { zh: '森林丘陵', en: 'Forested hills', biome: 3 },
  basin: { zh: '山间盆地 湖泊', en: 'Lake basins', biome: 3 },
  waterfall: { zh: '峡谷 阶梯瀑布', en: 'Waterfall gorges', biome: 3 },
  glacier: { zh: '冰川 U 形谷', en: 'Glacial valleys', biome: 4 },
  cirque: { zh: '冰斗 冰湖', en: 'Cirques & tarns', biome: 4 },
  moraine: { zh: '冰碛丘垄', en: 'Moraines', biome: 4 },
  tundra: { zh: '苔原 冻土多边形', en: 'Tundra & patterned ground', biome: 4 },
  icecap: { zh: '冰盖 冰架', en: 'Ice caps & shelves', biome: 4 },
  fjord: { zh: '峡湾', en: 'Fjords', biome: 5 },
  seaarch: { zh: '海蚀崖 拱门 石柱', en: 'Sea cliffs, arches & stacks', biome: 5 },
  atoll: { zh: '珊瑚环礁', en: 'Coral atolls', biome: 5 },
  lagoon: { zh: '障壁岛 潟湖', en: 'Barrier islands & lagoons', biome: 5 },
  delta: { zh: '河口三角洲', en: 'River deltas', biome: 6 },
  mangrove: { zh: '红树林 潮滩', en: 'Mangroves & tidal flats', biome: 6 },
  plateau: { zh: '高原 陡崖', en: 'Plateaus & escarpments', biome: 7 },
  volcano: { zh: '火山 火口', en: 'Volcanic cones', biome: 7 },
  caldera: { zh: '破火山口 湖泊', en: 'Calderas', biome: 7 },
  lava: { zh: '熔岩原', en: 'Lava fields', biome: 7 },
  basalt: { zh: '玄武岩柱', en: 'Columnar basalt', biome: 7 },
  geothermal: { zh: '地热泉 叠池', en: 'Geothermal terraces', biome: 7 },
} as const;

export type HistoryLandform = keyof typeof LANDFORMS;
const families = Array.from({ length: 8 }, (_, biome) =>
  (Object.keys(LANDFORMS) as HistoryLandform[]).filter(id => LANDFORMS[id].biome === biome));
const authored: HistoryLandform[] = ['alpine', 'meander', 'dunes', 'hills', 'glacier', 'fjord', 'delta', 'plateau'];
const visits = Array<number>(8).fill(0);

/** Enumerate every family before revisiting it; date seeds never stand in for a new landform. */
export const HISTORY_LANDFORMS = HISTORY_PLACES.map(place => {
  const family = families[place.biome];
  return place.authored ? authored[place.motif!] : family[visits[place.biome]++ % family.length];
});
