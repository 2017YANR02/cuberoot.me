'use client';
import { IcpRegistration, PublicSecurityRegistration } from '@app-foundation/registration-ui';
import beianBadge from '@app-foundation/registration-ui/beian-badge.png';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { douyinContentAvailable } from '@cuberoot/shared/douyin-content';
import { isInstalledCommunityHref, useInstalledCommunityDisabled } from '@/lib/installed-content';

import { useRetainedState } from '@/hooks/useRetainedState';
import { useContentRefreshKey } from '@/hooks/useContentRefreshKey';
import { usePageNoticeDismissals } from '@/hooks/usePageNoticeDismissals';
import { useHomeScrollRestoration } from '@/hooks/useHomeScrollRestoration';
import { applyHomeSectionOrder } from '@/lib/home-section-order';
import { SkeletonBlock } from '@/components/ContentSkeleton';

/** Site entrypoint — Landing page. */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { ArrowRight, Check, Crown, Download, Heart, LayoutDashboard, Lock, LockOpen, Pencil, ShoppingBag, User, type LucideIcon } from '@app-foundation/icons/lucide';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import Link from '@/components/AppLink';
import { SHOP_ROOT } from '@/lib/shop';
import SortableCard from '@/components/SortableCard';
import { RecordBadge } from '@/components/RecordBadge';
import { CubingIcon } from '@cuberoot/event-icon';
import HeaderToggles from '@/components/HeaderToggles';
import PageNoticeBar from '@/components/PageNoticeBar';
import HomeNavigation from './HomeNavigation';
import { CubeRootLogoImage } from '@/components/CubeRootLogo';
import { Tooltip } from '@/components/Tooltip';
import { ClearButton } from '@/components/ClearButton';
import OnboardingGuideModal from '@/components/OnboardingGuideModal';
import { isOnboardingGuided, markOnboardingGuided } from '@/lib/onboarding';
import './home-background.css';
import { useTranslation } from 'react-i18next';
import { useAuthUser, nextQuery, authActions } from '@/lib/auth-store';
import { fmtVipId } from '@/lib/membership-format';
import LandingSearch from '@/components/LandingSearch';
import PersonUpcomingComps from '@/components/persons/sections/PersonUpcomingComps';
import { useCompFollows } from '@/components/CompFollow';
import SearchInput from '@/components/SearchInput';
import LazyVisible from '@/components/LazyVisible';
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
  loading: () => <SkeletonBlock className="landing-widget-skeleton" />,
});
const RecentScrambles = dynamic(() => import('@/components/RecentScrambles'), {
  loading: () => <SkeletonBlock className="landing-widget-skeleton" />,
});
const TodayRecon = dynamic(() => import('@/components/TodayRecon'), {
  loading: () => <SkeletonBlock className="landing-widget-skeleton" />,
});
const ForumFeedPreview = dynamic(() => import('@/components/forum/ForumFeedPreview'), {
  loading: () => <SkeletonBlock className="landing-widget-skeleton" />,
});
const ContactDetails = dynamic(() => import('@/components/ContactDetails'), { ssr: false });
import '../landing.css';
import './home-navigation.css';
import { tr } from '@/i18n/tr';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { fetchPageNotices, type PageNotice } from '@/lib/page-notices-api';
import { colorFor, homepageNoticeTitle, iconFor } from '@/lib/page-notice-visuals';
import { displayCuberName } from '@/lib/cuber-name-display';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';
import { listPublicMembers, type PublicMember } from '@/lib/membership-api';
import { getHomeLayout, reorderHomeCards, setHomeCardLock } from '@/lib/home-card-order-api';
import type { HomeLayoutSnapshot } from '@/lib/home-layout';
import { getPinnedRecons, setReconHomePin } from '@/lib/recon-api';
import { HOME_MEMBER_SECTION_IDS } from '@cuberoot/shared/site-directory';

const ABOUT_FOOTER_ENTRY = FOOTER_ENTRIES.find((entry) => entry.id === 'about')!;
const CREDITS_FOOTER_ENTRY = FOOTER_ENTRIES.find((entry) => entry.id === 'credits')!;
const SUPPORT_FOOTER_ENTRY = FOOTER_ENTRIES.find((entry) => entry.id === 'support')!;
const GITHUB_FOOTER_ENTRY = FOOTER_ENTRIES.find((entry) => entry.id === 'github')!;

// Temporary homepage feature; restore the managed notice on 2026-09-17 (UTC+8).
const HISTORY_HOME_FEATURE: PageNotice = {
  id: -1, path: '/', placement: 'home_featured', level: 'info',
  bodyZh: '把时间，走成风景。', bodyEn: 'Walk through a landscape of time.',
  href: '/dev/architecture/log', enabled: true, dismissible: false,
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

// Only the guide consumes query state; its production prerender bailout must not hide the homepage.
function LandingOnboarding({ mounted, personalLoading, isHome, selectHome }: { mounted: boolean; personalLoading: boolean; isHome: boolean; selectHome: () => void }) {
  const user = useAuthUser();
  const [guideOpen, setGuideOpen] = useState(false);
  const [replayGuide, setReplayGuide] = useQueryState('guide', parseAsBoolean.withDefault(false));
  useEffect(() => {
    if (!mounted) return;
    let active = true;
    let timer: number | undefined;
    setGuideOpen(false);
    if (replayGuide) {
      if (!isHome) selectHome();
      else setGuideOpen(true);
    } else if (isHome) {
      void isOnboardingGuided(user).then(seen => {
        if (active && !seen) timer = window.setTimeout(() => setGuideOpen(true), 600);
      });
    }
    return () => { active = false; window.clearTimeout(timer); };
  }, [mounted, user?.uid, user?.wcaId, replayGuide, isHome, selectHome]);
  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    void markOnboardingGuided(user);
    if (replayGuide) void setReplayGuide(null);
  }, [user, replayGuide, setReplayGuide]);
  return <OnboardingGuideModal open={isHome && guideOpen && !personalLoading} onClose={closeGuide} />;
}

export default function LandingPage({ initialLayout = null }: { initialLayout?: HomeLayoutSnapshot | null }) {
  const douyin = useDouyinToolSurface();
  const communityDisabled = useInstalledCommunityDisabled();
  const contentRefreshKey = useContentRefreshKey();
  // Title is owned by page.tsx's generateMetadata (lib/page-meta.ts, key '').
  // The useDocumentTitle('', '') call that used to live here forced the tab back
  // to the bare brand after hydration, which would now overwrite that title.
  const { i18n } = useTranslation();
  // Browser-only onboarding and hostname-based registration display wait for hydration.
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
  const [personalReadyKey, setPersonalReadyKey] = useRetainedState<string | null>('home:personalReadyKey', null);
  const onPersonalReady = useCallback(() => setPersonalReadyKey(personalKey), [personalKey, setPersonalReadyKey]);
  // Maintainer requested URL-stable home sections; retain only within this session.
  const [selectedSection, setSelectedSection] = useRetainedState('home:section', 'home');
  const selectHome = useCallback(() => setSelectedSection('home'), [setSelectedSection]);
  const personalLoading = Boolean(user && (!compFollows.loaded || personalReadyKey !== personalKey));
  const isAdmin = Boolean(user?.isAdmin || isAdminWcaId(user?.wcaId));
  const activeSection = selectedSection === 'admin' && !isAdmin ? 'home' : selectedSection;
  useHomeScrollRestoration(activeSection !== 'home' || !personalLoading, activeSection);
  const selectSection = (section: string) => {
    if (section === 'admin' && !isAdmin) return;
    setSelectedSection(section);
  };
  const [featuredNotices, setFeaturedNotices] = useRetainedState<PageNotice[]>('home:featuredNotices', []);
  const { dismissed, dismiss } = usePageNoticeDismissals();
  const [publicMembers, setPublicMembers] = useRetainedState<PublicMember[] | null>('home:publicMembers', null);
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
      .catch(() => { /* 焦点新闻不可阻断首页 */ });
    return () => { active = false; window.clearTimeout(expiryTimer); };
  }, [contentRefreshKey, setFeaturedNotices]);

  useEffect(() => {
    let active = true;
    listPublicMembers()
      .then((members) => { if (active) setPublicMembers(members); })
      .catch(() => { /* 会员名单不可阻断首页 */ });
    return () => { active = false; };
  }, [setPublicMembers]);

  const t = useCallback((key: keyof typeof TEXTS) => TEXTS[key][lang], [lang]);

  // 右上角 登录 / 我的 入口,两态都是真链接、都指 /account(全站无登录弹层)。useAuthUser
  // 是 hydration-safe(SSG 首帧按未登录渲染,挂载后才切到已登录),避免 SSG/CSR 错配。

  const [editingCards, setEditingCards] = useState(false);
  const canEditCards = isAdmin && editingCards;
  const [pinnedRecons, setPinnedRecons] = useRetainedState<ReconSolve[] | null>('home:pinnedRecons', null);
  const [savingPin, setSavingPin] = useState(false);
  const pendingPin = useRef(false);
  const pinRevision = useRef(0);
  const [pinError, setPinError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const revision = pinRevision.current;
    getPinnedRecons().then(rows => { if (active && pinRevision.current === revision) setPinnedRecons(rows); }).catch(() => {
      if (active && pinRevision.current === revision) setPinError(tr({ zh: '置顶复盘加载失败，请刷新重试。', en: 'Could not load pinned recons. Please refresh to retry.' }));
    });
    return () => { active = false; };
  }, [setPinnedRecons]);
  const onPin = async (solve: ReconSolve, pinned: boolean) => {
    if (!canEditCards || pendingPin.current) return;
    pendingPin.current = true;
    setSavingPin(true);
    setPinError(null);
    try {
      await setReconHomePin(solve.id, pinned);
      pinRevision.current++;
      setPinError(null);
      setPinnedRecons(prev => pinned
        ? [solve]
        : (prev ?? []).filter(item => item.id !== solve.id));
    } catch {
      setPinError(tr({ zh: '置顶设置未保存，请重试。', en: 'Could not save the pin. Please try again.' }));
    } finally {
      pendingPin.current = false;
      setSavingPin(false);
    }
  };
  const [homeLayout, setHomeLayout] = useState(initialLayout);
  const cardOrders = homeLayout?.orders ?? {};
  const cardLocks = homeLayout?.locks ?? {};
  const locksLoaded = homeLayout !== null;
  const [locksFailed, setLocksFailed] = useState(false);
  const [locksRetry, setLocksRetry] = useState(0);
  const [savingLocks, setSavingLocks] = useState<Set<string>>(new Set());
  useEffect(() => {
    let controller: AbortController | undefined;
    let timeout: number | undefined;
    const refresh = () => {
      controller?.abort();
      window.clearTimeout(timeout);
      const request = new AbortController();
      controller = request;
      setLocksFailed(false);
      const deadline = window.setTimeout(() => {
        request.abort();
        setLocksFailed(true);
      }, 8_000);
      timeout = deadline;
      getHomeLayout(request.signal).then((layout) => {
        if (!request.signal.aborted) setHomeLayout(layout);
      }).catch(() => {
        if (!request.signal.aborted) setLocksFailed(true);
      }).finally(() => window.clearTimeout(deadline));
    };
    refresh();
    window.addEventListener('online', refresh);
    return () => {
      controller?.abort();
      window.clearTimeout(timeout);
      window.removeEventListener('online', refresh);
    };
  }, [locksRetry, contentRefreshKey]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
          setHomeLayout(current => current && { ...current, locks: { ...current.locks, [id]: !locked } });
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

  const renderCard = (card: CardConfig, editable: boolean) => {
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
    const isCalendar = card.id === 'calendar';
    const useGlass = !isDisabled && !isCalendar;
    const className = `landing-card tier-${card.tier}${useGlass ? ' af-glass-surface' : ''}${isDevelopment && !isAdmin ? ' is-disabled' : ''}`;
    let cardElement;
    if (isDisabled) {
      cardElement = (
        <div className={className} id={`card-${card.id}`}
          title={developmentLabel} aria-label={isCalendar ? t(card.nameKey) : undefined}
          aria-disabled="true" role="link">
          {content}
        </div>
      );
    } else if (card.internal) {
      cardElement = (
        <Link href={card.href} className={className} id={`card-${card.id}`} prefetch={false}
          data-analytics-entry={card.id}
          aria-label={isCalendar ? t(card.nameKey) : undefined}>
          {content}
        </Link>
      );
    } else {
      cardElement = (
        <a href={card.href} className={className} id={`card-${card.id}`}
          data-analytics-entry={card.id}
          target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    }
    return (
      <SortableCard
        key={card.id}
        id={card.id}
        draggable={editable}
      >
        {editable && renderLock(card.id, locked, card.adminOnly)}
        {cardElement}
      </SortableCard>
    );
  };

  const getCardGroup = (groupId: string, cards: CardConfig[], adminArea = false) => {
    const orderedCards = adminArea
      ? applyLandingCardOrder(cards, cardOrders[groupId] ?? [])
      : applyHomeSectionOrder(groupId, cards, cardOrders[groupId] ?? []);
    // The community's aggregate forum entry stays first; preserve stored order for the rest.
    if (groupId === 'other' && !adminArea) orderedCards.sort((a, b) => Number(b.id === 'forum') - Number(a.id === 'forum'));
    // Split the same full group by access; keep all IDs when saving its order.
    const visibleCards = orderedCards.filter((card) => (!douyin || douyinContentAvailable(card.href))
      && (!communityDisabled || !isInstalledCommunityHref(card.href)) && (isAdmin || locksLoaded)
      && (adminArea ? isAdmin && isCardLocked(card) : !isCardLocked(card)));
    return { orderedCards, visibleCards };
  };

  const renderCardGrid = (groupId: string, cards: CardConfig[], className: string, adminArea = false) => {
    const { orderedCards, visibleCards } = getCardGroup(groupId, cards, adminArea);
    if (visibleCards.length === 0) return null;
    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (!canEditCards || !over || active.id === over.id) return;
      const current = orderedCards.map((card) => card.id);
      const oldIndex = current.indexOf(String(active.id));
      const newIndex = current.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(current, oldIndex, newIndex);
      setHomeLayout(current => current && { ...current, orders: { ...current.orders, [groupId]: next } });
      reorderHomeCards(groupId, next).catch((error) => {
        console.error('homepage card reorder failed', error);
        alert(tr({ zh: `排序失败：${error.message}`, en: `Reorder failed: ${error.message}` }));
        setHomeLayout(layout => layout && { ...layout, orders: { ...layout.orders, [groupId]: current } });
      });
    };
    return (
      <DndContext key={groupId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleCards.map((card) => card.id)} strategy={rectSortingStrategy}>
          <div className={className} data-analytics-placement={groupId === 'calendar' ? 'header' : groupId}
            data-analytics-disabled={adminArea || canEditCards ? 'true' : undefined}>{visibleCards.map(card => renderCard(card, canEditCards && groupId !== 'calendar'))}</div>
        </SortableContext>
      </DndContext>
    );
  };

  const renderNavigationCards = (cards: CardConfig[], offset = 0) => cards.map((card, index) => {
    const content = <LandingCardContent label={t(card.nameKey)} Icon={card.Icon} iconImg={card.iconImg}
      iconText={card.iconText} puzzleIcon={card.puzzleIcon} record={card.record} />;
    const style = { '--nav-item-index': index + offset } as CSSProperties;
    return card.internal
      ? <Link key={card.id} href={card.href} className="home-navigation-card" style={style} prefetch={false}>{content}</Link>
      : <a key={card.id} href={card.href} className="home-navigation-card" style={style} target="_blank" rel="noopener noreferrer">{content}</a>;
  });
  const navigationFlyouts: Record<string, React.ReactNode> = {
    home: renderNavigationCards([
      ...getCardGroup('main', PRIMARY_CARDS).visibleCards,
      ...getCardGroup('wca', WCA_CARDS).visibleCards,
    ]),
    ...Object.fromEntries(SECTIONS.map(section => [section.id,
      renderNavigationCards(getCardGroup(section.id, section.cards.filter(card => card.id !== 'calendar')).visibleCards),
    ])),
    ...(isAdmin ? { admin: <>
      <Link href="/admin" className="home-navigation-card" prefetch={false}>
        <LandingCardContent label={tr({ zh: '管理后台', en: 'Admin dashboard' })} Icon={LayoutDashboard} />
      </Link>
      {renderNavigationCards([
        ...getCardGroup('main', PRIMARY_CARDS, true).visibleCards,
        ...getCardGroup('wca', WCA_CARDS, true).visibleCards,
        ...SECTIONS.flatMap(section => getCardGroup(section.id, section.cards, true).visibleCards),
      ], 1)}
    </> } : {}),
  };

  const renderMemberSections = (adminArea = false) => ([
    { id: 'enterprise', enterprise: true, eyebrow: tr({ zh: '企业', en: 'Enterprise' }), title: tr({ zh: '企业会员', en: 'Enterprise members' }) },
    { id: 'individual', enterprise: false, eyebrow: tr({ zh: '个人', en: 'Individual' }), title: tr({ zh: '个人会员', en: 'Individual members' }) },
  ] as const).map((section) => {
    const lockId = HOME_MEMBER_SECTION_IDS[section.id];
    const locked = cardLocks[lockId] ?? true;
    if ((!isAdmin && !locksLoaded) || (adminArea ? !isAdmin || !locked : locked)) return null;
    const query = memberQueries[section.id].trim().toLowerCase();
    const sectionMembers = orderedMembers.filter((member) => member.planSlug.startsWith('enterprise_') === section.enterprise);
    if (sectionMembers.length === 0) return null;
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
          {members.length === 0 && <div className="section-sub" role="status">{tr({ zh: '没有匹配的会员', en: 'No matching members' })}</div>}
        </div>
        {members.length > 0 && (
          <div className="landing-members">
            {members.map((member) => (
              <Link key={member.wcaId} href={`/wca/persons/${member.wcaId}`} className="landing-member" prefetch={false}>
                {member.avatarUrl
                  ? <img src={member.avatarUrl} alt="" className="landing-member-avatar" />
                  : <User size={24} aria-hidden="true" />}
                <span><WcaPersonTeamBadge wcaId={member.wcaId} linked={false} />{displayCuberName(member.name, lang === 'zh')}{member.vipId ? ` ${fmtVipId(member.vipId)}` : ''}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    );
  });

  // Lock-dependent links stay hidden until verified; optional data never hides the page.
  const entryStatus = !locksLoaded && (locksFailed
    ? <div role="alert">
        <p>{tr({ zh: '首页入口加载失败，请重试。', en: 'Home links could not load. Please retry.' })}</p>
        <button type="button" className="app-startup-button app-startup-button-primary"
          onClick={() => setLocksRetry(value => value + 1)}>{tr({ zh: '重试', en: 'Retry' })}</button>
      </div>
    : <SkeletonBlock className="landing-widget-skeleton" />);

  if (douyin) return <div className="landing-page">
    <div className="landing-auth"><HeaderToggles /><Link href="/account" prefetch={false}>{tr({ zh: '我的', en: 'Account' })}</Link></div>
    <div className="brand-line"><span className="brand-name">CubeRoot</span></div>
    <p>{tr({ zh: '计时、成绩记录与比赛信息查询', en: 'Timing, solve records and competition information' })}</p>
    {entryStatus}
    <div className="hero-grids">
      {renderCardGrid('main', PRIMARY_CARDS, 'primary-hero-grid')}
      {renderCardGrid('wca', WCA_CARDS, 'wca-hero-grid')}
    </div>
    {renderCardGrid('tools', SECTIONS.flatMap(section => section.cards), 'cards-container')}
  </div>;

  return (
    <>
    <div className="landing-page landing-page--navigation" data-home-section={activeSection}>
      <HomeNavigation selected={activeSection} onSelect={selectSection} isAdmin={isAdmin} flyouts={navigationFlyouts}
        sections={SECTIONS} brand={<span className="brand-line">
        <CubeRootLogoImage className="brand-logo" />
        <span className="brand-name">{t('brand')}</span>
      </span>} actions={<div className="landing-auth">
        {isAdmin && <>
        <button type="button" className="landing-auth-icon landing-edit-cards"
          aria-label={editingCards ? tr({ zh: '完成卡片编辑', en: 'Finish editing cards' }) : tr({ zh: '编辑首页卡片', en: 'Edit homepage cards' })}
          onClick={() => setEditingCards(current => !current)}>
          {editingCards ? <Check size={16} aria-hidden /> : <Pencil size={16} aria-hidden />}
        </button>
        <Link href={SHOP_ROOT} className="landing-auth-icon"
          aria-label={tr({ zh: '商店', en: 'Shop' })} prefetch={false}>
          <ShoppingBag size={16} aria-hidden="true" />
        </Link>
        <Link href="/download" className="landing-auth-icon"
          aria-label={tr({ zh: '下载', en: 'Download' })} prefetch={false}>
          <Download size={16} aria-hidden="true" />
        </Link>
        </>}

        <Link href="/membership" className="landing-auth-icon landing-membership-icon"
          aria-label="Pro" prefetch={false}>
          <Heart className="site-support-heart" size={16} aria-hidden="true" />
        </Link>
        {renderCardGrid('calendar', SECTIONS.flatMap((section) => section.cards).filter((card) => card.id === 'calendar'), 'landing-calendar-link')}
        {!user ? (
          <Link href={`/account${nextQuery(pathname)}`} className="landing-auth-btn is-login" prefetch={false}
            onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); authActions.login(); } }}
            aria-label={tr({ zh: '登录', en: 'Log in' })}>
            <User size={16} aria-hidden />
            <span>{tr({ zh: '登录', en: 'Log in' })}</span>
          </Link>
        ) : (
          <Link
            href="/account"
            aria-label={tr({ zh: '个人页面', en: 'Account' })}
            className="landing-auth-btn is-avatar"
            prefetch={false}
          >
            {authInner}
          </Link>
        )}
      </div>} />
      <PageNoticeBar />
      <LandingSearch cards={searchCards} lang={lang} workspaceEntry showChatLink />
      <div className="landing-home-content" hidden={activeSection !== 'home'}>
      <div className="landing-shortcuts-and-notices">
        <div className="landing-featured-notices">
        {featuredNotices.map((featuredNotice) => {
          const { href } = featuredNotice;
          if (!href || dismissed[featuredNotice.id] === featuredNotice.updatedAt) return null;
          const body = tr(homepageNoticeTitle(featuredNotice));
          if (featuredNotice === HISTORY_HOME_FEATURE) {
            return (
              <Link key={featuredNotice.id} href={href} className="landing-featured-news landing-history-feature" prefetch={false}>
                <img className="landing-history-preview" src="/assets/history-home-v1.webp" width={1080} height={293} alt="" decoding="async" />
                <span className="landing-featured-news-body">
                  <span className="landing-history-label">{tr({ zh: '新功能：交互历史画卷', en: 'New: an interactive history scroll' })}</span>
                  <span className="landing-history-title">{body}</span>
                  <span className="landing-history-invitation">{tr({ zh: '进入画卷，沿途看看 CubeRoot 的每一次更新。', en: 'Explore CubeRoot’s story, one day at a time.' })}</span>
                </span>
                <ArrowRight className="landing-featured-news-arrow" size={16} aria-hidden="true" />
              </Link>
            );
          }
          const FeaturedIcon = iconFor(featuredNotice);
          const inner = (
            <>
              <FeaturedIcon className="landing-featured-news-icon" size={15} aria-hidden="true" />
              <span className="landing-featured-news-body">{body}</span>
            </>
          );
          return (
            <div key={featuredNotice.id} className="landing-featured-news"
              style={{ '--home-news-color': colorFor(featuredNotice) } as CSSProperties}>
              {href.startsWith('/') && !href.startsWith('//')
                ? <Link href={href} className="landing-featured-news-target" prefetch={false}>{inner}</Link>
                : <a href={href} className="landing-featured-news-target" target="_blank" rel="noopener noreferrer">{inner}</a>}
              <div className="page-notice-actions">
                <ClearButton variant="standalone" className="page-notice-btn" onClick={() => dismiss(featuredNotice)}
                  ariaLabel={tr({ en: `Dismiss ${body}`, zh: `关闭${body}` })} />
              </div>
            </div>
          );
        })}
        </div>
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
            <Link href="/alg/3x3/zbll/run" className="landing-card af-glass-surface" prefetch={false}>
              <LandingCardContent label={tr({ zh: 'ZBLL 训练', en: 'ZBLL Training' })} />
            </Link>
            <Link href="/alg/3x3/lsll/run" className="landing-card af-glass-surface" prefetch={false}>
              <LandingCardContent label={tr({ zh: 'LSLL 训练', en: 'LSLL Training' })} />
            </Link>
          </div>
        </div>
      </div>

      {entryStatus}
      <div className="landing-home-hero">
        <TodayRecon lang={lang} pinnedRecons={pinnedRecons} isAdmin={isAdmin} canEditPins={canEditCards} savingPin={savingPin}
          pinError={pinError} onPin={onPin} emptyPin={<RecentScrambles lang={lang} />} />
        <div className="hero-grids">
          {renderCardGrid('main', PRIMARY_CARDS, 'primary-hero-grid')}
          {renderCardGrid('wca', WCA_CARDS, 'wca-hero-grid')}
        </div>
      </div>

      {!!pinnedRecons?.length && (
        <LazyVisible className="landing-widget landing-widget--scrambles" minHeight={0} rootMargin="120px 0px" initiallyVisible={visibleWidgets.scrambles} onVisible={() => rememberWidget('scrambles')}>
          <RecentScrambles lang={lang} />
        </LazyVisible>
      )}

      <LazyVisible className="landing-widget landing-widget--comps" minHeight={0} rootMargin="120px 0px" initiallyVisible={visibleWidgets.comps} onVisible={() => rememberWidget('comps')}>
        <OngoingComps lang={lang} compFollows={compFollows} />
      </LazyVisible>

      </div>

      <div className="cards-sections" hidden={activeSection === 'home' || activeSection === 'admin'}>
        {activeSection !== 'home' && entryStatus}
        {SECTIONS.map((sec) => {
          const grid = renderCardGrid(sec.id, sec.cards.filter((card) => card.id !== 'calendar'), 'cards-container');
          return (
            <section key={sec.id} id={`section-${sec.id}`} className="cards-section" aria-label={tr(sec.title)} hidden={activeSection !== sec.id}>
              {!communityDisabled && sec.id === 'other' && activeSection === 'other' && locksLoaded && !isCardLocked(sec.cards.find(card => card.id === 'forum')!) && (
                <LazyVisible className="landing-widget landing-widget--forum" minHeight={0} rootMargin="120px 0px"
                  initiallyVisible={visibleWidgets.forum} onVisible={() => rememberWidget('forum')}>
                  <ForumFeedPreview />
                </LazyVisible>
              )}
              {grid}
            </section>
          );
        })}
        <div className="landing-community-members" hidden={activeSection !== 'other'}>{renderMemberSections()}</div>
      </div>

      {isAdmin && (
        <section id="landing-admin-content" hidden={activeSection !== 'admin'} className="cards-sections" aria-label={tr({ zh: '管理', en: 'Admin' })}>
          <div className="cards-section">
            <div className="cards-container">
              <Link href="/admin" id="card-admin" className="landing-card tier-utility" prefetch={false}>
                <LandingCardContent label={tr({ zh: '管理后台', en: 'Admin dashboard' })} Icon={LayoutDashboard} />
              </Link>
              {renderCardGrid('main', PRIMARY_CARDS, 'landing-admin-card-group', true)}
              {renderCardGrid('wca', WCA_CARDS, 'landing-admin-card-group', true)}
              {SECTIONS.map((sec) => renderCardGrid(sec.id, sec.cards, 'landing-admin-card-group', true))}
            </div>
          </div>
          {renderMemberSections(true)}
        </section>
      )}

      <footer className="landing-footer-layout">
      {activeSection === 'home' && <div className="landing-contact-details">
        <LazyVisible minHeight={180} rootMargin="300px 0px" unwrapWhenVisible>
          <ContactDetails />
        </LazyVisible>
      </div>}
      <div className="landing-footer-info">
      <div className="footer">
        {/* allow-nested-link: footer entries are sibling links with text-only contents. */}
        <Link href={ABOUT_FOOTER_ENTRY.href} className="footer-about" prefetch={false}>
          {t(ABOUT_FOOTER_ENTRY.nameKey)}
        </Link>
        <Link href="/careers" prefetch={false}>
          {tr({ zh: '加入我们', en: 'Careers' })}
        </Link>
        <Link href={CREDITS_FOOTER_ENTRY.href} prefetch={false}>
          {t(CREDITS_FOOTER_ENTRY.nameKey)}
        </Link>
        <Link href={SUPPORT_FOOTER_ENTRY.href} className="footer-credits" prefetch={false}>
          <Heart className="site-support-heart" size={12} aria-hidden="true" />
          <span>{t(SUPPORT_FOOTER_ENTRY.nameKey)}</span>
        </Link>
        <Link href="/membership" className="footer-membership" prefetch={false}>
          <Crown size={14} aria-hidden="true" />
          <span>Pro</span>
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
        <Link href="/terms" prefetch={false}>
          {tr({ zh: '用户协议', en: 'User agreement' })}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {tr({ zh: '隐私政策', en: 'Privacy policy' })}
        </Link>
      </div>

      <div className="landing-footer-legal">
      <div className="beian company-contact">
        <span>{tr({ zh: '上海魔方根科技有限公司', en: 'Shanghai CubeRoot Technology Co., Ltd.' })}</span>
        <Tooltip openOnClick content={tr({
          zh: '上海市徐汇区龙耀路8号阿里巴巴徐汇滨江园区X区X5-406',
          en: 'X5-406, Zone X, Alibaba Xuhui Riverside Campus, 8 Longyao Road, Xuhui District, Shanghai',
        })}>
          {(tip) => <button {...tip} type="button" className="company-contact-address">{tr({ zh: '联系地址', en: 'Contact address' })}</button>}
        </Tooltip>
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
      </div>
      </footer>
      <Suspense fallback={null}><LandingOnboarding mounted={mounted} personalLoading={personalLoading} isHome={activeSection === 'home'} selectHome={selectHome} /></Suspense>
    </div>
    </>
  );
}
