'use client';

// Desk-pet search overlay — reuses the homepage LandingSearch in a centered
// modal, with the pet controls (character / size / lang / theme / rest / reset)
// in a vertical toolbar on the left. Lazy-loaded by DeskPet so
// the site-search data layer only loads when the user actually opens search.

import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from 'react';
import { NavigationShell, type NavigationItem, type NavigationLinkProps } from '@app-foundation/navigation-ui';
import '@app-foundation/navigation-ui/navigation.css';
import { Check, Lock, LockOpen, ArrowLeft, ArrowRight, Pencil, Trash2, RotateCcw, Maximize2, Coffee, Sun, Heart, Home, Sparkles, Shuffle, MessageSquarePlus, Music, Settings } from '@app-foundation/icons/lucide';
import type { DeskPetEntry } from '@cuberoot/shared/deskpet';
import { CompactSelect } from '@/components/CompactSelect';
import BoolToggle from '@/components/BoolToggle';
import { useDeskPetVisible } from '@/hooks/useDeskPetVisible';
import { useIsMobile } from '@/hooks/useIsMobile';
import HomeLink from '@/components/HomeLink';
import LandingSearch from '@/components/LandingSearch';
import HeaderToggles from '@/components/HeaderToggles';
import WcaAuth from '@/components/WcaAuth';
import DonateModal from '@/components/DonateModal';
import FeedbackModal from '@/components/FeedbackModal';
import { SEARCH_CARDS, isLandingSearchCardVisible } from '@/lib/landing-sections';
import { isAdmin } from '@/lib/auth-store';
import { useFeedbackUnread, refreshFeedbackUnread } from '@/lib/feedback-unread';
import { tr } from '@/i18n/tr';
import { useModalBackdrop } from '@/hooks/useModalDismiss';

const CSS = `
.deskpet-search-backdrop{position:fixed;left:0;right:0;top:0;height:100dvh;z-index:100010;
  background:color-mix(in srgb, var(--background) 88%, transparent);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
.deskpet-search-backdrop:has(.landing-search-panel,.appearance-menu){z-index:100025;}
.deskpet-navigation.af-navigation{--af-nav-expanded:144px;--af-nav-header-height:0px;
  --af-nav-sidebar-bg:transparent;--af-nav-content-bg:transparent;--af-nav-text:var(--foreground);
  --af-nav-active:var(--accent);--af-nav-hover:color-mix(in srgb,var(--foreground) 9%,transparent);
  --af-nav-selected:var(--accent-soft);height:100%;min-height:0;pointer-events:none;}
.deskpet-navigation .af-nav-body{height:calc(100% - var(--af-nav-header-height));}
.deskpet-navigation .af-nav-sidebar{pointer-events:auto;}
.deskpet-navigation .af-nav-backdrop,.deskpet-navigation .af-nav-mobile-toggle{pointer-events:auto;}
.deskpet-navigation-header{display:none;}
.deskpet-navigation .deskpet-search-main{display:flex;align-items:flex-end;justify-content:center;padding:16px 16px max(12vh,48px);}
.deskpet-search-box{min-width:0;width:min(720px,100%);pointer-events:auto;will-change:transform,opacity;}
.deskpet-search-box:has(.landing-search-plus-menu){z-index:1;}
.deskpet-search-box .landing-search{margin:0;}
/* Results open above the bottom-anchored search. */
.deskpet-search-box .landing-search-panel{top:auto;bottom:calc(100% + 0.5rem);}
/* Adapt existing controls to the shared navigation rows. */
.deskpet-navigation .header-toggles,.deskpet-navigation .lang-toggle-wrap,
.deskpet-navigation .deskpet-character-select{width:100%;}
.deskpet-navigation .af-nav-link{width:100%;border:0;background:transparent;font-family:inherit;text-align:left;cursor:pointer;}
.deskpet-navigation .af-nav-link:hover{background:var(--af-nav-hover);}
.deskpet-navigation .af-nav-link.is-active{color:var(--af-nav-active);}
.deskpet-navigation .af-nav-link.char-btn{position:relative;justify-content:flex-start;}
.deskpet-navigation .char-btn .compact-select-current{display:contents;}
.deskpet-navigation .char-btn .compact-select-arrow{display:none;}
.deskpet-navigation .af-nav-link > svg,.deskpet-navigation .wca-auth-avatar,
.deskpet-navigation .wca-auth-fallback,.deskpet-toolbar-thumb{width:18px;height:18px;flex:0 0 18px;object-fit:contain;}
.deskpet-navigation .heart-icon{fill:var(--destructive);color:var(--destructive);}
/* anchored-panel: safe (fixed within backdrop, width excludes the sidebar) */
.deskpet-navigation .appearance-menu[data-backgrounds]{position:fixed;top:16px;bottom:auto;
  left:calc(var(--af-nav-width) + 8px);right:auto;transform:none;
  width:min(580px,calc(100% - var(--af-nav-width) - 24px));max-width:calc(100% - var(--af-nav-width) - 24px);max-height:calc(100% - 32px);}
@media (min-width:768px){
  .deskpet-navigation .af-nav-sidebar{position:static;top:auto;height:100%;}
}
@media (max-width:767px){
  .deskpet-navigation.af-navigation{--af-nav-header-height:48px;}
  .deskpet-navigation-header{display:flex;align-items:center;height:48px;padding:0 8px;}
  .deskpet-navigation .af-nav-mobile-toggle{width:44px;height:44px;}
  .deskpet-navigation .af-nav-mobile-toggle[aria-expanded='true']{background:var(--af-nav-selected);color:var(--af-nav-active);}
  .deskpet-navigation .deskpet-search-main{height:100%;box-sizing:border-box;padding:12px 8px max(12px,var(--sab,0px));}
  .deskpet-navigation .af-nav-sidebar{position:absolute;top:4px;left:8px;bottom:auto;
    width:min(360px,calc(100% - 16px));height:auto;max-height:calc(100% - 80px);padding:8px;
    border:1px solid var(--border-default);border-radius:16px;background:var(--glass-popover-bg,var(--popover));
    overscroll-behavior:contain;}
  .deskpet-navigation .af-nav-menu{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;}
  .deskpet-navigation .af-nav-row:last-child{grid-column:1 / -1;}
  /* The search overlay already dims the page; do not dim the toolbar a second time. */
  .deskpet-navigation .af-nav-backdrop{position:absolute;inset:0;background:transparent;}
  .deskpet-navigation .af-nav-link{height:48px;margin:0;padding:0 12px;font-size:14px;gap:10px;}
  .deskpet-navigation .af-nav-link[aria-expanded='true']{background:var(--af-nav-selected);}
  .deskpet-navigation .appearance-menu[data-backgrounds]{top:56px;left:8px;right:8px;
    width:auto;max-width:none;max-height:calc(100% - 64px);}
}

/* anchored-panel: clamped (CompactSelect body portal and visualViewport bounds) */
.deskpet-character-menu{z-index:100030;width:min(360px,calc(100vw - 16px));}
.deskpet-character-menu .compact-select-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;}
.deskpet-character-menu .compact-select-options .compact-select-option{position:relative;justify-content:center;padding:10px 4px;min-width:0;}
.deskpet-character-menu .compact-select-options .deskpet-character-option{flex-direction:column;gap:4px;white-space:normal;text-align:center;overflow-wrap:anywhere;}
.deskpet-character-admin{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0;border-top:1px solid var(--border-default);}
.deskpet-character-admin button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:32px;padding:6px;border:0;border-radius:6px;background:var(--muted);color:var(--foreground);font:inherit;cursor:pointer;}
.deskpet-character-admin button:disabled{opacity:.45;cursor:default;}
.deskpet-character-admin form{display:flex;flex-wrap:wrap;gap:6px;width:100%;}
.deskpet-character-admin label{display:flex;flex-direction:column;gap:4px;width:100%;}
.deskpet-character-admin input{min-width:0;width:100%;padding:6px;background:var(--background);color:var(--foreground);border:1px solid var(--border-default);border-radius:4px;}
.deskpet-character-lock{position:absolute;top:6px;right:6px;display:flex;}
.deskpet-character-status{display:flex;align-items:center;gap:4px;min-height:14px;color:var(--muted-foreground);}
.deskpet-character-error{color:var(--destructive);font-size:12px;}

.deskpet-character-menu .compact-select-option{padding:6px 10px;}
.deskpet-character-option{display:flex;align-items:center;gap:10px;white-space:nowrap;min-height:32px;}
.deskpet-character-thumb{display:flex;align-items:center;justify-content:center;width:32px;height:32px;overflow:hidden;flex:none;}
.deskpet-character-thumb img{width:32px;height:32px;object-fit:contain;}
.deskpet-character-check{flex:none;margin-left:2px;}
.deskpet-character-settings,.deskpet-character-gallery{margin-top:4px;padding-top:4px;border-top:1px solid var(--border-default);}
.deskpet-character-settings{display:flex;flex-direction:column;gap:2px;}
.deskpet-character-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:6px 10px;font-size:13px;}
.deskpet-character-settings .bool-toggle{width:100%;justify-content:space-between;}
.deskpet-character-sizes{display:flex;gap:2px;}
.deskpet-character-menu .deskpet-character-size{width:auto;padding:6px 10px;white-space:nowrap;}
.deskpet-character-random .pill-toggle{flex:none;}

`;

export default function DeskPetSearch({
  lang,
  origin,
  onClose,
  character,
  characters,
  catalogAdmin, catalogDisabled, catalogError, onUpdateCatalog,
  size,
  resting,
  onSelectChar,
  onSelectSize,
  onToggleRest,
  randomMode,
  onToggleRandom,
  metronomeOpen,
  onToggleMetronome,
  onOpenPetHome,
}: {
  lang: 'zh' | 'en';
  origin?: { x: number; y: number } | null;
  onClose: () => void;
  character: string;
  characters: (DeskPetEntry & { label: { zh: string; en: string }; thumb: string; thumbScale?: number })[];
  catalogAdmin: boolean;
  catalogDisabled: boolean;
  catalogError: boolean;
  onUpdateCatalog: (entries: DeskPetEntry[]) => Promise<boolean>;
  size: 's' | 'm' | 'l';
  resting: boolean;
  onSelectChar: (character: string) => void;
  onSelectSize: (size: 's' | 'm' | 'l') => void;
  onToggleRest: () => void;
  randomMode: boolean;
  onToggleRandom: () => void;
  metronomeOpen: boolean;
  onToggleMetronome: () => void;
  onOpenPetHome: () => void;
}) {
  const [petVisible, setPetVisible] = useDeskPetVisible();
  const mobile = useIsMobile(767);
  const searchCards = SEARCH_CARDS.filter((card) => isLandingSearchCardVisible(card, isAdmin()));
  const backdropRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const backdropProps = useModalBackdrop(onClose);
  const [donateOpen, setDonateOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const fbUnread = useFeedbackUnread();

  // 反馈按钮红点跟共享未读数;关掉反馈弹窗后复查一次(可能刚读过)。轮询由桌宠统一做。
  useEffect(() => {
    if (!feedbackOpen) refreshFeedbackUnread();
  }, [feedbackOpen]);
  const zh = lang === 'zh';
  const t = (z: string, e: string) => (zh ? z : e);
  const currentCharacter = characters.find(item => item.id === character);
  const [editingName, setEditingName] = useState(false);
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  useEffect(() => { setEditingName(false); }, [character]);
  const catalogEntries = () => characters.map(({ id, locked, removed, label }) => ({ id, locked, removed, label }));
  const patchCharacter = (patch: Partial<DeskPetEntry>) => onUpdateCatalog(catalogEntries().map(entry => entry.id === character ? { ...entry, ...patch } : entry));
  const moveCharacter = (delta: number) => {
    const entries = catalogEntries();
    const index = entries.findIndex(entry => entry.id === character);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    void onUpdateCatalog(entries);
  };

  // Entrance: the box grows from the pet's position out to its centered spot.
  useLayoutEffect(() => {
    const box = boxRef.current, backdrop = backdropRef.current;
    if (!box) return;
    // Focus synchronously in the commit phase: on touch this still runs inside
    // the tap gesture, so mobile browsers raise the keyboard (a deferred
    // useEffect would land after the gesture and silently fail on iOS).
    box.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    backdrop?.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 200, easing: 'ease-out', fill: 'both' });

    const r = box.getBoundingClientRect();
    const from = origin ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dx = from.x - (r.left + r.width / 2);
    const dy = from.y - (r.top + r.height / 2);
    box.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ], { duration: 260, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'both' });
  }, [origin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Check before the shared menu's document handler dismisses it.
      if (e.key === 'Escape' && !donateOpen && !feedbackOpen
        && !document.querySelector('.deskpet-character-menu, .deskpet-gallery-overlay, .deskpet-navigation .appearance-menu, .deskpet-navigation[data-mobile-open="true"]')) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, donateOpen, feedbackOpen]);

  // Prefetch the donate QRs on hover, not on open: fetching them at mount put two
  // WebPs on the wire during the entrance animation for every user who opens
  // search, and almost none of them head for the donate button. Pointer-enter
  // still lands well before the click, so the modal opens with the QRs ready.
  const donatePrefetched = useRef(false);
  const prefetchDonate = () => {
    if (donatePrefetched.current) return;
    donatePrefetched.current = true;
    ['/donate/alipay.webp', '/donate/wechat.webp'].forEach((href) => {
      const img = new Image();
      img.src = href;
    });
  };

  // Mobile keyboard: position:fixed tracks the layout viewport, which doesn't
  // shrink when the on-screen keyboard opens — so the bottom-anchored box ends
  // up hidden behind it. Pin the backdrop to the visual viewport instead, so
  // align-items:flex-end keeps the search box just above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const b = backdropRef.current;
      if (!b) return;
      const height = `${vv.height}px`, top = `${vv.offsetTop}px`;
      const width = `${vv.width}px`, left = `${vv.offsetLeft}px`;
      if (b.style.height !== height) b.style.height = height;
      if (b.style.top !== top) b.style.top = top;
      if (b.style.width !== width) b.style.width = width;
      if (b.style.left !== left) b.style.left = left;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);

  const navigation: NavigationItem[] = [
    { id: 'settings', href: '#settings', label: t('外观', 'Appearance'), icon: null },
    { id: 'pet', href: '#pet', label: t('桌宠', 'Pet'), icon: currentCharacter && <img src={currentCharacter.thumb} alt="" className="deskpet-toolbar-thumb" style={{ transform: `scale(${currentCharacter.thumbScale ?? 1})` }} /> },
    { id: 'music', href: '#music', label: t('音乐', 'Music'), icon: <Music /> },
    { id: 'home', href: '/', label: t('主页', 'Home'), icon: <Home /> },
    { id: 'account', href: '/account', label: t('我的', 'Account'), icon: null },
    { id: 'feedback', href: '#feedback', label: t('反馈', 'Feedback'), icon: <MessageSquarePlus />, badge: fbUnread || undefined },
    { id: 'donate', href: '#donate', label: t('赞助', 'Donate'), icon: <Heart className="heart-icon" /> },
  ];
  const renderNavigationItem = ({ href, ...props }: NavigationLinkProps) => {
    if (href === '/') return <HomeLink {...props} prefetch={false} onClick={() => { props.onClick?.(); onClose(); }} />;
    if (href === '#settings') return <HeaderToggles triggerClassName={props.className} triggerLabel={t('外观', 'Appearance')} labelClassName="af-nav-label" showLabels />;
    if (href === '/account') return <WcaAuth linkClassName={props.className} labelClassName="af-nav-label" onNavigate={() => { props.onClick?.(); onClose(); }} showLabel />;
    if (href === '#pet') return <CompactSelect
          openOnHover
          unstyledTrigger
          side={mobile ? 'vertical' : 'right'}
          className="deskpet-character-select"
          triggerClassName={`${props.className} char-btn`}
          popupClassName="deskpet-character-menu"
          ariaLabel={tr({ zh: '选择桌宠形象', en: 'Choose pet character' })}
          title={currentCharacter ? tr(currentCharacter.label) : undefined}
          valueText={currentCharacter ? tr(currentCharacter.label) : undefined}
          value={character}
          onChange={onSelectChar}
          label={props.children}
          items={characters.map(item => ({
            value: item.id,
            label: <span className="deskpet-character-option">
              <span className="deskpet-character-thumb" aria-hidden>
                <img src={item.thumb} alt="" style={{ transform: `scale(${item.thumbScale ?? 1})` }} />
              </span>
              <span>{tr(item.label)}</span>
              <span className="deskpet-character-status">
                <Check size={14} className="deskpet-character-check" aria-hidden
                  style={{ visibility: item.id === character ? 'visible' : 'hidden' }} />
                {catalogAdmin && <span className="deskpet-character-lock">{item.removed ? <Trash2 size={14} aria-label={tr({ zh: '已移除', en: 'Removed' })} /> : item.locked ? <Lock size={14} aria-label={tr({ zh: '仅管理员可见', en: 'Admin only' })} /> : <LockOpen size={14} aria-label={tr({ zh: '已开放', en: 'Public' })} />}</span>}
              </span>
            </span>,
          }))}
          footer={close => (
            <>
              {catalogAdmin && currentCharacter && <div className="deskpet-character-admin">
                <button type="button" disabled={catalogDisabled || currentCharacter.removed} onClick={() => { void patchCharacter({ locked: !currentCharacter.locked }); }}>
                  {currentCharacter.locked ? <Lock size={14} /> : <LockOpen size={14} />}
                  {currentCharacter.locked ? tr({ zh: '开放', en: 'Make public' }) : tr({ zh: '锁定', en: 'Lock' })}
                </button>
                <button type="button" disabled={catalogDisabled || characters[0]?.id === character} onClick={() => moveCharacter(-1)} aria-label={tr({ zh: '向前移动', en: 'Move earlier' })}><ArrowLeft size={14} /></button>
                <button type="button" disabled={catalogDisabled || characters.at(-1)?.id === character} onClick={() => moveCharacter(1)} aria-label={tr({ zh: '向后移动', en: 'Move later' })}><ArrowRight size={14} /></button>
                <button type="button" disabled={catalogDisabled} onClick={() => { setNameZh(currentCharacter.label.zh); setNameEn(currentCharacter.label.en); setEditingName(true); }}><Pencil size={14} />{tr({ zh: '名称', en: 'Name' })}</button>
                <button type="button" disabled={catalogDisabled} onClick={() => { void patchCharacter({ removed: !currentCharacter.removed, locked: true }); }}>
                  {currentCharacter.removed ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                  {currentCharacter.removed ? tr({ zh: '恢复', en: 'Restore' }) : tr({ zh: '移除', en: 'Remove' })}
                </button>
                {editingName && <form onSubmit={event => { event.preventDefault(); void patchCharacter({ label: { zh: nameZh.trim(), en: nameEn.trim() } }).then(saved => { if (saved) setEditingName(false); }); }}>
                  <label>{tr({ zh: '中文名称', en: 'Chinese name' })}<input value={nameZh} maxLength={80} onChange={event => setNameZh(event.target.value)} /></label>
                  <label>{tr({ zh: '英文名称', en: 'English name' })}<input value={nameEn} maxLength={80} onChange={event => setNameEn(event.target.value)} /></label>
                  <button type="submit" disabled={catalogDisabled || !nameZh.trim() || !nameEn.trim()}>{tr({ zh: '保存', en: 'Save' })}</button>
                  <button type="button" onClick={() => setEditingName(false)}>{tr({ zh: '取消', en: 'Cancel' })}</button>
                </form>}
                {catalogError && <span className="deskpet-character-error" role="alert">{tr({ zh: '配置加载或保存失败，请重新打开后重试。', en: 'Could not load or save settings. Reopen and retry.' })}</span>}
              </div>}
              <div className="deskpet-character-gallery">
                <button type="button" className="compact-select-option" onClick={() => { close(); onOpenPetHome(); }}>
                  <span className="deskpet-character-option"><span className="deskpet-character-thumb" aria-hidden><Home size={18} /></span>
                    {tr({ zh: '领养 / 小窝', en: 'Adopt / My pet' })}</span>
                </button>
              </div>
              <div className="deskpet-character-settings">
                <BoolToggle className="deskpet-character-setting"
                  value={petVisible} onChange={setPetVisible}
                  label={tr({ zh: '桌宠', en: 'Desk pet' })} />
                <div className="deskpet-character-setting">
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Maximize2 size={18} /></span>
                    <span>{tr({ zh: '大小', en: 'Size' })}</span>
                  </span>
                  <div className="deskpet-character-sizes" role="group" aria-label={tr({ zh: '桌宠大小', en: 'Pet size' })}>
                    {([
                      { value: 's', label: { zh: '小', en: 'S' } },
                      { value: 'm', label: { zh: '中', en: 'M' } },
                      { value: 'l', label: { zh: '大', en: 'L' } },
                    ] as const).map(item => (
                      <button key={item.value} type="button"
                        className={`compact-select-option deskpet-character-size${size === item.value ? ' active' : ''}`}
                        aria-pressed={size === item.value} onClick={() => onSelectSize(item.value)}>
                        {tr(item.label)}
                      </button>
                    ))}
                  </div>
                </div>
                <BoolToggle className="deskpet-character-setting deskpet-character-random"
                  value={randomMode} onChange={onToggleRandom}
                  ariaLabel={tr({ zh: '随机动画', en: 'Random animations' })}
                  label={<span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Shuffle size={18} /></span>
                    <span>{tr({ zh: '随机动画', en: 'Random animations' })}</span>
                  </span>} />
                <button type="button" className="compact-select-option deskpet-character-rest" onClick={onToggleRest}>
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden>
                      {resting ? <Sun size={18} /> : <Coffee size={18} />}
                    </span>
                    <span>{resting ? tr({ zh: '唤醒桌宠', en: 'Wake up' }) : tr({ zh: '休息一下', en: 'Take a nap' })}</span>
                  </span>
                </button>
              </div>
              <div className="deskpet-character-gallery">
                <button type="button" className="compact-select-option" onClick={() => {
                  close();
                  window.location.assign(`${lang === 'zh' ? '/zh' : ''}/pets/gallery?pet=${character}`);
                }}>
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Sparkles size={18} /></span>
                    <span>{tr({ zh: '图鉴', en: 'Gallery' })}</span>
                  </span>
                </button>
              </div>
            </>
          )}
        />;
    return <button type="button" className={`${props.className}${href === '#music' && metronomeOpen ? ' is-active' : ''}`}
      aria-label={props['aria-label']} title={props.title}
      onPointerEnter={href === '#donate' ? prefetchDonate : undefined}
      onFocus={href === '#donate' ? prefetchDonate : undefined}
      onClick={() => {
        props.onClick?.();
        if (href === '#donate') setDonateOpen(true);
        else if (href === '#feedback') setFeedbackOpen(true);
        else if (href === '#music') onToggleMetronome();
      }}>{props.children}</button>;
  };

  return (
    <div className="deskpet-search-backdrop" ref={backdropRef} {...backdropProps}>
      <style>{CSS}</style>
      <NavigationShell className="deskpet-navigation" mainClassName="deskpet-search-main" contentAs="div"
        items={navigation} renderLink={renderNavigationItem}
        labels={{ navigation: t('桌宠工具栏', 'Pet toolbar'), show: t('展开侧栏', 'Expand sidebar'), hide: t('收起侧栏', 'Collapse sidebar'), openMobile: t('设置', 'Settings'), closeMobile: t('关闭设置', 'Close settings') }}
        header={toggle => <div className="deskpet-navigation-header">
          {isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(toggle) ? cloneElement(toggle, {
            children: <Settings size={22} aria-hidden="true" />,
            onClick: event => {
              if (!toggle.props['aria-expanded']) boxRef.current?.querySelector<HTMLInputElement>('input')?.blur();
              toggle.props.onClick?.(event);
            },
          }) : toggle}
        </div>}>
        <div className="deskpet-search-box" ref={boxRef}>
          <LandingSearch cards={searchCards} lang={lang} />
        </div>
      </NavigationShell>
      {donateOpen && <DonateModal lang={lang} onClose={() => setDonateOpen(false)} />}
      {feedbackOpen && <FeedbackModal lang={lang} onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
