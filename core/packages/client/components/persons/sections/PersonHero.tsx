// 顶部 hero:头像 + (国旗 + 姓名 + 性别图标) + 名字下方小字 WCA ID + 信息条(比赛次数 / 复原次数 / 尝试次数).
// 头像居中,国旗在名字左侧,WCA ID 左缘与名字左缘对齐.

import { Mars, Venus } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import { Flag } from '@/components/Flag';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useT } from '@/hooks/useT';
import { countryName } from '@/lib/country-name';
import { creatorProfileHrefForWcaId } from '@/lib/creator-profile';
import type { WcaPersonProfile, WcaResultRow, WcaFormerIdentity } from '@/lib/wca-person-api';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  former?: WcaFormerIdentity[];
  isZh: boolean;
  resultView: 'pr' | 'historical' | 'pb';
  onResultViewChange: (view: 'pr' | 'historical' | 'pb') => void;
  inclCancelled: boolean;
  onInclCancelledChange: (value: boolean) => void;
}

export default function PersonHero({
  profile,
  results,
  former,
  isZh,
  resultView,
  onResultViewChange,
  inclCancelled,
  onInclCancelledChange,
}: Props) {
  const p = profile.person;
  // 选手主页展示完整 WCA 名(拉丁名 + 括号内本地名),中英文一致;与 WCA 官网对齐。
  const displayName = p.name;
  const wcaUrl = `https://www.worldcubeassociation.org/persons/${p.wca_id}`;
  const creatorProfileHref = creatorProfileHrefForWcaId(p.wca_id);
  const avatarUrl = p.avatar?.thumb_url || p.avatar?.url;
  const t = useT();
  const resultViewItems = [
    { value: 'pr', label: 'PR' },
    { value: 'historical', label: t('历史最佳排名', 'Historical Best') },
    { value: 'pb', label: 'PB' },
  ] as const;
  const resultViewLabel = resultViewItems.find((item) => item.value === resultView)?.label ?? 'PR';

  const collections = [
    {
      key: 'medals',
      items: [
        { key: 'gold', label: t('金牌', 'Gold'), value: profile.medals.gold },
        { key: 'silver', label: t('银牌', 'Silver'), value: profile.medals.silver },
        { key: 'bronze', label: t('铜牌', 'Bronze'), value: profile.medals.bronze },
      ],
    },
    {
      key: 'records',
      items: [
        { key: 'world', label: 'WR', value: profile.records.world },
        { key: 'continental', label: 'CR', value: profile.records.continental },
        { key: 'national', label: 'NR', value: profile.records.national },
      ],
    },
  ].filter((collection) => collection.items.some((item) => item.value > 0));

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
          {former && former.length > 0 && (
            <div className="wp-hero-former">
              {former.map((f, i) => (
                <span className="wp-hero-former-item" key={i}>
                  ({t('曾经是', 'formerly')} {f.name}{f.iso2 ? ` - ${countryName(f.iso2, isZh)}` : ''})
                </span>
              ))}
            </div>
          )}
          <span className="wp-hero-gender-cell">
            {GenderIcon && (
              <GenderIcon size={18} className={`wp-hero-gender wp-hero-gender-${p.gender}`} aria-label={genderLabel} />
            )}
          </span>
          <div className="wp-hero-id">
            <a href={wcaUrl} target="_blank" rel="noopener noreferrer" className="wp-hero-id-link" title="WCA">{p.wca_id}</a>
            {creatorProfileHref && (
              <>
                <span aria-hidden="true">|</span>
                <AppLink href={creatorProfileHref} prefetch={false} className="wp-hero-id-link">
                  {t('个人介绍', 'Personal profile')}
                </AppLink>
              </>
            )}
          </div>
        </div>
      </div>

      {collections.length > 0 && (
        <div className="wp-hero-collections">
          {collections.map((collection) => (
            <div className={`wp-hero-collection wp-hero-collection-${collection.key}`} key={collection.key}>
              <dl>
                {collection.items.map((item) => (
                  <div className={`wp-hero-collection-item wp-hero-collection-item-${item.key}`} key={item.key}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className="wp-hero-table">
        <div className="wp-hero-cell">
          <div className="wp-hero-cell-label">{t('比赛', 'Competitions')}</div>
          <div className="wp-hero-cell-value">
            <span className="wp-pill">{profile.competition_count}</span>
          </div>
        </div>
        <div className="wp-hero-cell">
          <div className="wp-hero-cell-label">{t('复原 / 尝试', 'Solves / Attempts')}</div>
          <div className="wp-hero-cell-value">
            <span className="wp-pill">{solves}</span>
            <span className="wp-pill-sep">/</span>
            <span className="wp-pill">{attempts}</span>
          </div>
        </div>
      </div>

      <div className="wp-hero-rank-controls">
        <CompactSelect
          value={resultView}
          label={resultViewLabel}
          items={resultViewItems}
          onChange={onResultViewChange}
          ariaLabel={t('成绩视图', 'Results view')}
        />
        {resultView !== 'pb' && (
          <PillToggle
            value={inclCancelled}
            onChange={onInclCancelledChange}
            onLabel={t('废止项', 'Cancelled')}
            offLabel={t('废止项', 'Cancelled')}
          />
        )}
      </div>
    </section>
  );
}
