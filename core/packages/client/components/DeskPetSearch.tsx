'use client';

// Desk-pet search overlay — reuses the homepage LandingSearch in a centered
// modal, with the pet controls (character / size / lang / theme / rest / reset /
// hide) as a horizontal toolbar below the search box. Lazy-loaded by DeskPet so
// the site-search data layer only loads when the user actually opens search.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Maximize2, Coffee, EyeOff, Heart, Home, Sparkles, Shuffle, Boxes, MessageSquarePlus } from 'lucide-react';
import LandingSearch from '@/components/LandingSearch';
import HeaderToggles from '@/components/HeaderToggles';
import WcaAuth from '@/components/WcaAuth';
import DonateModal from '@/components/DonateModal';
import FeedbackModal from '@/components/FeedbackModal';
import DeskPetGallery from '@/components/DeskPetGallery';
import { SEARCH_CARDS } from '@/lib/landing-sections';
import { isAdmin } from '@/lib/auth-store';
import { useFeedbackUnread, refreshFeedbackUnread } from '@/lib/feedback-unread';

const CSS = `
.deskpet-search-backdrop{position:fixed;left:0;right:0;top:0;height:100dvh;z-index:100010;display:flex;
  flex-direction:column;align-items:center;justify-content:flex-end;padding:16px 16px max(12vh,48px);
  background:color-mix(in srgb, var(--foreground) 38%, transparent);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
.deskpet-search-box{width:min(640px,94vw);will-change:transform,opacity;}
/* Box is anchored to the bottom of the screen, so the results open upward. */
.deskpet-search-box .landing-search-panel{top:auto;bottom:calc(100% + 0.5rem);}

/* Controls render as a bare row of icons (no per-button card/border) — hover only. */
.deskpet-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;
  gap:4px;margin-top:10px;}
.deskpet-toolbar button{display:flex;align-items:center;gap:6px;border:0;cursor:pointer;
  padding:7px;border-radius:9px;
  font:13px/1 ui-sans-serif,system-ui,sans-serif;
  background:transparent;color:var(--foreground);transition:background .15s,color .15s;}
.deskpet-toolbar button:hover{background:color-mix(in srgb, var(--foreground) 9%, transparent);}
.deskpet-toolbar button.is-active{color:var(--accent);}
.deskpet-toolbar button.is-active:hover{background:color-mix(in srgb, var(--accent) 12%, transparent);}
.deskpet-toolbar .char-btn{padding:3px;overflow:hidden;}
.deskpet-toolbar-thumb{width:26px;height:26px;object-fit:contain;}
/* Donate heart — filled warm red, a theme-independent semantic color. */
.deskpet-toolbar .heart-icon{fill:#ff5a5f;color:#ff5a5f;}
.deskpet-toolbar .sep{align-self:center;width:1px;height:18px;margin:0 3px;
  background:var(--border-default);}
.deskpet-toolbar .header-toggles{display:flex;align-items:center;gap:4px;}
/* Auth control: drop the round outline so it reads as a bare icon in the row. */
.deskpet-toolbar .wca-auth-btn,.deskpet-toolbar .wca-auth-trigger{
  width:32px;height:32px;border:0;background:transparent;}
.deskpet-toolbar .wca-auth-btn:hover,.deskpet-toolbar .wca-auth-trigger:hover{
  background:color-mix(in srgb, var(--foreground) 9%, transparent);}
/* Desktop toolbar sits at the bottom, so its popups (lang / palette menus)
   open upward. On mobile the toolbar is pinned to the top, so they must open
   downward — scoped to desktop here, overridden below. */
@media (min-width:769px){
  .deskpet-toolbar .lang-menu{top:auto;bottom:calc(100% + 6px);}
}

/* Mobile: lift the controls into a fixed bar pinned to the top of the screen,
   one horizontally-scrollable row; the search box stays at the bottom. */
@media (max-width:768px){
  /* Wrap instead of horizontal scroll: overflow-x:auto would force overflow-y
     to compute as auto too, clipping the 45px toolbar over any downward popup
     menu (lang / appearance / auth). Wrapping keeps overflow visible so the
     menus show. */
  .deskpet-toolbar{position:fixed;top:0;left:0;right:0;margin:0;
    padding:6px 10px;padding-top:max(6px,var(--sat,0px));
    flex-wrap:wrap;overflow:visible;justify-content:center;gap:2px;
    background:color-mix(in srgb, var(--background) 82%, transparent);
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    border-bottom:1px solid var(--border-default);}
  .deskpet-toolbar>*{flex:0 0 auto;}
  /* Mobile toolbar is at the top, so popups open downward and left-aligned to
     their trigger so they don't run off the left edge. */
  .deskpet-toolbar .lang-menu{left:0;right:auto;top:calc(100% + 4px);bottom:auto;}
  /* Box hugs the keyboard: visualViewport shrinks the backdrop, keep only a
     small breathing gap at the bottom. */
  .deskpet-search-backdrop{padding-bottom:6px;}
}
`;

export default function DeskPetSearch({
  lang,
  origin,
  onClose,
  charThumb,
  charScale,
  charLabel,
  sizeLabel,
  resting,
  onCycleChar,
  onCycleSize,
  onToggleRest,
  onHide,
  randomMode,
  onToggleRandom,
}: {
  lang: 'zh' | 'en';
  origin?: { x: number; y: number } | null;
  onClose: () => void;
  charThumb: string;
  charScale: number;
  charLabel: string;
  sizeLabel: string;
  resting: boolean;
  onCycleChar: () => void;
  onCycleSize: () => void;
  onToggleRest: () => void;
  onHide: () => void;
  randomMode: boolean;
  onToggleRandom: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const fbUnread = useFeedbackUnread();
  const router = useRouter();

  // 反馈按钮红点跟共享未读数;关掉反馈弹窗后复查一次(可能刚读过)。轮询由桌宠统一做。
  useEffect(() => {
    if (!feedbackOpen) refreshFeedbackUnread();
  }, [feedbackOpen]);
  const zh = lang === 'zh';
  const t = (z: string, e: string) => (zh ? z : e);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prefetch the donate QRs (small WebP) once the search panel is open, so the
  // heart button shows them instantly instead of fetching on click.
  useEffect(() => {
    ['/donate/alipay.webp', '/donate/wechat.webp'].forEach((href) => {
      const img = new Image();
      img.src = href;
    });
  }, []);

  // Mobile keyboard: position:fixed tracks the layout viewport, which doesn't
  // shrink when the on-screen keyboard opens — so the bottom-anchored box ends
  // up hidden behind it. Pin the backdrop to the visual viewport instead, so
  // align-items:flex-end keeps the search box just above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // iOS's visualViewport bottom lands ABOVE the form accessory bar (the
    // dev.cuberoot.me / arrows / Done strip), and iOS exposes no keyboard-inset
    // to locate it. When the keyboard is up, push the backdrop bottom past
    // vv-bottom by a fixed amount so the box hugs that strip — the band between
    // vv-bottom and the strip is actually visible, so the box stays on-screen.
    const IOS_ACCESSORY = 30; // measured: vv-bottom sits ~30px above the iOS form accessory bar
    const apply = () => {
      const b = backdropRef.current;
      if (!b) return;
      const kbOpen = window.innerHeight - vv.height - vv.offsetTop > 100;
      b.style.height = `${vv.height + (kbOpen ? IOS_ACCESSORY : 0)}px`;
      b.style.top = `${vv.offsetTop}px`;
    };
    apply();
    // The keyboard animates in over a few hundred ms (and the URL bar may shift),
    // so visualViewport settles late. Re-apply a few times so the box ends up
    // flush against the keyboard instead of stranded mid-screen.
    const retries = [60, 150, 300, 500].map(d => setTimeout(apply, d));
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      retries.forEach(clearTimeout);
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, []);

  return (
    <div
      className="deskpet-search-backdrop"
      ref={backdropRef}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{CSS}</style>
      <div className="deskpet-search-box" ref={boxRef}>
        <LandingSearch cards={SEARCH_CARDS} lang={lang} />
      </div>
      <div className="deskpet-toolbar">
        <button type="button" className="icon-only" onClick={() => { router.push(lang === 'zh' ? '/zh' : '/'); onClose(); }}
          title={t('主页', 'Home')}>
          <Home size={16} />
        </button>
        <HeaderToggles />
        <WcaAuth onNavigate={onClose} />
        <button type="button" className="icon-only" onClick={() => setDonateOpen(true)}
          title={t('赞助', 'Donate')}>
          <Heart size={16} className="heart-icon" />
        </button>
        <button type="button" className="icon-only" onClick={() => setFeedbackOpen(true)}
          title={t('反馈', 'Feedback')} style={{ position: 'relative' }}>
          <MessageSquarePlus size={16} />
          {fbUnread > 0 && (
            <span aria-hidden style={{
              position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', boxShadow: '0 0 0 2px var(--card, var(--background))',
            }} />
          )}
        </button>
        <span className="sep" />
        <button type="button" className="icon-only char-btn" onClick={onCycleChar}
          title={`${t('形象', 'Character')}: ${charLabel}`}>
          <img src={charThumb} alt="" className="deskpet-toolbar-thumb"
            style={charScale !== 1 ? { transform: `scale(${charScale})` } : undefined} />
        </button>
        <button type="button" className="icon-only" onClick={onCycleSize}
          title={`${t('大小', 'Size')}: ${sizeLabel}`}>
          <Maximize2 size={16} />
        </button>
        {isAdmin() && (
          <>
            <button type="button" className="icon-only" onClick={() => setGalleryOpen(true)}
              title={t('动画图鉴', 'Animations')}>
              <Sparkles size={16} />
            </button>
            <button type="button" className="icon-only" onClick={() => {
              window.dispatchEvent(new CustomEvent('clawd:perform'));
              onClose();
            }}
              title={t('PLL 表演', 'PLL Show')}>
              <Boxes size={16} />
            </button>
          </>
        )}
        <button type="button" className={`icon-only${randomMode ? ' is-active' : ''}`} onClick={onToggleRandom}
          title={randomMode ? t('动画:随机', 'Animation: Random') : t('动画:默认', 'Animation: Default')}>
          <Shuffle size={16} />
        </button>
        <button type="button" className="icon-only" onClick={onToggleRest}
          title={resting ? t('叫醒它', 'Wake up') : t('休息一下', 'Take a nap')}>
          <Coffee size={16} />
        </button>
        <button type="button" className="icon-only" onClick={onHide}
          title={t('隐藏,刷新后恢复', 'Hide, restored on reload')}>
          <EyeOff size={16} />
        </button>
      </div>
      {donateOpen && <DonateModal lang={lang} onClose={() => setDonateOpen(false)} />}
      {feedbackOpen && <FeedbackModal lang={lang} onClose={() => setFeedbackOpen(false)} />}
      {galleryOpen && <DeskPetGallery lang={lang} onClose={() => setGalleryOpen(false)} />}
    </div>
  );
}
