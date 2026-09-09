import { clampHistoryPosition, HISTORY_PLACES, HISTORY_SPACING } from './history-days';
import { HISTORY_LANDFORMS, LANDFORMS, type HistoryLandform } from './history-landforms';

export const WEATHER_LABELS = {
  storm: { zh: '雷雨', en: 'Thunderstorm' }, mudslide: { zh: '山涧泥石流', en: 'Debris flow' },
  fog: { zh: '山雾', en: 'Mist' }, rainbow: { zh: '雨后彩虹', en: 'Rainbow' },
  drizzle: { zh: '细雨', en: 'Drizzle' }, wind: { zh: '风起', en: 'Breeze' },
  sandstorm: { zh: '风沙', en: 'Blowing sand' }, sunset: { zh: '火烧云', en: 'Sunset clouds' },
  tornado: { zh: '沙漠旋风', en: 'Desert whirlwind' }, rain: { zh: '阵雨', en: 'Rain' },
  snow: { zh: '飘雪', en: 'Snow' }, blizzard: { zh: '风雪', en: 'Blizzard' },
  aurora: { zh: '极光', en: 'Aurora' }, hail: { zh: '冰雹', en: 'Hail' },
  sleet: { zh: '雨夹雪', en: 'Sleet' }, cloudy: { zh: '流云', en: 'Passing clouds' },
  clear: { zh: '晴空', en: 'Clear skies' }, sunshower: { zh: '太阳雨', en: 'Sunshower' },
  monsoon: { zh: '季风骤雨', en: 'Monsoon rain' }, seaFog: { zh: '海雾', en: 'Sea fog' },
  frost: { zh: '霜雾', en: 'Freezing mist' }, diamondDust: { zh: '冰晶', en: 'Diamond dust' },
  heatHaze: { zh: '热浪', en: 'Heat haze' }, pollen: { zh: '花粉风', en: 'Pollen breeze' },
} as const;
export type JourneyWeather = keyof typeof WEATHER_LABELS;

// Weather belongs to the actual landform: a warm atoll does not inherit a fjord's ice.
export const LANDFORM_WEATHER = {
  alpine: ['storm', 'snow', 'fog', 'hail', 'frost', 'clear'],
  folded: ['cloudy', 'mudslide', 'wind', 'rain', 'fog'],
  fault: ['clear', 'storm', 'mudslide', 'wind', 'sunset'],
  karst: ['fog', 'drizzle', 'monsoon', 'rainbow', 'sunshower'],
  cave: ['drizzle', 'fog', 'rain', 'cloudy', 'pollen'],
  sinkhole: ['monsoon', 'fog', 'drizzle', 'rainbow', 'pollen'],
  grassland: ['clear', 'wind', 'pollen', 'sunshower', 'cloudy', 'rainbow'],
  savanna: ['heatHaze', 'wind', 'monsoon', 'storm', 'sunset', 'clear'],
  meander: ['rainbow', 'drizzle', 'wind', 'fog', 'sunshower', 'rain'],
  braided: ['rain', 'wind', 'cloudy', 'rainbow', 'clear'],
  alluvial: ['mudslide', 'storm', 'rain', 'wind', 'clear'],
  dunes: ['sandstorm', 'heatHaze', 'tornado', 'clear', 'sunset'],
  yardang: ['wind', 'sandstorm', 'heatHaze', 'tornado', 'sunset'],
  mesa: ['sunset', 'clear', 'heatHaze', 'wind', 'storm'],
  badlands: ['mudslide', 'storm', 'wind', 'clear', 'heatHaze'],
  saltpan: ['heatHaze', 'clear', 'wind', 'sunset', 'sandstorm'],
  oasis: ['clear', 'heatHaze', 'wind', 'sunshower', 'sunset'],
  hills: ['pollen', 'rain', 'wind', 'fog', 'sunshower'],
  basin: ['fog', 'rain', 'cloudy', 'rainbow', 'sunset'],
  waterfall: ['rainbow', 'monsoon', 'mudslide', 'drizzle', 'fog'],
  glacier: ['snow', 'blizzard', 'diamondDust', 'frost', 'aurora', 'clear'],
  cirque: ['frost', 'snow', 'sleet', 'hail', 'diamondDust', 'clear'],
  moraine: ['sleet', 'wind', 'snow', 'frost', 'aurora'],
  tundra: ['frost', 'wind', 'snow', 'diamondDust', 'aurora'],
  icecap: ['diamondDust', 'blizzard', 'snow', 'frost', 'aurora'],
  fjord: ['seaFog', 'sleet', 'rain', 'hail', 'aurora', 'cloudy'],
  seaarch: ['seaFog', 'wind', 'storm', 'drizzle', 'clear'],
  atoll: ['clear', 'sunshower', 'monsoon', 'rainbow', 'wind'],
  lagoon: ['sunset', 'seaFog', 'drizzle', 'sunshower', 'wind'],
  delta: ['rain', 'monsoon', 'seaFog', 'storm', 'rainbow'],
  mangrove: ['monsoon', 'seaFog', 'drizzle', 'wind', 'sunshower'],
  plateau: ['sunset', 'wind', 'cloudy', 'rainbow', 'hail'],
  volcano: ['cloudy', 'storm', 'sunset', 'wind', 'clear'],
  caldera: ['rain', 'fog', 'rainbow', 'wind', 'clear'],
  lava: ['heatHaze', 'cloudy', 'wind', 'sunset', 'clear'],
  basalt: ['drizzle', 'seaFog', 'wind', 'cloudy', 'storm'],
  geothermal: ['fog', 'frost', 'sunset', 'cloudy', 'clear'],
} as const satisfies Record<HistoryLandform, readonly JourneyWeather[]>;

export const DAYLIGHT_LABELS = {
  dawn: { zh: '晨光', en: 'Dawn' }, day: { zh: '白昼', en: 'Daylight' },
  dusk: { zh: '暮色', en: 'Dusk' }, night: { zh: '月夜', en: 'Moonlight' },
} as const;

/** One imagined solar day per eight stops, independent of the clock and frame rate. */
export function historyDaylight(position: number) {
  const hour = (6 + clampHistoryPosition(position) * 3) % 24;
  const angle = (hour - 6) / 12 * Math.PI;
  const altitude = Math.sin(angle);
  const smooth = (value: number, from: number, to: number) => {
    const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  const daylight = smooth(altitude, -.24, .3);
  const twilight = 1 - smooth(Math.abs(altitude), .03, .48);
  const night = 1 - smooth(altitude, -.36, .06);
  const phase: keyof typeof DAYLIGHT_LABELS = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
  return { hour, angle, altitude, daylight, twilight, night, phase };
}

// These are authored landscapes, not historical weather or geographical claims.
const BIOMES = [
  { zh: '山川 峡谷', en: 'Mountains & canyons', elevation: .9, ridge: 7.5, water: 5.8, ground: 'jade' },
  { zh: '草原 湿地', en: 'Grassland & wetlands', elevation: 0, ridge: 1.4, water: 9, ground: 'jade' },
  { zh: '沙漠 台地', en: 'Desert & mesas', elevation: 2.6, ridge: 4.8, water: 3.7, ground: 'sand' },
  { zh: '森林 丘陵', en: 'Forest & hills', elevation: 1, ridge: 3.8, water: 6, ground: 'clay' },
  { zh: '冰川 苔原', en: 'Glaciers & tundra', elevation: 4.5, ridge: 10, water: 5, ground: 'snow' },
  { zh: '峡湾 海洋', en: 'Fjords & ocean', elevation: 1.5, ridge: 8, water: 10.2, ground: 'ice' },
  { zh: '城市 河口', en: 'City & estuary', elevation: 0, ridge: 1.2, water: 8, ground: 'limestone' },
  { zh: '高原 梯田', en: 'Plateau & terraces', elevation: 2.1, ridge: 5, water: 5.6, ground: 'jade' },
] as const;

// A coral coast must have a low, warm horizon; polar landforms keep their own relief and weather.
const RELIEF: Partial<Record<HistoryLandform, {
  elevation?: number; ridge?: number; water?: number;
  ground?: typeof BIOMES[number]['ground'] | 'heather';
}>> = {
  grassland: { ridge: .7 }, savanna: { ridge: 1 },
  dunes: { ridge: 1.8 }, saltpan: { elevation: .4, ridge: .7 }, oasis: { ridge: 1.2 },
  karst: { ridge: 4.5 },
  cave: { ridge: 3.3 }, sinkhole: { ridge: 3 },
  tundra: { elevation: 1, ridge: .7, ground: 'heather' },
  moraine: { elevation: 2, ridge: 2.2 }, icecap: { elevation: 2.4, ridge: 1.5 },
  seaarch: { elevation: .5, ridge: 2, ground: 'limestone' },
  atoll: { elevation: .1, ridge: .4, ground: 'sand', water: 12 },
  lagoon: { elevation: .1, ridge: .7, ground: 'sand', water: 11 },
  delta: { ridge: .6, ground: 'jade', water: 10 },
  mangrove: { ridge: .6, ground: 'jade', water: 10 },
  volcano: { ground: 'clay' },
  caldera: { ridge: 3.2, ground: 'clay' },
  lava: { ridge: 1.2, ground: 'clay' },
  basalt: { ridge: 2.1, ground: 'clay' }, geothermal: { ridge: 2.4, ground: 'limestone' },
};

const weatherVisits = new Map<HistoryLandform, number>();
export const HISTORY_ENVIRONMENTS = HISTORY_PLACES.map((place, day) => {
  const id = HISTORY_LANDFORMS[day];
  const biome = { ...BIOMES[place.biome], ...RELIEF[id], ...LANDFORMS[id] };
  const variation = place.authored ? 1 : .82 + (place.seed % 37) / 100;
  const choices: readonly JourneyWeather[] = LANDFORM_WEATHER[id];
  const visit = weatherVisits.get(id) ?? 0;
  weatherVisits.set(id, visit + 1);
  let start = visit % choices.length;
  const aurora = choices.indexOf('aurora');
  if (aurora >= 0) {
    const night = historyDaylight(day).phase === 'night';
    // An approaching aurora may use this night; other nights retain their snowfall and wind.
    if (night && (start + 1) % choices.length === aurora) start = aurora;
    else if (!night && start === aurora) start = (start + 1) % choices.length;
  }
  // Keep the original music pavilion's rainbow as an authored landmark.
  if (place.date === '2026-09-02') start = choices.indexOf('rainbow');
  const weather = [...choices.slice(start), ...choices.slice(0, start)];
  return { ...biome, elevation: biome.elevation * variation, ridge: biome.ridge * variation, weather };
});

export function environmentBlend(position: number) {
  const value = clampHistoryPosition(position), left = Math.floor(value);
  const t = Math.min(1, Math.max(0, (value - left - .18) / .64));
  return { left, right: Math.min(left + 1, HISTORY_ENVIRONMENTS.length - 1), t: t * t * (3 - 2 * t) };
}

export function environmentValue(x: number, key: 'elevation' | 'ridge' | 'water') {
  const { left, right, t } = environmentBlend(x / HISTORY_SPACING);
  return HISTORY_ENVIRONMENTS[left][key] * (1 - t) + HISTORY_ENVIRONMENTS[right][key] * t;
}

export const groundY = (x: number) => environmentValue(x, 'elevation');
export const riverZ = (x: number) => 5 + Math.sin(x * .056) * 1.45 + Math.sin(x * .13) * .55;
export const pathZ = (x: number) => riverZ(x) + environmentValue(x, 'water') / 2 + 1.75 + Math.sin(x * .15) * .55;
export const pathY = (x: number) => groundY(x) + .12;

export function journeyWeather(position: number, variation: number): JourneyWeather {
  const choices = HISTORY_ENVIRONMENTS[Math.round(clampHistoryPosition(position))].weather;
  const index = Number.isFinite(variation) ? Math.max(0, Math.floor(variation)) % choices.length : 0;
  return choices[index];
}
