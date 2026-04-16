/**
 * WCA 比赛地图 — MapLibre GL JS 矢量地球
 * 模式：
 *   - upcoming: 近期全球比赛聚合点
 *   - cuber:    选手生涯足迹（按时间顺序画大圆弧，支持 play/scrub）
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RotateCcw, Play, Pause, X, User } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import greatCircle from '@turf/great-circle';
import { point as turfPoint } from '@turf/helpers';
import {
  fetchAllUpcomingCompetitions,
  fetchCompetitions,
  fetchCompetitionDetail,
  WcaPersonPicker,
  type WcaUpcomingComp,
  type WcaCompDetail,
  type WcaPerson,
} from '@cuberoot/shared';
import LangToggle from '../components/LangToggle';
import './globe.css';

type Mode = 'upcoming' | 'cuber';
type RangeKey = 'month' | 'quarter' | 'year';
type Speed = 0.5 | 1 | 2;

// NOTE: 有 MapTiler key 就用 streets-v2（多语言瓦片）；无则降级 demotiles
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
const MAP_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://demotiles.maplibre.org/style.json';
const USING_MAPTILER = !!MAPTILER_KEY;

// NOTE: ISO alpha-2 → 国家名（英/中）；UI 展示用
const COUNTRY_EN: Record<string, string> = {
  CN: 'China', US: 'USA', JP: 'Japan', KR: 'Korea', IN: 'India',
  DE: 'Germany', FR: 'France', GB: 'UK', IT: 'Italy', ES: 'Spain',
  PL: 'Poland', BR: 'Brazil', CA: 'Canada', AU: 'Australia', MX: 'Mexico',
  TW: 'Chinese Taipei', HK: 'Hong Kong', RU: 'Russia', TR: 'Turkey', ID: 'Indonesia',
  NL: 'Netherlands', BE: 'Belgium', SE: 'Sweden', NO: 'Norway', FI: 'Finland',
  DK: 'Denmark', CH: 'Switzerland', AT: 'Austria', CZ: 'Czechia', SK: 'Slovakia',
  HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', GR: 'Greece', PT: 'Portugal',
  IE: 'Ireland', NZ: 'New Zealand', SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand',
  VN: 'Vietnam', PH: 'Philippines', AR: 'Argentina', CL: 'Chile', CO: 'Colombia',
  PE: 'Peru', ZA: 'South Africa', EG: 'Egypt', AE: 'UAE', SA: 'Saudi Arabia',
  IL: 'Israel', IR: 'Iran', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka',
  NP: 'Nepal', UA: 'Ukraine', BY: 'Belarus', EE: 'Estonia', LV: 'Latvia', LT: 'Lithuania',
};
const COUNTRY_ZH: Record<string, string> = {
  CN: '中国', US: '美国', JP: '日本', KR: '韩国', IN: '印度',
  DE: '德国', FR: '法国', GB: '英国', IT: '意大利', ES: '西班牙',
  PL: '波兰', BR: '巴西', CA: '加拿大', AU: '澳大利亚', MX: '墨西哥',
  TW: '中华台北', HK: '中国香港', RU: '俄罗斯', TR: '土耳其', ID: '印度尼西亚',
  NL: '荷兰', BE: '比利时', SE: '瑞典', NO: '挪威', FI: '芬兰',
  DK: '丹麦', CH: '瑞士', AT: '奥地利', CZ: '捷克', SK: '斯洛伐克',
  HU: '匈牙利', RO: '罗马尼亚', BG: '保加利亚', GR: '希腊', PT: '葡萄牙',
  IE: '爱尔兰', NZ: '新西兰', SG: '新加坡', MY: '马来西亚', TH: '泰国',
  VN: '越南', PH: '菲律宾', AR: '阿根廷', CL: '智利', CO: '哥伦比亚',
  PE: '秘鲁', ZA: '南非', EG: '埃及', AE: '阿联酋', SA: '沙特',
  IL: '以色列', IR: '伊朗', PK: '巴基斯坦', BD: '孟加拉国', LK: '斯里兰卡',
  NP: '尼泊尔', UA: '乌克兰', BY: '白俄罗斯', EE: '爱沙尼亚', LV: '拉脱维亚', LT: '立陶宛',
};
const countryName = (iso2: string, isZh: boolean) => {
  const up = (iso2 || '').toUpperCase();
  return (isZh ? COUNTRY_ZH[up] : COUNTRY_EN[up]) ?? up;
};

// NOTE: demotiles centroids layer 用 NAME（英文全称）做 label；映射到中文
const COUNTRY_NAME_ZH: Record<string, string> = {
  'China': '中国', 'Taiwan': '中华台北', 'Hong Kong S.A.R.': '中国香港',
  'United States of America': '美国', 'Japan': '日本',
  'South Korea': '韩国', 'North Korea': '朝鲜',
  'India': '印度', 'Germany': '德国', 'France': '法国',
  'United Kingdom': '英国', 'Italy': '意大利', 'Spain': '西班牙',
  'Poland': '波兰', 'Brazil': '巴西', 'Canada': '加拿大',
  'Australia': '澳大利亚', 'Mexico': '墨西哥',
  'Russia': '俄罗斯', 'Turkey': '土耳其', 'Indonesia': '印度尼西亚',
  'Netherlands': '荷兰', 'Belgium': '比利时', 'Sweden': '瑞典',
  'Norway': '挪威', 'Finland': '芬兰', 'Denmark': '丹麦',
  'Switzerland': '瑞士', 'Austria': '奥地利', 'Czechia': '捷克',
  'Czech Republic': '捷克', 'Slovakia': '斯洛伐克', 'Hungary': '匈牙利',
  'Romania': '罗马尼亚', 'Bulgaria': '保加利亚', 'Greece': '希腊',
  'Portugal': '葡萄牙', 'Ireland': '爱尔兰', 'New Zealand': '新西兰',
  'Singapore': '新加坡', 'Malaysia': '马来西亚', 'Thailand': '泰国',
  'Vietnam': '越南', 'Philippines': '菲律宾', 'Argentina': '阿根廷',
  'Chile': '智利', 'Colombia': '哥伦比亚', 'Peru': '秘鲁',
  'South Africa': '南非', 'Egypt': '埃及', 'United Arab Emirates': '阿联酋',
  'Saudi Arabia': '沙特阿拉伯', 'Israel': '以色列', 'Iran': '伊朗',
  'Pakistan': '巴基斯坦', 'Bangladesh': '孟加拉国', 'Sri Lanka': '斯里兰卡',
  'Nepal': '尼泊尔', 'Ukraine': '乌克兰', 'Belarus': '白俄罗斯',
  'Estonia': '爱沙尼亚', 'Latvia': '拉脱维亚', 'Lithuania': '立陶宛',
  'Mongolia': '蒙古', 'Kazakhstan': '哈萨克斯坦', 'Uzbekistan': '乌兹别克斯坦',
  'Kyrgyzstan': '吉尔吉斯斯坦', 'Turkmenistan': '土库曼斯坦',
  'Tajikistan': '塔吉克斯坦', 'Afghanistan': '阿富汗', 'Iraq': '伊拉克',
  'Jordan': '约旦', 'Lebanon': '黎巴嫩', 'Syria': '叙利亚', 'Yemen': '也门',
  'Oman': '阿曼', 'Qatar': '卡塔尔', 'Kuwait': '科威特', 'Bahrain': '巴林',
  'Morocco': '摩洛哥', 'Algeria': '阿尔及利亚', 'Tunisia': '突尼斯',
  'Libya': '利比亚', 'Nigeria': '尼日利亚', 'Kenya': '肯尼亚',
  'Ethiopia': '埃塞俄比亚', 'Tanzania': '坦桑尼亚', 'Uganda': '乌干达',
  'Ghana': '加纳', 'Cameroon': '喀麦隆', "Côte d'Ivoire": '科特迪瓦',
  'Ivory Coast': '科特迪瓦', 'Senegal': '塞内加尔', 'Sudan': '苏丹',
  'South Sudan': '南苏丹', 'Somalia': '索马里',
  'Somaliland': '索马里兰', 'Angola': '安哥拉', 'Zimbabwe': '津巴布韦',
  'Mozambique': '莫桑比克', 'Madagascar': '马达加斯加', 'Cuba': '古巴',
  'Dominican Republic': '多米尼加', 'Jamaica': '牙买加', 'Haiti': '海地',
  'Venezuela': '委内瑞拉', 'Ecuador': '厄瓜多尔', 'Bolivia': '玻利维亚',
  'Paraguay': '巴拉圭', 'Uruguay': '乌拉圭', 'Panama': '巴拿马',
  'Costa Rica': '哥斯达黎加', 'Guatemala': '危地马拉', 'Honduras': '洪都拉斯',
  'El Salvador': '萨尔瓦多', 'Nicaragua': '尼加拉瓜', 'Cambodia': '柬埔寨',
  'Laos': '老挝', 'Myanmar': '缅甸', 'Brunei': '文莱',
  'Macao S.A.R': '中国澳门', 'Iceland': '冰岛', 'Serbia': '塞尔维亚',
  'Republic of Serbia': '塞尔维亚', 'Croatia': '克罗地亚',
  'Slovenia': '斯洛文尼亚', 'Bosnia and Herzegovina': '波斯尼亚和黑塞哥维那',
  'Montenegro': '黑山', 'North Macedonia': '北马其顿', 'Macedonia': '北马其顿',
  'Albania': '阿尔巴尼亚', 'Malta': '马耳他',
  'Cyprus': '塞浦路斯', 'N. Cyprus': '北塞浦路斯', 'Northern Cyprus': '北塞浦路斯',
  'Luxembourg': '卢森堡', 'Moldova': '摩尔多瓦', 'Georgia': '格鲁吉亚',
  'Armenia': '亚美尼亚', 'Azerbaijan': '阿塞拜疆', 'Greenland': '格陵兰',
  'Western Sahara': '西撒哈拉', 'Palestine': '巴勒斯坦',
  'Democratic Republic of the Congo': '刚果（金）', 'Republic of Congo': '刚果（布）',
  'Chad': '乍得', 'Niger': '尼日尔', 'Mali': '马里', 'Mauritania': '毛里塔尼亚',
  'Burkina Faso': '布基纳法索', 'Guinea': '几内亚', 'Liberia': '利比里亚',
  'Sierra Leone': '塞拉利昂', 'Togo': '多哥', 'Benin': '贝宁',
  'Central African Republic': '中非共和国', 'Gabon': '加蓬', 'Equatorial Guinea': '赤道几内亚',
  'Rwanda': '卢旺达', 'Burundi': '布隆迪', 'Malawi': '马拉维',
  'Zambia': '赞比亚', 'Botswana': '博茨瓦纳', 'Namibia': '纳米比亚',
  'Lesotho': '莱索托', 'Eswatini': '埃斯瓦蒂尼', 'Swaziland': '斯威士兰',
  'Djibouti': '吉布提', 'Eritrea': '厄立特里亚', 'Bhutan': '不丹',
  'Timor-Leste': '东帝汶', 'East Timor': '东帝汶', 'Fiji': '斐济',
  'Papua New Guinea': '巴布亚新几内亚', 'Solomon Islands': '所罗门群岛',
  'Vanuatu': '瓦努阿图', 'Guyana': '圭亚那', 'Suriname': '苏里南',
  'French Guiana': '法属圭亚那', 'Bahamas': '巴哈马', 'Trinidad and Tobago': '特立尼达和多巴哥',
  'The Bahamas': '巴哈马', 'Puerto Rico': '波多黎各',
  'Falkland Islands': '福克兰群岛', 'New Caledonia': '新喀里多尼亚',
  'Antarctica': '南极洲',
};

// NOTE: 赤道 / 回归线等地理线标签中文
const GEOLINE_ZH: Record<string, string> = {
  'Arctic Circle': '北极圈',
  'Antarctic Circle': '南极圈',
  'Tropic of Cancer': '北回归线',
  'Tropic of Capricorn': '南回归线',
  'International Date Line': '国际日期变更线',
  'Equator': '赤道',
};

const CUBER_SOURCE_POINTS = 'cuber-points';
const CUBER_SOURCE_ARCS = 'cuber-arcs';
const CUBER_LAYER_DOT = 'cuber-points-dot';
const CUBER_LAYER_LABEL = 'cuber-points-label';
const CUBER_LAYER_ARC = 'cuber-arcs-line';

const UPCOMING_LAYERS = ['clusters', 'cluster-count', 'unclustered-point'];
const CUBER_LAYERS = [CUBER_LAYER_ARC, CUBER_LAYER_DOT, CUBER_LAYER_LABEL];

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// NOTE: MapTiler 通用语言切换 —— 遍历所有 symbol 图层，把 text-field 的 name 字段换成 name:zh/name:en
function patchMapTilerLang(map: maplibregl.Map, isZh: boolean) {
  const targetLang = isZh ? 'name:zh' : 'name:en';
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    try {
      // 用 coalesce 回退：name:lang → name:latin → name
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', targetLang],
        ['get', 'name:latin'],
        ['get', 'name'],
      ] as unknown as string);
    } catch { /* 该 layer 无 text-field 或表达式不兼容 */ }
  }
}

// NOTE: MapTiler 下给 TWN 强制显示 "Chinese Taipei"/「中华台北」
function patchMapTilerTaiwan(map: maplibregl.Map, isZh: boolean) {
  const twnLabel = isZh ? '中华台北' : 'Chinese Taipei';
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    if (!layer.id.includes('country')) continue;
    try {
      const current = map.getLayoutProperty(layer.id, 'text-field');
      map.setLayoutProperty(layer.id, 'text-field', [
        'case',
        ['any',
          ['==', ['get', 'iso_a2'], 'TW'],
          ['==', ['get', 'iso_3166_1'], 'TW'],
        ],
        twnLabel,
        current,
      ] as unknown as string);
    } catch { /* */ }
  }
}

// NOTE: demotiles 的 patch（降级路径用）
function patchDemotiles(map: maplibregl.Map, isZh: boolean) {
  // Fill: TWN 颜色 = CHN
  try {
    const fillExpr = map.getPaintProperty('countries-fill', 'fill-color');
    let chnColor: string | null = null;
    if (Array.isArray(fillExpr) && fillExpr[0] === 'match') {
      for (let i = 2; i < fillExpr.length - 1; i += 2) {
        const key = fillExpr[i];
        const val = fillExpr[i + 1];
        if (key === 'CHN' || (Array.isArray(key) && key.includes('CHN'))) {
          chnColor = String(val);
          break;
        }
      }
    }
    if (chnColor) {
      map.setPaintProperty('countries-fill', 'fill-color', [
        'case', ['==', ['get', 'ADM0_A3'], 'TWN'], chnColor, fillExpr,
      ] as unknown as string);
    }
  } catch { /* */ }

  // Country label
  try {
    if (isZh) {
      const pairs: unknown[] = [];
      for (const [en, zh] of Object.entries(COUNTRY_NAME_ZH)) pairs.push(en, zh);
      const expr = ['match', ['get', 'NAME'], ...pairs, ['get', 'NAME']];
      map.setLayoutProperty('countries-label', 'text-field', expr as unknown as string);
    } else {
      const twnCase = (field: string) => [
        'case', ['==', ['get', 'NAME'], 'Taiwan'], 'Chinese Taipei', ['get', field],
      ];
      map.setLayoutProperty('countries-label', 'text-field', [
        'step', ['zoom'], twnCase('ABBREV'), 2, twnCase('NAME'),
      ] as unknown as string);
    }
  } catch { /* */ }

  // Geoline labels
  try {
    if (isZh) {
      const pairs: unknown[] = [];
      for (const [en, zh] of Object.entries(GEOLINE_ZH)) pairs.push(en, zh);
      const expr = ['match', ['get', 'name'], ...pairs, ['get', 'name']];
      map.setLayoutProperty('geolines-label', 'text-field', expr as unknown as string);
    } else {
      map.setLayoutProperty('geolines-label', 'text-field', ['get', 'name'] as unknown as string);
    }
  } catch { /* */ }
}

function patchMapStyle(map: maplibregl.Map, isZh: boolean) {
  if (USING_MAPTILER) {
    patchMapTilerLang(map, isZh);
    patchMapTilerTaiwan(map, isZh);
  } else {
    patchDemotiles(map, isZh);
  }
}

// NOTE: 简易并发池——不装 p-limit，限 N 个 worker 同时拉
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (t: T, i: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<(R | undefined)[]> {
  const out: (R | undefined)[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try { out[i] = await fn(items[i], i); }
      catch { /* 记为 undefined */ }
      done++;
      onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export default function GlobePage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const mapLoadedRef = useRef(false);
  const isZhRef = useRef(isZh);
  useEffect(() => { isZhRef.current = isZh; }, [isZh]);

  // ── 公共 state ──
  const [mode, setMode] = useState<Mode>('upcoming');
  const [error, setError] = useState<string | null>(null);

  // ── upcoming 模式 state ──
  const [comps, setComps] = useState<WcaUpcomingComp[] | null>(null);
  const [range, setRange] = useState<RangeKey>('quarter');
  const [selectedComp, setSelectedComp] = useState<WcaUpcomingComp | null>(null);

  // ── cuber 模式 state ──
  const [cuber, setCuber] = useState<WcaPerson | null>(null);
  const [cuberComps, setCuberComps] = useState<WcaCompDetail[]>([]);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── 拉 upcoming 数据 ──
  useEffect(() => {
    const from = fmtDate(new Date());
    fetchAllUpcomingCompetitions(from)
      .then((list) => setComps(list.filter((c) => c.latitude_degrees != null && c.longitude_degrees != null)))
      .catch(() => setError(t('globe.loadFailed')));
  }, [t]);

  const filteredComps = useMemo(() => {
    if (!comps) return [];
    const daysMap: Record<RangeKey, number> = { month: 30, quarter: 90, year: 365 };
    const cutoff = addDays(new Date(), daysMap[range]);
    return comps.filter((c) => new Date(c.start_date) <= cutoff);
  }, [comps, range]);

  const upcomingStats = useMemo(() => {
    const countries = new Set(filteredComps.map((c) => c.country_iso2));
    return { comps: filteredComps.length, countries: countries.size };
  }, [filteredComps]);

  const upcomingGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredComps.map((c) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.longitude_degrees, c.latitude_degrees] },
      properties: {
        id: c.id, name: c.name, city: c.city,
        country_iso2: c.country_iso2,
        start_date: c.start_date, end_date: c.end_date, url: c.url,
      },
    })),
  }), [filteredComps]);

  // ── cuber 数据加载 ──
  const loadCuberPath = useCallback(async (person: WcaPerson) => {
    setError(null);
    setCuberComps([]);
    setCurrentIndex(0);
    setPlaying(false);

    const comps = await fetchCompetitions(person.wcaId);
    if (!comps || comps.length === 0) {
      setLoadProgress(null);
      setCuberComps([]);
      return;
    }

    // 按开始日期排序（API 一般已有序，保险起见再排一次）
    const sorted = [...comps].sort((a, b) => a.start_date.localeCompare(b.start_date));
    setLoadProgress({ done: 0, total: sorted.length });

    const details = await mapWithConcurrency(
      sorted,
      6,
      (c) => fetchCompetitionDetail(c.id),
      (done, total) => setLoadProgress({ done, total }),
    );

    const valid = details
      .filter((d): d is WcaCompDetail => !!d && typeof d.latitude_degrees === 'number')
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    setCuberComps(valid);
    setLoadProgress(null);
    setCurrentIndex(Math.max(0, valid.length - 1)); // 默认显示完整路径
  }, []);

  // ── cuber 图层数据 ──
  const cuberPointsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: cuberComps.map((c, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.longitude_degrees, c.latitude_degrees] },
      properties: {
        index: i, id: c.id, name: c.name, city: c.city,
        country_iso2: c.country_iso2, start_date: c.start_date, url: c.url,
      },
    })),
  }), [cuberComps]);

  // NOTE: 预计算每对相邻 comp 的大圆弧全量坐标（动画 slice 用）
  const cuberArcFullCoords = useMemo<Array<[number, number][]>>(() => {
    const out: Array<[number, number][]> = [];
    for (let i = 0; i < cuberComps.length - 1; i++) {
      const a = cuberComps[i], b = cuberComps[i + 1];
      if (a.latitude_degrees === b.latitude_degrees && a.longitude_degrees === b.longitude_degrees) {
        out.push([]);
        continue;
      }
      try {
        const line = greatCircle(
          turfPoint([a.longitude_degrees, a.latitude_degrees]),
          turfPoint([b.longitude_degrees, b.latitude_degrees]),
        );
        if (line.geometry.type === 'LineString') {
          out.push(line.geometry.coordinates as [number, number][]);
        } else {
          // MultiLineString (anti-meridian 穿越) — 合并
          out.push(line.geometry.coordinates.flat() as [number, number][]);
        }
      } catch {
        out.push([[a.longitude_degrees, a.latitude_degrees], [b.longitude_degrees, b.latitude_degrees]]);
      }
    }
    return out;
  }, [cuberComps]);

  // NOTE: 动画进度（0..1），由 requestAnimationFrame 驱动
  const [animProgress, setAnimProgress] = useState(1);
  const prevIndexRef = useRef(0);

  // NOTE: 基于 currentIndex + animProgress 动态构造 arc 特征——最后一条弧按进度 slice
  const cuberArcsGeojson = useMemo(() => {
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (let i = 0; i < currentIndex; i++) {
      const coords = cuberArcFullCoords[i];
      if (!coords || coords.length < 2) continue;
      const sliceEnd = i === currentIndex - 1
        ? Math.max(2, Math.floor(coords.length * animProgress))
        : coords.length;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords.slice(0, sliceEnd) },
        properties: { index: i },
      });
    }
    return { type: 'FeatureCollection' as const, features };
  }, [cuberArcFullCoords, currentIndex, animProgress]);

  // ── Map 初始化 ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [30, 20],
      zoom: 1.4,
    });
    mapRef.current = map;

    map.on('style.load', () => {
      try { map.setProjection({ type: 'globe' }); } catch { /* old */ }
      patchMapStyle(map, isZhRef.current);
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');

    map.on('load', () => {
      mapLoadedRef.current = true;

      // upcoming source & layers
      map.addSource('comps', {
        type: 'geojson', data: upcomingGeojson as unknown as GeoJSON.FeatureCollection,
        cluster: true, clusterMaxZoom: 6, clusterRadius: 45,
      });
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'comps', filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#E08B6C', 10, '#C15F3C', 50, '#8B3E1F'],
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 22, 50, 30],
          'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF',
        },
      });
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'comps', filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['Noto Sans Regular'], 'text-size': 13 },
        paint: { 'text-color': '#FFFFFF' },
      });
      map.addLayer({
        id: 'unclustered-point', type: 'circle', source: 'comps', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': '#C15F3C', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF' },
      });

      // cuber source & layers
      map.addSource(CUBER_SOURCE_POINTS, { type: 'geojson', data: cuberPointsGeojson as unknown as GeoJSON.FeatureCollection });
      map.addSource(CUBER_SOURCE_ARCS, { type: 'geojson', data: cuberArcsGeojson as unknown as GeoJSON.FeatureCollection });
      map.addLayer({
        id: CUBER_LAYER_ARC, type: 'line', source: CUBER_SOURCE_ARCS,
        layout: { 'visibility': 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#C15F3C',
          'line-width': 2,
          'line-opacity': 0.75,
        },
      });
      map.addLayer({
        id: CUBER_LAYER_DOT, type: 'circle', source: CUBER_SOURCE_POINTS,
        layout: { 'visibility': 'none' },
        paint: {
          'circle-color': '#C15F3C',
          'circle-radius': 5,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: CUBER_LAYER_LABEL, type: 'symbol', source: CUBER_SOURCE_POINTS,
        layout: {
          'visibility': 'none',
          'text-field': ['to-string', ['+', 1, ['get', 'index']]],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#181716', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
      });

      // upcoming 交互
      map.on('click', 'clusters', async (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number;
        const src = map.getSource('comps') as GeoJSONSource;
        try {
          const zoom = await src.getClusterExpansionZoom(clusterId);
          const geom = features[0].geometry as GeoJSON.Point;
          map.easeTo({ center: geom.coordinates as [number, number], zoom });
        } catch { /* */ }
      });
      map.on('click', 'unclustered-point', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        setSelectedComp(f.properties as WcaUpcomingComp);
      });
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'unclustered-point', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(`<div class="mlp"><div class="mlp-name">${p.name}</div><div class="mlp-meta">${p.city ?? ''}, ${countryName(p.country_iso2, isZhRef.current)} · ${p.start_date}${p.start_date !== p.end_date ? ` — ${p.end_date}` : ''}</div></div>`)
          .addTo(map);
      });
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      });

      // cuber 交互（hover tooltip）
      map.on('mouseenter', CUBER_LAYER_DOT, (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        if (popupRef.current) popupRef.current.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(`<div class="mlp"><div class="mlp-name">#${Number(p.index) + 1} ${p.name}</div><div class="mlp-meta">${p.city ?? ''}, ${countryName(p.country_iso2, isZhRef.current)} · ${p.start_date}</div></div>`)
          .addTo(map);
      });
      map.on('mouseleave', CUBER_LAYER_DOT, () => {
        map.getCanvas().style.cursor = '';
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      });
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 推送 upcoming 数据 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const src = map.getSource('comps') as GeoJSONSource | undefined;
    if (src) src.setData(upcomingGeojson as unknown as GeoJSON.FeatureCollection);
  }, [upcomingGeojson]);

  // ── 推送 cuber 数据 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const ptsSrc = map.getSource(CUBER_SOURCE_POINTS) as GeoJSONSource | undefined;
    const arcSrc = map.getSource(CUBER_SOURCE_ARCS) as GeoJSONSource | undefined;
    if (ptsSrc) ptsSrc.setData(cuberPointsGeojson as unknown as GeoJSON.FeatureCollection);
    if (arcSrc) arcSrc.setData(cuberArcsGeojson as unknown as GeoJSON.FeatureCollection);
  }, [cuberPointsGeojson, cuberArcsGeojson]);

  // ── 语言切换时重新 patch 地图 label ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    patchMapStyle(map, isZh);
  }, [isZh]);

  // ── 图层可见性切换 + 当前高亮 / filter ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    const show = (ids: string[], v: boolean) => {
      for (const id of ids) {
        try { map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none'); } catch { /* layer 还未添加 */ }
      }
    };
    show(UPCOMING_LAYERS, mode === 'upcoming');
    show(CUBER_LAYERS, mode === 'cuber');
  }, [mode]);

  // ── cuber 模式下：dot/label filter（按 index 显示）+ 高亮当前点 + flyTo ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || mode !== 'cuber') return;

    const filter: maplibregl.FilterSpecification = ['<=', ['get', 'index'], currentIndex];
    try { map.setFilter(CUBER_LAYER_DOT, filter); } catch { /* */ }
    try { map.setFilter(CUBER_LAYER_LABEL, filter); } catch { /* */ }

    try {
      map.setPaintProperty(CUBER_LAYER_DOT, 'circle-color',
        ['case', ['==', ['get', 'index'], currentIndex], '#C15F3C', '#8B3E1F'] as unknown as string);
      map.setPaintProperty(CUBER_LAYER_DOT, 'circle-radius',
        ['case', ['==', ['get', 'index'], currentIndex], 10, 5] as unknown as number);
    } catch { /* */ }
  }, [currentIndex, mode]);

  // ── Arc 动画 + flyTo 同步 ──
  // 只在 currentIndex 恰好 +1（即 play loop 推进）时启动动画；scrub / 初始加载直接跳
  useEffect(() => {
    if (mode !== 'cuber') return;
    const prev = prevIndexRef.current;
    const delta = currentIndex - prev;
    const cur = cuberComps[currentIndex];

    if (delta !== 1) {
      setAnimProgress(1);
      prevIndexRef.current = currentIndex;
      if (cur) mapRef.current?.easeTo({
        center: [cur.longitude_degrees, cur.latitude_degrees],
        duration: 400,
      });
      return;
    }

    // 前进一步 → 动画（立即更新 prev，防止 play loop 连发时 delta 漂移）
    prevIndexRef.current = currentIndex;
    setAnimProgress(0);
    const duration = 500 / speed;
    const start = performance.now();
    let rafId = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setAnimProgress(p);
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    if (cur) {
      mapRef.current?.easeTo({
        center: [cur.longitude_degrees, cur.latitude_degrees],
        duration,
      });
    }

    return () => cancelAnimationFrame(rafId);
  }, [currentIndex, mode, cuberComps, speed]);

  // NOTE: cuberComps 变化（新选手加载）时重置 prevIndexRef，避免误触发动画
  useEffect(() => {
    prevIndexRef.current = currentIndex;
    setAnimProgress(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuberComps]);

  // ── Play loop ──
  useEffect(() => {
    if (!playing || mode !== 'cuber' || cuberComps.length === 0) return;
    const step = 500 / speed;
    const id = setInterval(() => {
      setCurrentIndex((i) => {
        if (i >= cuberComps.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, step);
    return () => clearInterval(id);
  }, [playing, speed, mode, cuberComps.length]);

  const resetView = useCallback(() => {
    mapRef.current?.easeTo({ center: [30, 20], zoom: 1.4, duration: 800 });
  }, []);

  const onSelectCuber = useCallback((person: WcaPerson) => {
    setPickerOpen(false);
    setCuber(person);
    loadCuberPath(person);
  }, [loadCuberPath]);

  const clearCuber = useCallback(() => {
    setCuber(null);
    setCuberComps([]);
    setCurrentIndex(0);
    setPlaying(false);
    setLoadProgress(null);
  }, []);

  const currentComp = cuberComps[currentIndex];
  const progressPct = loadProgress ? Math.round(loadProgress.done / loadProgress.total * 100) : 0;
  const flagIso2 = (cuber?.iso2 || '').toLowerCase();
  const isTw = flagIso2 === 'tw';

  return (
    <div className="globe-page">
      <Link to="/upcoming-comps" className="back-link">
        <ArrowLeft size={14} strokeWidth={1.75} /> {t('globe.backToCalendar')}
      </Link>

      <header className="globe-header">
        <h1 className="globe-title">{t('globe.title')}</h1>
        <div className="globe-meta">{t('globe.subtitle')}</div>
      </header>

      <div className="globe-toolbar">
        <div className="mode-toggle" role="tablist">
          <button role="tab" aria-selected={mode === 'upcoming'} className={`range-btn ${mode === 'upcoming' ? 'is-active' : ''}`} onClick={() => setMode('upcoming')}>
            {t('globe.modeUpcoming')}
          </button>
          <button role="tab" aria-selected={mode === 'cuber'} className={`range-btn ${mode === 'cuber' ? 'is-active' : ''}`} onClick={() => setMode('cuber')}>
            {t('globe.modeCuber')}
          </button>
        </div>
        {mode === 'upcoming' && (
          <>
            <div className="range-toggle" role="tablist">
              {(['month', 'quarter', 'year'] as RangeKey[]).map((r) => (
                <button key={r} role="tab" aria-selected={range === r} className={`range-btn ${range === r ? 'is-active' : ''}`} onClick={() => setRange(r)}>
                  {t(`globe.range${r.charAt(0).toUpperCase() + r.slice(1)}`)}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="reset-btn" onClick={resetView} title={isZh ? '复位视角' : 'Reset view'}>
          <RotateCcw size={14} strokeWidth={1.75} />
        </button>
      </div>

      {mode === 'upcoming' && (
        <div className="globe-stats">
          <span>📋 {t('globe.statComps', { count: upcomingStats.comps })}</span>
          <span>🌍 {t('globe.statCountries', { count: upcomingStats.countries })}</span>
        </div>
      )}

      {mode === 'cuber' && (
        <div className="cuber-bar">
          {cuber ? (
            <div className="cuber-chip">
              {isTw
                ? <img src="/tools/assets/images/ChineseTaipei.svg" className="cuber-flag" alt="Chinese Taipei" />
                : flagIso2 && <span className={`fi fi-${flagIso2} cuber-flag`} />}
              <span className="cuber-name">{cuber.name}</span>
              <span className="cuber-id">{cuber.wcaId}</span>
              <button className="cuber-clear" onClick={clearCuber} aria-label="Clear">
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button className="cuber-select-btn" onClick={() => setPickerOpen(true)}>
              <User size={14} strokeWidth={1.75} />
              {t('globe.selectCuber')}
            </button>
          )}
          {cuber && (
            <button className="cuber-change-btn" onClick={() => setPickerOpen(true)}>
              {t('globe.changeCuber')}
            </button>
          )}

          {loadProgress && (
            <div className="cuber-progress">
              <div className="cuber-progress-label">
                {t('globe.loadingPath', { done: loadProgress.done, total: loadProgress.total })}
              </div>
              <div className="cuber-progress-bar">
                <div className="cuber-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {!loadProgress && cuberComps.length > 0 && currentComp && (
            <div className="cuber-timeline">
              <button
                className="cuber-play"
                onClick={() => setPlaying((p) => !p)}
                disabled={cuberComps.length < 2}
                aria-label={playing ? t('globe.pause') : t('globe.play')}
              >
                {playing ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
              </button>
              <input
                type="range"
                className="cuber-scrub"
                min={0}
                max={cuberComps.length - 1}
                value={currentIndex}
                onChange={(e) => {
                  setPlaying(false);
                  setCurrentIndex(Number(e.target.value));
                }}
              />
              <div className="cuber-step-label">
                <div className="cuber-step-count">{t('globe.step', { current: currentIndex + 1, total: cuberComps.length })}</div>
                <div className="cuber-step-name">{currentComp.name}</div>
                <div className="cuber-step-meta">{currentComp.city}, {countryName(currentComp.country_iso2, isZh)} · {currentComp.start_date}</div>
              </div>
              <div className="cuber-speed">
                {([0.5, 1, 2] as Speed[]).map((s) => (
                  <button
                    key={s}
                    className={`speed-btn ${speed === s ? 'is-active' : ''}`}
                    onClick={() => setSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loadProgress && cuber && cuberComps.length === 0 && (
            <div className="cuber-empty">{t('globe.noComps')}</div>
          )}
          {!loadProgress && !cuber && (
            <div className="cuber-empty">{t('globe.noCuberSelected')}</div>
          )}
        </div>
      )}

      {error && <div className="globe-error">{error}</div>}
      {mode === 'upcoming' && !comps && !error && <div className="globe-loading">{t('globe.loading')}</div>}

      <div ref={containerRef} className="map-canvas" />

      {selectedComp && (
        <div className="bin-panel-overlay" onClick={() => setSelectedComp(null)}>
          <div className="bin-panel" onClick={(ev) => ev.stopPropagation()}>
            <button className="bin-panel-close" onClick={() => setSelectedComp(null)} aria-label="Close">×</button>
            <h2 className="bin-panel-title">{selectedComp.name}</h2>
            <div className="bin-panel-list">
              <div className="bin-panel-item">
                <div className="bin-panel-meta">
                  {selectedComp.city}, {countryName(selectedComp.country_iso2, isZh)} · {selectedComp.start_date}
                  {selectedComp.start_date !== selectedComp.end_date ? ` — ${selectedComp.end_date}` : ''}
                </div>
                <a href={selectedComp.url} target="_blank" rel="noopener noreferrer" className="bin-panel-link">
                  WCA {isZh ? '官网' : 'page'} ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <WcaPersonPicker
          mode="modal"
          open={pickerOpen}
          onSelect={onSelectCuber}
          onClose={() => setPickerOpen(false)}
          placeholder={isZh ? '搜索选手或 WCA ID...' : 'Search cuber or WCA ID...'}
        />
      )}

      <LangToggle />
    </div>
  );
}
