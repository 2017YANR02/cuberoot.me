// 顶部 hero:头像 + 姓名 + 信息表(国家/性别/WCA ID/比赛次数/复原次数 / 尝试次数).
// 截图样式:头像居中,名字大字,下面 1 行 5 列的信息条.

import { Flag } from '../../../../utils/flag';
import { displayCuberName } from '../../../../utils/name_utils';
import { countryName } from '../../../../utils/country_name';
import type { WcaPersonProfile, WcaResultRow } from '../wca_api';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  isZh: boolean;
}

export default function PersonHero({ profile, results, isZh }: Props) {
  const p = profile.person;
  const displayName = displayCuberName(p.name, isZh);
  const avatarUrl = p.avatar?.thumb_url || p.avatar?.url;
  const t = (zh: string, en: string) => (isZh ? zh : en);

  // 复原次数 / 尝试次数 (排除 DNS / no-result)
  let solves = 0, attempts = 0;
  if (results) {
    for (const r of results) {
      if (!r.attempts) continue;
      for (const a of r.attempts) {
        if (a === 0 || a === -2) continue;
        attempts++;
        if (a > 0) solves++;
      }
    }
  }

  const genderLabel =
    p.gender === 'm' ? t('男', 'M')
    : p.gender === 'f' ? t('女', 'F')
    : t('—', '—');

  return (
    <section className="wp-hero-card">
      <div className="wp-hero-avatar-wrap">
        <div className="wp-hero-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} />
            : <div className="wp-hero-avatar-fb">{(displayName[0] ?? '?').toUpperCase()}</div>}
        </div>
        <h1 className="wp-hero-name">{displayName}</h1>
      </div>

      <div className="wp-hero-table">
        <div className="wp-hero-cell">
          <div className="wp-hero-cell-label">{t('国家 / 地区', 'Country / Region')}</div>
          <div className="wp-hero-cell-value">
            <Flag iso2={p.country_iso2} className="wp-flag" />
            <span>{p.country_iso2 ? countryName(p.country_iso2, isZh) : '—'}</span>
          </div>
        </div>
        <div className="wp-hero-cell">
          <div className="wp-hero-cell-label">{t('性别', 'Gender')}</div>
          <div className="wp-hero-cell-value">{genderLabel}</div>
        </div>
        <div className="wp-hero-cell">
          <div className="wp-hero-cell-label">{t('WCA ID', 'WCA ID')}</div>
          <div className="wp-hero-cell-value">
            <a
              href={`https://www.worldcubeassociation.org/persons/${p.wca_id}`}
              target="_blank" rel="noopener noreferrer"
              className="wp-hero-id-link" title="WCA"
            >
              <img src="https://assets.worldcubeassociation.org/assets/favicon.svg" alt="WCA" width={14} height={14} className="wp-hero-id-favicon" />
            </a>
            <span className="wp-hero-id">{p.wca_id}</span>
          </div>
        </div>
        <div className="wp-hero-cell">
          <div className="wp-hero-cell-label">{t('比赛次数', 'Competitions')}</div>
          <div className="wp-hero-cell-value">
            <span className="wp-pill wp-pill-green">{profile.competition_count}</span>
          </div>
        </div>
        <div className="wp-hero-cell">
          <div className="wp-hero-cell-label">{t('复原次数 / 尝试次数', 'Solves / Attempts')}</div>
          <div className="wp-hero-cell-value">
            <span className="wp-pill wp-pill-blue">{solves}</span>
            <span className="wp-pill-sep">/</span>
            <span className="wp-pill wp-pill-orange">{attempts}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
