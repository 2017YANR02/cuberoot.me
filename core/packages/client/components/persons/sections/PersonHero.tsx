// 顶部 hero:头像 + (国旗 + 姓名 + 性别图标) + 名字下方小字 WCA ID + 信息条(比赛次数 / 复原次数 / 尝试次数).
// 头像居中,国旗在名字左侧,WCA ID 左缘与名字左缘对齐.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mars, Venus } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect } from '@/components/CompactSelect';
import { Flag } from '@/components/Flag';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useT } from '@/hooks/useT';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { countryName } from '@/lib/country-name';
import { creatorProfileHrefForWcaId } from '@/lib/creator-profile';
import { uploadedImageUrl } from '@/lib/image-upload';
import { getPublicMemberProfile, type PublicMemberProfile } from '@/lib/membership-api';
import type { WcaCompetition, WcaPersonProfile, WcaResultRow, WcaFormerIdentity } from '@/lib/wca-person-api';
import { computePrRank, countPersonalRecords } from '../logic/progress';

interface Props {
  profile: WcaPersonProfile;
  results: WcaResultRow[] | null;
  comps: WcaCompetition[] | null;
  former?: WcaFormerIdentity[];
  isZh: boolean;
  resultView: 'pr' | 'historical' | 'pb';
  onResultViewChange: (view: 'pr' | 'historical' | 'pb') => void;
  inclCancelled: boolean;
  onInclCancelledChange: (value: boolean) => void;
  pbVisibilityControl: {
    value: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
  } | null;
}

function AvatarPreview({ src, alt, closeLabel, onClose }: {
  src: string;
  alt: string;
  closeLabel: string;
  onClose: () => void;
}) {
  useModalDismiss(onClose);
  return (
    <button type="button" className="wp-avatar-preview" onClick={onClose} aria-label={closeLabel} autoFocus>
      <img src={src} alt={alt} />
    </button>
  );
}

function MemberIntroDialog({ name, profile, closeLabel, onClose }: {
  name: string;
  profile: PublicMemberProfile;
  closeLabel: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="wp-member-dialog"
      aria-labelledby="wp-member-dialog-title"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}
    >
      <h2 id="wp-member-dialog-title">{name}</h2>
      {profile.intro && <p>{profile.intro}</p>}
      {profile.imageIds.length > 0 && (
        <div className="wp-member-gallery">
          {profile.imageIds.map((id, index) => (
            <img src={uploadedImageUrl(id)} alt={`${name} ${index + 1}`} key={id} />
          ))}
        </div>
      )}
      <button type="button" className="wp-member-dialog-close" onClick={() => ref.current?.close()} autoFocus>{closeLabel}</button>
    </dialog>
  );
}

export default function PersonHero({
  profile,
  results,
  comps,
  former,
  isZh,
  resultView,
  onResultViewChange,
  inclCancelled,
  onInclCancelledChange,
  pbVisibilityControl,
}: Props) {
  const p = profile.person;
  // 选手主页展示完整 WCA 名(拉丁名 + 括号内本地名),中英文一致;与 WCA 官网对齐。
  const displayName = p.name;
  const wcaUrl = `https://www.worldcubeassociation.org/persons/${p.wca_id}`;
  const creatorProfileHref = creatorProfileHrefForWcaId(p.wca_id);
  const avatarUrl = p.avatar?.thumb_url || p.avatar?.url;
  const fullAvatarUrl = p.avatar?.url || avatarUrl;
  const t = useT();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [memberProfile, setMemberProfile] = useState<PublicMemberProfile | null>(null);
  const [memberIntroOpen, setMemberIntroOpen] = useState(false);
  useEffect(() => {
    setMemberProfile(null);
    setMemberIntroOpen(false);
    if (creatorProfileHref) return;
    let cancelled = false;
    getPublicMemberProfile(p.wca_id)
      .then((profile) => { if (!cancelled) setMemberProfile(profile); })
      .catch(() => { /* 会员简介缺失不影响 WCA 人物页 */ });
    return () => { cancelled = true; };
  }, [creatorProfileHref, p.wca_id]);
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
  const prCount = useMemo(
    () => results && comps ? countPersonalRecords(computePrRank(results.filter((r) => !r.live), comps).values()) : 0,
    [results, comps],
  );

  // 性别用 lucide 图标放在名字旁(男 Mars / 女 Venus),其他/未知不显示.
  const GenderIcon = p.gender === 'm' ? Mars : p.gender === 'f' ? Venus : null;
  const genderLabel =
    p.gender === 'm' ? t('男', 'Male')
    : p.gender === 'f' ? t('女', 'Female')
    : '';

  return (
    <section className="wp-hero-card">
      <div className="wp-hero-avatar-wrap">
        {avatarUrl ? (
          <button
            type="button"
            className="wp-hero-avatar wp-hero-avatar-button"
            onClick={() => setAvatarOpen(true)}
            aria-label={t('查看大图', 'View full-size image')}
          >
            <img src={avatarUrl} alt={displayName} />
          </button>
        ) : (
          <div className="wp-hero-avatar">
            <div className="wp-hero-avatar-fb">{(displayName[0] ?? '?').toUpperCase()}</div>
          </div>
        )}
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
            {(creatorProfileHref || memberProfile) && (
              <>
                <span aria-hidden="true">|</span>
                {creatorProfileHref ? (
                  <AppLink href={creatorProfileHref} prefetch={false} className="wp-hero-id-link">
                    {t('个人介绍', 'Personal profile')}
                  </AppLink>
                ) : (
                  <button type="button" className="wp-hero-id-link wp-hero-id-button" onClick={() => setMemberIntroOpen(true)}>
                    {t('个人介绍', 'Personal profile')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {avatarOpen && fullAvatarUrl && (
        <AvatarPreview
          src={fullAvatarUrl}
          alt={displayName}
          closeLabel={t('关闭大图', 'Close full-size image')}
          onClose={() => setAvatarOpen(false)}
        />
      )}

      {memberIntroOpen && memberProfile && (
        <MemberIntroDialog
          name={displayName}
          profile={memberProfile}
          closeLabel={t('关闭', 'Close')}
          onClose={() => setMemberIntroOpen(false)}
        />
      )}

      <div className="wp-hero-rank-controls">
        <CompactSelect
          value={resultView}
          label={resultViewLabel}
          items={resultViewItems}
          onChange={onResultViewChange}
          ariaLabel={t('成绩视图', 'Results view')}
          popupClassName="wp-result-view-popup"
        />
        {resultView !== 'pb' && (
          <PillToggle
            value={inclCancelled}
            onChange={onInclCancelledChange}
            onLabel={t('废止项', 'Cancelled')}
            offLabel={t('废止项', 'Cancelled')}
          />
        )}
        {resultView === 'pb' && pbVisibilityControl && (
          <BoolToggle
            value={pbVisibilityControl.value}
            onChange={pbVisibilityControl.onChange}
            label={t('公开', 'Public')}
            disabled={pbVisibilityControl.disabled}
          />
        )}
      </div>

      {resultView !== 'pb' && (
        <>
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
              <div className="wp-hero-cell-label">PR</div>
              <div className="wp-hero-cell-value"><span className="wp-pill">{prCount}</span></div>
            </div>
            <div className="wp-hero-cell">
              <div className="wp-hero-cell-label">{t('复原', 'Solves')}</div>
              <div className="wp-hero-cell-value"><span className="wp-pill">{solves}</span></div>
            </div>
            <div className="wp-hero-cell">
              <div className="wp-hero-cell-label">{t('尝试', 'Attempts')}</div>
              <div className="wp-hero-cell-value"><span className="wp-pill">{attempts}</span></div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
