'use client';
import { IcpRegistration, PublicSecurityRegistration } from '@app-foundation/registration-ui';
import beianBadge from '@app-foundation/registration-ui/beian-badge.png';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { douyinContentAvailable } from '@cuberoot/shared/douyin-content';

import { useRetainedState } from '@/hooks/useRetainedState';
import { useContentRefreshKey } from '@/hooks/useContentRefreshKey';

/** Site entrypoint — Landing page. */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { ArrowRight, Check, Crown, Download, Heart, Lock, LockOpen, LogIn, Pencil, User, type LucideIcon } from '@app-foundation/icons/lucide';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import Link from '@/components/AppLink';
import SortableCard from '@/components/SortableCard';
import { RecordBadge } from '@/components/RecordBadge';
import { CubingIcon } from '@cuberoot/event-icon';
import HeaderToggles from '@/components/HeaderToggles';
import { Tooltip } from '@/components/Tooltip';
import OnboardingGuideModal from '@/components/OnboardingGuideModal';
import { isOnboardingGuided, markOnboardingGuided } from '@/lib/onboarding';
import './home-background.css';
import { useTranslation } from 'react-i18next';
import { useAuthUser, nextQuery } from '@/lib/auth-store';
import { fmtVipId } from '@/lib/membership-format';
import LandingSearch from '@/components/LandingSearch';
import ContactDetails from '@/components/ContactDetails';
import PersonUpcomingComps from '@/components/persons/sections/PersonUpcomingComps';
import { useCompFollows } from '@/components/CompFollow';
import SearchInput from '@/components/SearchInput';
import LazyVisible from '@/components/LazyVisible';
import { ClientLoadStatus } from '@/components/StartupStatus';
import {
  FOOTER_ENTRIES,
  PRIMARY_CARDS,
  SEARCH_CARDS,
  SECTIONS,
  TEXTS,
  WCA_CARDS,
  applyLandingCardOrder,
  isLandingSearchCardVisible,
  type CardConfig,
} from '@/lib/landing-sections';

// Below-the-fold widgets — dynamic to defer client hydrate / chunk fetch.
// The dynamic fallback and viewport placeholder use the same measured height,
// so crossing the lazy boundary does not collapse the page before data arrives.
const OngoingComps = dynamic(() => import('@/components/OngoingComps'), {
  loading: () => <div className="landing-widget-skeleton" aria-hidden="true" />,
});
const RecentScrambles = dynamic(() => import('@/components/RecentScrambles'), {
  loading: () => <div className="landing-widget-skeleton" aria-hidden="true" />,
});
const TodayRecon = dynamic(() => import('@/components/TodayRecon'), {
  loading: () => <div className="landing-widget-skeleton" aria-hidden="true" />,
});
const ForumFeedPreview = dynamic(() => import('@/components/forum/ForumFeedPreview'), {
  loading: () => <div className="landing-widget-skeleton" aria-hidden="true" />,
});
import { useEffectiveTheme } from '@/lib/theme';
import '../landing.css';
import { tr } from '@/i18n/tr';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { fetchPageNotices, type PageNotice } from '@/lib/page-notices-api';
import { colorFor, homepageNoticeTitle, iconFor } from '@/lib/page-notice-visuals';
import { displayCuberName } from '@/lib/cuber-name-display';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';
import { listPublicMembers, type PublicMember } from '@/lib/membership-api';
import { getHomeCardLocks, getHomeCardOrders, reorderHomeCards, setHomeCardLock } from '@/lib/home-card-order-api';
import { getPinnedRecons, setReconHomePin } from '@/lib/recon-api';
import { HOME_MEMBER_SECTION_IDS } from '@cuberoot/shared/site-directory';

const ABOUT_FOOTER_ENTRY = FOOTER_ENTRIES.find((entry) => entry.id === 'about')!;
const SUPPORT_FOOTER_ENTRY = FOOTER_ENTRIES.find((entry) => entry.id === 'support')!;
const GITHUB_FOOTER_ENTRY = FOOTER_ENTRIES.find((entry) => entry.id === 'github')!;

// Temporary homepage feature; restore the managed notice on 2026-09-17 (UTC+8).
const HISTORY_HOME_FEATURE: PageNotice = {
  id: -1, path: '/', placement: 'home_featured', level: 'info',
  bodyZh: '把时间，走成风景。', bodyEn: 'Walk through a landscape of time.',
  href: '/dev/architecture/history', enabled: true, dismissible: false,
  endsAt: '2026-09-17T00:00:00+08:00', updatedAt: '2026-09-09T00:00:00+08:00',
};

interface LandingCardContentProps {
  label: string;
  Icon?: LucideIcon;
  iconImg?: string;
  record?: string;
  iconText?: string;
  puzzleIcon?: string;
}

function LandingCardContent({ label, Icon, iconImg, record, iconText, puzzleIcon }: LandingCardContentProps) {
  return (
    <>
      {(iconImg || Icon || record || iconText || puzzleIcon) && (
        <div className="landing-card-icon">
          {puzzleIcon ? <CubingIcon icon={puzzleIcon} /> : iconText ? <span className="landing-card-icon-text">{iconText}</span> : record ? <RecordBadge record={record} /> : iconImg
            ? <img src={iconImg} alt="" className="landing-card-logo" aria-hidden="true" />
            : Icon
              ? <Icon size={30} strokeWidth={1.5} />
              : null}
        </div>
      )}
      <div className="landing-card-name">
        <span>{label}</span>
      </div>
    </>
  );
}

type ReconSolve = Awaited<ReturnType<typeof getPinnedRecons>>[number];

export default function LandingPage() {
  const douyin = useDouyinToolSurface();
  const contentRefreshKey = useContentRefreshKey();
  // Title is owned by page.tsx's generateMetadata (lib/page-meta.ts, key '').
  // The useDocumentTitle('', '') call that used to live here forced the tab back
  // to the bare brand after hydration, which would now overwrite that title.
  const { i18n } = useTranslation();
  const effectiveTheme = useEffectiveTheme();
  // `mounted` flips on client after hydration; gates anything that differs
  // between SSR and CSR (theme-dependent logo src, hostname-based beian)
  // to avoid React #418 hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const [showBeian, setShowBeian] = useState(false);

  useEffect(() => {
    setMounted(true);
    const h = window.location.hostname;
    setShowBeian(/(^|\.)cuberoot\.me$/i.test(h) || h === 'localhost' || h === '127.0.0.1');
  }, []);

  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const user = useAuthUser();
  const compFollows = useCompFollows();
  const personalKey = user ? `${user.uid ?? ''}:${user.wcaId}` : null;
  const [personalReadyKey, setPersonalReadyKey] = useState<string | null>(null);
  const onPersonalReady = useCallback(() => setPersonalReadyKey(personalKey), [personalKey, setPersonalReadyKey]);
  const personalLoading = Boolean(user && (!compFollows.loaded || personalReadyKey !== personalKey));
  const [guideOpen, setGuideOpen] = useState(false);
  const [replayGuide, setReplayGuide] = useQueryState('guide', parseAsBoolean.withDefault(false));
  useEffect(() => {
    if (!mounted) return;
    let active = true;
    let timer: number | undefined;
    setGuideOpen(false);
    if (replayGuide) {
      setGuideOpen(true);
    } else {
      void isOnboardingGuided(user).then(seen => {
        if (active && !seen) timer = window.setTimeout(() => setGuideOpen(true), 600);
      });
    }
    return () => { active = false; window.clearTimeout(timer); };
  }, [mounted, user?.uid, user?.wcaId, replayGuide]);
  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    void markOnboardingGuided(user);
    if (replayGuide) void setReplayGuide(null);
  }, [user, replayGuide, setReplayGuide]);
  const [featuredNotices, setFeaturedNotices] = useRetainedState<PageNotice[]>('home:featuredNotices', []);
  const [publicMembers, setPublicMembers] = useRetainedState<PublicMember[] | null>('home:publicMembers', null);
  const [layoutReady, setLayoutReady] = useRetainedState('home:layoutReady', { notice: false, members: false, order: false });
  const [visibleWidgets, setVisibleWidgets] = useRetainedState<Record<string, boolean>>('home:visibleWidgets', {});
  const rememberWidget = (key: string) => setVisibleWidgets(previous => previous[key] ? previous : { ...previous, [key]: true });
  const [memberQueries, setMemberQueries] = useState({ enterprise: '', individual: '' });
  const orderedMembers = useMemo(() => [...(publicMembers ?? [])].sort((a, b) => {
    const aId = /^VIP(\d+)$/.exec(a.vipId ?? '');
    const bId = /^VIP(\d+)$/.exec(b.vipId ?? '');
    if (!aId) return bId ? 1 : 0;
    if (!bId) return -1;
    const aNumber = BigInt(aId[1]);
    const bNumber = BigInt(bId[1]);
    return aNumber < bNumber ? -1 : aNumber > bNumber ? 1 : 0;
  }), [publicMembers]);

  useEffect(() => {
    let active = true;
    let managedNotices: PageNotice[] = [];
    const endsAt = Date.parse(HISTORY_HOME_FEATURE.endsAt!);
    const refresh = () => {
      if (active) setFeaturedNotices(Date.now() < endsAt ? [HISTORY_HOME_FEATURE, ...managedNotices] : managedNotices);
    };
    if (Date.now() < endsAt) refresh();
    const expiryTimer = Date.now() < endsAt ? window.setTimeout(refresh, endsAt - Date.now()) : undefined;
    fetchPageNotices()
      .then((rows) => {
        managedNotices = rows.filter((row) => row.placement === 'home_featured' && row.path === '/');
        refresh();
      })
      .catch(() => { /* 焦点新闻不可阻断首页 */ })
      .finally(() => { if (active) setLayoutReady(previous => ({ ...previous, notice: true })); });
    return () => { active = false; window.clearTimeout(expiryTimer); };
  }, [contentRefreshKey, setFeaturedNotices, setLayoutReady]);

  useEffect(() => {
    let active = true;
    listPublicMembers()
      .then((members) => { if (active) setPublicMembers(members); })
      .catch(() => { /* 会员名单不可阻断首页 */ })
      .finally(() => { if (active) setLayoutReady(previous => ({ ...previous, members: true })); });
    return () => { active = false; };
  }, [setPublicMembers, setLayoutReady]);

  const t = useCallback((key: keyof typeof TEXTS) => TEXTS[key][lang], [lang]);

  // 右上角 登录 / 我的 入口,两态都是真链接、都指 /account(全站无登录弹层)。useAuthUser
  // 是 hydration-safe(SSG 首帧按未登录渲染,挂载后才切到已登录),避免 SSG/CSR 错配。

  const isAdmin = Boolean(user?.isAdmin || isAdminWcaId(user?.wcaId));
  const [editingCards, setEditingCards] = useState(false);
  const canEditCards = isAdmin && editingCards;
  const [pinnedRecons, setPinnedRecons] = useRetainedState<ReconSolve[] | null>('home:pinnedRecons', null);
  const [savingPins, setSavingPins] = useState<Set<number>>(new Set());
  const [pinError, setPinError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getPinnedRecons().then(rows => { if (active) setPinnedRecons(rows); }).catch(() => {
      if (active) setPinError(tr({ zh: '置顶复盘加载失败，请刷新重试。', en: 'Could not load pinned recons. Please refresh to retry.' }));
    });
    return () => { active = false; };
  }, [setPinnedRecons]);
  const onPin = async (solve: ReconSolve, pinned: boolean) => {
    if (!isAdmin || savingPins.has(solve.id)) return;
    setSavingPins(prev => new Set(prev).add(solve.id));
    setPinError(null);
    try {
      await setReconHomePin(solve.id, pinned);
      setPinnedRecons(prev => pinned
        ? [solve, ...(prev ?? []).filter(item => item.id !== solve.id)]
        : (prev ?? []).filter(item => item.id !== solve.id));
    } catch {
      setPinError(tr({ zh: '置顶设置未保存，请重试。', en: 'Could not save the pin. Please try again.' }));
    } finally {
      setSavingPins(prev => { const next = new Set(prev); next.delete(solve.id); return next; });
    }
  };
  const reconProps = { lang, pinnedRecons, isAdmin, savingPins, pinError, onPin };
  const [cardOrders, setCardOrders] = useRetainedState<Record<string, string[]>>('home:cardOrders', {});
  const [cardLocks, setCardLocks] = useRetainedState<Record<string, boolean>>('home:cardLocks', {});
  const [locksLoaded, setLocksLoaded] = useRetainedState('home:locksLoaded', false);
  const [savingLocks, setSavingLocks] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    const refresh = () => {
      getHomeCardLocks().then((locks) => {
        if (active) { setCardLocks(locks); setLocksLoaded(true); }
      }).catch(() => { /* 保留默认锁定状态；读取成功前禁止管理操作。 */ });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, [setCardLocks, setLocksLoaded]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    let active = true;
    getHomeCardOrders(isAdmin)
      .then((orders) => { if (active) setCardOrders(orders); })
      .catch(() => { /* 自定义顺序不可阻断首页 */ })
      .finally(() => { if (active) setLayoutReady(previous => ({ ...previous, order: true })); });
    return () => { active = false; };
  }, [isAdmin, contentRefreshKey, setCardOrders, setLayoutReady]);

  const searchCards = useMemo(
    () => SEARCH_CARDS.filter((card) => (isAdmin || locksLoaded)
      && isLandingSearchCardVisible({ ...card, lockedForNonAdmin: cardLocks[card.id] ?? card.lockedForNonAdmin }, isAdmin)),
    [isAdmin, cardLocks, locksLoaded],
  );
  const pathname = usePathname();
  // 已登录时右上角只保留头像(去掉名字);无头像退回 User 图标。
  const authInner = user && (
    user.avatar
      ? <img src={user.avatar} alt="" className="landing-auth-avatar" />
      : <User size={16} aria-hidden />
  );

  const renderLock = (id: string, locked: boolean, adminOnly = false, label?: string) => canEditCards && (
    <button type="button" className="landing-card-lock" aria-pressed={locked}
      disabled={adminOnly || !locksLoaded || savingLocks.has(id)}
      title={adminOnly ? tr({ zh: '仅管理员可见', en: 'Administrators only' }) : !locksLoaded ? tr({ zh: '锁定状态尚未加载', en: 'Lock status has not loaded' }) : locked ? tr({ zh: '解锁', en: 'Unlock' }) : tr({ zh: '锁定', en: 'Lock' })}
      aria-label={adminOnly ? tr({ zh: '仅管理员可见', en: 'Administrators only' }) : locked ? tr({ zh: `解锁${label ?? '卡片'}`, en: `Unlock ${label ?? 'card'}` }) : tr({ zh: `锁定${label ?? '卡片'}`, en: `Lock ${label ?? 'card'}` })}
      onClick={async () => {
        setSavingLocks((current) => new Set(current).add(id));
        try {
          await setHomeCardLock(id, !locked);
          setCardLocks((current) => ({ ...current, [id]: !locked }));
        } catch (error) {
          alert(tr({ zh: `保存失败：${error instanceof Error ? error.message : String(error)}`, en: `Save failed: ${error instanceof Error ? error.message : String(error)}` }));
        } finally {
          setSavingLocks((current) => { const next = new Set(current); next.delete(id); return next; });
        }
      }}>
      {locked ? <Lock size={14} /> : <LockOpen size={14} />}
    </button>
  );

  const isCardLocked = (card: CardConfig) => Boolean(card.adminOnly)
    || (cardLocks[card.id] ?? Boolean(card.lockedForNonAdmin || card.comingSoon));

  // 新手引导锚点：card.id -> data-tour（OnboardingGuideModal 用
  // document.querySelector('[data-tour="..."]') + getBoundingClientRect() 定位）。
  // 直接从计时开始依次高亮，共 12 步：
  // 1 计时 timer / 2 公式 formulas / 3 模拟 simulator / 4 复盘 replay /
  // 5 打乱 scramble / 6 比赛 competition / 7 纪录 records / 8 排名 rankings /
  // 9 统计 statistics；10~12 为下方挂件（近期打乱 / 今日复盘 / 论坛），
  // 锚点见下方 LazyVisible 外层包裹 div。
  // 纪录与排名为独立步骤：wca-records -> records，wca-results -> rankings。
  const CARD_ID_TO_TOUR: Record<string, string> = {
    timer: 'timer',               // Step 1 计时
    algdb: 'formulas',            // Step 2 公式
    sim: 'simulator',             // Step 3 模拟
    recon: 'replay',              // Step 4 复盘
    scramble: 'scramble',         // Step 5 打乱
    competitions: 'competition',  // Step 6 比赛（WCA 比赛入口，同组）
    'comp-sim': 'competition',    // Step 6 比赛（模拟正式比赛，直达 CTA）
    'wca-records': 'records',     // Step 7 纪录（个人计时成绩）
    'wca-results': 'rankings',    // Step 8 排名（全球排行榜）
    'wca-stats': 'statistics',    // Step 9 统计
  };

  const renderCard = (card: CardConfig) => {
    const locked = isCardLocked(card);
    const isLocked = locked && !isAdmin;
    const isDevelopment = locked && !card.adminOnly;
    const developmentLabel = locked
      ? tr({ zh: '开发中', en: 'In development' })
      : t('comingSoon');
    const content = (
      <>
        <LandingCardContent
          label={t(card.nameKey)}
          Icon={card.Icon}
          iconImg={card.iconImg}
          record={card.record}
          iconText={card.iconText}
          puzzleIcon={card.puzzleIcon}
        />
      </>
    );
    const isDisabled = isLocked;
    const className = `landing-card tier-${card.tier}${isDevelopment ? ' is-disabled' : ''}`;
    let cardElement;
    if (isDisabled) {
      cardElement = (
        <div className={className} id={`card-${card.id}`}
          title={developmentLabel} aria-label={card.id === 'calendar' ? t(card.nameKey) : undefined}
          aria-disabled="true" role="link">
          {content}
        </div>
      );
    } else if (card.internal) {
      cardElement = (
        <Link href={card.href} className={className} id={`card-${card.id}`} prefetch={false}
          aria-label={card.id === 'calendar' ? t(card.nameKey) : undefined}>
          {content}
        </Link>
      );
    } else {
      cardElement = (
        <a href={card.href} className={className} id={`card-${card.id}`}
          target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }
    return (
      <SortableCard
        key={card.id}
        id={card.id}
        draggable={canEditCards}
        tourKey={CARD_ID_TO_TOUR[card.id]}
      >
        {renderLock(card.id, locked, card.adminOnly)}
        {cardElement}
      </SortableCard>
    );
  };

  const renderCardGrid = (groupId: string, cards: CardConfig[], className: string, adminArea = false) => {
    const orderedCards = applyLandingCardOrder(cards, cardOrders[groupId] ?? []);
    // Split the same full group by access; keep all IDs when saving its order.
    const visibleCards = orderedCards.filter((card) => (!douyin || douyinContentAvailable(card.href)) && (isAdmin || locksLoaded)
      && (adminArea ? isAdmin && isCardLocked(card) : !isCardLocked(card)));
    if (visibleCards.length === 0) return null;
    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!canEditCards || !over || active.id === over.id) return;
      const current = orderedCards.map((card) => card.id);
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(current, oldIndex, newIndex);
      setCardOrders((orders) => ({ ...orders, [groupId]: next }));
      reorderHomeCards(groupId, next).catch((error) => {
        console.error('homepage card reorder failed', error);
        alert(tr({ zh: `排序失败：${error.message}`, en: `Reorder failed: ${error.message}` }));
        setCardOrders((orders) => ({ ...orders, [groupId]: current }));
      });
    };
    return (
      <DndContext key={groupId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleCards.map((card) => card.id)} strategy={rectSortingStrategy}>
          <div className={className}>{visibleCards.map(renderCard)}</div>
        </SortableContext>
      </DndContext>
    );
  };

  const renderMemberSections = (adminArea = false) => ([
    { id: 'enterprise', enterprise: true, eyebrow: tr({ zh: '企业', en: 'Enterprise' }), title: tr({ zh: '企业会员', en: 'Enterprise members' }), empty: tr({ zh: '暂无企业会员', en: 'No enterprise members yet' }) },
    { id: 'individual', enterprise: false, eyebrow: tr({ zh: '个人', en: 'Individual' }), title: tr({ zh: '个人会员', en: 'Individual members' }), empty: tr({ zh: '暂无个人会员', en: 'No individual members yet' }) },
  ] as const).map((section) => {
    const lockId = HOME_MEMBER_SECTION_IDS[section.id];
    const locked = cardLocks[lockId] ?? true;
    if ((!isAdmin && !locksLoaded) || (adminArea ? !isAdmin || !locked : locked)) return null;
    const query = memberQueries[section.id].trim().toLowerCase();
    const sectionMembers = orderedMembers.filter((member) => member.planSlug.startsWith('enterprise_') === section.enterprise);
    const members = sectionMembers.filter((member) => !query || [
      member.name, member.wcaId, member.vipId ?? '', fmtVipId(member.vipId ?? ''),
    ].some((value) => value.toLowerCase().includes(query)));
    return (
      <section key={section.id} className="cards-section" aria-labelledby={`${section.id}-members-title`}>
        <div className="section-header">
          <div className="landing-member-heading">
            <h2 id={`${section.id}-members-title`} className="section-title-serif">{section.title}</h2>
            {renderLock(lockId, locked, false, section.title)}
          </div>
          <SearchInput
            value={memberQueries[section.id]}
            onChange={(value) => setMemberQueries((current) => ({ ...current, [section.id]: value }))}
            className="landing-member-search"
            placeholder={tr({ zh: '搜索姓名、WCA ID 或 VIP 编号', en: 'Search name, WCA ID or VIP number' })}
            ariaLabel={tr({ zh: `搜索${section.title}`, en: `Search ${section.title.toLowerCase()}` })}
          />
          {publicMembers && members.length === 0 && <div className="section-sub" role="status">{sectionMembers.length === 0 ? section.empty : tr({ zh: '没有匹配的会员', en: 'No matching members' })}</div>}
        </div>
        {members.length > 0 && (
          <div className="landing-members">
            {members.map((member) => (
              <Link key={member.wcaId} href={`/wca/persons/${member.wcaId}`} className="landing-member" prefetch={false}>
                {member.avatarUrl
                  ? <img src={member.avatarUrl} alt="" className="landing-member-avatar" />
                  : <User size={24} aria-hidden="true" />}
                <span>{displayCuberName(member.name, lang === 'zh')}<WcaPersonTeamBadge wcaId={member.wcaId} />{member.vipId ? ` ${fmtVipId(member.vipId)}` : ''}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    );
  });

  // These small responses decide which sections exist. Reveal one settled
  // structure, then let the lazy widgets fill independently. Warm route
  // mounts already have the snapshot and skip this boundary entirely.
  if (!locksLoaded || !layoutReady.notice || !layoutReady.members || !layoutReady.order) return <ClientLoadStatus />;

  if (douyin) return <div className="landing-page">
    <div className="landing-auth"><HeaderToggles /><Link href="/account" prefetch={false}>{tr({ zh: '我的', en: 'Account' })}</Link></div>
    <div className="brand-line"><span className="brand-name">CubeRoot</span></div>
    <p>{tr({ zh: '计时、成绩记录与比赛信息查询', en: 'Timing, solve records and competition information' })}</p>
    <div className="hero-grids">
      {renderCardGrid('main', PRIMARY_CARDS, 'primary-hero-grid')}
      {renderCardGrid('wca', WCA_CARDS, 'wca-hero-grid')}
    </div>
    {renderCardGrid('tools', SECTIONS.flatMap(section => section.cards), 'cards-container')}
  </div>;

  return (
    <>
    {personalLoading && <ClientLoadStatus />}
    {/* Keep the data loader mounted while the first personalized layout settles. */}
    <div className="landing-page" style={personalLoading ? { display: 'none' } : undefined}>
      <div className="landing-auth">
        {isAdmin && <Tooltip content={editingCards ? tr({ zh: '完成编辑', en: 'Finish editing' }) : tr({ zh: '编辑', en: 'Edit' })}>
          {(tip) => <button {...tip} type="button" className="landing-auth-icon" aria-pressed={editingCards}
            aria-label={editingCards ? tr({ zh: '完成编辑', en: 'Finish editing' }) : tr({ zh: '编辑', en: 'Edit' })}
            onClick={() => setEditingCards(current => !current)}>
            {editingCards ? <Check size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
          </button>}
        </Tooltip>}
        {isAdmin && <Tooltip content={tr({ zh: '下载', en: 'Download' })}>
          {(tip) => <Link {...tip} href="/download" className="landing-auth-icon"
            aria-label={tr({ zh: '下载', en: 'Download' })} prefetch={false}>
            <Download size={16} aria-hidden="true" />
          </Link>}
        </Tooltip>}
        <Link href="/membership" className="landing-auth-icon landing-membership-icon"
          title={tr({ zh: '会员', en: 'Membership' })}
          aria-label={tr({ zh: '会员', en: 'Membership' })} prefetch={false}>
          <Crown size={16} aria-hidden="true" />
        </Link>
        <Link
          href={SUPPORT_FOOTER_ENTRY.href}
          className="landing-auth-icon landing-support-icon"
          title={t(SUPPORT_FOOTER_ENTRY.nameKey)}
          aria-label={t(SUPPORT_FOOTER_ENTRY.nameKey)}
          prefetch={false}
        >
          <Heart size={14} aria-hidden="true" />
        </Link>
        {renderCardGrid('calendar', SECTIONS.flatMap((section) => section.cards).filter((card) => card.id === 'calendar'), 'landing-calendar-link')}
        <HeaderToggles />
        {!user ? (
          <Link href={`/account${nextQuery(pathname)}`} className="landing-auth-btn is-login" prefetch={false}
            aria-label={tr({ zh: '登录', en: 'Log in' })} title={tr({ zh: '登录', en: 'Log in' })}>
            <LogIn size={16} aria-hidden />
            <span>{tr({ zh: '登录', en: 'Log in' })}</span>
          </Link>
        ) : (
          <Link
            href="/account"
            className="landing-auth-btn is-avatar"
            prefetch={false}
          >
            {authInner}
          </Link>
        )}
      </div>

      <div className="brand-line">
        <img src={mounted && effectiveTheme === 'dark' ? '/icons/CubeRoot-dark.png' : '/icons/CubeRoot.png'} alt="" className="brand-logo" />
        <span className="brand-name">{t('brand')}</span>
      </div>
      <LandingSearch cards={searchCards} lang={lang} workspaceEntry />
      <div className="landing-personal-row">
      {user && compFollows.loaded && <div className="landing-personal-comps">
        <PersonUpcomingComps key={personalKey} wcaId={user.wcaId || undefined} isZh={lang === 'zh'}
          onReady={onPersonalReady}
          compactDetails
          hideHomeCountryFlag
          title={null}
          followedIds={compFollows.follows} />
      </div>}
        <div className="landing-training-links">
          <Link href="/alg/3x3/zbll/run" className="landing-card" data-site-surface="panel" prefetch={false}>
            <LandingCardContent label={tr({ zh: 'ZBLL 训练', en: 'ZBLL Training' })} />
          </Link>
          <Link href="/alg/3x3/lsll/run" className="landing-card" data-site-surface="panel" prefetch={false}>
            <LandingCardContent label={tr({ zh: 'LSLL 训练', en: 'LSLL Training' })} />
          </Link>
        </div>
      </div>
      <div className="landing-featured-notices">
      {featuredNotices.map((featuredNotice) => {
        if (!featuredNotice.href) return null;
        const FeaturedIcon = iconFor(featuredNotice);
        const isHistoryFeature = featuredNotice === HISTORY_HOME_FEATURE;
        const featureClass = `landing-featured-news${isHistoryFeature ? ' landing-history-feature' : ''}`;
        const body = tr(homepageNoticeTitle(featuredNotice));
        const inner = (
          <>
            {isHistoryFeature
              ? <img className="landing-history-preview" src="/assets/history-home-v1.webp" width={1080} height={293} alt="" decoding="async" />
              : <FeaturedIcon className="landing-featured-news-icon" size={15} aria-hidden="true" />}
            <span className="landing-featured-news-body">
              {isHistoryFeature && <span className="landing-history-label">{tr({ zh: '新功能：交互历史画卷', en: 'New: an interactive history scroll' })}</span>}
              <span className={isHistoryFeature ? 'landing-history-title' : undefined}>{body}</span>
              {isHistoryFeature && <span className="landing-history-invitation">{tr({ zh: '进入画卷，沿途看看 CubeRoot 的每一次更新。', en: 'Explore CubeRoot’s story, one day at a time.' })}</span>}
            </span>
            <ArrowRight className="landing-featured-news-arrow" size={16} aria-hidden="true" />
          </>
        );
        const style = { '--home-news-color': colorFor(featuredNotice) } as CSSProperties;
        // allow-nested-link: internal AppLink and external anchor are mutually exclusive branches, with no links inside inner.
        return featuredNotice.href.startsWith('/') && !featuredNotice.href.startsWith('//')
          ? (
              <Link key={featuredNotice.id} href={featuredNotice.href} className={featureClass} style={style} prefetch={false}>
                {inner}
              </Link>
            )
          : (
              // allow-nested-link: this anchor is the mutually exclusive external branch; the internal Link above is already closed.
              <a key={featuredNotice.id} href={featuredNotice.href} className={featureClass} style={style}
                target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            );
      })}
      </div>

      <div className="landing-training-grid">
        <div className="landing-pinned-recons" aria-busy={pinnedRecons === null && !pinError}>
          {pinnedRecons === null && !pinError
            ? <><div className="landing-widget-skeleton" aria-hidden="true" /><div className="landing-widget-skeleton" aria-hidden="true" /></>
            : pinnedRecons?.length
              ? <TodayRecon {...reconProps} pinnedOnly />
              : <p className="landing-slot-message" role="status">{pinError ?? tr({ zh: '暂无置顶复盘', en: 'No pinned recons yet' })}</p>}
        </div>
      </div>

      {/* 两行 hero 的共同外壳。桌面是 5 + 4 两个独立网格;手机端外壳自己变成 3 列网格、
          两个子网格 display:contents,9 张卡直接排成 3 行 3 个(见 landing.css)。 */}
      <div className="hero-grids">
        {/* 主入口 — 标语正下方,五张最常用直达卡(计时器 / 公式 / 模拟 / 复盘 / 打乱) */}
        {renderCardGrid('main', PRIMARY_CARDS, 'primary-hero-grid')}

        {/* WCA 入口 — 紧接主入口,原单张「WCA 统计」hero 拆成四张直达卡:比赛 / 纪录 / 排名 / 统计 */}
        {renderCardGrid('wca', WCA_CARDS, 'wca-hero-grid')}
      </div>

      <LazyVisible className="landing-widget landing-widget--scrambles" minHeight={0} rootMargin="120px 0px" initiallyVisible={visibleWidgets.scrambles} onVisible={() => rememberWidget('scrambles')}>
        <RecentScrambles lang={lang} />
      </LazyVisible>
      <LazyVisible className="landing-widget landing-widget--recons" minHeight={0} rootMargin="120px 0px" initiallyVisible={visibleWidgets.recons} onVisible={() => rememberWidget('recons')}>
        <TodayRecon {...reconProps} />
      </LazyVisible>

      <LazyVisible className="landing-widget landing-widget--comps" minHeight={0} rootMargin="120px 0px" initiallyVisible={visibleWidgets.comps} onVisible={() => rememberWidget('comps')}>
        <OngoingComps lang={lang} compFollows={compFollows} />
      </LazyVisible>

      <LazyVisible className="landing-widget landing-widget--forum" minHeight={0} rootMargin="120px 0px" initiallyVisible={visibleWidgets.forum} onVisible={() => rememberWidget('forum')}>
        <ForumFeedPreview />
      </LazyVisible>

      <div className="cards-sections">
        {SECTIONS.map((sec) => {
          const grid = renderCardGrid(sec.id, sec.cards.filter((card) => card.id !== 'calendar'), 'cards-container');
          return grid && (
            <section key={sec.id} id={`section-${sec.id}`} className="cards-section">
              <div className="section-header">
                <h2 className="section-title-serif">{tr(sec.title)}</h2>
              </div>
              {grid}
            </section>
          );
        })}
        {renderMemberSections()}
      </div>

      {isAdmin && (
        <section id="landing-admin-content" className="cards-sections" aria-labelledby="landing-admin-title">
          <div className="cards-section">
            <h2 id="landing-admin-title" className="section-title-serif">{tr({ zh: '仅管理员可见', en: 'Administrators only' })}</h2>
            <div className="cards-container">
              {renderCardGrid('main', PRIMARY_CARDS, 'landing-admin-card-group', true)}
              {renderCardGrid('wca', WCA_CARDS, 'landing-admin-card-group', true)}
              {SECTIONS.map((sec) => renderCardGrid(sec.id, sec.cards, 'landing-admin-card-group', true))}
            </div>
          </div>
          {renderMemberSections(true)}
        </section>
      )}

      <footer className="landing-footer-layout">
      <div className="landing-footer-info">
      <div className="footer">
        {/* allow-nested-link: footer entries are sibling links with text-only contents. */}
        <Link href={ABOUT_FOOTER_ENTRY.href} className="footer-about" prefetch={false}>
          {t(ABOUT_FOOTER_ENTRY.nameKey)}
        </Link>
        <Link href="/careers" prefetch={false}>
          {tr({ zh: '加入我们', en: 'Careers' })}
        </Link>
        <Link href={SUPPORT_FOOTER_ENTRY.href} className="footer-credits" prefetch={false}>
          <Heart size={12} aria-hidden="true" />
          <span>{t(SUPPORT_FOOTER_ENTRY.nameKey)}</span>
        </Link>
        <Link href="/membership" className="footer-membership" prefetch={false}>
          <Crown size={14} aria-hidden="true" />
          <span>{tr({ zh: '会员', en: 'Membership' })}</span>
        </Link>
        <a
          href={GITHUB_FOOTER_ENTRY.href}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-github"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
          </svg>
          <span>{t(GITHUB_FOOTER_ENTRY.nameKey)}</span>
        </a>
      </div>

      <div className="beian company-contact">
        <span>{tr({ zh: '上海魔方根科技有限公司', en: 'Shanghai CubeRoot Technology Co., Ltd.' })}</span>
        <span>{tr({
          zh: '联系地址：上海市徐汇区龙耀路8号阿里巴巴徐汇滨江园区X区X5-406',
          en: 'Contact address: X5-406, Zone X, Alibaba Xuhui Riverside Campus, 8 Longyao Road, Xuhui District, Shanghai',
        })}</span>
      </div>

      {showBeian && (
        <div className="beian">
          <IcpRegistration number="沪ICP备2025130431号" />
          <span className="beian-sep">|</span>
          <PublicSecurityRegistration
            number="沪公网安备31010902100930号"
            code="31010902100930"
            badgeSrc={typeof beianBadge === "string" ? beianBadge : beianBadge.src}
            className="beian-mps"
          />
        </div>
      )}
      </div>
      <div className="landing-contact-details">
        <ContactDetails />
      </div>
      </footer>
      <OnboardingGuideModal open={guideOpen && !personalLoading} onClose={closeGuide} />
    </div>
    </>
  );
}
