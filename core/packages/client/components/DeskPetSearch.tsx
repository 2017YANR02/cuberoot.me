'use client';

// Desk-pet search overlay — reuses the homepage LandingSearch in a centered
// modal, with the pet controls (character / size / lang / theme / rest / reset)
// as a horizontal toolbar below the search box. Lazy-loaded by DeskPet so
// the site-search data layer only loads when the user actually opens search.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Maximize2, Coffee, Sun, Heart, Home, Sparkles, Shuffle, MessageSquarePlus, Music, Share2 } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import BoolToggle from '@/components/BoolToggle';
import HomeLink from '@/components/HomeLink';
import LandingSearch from '@/components/LandingSearch';
import HeaderToggles from '@/components/HeaderToggles';
import WcaAuth from '@/components/WcaAuth';
import DonateModal from '@/components/DonateModal';
import FeedbackModal from '@/components/FeedbackModal';
import DeskPetGallery from '@/components/DeskPetGallery';
import { MobilePageShareModal, WeChatPcShareModal } from '@/components/WeChatPcShareModal';
import { SEARCH_CARDS, isLandingSearchCardVisible } from '@/lib/landing-sections';
import { isAdmin } from '@/lib/auth-store';
import { useFeedbackUnread, refreshFeedbackUnread } from '@/lib/feedback-unread';
import { isInWeChat } from '@/lib/wechat-share';
import { tr } from '@/i18n/tr';

const CSS = `
.deskpet-search-backdrop{position:fixed;left:0;right:0;top:0;height:100dvh;z-index:100010;display:flex;
  flex-direction:column;align-items:center;justify-content:flex-end;padding:16px 16px max(12vh,48px);
  background:color-mix(in srgb, var(--foreground) 38%, transparent);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
.deskpet-search-box{width:min(720px,100%);will-change:transform,opacity;}
.deskpet-search-box .landing-search{margin:0;}
/* Box is anchored to the bottom of the screen, so the results open upward. */
.deskpet-search-box .landing-search-panel{top:auto;bottom:calc(100% + 0.5rem);}

/* Controls render as a bare row of icons (no per-button card/border) — hover only. */
.deskpet-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;
  gap:0;width:min(720px,100%);margin:0;}
.deskpet-toolbar button,.deskpet-toolbar a{display:flex;align-items:center;gap:6px;border:0;cursor:pointer;
  padding:7px;border-radius:9px;text-decoration:none;
  font:13px/1 ui-sans-serif,system-ui,sans-serif;
  background:transparent;color:var(--foreground);transition:background .15s,color .15s;}
.deskpet-toolbar button:hover,.deskpet-toolbar a:hover{background:color-mix(in srgb, var(--foreground) 9%, transparent);}
.deskpet-toolbar button.is-active,.deskpet-toolbar a.is-active{color:var(--accent);}
.deskpet-toolbar button.is-active:hover,.deskpet-toolbar a.is-active:hover{background:color-mix(in srgb, var(--accent) 12%, transparent);}
.deskpet-toolbar-thumb{width:26px;height:26px;object-fit:contain;}
.deskpet-toolbar .deskpet-character-select{align-self:center;}
.deskpet-toolbar .char-btn{position:relative;justify-content:center;width:44px;min-height:54px;padding:6px;}
.deskpet-toolbar .char-btn .compact-select-current{overflow:visible;}
.deskpet-character-label{display:flex;flex-direction:column;align-items:center;gap:4px;}
.deskpet-toolbar .char-btn .compact-select-arrow{display:none;}
/* anchored-panel: clamped (CompactSelect body portal and visualViewport bounds) */
.deskpet-character-menu{z-index:100030;}
.deskpet-character-menu .compact-select-option{padding:6px 10px;}
.deskpet-character-option{display:flex;align-items:center;gap:10px;white-space:nowrap;min-height:32px;}
.deskpet-character-thumb{display:flex;align-items:center;justify-content:center;width:32px;height:32px;overflow:hidden;flex:none;}
.deskpet-character-thumb img{width:32px;height:32px;object-fit:contain;}
.deskpet-character-check{flex:none;margin-left:2px;}
.deskpet-character-settings,.deskpet-character-gallery{margin-top:4px;padding-top:4px;border-top:1px solid var(--border-default);}
.deskpet-character-settings{display:flex;flex-direction:column;gap:2px;}
.deskpet-character-setting{display:flex;align-items:center;gap:12px;padding:6px 10px;font-size:13px;}
.deskpet-character-sizes{display:flex;gap:2px;}
.deskpet-character-menu .deskpet-character-size{width:auto;padding:6px 10px;white-space:nowrap;}
.deskpet-character-random .bool-toggle-label{order:-1;}
.deskpet-character-random .pill-toggle{flex:none;}
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
/* Keep search and tools together, including above the mobile keyboard. */
.deskpet-toolbar > button,.deskpet-toolbar > a,
.deskpet-toolbar .header-toggles > .lang-toggle-wrap > :is(button,a){
  flex-direction:column;justify-content:center;gap:4px;min-width:44px;width:auto;height:auto;min-height:54px;padding:6px;}
.deskpet-toolbar > button > svg,.deskpet-toolbar > a > svg,
.deskpet-toolbar .header-toggles > .lang-toggle-wrap > :is(button,a) > svg{width:20px;height:20px;}
.deskpet-toolbar .toolbar-label{font-size:11px;line-height:14px;white-space:nowrap;}
.deskpet-toolbar .wca-auth-avatar,.deskpet-toolbar .wca-auth-fallback,
.deskpet-toolbar-thumb{width:20px;height:20px;flex:none;}
.deskpet-toolbar .header-toggles{gap:0;}
.deskpet-toolbar .lang-menu{top:auto;bottom:calc(100% + 6px);}
@media (max-width:768px){
  .deskpet-toolbar>*{flex:0 0 auto;}
  .deskpet-toolbar .sep{display:none;}
  .deskpet-search-backdrop{padding-bottom:max(6px,var(--sab,0px));}
}

`;

export default function DeskPetSearch({
  lang,
  origin,
  onClose,
  character,
  characters,
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
  characters: { id: string; label: { zh: string; en: string }; thumb: string; thumbScale?: number }[];
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
  const searchCards = SEARCH_CARDS.filter((card) => isLandingSearchCardVisible(card, isAdmin()));
  const backdropRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [wechatShareOpen, setWechatShareOpen] = useState(false);
  const [mobileShareHelp, setMobileShareHelp] = useState<'wechat' | 'browser' | null>(null);
  const fbUnread = useFeedbackUnread();

  // 反馈按钮红点跟共享未读数;关掉反馈弹窗后复查一次(可能刚读过)。轮询由桌宠统一做。
  useEffect(() => {
    if (!feedbackOpen) refreshFeedbackUnread();
  }, [feedbackOpen]);
  const zh = lang === 'zh';
  const t = (z: string, e: string) => (zh ? z : e);
  const currentCharacter = characters.find(item => item.id === character);

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
      if (e.key === 'Escape' && !document.querySelector('.deskpet-character-menu, .deskpet-gallery-overlay')) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

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

  const shareCurrentPage = () => {
    if (isInWeChat()) {
      setMobileShareHelp('wechat');
      return;
    }

    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || window.matchMedia('(max-width: 768px)').matches;
    if (!mobile) {
      setWechatShareOpen(true);
      return;
    }

    if (typeof navigator.share !== 'function') {
      setMobileShareHelp('browser');
      return;
    }

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;
    void navigator.share({
      title: document.title,
      text: description || undefined,
      url: window.location.href,
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMobileShareHelp('browser');
    });
  };

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
        <LandingSearch cards={searchCards} lang={lang} />
      </div>
      <div className="deskpet-toolbar">
        <HomeLink className="icon-only" prefetch={false} onClick={onClose}
          title={t('主页', 'Home')} aria-label={t('主页', 'Home')}>
          <Home size={16} />
          <span className="toolbar-label">{t('主页', 'Home')}</span>
        </HomeLink>
        <HeaderToggles showLabels />
        <WcaAuth onNavigate={onClose} showLabel />
        <button type="button" className="icon-only" onClick={() => setDonateOpen(true)}
          onPointerEnter={prefetchDonate} onFocus={prefetchDonate}
          title={t('赞助', 'Donate')}>
          <Heart size={16} className="heart-icon" />
          <span className="toolbar-label">{t('赞助', 'Donate')}</span>
        </button>
        <button type="button" className="icon-only" onClick={() => setFeedbackOpen(true)}
          title={t('反馈', 'Feedback')} style={{ position: 'relative' }}>
          <MessageSquarePlus size={16} />
          <span className="toolbar-label">{t('反馈', 'Feedback')}</span>
          {fbUnread > 0 && (
            <span aria-hidden style={{
              position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', boxShadow: '0 0 0 2px var(--card, var(--background))',
            }} />
          )}
        </button>
        <button type="button" className="icon-only" onClick={shareCurrentPage}
          title={tr({ zh: '分享当前页面', en: 'Share this page' })}
          aria-label={tr({ zh: '分享当前页面', en: 'Share this page' })}>
          <Share2 size={16} />
          <span className="toolbar-label">{t('分享', 'Share')}</span>
        </button>
        <button type="button" className={`icon-only${metronomeOpen ? ' is-active' : ''}`}
          onClick={onToggleMetronome}
          title={t('音乐与节拍器', 'Music and metronome')}>
          <Music size={16} />
          <span className="toolbar-label">{t('音乐', 'Music')}</span>
        </button>
        <span className="sep" />
        <CompactSelect
          openOnHover
          className="deskpet-character-select"
          triggerClassName="char-btn"
          popupClassName="deskpet-character-menu"
          ariaLabel={tr({ zh: '选择桌宠形象', en: 'Choose pet character' })}
          title={currentCharacter ? tr(currentCharacter.label) : undefined}
          valueText={currentCharacter ? tr(currentCharacter.label) : undefined}
          value={character}
          onChange={onSelectChar}
          label={<span className="deskpet-character-label">
            {currentCharacter && <img src={currentCharacter.thumb} alt="" className="deskpet-toolbar-thumb"
              style={{ transform: `scale(${currentCharacter.thumbScale ?? 1})` }} />}
            <span className="toolbar-label">{tr({ zh: '桌宠', en: 'Pet' })}</span>
          </span>}
          items={characters.map(item => ({
            value: item.id,
            label: <span className="deskpet-character-option">
              <span className="deskpet-character-thumb" aria-hidden>
                <img src={item.thumb} alt="" style={{ transform: `scale(${item.thumbScale ?? 1})` }} />
              </span>
              <span>{tr(item.label)}</span>
              <Check size={14} className="deskpet-character-check" aria-hidden
                style={{ visibility: item.id === character ? 'visible' : 'hidden' }} />
            </span>,
          }))}
          footer={close => (
            <>
              <div className="deskpet-character-gallery">
                <button type="button" className="compact-select-option" onClick={() => { close(); onOpenPetHome(); }}>
                  <span className="deskpet-character-option"><span className="deskpet-character-thumb" aria-hidden><Home size={18} /></span>
                    {tr({ zh: '宠物小窝', en: 'Pet home' })}</span>
                </button>
              </div>
              <div className="deskpet-character-settings">
                <div className="deskpet-character-setting">
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Maximize2 size={18} /></span>
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
                  setGalleryOpen(true);
                }}>
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Sparkles size={18} /></span>
                    <span>{tr({ zh: '图鉴', en: 'Gallery' })}</span>
                  </span>
                </button>
              </div>
            </>
          )}
        />
      </div>
      {donateOpen && <DonateModal lang={lang} onClose={() => setDonateOpen(false)} />}
      {feedbackOpen && <FeedbackModal lang={lang} onClose={() => setFeedbackOpen(false)} />}
      {galleryOpen && <DeskPetGallery lang={lang} character={character} characters={characters} onClose={() => setGalleryOpen(false)} />}
      {wechatShareOpen && <WeChatPcShareModal onClose={() => setWechatShareOpen(false)} />}
      {mobileShareHelp && (
        <MobilePageShareModal mode={mobileShareHelp} onClose={() => setMobileShareHelp(null)} />
      )}
    </div>
  );
}
