import { HISTORY_LANDFORMS, type HistoryLandform } from './history-landforms';

export const ANIMALS = {
  elephant: { zh: '大象', en: 'Elephant', realm: 'land' },
  giraffe: { zh: '长颈鹿', en: 'Giraffe', realm: 'land' },
  zebra: { zh: '斑马', en: 'Zebra', realm: 'land' },
  lion: { zh: '狮子', en: 'Lion', realm: 'land' },
  gazelle: { zh: '瞪羚', en: 'Gazelle', realm: 'land' },
  rhino: { zh: '犀牛', en: 'Rhinoceros', realm: 'land' },
  hippo: { zh: '河马', en: 'Hippopotamus', realm: 'land' },
  buffalo: { zh: '水牛', en: 'Buffalo', realm: 'land' },
  wildebeest: { zh: '角马', en: 'Wildebeest', realm: 'land' },
  ostrich: { zh: '鸵鸟', en: 'Ostrich', realm: 'land' },
  meerkat: { zh: '狐獴', en: 'Meerkat', realm: 'land' },
  warthog: { zh: '疣猪', en: 'Warthog', realm: 'land' },
  bear: { zh: '棕熊', en: 'Brown bear', realm: 'land' },
  polarBear: { zh: '北极熊', en: 'Polar bear', realm: 'land' },
  wolf: { zh: '狼', en: 'Wolf', realm: 'land' },
  fox: { zh: '狐狸', en: 'Fox', realm: 'land' },
  deer: { zh: '鹿', en: 'Deer', realm: 'land' },
  moose: { zh: '驼鹿', en: 'Moose', realm: 'land' },
  rabbit: { zh: '野兔', en: 'Hare', realm: 'land' },
  squirrel: { zh: '松鼠', en: 'Squirrel', realm: 'land' },
  ibex: { zh: '北山羊', en: 'Ibex', realm: 'land' },
  yak: { zh: '牦牛', en: 'Yak', realm: 'land' },
  camel: { zh: '骆驼', en: 'Camel', realm: 'land' },
  penguin: { zh: '企鹅', en: 'Penguin', realm: 'land' },
  eagle: { zh: '鹰', en: 'Eagle', realm: 'air' },
  crane: { zh: '鹤', en: 'Crane', realm: 'air' },
  flamingo: { zh: '火烈鸟', en: 'Flamingo', realm: 'air' },
  swallow: { zh: '燕子', en: 'Swallow', realm: 'air' },
  owl: { zh: '猫头鹰', en: 'Owl', realm: 'air' },
  parrot: { zh: '鹦鹉', en: 'Parrot', realm: 'air' },
  duck: { zh: '野鸭', en: 'Wild duck', realm: 'air' },
  gull: { zh: '海鸥', en: 'Gull', realm: 'air' },
  fish: { zh: '鱼', en: 'Fish', realm: 'water' },
  dolphin: { zh: '海豚', en: 'Dolphin', realm: 'water' },
  whale: { zh: '鲸', en: 'Whale', realm: 'water' },
  seaTurtle: { zh: '海龟', en: 'Sea turtle', realm: 'water' },
} as const;

export type AnimalSpecies = keyof typeof ANIMALS;
type Habitat = 'mountain' | 'woodland' | 'savanna' | 'wetland' | 'desert' | 'arctic' | 'antarctic' | 'tundra' | 'tropicalCoast' | 'coldCoast' | 'volcanic';
type HabitatAnimals = { land: AnimalSpecies[]; birds: AnimalSpecies[]; water: AnimalSpecies[] };
const HABITATS: Record<Habitat, HabitatAnimals> = {
  mountain: { land: ['ibex', 'yak'], birds: ['eagle'], water: ['fish'] },
  woodland: { land: ['bear', 'wolf', 'fox', 'deer', 'moose', 'rabbit', 'squirrel'], birds: ['owl', 'swallow'], water: ['fish', 'duck'] },
  savanna: { land: ['elephant', 'giraffe', 'zebra', 'lion', 'gazelle', 'rhino', 'buffalo', 'wildebeest', 'ostrich', 'warthog'], birds: ['swallow', 'eagle'], water: ['fish'] },
  wetland: { land: ['hippo', 'buffalo'], birds: ['crane', 'flamingo'], water: ['duck', 'fish'] },
  desert: { land: ['camel', 'meerkat', 'gazelle'], birds: ['eagle'], water: ['fish'] },
  arctic: { land: ['polarBear'], birds: ['gull'], water: ['whale'] },
  antarctic: { land: ['penguin'], birds: ['gull'], water: ['whale'] },
  tundra: { land: ['deer', 'wolf'], birds: ['owl', 'gull'], water: ['fish'] },
  tropicalCoast: { land: [], birds: ['parrot', 'flamingo', 'gull'], water: ['seaTurtle', 'dolphin', 'fish'] },
  coldCoast: { land: [], birds: ['gull', 'eagle'], water: ['whale', 'dolphin'] },
  volcanic: { land: ['ibex', 'fox'], birds: ['eagle', 'swallow'], water: ['fish'] },
};
const LANDFORM_HABITATS: Record<HistoryLandform, Habitat> = {
  alpine: 'mountain', folded: 'mountain', fault: 'mountain', karst: 'woodland', cave: 'woodland', sinkhole: 'woodland',
  grassland: 'savanna', savanna: 'savanna', meander: 'wetland', braided: 'wetland', alluvial: 'savanna',
  dunes: 'desert', yardang: 'desert', mesa: 'desert', badlands: 'desert', saltpan: 'desert', oasis: 'desert',
  hills: 'woodland', basin: 'woodland', waterfall: 'woodland',
  glacier: 'antarctic', cirque: 'arctic', moraine: 'antarctic', tundra: 'tundra', icecap: 'arctic',
  fjord: 'coldCoast', seaarch: 'coldCoast', atoll: 'tropicalCoast', lagoon: 'tropicalCoast',
  delta: 'wetland', mangrove: 'tropicalCoast',
  plateau: 'mountain', volcano: 'volcanic', caldera: 'volcanic', lava: 'volcanic', basalt: 'volcanic', geothermal: 'volcanic',
};

export type AnimalEncounter = { species: AnimalSpecies; layer: 'bank' | 'air' | 'water' };
const visits = new Map<Habitat, number>();
/** Stable habitat assignments: geometry and animation stay attached to the date, never the camera. */
export const HISTORY_FAUNA: AnimalEncounter[][] = HISTORY_LANDFORMS.map(id => {
  const habitat = LANDFORM_HABITATS[id], pool = HABITATS[habitat], visit = visits.get(habitat) ?? 0;
  visits.set(habitat, visit + 1);
  const encounters: AnimalEncounter[] = [];
  // Two residents per date leave the landscape spacious; successive visits reveal the whole habitat.
  if (pool.land.length) encounters.push({ species: pool.land[visit % pool.land.length], layer: 'bank' });
  const cycle = pool.land.length ? Math.floor(visit / 2) : visit;
  if (!pool.land.length || visit % 2 === 0) {
    const bird = pool.birds[cycle % pool.birds.length];
    encounters.push({ species: bird, layer: bird === 'crane' || bird === 'flamingo' ? 'bank' : 'air' });
  }
  if (!pool.land.length || visit % 2 === 1) encounters.push({ species: pool.water[cycle % pool.water.length], layer: 'water' });
  return encounters;
});
