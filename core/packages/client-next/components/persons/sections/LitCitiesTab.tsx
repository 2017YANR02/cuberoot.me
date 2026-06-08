'use client';
// 点亮城市 tab:列表 + 跳到 /globe(maplibre 矢量地球,已支持 ?wcaId= 进入 cuber 模式).
// 之前内嵌 react-globe.gl 的 3D 球已废弃 — 体验和 /globe 重复且贴图丑.

import { useMemo } from 'react';
import Link from '@/components/AppLink';
import { Globe2 } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { countryName } from '@/lib/country-name';
import { buildLitFromComps } from '../logic/lit_cities';
import type { WcaCompetition, WcaPersonProfile } from '@/lib/wca-person-api';
import i18n from "@/i18n/i18n-client";

interface Props {
  profile: WcaPersonProfile;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

export default function LitCitiesTab({ profile, comps, isZh }: Props) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);

  const lit = useMemo(() => comps ? buildLitFromComps(comps, null) : null, [comps]);

  if (!comps) return <div className="wp-loading-inline">{t('加载中…', 'Loading…', "載入中…")}</div>;
  if (lit && lit.cities.length === 0) {
    return <div className="wp-empty">{t('暂无比赛足迹', 'No competition footprint', "暫無比賽足跡")}</div>;
  }

  return (
    <div className="wp-lit">
      <div className="wp-lit-banner">
        <Globe2 size={18} className="wp-lit-banner-icon" />
        <span className="wp-lit-banner-text">
          {t(
            '想看 3D 地球 + 时间轴轨迹?',
            'Want a 3D globe with time-axis trail?', "想看 3D 地球 + 時間軸軌跡?"
          )}
        </span>
        <Link
          href={`/wca/comp?view=globe&wcaId=${encodeURIComponent(profile.person.wca_id)}${isZh ? '&lang=zh' : ''}`}
          className="wp-lit-banner-cta"
        >
          {t('在地球上查看', 'Open on Globe', "在地球上檢視")}
        </Link>
      </div>

      {lit && (
        <div className="wp-lit-stats">
          <span><strong>{lit.countries.length}</strong> {t('个国家 / 地区', 'countries', "個國家 / 地區")}</span>
          <span className="wp-text-mute">·</span>
          <span><strong>{lit.cities.length}</strong> {t('座城市', 'cities')}</span>
          <span className="wp-text-mute">·</span>
          <span><strong>{comps.length}</strong> {t('场比赛', 'competitions', "場比賽")}</span>
        </div>
      )}

      {lit && (
        <div className="wp-table-scroll">
          <table className="wp-lit-table">
            <thead>
              <tr>
                <th>{t('国家 / 地区', 'Country', "國家 / 地區")}</th>
                <th>{t('城市', 'City')}</th>
                <th className="wp-cell-num">{t('参赛次数', 'Comps', "參賽次數")}</th>
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
