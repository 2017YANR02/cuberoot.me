/**
 * WCA 比赛地图 — MapLibre GL JS 矢量地球
 * 模式：
 *   - upcoming: 近期全球比赛聚合点
 *   - cuber:    选手生涯足迹（按时间顺序画大圆弧，支持 play/scrub）
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RotateCcw, RotateCw, Play, Pause, X, Moon, Sun, Satellite, Plus, Minus, Navigation, Compass, Ruler, Undo2, Search } from 'lucide-react';
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

type Mode = 'upcoming' | 'cuber';
type Speed = 0.5 | 1 | 2;
type DrawMode = 'none' | 'measure' | 'path' | 'polygon';
type SavedShape = {
  id: string;
  type: 'measure' | 'path' | 'polygon';
  name: string;
  points: [number, number][];
  createdAt: number;
};

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
      // 低 zoom 底图：NASA GIBS Blue Marble，真实深蓝海洋，全球 CDN 含中国都很快
      // 单 tile ~30-50KB，全球视图 ~12 个 tile 就能覆盖
      bluemarble: {
        type: 'raster',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
        tileSize: 256,
        maxzoom: 8,
        attribution: 'NASA Earth Observatory · Blue Marble',
      },
      // 高 zoom 细节：Esri World Imagery，城市级别才会拉
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
      // Blue Marble 永远在最底层做兜底色（避免 Esri 加载未完成时露白）
      { id: 'bluemarble-base', type: 'raster', source: 'bluemarble', maxzoom: 9 },
      // Esri 高清覆盖在上面，z 6+ 才开始拉，平滑接管
      { id: 'satellite-base', type: 'raster', source: 'satellite', minzoom: 6 },
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

// ── 球面几何工具（Haversine 距离 + 球面多边形面积）──
const EARTH_R_KM = 6371;
function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(x));
}
function totalDistanceKm(points: [number, number][]): number {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += haversineKm(points[i - 1], points[i]);
  return s;
}
// 大圆弧插值：在两点之间的球面短程线上均匀采样，输出 [lng, lat][] 含端点
function greatCircleArc(a: [number, number], b: [number, number]): [number, number][] {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const lat1 = a[1] * toRad, lng1 = a[0] * toRad;
  const lat2 = b[1] * toRad, lng2 = b[0] * toRad;
  const sinDLat = Math.sin((lat2 - lat1) / 2);
  const sinDLng = Math.sin((lng2 - lng1) / 2);
  const x = sinDLat * sinDLat + sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);
  const d = 2 * Math.asin(Math.min(1, Math.sqrt(x)));
  if (d < 1e-7) return [a, b];
  // 步数随弧长自适应：每 ~150 km 一段，最少 32，最多 256
  const steps = Math.min(256, Math.max(32, Math.ceil(d * EARTH_R_KM / 150)));
  const cosLat1 = Math.cos(lat1), cosLat2 = Math.cos(lat2);
  const sinD = Math.sin(d);
  const out: [number, number][] = new Array(steps + 1);
  let prevLng = a[0]; // 用来跨反子午线时把 lng "解卷绕" 成连续值
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;
    const xx = A * cosLat1 * Math.cos(lng1) + B * cosLat2 * Math.cos(lng2);
    const yy = A * cosLat1 * Math.sin(lng1) + B * cosLat2 * Math.sin(lng2);
    const zz = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(zz, Math.sqrt(xx * xx + yy * yy)) * toDeg;
    let lng = Math.atan2(yy, xx) * toDeg;
    // 解卷绕：保持相邻 lng 差 < 180°，避免跨 ±180 时画一条横穿地图的回弹线
    while (lng - prevLng > 180) lng -= 360;
    while (prevLng - lng > 180) lng += 360;
    prevLng = lng;
    out[i] = [lng, lat];
  }
  return out;
}
// 把多个折点按相邻配对扩展成一条连续大圆弧 LineString 坐标
function expandToGreatCircleLine(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points;
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = greatCircleArc(points[i], points[i + 1]);
    if (i === 0) out.push(...seg);
    else out.push(...seg.slice(1)); // 去重端点
  }
  return out;
}
// 球面多边形面积（球面过剩公式）
function polygonAreaKm2(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const toRad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [lng1, lat1] = points[i];
    const [lng2, lat2] = points[(i + 1) % points.length];
    sum += (lng2 - lng1) * toRad * (2 + Math.sin(lat1 * toRad) + Math.sin(lat2 * toRad));
  }
  return Math.abs(sum * EARTH_R_KM * EARTH_R_KM / 2);
}
function fmtDistance(km: number, isZh: boolean): string {
  if (km < 1) return `${(km * 1000).toFixed(1)} m`;
  if (km < 100) return `${km.toFixed(2)} km`;
  return `${km.toLocaleString(isZh ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 })} km`;
}
function fmtArea(km2: number, isZh: boolean): string {
  if (km2 < 1) return `${Math.round(km2 * 1_000_000).toLocaleString()} m²`;
  if (km2 < 100) return `${km2.toFixed(2)} km²`;
  return `${km2.toLocaleString(isZh ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 })} km²`;
}

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

  // ── past 比赛叠加（Comps 模式下的可选层） ──
  const currentYear = new Date().getFullYear();
  const [includePast, setIncludePast] = useState(false);
  const [pastComps, setPastComps] = useState<PastCompRecord[] | null>(null);
  const [pastLoading, setPastLoading] = useState(false);
  // 默认从 1982（slider 拉到 HISTORY_MIN_YEAR=2003 时自动包含 1982 那一场）
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
  const [navPopoverOpen, setNavPopoverOpen] = useState(false);
  const navPopoverRef = useRef<HTMLDivElement | null>(null);

  // ── 搜索（地点 via Nominatim / 比赛 via 本地 comps）──
  type GeoResult = { display_name: string; lat: string; lon: string; boundingbox?: [string, string, string, string] };
  type SearchType = 'place' | 'comp';
  const [searchType, setSearchType] = useState<SearchType>('place');
  const [searchQuery, setSearchQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<GeoResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  // 地点搜索：Nominatim
  useEffect(() => {
    if (searchType !== 'place') { setPlaceResults([]); setSearchLoading(false); return; }
    const q = searchQuery.trim();
    if (q.length < 2) { setPlaceResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error('nominatim');
        const data = await r.json() as GeoResult[];
        setPlaceResults(data);
      } catch { /* aborted or failed */ }
      finally { setSearchLoading(false); }
    }, 350);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [searchQuery, searchType]);
  // 比赛搜索：本地 comps + pastComps（同步，无网络请求）
  type CompResult = { id: string; name: string; city: string; country: string; lng: number; lat: number; date: string; tag: 'upcoming' | 'past' };
  const compResults = useMemo<CompResult[]>(() => {
    if (searchType !== 'comp') return [];
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const matches: CompResult[] = [];
    for (const c of (comps ?? [])) {
      if (c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)) {
        seen.add(c.id);
        matches.push({ id: c.id, name: c.name, city: c.city, country: c.country, lng: c.longitude_degrees, lat: c.latitude_degrees, date: c.start_date, tag: 'upcoming' });
      }
    }
    for (const c of (pastComps ?? [])) {
      if (seen.has(c.id)) continue;
      if (c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)) {
        matches.push({ id: c.id, name: c.name, city: c.city, country: c.country, lng: c.lng, lat: c.lat, date: c.start_date, tag: 'past' });
      }
    }
    // upcoming 永远排前面，past 按日期倒序（最新的在上）
    matches.sort((a, b) => {
      if (a.tag !== b.tag) return a.tag === 'upcoming' ? -1 : 1;
      return b.date.localeCompare(a.date);
    });
    return matches.slice(0, 50);
  }, [searchType, searchQuery, comps, pastComps]);
  // 搜索 comp 模式下顺便把历史比赛 JSON 拉下来（即使当前不在 history 模式）
  useEffect(() => {
    if (searchType !== 'comp' || pastComps !== null || pastLoading) return;
    setPastLoading(true);
    fetchAllPastCompsJson()
      .then((list) => setPastComps(list))
      .catch(() => { /* 静默；history 模式还有第二次机会 */ })
      .finally(() => setPastLoading(false));
  }, [searchType, pastComps, pastLoading]);
  useEffect(() => {
    if (!searchOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [searchOpen]);
  const goToPlaceResult = useCallback((r: GeoResult) => {
    const map = mapRef.current;
    if (!map) return;
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (r.boundingbox) {
      const [s, n, w, e] = r.boundingbox;
      try {
        map.fitBounds([[parseFloat(w), parseFloat(s)], [parseFloat(e), parseFloat(n)]], { padding: 60, duration: 800, maxZoom: 11 });
      } catch {
        map.easeTo({ center: [lng, lat], zoom: 8, duration: 800 });
      }
    } else {
      map.easeTo({ center: [lng, lat], zoom: 8, duration: 800 });
    }
    setSearchOpen(false);
    setSearchQuery(r.display_name.split(',')[0]);
  }, []);
  const goToCompResult = useCallback((c: CompResult) => {
    const map = mapRef.current;
    if (!map) return;
    setMode('upcoming');
    // past 比赛需要勾上 includePast 并撑开年份滑块
    if (c.tag === 'past') {
      setIncludePast(true);
      const compYear = parseInt(c.date.slice(0, 4), 10);
      if (Number.isFinite(compYear)) {
        setYearRange(([lo, hi]) => [Math.min(lo, compYear), Math.max(hi, compYear)]);
      }
    }
    map.easeTo({ center: [c.lng, c.lat], zoom: 8, duration: 800 });
    setSearchOpen(false);
    setSearchQuery(c.name);
  }, []);

  // ── 绘制 / 测量 state ──
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  // cursor 跟随：地图坐标用 ref（高频更新走 DOM/source 直接刷，不触发 React 重渲染）
  const cursorMapRef = useRef<[number, number] | null>(null);
  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const updateGhostLineRef = useRef<(() => void) | null>(null);
  const drawPointsRef = useRef<[number, number][]>([]);
  useEffect(() => { drawPointsRef.current = drawPoints; }, [drawPoints]);
  // snap-target hover：cursor 是否贴近起点
  const [snapHover, setSnapHover] = useState(false);
  const snapHoverRef = useRef(false);
  useEffect(() => { snapHoverRef.current = snapHover; }, [snapHover]);
  const drawModeRef = useRef<DrawMode>('none');
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  const [savedShapes, setSavedShapes] = useState<SavedShape[]>(() => {
    try {
      const raw = localStorage.getItem('globe.shapes.v1');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('globe.shapes.v1', JSON.stringify(savedShapes)); } catch { /* */ }
  }, [savedShapes]);

  // ── nav popover 点击外关闭 ──
  useEffect(() => {
    if (!navPopoverOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (navPopoverRef.current && !navPopoverRef.current.contains(e.target as Node)) setNavPopoverOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [navPopoverOpen]);

  // ── 拉 upcoming 数据（读预生成 JSON） ──
  useEffect(() => {
    fetchAllUpcomingCompsJson()
      .then((list) => setComps(list.filter((c) => c.latitude_degrees != null && c.longitude_degrees != null)))
      .catch(() => setError(t('globe.loadFailed')));
  }, [t]);

  // ── 拉 history 数据（懒加载，勾选 includePast 才开始拉） ──
  useEffect(() => {
    if (!includePast || pastComps !== null || pastLoading) return;
    setPastLoading(true);
    fetchAllPastCompsJson()
      .then((list) => setPastComps(list))
      .catch(() => setError(t('globe.loadFailed')))
      .finally(() => setPastLoading(false));
  }, [includePast, pastComps, pastLoading, t]);

  const filteredComps = useMemo(() => comps ?? [], [comps]);

  const upcomingStats = useMemo(() => {
    const countries = new Set(filteredComps.map((c) => c.country));
    return { comps: filteredComps.length, countries: countries.size };
  }, [filteredComps]);

  // 合并的 countries 计数（upcoming + past 去重，仅在 includePast 时和 pastStats 联用）
  const combinedCountries = useMemo(() => {
    const s = new Set<string>();
    for (const c of filteredComps) s.add(c.country);
    if (includePast) for (const c of (pastComps ?? [])) s.add(c.country);
    return s.size;
  }, [filteredComps, includePast, pastComps]);

  // ── history 模式过滤 ──
  const filteredPast = useMemo(() => {
    if (!pastComps) return [];
    const [y0, y1] = yearRange;
    const effectiveMin = y0 === HISTORY_MIN_YEAR ? HISTORY_ABSOLUTE_MIN : y0;
    return pastComps.filter((c) => {
      const y = Number(c.start_date.slice(0, 4));
      return y >= effectiveMin && y <= y1;
    });
  }, [pastComps, yearRange]);

  // 同坐标比赛预合并为 1 个 feature：避免 zoom 超过 clusterMaxZoom 后两场完全重叠
  // 只点到一场。stack_count>1 时 feature 属性里塞 stack_comps（JSON 字符串）供 click 展开。
  // includePast 时把 past 也并入同一 source，由 MapLibre 一起聚合（视觉不区分新旧）
  const upcomingGeojson = useMemo(() => {
    type AnyComp = (UpcomingCompRecord | PastCompRecord) & { __past?: boolean };
    const groups = new Map<string, AnyComp[]>();
    for (const c of filteredComps) {
      const key = `${c.longitude_degrees.toFixed(6)},${c.latitude_degrees.toFixed(6)}`;
      const g = groups.get(key);
      if (g) g.push(c); else groups.set(key, [c]);
    }
    if (includePast) {
      for (const c of filteredPast) {
        const key = `${c.longitude_degrees.toFixed(6)},${c.latitude_degrees.toFixed(6)}`;
        const tagged: AnyComp = { ...c, __past: true };
        const g = groups.get(key);
        if (g) g.push(tagged); else groups.set(key, [tagged]);
      }
    }
    const features = Array.from(groups.values()).map((group) => {
      const head = group[0];
      const isPastHead = (head as { __past?: boolean }).__past === true;
      const url = isPastHead ? `https://www.worldcubeassociation.org/competitions/${head.id}` : (head as UpcomingCompRecord).url;
      const props: Record<string, unknown> = {
        id: head.id, name: head.name, city: head.city,
        country: head.country,
        start_date: head.start_date, end_date: head.end_date, url,
        stack_count: group.length,
      };
      if (group.length > 1) {
        // 给点击展开用：把每条都规范化（保留 url 字段，past 用 id 反推）
        const normalized = group.map((c) => {
          const past = (c as { __past?: boolean }).__past === true;
          return {
            id: c.id, name: c.name, city: c.city, country: c.country,
            start_date: c.start_date, end_date: c.end_date,
            latitude_degrees: c.latitude_degrees, longitude_degrees: c.longitude_degrees,
            url: past ? `https://www.worldcubeassociation.org/competitions/${c.id}` : (c as UpcomingCompRecord).url,
            events: c.events,
            competitor_limit: past ? 0 : (c as UpcomingCompRecord).competitor_limit,
          };
        });
        props.stack_comps = JSON.stringify(normalized);
      }
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [head.longitude_degrees, head.latitude_degrees] },
        properties: props,
      };
    });
    return { type: 'FeatureCollection' as const, features };
  }, [filteredComps, filteredPast, includePast]);

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
        zoom: cam?.zoom ?? 2.4,
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
      const onGlobe = dx * dx + dy * dy <= 4;
      if (onGlobe) setCursorPos({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      else setCursorPos(null);
      // 绘制模式下，更新 cursorMapRef + 跟随 tooltip 位置 + 幽灵线 + snap 检测
      if (drawModeRef.current !== 'none') {
        cursorMapRef.current = onGlobe ? [e.lngLat.lng, e.lngLat.lat] : null;
        const tip = tooltipElRef.current;
        if (tip) {
          if (onGlobe) {
            tip.style.transform = `translate(${e.point.x + 14}px, ${e.point.y + 14}px)`;
            tip.style.opacity = '1';
          } else {
            tip.style.opacity = '0';
          }
        }
        // snap hover：path/polygon + ≥3 点 + 距起点 < 14px
        const pts = drawPointsRef.current;
        if ((drawModeRef.current === 'path' || drawModeRef.current === 'polygon') && pts.length >= 3 && onGlobe) {
          const firstPx = map.project(pts[0]);
          const dx = firstPx.x - e.point.x;
          const dy = firstPx.y - e.point.y;
          const isSnap = dx * dx + dy * dy <= 14 * 14;
          if (isSnap !== snapHoverRef.current) setSnapHover(isSnap);
        } else if (snapHoverRef.current) {
          setSnapHover(false);
        }
        updateGhostLineRef.current?.();
      }
    });
    map.on('mouseout', () => {
      setCursorPos(null);
      cursorMapRef.current = null;
      const tip = tooltipElRef.current;
      if (tip) tip.style.opacity = '0';
      updateGhostLineRef.current?.();
    });
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
      // past source & layers — 先加，渲染在底层；upcoming 总是叠在上面更醒目
      // NOTE: 14k 点依赖 MapLibre cluster 性能；clusterMaxZoom/Radius 和 upcoming 保持一致
      map.addSource('past-comps', {
        type: 'geojson', data: pastGeojson as unknown as GeoJSON.FeatureCollection,
        cluster: true, clusterMaxZoom: 6, clusterRadius: 45,
      });
      map.addLayer({
        id: 'past-clusters', type: 'circle', source: 'past-comps', filter: ['has', 'point_count'],
        layout: { 'visibility': 'none' },
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#E08B6C', 50, '#C15F3C', 500, '#8B3E1F'],
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
          'circle-color': '#C15F3C',
          'circle-radius': 6,
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF',
        },
      });

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
          // 与 clusters 图层 stack_total 同款 step，保证视觉一致
          'circle-color': ['step', ['get', 'stack_count'], '#E08B6C', 10, '#C15F3C', 50, '#8B3E1F'],
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

      // ── 绘制工具图层（测量 / 路径 / 多边形）──
      const empty = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
      map.addSource('draw-line', { type: 'geojson', data: empty });
      map.addSource('draw-fill', { type: 'geojson', data: empty });
      map.addSource('draw-vert', { type: 'geojson', data: empty });
      map.addSource('draw-ghost', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'draw-fill', type: 'fill', source: 'draw-fill',
        paint: { 'fill-color': '#E07752', 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: 'draw-line-casing', type: 'line', source: 'draw-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 5, 'line-opacity': 0.55 },
      });
      map.addLayer({
        id: 'draw-line', type: 'line', source: 'draw-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#E07752', 'line-width': 2.5 },
      });
      // 幽灵线：从最后一个落点到光标的预览线，细 / 半透明 / 虚线
      map.addLayer({
        id: 'draw-ghost', type: 'line', source: 'draw-ghost',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 1.4,
          'line-opacity': 0.8,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'draw-vert', type: 'circle', source: 'draw-vert',
        paint: {
          'circle-color': ['case', ['==', ['get', 'active'], true], '#FFD24A', '#E07752'],
          // snap-target（hover 在起点上）放大一倍提示用户可以闭合
          'circle-radius': ['case', ['==', ['get', 'snap'], true], 9, 4.5],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ['==', ['get', 'snap'], true], 2.5, 1.5],
        },
      });
      map.addLayer({
        id: 'draw-vert-label', type: 'symbol', source: 'draw-vert',
        layout: {
          'text-field': ['coalesce', ['get', 'label'], ''],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, -1.4],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#FFFFFF', 'text-halo-color': '#000000', 'text-halo-width': 1.5 },
      });

      // upcoming 交互
      map.on('click', 'clusters', async (e: MapMouseEvent) => {
        if (drawModeRef.current !== 'none') return;
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
        if (drawModeRef.current !== 'none') return;
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
        if (drawModeRef.current !== 'none') return;
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
        if (drawModeRef.current !== 'none') return;
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
    // past 已经合并进 upcoming source，past-* 图层不再单独显示
    show(PAST_LAYERS, false);
    show(CUBER_LAYERS, mode === 'cuber');
  }, [mode, includePast]);

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

  // ── 绘制：完成 / 取消 / 启动模式 ──
  // 单形状策略：每次 finish 直接替换 savedShapes，不累积
  const finishDrawing = useCallback((asPolygon = false) => {
    const pts = drawPoints;
    const mode = drawMode;
    if (mode === 'measure' && pts.length >= 2) {
      setSavedShapes([{ id: `m${Date.now()}`, type: 'measure', name: isZh ? '测距' : 'Measurement', points: pts, createdAt: Date.now() }]);
    } else if ((mode === 'path' || mode === 'polygon')) {
      if (asPolygon && pts.length >= 3) {
        setSavedShapes([{ id: `g${Date.now()}`, type: 'polygon', name: isZh ? '多边形' : 'Polygon', points: pts, createdAt: Date.now() }]);
      } else if (pts.length >= 2) {
        setSavedShapes([{ id: `p${Date.now()}`, type: 'path', name: isZh ? '路径' : 'Path', points: pts, createdAt: Date.now() }]);
      }
    }
    setDrawMode('none');
    setDrawPoints([]);
    setSnapHover(false);
  }, [drawPoints, drawMode, isZh]);

  const cancelDrawing = useCallback(() => {
    setDrawMode('none');
    setDrawPoints([]);
    setSnapHover(false);
  }, []);

  const startDrawing = useCallback((m: DrawMode) => {
    setNavPopoverOpen(false);
    setDrawMode(m);
    setDrawPoints([]);
    setSavedShapes([]); // 新建时清掉旧形状
    setSnapHover(false);
  }, []);

  // ── 绘制：地图事件绑定 ──
  useEffect(() => {
    if (drawMode === 'none') return;
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = 'crosshair';
    map.doubleClickZoom.disable();

    const SNAP_PX = 14; // 距起点 < 14 像素时自动闭合
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const pts = drawPointsRef.current;
      // path/polygon 模式 + 已有 ≥3 点 + 点击位置贴近起点 → 闭合为多边形
      if ((drawModeRef.current === 'path' || drawModeRef.current === 'polygon') && pts.length >= 3) {
        const firstPx = map.project(pts[0]);
        const dx = firstPx.x - e.point.x;
        const dy = firstPx.y - e.point.y;
        if (dx * dx + dy * dy <= SNAP_PX * SNAP_PX) {
          finishDrawing(true);
          return;
        }
      }
      setDrawPoints((arr) => [...arr, [e.lngLat.lng, e.lngLat.lat]]);
    };
    const onDbl = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      finishDrawing();
    };
    const onCtx = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      setDrawPoints((arr) => arr.slice(0, -1));
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cancelDrawing();
      else if (ev.key === 'Enter') finishDrawing();
    };
    map.on('click', onClick);
    map.on('dblclick', onDbl);
    map.on('contextmenu', onCtx);
    document.addEventListener('keydown', onKey);
    return () => {
      canvas.style.cursor = '';
      map.doubleClickZoom.enable();
      map.off('click', onClick);
      map.off('dblclick', onDbl);
      map.off('contextmenu', onCtx);
      document.removeEventListener('keydown', onKey);
    };
  }, [drawMode, finishDrawing, cancelDrawing]);

  // ── 绘制：source 数据同步 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const lineSrc = map.getSource('draw-line') as maplibregl.GeoJSONSource | undefined;
    const fillSrc = map.getSource('draw-fill') as maplibregl.GeoJSONSource | undefined;
    const vertSrc = map.getSource('draw-vert') as maplibregl.GeoJSONSource | undefined;
    if (!lineSrc || !fillSrc || !vertSrc) return;

    const lineFeats: GeoJSON.Feature[] = [];
    const fillFeats: GeoJSON.Feature[] = [];
    const vertFeats: GeoJSON.Feature[] = [];

    // 已保存形状（线段全部走大圆弧；不在地图上写文字标签——统计信息留给左上角卡片）
    for (const s of savedShapes) {
      if (s.points.length < 2) continue;
      if (s.type === 'polygon' && s.points.length >= 3) {
        const ring = [...s.points, s.points[0]];
        const arc = expandToGreatCircleLine(ring);
        fillFeats.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [arc] } });
        lineFeats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc } });
      } else {
        const arc = expandToGreatCircleLine(s.points);
        lineFeats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc } });
      }
      // 顶点：每个折点都画一个圆，匹配谷歌地球
      for (const pt of s.points) {
        vertFeats.push({ type: 'Feature', properties: { active: false }, geometry: { type: 'Point', coordinates: pt } });
      }
    }

    // 当前正在绘制的形状（已落定的线段全部走大圆弧）
    if (drawMode !== 'none' && drawPoints.length > 0) {
      if (drawPoints.length >= 2) {
        const arc = expandToGreatCircleLine(drawPoints);
        lineFeats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc } });
      }
      let cum = 0;
      for (let i = 0; i < drawPoints.length; i++) {
        if (i > 0) cum += haversineKm(drawPoints[i - 1], drawPoints[i]);
        vertFeats.push({
          type: 'Feature',
          properties: {
            active: true,
            label: i === 0 ? '' : fmtDistance(cum, isZh),
            snap: i === 0 && snapHover,
          },
          geometry: { type: 'Point', coordinates: drawPoints[i] },
        });
      }
    }

    lineSrc.setData({ type: 'FeatureCollection', features: lineFeats });
    fillSrc.setData({ type: 'FeatureCollection', features: fillFeats });
    vertSrc.setData({ type: 'FeatureCollection', features: vertFeats });
  }, [drawPoints, drawMode, savedShapes, mapLoaded, isZh, theme, snapHover]);

  // ── 幽灵线：从最后一个落点 → 当前光标位置（高频，绕开 React state）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const ghostSrc = map.getSource('draw-ghost') as maplibregl.GeoJSONSource | undefined;
    if (!ghostSrc) return;
    const update = () => {
      const pts = drawPointsRef.current;
      const cur = cursorMapRef.current;
      const inDraw = drawModeRef.current !== 'none';
      if (!inDraw || pts.length === 0 || !cur) {
        ghostSrc.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const last = pts[pts.length - 1];
      const arc = greatCircleArc(last, cur);
      ghostSrc.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: arc } }],
      });
    };
    updateGhostLineRef.current = update;
    update();
    return () => { updateGhostLineRef.current = null; };
  }, [mapLoaded, drawMode, drawPoints]);

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
        <Link to="/upcoming-comps" className="globe-logo-link" title={t('globe.backToCalendar') as string} aria-label="Home">
          <svg className="globe-logo" width={26} height={26} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <radialGradient id="earthGrad" cx="0.35" cy="0.35" r="0.85">
                <stop offset="0" stopColor="#5BA3D6" />
                <stop offset="1" stopColor="#1E5A8C" />
              </radialGradient>
            </defs>
            <circle cx="16" cy="16" r="13" fill="url(#earthGrad)" stroke="#9CC6E5" strokeWidth="0.8" />
            <ellipse cx="16" cy="16" rx="13" ry="4.5" stroke="#9CC6E5" strokeWidth="0.6" fill="none" opacity="0.55" />
            <path d="M16 3 C13 8 13 24 16 29" stroke="#9CC6E5" strokeWidth="0.6" fill="none" opacity="0.55" />
            <g transform="translate(20 20) rotate(20)">
              <rect x="-6" y="-6" width="12" height="12" rx="1.4" fill="#1E2329" stroke="#FFFFFF" strokeWidth="0.9" />
              <line x1="-6" y1="-2" x2="6" y2="-2" stroke="#FFFFFF" strokeWidth="0.7" />
              <line x1="-6" y1="2" x2="6" y2="2" stroke="#FFFFFF" strokeWidth="0.7" />
              <line x1="-2" y1="-6" x2="-2" y2="6" stroke="#FFFFFF" strokeWidth="0.7" />
              <line x1="2" y1="-6" x2="2" y2="6" stroke="#FFFFFF" strokeWidth="0.7" />
              <rect x="-6" y="-6" width="4" height="4" fill="#E07752" />
              <rect x="-2" y="-6" width="4" height="4" fill="#FFD24A" />
              <rect x="2" y="-6" width="4" height="4" fill="#5BA76B" />
              <rect x="-6" y="-2" width="4" height="4" fill="#3F76C2" />
              <rect x="-2" y="-2" width="4" height="4" fill="#F0EDE3" />
              <rect x="2" y="-2" width="4" height="4" fill="#E07752" />
              <rect x="-6" y="2" width="4" height="4" fill="#FFD24A" />
              <rect x="-2" y="2" width="4" height="4" fill="#5BA76B" />
              <rect x="2" y="2" width="4" height="4" fill="#3F76C2" />
              <line x1="-6" y1="-2" x2="6" y2="-2" stroke="#1E2329" strokeWidth="0.5" />
              <line x1="-6" y1="2" x2="6" y2="2" stroke="#1E2329" strokeWidth="0.5" />
              <line x1="-2" y1="-6" x2="-2" y2="6" stroke="#1E2329" strokeWidth="0.5" />
              <line x1="2" y1="-6" x2="2" y2="6" stroke="#1E2329" strokeWidth="0.5" />
              <rect x="-6" y="-6" width="12" height="12" rx="1.4" fill="none" stroke="#FFFFFF" strokeWidth="0.9" />
            </g>
          </svg>
        </Link>
        <h1 className="globe-title-compact">{t('globe.title')}</h1>

        <div className="globe-search" ref={searchWrapRef}>
          <button
            className="globe-search-type"
            onClick={() => { setSearchType((t) => t === 'place' ? 'comp' : 'place'); setSearchOpen(true); }}
            title={searchType === 'place' ? (isZh ? '当前：地点（点击切换到比赛）' : 'Currently: Places (click to switch to Comps)') : (isZh ? '当前：比赛（点击切换到地点）' : 'Currently: Comps (click to switch to Places)')}
          >
            {searchType === 'place'
              ? (isZh ? '地点' : 'Places')
              : (isZh ? '比赛' : 'Comps')}
          </button>
          <Search className="globe-search-icon" size={14} strokeWidth={1.75} />
          <input
            className="globe-search-input"
            type="text"
            placeholder={searchType === 'place' ? (isZh ? '搜索地点' : 'Search places') : (isZh ? '搜索比赛 / 城市' : 'Search comp / city')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (searchType === 'place' && placeResults[0]) goToPlaceResult(placeResults[0]);
                else if (searchType === 'comp' && compResults[0]) goToCompResult(compResults[0]);
              } else if (e.key === 'Escape') setSearchOpen(false);
            }}
          />
          {searchQuery && (
            <button
              className="globe-search-clear"
              onClick={() => { setSearchQuery(''); setPlaceResults([]); }}
              aria-label="Clear"
            ><X size={12} strokeWidth={2} /></button>
          )}
          {searchOpen && (() => {
            const showLoading = searchType === 'place' && searchLoading;
            const items = searchType === 'place' ? placeResults : compResults;
            const hasContent = showLoading || items.length > 0;
            const showEmpty = !showLoading && items.length === 0 && searchQuery.trim().length >= 2;
            if (!hasContent && !showEmpty) return null;
            return (
              <div className="globe-search-results">
                {showLoading && <div className="globe-search-empty">{isZh ? '搜索中…' : 'Searching…'}</div>}
                {showEmpty && <div className="globe-search-empty">{isZh ? '无结果' : 'No results'}</div>}
                {!showLoading && searchType === 'place' && placeResults.map((r, i) => (
                  <button key={i} className="globe-search-item" onClick={() => goToPlaceResult(r)}>
                    <span className="globe-search-item-main">{r.display_name.split(',')[0]}</span>
                    <span className="globe-search-item-sub">{r.display_name.split(',').slice(1).join(',').trim()}</span>
                  </button>
                ))}
                {searchType === 'comp' && compResults.map((c) => (
                  <button key={c.id} className="globe-search-item" onClick={() => goToCompResult(c)}>
                    <span className="globe-search-item-main">
                      {c.name}
                      <span className={`globe-search-item-tag globe-search-item-tag-${c.tag}`}>{c.tag === 'upcoming' ? (isZh ? '近期' : 'upcoming') : (isZh ? '历史' : 'past')}</span>
                    </span>
                    <span className="globe-search-item-sub">{c.city}, {countryName(c.country, isZh)} · {c.date}</span>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        <button
          className={`topbar-tool-btn ${drawMode === 'path' || drawMode === 'polygon' ? 'is-active' : ''}`}
          onClick={() => (drawMode === 'path' || drawMode === 'polygon') ? cancelDrawing() : startDrawing('path')}
          title={isZh ? '添加路径或多边形' : 'Add path or polygon'}
          aria-label="Add path or polygon"
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="6.2" y1="17" x2="12" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="12" y1="9" x2="17.8" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="6.2" cy="17" r="2.2" fill="currentColor" />
            <circle cx="12" cy="9" r="2.2" fill="currentColor" />
            <circle cx="17.8" cy="14" r="2.2" fill="currentColor" />
          </svg>
        </button>
        <button
          className={`topbar-tool-btn ${drawMode === 'measure' ? 'is-active' : ''}`}
          onClick={() => drawMode === 'measure' ? cancelDrawing() : startDrawing('measure')}
          title={isZh ? '测距' : 'Measure distance'}
          aria-label="Measure"
        ><Ruler size={14} strokeWidth={1.75} /></button>

        <div className="globe-topbar-spacer" />

        <div className="mode-toggle" role="tablist">
          <button role="tab" aria-selected={mode === 'cuber'} className={`range-btn ${mode === 'cuber' ? 'is-active' : ''}`} onClick={() => { setMode('cuber'); if (!cuber) setPickerOpen(true); }}>
            {t('globe.modeCuber')}
          </button>
          <button role="tab" aria-selected={mode === 'upcoming'} className={`range-btn ${mode === 'upcoming' ? 'is-active' : ''}`} onClick={() => setMode('upcoming')}>
            {t('globe.modeComps')}
          </button>
        </div>
        {mode === 'upcoming' && (
          <label className="include-past-toggle" title={isZh ? '在地图上叠加显示往期比赛（蓝色）' : 'Overlay past competitions (blue)'}>
            <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} />
            <span>{t('globe.includePast')}</span>
          </label>
        )}
        {mode === 'upcoming' && includePast && (
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

        <LangToggle className="topbar-lang" />
        <button className="reset-btn" onClick={resetView} title={isZh ? '复位视角' : 'Reset view'}>
          <RotateCcw size={14} strokeWidth={1.75} />
        </button>
      </div>

      {drawMode !== 'none' && drawPoints.length === 0 && (
        <div ref={tooltipElRef} className="draw-cursor-tip" style={{ opacity: 0 }}>
          <span className="draw-cursor-tip-plus">+</span>
          {isZh ? '添加第一个点' : 'Add first point'}
        </div>
      )}

      {(() => {
        const drawing = drawMode !== 'none';
        const saved = !drawing && savedShapes.length > 0 ? savedShapes[0] : null;
        if (!drawing && !saved) return null;

        // 决定卡片显示的"形状种类"和点集
        const kind: 'measure' | 'path' | 'polygon' = drawing
          ? (drawMode === 'measure' ? 'measure' : drawMode as 'path' | 'polygon')
          : saved!.type;
        const isMeasure = kind === 'measure';
        const points = drawing ? drawPoints : saved!.points;
        // 周长/面积：保存的多边形按闭合环算；进行中按当前 drawPoints 算（>=3 点显示潜在面积）
        const isPolygon = saved?.type === 'polygon';
        const total = isPolygon
          ? totalDistanceKm([...points, points[0]])
          : totalDistanceKm(points);
        const area = !drawing && isPolygon
          ? polygonAreaKm2(points)
          : (drawing && (kind === 'path' || kind === 'polygon') && points.length >= 3 ? polygonAreaKm2(points) : null);

        const title = isMeasure
          ? (isZh ? '测距' : 'Measure distance')
          : (isZh ? '路径或多边形' : 'Path or polygon');
        const subtitle = drawing
          ? (isMeasure
              ? (isZh ? '点击地图依次添加测量点' : 'Click points on the map to measure distance')
              : (isZh ? '点击地图依次添加点来绘制路径或多边形' : 'Click points on the map to draw a path or polygon'))
          : (isMeasure
              ? (isZh ? '已保存的测量' : 'Saved measurement')
              : (isPolygon ? (isZh ? '已保存的多边形' : 'Saved polygon') : (isZh ? '已保存的路径' : 'Saved path')));

        const closeAction = drawing ? cancelDrawing : () => setSavedShapes([]);

        return (
          <div className="draw-card">
            <div className="draw-card-header">
              <span className="draw-card-icon" aria-hidden="true">
                {isMeasure
                  ? <Ruler size={16} strokeWidth={1.75} />
                  : (
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <line x1="6.2" y1="17" x2="12" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <line x1="12" y1="9" x2="17.8" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <circle cx="6.2" cy="17" r="2.2" fill="currentColor" />
                      <circle cx="12" cy="9" r="2.2" fill="currentColor" />
                      <circle cx="17.8" cy="14" r="2.2" fill="currentColor" />
                    </svg>
                  )}
              </span>
              <span className="draw-card-header-spacer" />
              {drawing && (
                <>
                  <button
                    className="draw-card-icon-btn"
                    onClick={() => setDrawPoints([])}
                    disabled={drawPoints.length === 0}
                    title={isZh ? '清除当前所有点' : 'Restart'}
                    aria-label="Restart"
                  ><RotateCw size={14} strokeWidth={1.75} /></button>
                  <button
                    className="draw-card-icon-btn"
                    onClick={() => setDrawPoints((arr) => arr.slice(0, -1))}
                    disabled={drawPoints.length === 0}
                    title={isZh ? '撤销' : 'Undo'}
                    aria-label="Undo"
                  ><Undo2 size={14} strokeWidth={1.75} /></button>
                </>
              )}
              <button
                className="draw-card-icon-btn"
                onClick={closeAction}
                title={isZh ? '关闭' : 'Close'}
                aria-label="Close"
              ><X size={14} strokeWidth={1.75} /></button>
            </div>
            <div className="draw-card-title">{title}</div>
            <div className="draw-card-subtitle">{subtitle}</div>

            <div className="draw-card-section">
              <div className="draw-card-section-label">{isMeasure ? (isZh ? '总距离' : 'Total distance') : (isZh ? '周长' : 'Perimeter')}</div>
              <div className="draw-card-section-value">{fmtDistance(total, isZh)}</div>
            </div>
            {!isMeasure && (
              <div className="draw-card-section">
                <div className="draw-card-section-label">{isZh ? '面积' : 'Area'}</div>
                <div className="draw-card-section-value">{area !== null ? fmtArea(area, isZh) : '—'}</div>
              </div>
            )}

            {drawing && !isMeasure && (
              <div className="draw-card-actions">
                <button
                  className="draw-card-save"
                  onClick={() => finishDrawing(false)}
                  disabled={drawPoints.length < 2}
                >{isZh ? '存为路径' : 'Save as path'}</button>
                <button
                  className="draw-card-save draw-card-save-secondary"
                  onClick={() => finishDrawing(true)}
                  disabled={drawPoints.length < 3}
                >{isZh ? '存为多边形' : 'Save as polygon'}</button>
              </div>
            )}
            {drawing && isMeasure && (
              <div className="draw-card-actions">
                <button
                  className="draw-card-save"
                  onClick={() => finishDrawing(false)}
                  disabled={drawPoints.length < 2}
                >{isZh ? '保存测距' : 'Save measurement'}</button>
              </div>
            )}
          </div>
        );
      })()}

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

      <div className="map-controls" ref={navPopoverRef}>
        {navPopoverOpen && (
          <div className="nav-popover">
            <div className="nav-popover-row">
              <label>{isZh ? '俯仰' : 'Tilt'}</label>
              <input
                type="range"
                min={0}
                max={85}
                step={1}
                value={Math.round(pitch)}
                onChange={(e) => mapRef.current?.setPitch(Number(e.target.value))}
              />
              <span className="nav-popover-val">{Math.round(pitch)}°</span>
            </div>
            <div className="nav-popover-row">
              <label>{isZh ? '朝向' : 'Heading'}</label>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={Math.round(bearing)}
                onChange={(e) => mapRef.current?.setBearing(Number(e.target.value))}
              />
              <span className="nav-popover-val">{Math.round(bearing)}°</span>
            </div>
            <button
              className="nav-popover-reset"
              onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 400 })}
            >{isZh ? '复位朝北' : 'Reset to north'}</button>
          </div>
        )}
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
            className={`map-ctrl-btn ${navPopoverOpen ? 'is-active' : ''}`}
            onClick={() => setNavPopoverOpen((v) => !v)}
            title={isZh ? '朝向与俯仰' : 'Heading and tilt controls'}
            aria-label="Heading and tilt"
            aria-expanded={navPopoverOpen}
          ><Compass size={14} strokeWidth={1.75} /></button>
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
        <div className="globe-statusbar-right">
          {mode === 'upcoming' && (
            <span className="globe-statusbar-stats">
              <span>{upcomingStats.comps} {isZh ? (includePast ? '近期' : '比赛') : (includePast ? 'upcoming' : 'comps')}</span>
              {includePast && (
                <>
                  <span className="globe-statusbar-stats-sep">·</span>
                  {pastLoading && !pastComps
                    ? <span>{isZh ? '加载往期…' : 'loading past…'}</span>
                    : <span>{pastStats.comps} {isZh ? '往期' : 'past'}</span>}
                </>
              )}
              <span className="globe-statusbar-stats-sep">·</span>
              <span>{includePast ? combinedCountries : upcomingStats.countries} {isZh ? '国家' : 'countries'}</span>
            </span>
          )}
          <span className="globe-statusbar-coords">
            {cursorPos ? formatDMS(cursorPos.lat, cursorPos.lng) : ''}
          </span>
        </div>
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
