'use client';

// /person/[wcaId] — 选手聚合页。顶部 选手名+国旗+性别+WCA ID,下方入口卡片:
//   成绩复盘  → /recon/person/:id
//   WCA 档案  → /wca/persons/:id
// wcaId 从 useParams 取;头部信息走 WCA 公共 API(localStorage 24h 缓存)。

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Mars, Venus, Rewind, IdCard, LogOut } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import FollowedComps from '@/components/FollowedComps';
import { Flag } from '@/components/Flag';
import { displayCuberName } from '@/lib/name-utils';
import { countryName } from '@/lib/country-name';
import { useAuthStore } from '@/lib/auth-store';
import { fetchWcaPerson, type WcaPersonProfile } from '@/lib/wca-person-api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { tr, useLang } from '@/i18n/tr';
import './person-hub.css';

export default function PersonHubClient() {
  const lang = useLang();
  const isZh = lang !== 'en';

  const params = useParams<{ wcaId: string }>();
  const wcaId = Array.isArray(params.wcaId) ? params.wcaId[0] : (params.wcaId ?? '');

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isSelf = !!user && user.wcaId === wcaId;

  const [profile, setProfile] = useState<WcaPersonProfile | null>(null);

  useEffect(() => {
    if (!wcaId) return;
    let cancelled = false;
    fetchWcaPerson(wcaId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { /* 头部信息可缺省,卡片照样可点 */ });
    return () => { cancelled = true; };
  }, [wcaId]);

  const p = profile?.person;
  const displayName = p ? displayCuberName(p.name, isZh) : wcaId;
  useDocumentTitle(displayName, displayName);

  const GenderIcon = p?.gender === 'm' ? Mars : p?.gender === 'f' ? Venus : null;

  const cards = [
    {
      key: 'recon',
      href: `/recon/person/${wcaId}`,
      Icon: Rewind,
      title: tr({ zh: '成绩复盘', en: 'Reconstructions' }),
      desc: tr({ zh: '逐步还原该选手的解法', en: 'Step-by-step solve reconstructions' }),
    },
    {
      key: 'wca',
      href: `/wca/persons/${wcaId}`,
      Icon: IdCard,
      title: tr({ zh: 'WCA 档案', en: 'WCA Profile' }),
      desc: tr({ zh: '个人纪录 / 比赛历史 / 奖牌', en: 'Records, competition history, medals' }),
    },
  ];

  return (
    <div className="phub-page">
      <header className="phub-header">
        <HomeLink className="phub-back">
          <ChevronLeft size={16} />
          <span>{tr({ zh: '首页', en: 'Home' })}</span>
        </HomeLink>
        {isSelf && (
          <button type="button" className="phub-logout" onClick={() => logout()}>
            <LogOut size={14} />
            <span>{tr({ zh: '退出登录', en: 'Log out' })}</span>
          </button>
        )}
      </header>

      <div className="phub-id-row">
        <span className="phub-flag" title={p?.country_iso2 ? countryName(p.country_iso2, isZh) : undefined}>
          {p && <Flag iso2={p.country_iso2} className="phub-flag-img" />}
        </span>
        <div className="phub-name-line">
          <h1 className="phub-name">{displayName}</h1>
        </div>
        <span className="phub-gender-cell">
          {GenderIcon && <GenderIcon size={18} className={`phub-gender phub-gender-${p!.gender}`} />}
        </span>
        <div className="phub-wid">{wcaId}</div>
      </div>

      <nav className="phub-cards">
        {cards.map(({ key, href, Icon, title, desc }) => (
          <AppLink key={key} href={href} className="phub-card">
            <Icon size={22} className="phub-card-icon" />
            <div className="phub-card-body">
              <div className="phub-card-title">{title}</div>
              <div className="phub-card-desc">{desc}</div>
            </div>
            <ChevronRight size={18} className="phub-card-chev" />
          </AppLink>
        ))}
      </nav>

      <FollowedComps wcaId={wcaId} isZh={isZh} lang={isZh ? 'zh' : 'en'} />
    </div>
  );
}
