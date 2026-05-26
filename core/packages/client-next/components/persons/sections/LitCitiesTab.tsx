'use client';
// 点亮城市 tab:列表 + 跳到 /globe(maplibre 矢量地球,已支持 ?wcaId= 进入 cuber 模式).
// 之前内嵌 react-globe.gl 的 3D 球已废弃 — 体验和 /globe 重复且贴图丑.

import { useMemo } from 'react';
import Link from 'next/link';
import { Globe2 } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { countryName } from '@/lib/country-name';
import { buildLitFromComps } from '../logic/lit_cities';
import type { WcaCompetition, WcaPersonProfile } from '@/lib/wca-person-api';

interface Props {
  profile: WcaPersonProfile;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

export default function LitCitiesTab({ profile, comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const lit = useMemo(() => comps ? buildLitFromComps(comps, null) : null, [comps]);

  if (!comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;
  if (lit && lit.cities.length === 0) {
    return <div className="wp-empty">{t('暂无比赛足迹', 'No competition footprint')}</div>;
  }

  return (
    <div className="wp-lit">
      <div className="wp-lit-banner">
        <Globe2 size={18} className="wp-lit-banner-icon" />
        <span className="wp-lit-banner-text">
          {t(
            '想看 3D 地球 + 时间轴轨迹?',
            'Want a 3D globe with time-axis trail?',
          )}
        </span>
        <Link
          href={`/wca/globe?wcaId=${encodeURIComponent(profile.person.wca_id)}${isZh ? '&lang=zh' : ''}`}
          className="wp-lit-banner-cta"
        >
          {t('在地球上查看', 'Open on Globe')}
        </Link>
      </div>

      {lit && (
        <div className="wp-lit-stats">
          <span><strong>{lit.countries.length}</strong> {t('个国家 / 地区', 'countries')}</span>
          <span className="wp-text-mute">·</span>
          <span><strong>{lit.cities.length}</strong> {t('座城市', 'cities')}</span>
          <span className="wp-text-mute">·</span>
          <span><strong>{comps.length}</strong> {t('场比赛', 'competitions')}</span>
        </div>
      )}

      {lit && (
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
                  <td>{c.city || '—'}</td>
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
