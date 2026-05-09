/**
 * WCA 比赛地图 — MapLibre GL JS 矢量地球
 * 模式：
 *   - upcoming: 近期全球比赛聚合点
 *   - cuber:    选手生涯足迹（按时间顺序画大圆弧，支持 play/scrub）
 */
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RotateCw, Play, Pause, X, Moon, Sun, Satellite, Plus, Minus, Compass, Ruler, Undo2, Search, ArrowLeft, ChevronLeft, ChevronRight, Layers, Flame, Globe, Map as MapIcon, Globe2 } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as OpenCC from 'opencc-js';
import { localizeCity } from '../utils/city_localize';
import { stripWcaPrefix } from '../utils/comp_localize';
import { compNameZh } from '../utils/country_flags';
import { countryName } from '../utils/country_name';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import vtpbf from 'vt-pbf';
import {
  fetchAllUpcomingCompsJson,
  fetchAllPastCompsJson,
  fetchCompetitions,
  fetchCompetitionDetail,
  fetchPersonByWcaId,
  WcaPersonPicker,
  type UpcomingCompRecord,
  type PastCompRecord,
  type WcaCompDetail,
  type WcaPerson,
} from '@cuberoot/shared';
import LangToggle from '../components/LangToggle';
import { ClearButton } from '../components/ClearButton';
import { displayCuberName } from '../utils/name_utils';
import { formatDateRangeIso } from '../utils/date_range';
import { Flag, flagHtml } from '../utils/flag';
import './globe.css';

type Mode = 'upcoming' | 'cuber' | 'wr';
type Speed = 0.5 | 1 | 2;
// 密度可视化风格：scale=对数色阶 A / heat=热力图 B / country=国家 choropleth C
type DensityStyle = 'scale' | 'heat' | 'country';
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

// MapLibre globe 投影要求 WebGL2，无 WebGL2 的老浏览器/设备只能走 mercator
type MapProjection = 'globe' | 'mercator';
const hasWebGL2 = (() => {
  if (typeof document === 'undefined') return true;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2'));
  } catch { return false; }
})();

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


// NOTE: 国旗 HTML 统一在 utils/flag.tsx。popup 里 span 用 flag-span、img 用 flag-img（对齐 globe.css 样式）
const popupFlagHtml = (iso2: string): string => flagHtml(iso2, { spanClassName: 'flag-span', imgClassName: 'flag-img' });

const CUBER_SOURCE_POINTS = 'cuber-points';
const CUBER_SOURCE_ARCS = 'cuber-arcs';
const CUBER_SOURCE_ARC_TIP = 'cuber-arc-tip';
const CUBER_SOURCE_DENSITY = 'cuber-density';
const CUBER_SOURCE_PILLAR = 'cuber-pillar';
const CUBER_LAYER_DOT = 'cuber-points-dot';
const CUBER_LAYER_CITY = 'cuber-points-city';
const CUBER_LAYER_ARC = 'cuber-arcs-line';
const CUBER_LAYER_ARC_ARROW = 'cuber-arcs-arrow';
const CUBER_LAYER_DENSITY = 'cuber-density-circle';
const CUBER_LAYER_DENSITY_LABEL = 'cuber-density-label';
const CUBER_LAYER_PILLAR_FILL = 'cuber-pillar-fill';

const UPCOMING_LAYERS = ['clusters', 'cluster-count', 'unclustered-point', 'unclustered-count'];
const PAST_LAYERS = ['past-clusters', 'past-cluster-count', 'past-unclustered-point'];
// 用于 mode 切换时一键 hide/show.两种 cuber 子视图共用一份 label.
const CUBER_LAYERS_ARC_VIEW = [
  CUBER_LAYER_DENSITY,
  CUBER_LAYER_ARC, CUBER_LAYER_ARC_ARROW,
  CUBER_LAYER_DOT, CUBER_LAYER_CITY,
];
const CUBER_LAYERS_PILLAR_VIEW = [CUBER_LAYER_PILLAR_FILL];
const CUBER_LAYERS = [
  ...CUBER_LAYERS_ARC_VIEW,
  ...CUBER_LAYERS_PILLAR_VIEW,
  CUBER_LAYER_DENSITY_LABEL,
];

// 给定中心点 + 米半径,返回近似圆形 polygon 顶点(用于 fill-extrusion).
function buildCirclePolygon(lng: number, lat: number, radiusMeters: number, n = 24): [number, number][] {
  const earthR = 6378137;
  const latRad = lat * Math.PI / 180;
  const dLat = (radiusMeters / earthR) * 180 / Math.PI;
  const dLng = (radiusMeters / (earthR * Math.cos(latRad))) * 180 / Math.PI;
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}

// ── 密度可视化 A 模式：log10(count) 连续色 + 连续半径（感知均匀 YlOrRd 色带）──
// 用作 'clusters' / 'unclustered-point' 的 paint；属性名由 makeCountRamp 注入
function makeCountColorRamp(prop: string): unknown[] {
  return ['interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', prop], 1]]],
    0, '#FFEDA0',   // 1
    1, '#FEB24C',   // 10
    2, '#F03B20',   // 100
    2.7, '#BD0026', // ~500
    3.5, '#4A0000', // 3000+
  ];
}
function makeCountRadiusRamp(prop: string): unknown[] {
  return ['interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', prop], 1]]],
    0, 10, 1, 18, 2, 30, 2.7, 45, 3.5, 60,
  ];
}
// 原来的阶梯色（Scale 前的老样式，country 模式下恢复，避免 choropleth 下簇过于扎眼）
const STEP_COLOR_CLUSTER: unknown[] = ['step', ['get', 'stack_total'], '#E08B6C', 10, '#C15F3C', 50, '#8B3E1F'];
const STEP_RADIUS_CLUSTER: unknown[] = ['step', ['get', 'stack_total'], 15, 10, 22, 50, 30];
const STEP_COLOR_POINT: unknown[] = ['step', ['get', 'stack_count'], '#E08B6C', 10, '#C15F3C', 50, '#8B3E1F'];
const STEP_RADIUS_POINT: unknown[] = ['case', ['>', ['get', 'stack_count'], 1], 12, 7];

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
    // MapLibre v5: 第二个参数可能是 undefined，signal 改到 params.signal 上
    const signal = abortController?.signal ?? (params as { signal?: AbortSignal }).signal;
    const resp = await fetch(realUrl, { signal });
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
  // 陆地不透明化由后续注入的 earth-base 多边形负责。
  // 在把 background 置空前，先把 OFM 自带的 background-color 存到 metadata，
  // 供 earth-base 使用，保证和 OFM 默认观感一致。
  const styleMeta = (style.metadata ?? {}) as Record<string, unknown>;
  for (const layer of layers) {
    if (layer.type === 'background') {
      const bg = (layer.paint as Record<string, unknown> | undefined)?.['background-color'];
      if (typeof bg === 'string') styleMeta.cuberootOfmBackground = bg;
      layer.paint = { ...(layer.paint ?? {}), 'background-color': 'rgba(0,0,0,0)' };
    } else if (theme === 'dark' && layer.type === 'symbol') {
      // OFM dark 自带的 text-color 太暗，统一提亮；halo 加深以保证在亮/暗地物上都可读
      const paint = (layer.paint ?? {}) as Record<string, unknown>;
      if ('text-color' in paint) {
        layer.paint = {
          ...paint,
          'text-color': '#F0F3F6',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.3,
        };
      }
    }
  }
  style.metadata = styleMeta;

  return style;
}

const TW_CUSTOM_LABEL = 'tw-custom-label';
const TW_CUSTOM_SOURCE = 'tw-custom';

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

  const ownLayers = new Set<string>([...UPCOMING_LAYERS, ...CUBER_LAYERS, TW_CUSTOM_LABEL, 'country-wr-count']);
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

  // 移动端：禁止整个页面 pinch-zoom，只允许地图自身缩放
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) return;
    const original = meta.content;
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    return () => { meta.content = original; };
  }, []);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (window.localStorage.getItem('globeTheme') as Theme) ?? 'dark';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('globeTheme', theme);
  }, [theme]);

  // 地图投影：2D (mercator) / 3D (globe)。无 WebGL2 强制 mercator。
  const [projection, setProjection] = useState<MapProjection>(() => {
    if (typeof window === 'undefined') return 'globe';
    const stored = window.localStorage.getItem('globeProjection');
    if (stored === 'mercator' || stored === 'globe') {
      if (stored === 'globe' && !hasWebGL2) return 'mercator';
      return stored;
    }
    return hasWebGL2 ? 'globe' : 'mercator';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('globeProjection', projection);
  }, [projection]);
  const projectionRef = useRef<MapProjection>(projection);
  useEffect(() => { projectionRef.current = projection; }, [projection]);

  // 密度可视化风格：A=scale / B=heat / C=country
  const [densityStyle, setDensityStyle] = useState<DensityStyle>(() => {
    if (typeof window === 'undefined') return 'scale';
    const v = window.localStorage.getItem('globeDensityStyle');
    return (v === 'heat' || v === 'country' || v === 'scale') ? v : 'scale';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('globeDensityStyle', densityStyle);
  }, [densityStyle]);
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
  const [skippedComps, setSkippedComps] = useState<{ id: string; name?: string }[]>([]);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  // cuber 模式子视图:'arc' = 大圆弧轨迹 + 密度泡泡;'pillar' = 隐藏轨迹,纯立体柱状
  const [cuberView, setCuberView] = useState<'arc' | 'pillar'>('arc');
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── 自定义控件 state ──
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  // 手机端状态栏槽位（stats / coords 二选一，点击切换；桌面端两者并排显示）
  const [mobileSlot, setMobileSlot] = useState<'stats' | 'coords'>('stats');
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [navPopoverOpen, setNavPopoverOpen] = useState(false);
  const navPopoverRef = useRef<HTMLDivElement | null>(null);

  // ── 本地化映射 ──
  // upcoming_comps.json: id → {name_zh, city_zh}（仅追踪选手参赛的未来 CN 比赛，~数百条）
  // comp_names_zh.json: 英文名 → 中文名（cubing.com 爬的全部中国历史+未来 CN 比赛，~674 条）
  const [nameZhMap, setNameZhMap] = useState<Map<string, { name_zh?: string; city_zh?: string }> | null>(null);
  const [compNameEnToZh, setCompNameEnToZh] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!isZh) return;
    if (!nameZhMap) {
      fetch('/stats/upcoming_comps.json')
        .then(r => r.ok ? r.json() : null)
        .then((d: { competitions?: Array<{ id: string; name_zh?: string; city_zh?: string }> } | null) => {
          if (!d?.competitions) return;
          const m = new Map<string, { name_zh?: string; city_zh?: string }>();
          for (const c of d.competitions) {
            if (c.name_zh || c.city_zh) m.set(c.id, { name_zh: c.name_zh, city_zh: c.city_zh });
          }
          setNameZhMap(m);
        }).catch(() => { /* */ });
    }
    if (!compNameEnToZh) {
      fetch('/stats/comp_names_zh.json')
        .then(r => r.ok ? r.json() : null)
        .then((d: Record<string, string> | null) => { if (d) setCompNameEnToZh(d); })
        .catch(() => { /* */ });
    }
  }, [isZh, nameZhMap, compNameEnToZh]);

  // 中文页面下比赛名：1) upcoming_comps.json 的 id→name_zh；2) comp_names_zh.json 的英文名→中文名；3) OpenCC 简化已含 CJK 的名；4) 兜底英文
  // 显示前再剥掉 "WCA "（display-only，搜索不走这里）
  const localizeCompName = useCallback((id: string, name: string): string => {
    if (!name) return name;
    const resolved = (() => {
      if (!isZh) return name;
      const zh1 = nameZhMap?.get(id)?.name_zh;
      if (zh1) return zh1;
      const zh2 = compNameEnToZh?.[name];
      if (zh2) return zh2;
      if (CJK_RE.test(name)) { try { return openccT2S(name); } catch { /* */ } }
      return name;
    })();
    return stripWcaPrefix(resolved);
  }, [isZh, nameZhMap, compNameEnToZh]);
  // MapLibre popup 回调是一次性注册的闭包——通过 ref 读最新 localizeCompName
  const localizeCompNameRef = useRef(localizeCompName);
  useEffect(() => { localizeCompNameRef.current = localizeCompName; }, [localizeCompName]);

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
    const raw = searchQuery.trim();
    const q = raw.toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const matches: CompResult[] = [];
    const isHit = (name: string, city: string): boolean => {
      if (name.toLowerCase().includes(q)) return true;
      if (city.toLowerCase().includes(q)) return true;
      if (compNameZh(name).includes(raw)) return true;
      if (city && localizeCity(city, true).includes(raw)) return true;
      return false;
    };
    for (const c of (comps ?? [])) {
      if (isHit(c.name, c.city)) {
        seen.add(c.id);
        matches.push({ id: c.id, name: c.name, city: c.city, country: c.country, lng: c.longitude_degrees, lat: c.latitude_degrees, date: c.start_date, tag: 'upcoming' });
      }
    }
    for (const c of (pastComps ?? [])) {
      if (seen.has(c.id)) continue;
      // 多地代码（XW/XA/...）没坐标，搜到也飞不过去 — 跳过
      if (c.latitude_degrees == null || c.longitude_degrees == null) continue;
      if (isHit(c.name, c.city)) {
        matches.push({ id: c.id, name: c.name, city: c.city, country: c.country, lng: c.longitude_degrees, lat: c.latitude_degrees, date: c.start_date, tag: 'past' });
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
  // 多地代码（XW/XA/...）lat/lng = null,Globe 用不上,直接跳过
  const filteredPast = useMemo(() => {
    if (!pastComps) return [];
    const [y0, y1] = yearRange;
    const effectiveMin = y0 === HISTORY_MIN_YEAR ? HISTORY_ABSOLUTE_MIN : y0;
    return pastComps.filter((c): c is PastCompRecord & { latitude_degrees: number; longitude_degrees: number } => {
      if (c.latitude_degrees == null || c.longitude_degrees == null) return false;
      const y = Number(c.start_date.slice(0, 4));
      return y >= effectiveMin && y <= y1;
    });
  }, [pastComps, yearRange]);

  // 密度 C（country choropleth）：按 ISO_A2 聚合每国比赛数（含 past 叠加）
  // 注：TW（Chinese Taipei）计入 CN，choropleth 着色时 TW 多边形也用 CN 同色
  const countryCounts = useMemo(() => {
    const m = new Map<string, number>();
    const normalize = (cc: string) => cc === 'TW' ? 'CN' : cc;
    for (const c of filteredComps) {
      const cc = normalize(c.country);
      m.set(cc, (m.get(cc) ?? 0) + 1);
    }
    if (includePast) for (const c of filteredPast) {
      const cc = normalize(c.country);
      m.set(cc, (m.get(cc) ?? 0) + 1);
    }
    return m;
  }, [filteredComps, filteredPast, includePast]);

  // 国家边界 geojson（懒加载，country style 或 wr 模式时拉取）
  // 注入 CN 领土主张补丁：藏南（Arunachal Pradesh）+ 阿克赛钦（Aksai Chin）
  // Natural Earth 110m 把这两块归印度；国内视角按 PRC 立场合并上色
  // 精确多边形来源：Natural Earth 10m disputed areas 数据集（public domain）
  const [countriesGeojson, setCountriesGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    const need = densityStyle === 'country' || mode === 'wr';
    if (!need || countriesGeojson) return;
    Promise.all([
      fetch('/countries-110m.geojson').then(r => r.json()),
      fetch('/cn_disputed_patches.geojson').then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] })),
    ])
      .then(([base, patches]: [GeoJSON.FeatureCollection, GeoJSON.FeatureCollection]) => {
        // 补丁加到 features 末尾——MapLibre 同层内按顺序渲染，后画的盖前面
        setCountriesGeojson({ ...base, features: [...base.features, ...(patches.features ?? [])] });
      })
      .catch((e) => console.warn('countries-110m load failed', e));
  }, [densityStyle, mode, countriesGeojson]);

  // ── WR 模式数据（按国家 + 年份累计）──
  type WrData = {
    id: string;
    years: number[];
    cumulative: Record<string, number[]>;
  };
  const [wrData, setWrData] = useState<WrData | null>(null);
  useEffect(() => {
    if (mode !== 'wr' || wrData) return;
    fetch('/stats/world_records_by_country.json')
      .then(r => r.json())
      .then((d: WrData) => setWrData(d))
      .catch((e) => console.warn('wr data load failed', e));
  }, [mode, wrData]);

  // wrYear：null 表示"最新"（自动等于 years 末元素）
  const [wrYear, setWrYear] = useState<number | null>(null);
  const [wrPlaying, setWrPlaying] = useState(false);
  // slider 左端固定从 2002 起（WCA 2003 复办前几乎无数据，拖到最左时 cumulative 仍含 1982 早年 WR）
  const wrMinYear = 2002;
  const wrMaxYear = wrData?.years[wrData.years.length - 1] ?? new Date().getFullYear();
  const effectiveWrYear = wrYear ?? wrMaxYear;

  // 名称 → ISO_A2 映射：先从 geojson NAME/NAME_LONG/FORMAL_EN/ADMIN 抽，再合并手工别名
  const WR_NAME_ALIASES: Record<string, string> = useMemo(() => ({
    'United States': 'US',
    'Republic of Korea': 'KR',
    'Korea, Republic of': 'KR',
    'Chinese Taipei': 'CN',
    'Hong Kong': 'HK',
    'Hong Kong, China': 'HK',
    'Singapore': 'SG',
    'Macau': 'MO',
    'Russia': 'RU',
    'Vietnam': 'VN',
    'Czech Republic': 'CZ',
    'United Kingdom': 'GB',
    'Iran': 'IR',
    'Syria': 'SY',
    'Laos': 'LA',
    'Moldova': 'MD',
    'Bolivia': 'BO',
    'Venezuela': 'VE',
    'Tanzania': 'TZ',
    'Palestine': 'PS',
    'Cote d\u2019Ivoire': 'CI',
    'Ivory Coast': 'CI',
  }), []);
  const wrNameToIso = useMemo(() => {
    const m = new Map<string, string>();
    if (countriesGeojson) {
      for (const f of countriesGeojson.features) {
        const p = (f.properties ?? {}) as Record<string, unknown>;
        const iso = typeof p.ISO_A2 === 'string' ? p.ISO_A2 : '';
        if (!iso || iso === '-99') continue;
        for (const k of ['NAME', 'NAME_LONG', 'FORMAL_EN', 'ADMIN', 'SOVEREIGNT']) {
          const v = p[k];
          if (typeof v === 'string' && !m.has(v)) m.set(v, iso);
        }
      }
    }
    for (const [name, iso] of Object.entries(WR_NAME_ALIASES)) m.set(name, iso);
    return m;
  }, [countriesGeojson, WR_NAME_ALIASES]);

  // 当前年份下每 ISO_A2 的累计 WR 数（TW 归 CN）
  const wrCountryCounts = useMemo<Map<string, number>>(() => {
    if (!wrData) return new Map();
    const idx = wrData.years.indexOf(effectiveWrYear);
    if (idx < 0) return new Map();
    const out = new Map<string, number>();
    for (const [name, cum] of Object.entries(wrData.cumulative)) {
      let iso = wrNameToIso.get(name);
      if (!iso) continue;
      if (iso === 'TW') iso = 'CN';
      const val = cum[idx] ?? 0;
      out.set(iso, (out.get(iso) ?? 0) + val);
    }
    return out;
  }, [wrData, effectiveWrYear, wrNameToIso]);

  // 注入 _count 属性到国家 feature（给 fill-color interpolate 用）
  // mode === 'wr' 用 WR 计数；否则用比赛数。TW 多边形查 CN 的计数，视觉上与 CN 同色
  const countriesEnriched = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!countriesGeojson) return null;
    const source = mode === 'wr' ? wrCountryCounts : countryCounts;
    return {
      ...countriesGeojson,
      features: countriesGeojson.features.map((f) => {
        const iso = (f.properties?.ISO_A2 as string) ?? '';
        const lookupKey = iso === 'TW' ? 'CN' : iso;
        return {
          ...f,
          properties: {
            ...(f.properties ?? {}),
            _count: source.get(lookupKey) ?? 0,
          },
        };
      }),
    };
  }, [countriesGeojson, countryCounts, wrCountryCounts, mode]);

  // 每国一个标签点：从 MultiPolygon 取最大多边形的质心，避免每个岛都挂一个数字
  const countryLabelsGeojson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!countriesGeojson) return null;
    const source = mode === 'wr' ? wrCountryCounts : countryCounts;
    // 注：TW 归 CN 后一个多边形一个点，但 TW 和 CN 作为不同 feature 各自会产出一个点；
    // 两个点都写相同的 _count（CN 的计数），视觉上两块都显示同一数字 —— 可接受
    const ringCentroid = (ring: number[][]): [number, number] => {
      if (ring.length === 0) return [0, 0];
      let sx = 0, sy = 0;
      for (const [x, y] of ring) { sx += x; sy += y; }
      return [sx / ring.length, sy / ring.length];
    };
    const ringBboxArea = (ring: number[][]): number => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      return (maxX - minX) * (maxY - minY);
    };
    const features: GeoJSON.Feature[] = [];
    for (const f of countriesGeojson.features) {
      const iso = (f.properties?.ISO_A2 as string) ?? '';
      // TW 的计数已合并到 CN，TW 多边形只染色不贴标签（避免 "Chinese Taipei" 上方重复数字）
      if (iso === 'TW') continue;
      // CN 领土补丁（藏南 / 阿克赛钦）不单独贴标签——中国主岛已有一个总数
      if (f.properties?._patch) continue;
      const count = source.get(iso) ?? 0;
      if (count <= 0) continue;
      const g = f.geometry as GeoJSON.Geometry;
      let pt: [number, number] | null = null;
      if (g.type === 'Polygon') {
        pt = ringCentroid(g.coordinates[0] as number[][]);
      } else if (g.type === 'MultiPolygon') {
        let bestArea = -1;
        let bestRing: number[][] | null = null;
        for (const poly of g.coordinates) {
          const outer = poly[0] as number[][];
          const area = ringBboxArea(outer);
          if (area > bestArea) { bestArea = area; bestRing = outer; }
        }
        if (bestRing) pt = ringCentroid(bestRing);
      }
      if (!pt) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: { _count: count, _iso: iso },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [countriesGeojson, countryCounts, wrCountryCounts, mode]);

  // WR 播放动画：每 500ms 递增一年，到顶后停止
  useEffect(() => {
    if (!wrPlaying || mode !== 'wr' || !wrData) return;
    const tid = window.setInterval(() => {
      setWrYear(y => {
        const cur = y ?? wrMaxYear;
        if (cur >= wrMaxYear) { setWrPlaying(false); return wrMaxYear; }
        return cur + 1;
      });
    }, 500);
    return () => window.clearInterval(tid);
  }, [wrPlaying, mode, wrData, wrMaxYear]);

  // 同坐标比赛预合并为 1 个 feature：避免 zoom 超过 clusterMaxZoom 后两场完全重叠
  // 只点到一场。stack_count>1 时 feature 属性里塞 stack_comps（JSON 字符串）供 click 展开。
  // includePast 时把 past 也并入同一 source，由 MapLibre 一起聚合（视觉不区分新旧）
  const upcomingGeojson = useMemo(() => {
    type AnyComp = (UpcomingCompRecord | PastCompRecord) & { __past?: boolean };
    const groups = new Map<string, AnyComp[]>();
    const upcomingIds = new Set<string>();
    for (const c of filteredComps) {
      // 不对 upcoming 自身去重：若 all_upcoming_comps.json 里出现同 id 重复，应在上游
      // fetch_upcoming_comps.py 修复（前端静默去重会盖住数据 bug）。这里只记录 id 用于 past 兜底
      upcomingIds.add(c.id);
      const key = `${c.longitude_degrees.toFixed(6)},${c.latitude_degrees.toFixed(6)}`;
      const g = groups.get(key);
      if (g) g.push(c); else groups.set(key, [c]);
    }
    if (includePast) {
      for (const c of filteredPast) {
        // upcoming 和 past 是两个独立数据源，年初刚结束 / 即将开赛的比赛天然会两边都有
        // 这层去重不是在掩盖 bug，而是两份源合并时的合理取舍（以 upcoming 为准）
        if (upcomingIds.has(c.id)) continue;
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
    setSkippedComps([]);
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

    const valid: WcaCompDetail[] = [];
    const skipped: { id: string; name?: string }[] = [];
    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      if (d && typeof d.latitude_degrees === 'number') valid.push(d);
      else skipped.push({ id: sorted[i].id, name: sorted[i].name });
    }
    valid.sort((a, b) => a.start_date.localeCompare(b.start_date));

    // WCA 对"多地比赛"（如 FMC 世界赛、部分线上赛）坐标记为 (0, 0) —— 用上一场的坐标顶上
    // 第一场就是 (0,0) 时没得参考，扔到 skipped
    const patched: WcaCompDetail[] = [];
    let lastLat: number | null = null;
    let lastLng: number | null = null;
    for (const c of valid) {
      const isZero = c.latitude_degrees === 0 && c.longitude_degrees === 0;
      if (isZero) {
        if (lastLat !== null && lastLng !== null) {
          patched.push({ ...c, latitude_degrees: lastLat, longitude_degrees: lastLng });
        } else {
          skipped.push({ id: c.id, name: c.name });
        }
      } else {
        patched.push(c);
        lastLat = c.latitude_degrees;
        lastLng = c.longitude_degrees;
      }
    }

    setCuberComps(patched);
    setSkippedComps(skipped);
    setLoadProgress(null);
    // 如果 URL 里指定了 i= 且合法，用它；否则默认显示完整路径
    const sp = new URLSearchParams(window.location.search);
    const urlI = parseInt(sp.get('i') || '', 10);
    if (Number.isFinite(urlI) && urlI >= 0 && urlI < patched.length) setCurrentIndex(urlI);
    else setCurrentIndex(Math.max(0, patched.length - 1));
  }, []);

  // ── URL 状态：?wcaId=2017WANG01&i=42 ──
  // 首次加载：解析 wcaId → fetchPerson → 进入 cuber 模式（异步链结束前先压住同步效果，避免 URL 闪烁）
  const [urlBootstrapDone, setUrlBootstrapDone] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const wcaId = sp.get('wcaId');
    if (!wcaId) { setUrlBootstrapDone(true); return; }
    setMode('cuber');
    fetchPersonByWcaId(wcaId).then((p) => {
      if (p) { setCuber(p); loadCuberPath(p); }
    }).finally(() => setUrlBootstrapDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步 URL（cuber、currentIndex 变化时 replaceState，不污染历史栈）
  useEffect(() => {
    if (!urlBootstrapDone) return;
    const sp = new URLSearchParams(window.location.search);
    if (mode === 'cuber' && cuber?.wcaId) {
      sp.set('wcaId', cuber.wcaId);
      if (cuberComps.length > 0) sp.set('i', String(currentIndex));
      else sp.delete('i');
    } else {
      sp.delete('wcaId');
      sp.delete('i');
    }
    const qs = sp.toString();
    const nextUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    if (nextUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [mode, cuber, currentIndex, cuberComps.length, urlBootstrapDone]);

  // ── cuber 图层数据 ──
  const cuberPointsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: cuberComps.map((c, i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [c.longitude_degrees, c.latitude_degrees] },
      properties: {
        index: i, id: c.id, name: c.name, city: c.city,
        city_label: localizeCity(c.city, isZh),
        country_iso2: c.country_iso2, start_date: c.start_date, url: c.url,
      },
    })),
  }), [cuberComps, isZh]);

  // 按城市聚合的"已去过"次数 —— 跟时间轴 currentIndex 联动,
  // 同时供 density-circle(轨迹模式)和 pillar(柱状模式)两套渲染共用.
  const cuberCityCounts = useMemo(() => {
    const byKey = new Map<string, { lng: number; lat: number; city: string; iso2: string; count: number }>();
    const upTo = Math.min(currentIndex + 1, cuberComps.length);
    for (let i = 0; i < upTo; i++) {
      const c = cuberComps[i];
      // 同城市可能稍微偏 lat/lng,精度截断到 1 位 ~ 11 km 视为同点
      const key = `${c.longitude_degrees.toFixed(1)},${c.latitude_degrees.toFixed(1)}`;
      const cur = byKey.get(key);
      if (cur) cur.count++;
      else byKey.set(key, {
        lng: c.longitude_degrees, lat: c.latitude_degrees,
        city: c.city, iso2: c.country_iso2, count: 1,
      });
    }
    return [...byKey.values()];
  }, [cuberComps, currentIndex]);

  const cuberDensityGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: cuberCityCounts.map((v) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [v.lng, v.lat] },
      properties: { count: v.count, city: v.city, country_iso2: v.iso2 },
    })),
  }), [cuberCityCounts]);

  // 柱状(fill-extrusion)版本.
  // height 单位 = 米.线性放大让差异醒目:base 300km + 100km/场,clamp 6000km(~半地球).
  // 1 场 = 400km;10 场 = 1300km;50 场 = 5300km;70 场 = clamp 6000km.柱子半径 7km(粗一点更显).
  const cuberPillarGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: cuberCityCounts.map((v) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [buildCirclePolygon(v.lng, v.lat, 7000)],
      },
      properties: {
        count: v.count, city: v.city, country_iso2: v.iso2,
        height: Math.min(6_000_000, 300_000 + v.count * 100_000),
      },
    })),
  }), [cuberCityCounts]);

  // NOTE: 预计算每对相邻 comp 的大圆弧全量坐标（动画 slice 用）
  const cuberArcFullCoords = useMemo<Array<[number, number][]>>(() => {
    const out: Array<[number, number][]> = [];
    for (let i = 0; i < cuberComps.length - 1; i++) {
      const a = cuberComps[i], b = cuberComps[i + 1];
      if (a.latitude_degrees === b.latitude_degrees && a.longitude_degrees === b.longitude_degrees) {
        out.push([]);
        continue;
      }
      out.push(greatCircleArc(
        [a.longitude_degrees, a.latitude_degrees],
        [b.longitude_degrees, b.latitude_degrees],
      ));
    }
    return out;
  }, [cuberComps]);

  // NOTE: 动画进度（0..1），由 requestAnimationFrame 驱动
  const [animProgress, setAnimProgress] = useState(1);
  const prevIndexRef = useRef(0);

  // NOTE: 基于 currentIndex + animProgress 动态构造 arc 特征——最后一条弧按进度 slice
  // year_progress = i / (totalArcs - 1)，用作 line-color 渐变（早→晚 = 冷→暖）
  // 防闪：play loop 推进 currentIndex 时会先渲染一次 "新 currentIndex + 旧 animProgress=1"，
  //       layout effect 随后把 animProgress 拉回 0。为防止这个中间态把全长 leg 推到地图上，
  //       用 prevIndexRef 检测"新 leg 首渲"，强制 p=0。
  const cuberArcsGeojson = useMemo(() => {
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const totalArcs = Math.max(1, cuberArcFullCoords.length);
    const isFreshLeg = currentIndex > prevIndexRef.current;
    const safeProgress = isFreshLeg ? 0 : animProgress;
    for (let i = 0; i < currentIndex; i++) {
      const coords = cuberArcFullCoords[i];
      if (!coords || coords.length < 2) continue;
      const sliceEnd = i === currentIndex - 1
        ? Math.max(2, Math.floor(coords.length * safeProgress))
        : coords.length;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords.slice(0, sliceEnd) },
        properties: {
          index: i,
          year_progress: totalArcs <= 1 ? 1 : i / (totalArcs - 1),
        },
      });
    }
    return { type: 'FeatureCollection' as const, features };
  }, [cuberArcFullCoords, currentIndex, animProgress]);

  // 当前 leg 的"箭头点" —— 取 active 弧的最后一个坐标 + 相对前一个点的 bearing
  const cuberArcTipGeojson = useMemo(() => {
    if (currentIndex < 1) return { type: 'FeatureCollection' as const, features: [] };
    const coords = cuberArcFullCoords[currentIndex - 1];
    if (!coords || coords.length < 2) return { type: 'FeatureCollection' as const, features: [] };
    const isFreshLeg = currentIndex > prevIndexRef.current;
    const safeProgress = isFreshLeg ? 0 : animProgress;
    const sliceEnd = Math.max(2, Math.floor(coords.length * safeProgress));
    const tip = coords[sliceEnd - 1];
    const prev = coords[sliceEnd - 2];
    // bearing：从 prev 指向 tip 的真北方位角（0=北，顺时针）
    const toRad = Math.PI / 180;
    const lat1 = prev[1] * toRad, lat2 = tip[1] * toRad;
    const dLng = (tip[0] - prev[0]) * toRad;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    let lng = tip[0];
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lng, tip[1]] },
        properties: { bearing },
      }],
    };
  }, [cuberArcFullCoords, currentIndex, animProgress]);

  // ── Map 初始化：实例只在挂载时建一次；theme 变化通过 setStyle 替换样式 ──
  // 全局事件和 layer-scoped 事件只绑一次；addSource/addLayer 每次 style.load 重跑（setStyle 会清空）
  const themeRef = useRef<Theme>(theme);
  useEffect(() => { themeRef.current = theme; }, [theme]);
  const appliedThemeRef = useRef<Theme | null>(null);
  const themeSeqRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    ensureZhTileProtocol();

    const initialTheme = themeRef.current;
    const styleUrl = mapStyleUrl(initialTheme);
    let cancelled = false;
    let map: maplibregl.Map | null = null;
    (async () => {
      const style: maplibregl.StyleSpecification = initialTheme === 'satellite'
        ? buildSatelliteStyle()
        : await buildSimplifiedStyle(styleUrl as string, initialTheme).catch(() => styleUrl as unknown as maplibregl.StyleSpecification);
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
      appliedThemeRef.current = initialTheme;
      wireMap(map);
    })();

    function wireMap(map: maplibregl.Map) {
    let layerEventsWired = false;
    const onStyleLoad = () => {
      try { map.setProjection({ type: projectionRef.current }); } catch { /* old */ }
      patchMapStyle(map, isZhRef.current);
      addOverlays(map);
      if (!layerEventsWired) {
        wireLayerEvents(map);
        layerEventsWired = true;
      }
      mapLoadedRef.current = true;
      setMapLoaded(true);
    };
    map.on('style.load', onStyleLoad);
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

    function addOverlays(map: maplibregl.Map) {
      const curTheme = themeRef.current;
      const empty = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;

      // 注入一张全球覆盖的 earth-base 多边形作为不透明陆地基底（仅 vector 主题）
      // 球外（背景已透明）→ 露出 CSS 星空；球面 → 这层兜底，水/陆细节叠加在它之上
      // satellite 模式跳过：raster 影像本身就是不透明全覆盖
      if (curTheme !== 'satellite') {
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
        const currentStyle = map.getStyle();
        const styleLayers = currentStyle.layers ?? [];
        const firstNonBgId = styleLayers.find(l => l.type !== 'background')?.id;
        const ofmBg = (currentStyle.metadata as Record<string, unknown> | undefined)?.cuberootOfmBackground;
        const earthBaseColor = typeof ofmBg === 'string'
          ? ofmBg
          : (curTheme === 'dark' ? '#272E3C' : '#F5F2E8');
        map.addLayer({
          id: 'earth-base',
          type: 'fill',
          source: 'earth-base',
          paint: { 'fill-color': earthBaseColor, 'fill-antialias': false },
        }, firstNonBgId);
      }

      // upcoming source & layers
      // clusterProperties.stack_total 累加 feature 的 stack_count（同坐标预合并后的真实比赛数），
      // past source & layers — 先加，渲染在底层；upcoming 总是叠在上面更醒目
      // NOTE: 14k 点依赖 MapLibre cluster 性能；clusterMaxZoom/Radius 和 upcoming 保持一致
      map.addSource('past-comps', {
        type: 'geojson', data: empty,
        cluster: true, clusterMaxZoom: 10, clusterRadius: 70,
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
        layout: {
          'visibility': 'none',
          'text-field': ['to-string', ['get', 'point_count']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
          // 相邻簇数字重叠时：大数字优先，小数字被挤掉
          'symbol-sort-key': ['-', 0, ['get', 'point_count']],
          'text-padding': 40,
        },
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
        type: 'geojson', data: empty,
        cluster: true, clusterMaxZoom: 10, clusterRadius: 70,
        clusterProperties: {
          stack_total: ['+', ['get', 'stack_count']],
        },
      });
      // 密度 B（heat）：独立的 raw source（不聚合），供 heatmap 层使用
      map.addSource('comps-raw', {
        type: 'geojson', data: empty,
        cluster: false,
      });
      map.addLayer({
        id: 'comps-heatmap', type: 'heatmap', source: 'comps-raw',
        maxzoom: 4,
        layout: { 'visibility': 'none' },
        paint: {
          // 压低峰值：中等密度停在橙/黄区，不会全顶到饱和红
          'heatmap-weight': ['interpolate', ['linear'],
            ['log10', ['max', 1, ['to-number', ['get', 'stack_count'], 1]]],
            0, 0.15, 1, 0.35, 2, 0.6, 3, 0.8,
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 2, 0.7, 4, 1.0],
          // 纯暖色 + 透明渐变：低密度完全透明，不再蒙蓝雾
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(255, 237, 160, 0)',
            0.1,  'rgba(255, 237, 160, 0.3)',
            0.3,  'rgb(254, 217, 118)',
            0.5,  'rgb(253, 141, 60)',
            0.7,  'rgb(227, 26, 28)',
            1,    'rgb(122, 0, 0)',
          ],
          // 缩小低 zoom 的扩散半径 + 加 zoom 2 转折防止单点糊一大团
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 2, 20, 4, 35],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.85, 3.5, 0.7, 4, 0],
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
        layout: {
          'text-field': ['to-string', ['get', 'stack_total']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
          // 相邻簇数字重叠时：大数字优先，小数字被挤掉
          'symbol-sort-key': ['-', 0, ['get', 'stack_total']],
          'text-padding': 40,
        },
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
        layout: {
          'text-field': ['to-string', ['get', 'stack_count']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'symbol-sort-key': ['-', 0, ['get', 'stack_count']],
          'text-padding': 35,
        },
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
      map.addSource(CUBER_SOURCE_POINTS, { type: 'geojson', data: empty });
      map.addSource(CUBER_SOURCE_DENSITY, { type: 'geojson', data: empty });
      // 按城市聚合的"参赛次数"密度泡泡 — 半径 ∝ log10(count),压在所有 cuber 视觉之下做底
      map.addLayer({
        id: CUBER_LAYER_DENSITY, type: 'circle', source: CUBER_SOURCE_DENSITY,
        layout: { 'visibility': 'none' },
        paint: {
          'circle-color': '#E07752',
          'circle-opacity': 0.42,
          'circle-radius': [
            'interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', 'count'], 1]]],
            0, 8,    // 1 场
            0.5, 14, // ~3 场
            1, 22,   // 10 场
            1.5, 32, // ~32 场
            2, 44,   // 100+
          ],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.55,
        },
      });
      map.addLayer({
        id: CUBER_LAYER_DENSITY_LABEL, type: 'symbol', source: CUBER_SOURCE_DENSITY,
        layout: {
          'visibility': 'none',
          'text-field': ['to-string', ['get', 'count']],
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', 'count'], 1]]],
            0, 10, 1, 13, 2, 16,
          ],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#8B3E1F',
          'text-halo-width': 1.5,
        },
      });
      // 柱状(fill-extrusion)模式 — 每个城市一个圆形 polygon,height 按 √count 拉高
      map.addSource(CUBER_SOURCE_PILLAR, { type: 'geojson', data: empty });
      map.addLayer({
        id: CUBER_LAYER_PILLAR_FILL, type: 'fill-extrusion', source: CUBER_SOURCE_PILLAR,
        layout: { 'visibility': 'none' },
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', 'count'], 1]]],
            0, '#FFEDA0',   // 1 场 — 柔黄
            0.5, '#FEB24C', // 3 场
            1, '#F03B20',   // 10 场
            1.5, '#BD0026', // 32 场
            2, '#7A0023',   // 100+
          ] as unknown as string,
          'fill-extrusion-opacity': 0.85,
          'fill-extrusion-height': ['get', 'height'] as unknown as number,
          'fill-extrusion-base': 0,
        },
      });
      map.addSource(CUBER_SOURCE_ARCS, { type: 'geojson', data: empty });
      map.addLayer({
        id: CUBER_LAYER_ARC, type: 'line', source: CUBER_SOURCE_ARCS,
        layout: { 'visibility': 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#C15F3C', // 占位，真正的渐变在下方 effect 里 setPaintProperty
          'line-width': 2,
          'line-opacity': 0.85,
        },
      });
      // 当前 leg 的"箭头" —— 落在弧的前端（跟随 animProgress 移动）
      map.addSource(CUBER_SOURCE_ARC_TIP, { type: 'geojson', data: empty });
      map.addLayer({
        id: CUBER_LAYER_ARC_ARROW, type: 'symbol', source: CUBER_SOURCE_ARC_TIP,
        layout: {
          'visibility': 'none',
          'symbol-placement': 'point',
          'text-field': '▲',
          'text-font': ['Noto Sans Regular'],
          'text-size': 18,
          'text-rotate': ['get', 'bearing'],
          'text-rotation-alignment': 'map',
          'text-pitch-alignment': 'map',
          'text-keep-upright': false,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#E63E1A',
          'text-halo-width': 2.5,
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
      // 当前比赛的城市名（强制显示，避免被其他 label 遮挡）
      map.addLayer({
        id: CUBER_LAYER_CITY, type: 'symbol', source: CUBER_SOURCE_POINTS,
        layout: {
          'visibility': 'none',
          'text-field': ['get', 'city_label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 13,
          'text-offset': [0, -1.6],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#C15F3C', 'text-halo-color': '#FFFFFF', 'text-halo-width': 2 },
      });

      // ── 绘制工具图层（测量 / 路径 / 多边形）──
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
    }

    // Layer-scoped 事件一次性绑定（setStyle 后对同名 layer 继续生效）
    function wireLayerEvents(map: maplibregl.Map) {
      // 触屏检测：(hover: none) 在 iOS/Android 默认 true，在桌面（即使带触屏）默认 false
      const isTouch = window.matchMedia('(hover: none)').matches;

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
        const url = typeof p.url === 'string' ? p.url : '';
        if (isTouch) {
          // 手机端：第一次点 → 显示带可点击链接的 popup，不直接跳转
          const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
          const city = String(p.city ?? '');
          const localized = localizeCompNameRef.current(String(p.id ?? ''), String(p.name ?? ''));
          const safeName = localized.replace(/</g, '&lt;');
          const html = `<div class="mlp">
            <a class="mlp-name mlp-name-link" href="${url}" target="_blank" rel="noopener noreferrer">${popupFlagHtml(String(p.country ?? ''))} ${safeName}</a>
            <div class="mlp-meta">${city}<br><span class="mlp-date">${formatDateRangeIso(String(p.start_date), String(p.end_date))}</span></div>
          </div>`;
          if (popupRef.current) popupRef.current.remove();
          popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 12 })
            .setLngLat(coords)
            .setHTML(html)
            .addTo(map);
          return;
        }
        // 桌面端：保持原行为，直接新标签页打开
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'unclustered-point', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        // 触屏不显示 hover popup（避免和点击 popup 互相覆盖）
        if (isTouch) return;
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        if (popupRef.current) popupRef.current.remove();
        const stackCount = typeof p.stack_count === 'number' ? p.stack_count : 1;
        const zh = isZhRef.current;
        const city = String(p.city ?? '');
        const iso2 = String(p.country ?? '');
        const localizedName = localizeCompNameRef.current(String(p.id ?? ''), String(p.name ?? '')).replace(/</g, '&lt;');
        const html = stackCount > 1
          ? `<div class="mlp"><div class="mlp-name">${popupFlagHtml(iso2)} ${zh ? `${stackCount} 场比赛` : `${stackCount} competitions`}</div><div class="mlp-meta">${city}</div></div>`
          : `<div class="mlp"><div class="mlp-name">${popupFlagHtml(iso2)} ${localizedName}</div><div class="mlp-meta">${city}<br><span class="mlp-date">${formatDateRangeIso(String(p.start_date), String(p.end_date))}</span></div></div>`;
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);
      });
      map.on('mouseleave', 'unclustered-point', () => {
        if (isTouch) return;
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
        const city = String(p.city ?? '');
        const iso2 = String(p.country ?? '');
        const dateStr = formatDateRangeIso(String(p.start_date), String(p.end_date));
        const pastLocalized = localizeCompNameRef.current(String(p.id ?? ''), String(p.name ?? '')).replace(/</g, '&lt;');
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(`<div class="mlp"><div class="mlp-name">${popupFlagHtml(iso2)} ${pastLocalized}</div><div class="mlp-meta">${city}<br><span class="mlp-date">${dateStr}</span></div></div>`)
          .addTo(map);
      });
      map.on('mouseleave', 'past-unclustered-point', () => {
        map.getCanvas().style.cursor = '';
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      });

      // cuber 交互（hover tooltip + click 跳转，行为与 unclustered-point 一致）
      map.on('mouseenter', CUBER_LAYER_DOT, (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        if (isTouch) return;
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
        if (popupRef.current) popupRef.current.remove();
        const cuberLocalized = localizeCompNameRef.current(String(p.id ?? ''), String(p.name ?? '')).replace(/</g, '&lt;');
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })
          .setLngLat(coords)
          .setHTML(`<div class="mlp"><div class="mlp-name">${popupFlagHtml(String(p.country_iso2 ?? ''))} #${Number(p.index) + 1} ${cuberLocalized}</div><div class="mlp-meta">${p.city_label ?? p.city ?? ''}<br><span class="mlp-date">${p.start_date}</span></div></div>`)
          .addTo(map);
      });
      map.on('mouseleave', CUBER_LAYER_DOT, () => {
        if (isTouch) return;
        map.getCanvas().style.cursor = '';
        if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      });
      map.on('click', CUBER_LAYER_DOT, (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        if (drawModeRef.current !== 'none') return;
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        const url = p.url || `https://www.worldcubeassociation.org/competitions/${p.id ?? ''}`;
        if (isTouch) {
          // 手机端：第一次点 → 弹 popup，比赛名为可点击链接
          const coords = (f.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
          const safeName = localizeCompNameRef.current(String(p.id ?? ''), String(p.name ?? '')).replace(/</g, '&lt;');
          const html = `<div class="mlp">
            <a class="mlp-name mlp-name-link" href="${url}" target="_blank" rel="noopener noreferrer">${popupFlagHtml(String(p.country_iso2 ?? ''))} #${Number(p.index) + 1} ${safeName}</a>
            <div class="mlp-meta">${p.city_label ?? p.city ?? ''}<br><span class="mlp-date">${p.start_date}</span></div>
          </div>`;
          if (popupRef.current) popupRef.current.remove();
          popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 12 })
            .setLngLat(coords)
            .setHTML(html)
            .addTo(map);
          return;
        }
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });
    }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── theme 切换：保留 map 实例，只替换样式（瓦片缓存 / 相机 / overlay 数据都不丢）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return; // 初次挂载时 map 尚未异步建好；init effect 会用正确 theme 创建
    if (appliedThemeRef.current === theme) return;
    const seq = ++themeSeqRef.current;
    mapLoadedRef.current = false;
    setMapLoaded(false);
    (async () => {
      const styleUrl = mapStyleUrl(theme);
      const newStyle: maplibregl.StyleSpecification = theme === 'satellite'
        ? buildSatelliteStyle()
        : await buildSimplifiedStyle(styleUrl as string, theme).catch(() => styleUrl as unknown as maplibregl.StyleSpecification);
      if (seq !== themeSeqRef.current) return;
      const live = mapRef.current;
      if (!live) return;
      live.setStyle(newStyle, { diff: true });
      appliedThemeRef.current = theme;
      // style.load 会触发 onStyleLoad → 重加 overlay → mapLoaded flip true → 下游 effect 重跑
    })();
  }, [theme]);

  // ── 推送 upcoming 数据 ──
  // NOTE: mapLoaded 在 deps 里：若数据先于 map load 抵达，也会在 load 完后再推一次
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('comps') as GeoJSONSource | undefined;
    if (src) src.setData(upcomingGeojson as unknown as GeoJSON.FeatureCollection);
    // heatmap 用的原始（未聚合）source 同步更新
    const rawSrc = map.getSource('comps-raw') as GeoJSONSource | undefined;
    if (rawSrc) rawSrc.setData(upcomingGeojson as unknown as GeoJSON.FeatureCollection);
  }, [upcomingGeojson, mapLoaded]);

  // ── 推送 past 数据 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('past-comps') as GeoJSONSource | undefined;
    if (src) src.setData(pastGeojson as unknown as GeoJSON.FeatureCollection);
  }, [pastGeojson, mapLoaded]);

  // ── 密度风格切换：paint + visibility + zoom-range ──
  // scale  : clusters 用 log 连续色阶 + 连续半径，unclustered 同理；heatmap/country 层隐藏
  // heat   : zoom<4 只显 heatmap，zoom>=4 切回 clusters（同 scale 样式）
  // country: choropleth 底色可见；clusters 恢复阶梯色（避免 cluster 太醒目盖过底色）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const safeSetPaint = (id: string, prop: string, val: unknown) => {
      if (!map.getLayer(id)) return;
      try { map.setPaintProperty(id, prop, val as string); } catch { /* */ }
    };
    const safeSetVis = (id: string, visible: boolean) => {
      if (!map.getLayer(id)) return;
      try { map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); } catch { /* */ }
    };
    const safeSetZoomRange = (id: string, min: number, max: number) => {
      if (!map.getLayer(id)) return;
      try { map.setLayerZoomRange(id, min, max); } catch { /* */ }
    };

    if (densityStyle === 'scale' || densityStyle === 'heat') {
      safeSetPaint('clusters', 'circle-color', makeCountColorRamp('stack_total'));
      safeSetPaint('clusters', 'circle-radius', makeCountRadiusRamp('stack_total'));
      safeSetPaint('unclustered-point', 'circle-color', makeCountColorRamp('stack_count'));
      safeSetPaint('unclustered-point', 'circle-radius', makeCountRadiusRamp('stack_count'));
    } else {
      // country: 回到原阶梯色，不抢 choropleth 视觉
      safeSetPaint('clusters', 'circle-color', STEP_COLOR_CLUSTER);
      safeSetPaint('clusters', 'circle-radius', STEP_RADIUS_CLUSTER);
      safeSetPaint('unclustered-point', 'circle-color', STEP_COLOR_POINT);
      safeSetPaint('unclustered-point', 'circle-radius', STEP_RADIUS_POINT);
    }

    // heatmap 层可见性 + cluster 层 zoom range（非 upcoming 模式强制隐藏）
    const isUpcoming = mode === 'upcoming';
    safeSetVis('comps-heatmap', isUpcoming && densityStyle === 'heat');
    if (isUpcoming && densityStyle === 'heat') {
      UPCOMING_LAYERS.forEach((id) => safeSetZoomRange(id, 4, 24));
    } else {
      UPCOMING_LAYERS.forEach((id) => safeSetZoomRange(id, 0, 24));
    }

    // 数据稀疏（仅 upcoming，~500 点）时显著提升 weight/intensity，避免 heatmap 淡到看不见
    // 含 past（~14k+）时回到温和配置，避免过度饱和
    const dense = includePast;
    safeSetPaint('comps-heatmap', 'heatmap-weight',
      dense
        ? ['interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', 'stack_count'], 1]]],
            0, 0.15, 1, 0.35, 2, 0.6, 3, 0.8]
        : ['interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', 'stack_count'], 1]]],
            0, 0.5, 1, 0.9, 2, 1.2, 3, 1.4],
    );
    safeSetPaint('comps-heatmap', 'heatmap-intensity',
      dense
        ? ['interpolate', ['linear'], ['zoom'], 0, 0.4, 2, 0.7, 4, 1.0]
        : ['interpolate', ['linear'], ['zoom'], 0, 1.0, 2, 1.4, 4, 1.8],
    );
    safeSetPaint('comps-heatmap', 'heatmap-radius',
      dense
        ? ['interpolate', ['linear'], ['zoom'], 0, 12, 2, 20, 4, 35]
        : ['interpolate', ['linear'], ['zoom'], 0, 18, 2, 28, 4, 42],
    );

    // country fill 可见性 + 透明度（satellite 下降低避免过盖）
    // upcoming+country style 或 wr 模式都显示
    safeSetVis('country-fill', (isUpcoming && densityStyle === 'country') || mode === 'wr');
    const fillOp = theme === 'satellite' ? 0.28 : theme === 'light' ? 0.42 : 0.4;
    safeSetPaint('country-fill', 'fill-opacity', fillOp);
    // WR 数字标签：仅 wr 模式显示
    safeSetVis('country-wr-count', mode === 'wr');
  }, [densityStyle, mapLoaded, theme, mode, includePast]);

  // ── 密度 C（country）：按需添加/更新 countries source + country-fill layer ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !countriesEnriched) return;
    const existing = map.getSource('countries') as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(countriesEnriched);
      return;
    }
    map.addSource('countries', { type: 'geojson', data: countriesEnriched });
    // 加在 clusters 下方（choropleth 是底色，cluster 圆点盖在上面）
    const beforeId = map.getLayer('clusters') ? 'clusters' : undefined;
    // 第一次添加时直接按当前 mode/densityStyle 决定是否可见，避免等下一次 density effect 才生效
    const initialVis = ((mode === 'upcoming' && densityStyle === 'country') || mode === 'wr') ? 'visible' : 'none';
    map.addLayer({
      id: 'country-fill',
      type: 'fill',
      source: 'countries',
      layout: { 'visibility': initialVis },
      paint: {
        'fill-color': ['interpolate', ['linear'],
          ['log10', ['max', 1, ['to-number', ['get', '_count'], 1]]],
          0, 'rgba(255, 237, 160, 0)',  // 0 个 → 完全透明
          0.3, '#FFEDA0',
          1, '#FEB24C',
          2, '#F03B20',
          3, '#4A0000',
        ] as unknown as maplibregl.ExpressionSpecification,
        'fill-opacity': 0.4,
        'fill-outline-color': 'rgba(255, 255, 255, 0.2)',
      },
    }, beforeId);
    // WR 模式下每国显示 WR 数量（仅 _count > 0），在 country-fill 之上
    // 用独立 Point source，每国只有一个标签点（取 MultiPolygon 最大子多边形的质心）
    const wrLabelInitialVis = mode === 'wr' ? 'visible' : 'none';
    if (!map.getSource('country-labels')) {
      map.addSource('country-labels', {
        type: 'geojson',
        data: countryLabelsGeojson ?? { type: 'FeatureCollection', features: [] },
      });
    }
    map.addLayer({
      id: 'country-wr-count',
      type: 'symbol',
      source: 'country-labels',
      layout: {
        'visibility': wrLabelInitialVis,
        'text-field': ['to-string', ['get', '_count']],
        'text-font': ['Noto Sans Regular'],
        // MapLibre 限制：zoom 表达式必须是 text-size 顶层；在每个 zoom 站点内嵌一个按 _count 的 interpolate
        // 效果：数值越大字号越大（log10 轴），整体再随 zoom 线性放大
        'text-size': [
          'interpolate', ['linear'], ['zoom'],
          0, ['interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', '_count'], 1]]],
               0, 8, 1, 10, 2, 13, 3, 16],
          3, ['interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', '_count'], 1]]],
               0, 10, 1, 13, 2, 17, 3, 22],
          6, ['interpolate', ['linear'], ['log10', ['max', 1, ['to-number', ['get', '_count'], 1]]],
               0, 14, 1, 18, 2, 23, 3, 28],
        ],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': 'rgba(0, 0, 0, 0.85)',
        'text-halo-width': 1.5,
      },
    }, beforeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countriesEnriched, mapLoaded]);

  // country-labels 源数据随 mode/年份 更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('country-labels') as GeoJSONSource | undefined;
    if (src && countryLabelsGeojson) src.setData(countryLabelsGeojson);
  }, [countryLabelsGeojson, mapLoaded]);

  // ── 推送 cuber 数据 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const ptsSrc = map.getSource(CUBER_SOURCE_POINTS) as GeoJSONSource | undefined;
    const arcSrc = map.getSource(CUBER_SOURCE_ARCS) as GeoJSONSource | undefined;
    const tipSrc = map.getSource(CUBER_SOURCE_ARC_TIP) as GeoJSONSource | undefined;
    const denSrc = map.getSource(CUBER_SOURCE_DENSITY) as GeoJSONSource | undefined;
    const pilSrc = map.getSource(CUBER_SOURCE_PILLAR) as GeoJSONSource | undefined;
    if (ptsSrc) ptsSrc.setData(cuberPointsGeojson as unknown as GeoJSON.FeatureCollection);
    if (arcSrc) arcSrc.setData(cuberArcsGeojson as unknown as GeoJSON.FeatureCollection);
    if (tipSrc) tipSrc.setData(cuberArcTipGeojson as unknown as GeoJSON.FeatureCollection);
    if (denSrc) denSrc.setData(cuberDensityGeojson as unknown as GeoJSON.FeatureCollection);
    if (pilSrc) pilSrc.setData(cuberPillarGeojson as unknown as GeoJSON.FeatureCollection);
  }, [cuberPointsGeojson, cuberArcsGeojson, cuberArcTipGeojson, cuberDensityGeojson, cuberPillarGeojson, mapLoaded]);

  // ── cuber 弧线渐变上色（按 year_progress）──
  // 独立 effect 便于 HMR 调色，且确保 layer 存在后再 set
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try {
      map.setPaintProperty(CUBER_LAYER_ARC, 'line-color', [
        'interpolate', ['linear'], ['to-number', ['get', 'year_progress'], 0],
        0,    '#3F8FE0',  // 早期：亮蓝
        0.33, '#7FBF6F',  // 早中：青绿
        0.66, '#E8B23F',  // 中后：金黄
        1,    '#E63E1A',  // 近期：火红
      ] as unknown as string);
    } catch { /* layer 还未加 */ }
  }, [mapLoaded, mode]);

  // ── 当前 leg（正在画的那条）加粗 + 轻微高亮 ──
  // 箭头由独立 source 驱动（cuberArcTipGeojson），无需 setFilter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || mode !== 'cuber') return;
    const activeIdx = currentIndex - 1; // 当前正在推进的弧 = 到达 currentIndex 的那条
    try {
      map.setPaintProperty(CUBER_LAYER_ARC, 'line-width', [
        'case', ['==', ['get', 'index'], activeIdx], 4, 2,
      ] as unknown as number);
      map.setPaintProperty(CUBER_LAYER_ARC, 'line-opacity', [
        'case', ['==', ['get', 'index'], activeIdx], 1, 0.7,
      ] as unknown as number);
    } catch { /* */ }
  }, [mapLoaded, mode, currentIndex]);

  // ── 语言切换时重新 patch 地图 label ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;
    patchMapStyle(map, isZh);
  }, [isZh]);

  // ── 图层可见性切换 + 当前高亮 / filter ──
  // NOTE: mapLoaded 在 deps 里 — theme 切换会 setMapLoaded(false→true)，需要 re-run 把 cuber/upcoming layer 的 visibility 重新打开
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const show = (ids: string[], v: boolean) => {
      for (const id of ids) {
        // 先 getLayer 检查——有些层（country-fill / country-wr-count）是懒加载
        // 否则 setLayoutProperty 会 console.error 再抛（虽然被 try 吞，但日志仍噪音）
        if (!map.getLayer(id)) continue;
        try { map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none'); } catch { /* */ }
      }
    };
    show(UPCOMING_LAYERS, mode === 'upcoming');
    // past 已经合并进 upcoming source，past-* 图层不再单独显示
    show(PAST_LAYERS, false);
    // cuber 子视图按 cuberView 区分;count 标签两种模式都显示.
    show(CUBER_LAYERS_ARC_VIEW, mode === 'cuber' && cuberView === 'arc');
    show(CUBER_LAYERS_PILLAR_VIEW, mode === 'cuber' && cuberView === 'pillar');
    show([CUBER_LAYER_DENSITY_LABEL], mode === 'cuber');
    // country-fill：在 upcoming + country style 或 wr 模式下可见
    show(['country-fill'], (mode === 'upcoming' && densityStyle === 'country') || mode === 'wr');
    show(['country-wr-count'], mode === 'wr');
  }, [mode, cuberView, densityStyle, includePast, mapLoaded]);

  // ── cuber 模式下：dot/label filter（按 index 显示）+ 高亮当前点 + flyTo ──
  // NOTE: 动画中（arc 未到达终点）时，终点 B 还未显示，等弧线到达时才出现
  // mapLoaded 在 deps 里 — theme 切换后需要重新 setFilter/setPaintProperty
  const animating = animProgress < 1;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || mode !== 'cuber') return;

    const visibleMax = animating ? currentIndex - 1 : currentIndex;
    const filter: maplibregl.FilterSpecification = ['<=', ['get', 'index'], visibleMax];
    try { map.setFilter(CUBER_LAYER_DOT, filter); } catch { /* */ }
    // 城市名仅显示在"当前"那一点
    try {
      map.setFilter(CUBER_LAYER_CITY,
        ['==', ['get', 'index'], visibleMax] as unknown as maplibregl.FilterSpecification);
    } catch { /* */ }

    try {
      map.setPaintProperty(CUBER_LAYER_DOT, 'circle-color',
        ['case', ['==', ['get', 'index'], visibleMax], '#C15F3C', '#8B3E1F'] as unknown as string);
      map.setPaintProperty(CUBER_LAYER_DOT, 'circle-radius',
        ['case', ['==', ['get', 'index'], visibleMax], 10, 5] as unknown as number);
    } catch { /* */ }
  }, [currentIndex, mode, animating, mapLoaded]);

  // 判断坐标是否在当前视口的"安心可见区"（内缩 15%）—— 用于 cuber path 动画时避免不必要的转地球
  const isInComfortableView = useCallback((lng: number, lat: number): boolean => {
    const map = mapRef.current;
    if (!map) return false;
    try {
      const b = map.getBounds();
      const w = b.getEast() - b.getWest();
      const h = b.getNorth() - b.getSouth();
      // 跨 antimeridian 时 w 会为负，强制 flyTo
      if (w <= 0) return false;
      const m = 0.15;
      return lng >= b.getWest() + w * m
        && lng <= b.getEast() - w * m
        && lat >= b.getSouth() + h * m
        && lat <= b.getNorth() - h * m;
    } catch {
      return false;
    }
  }, []);

  // ── Arc 动画 + flyTo 同步 ──
  // 只在 currentIndex 恰好 +1（即 play loop 推进）时启动动画；scrub / 初始加载直接跳
  // 比赛点已在屏幕里时跳过 easeTo（防止头晕）
  // 用 useLayoutEffect 保证 setAnimProgress(0) 在 paint 前执行，避免新 arc 短暂闪现满长度
  useLayoutEffect(() => {
    if (mode !== 'cuber') return;
    const prev = prevIndexRef.current;
    const delta = currentIndex - prev;
    const cur = cuberComps[currentIndex];

    if (delta !== 1) {
      setAnimProgress(1);
      prevIndexRef.current = currentIndex;
      if (cur && !isInComfortableView(cur.longitude_degrees, cur.latitude_degrees)) {
        mapRef.current?.easeTo({
          center: [cur.longitude_degrees, cur.latitude_degrees],
          duration: 400,
        });
      }
      return;
    }

    // 前进一步 → 动画（立即更新 prev，防止 play loop 连发时 delta 漂移）
    prevIndexRef.current = currentIndex;
    setAnimProgress(0);
    const duration = 500 / speed;
    const start = performance.now();

    // 让相机沿着大圆弧同步走，避免 easeTo 直线插值导致的"超远距离时视角和路径分家"
    const arcCoords = cuberArcFullCoords[currentIndex - 1];
    const prevComp = cuberComps[currentIndex - 1];
    const needTrack = !!cur && (
      !isInComfortableView(cur.longitude_degrees, cur.latitude_degrees) ||
      (!!prevComp && !isInComfortableView(prevComp.longitude_degrees, prevComp.latitude_degrees))
    );

    // 长距离弧线：先抛物线缩小再放大，让两端在动画中段都能看到（类似 flyTo）
    const startZoom = mapRef.current?.getZoom() ?? 2.4;
    let dipZoom: number | null = null;
    if (needTrack && cur && prevComp) {
      const distKm = haversineKm(
        [prevComp.longitude_degrees, prevComp.latitude_degrees],
        [cur.longitude_degrees, cur.latitude_degrees],
      );
      // > 2500 km 才启用 zoom dip；映射 2500km→不变, 8000km→1.5, 18000km→0.7
      if (distKm > 2500) {
        const target = Math.max(0.7, Math.min(startZoom, 3 - Math.log10(distKm / 1000) * 1.4));
        if (target < startZoom - 0.2) dipZoom = target;
      }
    }

    let rafId = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setAnimProgress(p);
      if (needTrack && arcCoords && arcCoords.length >= 2) {
        const ix = Math.min(arcCoords.length - 1, Math.round(p * (arcCoords.length - 1)));
        let lng = arcCoords[ix][0];
        const lat = arcCoords[ix][1];
        while (lng > 180) lng -= 360;
        while (lng < -180) lng += 360;
        // 抛物线 zoom：sin(πp) 在中点最大（1），两端为 0
        const zoom = dipZoom !== null
          ? startZoom + (dipZoom - startZoom) * Math.sin(Math.PI * p)
          : undefined;
        mapRef.current?.jumpTo({ center: [lng, lat], ...(zoom !== undefined ? { zoom } : {}) });
      }
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [currentIndex, mode, cuberComps, speed, isInComfortableView, cuberArcFullCoords]);

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

  // 投影切换：在已存在的 map 上 live 切换 mercator↔globe（保留 center/zoom/pitch/bearing）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try { map.setProjection({ type: projection }); } catch { /* */ }
  }, [projection, mapLoaded]);

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

  // ── 信息卡可拖动（pointer events 兼容鼠标 / 触屏，位置存 localStorage）──
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem('globeCuberCardPos');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const cardDragRef = useRef<{ dx: number; dy: number; pid: number } | null>(null);
  const onCardPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const tgt = e.target as HTMLElement;
    // 让 button / a / input 内部 pointer 不触发拖动
    if (tgt.closest('button, a, input, select, textarea')) return;
    // 点在 .is-selectable 文本段内：让浏览器正常处理选择/复制，不触发拖动
    if (tgt.closest('.is-selectable')) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    cardDragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      pid: e.pointerId,
    };
    card.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);
  const onCardPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = cardDragRef.current;
    if (!drag || drag.pid !== e.pointerId) return;
    const card = cardRef.current;
    if (!card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    let left = e.clientX - drag.dx;
    let top = e.clientY - drag.dy;
    // 钳到视口内（留 4px 边距）
    left = Math.max(4, Math.min(window.innerWidth - w - 4, left));
    top = Math.max(4, Math.min(window.innerHeight - h - 4, top));
    setCardPos({ left, top });
  }, []);
  const onCardPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = cardDragRef.current;
    if (!drag || drag.pid !== e.pointerId) return;
    cardDragRef.current = null;
    cardRef.current?.releasePointerCapture(e.pointerId);
  }, []);
  // 持久化位置
  useEffect(() => {
    if (cardPos) {
      try { window.localStorage.setItem('globeCuberCardPos', JSON.stringify(cardPos)); } catch { /* */ }
    }
  }, [cardPos]);
  // 窗口缩放时把卡片钳回视口
  useEffect(() => {
    const onResize = () => {
      const card = cardRef.current;
      if (!card || !cardPos) return;
      const w = card.offsetWidth, h = card.offsetHeight;
      const left = Math.max(4, Math.min(window.innerWidth - w - 4, cardPos.left));
      const top = Math.max(4, Math.min(window.innerHeight - h - 4, cardPos.top));
      if (left !== cardPos.left || top !== cardPos.top) setCardPos({ left, top });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [cardPos]);

  // 当前 leg 故事数据：与上一场的距离 + 间隔天数
  const prevComp = currentIndex > 0 ? cuberComps[currentIndex - 1] : null;
  const legKm = prevComp && currentComp
    ? haversineKm(
        [prevComp.longitude_degrees, prevComp.latitude_degrees],
        [currentComp.longitude_degrees, currentComp.latitude_degrees],
      )
    : 0;
  const legDays = prevComp && currentComp
    ? Math.max(0, Math.round((Date.parse(currentComp.start_date) - Date.parse(prevComp.start_date)) / 86400000))
    : 0;

  return (
    <div className={`globe-page is-${theme}`}>
      <div className="starfield" aria-hidden="true" ref={starfieldRef} />

      <div className={`globe-topbar ${mode === 'cuber' ? 'is-cuber' : ''}`}>
        {mode === 'cuber' ? (
          <>
            <button className="cuber-back-btn" onClick={() => { setPlaying(false); setMode('upcoming'); }} title={isZh ? '返回工具栏' : 'Back to toolbar'} aria-label="Back">
              <ArrowLeft size={16} strokeWidth={1.75} />
            </button>
            {cuber && (
              <div className="cuber-chip">
                {flagIso2 && <Flag iso2={flagIso2} className="cuber-flag" />}
                <span className="cuber-name">{displayCuberName(cuber.name, isZh)}</span>
                <button className="cuber-clear" onClick={clearCuber} aria-label="Clear">
                  <X size={14} strokeWidth={1.75} />
                </button>
              </div>
            )}
            {!cuber && (
              <button className="cuber-change-btn" onClick={() => setPickerOpen(true)}>
                {t('globe.selectCuber')}
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
                  className="cuber-step-btn"
                  onClick={() => { setPlaying(false); setCurrentIndex((i) => Math.max(0, i - 1)); }}
                  disabled={currentIndex <= 0}
                  aria-label={isZh ? '上一场' : 'Previous'}
                  title={isZh ? '上一场' : 'Previous'}
                >
                  <ChevronLeft size={14} strokeWidth={1.75} />
                </button>
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
                <button
                  className="cuber-step-btn"
                  onClick={() => { setPlaying(false); setCurrentIndex((i) => Math.min(cuberComps.length - 1, i + 1)); }}
                  disabled={currentIndex >= cuberComps.length - 1}
                  aria-label={isZh ? '下一场' : 'Next'}
                  title={isZh ? '下一场' : 'Next'}
                >
                  <ChevronRight size={14} strokeWidth={1.75} />
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
                <div className="cuber-view-toggle" title={isZh ? '视图切换' : 'View'}>
                  <button
                    className={`view-btn ${cuberView === 'arc' ? 'is-active' : ''}`}
                    onClick={() => setCuberView('arc')}
                  >{isZh ? '轨迹' : 'Trail'}</button>
                  <button
                    className={`view-btn ${cuberView === 'pillar' ? 'is-active' : ''}`}
                    onClick={() => setCuberView('pillar')}
                  >{isZh ? '柱状' : 'Pillar'}</button>
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
          </>
        ) : (<>
        <Link to="/calendar" className="globe-logo-link" title={t('globe.backToCalendar') as string} aria-label="Home">
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
            <ClearButton
              onClick={() => { setSearchQuery(''); setPlaceResults([]); }}
            />
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
                      {localizeCompName(c.id, c.name)}
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
          {/* 此分支里 mode !== 'cuber'（外层三元分支的 else），cuber 按钮恒不激活 */}
          <button role="tab" aria-selected={false}
            className="range-btn"
            onClick={() => { setMode('cuber'); if (!cuber) setPickerOpen(true); }}>
            {t('globe.modeCuber')}
          </button>
          <button role="tab" aria-selected={mode === 'upcoming'}
            className={`range-btn ${mode === 'upcoming' ? 'is-active' : ''}`}
            onClick={() => setMode('upcoming')}>
            {t('globe.modeComps')}
          </button>
          <button role="tab" aria-selected={mode === 'wr'}
            className={`range-btn ${mode === 'wr' ? 'is-active' : ''}`}
            onClick={() => setMode('wr')}>
            {t('globe.modeWr')}
          </button>
        </div>
        {mode === 'upcoming' && (
          <div className="density-style-picker" role="tablist" title={isZh ? '密度显示风格' : 'Density style'}>
            {(['scale', 'heat', 'country'] as DensityStyle[]).map((s) => {
              const Icon = s === 'scale' ? Layers : s === 'heat' ? Flame : Globe;
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={densityStyle === s}
                  className={`density-btn ${densityStyle === s ? 'is-active' : ''}`}
                  onClick={() => setDensityStyle(s)}
                  title={t(`globe.density_${s}`) as string}
                  aria-label={t(`globe.density_${s}`) as string}
                >
                  <Icon size={14} strokeWidth={1.75} className="density-btn-icon" />
                  <span className="density-btn-label">{t(`globe.density_${s}`)}</span>
                </button>
              );
            })}
          </div>
        )}
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
        {mode === 'wr' && wrData && (
          <div className="wr-year-bar">
            <button
              type="button"
              className="wr-year-play"
              onClick={() => {
                if (wrPlaying) { setWrPlaying(false); return; }
                // 到头了按播放 → 从最左重新开始
                if (effectiveWrYear >= wrMaxYear) setWrYear(wrMinYear);
                setWrPlaying(true);
              }}
              title={t('globe.wrPlay') as string}
              aria-label={t('globe.wrPlay') as string}
            >
              {wrPlaying ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
            </button>
            <input
              type="range"
              className="wr-year-slider"
              min={wrMinYear}
              max={wrMaxYear}
              step={1}
              value={effectiveWrYear}
              onChange={(e) => { setWrPlaying(false); setWrYear(Number(e.target.value)); }}
              aria-label="WR year"
            />
            <span className="wr-year-label">{t('globe.wrYearLabel', { year: effectiveWrYear })}</span>
          </div>
        )}

        <LangToggle className="topbar-lang" />
        </>)}
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

      {mode === 'cuber' && !loadProgress && cuberComps.length > 0 && currentComp && (
        <div
          className={`cuber-info-card ${cardPos ? 'is-dragged' : ''}`}
          ref={cardRef}
          onPointerDown={onCardPointerDown}
          onPointerMove={onCardPointerMove}
          onPointerUp={onCardPointerUp}
          onPointerCancel={onCardPointerUp}
          style={cardPos ? { left: cardPos.left, top: cardPos.top, right: 'auto', bottom: 'auto' } : undefined}
        >
          <div className="cuber-step-count">{t('globe.step', { current: currentIndex + 1, total: cuberComps.length })}</div>
          <div className="cuber-step-name is-selectable">
            {currentComp.country_iso2 && <Flag iso2={currentComp.country_iso2} className="cuber-step-flag" />}
            <span>{localizeCompName(currentComp.id, currentComp.name)}</span>
          </div>
          <div className="cuber-step-meta is-selectable">{(nameZhMap?.get(currentComp.id)?.city_zh && isZh) ? nameZhMap.get(currentComp.id)!.city_zh : localizeCity(currentComp.city, isZh)}, {countryName(currentComp.country_iso2, isZh)} · {currentComp.start_date}</div>
          {prevComp && (
            <div className="cuber-step-leg is-selectable">
              {fmtDistance(legKm, isZh)} · {isZh ? `距上场 ${legDays} 天` : `${legDays}d since prev`}
            </div>
          )}
          {skippedComps.length > 0 && cuber && (
            <div className="cuber-skipped">
              <span title={skippedComps.map(s => s.name || s.id).join('\n')}>
                {isZh ? `${skippedComps.length} 场未加载` : `${skippedComps.length} not loaded`}
              </span>
              <button
                className="cuber-skipped-retry"
                onClick={() => loadCuberPath(cuber)}
                title={isZh ? '重试' : 'Retry'}
              >↻</button>
            </div>
          )}
        </div>
      )}

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
          </div>
        )}
        <div className="map-controls-bar">
          <button
            className={`map-ctrl-btn ${navPopoverOpen ? 'is-active' : ''}`}
            onClick={() => setNavPopoverOpen((v) => !v)}
            title={isZh ? '朝向与俯仰' : 'Heading and tilt controls'}
            aria-label="Heading and tilt"
            aria-expanded={navPopoverOpen}
          ><Compass size={14} strokeWidth={1.75} /></button>
          <button
            className="map-ctrl-btn"
            disabled={!hasWebGL2 && projection === 'mercator'}
            onClick={() => setProjection(p => p === 'globe' ? 'mercator' : 'globe')}
            title={
              !hasWebGL2 && projection === 'mercator'
                ? (isZh ? '当前浏览器不支持 3D 地球（需要 WebGL2）' : '3D globe requires WebGL2 (unsupported)')
                : projection === 'globe'
                  ? (isZh ? '切换到 2D' : 'Switch to 2D')
                  : (isZh ? '切换到 3D' : 'Switch to 3D')
            }
            aria-label={projection === 'globe' ? 'Switch to 2D' : 'Switch to 3D'}
          >{projection === 'globe'
            ? <MapIcon size={14} strokeWidth={1.75} />
            : <Globe2 size={14} strokeWidth={1.75} />
          }</button>
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
          <span className="globe-statusbar-attrib">
            <span className="globe-statusbar-attrib-trigger">ⓘ {isZh ? '数据来源' : 'attributions'}</span>
            <span className="globe-statusbar-attrib-tip">
              {theme === 'satellite'
                ? <>© <a href="https://nasa.gov" target="_blank" rel="noopener noreferrer">NASA</a> Blue Marble · <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a>, <a href="https://www.maxar.com" target="_blank" rel="noopener noreferrer">Maxar</a>, Earthstar Geographics · labels © <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · stars © <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">Solar System Scope</a> CC BY 4.0</>
                : <>© <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · stars © <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">Solar System Scope</a> CC BY 4.0</>
              }
            </span>
          </span>
        </div>
        <div
          className={`globe-statusbar-right is-${mobileSlot}`}
          onClick={() => setMobileSlot((s) => (s === 'stats' ? 'coords' : 'stats'))}
          title={isZh ? '点击切换显示' : 'tap to switch'}
        >
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


      {error && <div className="globe-error">{error}</div>}
      {mode === 'upcoming' && !comps && !error && <div className="globe-loading">{t('globe.loading')}</div>}

      <div ref={containerRef} className="map-canvas" />

      {selectedComps && selectedComps.length > 0 && (
        <div className="bin-panel-overlay" onClick={() => setSelectedComps(null)}>
          <div className="bin-panel" onClick={(ev) => ev.stopPropagation()}>
            <button className="bin-panel-close" onClick={() => setSelectedComps(null)} aria-label="Close">×</button>
            <h2 className="bin-panel-title">
              {selectedComps.length === 1
                ? <a href={selectedComps[0].url} target="_blank" rel="noopener noreferrer" className="bin-panel-title-link"><Flag iso2={selectedComps[0].country} className="bin-panel-flag" />{localizeCompName(selectedComps[0].id, selectedComps[0].name)}</a>
                : (isZh ? `${selectedComps.length} 场比赛` : `${selectedComps.length} competitions`)}
            </h2>
            <div className="bin-panel-list">
              {selectedComps.map((c, idx) => (
                // NOTE: 故意用 idx 后缀 —— 上游若出现同 id 重复，React key 仍然唯一不报警，
                // 但视觉上两行依然可见（数据重复本身是上游 bug，我们不在前端静默去重）
                <div key={`${c.id}-${idx}`} className="bin-panel-item">
                  {selectedComps.length > 1 && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="bin-panel-item-title">
                      <Flag iso2={c.country} className="bin-panel-flag" />
                      {localizeCompName(c.id, c.name)}
                    </a>
                  )}
                  <div className="bin-panel-meta">
                    {c.city} · {formatDateRangeIso(c.start_date, c.end_date)}
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
