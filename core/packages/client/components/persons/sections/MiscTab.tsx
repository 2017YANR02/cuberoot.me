'use client';
// 杂项 tab:最亲密魔友(同场比赛最多)/ 见过的魔友(同场次数分布)/ 去过的省份(中国按省,国外按国家).
// 前两个走后端 /v1/wca/person-misc(SQL over wca_results_flat);省份用 comps + 静态 comp→省份表客户端算.
// 复刻 cubingchina results/p 的 closestCubers / seenCubers / visitedProvinces.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/AppLink';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/cuber-name-display';
import { fetchWcaPersonMisc } from '@/lib/wca-person-api';
import type { WcaPersonMisc, WcaPersonProfile, WcaCompetition } from '@/lib/wca-person-api';
import { buildRegionStats } from '../logic/person-misc-region';

interface Props {
  profile: WcaPersonProfile;
  comps: WcaCompetition[] | null;
  isZh: boolean;
}

export default function MiscTab({ profile, comps, isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const wcaId = profile.person.wca_id;
  const [misc, setMisc] = useState<WcaPersonMisc | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMisc(null);
    setErr(false);
    fetchWcaPersonMisc(wcaId)
      .then((m) => { if (!cancelled) setMisc(m); })
      .catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, [wcaId]);

  const regions = useMemo(() => (comps ? buildRegionStats(comps, isZh) : null), [comps, isZh]);

  const loading = <div className="wp-loading-inline">{t('加载中…', 'Loading…')}</div>;

  return (
    <div className="wp-misc">
      {/* 最亲密魔友 */}
      <section className="wp-misc-col">
        <h3 className="wp-misc-title">{t('最亲密魔友', 'Closest cubers')}</h3>
        {err ? <div className="wp-empty">{t('加载失败', 'Failed to load')}</div>
          : !misc ? loading
          : misc.closest.length === 0 ? <div className="wp-empty">{t('暂无数据', 'No data')}</div>
          : (
            <table className="wp-misc-table">
              <thead>
                <tr>
                  <th>{t('选手', 'Cuber')}</th>
                  <th className="wp-cell-num">{t('参赛次数', 'Shared')}</th>
                </tr>
              </thead>
              <tbody>
                {misc.closest.map((p) => (
                  <tr key={p.wcaId}>
                    <td className="wp-misc-cuber">
                      <Link href={`/wca/persons/${p.wcaId}`} prefetch={false}>{displayCuberName(p.name, isZh)}</Link>
                    </td>
                    <td className="wp-cell-num">{p.shared}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>

      {/* 见过的魔友 */}
      <section className="wp-misc-col">
        <h3 className="wp-misc-title">{t('见过的魔友', 'Cubers met')}</h3>
        {err ? <div className="wp-empty">{t('加载失败', 'Failed to load')}</div>
          : !misc ? loading
          : misc.distribution.length === 0 ? <div className="wp-empty">{t('暂无数据', 'No data')}</div>
          : (
            <table className="wp-misc-table">
              <thead>
                <tr>
                  <th className="wp-cell-num">{t('次数', 'Times')}</th>
                  <th className="wp-cell-num">{t('魔友', 'Cubers')}</th>
                </tr>
              </thead>
              <tbody>
                {misc.distribution.map((d) => (
                  <tr key={d.shared}>
                    <td className="wp-cell-num">{d.shared}</td>
                    <td className="wp-cell-num">{d.cubers}</td>
                  </tr>
                ))}
                <tr className="wp-misc-total">
                  <td className="wp-cell-num">{t('全部', 'All')}</td>
                  <td className="wp-cell-num">{misc.totalMet}</td>
                </tr>
              </tbody>
            </table>
          )}
      </section>

      {/* 去过的省份 / 国家 */}
      <section className="wp-misc-col">
        <h3 className="wp-misc-title">{t('去过的省份', 'Regions visited')}</h3>
        {!regions ? loading
          : regions.length === 0 ? <div className="wp-empty">{t('暂无数据', 'No data')}</div>
          : (
            <table className="wp-misc-table">
              <thead>
                <tr>
                  <th className="wp-cell-num">{t('次数', 'Comps')}</th>
                  <th>{t('省份 / 地区', 'Region')}</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.key}>
                    <td className="wp-cell-num">{r.count}</td>
                    <td>
                      <span className="wp-misc-region">
                        {r.iso2 ? <Flag iso2={r.iso2} className="wp-flag-sm" /> : null}
                        <span>{r.label}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
    </div>
  );
}
