/**
 * WCA 比赛地图 — MapLibre GL JS 矢量地球
 * 模式：
 *   - upcoming: 近期全球比赛聚合点
 *   - cuber:    选手生涯足迹（按时间顺序画大圆弧，支持 play/scrub）
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RotateCcw, Play, Pause, X, Moon, Sun, Satellite, Plus, Minus, Navigation } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as OpenCC from 'opencc-js';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import vtpbf from 'vt-pbf';
import {
  fetchAllUpcomingCompsJson,
  fetchAllPastCompsJson,
  fetchCompetitions,
  fetchCompetitionDetail,
  WcaPersonPicker,
  type UpcomingCompRecord,
  type PastCompRecord,
  type WcaCompDetail,
  type WcaPerson,
} from '@cuberoot/shared';
import LangToggle from '../components/LangToggle';
import './globe.css';

type Mode = 'upcoming' | 'history' | 'cuber';
type Speed = 0.5 | 1 | 2;

// WCA 复办年份；slider 从 2003 开始（更紧凑，1982-2003 之间没有比赛）
const HISTORY_MIN_YEAR = 2003;
// WCA 第一场比赛 WC1982（世锦赛）；slider 拉到最左（2003）时自动把 1982 一并纳入
const HISTORY_ABSOLUTE_MIN = 1982;

// NOTE: OpenFreeMap 风格（基于 OpenMapTiles schema，和 MapTiler streets-v2 结构兼容）
// 全球 Cloudflare CDN，中国大陆可直连，无需 API key；如需回退改回 MapTiler，commit 一行即可
type Theme = 'dark' | 'light' | 'satellite';
const mapStyleUrl = (theme: Theme) => {
  if (theme === 'satellite') return null; // 卫星模式走自构造 style，下面单独处理
  return `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'dark' : 'liberty'}`;
};

// 卫星模式：raster 底图（Esri World Imagery，多源聚合，z 0–19）+ OFM 矢量瓦片叠文字标签
function buildSatelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
      },
      labels: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    layers: [
      { id: 'satellite-base', type: 'raster', source: 'satellite' },
      // 国家边界淡白
      {
        id: 'country-boundary', type: 'line', source: 'labels', 'source-layer': 'boundary',
        filter: ['==', ['get', 'admin_level'], 2],
        paint: { 'line-color': 'rgba(255,255,255,0.55)', 'line-width': 0.7 },
      },
      // 国家名
      {
        id: 'place_country', type: 'symbol', source: 'labels', 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'country'], maxzoom: 8,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'], 'text-size': 13,
          'text-transform': 'uppercase', 'text-letter-spacing': 0.08,
        },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(0,0,0,0.65)', 'text-halo-width': 1.2 },
      },
      // 省/州
      {
        id: 'place_state', type: 'symbol', source: 'labels', 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'state'], minzoom: 4, maxzoom: 6,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'], 'text-size': 11,
        },
        paint: { 'text-color': 'rgba(255,255,255,0.85)', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1 },
      },
      // 城市
      {
        id: 'place_city', type: 'symbol', source: 'labels', 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'city'], minzoom: 6,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'], 'text-size': 12,
        },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.2 },
      },
    ],
  } as unknown as maplibregl.StyleSpecification;
}

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

const CUBER_SOURCE_POINTS = 'cuber-points';
const CUBER_SOURCE_ARCS = 'cuber-arcs';
const CUBER_LAYER_DOT = 'cuber-points-dot';
const CUBER_LAYER_LABEL = 'cuber-points-label';
const CUBER_LAYER_ARC = 'cuber-arcs-line';

const UPCOMING_LAYERS = ['clusters', 'cluster-count', 'unclustered-point', 'unclustered-count'];
const PAST_LAYERS = ['past-clusters', 'past-cluster-count', 'past-unclustered-point'];
const CUBER_LAYERS = [CUBER_LAYER_ARC, CUBER_LAYER_DOT, CUBER_LAYER_LABEL];

// 格式化经纬度为度分秒（Google Earth 风格：67°16'15.24"S 56°36'35.21"W）
function formatDMS(lat: number, lng: number): string {
  const part = (deg: number, posChar: string, negChar: string) => {
    const sign = deg >= 0 ? posChar : negChar;
    const a = Math.abs(deg);
    const d = Math.floor(a);
    const mFloat = (a - d) * 60;
    const m = Math.floor(mFloat);
    const s = ((mFloat - m) * 60).toFixed(2);
    return `${d}°${String(m).padStart(2, '0')}'${s.padStart(5, '0')}"${sign}`;
  };
  return `${part(lat, 'N', 'S')} ${part(lng, 'E', 'W')}`;
}


// ─── 瓦片级 繁→简 转换（MapTiler 的 name:zh 对 TW/HK/JP 常是繁体；要稳定出简体必须在 MVT 层面换）
// 注册自定义协议 zh-tile://，从 https 拉回瓦片，解码 MVT，把所有 name* 字段的繁体转简体，再编码回去
const openccT2S = OpenCC.Converter({ from: 'tw', to: 'cn' });
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const ZH_PROTOCOL = 'zh-tile';

type MvtFeatureLike = {
  type: number;
  extent: number;
  id: number | string | undefined;
  properties: Record<string, unknown>;
  loadGeometry: () => unknown;
};
type MvtLayerLike = {
  version: number;
  name: string;
  extent: number;
  length: number;
  feature: (i: number) => MvtFeatureLike;
};

function transformNameProps(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (
      typeof v === 'string'
      && (k === 'name' || k.startsWith('name:') || k.startsWith('name_'))
      && CJK_RE.test(v)
    ) {
      try { out[k] = openccT2S(v); } catch { out[k] = v; }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function wrapMvtLayer(layer: unknown): MvtLayerLike {
  const l = layer as {
    version: number; name: string; extent: number; length: number;
    feature: (i: number) => {
      type: number; extent?: number; id?: number | string;
      properties: Record<string, unknown>; loadGeometry: () => unknown;
    };
  };
  return {
    version: l.version,
    name: l.name,
    extent: l.extent,
    length: l.length,
    feature(i: number) {
      const f = l.feature(i);
      return {
        type: f.type,
        extent: l.extent,
        id: f.id,
        properties: transformNameProps(f.properties),
        loadGeometry: () => f.loadGeometry(),
      };
    },
  };
}

let zhProtocolRegistered = false;
function ensureZhTileProtocol() {
  if (zhProtocolRegistered) return;
  zhProtocolRegistered = true;
  maplibregl.addProtocol(ZH_PROTOCOL, async (params, abortController) => {
    const realUrl = params.url.replace(/^zh-tile:\/\//, 'https://');
    const resp = await fetch(realUrl, { signal: abortController.signal });
    if (!resp.ok) throw new Error(`zh-tile fetch ${resp.status}`);
    const buf = await resp.arrayBuffer();
    try {
      const tile = new VectorTile(new Protobuf(buf));
      const wrappedLayers: Record<string, MvtLayerLike> = {};
      for (const name of Object.keys(tile.layers)) {
        wrappedLayers[name] = wrapMvtLayer((tile.layers as Record<string, unknown>)[name]);
      }
      const outBuf = vtpbf({ layers: wrappedLayers } as unknown as Parameters<typeof vtpbf>[0]);
      return { data: outBuf };
    } catch {
      // 转换失败退回原瓦片
      return { data: buf };
    }
  });
}

// 把 MapTiler style.json 的 vector 源改成走 zh-tile:// 协议
async function buildSimplifiedStyle(styleUrl: string, theme: Theme): Promise<maplibregl.StyleSpecification> {
  const style = await fetch(styleUrl).then(r => r.json()) as maplibregl.StyleSpecification;
  const sources = style.sources as Record<string, Record<string, unknown>>;
  await Promise.all(Object.keys(sources).map(async (id) => {
    const src = sources[id];
    if (src.type !== 'vector') return;
    const refUrl = typeof src.url === 'string' ? src.url : null;
    if (refUrl) {
      try {
        const tj = await fetch(refUrl).then(r => r.json()) as {
          tiles?: string[]; minzoom?: number; maxzoom?: number; bounds?: number[]; attribution?: string;
        };
        if (Array.isArray(tj.tiles)) {
          sources[id] = {
            type: 'vector',
            tiles: tj.tiles.map(u => u.replace(/^https:\/\//, `${ZH_PROTOCOL}://`)),
            minzoom: tj.minzoom ?? 0,
            maxzoom: tj.maxzoom ?? 14,
            attribution: tj.attribution ?? src.attribution,
            bounds: tj.bounds,
          };
        }
      } catch { /* 保留原 url */ }
    } else if (Array.isArray(src.tiles)) {
      src.tiles = (src.tiles as string[]).map(u => u.replace(/^https:\/\//, `${ZH_PROTOCOL}://`));
    }
  }));

  // OFM dark 默认让 state、city、town 都从 zoom 0 起渲染，会同框堆叠
  // 一画面只允许 country / state / city 之一占主：
  //   country → 0–6（保留 OFM 默认）
  //   state   → 4–6 互斥城市
  //   city    → 6+
  //   town    → 8+
  //   village → 10+
  type StyleLayer = { id: string; type?: string; minzoom?: number; maxzoom?: number; paint?: Record<string, unknown> };
  const layers = (style.layers ?? []) as StyleLayer[];
  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    const isStateLabel = /(^|[-_])state([-_]|$)|province|admin1|region/.test(id);
    const isCityLabel = /(^|[-_])city([-_]|$)/.test(id);
    const isTownLabel = /(^|[-_])town([-_]|$)/.test(id);
    const isVillageLabel = /(^|[-_])village([-_]|$)/.test(id);
    if (isStateLabel) {
      layer.minzoom = 4;
      layer.maxzoom = 6;
    } else if (isCityLabel) {
      layer.minzoom = 6;
    } else if (isTownLabel) {
      layer.minzoom = 8;
    } else if (isVillageLabel) {
      layer.minzoom = 10;
    }
  }

  // 两种主题都把 background 层透明（只影响球外区域，露出星空）；
  // 陆地不透明化由后续注入的 earth-base 多边形负责
  for (const layer of layers) {
    if (layer.type === 'background') {
      layer.paint = { ...(layer.paint ?? {}), 'background-color': 'rgba(0,0,0,0)' };
    } else if (theme === 'dark' && layer.id === 'water' && layer.type === 'fill') {
      layer.paint = { ...(layer.paint ?? {}), 'fill-color': '#0E1620' };
    }
  }

  return style;
}

const TW_CUSTOM_LABEL = 'tw-custom-label';
const TW_CUSTOM_SOURCE = 'tw-custom';

// 自写大圆弧：3D slerp + 自适应二分，相邻样本 (unwrapped lng, lat) 欧氏距离 ≤ 1°
// 原因：MapLibre globe 在两个相邻顶点之间做 mercator 线性插值再投回球面。若两端同 lat
// 但 lng 差很大（跨极弧顶典型情况），渲染出来就是一条极区圆弧——这就是"半月"伪影。
// 通过在弧顶附近密集二分，相邻对 lng 差被压到 ≤1° → 极区弧半径 < 2km 肉眼不可见。
// （诊断数据：VA→Kunming maxLat=89.66，idx 56→57 lng 跳 163°→正是被二分消除的那种对。）
function greatCircleCoords(
  lng1: number, lat1: number, lng2: number, lat2: number,
): [number, number][] {
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const BASE_N = 16;
  const MAX_DEPTH = 12;
  const THRESHOLD = 1.0; // 度

  const toVec = (lng: number, lat: number): [number, number, number] => {
    const la = lat * DEG, lo = lng * DEG;
    const cl = Math.cos(la);
    return [cl * Math.cos(lo), cl * Math.sin(lo), Math.sin(la)];
  };
  const v1 = toVec(lng1, lat1);
  const v2 = toVec(lng2, lat2);
  const dot = Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const ang = Math.acos(dot);
  if (ang < 1e-9) return [[lng1, lat1], [lng2, lat2]];
  if (ang > Math.PI - 1e-6) return [[lng1, lat1], [lng2, lat2]];
  const sinA = Math.sin(ang);

  // slerp：归一化 + asin 防 ang≈π 时的浮点漂移
  const slerp = (f: number): [number, number] => {
    const A = Math.sin((1 - f) * ang) / sinA;
    const B = Math.sin(f * ang) / sinA;
    let x = A * v1[0] + B * v2[0];
    let y = A * v1[1] + B * v2[1];
    let z = A * v1[2] + B * v2[2];
    const mag = Math.sqrt(x * x + y * y + z * z);
    if (mag > 0) { x /= mag; y /= mag; z /= mag; }
    const lat = Math.asin(Math.max(-1, Math.min(1, z))) * RAD;
    const lng = Math.atan2(y, x) * RAD;
    return [lng, lat];
  };
  const unwrap = (anchor: number, lng: number): number => {
    let d = lng - anchor;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return anchor + d;
  };

  // 16 个基础采样（确保弧顶附近至少有一个采样，后续二分从那里展开）
  type Sample = { f: number; p: [number, number] };
  const base: Sample[] = [];
  for (let i = 0; i <= BASE_N; i++) {
    const f = i / BASE_N;
    const raw = slerp(f);
    if (i === 0) base.push({ f, p: [raw[0], raw[1]] });
    else {
      const prev = base[i - 1].p;
      base.push({ f, p: [unwrap(prev[0], raw[0]), raw[1]] });
    }
  }

  // 自适应二分，按 (unwrapped_lng, lat) 欧氏距离阈值插中点
  const coords: [number, number][] = [base[0].p];
  const bisect = (fA: number, fB: number, pA: [number, number], pB: [number, number], depth: number) => {
    const dLng = pB[0] - pA[0], dLat = pB[1] - pA[1];
    if (dLng * dLng + dLat * dLat <= THRESHOLD * THRESHOLD) return;
    if (depth >= MAX_DEPTH) return;
    const fM = (fA + fB) * 0.5;
    const raw = slerp(fM);
    const pM: [number, number] = [unwrap(pA[0], raw[0]), raw[1]];
    bisect(fA, fM, pA, pM, depth + 1);
    coords.push(pM);
    bisect(fM, fB, pM, pB, depth + 1);
  };
  for (let i = 0; i < base.length - 1; i++) {
    bisect(base[i].f, base[i + 1].f, base[i].p, base[i + 1].p, 0);
    coords.push(base[i + 1].p);
  }
  return coords;
}

// NOTE: MapTiler 通用语言切换 + Taiwan/HK override
// - Taiwan 从 country layer 抹掉，用独立小字号 symbol 层（匹配省级样式）渲染"台湾省"/"Chinese Taipei"
// - Hong Kong 从 country layer 抹掉，让城市层的 HK label（zoom 更高时）自然出现
function patchMapTilerLang(map: maplibregl.Map, isZh: boolean) {
  const twnLabel = isZh ? '台湾省' : 'Chinese Taipei';
  const rawBase: unknown[] = isZh
    ? ['coalesce', ['get', 'name:zh-Hans'], ['get', 'name:zh'], ['get', 'name:latin'], ['get', 'name']]
    : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];

  // 中文下国家名短称（OSM name:zh 常给全称，手动缩短）
  const countryCode: unknown[] = ['coalesce',
    ['get', 'iso_a2'], ['get', 'iso_3166_1'], ['get', 'iso_3166_1_alpha_2'],
    ['get', 'adm0_a3'], ['get', 'ADM0_A3'],
  ];
  const baseExpr: unknown[] = isZh
    ? ['match', countryCode,
        ['KP', 'PRK'], '朝鲜',
        ['KR', 'KOR'], '韩国',
        ['MN', 'MNG'], '蒙古',
        rawBase,
      ]
    : rawBase;

  const isTwn: unknown[] = ['any',
    ['==', ['get', 'iso_a2'], 'TW'],
    ['==', ['get', 'iso_3166_1'], 'TW'],
    ['==', ['get', 'iso_3166_1_alpha_2'], 'TW'],
    ['==', ['get', 'adm0_a3'], 'TWN'],
    ['==', ['get', 'ADM0_A3'], 'TWN'],
  ];
  const isHK: unknown[] = ['any',
    ['==', ['get', 'iso_a2'], 'HK'],
    ['==', ['get', 'iso_3166_1'], 'HK'],
    ['==', ['get', 'iso_3166_1_alpha_2'], 'HK'],
    ['==', ['get', 'adm0_a3'], 'HKG'],
    ['==', ['get', 'ADM0_A3'], 'HKG'],
    ['==', ['get', 'name:en'], 'Hong Kong'],
    ['==', ['get', 'name_en'], 'Hong Kong'],
  ];
  const isMacau: unknown[] = ['any',
    ['==', ['get', 'iso_a2'], 'MO'],
    ['==', ['get', 'iso_3166_1'], 'MO'],
    ['==', ['get', 'iso_3166_1_alpha_2'], 'MO'],
    ['==', ['get', 'adm0_a3'], 'MAC'],
    ['==', ['get', 'ADM0_A3'], 'MAC'],
    ['==', ['get', 'name:en'], 'Macau'],
    ['==', ['get', 'name:en'], 'Macao'],
    ['==', ['get', 'name_en'], 'Macau'],
    ['==', ['get', 'name_en'], 'Macao'],
  ];
  const countryField: unknown[] = ['case', isHK, '', isMacau, '', isTwn, '', baseExpr];

  const ownLayers = new Set<string>([...UPCOMING_LAYERS, ...CUBER_LAYERS, TW_CUSTOM_LABEL]);
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    if (ownLayers.has(layer.id)) continue; // 不要覆盖自己的图层
    const id = layer.id.toLowerCase();
    const isCountryLayer = id.includes('country') || id.includes('place-country') || id.includes('place_country');
    try {
      map.setLayoutProperty(layer.id, 'text-field', (isCountryLayer ? countryField : baseExpr) as unknown as string);
    } catch { /* */ }
  }

  // 自定义 Taiwan 省级标签
  if (map.getLayer(TW_CUSTOM_LABEL)) {
    try {
      map.setLayoutProperty(TW_CUSTOM_LABEL, 'text-field', twnLabel);
      map.setLayoutProperty(TW_CUSTOM_LABEL, 'text-transform', isZh ? 'none' : 'uppercase');
    } catch { /* */ }
  }
}

function patchMapStyle(map: maplibregl.Map, isZh: boolean) {
  patchMapTilerLang(map, isZh);
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const starfieldRef = useRef<HTMLDivElement>(null);
  const isZhRef = useRef(isZh);
  useEffect(() => { isZhRef.current = isZh; }, [isZh]);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (window.localStorage.getItem('globeTheme') as Theme) ?? 'dark';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('globeTheme', theme);
  }, [theme]);
  // 切主题时，下次 map 重建从这里恢复相机，不让视角跳回默认
  const cameraRef = useRef<{ center: [number, number]; zoom: number; bearing: number; pitch: number } | null>(null);

  // ── 公共 state ──
  const [mode, setMode] = useState<Mode>('upcoming');
  const [error, setError] = useState<string | null>(null);

  // ── upcoming 模式 state ──
  const [comps, setComps] = useState<UpcomingCompRecord[] | null>(null);
const [selectedComps, setSelectedComps] = useState<UpcomingCompRecord[] | null>(null);

  // ── history 模式 state ──
  const currentYear = new Date().getFullYear();
  const [pastComps, setPastComps] = useState<PastCompRecord[] | null>(null);
  const [pastLoading, setPastLoading] = useState(false);
  const [yearRange, setYearRange] = useState<[number, number]>([HISTORY_MIN_YEAR, currentYear]);

  // ── cuber 模式 state ──
  const [cuber, setCuber] = useState<WcaPerson | null>(null);
  const [cuberComps, setCuberComps] = useState<WcaCompDetail[]>([]);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── 自定义控件 state ──
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  // ── 拉 upcoming 数据（读预生成 JSON） ──
  useEffect(() => {
    fetchAllUpcomingCompsJson()
      .then((list) => setComps(list.filter((c) => c.latitude_degrees != null && c.longitude_degrees != null)))
      .catch(() => setError(t('globe.loadFailed')));
  }, [t]);

  // ── 拉 history 数据（懒加载，切到 history 模式才开始拉） ──
  useEffect(() => {
    if (mode !== 'history' || pastComps !== null || pastLoading) return;
    setPastLoading(true);
    fetchAllPastCompsJson()
      .then((list) => setPastComps(list))
      .catch(() => setError(t('globe.loadFailed')))
      .finally(() => setPastLoading(false));
  }, [mode, pastComps, pastLoading, t]);

  const filteredComps = useMemo(() => comps ?? [], [comps]);

  const upcomingStats = useMemo(() => {
    const countries = new Set(filteredComps.map((c) => c.country));
    return { comps: filteredComps.length, countries: countries.size };
  }, [filteredComps]);

  // 同坐标比赛预合并为 1 个 feature：避免 zoom 超过 clusterMaxZoom 后两场完全重叠
  // 只点到一场。stack_count>1 时 feature 属性里塞 stack_comps（JSON 字符串）供 click 展开。
  const upcomingGeojson = useMemo(() => {
    const groups = new Map<string, UpcomingCompRecord[]>();
    for (const c of filteredComps) {
      const key = `${c.longitude_degrees.toFixed(6)},${c.latitude_degrees.toFixed(6)}`;
      const g = groups.get(key);
      if (g) g.push(c); else groups.set(key, [c]);
    }
    const features = Array.from(groups.values()).map((group) => {
      const head = group[0];
      const props: Record<string, unknown> = {
        id: head.id, name: head.name, city: head.city,
        country: head.country,
        start_date: head.start_date, end_date: head.end_date, url: head.url,
        stack_count: group.length,
      };
      if (group.length > 1) props.stack_comps = JSON.stringify(group);
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [head.longitude_degrees, head.latitude_degrees] },
        properties: props,
      };
    });
    return { type: 'FeatureCollection' as const, features };
  }, [filteredComps]);

  // ── history 模式过滤 + 聚合 GeoJSON ──
  const filteredPast = useMemo(() => {
    if (!pastComps) return [];
    const [y0, y1] = yearRange;
    const effectiveMin = y0 === HISTORY_MIN_YEAR ? HISTORY_ABSOLUTE_MIN : y0;
    return pastComps.filter((c) => {
      const y = Number(c.start_date.slice(0, 4));
      return y >= effectiveMin && y <= y1;
    });
  }, [pastComps, yearRange]);

  const pastStats = useMemo(() => {
    const countries = new Set(filteredPast.map((c) => c.country));
    return { comps: filteredPast.length, countries: countries.size };
  }, [filteredPast]);

  const pastGeojson = useMemo(() => {
    const features = filteredPast.map((c) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.longitude_degrees, c.latitude_degrees] },
      properties: {
        id: c.id,
        name: c.name,
        city: c.city,
        country: c.country,
        start_date: c.start_date,
        end_date: c.end_date,
      },
    }));
    return { type: 'FeatureCollection' as const, features };
  }, [filteredPast]);

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
      out.push(greatCircleCoords(
        a.longitude_degrees, a.latitude_degrees,
        b.longitude_degrees, b.latitude_degrees,
      ));
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

  // ── Map 初始化（theme 变化时重建，相机从 cameraRef 恢复）──
  useEffect(() => {
    if (!containerRef.current) return;
    ensureZhTileProtocol();

    const styleUrl = mapStyleUrl(theme);
    let cancelled = false;
    let map: maplibregl.Map | null = null;
    (async () => {
      const style: maplibregl.StyleSpecification = theme === 'satellite'
        ? buildSatelliteStyle()
        : await buildSimplifiedStyle(styleUrl as string, theme).catch(() => styleUrl as unknown as maplibregl.StyleSpecification);
      if (cancelled || !containerRef.current) return;
      const cam = cameraRef.current;
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: cam?.center ?? [30, 20],
        zoom: cam?.zoom ?? 1.4,
        bearing: cam?.bearing ?? 0,
        pitch: cam?.pitch ?? 0,
        attributionControl: false,
      });
      mapRef.current = map;
      wireMap(map);
    })();

    function wireMap(map: maplibregl.Map) {
    map.on('style.load', () => {
      try { map.setProjection({ type: 'globe' }); } catch { /* old */ }
      patchMapStyle(map, isZhRef.current);
    });
    // 自定义控件接管，禁用默认 NavigationControl
    // 鼠标在球外（黑色太空区）时，project(unproject(p)) 与 p 不匹配 → 视为离开球面
    map.on('mousemove', (e) => {
      const reproj = map.project(e.lngLat);
      const dx = reproj.x - e.point.x;
      const dy = reproj.y - e.point.y;
      if (dx * dx + dy * dy > 4) setCursorPos(null);
      else setCursorPos({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    map.on('mouseout', () => setCursorPos(null));
    map.on('rotate', () => setBearing(map.getBearing()));
    map.on('pitch', () => setPitch(map.getPitch()));

    map.on('load', () => {
      mapLoadedRef.current = true;
      setMapLoaded(true);

      // 注入一张全球覆盖的 earth-base 多边形作为不透明陆地基底（仅 vector 主题）
      // 球外（背景已透明）→ 露出 CSS 星空；球面 → 这层兜底，水/陆细节叠加在它之上
      // satellite 模式跳过：raster 影像本身就是不透明全覆盖
      if (theme !== 'satellite') {
        map.addSource('earth-base', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85],
              ]],
            },
            properties: {},
          } as unknown as GeoJSON.Feature,
        });
        const styleLayers = map.getStyle().layers ?? [];
        const firstNonBgId = styleLayers.find(l => l.type !== 'background')?.id;
        map.addLayer({
          id: 'earth-base',
          type: 'fill',
          source: 'earth-base',
          paint: { 'fill-color': theme === 'dark' ? '#181D26' : '#F5F2E8', 'fill-antialias': false },
        }, firstNonBgId);
      }

      // upcoming source & layers
      // clusterProperties.stack_total 累加 feature 的 stack_count（同坐标预合并后的真实比赛数），
      // 保证低 zoom 聚合时显示真实场数而不是 feature 数。
      map.addSource('comps', {
        type: 'geojson', data: upcomingGeojson as unknown as GeoJSON.FeatureCollection,
        cluster: true, clusterMaxZoom: 6, clusterRadius: 45,
        clusterProperties: {
          stack_total: ['+', ['get', 'stack_count']],
        },
      });
      map.addLayer({
        id: 'clusters', type: 'circle', source: 'comps', filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'stack_total'], '#E08B6C', 10, '#C15F3C', 50, '#8B3E1F'],
          'circle-radius': ['step', ['get', 'stack_total'], 15, 10, 22, 50, 30],
          'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF',
        },
      });
      map.addLayer({
        id: 'cluster-count', type: 'symbol', source: 'comps', filter: ['has', 'point_count'],
        layout: { 'text-field': ['to-string', ['get', 'stack_total']], 'text-font': ['Noto Sans Regular'], 'text-size': 13 },
        paint: { 'text-color': '#FFFFFF' },
      });
      map.addLayer({
        id: 'unclustered-point', type: 'circle', source: 'comps', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#C15F3C',
          'circle-radius': ['case', ['>', ['get', 'stack_count'], 1], 12, 7],
          'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF',
        },
      });
      // stacked 单点：显示场数
      map.addLayer({
        id: 'unclustered-count', type: 'symbol', source: 'comps',
        filter: ['all', ['!', ['has', 'point_count']], ['>', ['get', 'stack_count'], 1]],
        layout: { 'text-field': ['to-string', ['get', 'stack_count']], 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
        paint: { 'text-color': '#FFFFFF' },
      });

      // past source & layers（history 模式）
      // NOTE: 14k 点依赖 MapLibre cluster 性能；clusterMaxZoom/Radius 和 upcoming 保持一致
      map.addSource('past-comps', {
        type: 'geojson', data: pastGeojson as unknown as GeoJSON.FeatureCollection,
        cluster: true, clusterMaxZoom: 6, clusterRadius: 45,
      });
      map.addLayer({
        id: 'past-clusters', type: 'circle', source: 'past-comps', filter: ['has', 'point_count'],
        layout: { 'visibility': 'none' },
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#7FA5D9', 50, '#4F7FBF', 500, '#2A5599'],
          'circle-radius': ['step', ['get', 'point_count'], 15, 50, 22, 500, 30],
          'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF',
        },
      });
      map.addLayer({
        id: 'past-cluster-count', type: 'symbol', source: 'past-comps', filter: ['has', 'point_count'],
        layout: { 'visibility': 'none', 'text-field': ['to-string', ['get', 'point_count']], 'text-font': ['Noto Sans Regular'], 'text-size': 13 },
        paint: { 'text-color': '#FFFFFF' },
      });
      map.addLayer({
        id: 'past-unclustered-point', type: 'circle', source: 'past-comps', filter: ['!', ['has', 'point_count']],
        layout: { 'visibility': 'none' },
        paint: {
          'circle-color': '#4F7FBF',
          'circle-radius': 6,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF',
        },
      });

      // 自定义 Taiwan "省级" label（替代被抹掉的 country label）
      map.addSource(TW_CUSTOM_SOURCE, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [120.96, 23.69] },
            properties: {},
          }],
        } as unknown as GeoJSON.FeatureCollection,
      });
      map.addLayer({
        id: TW_CUSTOM_LABEL, type: 'symbol', source: TW_CUSTOM_SOURCE,
        minzoom: 3,
        layout: {
          'text-field': isZhRef.current ? '台湾省' : 'Chinese Taipei',
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 5, 12, 7, 14, 10, 16, 14, 19],
          'text-transform': isZhRef.current ? 'none' : 'uppercase',
          'text-letter-spacing': 0.06,
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#888884',
        },
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
        const p = f.properties as Record<string, unknown>;
        if (typeof p.stack_comps === 'string') {
          try {
            setSelectedComps(JSON.parse(p.stack_comps) as UpcomingCompRecord[]);
            return;
          } catch { /* fall through to single */ }
        }
        // 单场比赛 → 直接新标签页打开 WCA page
        const url = typeof p.url === 'string' ? p.url : '';
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'unclustered-point', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        if (popupRef.current) popupRef.current.remove();
        const stackCount = typeof p.stack_count === 'number' ? p.stack_count : 1;
        const zh = isZhRef.current;
        const city = String(p.city ?? '');
        const country = countryName(String(p.country ?? ''), zh);
        const html = stackCount > 1
          ? `<div class="mlp"><div class="mlp-name">${zh ? `${stackCount} 场比赛` : `${stackCount} competitions`}</div><div class="mlp-meta">${city}, ${country}</div></div>`
          : `<div class="mlp"><div class="mlp-name">${p.name}</div><div class="mlp-meta">${city}, ${country} · ${p.start_date}${p.start_date !== p.end_date ? ` — ${p.end_date}` : ''}</div></div>`;
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);
      });
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      });

      // history 交互（cluster 点进放大；单点 hover + click 详情）
      map.on('click', 'past-clusters', async (e: MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['past-clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id as number;
        const src = map.getSource('past-comps') as GeoJSONSource;
        try {
          const zoom = await src.getClusterExpansionZoom(clusterId);
          const geom = features[0].geometry as GeoJSON.Point;
          map.easeTo({ center: geom.coordinates as [number, number], zoom });
        } catch { /* */ }
      });
      map.on('click', 'past-unclustered-point', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const url = `https://www.worldcubeassociation.org/competitions/${String(p.id ?? '')}`;
        if (p.id) window.open(url, '_blank', 'noopener,noreferrer');
      });
      map.on('mouseenter', 'past-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'past-clusters', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'past-unclustered-point', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        if (popupRef.current) popupRef.current.remove();
        const zh = isZhRef.current;
        const city = String(p.city ?? '');
        const country = countryName(String(p.country ?? ''), zh);
        const dateStr = p.start_date === p.end_date ? String(p.start_date) : `${p.start_date} — ${p.end_date}`;
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(`<div class="mlp"><div class="mlp-name">${p.name}</div><div class="mlp-meta">${city}, ${country} · ${dateStr}</div></div>`)
          .addTo(map);
      });
      map.on('mouseleave', 'past-unclustered-point', () => {
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
    }

    return () => {
      cancelled = true;
      // 保留相机姿态供下一次重建恢复
      const live = mapRef.current;
      if (live) {
        const c = live.getCenter();
        cameraRef.current = {
          center: [c.lng, c.lat],
          zoom: live.getZoom(),
          bearing: live.getBearing(),
          pitch: live.getPitch(),
        };
      }
      if (popupRef.current) popupRef.current.remove();
      if (map) map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      setMapLoaded(false);
    };
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 推送 upcoming 数据 ──
  // NOTE: mapLoaded 在 deps 里：若数据先于 map load 抵达，也会在 load 完后再推一次
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('comps') as GeoJSONSource | undefined;
    if (src) src.setData(upcomingGeojson as unknown as GeoJSON.FeatureCollection);
  }, [upcomingGeojson, mapLoaded]);

  // ── 推送 past 数据 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('past-comps') as GeoJSONSource | undefined;
    if (src) src.setData(pastGeojson as unknown as GeoJSON.FeatureCollection);
  }, [pastGeojson, mapLoaded]);

  // ── 推送 cuber 数据 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const ptsSrc = map.getSource(CUBER_SOURCE_POINTS) as GeoJSONSource | undefined;
    const arcSrc = map.getSource(CUBER_SOURCE_ARCS) as GeoJSONSource | undefined;
    if (ptsSrc) ptsSrc.setData(cuberPointsGeojson as unknown as GeoJSON.FeatureCollection);
    if (arcSrc) arcSrc.setData(cuberArcsGeojson as unknown as GeoJSON.FeatureCollection);
  }, [cuberPointsGeojson, cuberArcsGeojson, mapLoaded]);

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
    show(PAST_LAYERS, mode === 'history');
    show(CUBER_LAYERS, mode === 'cuber');
  }, [mode]);

  // ── cuber 模式下：dot/label filter（按 index 显示）+ 高亮当前点 + flyTo ──
  // NOTE: 动画中（arc 未到达终点）时，终点 B 还未显示，等弧线到达时才出现
  const animating = animProgress < 1;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current || mode !== 'cuber') return;

    const visibleMax = animating ? currentIndex - 1 : currentIndex;
    const filter: maplibregl.FilterSpecification = ['<=', ['get', 'index'], visibleMax];
    try { map.setFilter(CUBER_LAYER_DOT, filter); } catch { /* */ }
    try { map.setFilter(CUBER_LAYER_LABEL, filter); } catch { /* */ }

    try {
      map.setPaintProperty(CUBER_LAYER_DOT, 'circle-color',
        ['case', ['==', ['get', 'index'], visibleMax], '#C15F3C', '#8B3E1F'] as unknown as string);
      map.setPaintProperty(CUBER_LAYER_DOT, 'circle-radius',
        ['case', ['==', ['get', 'index'], visibleMax], 10, 5] as unknown as number);
    } catch { /* */ }
  }, [currentIndex, mode, animating]);

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

  // 拖动地球时星空跟着滚动：等距柱面贴图按经/纬度反向偏移 background-position
  // 视口宽 -> 经度 360° 完整跨度，所以 1° = vw/360 px
  useEffect(() => {
    const map = mapRef.current;
    const el = starfieldRef.current;
    if (!map || !el) return;
    const apply = () => {
      const c = map.getCenter();
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      const px = (-c.lng / 360) * w;
      const py = (c.lat / 180) * h;
      el.style.backgroundPosition = `${px.toFixed(1)}px ${py.toFixed(1)}px`;
    };
    apply();
    map.on('move', apply);
    return () => { map.off('move', apply); };
  }, [theme, mapLoaded]);

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
    <div className={`globe-page is-${theme}`}>
      <div className="starfield" aria-hidden="true" ref={starfieldRef} />

      <div className="globe-topbar">
        <Link to="/upcoming-comps" className="back-link" title={t('globe.backToCalendar') as string}>
          <ArrowLeft size={14} strokeWidth={1.75} />
        </Link>
        <h1 className="globe-title-compact">{t('globe.title')}</h1>

        <div className="globe-topbar-spacer" />

        <div className="mode-toggle" role="tablist">
          <button role="tab" aria-selected={mode === 'upcoming'} className={`range-btn ${mode === 'upcoming' ? 'is-active' : ''}`} onClick={() => setMode('upcoming')}>
            {t('globe.modeUpcoming')}
          </button>
          <button role="tab" aria-selected={mode === 'history'} className={`range-btn ${mode === 'history' ? 'is-active' : ''}`} onClick={() => setMode('history')}>
            {t('globe.modeHistory')}
          </button>
          <button role="tab" aria-selected={mode === 'cuber'} className={`range-btn ${mode === 'cuber' ? 'is-active' : ''}`} onClick={() => { setMode('cuber'); if (!cuber) setPickerOpen(true); }}>
            {t('globe.modeCuber')}
          </button>
        </div>
        {mode === 'history' && (
          <div className="history-range">
            <span className="history-range-label">{yearRange[0] === HISTORY_MIN_YEAR ? HISTORY_ABSOLUTE_MIN : yearRange[0]} — {yearRange[1]}</span>
            <div className="history-range-track">
              <div
                className="history-range-fill"
                style={{
                  left: `${((yearRange[0] - HISTORY_MIN_YEAR) / (currentYear - HISTORY_MIN_YEAR)) * 100}%`,
                  right: `${100 - ((yearRange[1] - HISTORY_MIN_YEAR) / (currentYear - HISTORY_MIN_YEAR)) * 100}%`,
                }}
              />
              <input
                type="range"
                className="history-range-slider"
                min={HISTORY_MIN_YEAR}
                max={currentYear}
                value={yearRange[0]}
                onChange={(e) => {
                  const v = Math.min(Number(e.target.value), yearRange[1]);
                  setYearRange([v, yearRange[1]]);
                }}
                aria-label="Year from"
              />
              <input
                type="range"
                className="history-range-slider"
                min={HISTORY_MIN_YEAR}
                max={currentYear}
                value={yearRange[1]}
                onChange={(e) => {
                  const v = Math.max(Number(e.target.value), yearRange[0]);
                  setYearRange([yearRange[0], v]);
                }}
                aria-label="Year to"
              />
            </div>
          </div>
        )}
        {mode === 'upcoming' && (
          <div className="globe-stats globe-stats-inline">
            <span>{upcomingStats.comps} {isZh ? '比赛' : 'comps'}</span>
            <span>·</span>
            <span>{upcomingStats.countries} {isZh ? '国家' : 'countries'}</span>
          </div>
        )}
        {mode === 'history' && (
          <div className="globe-stats globe-stats-inline">
            {pastLoading && !pastComps
              ? <span>{t('globe.loading')}</span>
              : <>
                  <span>{pastStats.comps} {isZh ? '比赛' : 'comps'}</span>
                  <span>·</span>
                  <span>{pastStats.countries} {isZh ? '国家' : 'countries'}</span>
                </>
            }
          </div>
        )}

        <LangToggle className="topbar-lang" />
        <button className="reset-btn" onClick={resetView} title={isZh ? '复位视角' : 'Reset view'}>
          <RotateCcw size={14} strokeWidth={1.75} />
        </button>
      </div>

      <button
        className="theme-toggle-floating"
        onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'satellite' : 'dark')}
        title={
          theme === 'dark' ? (isZh ? '切到浅色' : 'Switch to light')
          : theme === 'light' ? (isZh ? '切到卫星' : 'Switch to satellite')
          : (isZh ? '切到深色' : 'Switch to dark')
        }
        aria-label="Toggle theme"
      >
        {theme === 'dark'
          ? <Sun size={16} strokeWidth={1.75} />
          : theme === 'light'
            ? <Satellite size={16} strokeWidth={1.75} />
            : <Moon size={16} strokeWidth={1.75} />}
      </button>

      <div className="map-controls">
        <div className="map-controls-bar">
          <button
            className={`map-ctrl-btn map-ctrl-3d ${pitch > 1 ? 'is-active' : ''}`}
            onClick={() => mapRef.current?.easeTo({ pitch: pitch > 1 ? 0 : 60, duration: 400 })}
            title={pitch > 1 ? (isZh ? '退出 3D' : 'Exit 3D') : (isZh ? '3D 视角' : '3D view')}
          >3D</button>
          <button
            className="map-ctrl-btn map-ctrl-compass"
            onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 })}
            title={isZh ? '复位朝北' : 'Reset bearing'}
            aria-label="Reset north"
          >
            <Navigation
              size={14}
              strokeWidth={1.75}
              style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.2s' }}
              fill="currentColor"
            />
          </button>
          <button
            className="map-ctrl-btn"
            onClick={() => mapRef.current?.zoomOut()}
            title={isZh ? '缩小' : 'Zoom out'}
            aria-label="Zoom out"
          ><Minus size={14} strokeWidth={2} /></button>
          <button
            className="map-ctrl-btn"
            onClick={() => mapRef.current?.zoomIn()}
            title={isZh ? '放大' : 'Zoom in'}
            aria-label="Zoom in"
          ><Plus size={14} strokeWidth={2} /></button>
        </div>
      </div>

      <div className="globe-statusbar">
        <div className="globe-statusbar-left">
          <a
            className="globe-statusbar-credit"
            href="https://www.solarsystemscope.com/textures/"
            target="_blank"
            rel="noopener noreferrer"
          >stars: Solar System Scope · CC BY 4.0</a>
          <span className="globe-statusbar-attrib">
            <span className="globe-statusbar-attrib-trigger">ⓘ map data</span>
            <span className="globe-statusbar-attrib-tip">
              {theme === 'satellite'
                ? <>© <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a>, <a href="https://www.maxar.com" target="_blank" rel="noopener noreferrer">Maxar</a>, Earthstar Geographics · labels © <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors</>
                : <>© <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors</>
              }
            </span>
          </span>
        </div>
        <span className="globe-statusbar-coords">
          {cursorPos ? formatDMS(cursorPos.lat, cursorPos.lng) : ''}
        </span>
      </div>

      {mode === 'cuber' && (cuber || loadProgress) && (
        <div className="cuber-bar">
          {cuber && (
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
                onClick={() => {
                  if (playing) { setPlaying(false); return; }
                  if (currentIndex >= cuberComps.length - 1) setCurrentIndex(0);
                  setPlaying(true);
                }}
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
        </div>
      )}

      {error && <div className="globe-error">{error}</div>}
      {mode === 'upcoming' && !comps && !error && <div className="globe-loading">{t('globe.loading')}</div>}

      <div ref={containerRef} className="map-canvas" />

      {selectedComps && selectedComps.length > 0 && (
        <div className="bin-panel-overlay" onClick={() => setSelectedComps(null)}>
          <div className="bin-panel" onClick={(ev) => ev.stopPropagation()}>
            <button className="bin-panel-close" onClick={() => setSelectedComps(null)} aria-label="Close">×</button>
            <h2 className="bin-panel-title">
              {selectedComps.length === 1
                ? <a href={selectedComps[0].url} target="_blank" rel="noopener noreferrer" className="bin-panel-title-link">{selectedComps[0].name} ↗</a>
                : (isZh ? `${selectedComps.length} 场比赛` : `${selectedComps.length} competitions`)}
            </h2>
            <div className="bin-panel-list">
              {selectedComps.map((c) => (
                <div key={c.id} className="bin-panel-item">
                  {selectedComps.length > 1 && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="bin-panel-item-title">
                      {c.name} ↗
                    </a>
                  )}
                  <div className="bin-panel-meta">
                    {c.city}, {countryName(c.country, isZh)} · {c.start_date}
                    {c.start_date !== c.end_date ? ` — ${c.end_date}` : ''}
                  </div>
                </div>
              ))}
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

    </div>
  );
}
