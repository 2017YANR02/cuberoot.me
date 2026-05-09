// 点亮城市 tab:react-globe.gl 3D 地球(已在依赖)+ 列表视图.
// lat/lng 来自 stats/all_past_comps.json,加载一次缓存(浏览器 fetch + localStorage).

import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Flag } from '../../../../utils/flag';
import { countryName } from '../../../../utils/country_name';
import { buildLitFromComps, type CompGeoIndex } from '../logic/lit_cities';
import type { WcaCompetition } from '../wca_api';

const Globe = lazy(async () => {
  const mod = await import('react-globe.gl');
  return { default: mod.default };
});

interface Props {
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

interface PastComp {
  id: string;
  city: string;
  country: string;
  latitude_degrees?: number;
  longitude_degrees?: number;
}

type View = 'globe' | 'list';

export default function LitCitiesTab({ comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [view, setView] = useState<View>('globe');
  const [geo, setGeo] = useState<CompGeoIndex | null>(null);

  useEffect(() => {
    let cancel = false;
    const KEY = 'wca:past-comp-geo:v1';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const idx = parseGeo(JSON.parse(raw));
        if (!cancel) setGeo(idx);
      }
    } catch { /* ignore */ }
    fetch('/stats/all_past_comps.json')
      .then((r) => r.json())
      .then((arr: PastComp[]) => {
        if (cancel) return;
        try { localStorage.setItem(KEY, JSON.stringify(arr.map((c) => ({
          id: c.id, lat: c.latitude_degrees, lng: c.longitude_degrees, country: c.country, city: c.city,
        })))); } catch { /* quota */ }
        setGeo(parseGeo(arr));
      })
      .catch(() => { /* network — leave geo null,city map shows count only */ });
    return () => { cancel = true; };
  }, []);

  const lit = useMemo(() => {
    if (!comps) return null;
    return buildLitFromComps(comps, geo);
  }, [comps, geo]);

  if (!comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;
  if (lit && lit.cities.length === 0) return <div className="wp-empty">{t('暂无比赛足迹', 'No competition footprint')}</div>;

  return (
    <div className="wp-lit">
      <div className="wp-lit-toolbar">
        <button
          className={`wp-toggle-btn ${view === 'globe' ? 'is-active' : ''}`}
          onClick={() => setView('globe')}
        >{t('地图', 'Map')}</button>
        <button
          className={`wp-toggle-btn ${view === 'list' ? 'is-active' : ''}`}
          onClick={() => setView('list')}
        >{t('列表', 'List')}</button>
      </div>

      {view === 'globe' && lit && (
        <div className="wp-lit-globe">
          <Suspense fallback={<div className="wp-loading-inline">{t('加载地球…', 'Loading globe…')}</div>}>
            <CitiesGlobe cities={lit.cities} />
          </Suspense>
        </div>
      )}

      {view === 'list' && lit && (
        <div className="wp-table-scroll">
          <table className="wp-lit-table">
            <thead>
              <tr>
                <th>{t('国家 / 地区', 'Country')}</th>
                <th>{t('城市', 'City')}</th>
                <th className="wp-cell-num">{t('参赛次数', 'Comps')}</th>
              </tr>
            </thead>
            <tbody>
              {lit.cities.map((c) => (
                <tr key={`${c.iso2}-${c.city}`}>
                  <td className="wp-cell-comp">
                    <Flag iso2={c.iso2} className="wp-flag-sm" />
                    <span>{c.iso2 ? countryName(c.iso2, isZh) : '—'}</span>
                  </td>
                  <td>{c.city}</td>
                  <td className="wp-cell-num">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function parseGeo(arr: { id: string; lat?: number; lng?: number; latitude_degrees?: number; longitude_degrees?: number; country?: string; city?: string }[]): CompGeoIndex {
  const idx = new Map<string, { lat: number; lng: number; country_iso2: string; city: string }>();
  for (const c of arr) {
    const lat = c.lat ?? c.latitude_degrees ?? Number.NaN;
    const lng = c.lng ?? c.longitude_degrees ?? Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    idx.set(c.id, {
      lat, lng,
      country_iso2: '',  // 这里只用 lat/lng;iso2 直接走 comps 自身
      city: c.city ?? '',
    });
  }
  return { index: idx };
}

interface GlobeCity { iso2: string; city: string; count: number; lat: number; lng: number }

function CitiesGlobe({ cities }: { cities: GlobeCity[] }) {
  const points = cities
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => ({
      lat: c.lat, lng: c.lng,
      label: `${c.city} · ${c.count}`,
      mag: Math.log2(c.count + 1),
    }));
  const maxMag = Math.max(0.5, ...points.map((p) => p.mag));
  // dynamic import for ssr-safety
  const G = Globe as unknown as React.ComponentType<Record<string, unknown>>;
  return (
    <div style={{ width: '100%', height: 480, position: 'relative' }}>
      <G
        width={960}
        height={480}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereColor="#76a8d8"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: { mag: number }) => 0.02 + (d.mag / maxMag) * 0.18}
        pointRadius={0.4}
        pointColor={() => '#C15F3C'}
        pointLabel="label"
      />
    </div>
  );
}
