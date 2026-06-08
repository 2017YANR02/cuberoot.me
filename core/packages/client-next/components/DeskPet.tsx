'use client';

// Clawd web desk pet — ported interaction engine from clawd-on-desk renderer.js.
// Idle = inline SVG with cursor eye-tracking; other states = <img> swap.
// Only the crab body (theme hitBox) is interactive; the rest is click-through.
// Click the crab → search overlay (which also hosts the size/char/rest/reset/hide
// controls as a toolbar below the box). There is no separate right-click menu.
// Drive from anywhere: window.dispatchEvent(new CustomEvent('clawd:state', { detail: 'happy' }))
//                  or window.clawdPet?.set('thinking') / window.clawdPet?.idle()

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import i18n from '@/i18n/i18n-client';
// SSR-safe layout effect (DeskPet is rendered in the root layout).
const useIsoLayout = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

// Lazy: the search data layer (persons/comps indexes) only loads on open.
const DeskPetSearch = dynamic(() => import('@/components/DeskPetSearch'), { ssr: false });
// Lazy: three (~1.2MB) + the cuber engine only load when the PLL performer opens.
const PllPerformerOverlay = dynamic(() => import('@/components/PllPerformerOverlay'), { ssr: false });

type ThemeId = 'clawd' | 'calico' | 'cloudling';

interface MiniTheme {
  offsetRatio: number; // box overhangs the edge by offsetRatio*W; (1-ratio)*W stays on screen
  // Edge-cling poses (the art is already drawn lying sideways). working/enterSleep
  // optional: calico has no mini-working, falls back to staying put / sleep.
  files: {
    idle: string; peek: string; enter: string; crabwalk: string;
    alert: string; happy: string; sleep: string;
    working?: string; enterSleep?: string;
  };
}

interface PetTheme {
  base: string;
  inlineIdle: boolean; // clawd uses the inline eye-tracking SVG for idle
  thumb: string;
  thumbScale?: number; // zoom the toolbar thumb to crop dead viewBox margin
  label: { zh: string; en: string
    zhHant?: string;
 };
  files: Record<string, string>;
  mini: MiniTheme;
}

// State→asset maps mirror each clawd-on-desk theme.json `states`/`reactions`.
const THEMES: Record<ThemeId, PetTheme> = {
  clawd: {
    base: '/deskpet/', inlineIdle: true,
    thumb: '/deskpet/clawd-happy.svg', thumbScale: 1.6, label: { zh: '螃蟹', en: 'Clawd' },
    files: {
      idle: 'clawd-idle-reading.svg',
      thinking: 'clawd-working-thinking.svg', working: 'clawd-working-typing.svg',
      building: 'clawd-working-building.svg', groove: 'clawd-headphones-groove.svg',
      juggling: 'clawd-working-juggling.svg', sweeping: 'clawd-working-sweeping.svg',
      carrying: 'clawd-working-carrying.svg', cubing: 'clawd-cubing.svg',
      error: 'clawd-error.svg',
      happy: 'clawd-happy.svg', notification: 'clawd-notification.svg',
      reading: 'clawd-idle-reading.svg', bubble: 'clawd-idle-bubble.svg',
      yawning: 'clawd-idle-yawn.svg', dozing: 'clawd-idle-doze.svg',
      sleeping: 'clawd-sleeping.svg', waking: 'clawd-wake.svg',
      reactDouble: 'clawd-react-double-jump.svg', reactAnnoyed: 'clawd-react-annoyed.svg',
      reactDrag: 'clawd-react-drag.svg',
    },
    mini: {
      offsetRatio: 0.486,
      files: {
        idle: 'clawd-mini-idle.svg', peek: 'clawd-mini-peek.svg',
        enter: 'clawd-mini-enter.svg', crabwalk: 'clawd-mini-crabwalk.svg',
        working: 'clawd-mini-typing.svg', alert: 'clawd-mini-alert.svg',
        happy: 'clawd-mini-happy.svg', sleep: 'clawd-mini-sleep.svg',
        enterSleep: 'clawd-mini-enter-sleep.svg',
      },
    },
  },
  calico: {
    base: '/deskpet/calico/', inlineIdle: false,
    thumb: '/deskpet/calico/calico-idle.apng', label: { zh: '三花猫', en: 'Calico',
        zhHant: "三花貓"
    },
    files: {
      idle: 'calico-idle.apng',
      thinking: 'calico-thinking.apng', working: 'calico-working-typing.apng',
      building: 'calico-working-building.apng', groove: 'calico-working-conducting.apng',
      juggling: 'calico-working-juggling.apng', sweeping: 'calico-working-sweeping.apng',
      carrying: 'calico-working-carrying.apng', cubing: 'calico-working-juggling.apng',
      error: 'calico-error.apng',
      happy: 'calico-happy.apng', notification: 'calico-notification.apng',
      reading: 'calico-idle.apng', bubble: 'calico-idle.apng',
      yawning: 'calico-yawning.apng', dozing: 'calico-dozing.apng',
      sleeping: 'calico-sleeping.apng', waking: 'calico-waking.apng',
      reactDouble: 'calico-react-poke.apng', reactAnnoyed: 'calico-react-left.apng',
      reactDrag: 'calico-react-drag.apng',
    },
    mini: {
      offsetRatio: 0.4,
      files: {
        idle: 'calico-mini-idle.apng', peek: 'calico-mini-peek.apng',
        enter: 'calico-mini-enter.apng', crabwalk: 'calico-mini-crabwalk.apng',
        alert: 'calico-mini-alert.apng', happy: 'calico-mini-happy.apng',
        sleep: 'calico-mini-sleep.apng',
      },
    },
  },
  cloudling: {
    base: '/deskpet/cloudling/', inlineIdle: false,
    thumb: '/deskpet/cloudling/cloudling-idle.svg', thumbScale: 3, label: { zh: '云宝', en: 'Cloud',
        zhHant: "雲寶"
    },
    files: {
      idle: 'cloudling-idle.svg',
      thinking: 'cloudling-thinking.svg', working: 'cloudling-typing.svg',
      building: 'cloudling-building.svg', groove: 'cloudling-conducting.svg',
      juggling: 'cloudling-juggling.svg', sweeping: 'cloudling-sweeping.svg',
      carrying: 'cloudling-carrying.svg', cubing: 'cloudling-juggling.svg',
      error: 'cloudling-error.svg',
      happy: 'cloudling-attention.svg', notification: 'cloudling-notification.svg',
      reading: 'cloudling-idle-reading.svg', bubble: 'cloudling-idle-reading.svg',
      yawning: 'cloudling-idle-to-dozing.svg', dozing: 'cloudling-dozing.svg',
      sleeping: 'cloudling-sleeping.svg', waking: 'cloudling-sleeping-to-idle.svg',
      reactDouble: 'cloudling-attention.svg', reactAnnoyed: 'cloudling-attention.svg',
      reactDrag: 'cloudling-react-drag.svg',
    },
    mini: {
      offsetRatio: 0.486,
      files: {
        idle: 'cloudling-mini-idle.svg', peek: 'cloudling-mini-peek.svg',
        enter: 'cloudling-mini-enter-roll-in.svg', crabwalk: 'cloudling-mini-crabwalk.svg',
        working: 'cloudling-mini-typing.svg', alert: 'cloudling-mini-alert.svg',
        happy: 'cloudling-mini-happy.svg', sleep: 'cloudling-mini-sleep.svg',
        enterSleep: 'cloudling-mini-enter-sleep.svg',
      },
    },
  },
};

const THEME_IDS: ThemeId[] = ['clawd', 'calico', 'cloudling'];

// one-shot states auto-return to idle after N ms
const AUTO: Record<string, number> = {
  happy: 4000, notification: 5000, error: 5000, sweeping: 5500, carrying: 3000,
  waking: 1400, reactDouble: 1800, reactAnnoyed: 3000, reading: 14000, bubble: 12000,
};

// Mini (edge-cling) mode — ported from clawd-on-desk src/mini.js + state.js.
// One-shot mini states auto-return to the mini rest pose after N ms.
const MINI_AUTO: Record<string, number> = { 'mini-alert': 4000, 'mini-happy': 4000, 'mini-peek': 1500 };
const MINI_ENTER_MS = 1200;       // play the mini-enter pose this long, then settle to mini-idle
const CRABWALK_SPEED = 0.12;      // px/ms — sideways walk speed when entering via the toolbar
const MINI_PEEK_FRAC = 0.1;       // hover peek nudges the pet this fraction of its width back on-screen
const MINI_SNAP_FRAC = 0.32;      // on drop, if the visual center is within this fraction of W from an edge → cling

// eye-tracking tuning (from clawd theme.json) — clawd only
const MAX = 3, BODY_SCALE = 0.33, SHADOW_STRETCH = 0.15, SHADOW_SHIFT = 0.3;
const REACH = MAX * 40;
const SLEEP_AFTER = 60000;
const POS_KEY = 'clawd-deskpet-pos';
const SIZE_KEY = 'clawd-deskpet-size';
const CHAR_KEY = 'clawd-deskpet-char';
const MINI_KEY = 'clawd-deskpet-mini'; // { edge, preRight, preBottom } — restore cling across reloads

type Size = 's' | 'm' | 'l';

// Each character's idle visual center as a fraction of the square container
// (measured from rendered art). The pet sits at different spots in the box, so
// we keep this point — not the box center — fixed across size/character changes.
const VC: Record<ThemeId, [number, number]> = {
  clawd: [0.5, 0.775],
  calico: [0.48, 0.477],
  cloudling: [0.5, 0.5],
};

// Viewport size excluding the scrollbar — CSS right/bottom anchor to this, not
// to window.innerWidth (which includes the scrollbar → a ~15px drift per step).
const vpW = () => document.documentElement.clientWidth;
const vpH = () => document.documentElement.clientHeight;

// Clamp the bottom-right anchor (right/bottom px) so the pet's visual center
// (fraction fx,fy of its square box) may travel a touch PAST each viewport edge,
// letting the art hang off / peek from the edge (upstream's edge-pinning). PEEK
// is how far past the edge the visual center may go, as a fraction of box size:
// at the limit ~half the centered art is clipped, so the pet clings to the edge.
// (A positive value here would instead keep the art that far inside the edge.)
const PEEK = 0.08;
const clampAnchor = (right: number, bottom: number, w: number, h: number, fx: number, fy: number) => {
  const cw = vpW(), ch = vpH();
  const mX = -w * PEEK, mY = -h * PEEK;
  return {
    right: Math.min(Math.max(mX - w * (1 - fx), right), cw - mX - w * (1 - fx)),
    bottom: Math.min(Math.max(mY - h * (1 - fy), bottom), ch - mY - h * (1 - fy)),
  };
};

// The `right` anchor (px from viewport right) that clings the box to an edge:
// the box overhangs that edge by offsetRatio*w, leaving (1-offsetRatio)*w on
// screen. peekPx nudges it that many px further on-screen (hover peek).
const miniRightPx = (offsetRatio: number, edge: 'left' | 'right', w: number, peekPx = 0) =>
  edge === 'right' ? -offsetRatio * w + peekPx : vpW() - w * (1 - offsetRatio) - peekPx;

// mini state id → theme.mini.files key
const MINI_KEYS: Record<string, keyof MiniTheme['files']> = {
  'mini-idle': 'idle', 'mini-peek': 'peek', 'mini-enter': 'enter',
  'mini-crabwalk': 'crabwalk', 'mini-working': 'working', 'mini-alert': 'alert',
  'mini-happy': 'happy', 'mini-sleep': 'sleep', 'mini-enter-sleep': 'enterSleep',
};

const CSS = `
.clawd-deskpet{position:fixed;right:max(20px,var(--sar,0px));bottom:max(20px,var(--sab,0px));
  z-index:40;pointer-events:none;--pet-scale:1;
  width:calc(var(--pet-base) * var(--pet-scale));height:calc(var(--pet-base) * var(--pet-scale));}
.clawd-deskpet.pet-front{z-index:61;} /* above the search backdrop (60) so it stays sharp */
.clawd-deskpet[data-size=s]{--pet-base:192px;}
.clawd-deskpet[data-size=m]{--pet-base:252px;}
.clawd-deskpet[data-size=l]{--pet-base:324px;}
/* Each character's art fills a different fraction of its square canvas, so scale
   the box per character (clawd = reference) to equalize on-screen pet size. */
.clawd-deskpet[data-char=calico]{--pet-scale:.42;}
.clawd-deskpet[data-char=cloudling]{--pet-scale:1.27;}
.clawd-deskpet>svg,.clawd-deskpet>img{position:absolute;inset:0;width:100%;height:100%;
  image-rendering:pixelated;-webkit-user-drag:none;pointer-events:none;}
.clawd-deskpet>img{display:none;object-fit:contain;}
.clawd-deskpet-hit{position:absolute;pointer-events:auto;cursor:grab;touch-action:none;
  -webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}
.clawd-deskpet[data-char=clawd] .clawd-deskpet-hit{left:31%;top:66%;width:38%;height:28%;}
.clawd-deskpet[data-char=calico] .clawd-deskpet-hit{left:20%;top:30%;width:60%;height:60%;}
.clawd-deskpet[data-char=cloudling] .clawd-deskpet-hit{left:27%;top:28%;width:46%;height:54%;}
.clawd-deskpet.dragging .clawd-deskpet-hit{cursor:grabbing;}
/* Mini (edge-cling) mode: the art is drawn lying sideways; flip on the left edge
   so it faces inward. The mini-anim class eases the slide-into-place / crabwalk /
   peek nudge; plain drags clear it so they stay 1:1 with the pointer. */
.clawd-deskpet.mini-anim{transition:right .14s ease-out,bottom .14s ease-out;}
.clawd-deskpet.mini-left>img{transform:scaleX(-1);}
.clawd-deskpet.mini-mode .clawd-deskpet-hit{left:0;top:0;width:100%;height:100%;}
@media (max-width:768px){
  .clawd-deskpet{right:max(12px,var(--sar,0px));bottom:max(12px,var(--sab,0px));}
  .clawd-deskpet[data-size=s]{--pet-base:144px;}
  .clawd-deskpet[data-size=m]{--pet-base:186px;}
  .clawd-deskpet[data-size=l]{--pet-base:240px;}
}
@media print{.clawd-deskpet{display:none;}}
`;

export default function DeskPet() {
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState<Size>('m');
  const [character, setCharacter] = useState<ThemeId>('clawd');
  const [hidden, setHidden] = useState(false);
  const [resting, setResting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // PLL performer overlay — opened by the toolbar button or a `clawd:perform`
  // CustomEvent (optional detail.caseName).
  const [performOpen, setPerformOpen] = useState(false);
  const [performCase, setPerformCase] = useState<string | undefined>(undefined);
  const [lang, setLang] = useState<'zh' | 'en'>('en');
  const [randomMode, setRandomMode] = useState(false);
  const pathname = usePathname();

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  // Off-screen primer input: on touch we focus it synchronously inside the tap
  // gesture so the mobile keyboard opens; the search overlay's real input then
  // takes over once it mounts (which is async, hence out of the gesture).
  const kbdRef = useRef<HTMLInputElement>(null);
  const ctrlRef = useRef<{ rest: () => void; wake: () => void; cling: () => void; inMini: () => boolean; resetPos: () => void } | null>(null);
  // Visual-center screen point captured right before a size/character change,
  // so the pet's visual center stays put (scales about itself; characters land
  // on the same point) instead of drifting from the bottom-right anchor.
  const recenterRef = useRef<{ x: number; y: number } | null>(null);
  // Pet screen center captured when search opens, so the modal can grow from it.
  const searchOriginRef = useRef<{ x: number; y: number } | null>(null);
  // Tracks the painted character so we can hide stale art during a switch
  // (the box rescales the instant data-char changes, before the img src swaps).
  const prevCharRef = useRef<ThemeId>(character);
  // Edge-cling (mini) state, mirrored out of the engine closure so the
  // size/character recenter effect can keep the pet pinned to its edge.
  const miniRef = useRef<{ active: boolean; edge: 'left' | 'right' }>({ active: false, edge: 'right' });

  useEffect(() => {
    setMounted(true);
    try {
      const sz = localStorage.getItem(SIZE_KEY);
      if (sz === 's' || sz === 'l') setSize(sz);
      const ch = localStorage.getItem(CHAR_KEY);
      if (ch === 'calico' || ch === 'cloudling') setCharacter(ch);
      if (localStorage.getItem('clawd-deskpet-mode') !== 'default') setRandomMode(true);
    } catch {}
    // Warm the search overlay chunk so the first tap mounts it without an async
    // gap — on touch that gap drops focus out of the gesture and the mobile
    // keyboard won't open.
    const warm = () => { import('@/components/DeskPetSearch').catch(() => {}); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(warm);
    else setTimeout(warm, 1500);
  }, []);

  // Re-render menu text live when language changes (DeskPet is outside I18nProvider).
  useEffect(() => {
    const update = () => setLang((i18n.language.startsWith('zh') ? 'zh' : 'en'));
    update();
    // defer via setTimeout — languageChanged fires synchronously inside I18nProvider's render,
    // calling setState during another component's render throws in React strict mode.
    const deferred = () => setTimeout(update, 0);
    i18n.on('languageChanged', deferred);
    return () => { i18n.off('languageChanged', deferred); };
  }, []);

  // Open the PLL performer from anywhere:
  //   window.dispatchEvent(new CustomEvent('clawd:perform', { detail: { caseName: 'Aa' } }))
  // detail is optional (defaults to the first case). Verification scripts the
  // bare `new CustomEvent('clawd:perform')` form.
  useEffect(() => {
    const onPerform = (e: Event) => {
      const detail = (e as CustomEvent).detail as { caseName?: string } | string | undefined;
      const name = typeof detail === 'string' ? detail : detail?.caseName;
      setPerformCase(name || undefined);
      setPerformOpen(true);
    };
    window.addEventListener('clawd:perform', onPerform as EventListener);
    return () => window.removeEventListener('clawd:perform', onPerform as EventListener);
  }, []);

  // Close the search overlay after a result navigates to a new page (the pet
  // lives in the persistent root layout, so client navigation won't unmount it).
  // Ignore locale-only changes so the toolbar's language toggle doesn't close it.
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    const page = (pathname || '').replace(/^\/(zh|en)(?=\/|$)/, '');
    if (prevPathRef.current !== null && prevPathRef.current !== page) setSearchOpen(false);
    prevPathRef.current = page;
  }, [pathname]);

  // After a size or character change, re-anchor so the pet's visual center lands
  // on the captured point (grows/shrinks about itself; characters share one
  // point). recenterRef is only set by cycleSize/cycleChar, so mount/restore skips.
  useIsoLayout(() => {
    const root = rootRef.current, pt = recenterRef.current;
    if (!root || !pt) return;
    recenterRef.current = null;
    // On a character switch the box rescales now but the engine swaps the img
    // src only after paint — hide the stale art so it can't flash at the new
    // scale. The engine effect re-reveals once the new idle frame is set.
    if (prevCharRef.current !== character) {
      prevCharRef.current = character;
      if (svgRef.current) svgRef.current.style.visibility = 'hidden';
      if (imgRef.current) imgRef.current.style.visibility = 'hidden';
    }
    const r = root.getBoundingClientRect();
    // While clinging, a size change must re-pin to the edge, not recenter.
    if (miniRef.current.active) {
      root.style.right = miniRightPx(THEMES[character].mini.offsetRatio, miniRef.current.edge, r.width) + 'px';
      return;
    }
    const [fx, fy] = VC[character];
    const c = clampAnchor(
      vpW() - pt.x - r.width * (1 - fx), vpH() - pt.y - r.height * (1 - fy),
      r.width, r.height, fx, fy);
    root.style.right = c.right + 'px';
    root.style.bottom = c.bottom + 'px';
    try { localStorage.setItem(POS_KEY, JSON.stringify({ right: c.right, bottom: c.bottom })); } catch {}
  }, [size, character]);

  useEffect(() => {
    if (!mounted) return;
    const root = rootRef.current, svg = svgRef.current, img = imgRef.current, hit = hitRef.current;
    if (!root || !svg || !img || !hit) return;
    const eyes = svg.querySelector<SVGGElement>('#clawddp-eyes');
    const body = svg.querySelector<SVGGElement>('#clawddp-body');
    const shadow = svg.querySelector<SVGGElement>('#clawddp-shadow');
    const theme = THEMES[character];

    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && typeof p.right === 'number' && typeof p.bottom === 'number') {
        const rb = root.getBoundingClientRect();
        const c = clampAnchor(p.right, p.bottom, rb.width, rb.height, VC[character][0], VC[character][1]);
        root.style.right = c.right + 'px';
        root.style.bottom = c.bottom + 'px';
      }
    } catch {}

    let state = 'idle';
    let asleep = false;
    let dragging = false;
    let dnd = false;
    let autoTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let randomTimer: ReturnType<typeof setTimeout> | undefined;

    // ── Mini (edge-cling) mode ── ported from clawd-on-desk mini.js + state.js
    let mini = false;
    let miniEdge: 'left' | 'right' = 'right';
    let miniTransitioning = false; // during enter/crabwalk — external state changes wait
    let miniPeeked = false;        // hover-nudged on screen
    let mouseOverPet = false;
    let preMiniRight = 0, preMiniBottom = 0; // normal anchor to restore on exit
    let miniTimer: ReturnType<typeof setTimeout> | undefined;
    const syncMiniRef = () => { miniRef.current = { active: mini, edge: miniEdge }; };

    const applyEye = (ox: number, oy: number) => {
      eyes?.setAttribute('transform', `translate(${ox},${oy})`);
      const bdx = Math.round(ox * BODY_SCALE * 2) / 2;
      const bdy = Math.round(oy * BODY_SCALE * 2) / 2;
      body?.setAttribute('transform', `translate(${bdx},${bdy})`);
      const sx = 1 + Math.abs(bdx) * SHADOW_STRETCH;
      const shift = Math.round(bdx * SHADOW_SHIFT * 2) / 2;
      shadow?.setAttribute('transform', `translate(${shift},0) scale(${sx},1)`);
    };

    const setState = (s: string, force = false) => {
      if (s === state && !force) return;
      clearTimeout(autoTimer);
      state = s;
      const isMini = s.startsWith('mini-');
      asleep = s === 'sleeping' || s === 'dozing' || s === 'mini-sleep';
      if (!isMini && s === 'idle' && theme.inlineIdle) {
        img.style.display = 'none';
        svg.style.display = 'block';
        svg.style.visibility = ''; // clear any hide from a character switch
        applyEye(0, 0);
      } else {
        svg.style.display = 'none';
        let file: string;
        if (isMini) {
          // calico lacks mini-working / mini-enter-sleep → fall back to idle / sleep.
          file = theme.mini.files[MINI_KEYS[s]] || theme.mini.files.idle;
        } else {
          file = theme.files[s] || theme.files.working;
        }
        // Reveal only once the new frame is decoded, so a character switch never
        // flashes the previous art at the new box scale.
        img.onload = () => { img.style.visibility = ''; };
        img.src = theme.base + file + '?_t=' + Date.now();
        img.style.display = 'block';
        if (img.complete) img.style.visibility = '';
      }
      const back = isMini ? MINI_AUTO[s] : AUTO[s];
      if (back) autoTimer = setTimeout(() => {
        if (isMini) onMiniAutoReturn(s);
        else setState('idle');
      }, back);
    };

    // After a one-shot mini pose (peek/alert/happy) finishes, settle back to the
    // mini rest pose — staying nudged-in if the cursor is still over the pet.
    const onMiniAutoReturn = (from: string) => {
      if (!mini) return;
      if (from === 'mini-peek') { miniPeeked = true; setState('mini-idle', true); return; }
      setState(dnd ? 'mini-sleep' : (mouseOverPet ? 'mini-peek' : 'mini-idle'), true);
    };

    const trackCursor = (cx: number, cy: number) => {
      if (!theme.inlineIdle || state !== 'idle' || dragging || randomMode) return;
      const r = root.getBoundingClientRect();
      const dx = cx - (r.left + r.width * 0.489);
      const dy = cy - (r.top + r.height * 0.756);
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) return applyEye(0, 0);
      const clamp = (Math.min(dist, REACH) / REACH) * MAX;
      applyEye((dx / dist) * clamp, (dy / dist) * clamp);
    };

    const goSleep = () => {
      setState('yawning');
      setTimeout(() => { if (state === 'yawning') setState('dozing'); }, 2500);
      setTimeout(() => { if (state === 'dozing') setState('sleeping'); }, 5000);
    };
    const wakeUp = () => {
      setState('waking', true);
      setTimeout(() => { if (state === 'waking') setState('idle'); }, 1400);
    };
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(goSleep, SLEEP_AFTER);
    };

    const enterRest = () => {
      dnd = true;
      clearTimeout(idleTimer);
      clearTimeout(autoTimer);
      setState(mini ? 'mini-sleep' : 'sleeping', true);
      setResting(true);
    };
    const exitRest = () => {
      dnd = false;
      setResting(false);
      if (mini) { setState('mini-idle', true); }
      else { wakeUp(); resetIdle(); }
    };

    // ── Mini-mode transitions ──
    const miniRight = (peeked: boolean) =>
      miniRightPx(theme.mini.offsetRatio, miniEdge, root.getBoundingClientRect().width,
        peeked ? MINI_PEEK_FRAC * root.getBoundingClientRect().width : 0);

    const persistMini = () => {
      try { localStorage.setItem(MINI_KEY, JSON.stringify({ edge: miniEdge, preRight: preMiniRight, preBottom: preMiniBottom })); } catch {}
    };

    // Enter cling. viaMenu → crabwalk sideways to the edge first; drag-drop →
    // slide straight into place. Both then play mini-enter, then settle to rest.
    const enterMini = (edge: 'left' | 'right', viaMenu: boolean) => {
      if (mini && !viaMenu) return;
      const r = root.getBoundingClientRect();
      preMiniRight = vpW() - r.right;
      preMiniBottom = vpH() - r.bottom;
      mini = true; miniEdge = edge; miniPeeked = false; miniTransitioning = true;
      syncMiniRef();
      clearTimeout(idleTimer); clearTimeout(autoTimer); clearTimeout(miniTimer);
      root.classList.add('mini-mode');
      root.classList.toggle('mini-left', edge === 'left');
      const target = miniRight(false);
      const settle = () => {
        miniTransitioning = false;
        setState(dnd ? 'mini-sleep' : 'mini-idle', true);
      };
      const playEnter = () => {
        root.style.transition = '';
        setState(dnd ? 'mini-enter-sleep' : 'mini-enter', true);
        miniTimer = setTimeout(settle, MINI_ENTER_MS);
      };
      if (viaMenu) {
        setState('mini-crabwalk', true);
        const dist = Math.abs((vpW() - r.right) - target);
        const dur = Math.max(250, Math.round(dist / CRABWALK_SPEED));
        root.style.transition = `right ${dur}ms linear`;
        root.style.right = target + 'px';
        miniTimer = setTimeout(playEnter, dur + 30);
      } else {
        root.style.transition = 'right .14s ease-out';
        root.style.right = target + 'px';
        playEnter();
      }
      persistMini();
    };

    // Pull out of cling back into normal mode, keeping the on-screen position.
    const liftFromMini = (pose?: string) => {
      mini = false; miniTransitioning = false; miniPeeked = false; mouseOverPet = false;
      syncMiniRef();
      clearTimeout(miniTimer);
      root.classList.remove('mini-mode', 'mini-left');
      root.style.transition = '';
      try { localStorage.removeItem(MINI_KEY); } catch {}
      if (pose) setState(pose, true);
    };

    // Cursor over the clinging pet → nudge it on-screen and peek (mouse only).
    const peekIn = () => { if (!mini || dnd || miniTransitioning) return; miniPeeked = true; root.style.transition = 'right .18s ease-out'; root.style.right = miniRight(true) + 'px'; };
    const peekOut = () => { if (!mini) return; miniPeeked = false; root.style.transition = 'right .18s ease-out'; root.style.right = miniRight(false) + 'px'; };

    // On drop: cling if the visual center landed within MINI_SNAP_FRAC of an edge.
    const snapEdge = (): 'left' | 'right' | null => {
      const r = root.getBoundingClientRect();
      const vcx = r.left + r.width * VC[character][0];
      const d = MINI_SNAP_FRAC * r.width;
      if (vcx <= d) return 'left';
      if (vcx >= vpW() - d) return 'right';
      return null;
    };

    // Toolbar toggle: cling to the nearest edge (crabwalking over) or un-cling
    // back to the pre-cling spot.
    const clingViaMenu = () => {
      if (mini) {
        const pr = preMiniRight, pb = preMiniBottom;
        liftFromMini(dnd ? 'sleeping' : 'idle');
        const rb = root.getBoundingClientRect();
        const c = clampAnchor(pr, pb, rb.width, rb.height, VC[character][0], VC[character][1]);
        root.style.transition = 'right .2s ease-out, bottom .2s ease-out';
        root.style.right = c.right + 'px'; root.style.bottom = c.bottom + 'px';
        if (!dnd) resetIdle();
        return;
      }
      const r = root.getBoundingClientRect();
      const vcx = r.left + r.width * VC[character][0];
      enterMini(vcx <= vpW() / 2 ? 'left' : 'right', true);
    };

    // Map an external/driver state to the right pose, honoring mini mode.
    const drive = (s: string) => {
      if (dnd) return;
      if (mini) {
        if (miniTransitioning) return;
        if (s === 'notification' || s === 'error') return setState('mini-alert', true);
        if (s === 'happy') return setState('mini-happy', true);
        if (s === 'working' || s === 'thinking' || s === 'juggling' || s === 'building' || s === 'sweeping' || s === 'carrying' || s === 'groove') {
          if (theme.mini.files.working) return setState('mini-working', true);
          return; // calico: keep current mini pose
        }
        if (s === 'idle') return setState(mouseOverPet ? 'mini-peek' : 'mini-idle', true);
        return;
      }
      if (s === 'idle' || theme.files[s]) setState(s, true);
    };

    let lastMove = 0;
    // Random-play mode: cycle a random expression every ~6–15s, no cursor eye-track
    // and no sleep timer (skipped while dragged / resting; drive() honors mini-cling).
    const RANDOM_POOL = ['thinking', 'working', 'building', 'groove', 'juggling', 'sweeping', 'carrying', 'cubing', 'happy', 'notification', 'reading', 'bubble', 'yawning'];
    const playRandom = () => {
      if (!dnd && !dragging) drive(RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)]);
    };
    const scheduleRandom = () => {
      randomTimer = setTimeout(() => { playRandom(); scheduleRandom(); }, 6000 + Math.random() * 9000);
    };

    const onMove = (e: PointerEvent) => {
      if (dnd || mini) return; // mini uses hover enter/leave; no eye-track / sleep timer
      const now = performance.now();
      if (now - lastMove > 16) { trackCursor(e.clientX, e.clientY); lastMove = now; }
      if (asleep) exitRest(); else if (!randomMode) resetIdle();
    };

    const openSearch = () => {
      // Touch: raise the keyboard now, inside the tap gesture, via the primer
      // input. The overlay mounts async, so focusing its real input later loses
      // the gesture and mobile browsers refuse to open the keyboard. The real
      // input takes over (no blur in between → keyboard stays up).
      if (lastTouch) { try { kbdRef.current?.focus({ preventScroll: true }); } catch {} }
      const r = root.getBoundingClientRect();
      const [fx, fy] = VC[character];
      searchOriginRef.current = { x: r.left + r.width * fx, y: r.top + r.height * fy };
      setSearchOpen(true);
    };

    let clicks = 0;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    const onClick = () => {
      if (suppressClick) { suppressClick = false; return; }
      if (dragging) return;
      if (dnd || asleep) { exitRest(); return; }
      // In cling mode a tap just opens search (no multi-click react poses).
      if (mini) { openSearch(); return; }
      // Touch: open synchronously inside the tap gesture so the search input can
      // grab focus + raise the mobile keyboard (the debounced multi-click
      // reactions below are mouse-only and would push focus past the gesture).
      if (lastTouch) { openSearch(); return; }
      clicks++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        if (clicks >= 4) setState('reactAnnoyed', true);
        else if (clicks === 2) setState('reactDouble', true);
        else if (clicks === 1) openSearch(); // single tap → search, growing from the pet
        clicks = 0;
      }, 280);
    };

    let sx = 0, sy = 0, baseR = 0, baseB = 0, baseW = 0, baseH = 0, moved = false;
    let suppressClick = false;
    let lastTouch = false;
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return; // ignore right mouse button (no context menu)
      lastTouch = e.pointerType !== 'mouse';
      suppressClick = false;
      dragging = true; moved = false;
      root.classList.add('dragging');
      root.style.transition = ''; // a leftover mini slide would fight the 1:1 drag
      hit.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      const r = root.getBoundingClientRect();
      baseR = vpW() - r.right;
      baseB = vpH() - r.bottom;
      baseW = r.width; baseH = r.height;
      // While clinging, mousedown alone must not change the pose — a mere tap
      // should still open search. The lift happens on the first real move.
      if (!dnd && !mini && e.pointerType === 'mouse') setState('reactDrag', true);
      e.preventDefault();
    };
    const onDragMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dist = Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
      if (dist > 4 && !moved) {
        moved = true;
        if (mini) liftFromMini(dnd ? 'sleeping' : 'reactDrag'); // pull out of cling
        else if (!dnd) setState('reactDrag', true); // first real move (covers touch)
      }
      const c = clampAnchor(baseR - (e.clientX - sx), baseB - (e.clientY - sy),
        baseW, baseH, VC[character][0], VC[character][1]);
      root.style.right = c.right + 'px';
      root.style.bottom = c.bottom + 'px';
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('dragging');
      try { hit.releasePointerCapture(e.pointerId); } catch {}
      if (moved) {
        suppressClick = true; // a real drag fires a trailing click — don't open search
        const edge = snapEdge();
        if (edge) { enterMini(edge, false); return; } // cling instead of free-floating
        try {
          localStorage.setItem(POS_KEY, JSON.stringify({
            right: parseInt(root.style.right || '20', 10),
            bottom: parseInt(root.style.bottom || '20', 10),
          }));
        } catch {}
      }
      if (!dnd && !mini) { setState('idle', true); resetIdle(); }
    };

    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const s = typeof detail === 'string' ? detail : detail?.state;
      if (typeof s === 'string') drive(s);
    };

    // Hover the clinging pet (mouse only) → nudge it on-screen + peek pose.
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouseOverPet = true;
      if (mini && !dnd && !miniTransitioning) { peekIn(); setState('mini-peek', true); }
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouseOverPet = false;
      if (mini && !dnd && !miniTransitioning && !dragging) { peekOut(); setState('mini-idle', true); }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('clawd:state', onExternal as EventListener);
    hit.addEventListener('click', onClick);
    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onDragMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onUp);
    hit.addEventListener('pointerenter', onEnter);
    hit.addEventListener('pointerleave', onLeave);

    ctrlRef.current = {
      rest: enterRest,
      wake: exitRest,
      cling: clingViaMenu,
      inMini: () => mini,
      resetPos: () => {
        if (mini) liftFromMini(dnd ? 'sleeping' : 'idle');
        root.style.right = '';
        root.style.bottom = '';
        root.style.transition = '';
        try { localStorage.removeItem(POS_KEY); localStorage.removeItem(MINI_KEY); } catch {}
        if (!dnd) resetIdle();
      },
    };

    (window as unknown as { clawdPet?: object }).clawdPet = {
      set: (s: string) => drive(s),
      idle: () => drive('idle'),
      cling: () => clingViaMenu(),
    };

    // Restore a saved cling (persists across reloads + character switches).
    let restoredMini = false;
    try {
      const m = JSON.parse(localStorage.getItem(MINI_KEY) || 'null');
      if (m && (m.edge === 'left' || m.edge === 'right')) {
        mini = true; miniEdge = m.edge; miniPeeked = false;
        preMiniRight = typeof m.preRight === 'number' ? m.preRight : 0;
        preMiniBottom = typeof m.preBottom === 'number' ? m.preBottom : 0;
        syncMiniRef();
        root.classList.add('mini-mode');
        root.classList.toggle('mini-left', miniEdge === 'left');
        root.style.right = miniRight(false) + 'px';
        restoredMini = true;
      }
    } catch {}

    // force: on character switch state is already 'idle', must repaint
    setState(restoredMini ? (dnd ? 'mini-sleep' : 'mini-idle') : 'idle', true);
    if (randomMode) { playRandom(); scheduleRandom(); }
    else if (!mini) resetIdle();

    return () => {
      clearTimeout(autoTimer);
      clearTimeout(idleTimer);
      clearTimeout(clickTimer);
      clearTimeout(miniTimer);
      clearTimeout(randomTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('clawd:state', onExternal as EventListener);
      hit.removeEventListener('click', onClick);
      hit.removeEventListener('pointerdown', onDown);
      hit.removeEventListener('pointermove', onDragMove);
      hit.removeEventListener('pointerup', onUp);
      hit.removeEventListener('pointercancel', onUp);
      hit.removeEventListener('pointerenter', onEnter);
      hit.removeEventListener('pointerleave', onLeave);
      ctrlRef.current = null;
      delete (window as unknown as { clawdPet?: object }).clawdPet;
    };
  }, [mounted, character, randomMode]);

  if (!mounted || hidden) return null;

  const zh = lang === 'zh';
  const t = (z: string, e: string) => (zh ? z : e);

  // Capture the pet's current visual-center screen point (for the recenter effect).
  const captureCenter = () => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const [fx, fy] = VC[character];
    recenterRef.current = { x: r.left + r.width * fx, y: r.top + r.height * fy };
  };

  const SIZE_ORDER: Size[] = ['s', 'm', 'l'];
  const cycleSize = () => {
    captureCenter();
    const next = SIZE_ORDER[(SIZE_ORDER.indexOf(size) + 1) % SIZE_ORDER.length];
    setSize(next);
    try { localStorage.setItem(SIZE_KEY, next); } catch {}
  };
  const sizeLabel = size === 's' ? t('小', 'S') : size === 'l' ? t('大', 'L') : t('中', 'M');

  const cycleChar = () => {
    captureCenter(); // capture with the OLD character's fractions before switching
    const next = THEME_IDS[(THEME_IDS.indexOf(character) + 1) % THEME_IDS.length];
    setCharacter(next);
    try { localStorage.setItem(CHAR_KEY, next); } catch {}
  };
  const charLabel = zh ? THEMES[character].label.zh : THEMES[character].label.en;

  const toggleRandom = () => {
    setRandomMode(m => {
      const next = !m;
      try { localStorage.setItem('clawd-deskpet-mode', next ? 'random' : 'default'); } catch {}
      return next;
    });
  };

  const curLang: 'zh' | 'en' = zh ? 'zh' : 'en';


  return (
    <>
      {/* Keyboard primer — focused inside the tap gesture so iOS/Android raise
          the soft keyboard before the (async) search input mounts. Must stay a
          real, non-readonly, non-display:none input or the keyboard won't show. */}
      <input
        ref={kbdRef}
        aria-hidden
        tabIndex={-1}
        inputMode="search"
        style={{ position: 'fixed', bottom: 0, left: 0, width: 1, height: 1, opacity: 0, padding: 0, margin: 0, border: 0, fontSize: 16, background: 'transparent', pointerEvents: 'none', zIndex: -1 }}
      />
      <div className={`clawd-deskpet${searchOpen ? ' pet-front' : ''}`} data-size={size} data-char={character} ref={rootRef} aria-hidden>
        <style>{CSS}</style>
        <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="-15 -25 45 45">
          <defs>
            <style>{`
              .clawddp-breathe{transform-origin:7.5px 13px;animation:clawddp-breathe 3.2s infinite ease-in-out;}
              .clawddp-blink{transform-origin:7.5px 9px;animation:clawddp-blink 4s infinite ease-in-out;}
              #clawddp-eyes,#clawddp-body,#clawddp-shadow{transition:transform .2s ease-out;}
              #clawddp-shadow{transform-origin:7.5px 15px;}
              @keyframes clawddp-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,.98) translate(0,.5px)}}
              @keyframes clawddp-blink{0%,10%,100%{transform:scaleY(1)}5%{transform:scaleY(.1)}}
            `}</style>
          </defs>
          <g id="clawddp-shadow"><rect x="3" y="15" width="9" height="1" fill="#000" opacity=".5" /></g>
          <g id="clawddp-legs" fill="#DE886D">
            <rect x="3" y="11" width="1" height="4" /><rect x="5" y="11" width="1" height="4" />
            <rect x="9" y="11" width="1" height="4" /><rect x="11" y="11" width="1" height="4" />
          </g>
          <g id="clawddp-body"><g className="clawddp-breathe">
            <rect x="2" y="6" width="11" height="7" fill="#DE886D" />
            <rect x="0" y="9" width="2" height="2" fill="#DE886D" />
            <rect x="13" y="9" width="2" height="2" fill="#DE886D" />
            <g id="clawddp-eyes" fill="#000"><g className="clawddp-blink">
              <rect x="4" y="8" width="1" height="2" /><rect x="10" y="8" width="1" height="2" />
            </g></g>
          </g></g>
        </svg>
        <img ref={imgRef} alt="" />
        <div
          className="clawd-deskpet-hit"
          ref={hitRef}
          title={t('点我搜索 / 拖动', 'click to search · drag')}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {searchOpen && (
        <DeskPetSearch
          lang={curLang}
          origin={searchOriginRef.current}
          onClose={() => setSearchOpen(false)}
          charThumb={THEMES[character].thumb}
          charScale={THEMES[character].thumbScale ?? 1}
          charLabel={charLabel}
          sizeLabel={sizeLabel}
          resting={resting}
          onCycleChar={cycleChar}
          onCycleSize={cycleSize}
          onToggleRest={() => { if (resting) ctrlRef.current?.wake(); else ctrlRef.current?.rest(); }}
          onResetPos={() => ctrlRef.current?.resetPos()}
          onCling={() => { ctrlRef.current?.cling(); setSearchOpen(false); }}
          onHide={() => { setHidden(true); setSearchOpen(false); }}
          randomMode={randomMode}
          onToggleRandom={toggleRandom}
        />
      )}

      {performOpen && (
        <PllPerformerOverlay
          lang={curLang}
          initialCaseName={performCase}
          onClose={() => setPerformOpen(false)}
        />
      )}
    </>
  );
}
