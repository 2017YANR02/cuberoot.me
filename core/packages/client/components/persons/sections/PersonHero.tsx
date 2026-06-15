// 顶部 hero:头像 + (国旗 + 姓名 + 性别图标) + 名字下方小字 WCA ID + 信息条(比赛次数 / 复原次数 / 尝试次数).
// 头像居中,国旗在名字左侧,WCA ID 左缘与名字左缘对齐.

import { Mars, Venus } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/name-utils';
import { countryName } from '@/lib/country-name';
import type { WcaPersonProfile, WcaResultRow } from '@/lib/wca-person-api';
import i18n from "@/i18n/i18n-client";

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  isZh: boolean;
}

export default function PersonHero({ profile, results, isZh }: Props) {
  const p = profile.person;
  const displayName = displayCuberName(p.name, isZh);
  const wcaUrl = `https://www.worldcubeassociation.org/persons/${p.wca_id}`;
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

  // 性别用 lucide 图标放在名字旁(男 Mars / 女 Venus),其他/未知不显示.
  const GenderIcon = p.gender === 'm' ? Mars : p.gender === 'f' ? Venus : null;
  const genderLabel =
    p.gender === 'm' ? t('男', 'Male')
    : p.gender === 'f' ? t('女', 'Female')
    : '';

  return (
    <section className="wp-hero-card">
      <div className="wp-hero-avatar-wrap">
        <div className="wp-hero-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} />
            : <div className="wp-hero-avatar-fb">{(displayName[0] ?? '?').toUpperCase()}</div>}
        </div>
        <div className="wp-hero-name-row">
          <span className="wp-hero-name-flag" title={p.country_iso2 ? countryName(p.country_iso2, isZh) : undefined}>
            <Flag iso2={p.country_iso2} className="wp-flag" />
          </span>
          <div className="wp-hero-name-line">
            <h1 className="wp-hero-name">
              <a href={wcaUrl} target="_blank" rel="noopener noreferrer" className="wp-hero-name-link" title="WCA">{displayName}</a>
            </h1>
          </div>
          <span className="wp-hero-gender-cell">
            {GenderIcon && (
              <GenderIcon size={18} className={`wp-hero-gender wp-hero-gender-${p.gender}`} aria-label={genderLabel} />
            )}
          </span>
          <div className="wp-hero-id">
            <a href={wcaUrl} target="_blank" rel="noopener noreferrer" className="wp-hero-id-link" title="WCA">{p.wca_id}</a>
          </div>
        </div>
      </div>

      <div className="wp-hero-table">
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
