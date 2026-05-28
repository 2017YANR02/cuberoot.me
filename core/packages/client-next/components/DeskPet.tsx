'use client';

// Clawd web desk pet — ported interaction engine from clawd-on-desk renderer.js.
// Idle = inline SVG with cursor eye-tracking; other states = <img> swap.
// Only the crab body (theme hitBox) is interactive; the rest is click-through.
// Right-click the crab → context menu (size / rest / reset / hide).
// Drive from anywhere: window.dispatchEvent(new CustomEvent('clawd:state', { detail: 'happy' }))
//                  or window.clawdPet?.set('thinking') / window.clawdPet?.idle()

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, Maximize2 } from 'lucide-react';
import HeaderToggles from '@/components/HeaderToggles';
import i18n from '@/i18n/i18n-client';

// SSR-safe layout effect (DeskPet is rendered in the root layout).
const useIsoLayout = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

// Lazy: the search data layer (persons/comps indexes) only loads on open.
const DeskPetSearch = dynamic(() => import('@/components/DeskPetSearch'), { ssr: false });

type ThemeId = 'clawd' | 'calico' | 'cloudling';

interface PetTheme {
  base: string;
  inlineIdle: boolean; // clawd uses the inline eye-tracking SVG for idle
  thumb: string;
  label: { zh: string; en: string };
  files: Record<string, string>;
}

// State→asset maps mirror each clawd-on-desk theme.json `states`/`reactions`.
const THEMES: Record<ThemeId, PetTheme> = {
  clawd: {
    base: '/deskpet/', inlineIdle: true,
    thumb: '/deskpet/clawd-happy.svg', label: { zh: '螃蟹', en: 'Clawd' },
    files: {
      idle: 'clawd-idle-reading.svg',
      thinking: 'clawd-working-thinking.svg', working: 'clawd-working-typing.svg',
      building: 'clawd-working-building.svg', groove: 'clawd-headphones-groove.svg',
      juggling: 'clawd-working-juggling.svg', sweeping: 'clawd-working-sweeping.svg',
      carrying: 'clawd-working-carrying.svg', error: 'clawd-error.svg',
      happy: 'clawd-happy.svg', notification: 'clawd-notification.svg',
      reading: 'clawd-idle-reading.svg', bubble: 'clawd-idle-bubble.svg',
      yawning: 'clawd-idle-yawn.svg', dozing: 'clawd-idle-doze.svg',
      sleeping: 'clawd-sleeping.svg', waking: 'clawd-wake.svg',
      reactDouble: 'clawd-react-double-jump.svg', reactAnnoyed: 'clawd-react-annoyed.svg',
      reactDrag: 'clawd-react-drag.svg',
    },
  },
  calico: {
    base: '/deskpet/calico/', inlineIdle: false,
    thumb: '/deskpet/calico/calico-idle.apng', label: { zh: '三花猫', en: 'Calico' },
    files: {
      idle: 'calico-idle.apng',
      thinking: 'calico-thinking.apng', working: 'calico-working-typing.apng',
      building: 'calico-working-building.apng', groove: 'calico-working-conducting.apng',
      juggling: 'calico-working-juggling.apng', sweeping: 'calico-working-sweeping.apng',
      carrying: 'calico-working-carrying.apng', error: 'calico-error.apng',
      happy: 'calico-happy.apng', notification: 'calico-notification.apng',
      reading: 'calico-idle.apng', bubble: 'calico-idle.apng',
      yawning: 'calico-yawning.apng', dozing: 'calico-dozing.apng',
      sleeping: 'calico-sleeping.apng', waking: 'calico-waking.apng',
      reactDouble: 'calico-react-poke.apng', reactAnnoyed: 'calico-react-left.apng',
      reactDrag: 'calico-react-drag.apng',
    },
  },
  cloudling: {
    base: '/deskpet/cloudling/', inlineIdle: false,
    thumb: '/deskpet/cloudling/cloudling-idle.svg', label: { zh: '云宝', en: 'Cloud' },
    files: {
      idle: 'cloudling-idle.svg',
      thinking: 'cloudling-thinking.svg', working: 'cloudling-typing.svg',
      building: 'cloudling-building.svg', groove: 'cloudling-conducting.svg',
      juggling: 'cloudling-juggling.svg', sweeping: 'cloudling-sweeping.svg',
      carrying: 'cloudling-carrying.svg', error: 'cloudling-error.svg',
      happy: 'cloudling-attention.svg', notification: 'cloudling-notification.svg',
      reading: 'cloudling-idle-reading.svg', bubble: 'cloudling-idle-reading.svg',
      yawning: 'cloudling-idle-to-dozing.svg', dozing: 'cloudling-dozing.svg',
      sleeping: 'cloudling-sleeping.svg', waking: 'cloudling-sleeping-to-idle.svg',
      reactDouble: 'cloudling-attention.svg', reactAnnoyed: 'cloudling-attention.svg',
      reactDrag: 'cloudling-react-drag.svg',
    },
  },
};

const THEME_IDS: ThemeId[] = ['clawd', 'calico', 'cloudling'];

// one-shot states auto-return to idle after N ms
const AUTO: Record<string, number> = {
  happy: 4000, notification: 5000, error: 5000, sweeping: 5500, carrying: 3000,
  waking: 1400, reactDouble: 1800, reactAnnoyed: 3000, reading: 14000, bubble: 12000,
};

// eye-tracking tuning (from clawd theme.json) — clawd only
const MAX = 3, BODY_SCALE = 0.33, SHADOW_STRETCH = 0.15, SHADOW_SHIFT = 0.3;
const REACH = MAX * 40;
const SLEEP_AFTER = 60000;
const POS_KEY = 'clawd-deskpet-pos';
const SIZE_KEY = 'clawd-deskpet-size';
const CHAR_KEY = 'clawd-deskpet-char';

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
// (fraction fx,fy of its square box) can approach either edge symmetrically,
// leaving a 25%-of-box margin on every side. Replaces the old asymmetric
// [0, vp-48] clamp, which pinned the box flush-right (art stopped short of the
// right edge because the art only fills the box's center) yet let the box slide
// almost fully off the left (art overflowed).
const EDGE = 0.25;
const clampAnchor = (right: number, bottom: number, w: number, h: number, fx: number, fy: number) => {
  const cw = vpW(), ch = vpH();
  const mX = w * EDGE, mY = h * EDGE;
  return {
    right: Math.min(Math.max(mX - w * (1 - fx), right), cw - mX - w * (1 - fx)),
    bottom: Math.min(Math.max(mY - h * (1 - fy), bottom), ch - mY - h * (1 - fy)),
  };
};

const CSS = `
.clawd-deskpet{position:fixed;right:max(20px,var(--sar,0px));bottom:max(20px,var(--sab,0px));
  z-index:40;pointer-events:none;--pet-scale:1;
  width:calc(var(--pet-base) * var(--pet-scale));height:calc(var(--pet-base) * var(--pet-scale));}
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
@media (max-width:768px){
  .clawd-deskpet{right:max(12px,var(--sar,0px));bottom:max(12px,var(--sab,0px));}
  .clawd-deskpet[data-size=s]{--pet-base:144px;}
  .clawd-deskpet[data-size=m]{--pet-base:186px;}
  .clawd-deskpet[data-size=l]{--pet-base:240px;}
}
@media print{.clawd-deskpet{display:none;}}

.clawd-menu{position:fixed;z-index:50;min-width:148px;padding:4px;border-radius:11px;
  background:var(--popover);color:var(--popover-foreground);
  border:1px solid var(--border-default);
  box-shadow:0 10px 30px color-mix(in srgb, var(--foreground) 18%, transparent);
  font:13px/1.4 ui-sans-serif,system-ui,sans-serif;user-select:none;}
.clawd-menu .label{padding:5px 10px 3px;font-size:11px;color:var(--muted-foreground);}
.clawd-menu .row{display:flex;gap:4px;padding:0 2px 2px;}
.clawd-menu .row button{flex:1;display:flex;align-items:center;justify-content:center;
  padding:6px 0;border-radius:7px;background:color-mix(in srgb, var(--foreground) 5%, transparent);}
.clawd-menu .row button[data-on=true]{background:var(--accent-soft);color:var(--accent);}
.clawd-menu>button{display:flex;align-items:center;width:100%;padding:7px 10px;border-radius:7px;
  text-align:left;}
.clawd-menu button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;}
.clawd-menu>button:hover,.clawd-menu .row button:hover{
  background:color-mix(in srgb, var(--foreground) 9%, transparent);}
.clawd-menu hr{border:0;border-top:1px solid var(--border-default);margin:4px 6px;}
.clawd-menu-bar{display:flex;align-items:center;gap:10px;padding:6px 8px;}
.clawd-menu-bar>button{display:flex;align-items:center;justify-content:center;padding:4px;
  border-radius:7px;background:transparent;}
.clawd-menu-bar>button:hover{background:color-mix(in srgb, var(--foreground) 8%, transparent);}
.clawd-menu-bar .header-toggles{gap:14px;margin-left:auto;}
.clawd-menu-bar .lang-toggle,.clawd-menu-bar .theme-toggle-inline{color:var(--popover-foreground);}
.clawd-menu-thumb{width:20px;height:20px;object-fit:contain;image-rendering:pixelated;}
`;

export default function DeskPet() {
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState<Size>('m');
  const [character, setCharacter] = useState<ThemeId>('clawd');
  const [hidden, setHidden] = useState(false);
  const [resting, setResting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>('en');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<{ rest: () => void; wake: () => void; resetPos: () => void } | null>(null);
  // Visual-center screen point captured right before a size/character change,
  // so the pet's visual center stays put (scales about itself; characters land
  // on the same point) instead of drifting from the bottom-right anchor.
  const recenterRef = useRef<{ x: number; y: number } | null>(null);
  // Pet screen center captured when search opens, so the modal can grow from it.
  const searchOriginRef = useRef<{ x: number; y: number } | null>(null);
  // Tracks the painted character so we can hide stale art during a switch
  // (the box rescales the instant data-char changes, before the img src swaps).
  const prevCharRef = useRef<ThemeId>(character);

  useEffect(() => {
    setMounted(true);
    try {
      const sz = localStorage.getItem(SIZE_KEY);
      if (sz === 's' || sz === 'l') setSize(sz);
      const ch = localStorage.getItem(CHAR_KEY);
      if (ch === 'calico' || ch === 'cloudling') setCharacter(ch);
    } catch {}
  }, []);

  // Re-render menu text live when language changes (DeskPet is outside I18nProvider).
  useEffect(() => {
    const update = () => setLang((i18n.language || 'en').startsWith('zh') ? 'zh' : 'en');
    update();
    i18n.on('languageChanged', update);
    return () => { i18n.off('languageChanged', update); };
  }, []);

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
    const [fx, fy] = VC[character];
    const c = clampAnchor(
      vpW() - pt.x - r.width * (1 - fx), vpH() - pt.y - r.height * (1 - fy),
      r.width, r.height, fx, fy);
    root.style.right = c.right + 'px';
    root.style.bottom = c.bottom + 'px';
    try { localStorage.setItem(POS_KEY, JSON.stringify({ right: c.right, bottom: c.bottom })); } catch {}
  }, [size, character]);

  // Place the context menu beside the pet (never over it): prefer right, then
  // left, then above, then below — whichever has room; clamp to viewport.
  useIsoLayout(() => {
    if (!menu) { setMenuPos(null); return; }
    const el = menuRef.current, root = rootRef.current;
    if (!el) return;
    const m = el.getBoundingClientRect();
    const vw = vpW(), vh = vpH(), gap = 12, pad = 8;
    const clampX = (x: number) => Math.min(Math.max(pad, x), vw - m.width - pad);
    const clampY = (y: number) => Math.min(Math.max(pad, y), vh - m.height - pad);
    let left: number, top: number;
    const pet = root?.getBoundingClientRect();
    if (pet) {
      if (pet.right + gap + m.width <= vw - pad) { left = pet.right + gap; top = clampY(pet.top); }
      else if (pet.left - gap - m.width >= pad) { left = pet.left - gap - m.width; top = clampY(pet.top); }
      else if (pet.top - gap - m.height >= pad) { left = clampX(pet.right - m.width); top = pet.top - gap - m.height; }
      else { left = clampX(pet.right - m.width); top = clampY(pet.bottom + gap); }
    } else {
      left = clampX(menu.x); top = clampY(menu.y);
    }
    setMenuPos({ left, top });
  }, [menu]);

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
      asleep = s === 'sleeping' || s === 'dozing';
      if (s === 'idle' && theme.inlineIdle) {
        img.style.display = 'none';
        svg.style.display = 'block';
        svg.style.visibility = ''; // clear any hide from a character switch
        applyEye(0, 0);
      } else {
        svg.style.display = 'none';
        // Reveal only once the new frame is decoded, so a character switch never
        // flashes the previous art at the new box scale.
        img.onload = () => { img.style.visibility = ''; };
        img.src = theme.base + (theme.files[s] || theme.files.working) + '?_t=' + Date.now();
        img.style.display = 'block';
        if (img.complete) img.style.visibility = '';
      }
      const back = AUTO[s];
      if (back) autoTimer = setTimeout(() => setState('idle'), back);
    };

    const trackCursor = (cx: number, cy: number) => {
      if (!theme.inlineIdle || state !== 'idle' || dragging) return;
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
      setState('sleeping', true);
      setResting(true);
    };
    const exitRest = () => {
      dnd = false;
      setResting(false);
      wakeUp();
      resetIdle();
    };

    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      if (dnd) return;
      const now = performance.now();
      if (now - lastMove > 16) { trackCursor(e.clientX, e.clientY); lastMove = now; }
      if (asleep) exitRest(); else resetIdle();
    };

    let clicks = 0;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    const onClick = () => {
      if (suppressClick) { suppressClick = false; return; }
      if (dragging) return;
      if (dnd || asleep) { exitRest(); return; }
      clicks++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        if (clicks >= 4) setState('reactAnnoyed', true);
        else if (clicks === 2) setState('reactDouble', true);
        else if (clicks === 1) { // single tap → search, growing from the pet
          const r = root.getBoundingClientRect();
          const [fx, fy] = VC[character];
          searchOriginRef.current = { x: r.left + r.width * fx, y: r.top + r.height * fy };
          setSearchOpen(true);
        }
        clicks = 0;
      }, 280);
    };

    let sx = 0, sy = 0, baseR = 0, baseB = 0, baseW = 0, baseH = 0, moved = false;
    let longPress: ReturnType<typeof setTimeout> | undefined;
    let suppressClick = false;
    const onDown = (e: PointerEvent) => {
      if (e.button === 2) return; // mouse right-click → onContextMenu handles it
      suppressClick = false;
      dragging = true; moved = false;
      root.classList.add('dragging');
      hit.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      const r = root.getBoundingClientRect();
      baseR = vpW() - r.right;
      baseB = vpH() - r.bottom;
      baseW = r.width; baseH = r.height;
      if (!dnd && e.pointerType === 'mouse') setState('reactDrag', true);
      // touch / pen: long-press (no move) = context menu
      if (e.pointerType !== 'mouse') {
        longPress = setTimeout(() => {
          longPress = undefined;
          dragging = false;
          suppressClick = true;
          root.classList.remove('dragging');
          try { hit.releasePointerCapture(e.pointerId); } catch {}
          if (!dnd) setState('idle', true);
          setMenu({ x: sx, y: sy });
        }, 450);
      }
      e.preventDefault();
    };
    const onDragMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dist = Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
      if (dist > 4) {
        if (!moved && !dnd) setState('reactDrag', true); // first real move (covers touch)
        moved = true;
      }
      if (longPress && dist > 10) { clearTimeout(longPress); longPress = undefined; }
      const c = clampAnchor(baseR - (e.clientX - sx), baseB - (e.clientY - sy),
        baseW, baseH, VC[character][0], VC[character][1]);
      root.style.right = c.right + 'px';
      root.style.bottom = c.bottom + 'px';
    };
    const onUp = (e: PointerEvent) => {
      clearTimeout(longPress); longPress = undefined;
      if (!dragging) return;
      dragging = false;
      root.classList.remove('dragging');
      try { hit.releasePointerCapture(e.pointerId); } catch {}
      if (moved) {
        suppressClick = true; // a real drag fires a trailing click — don't open search
        try {
          localStorage.setItem(POS_KEY, JSON.stringify({
            right: parseInt(root.style.right || '20', 10),
            bottom: parseInt(root.style.bottom || '20', 10),
          }));
        } catch {}
      }
      if (!dnd) { setState('idle', true); resetIdle(); }
    };

    const onExternal = (e: Event) => {
      if (dnd) return;
      const detail = (e as CustomEvent).detail;
      const s = typeof detail === 'string' ? detail : detail?.state;
      if (typeof s !== 'string') return;
      if (s === 'idle' || theme.files[s]) setState(s, true);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('clawd:state', onExternal as EventListener);
    hit.addEventListener('click', onClick);
    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onDragMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onUp);

    ctrlRef.current = {
      rest: enterRest,
      wake: exitRest,
      resetPos: () => {
        root.style.right = '';
        root.style.bottom = '';
        try { localStorage.removeItem(POS_KEY); } catch {}
      },
    };

    (window as unknown as { clawdPet?: object }).clawdPet = {
      set: (s: string) => setState(s, true),
      idle: () => setState('idle', true),
    };

    setState('idle', true); // force: on character switch state is already 'idle', must repaint
    resetIdle();

    return () => {
      clearTimeout(autoTimer);
      clearTimeout(idleTimer);
      clearTimeout(clickTimer);
      clearTimeout(longPress);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('clawd:state', onExternal as EventListener);
      hit.removeEventListener('click', onClick);
      hit.removeEventListener('pointerdown', onDown);
      hit.removeEventListener('pointermove', onDragMove);
      hit.removeEventListener('pointerup', onUp);
      hit.removeEventListener('pointercancel', onUp);
      ctrlRef.current = null;
      delete (window as unknown as { clawdPet?: object }).clawdPet;
    };
  }, [mounted, character]);

  // close menu on outside interaction
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

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

  const curLang: 'zh' | 'en' = zh ? 'zh' : 'en';


  return (
    <>
      <div className="clawd-deskpet" data-size={size} data-char={character} ref={rootRef} aria-hidden>
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
          title={t('点我搜索 拖动 右键/长按菜单', 'click to search · drag · right-click / long-press menu')}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY });
          }}
        />
      </div>

      {menu && (
        <div className="clawd-menu" ref={menuRef}
          style={{ left: menuPos?.left ?? -9999, top: menuPos?.top ?? -9999, visibility: menuPos ? 'visible' : 'hidden' }}>
          <button onClick={() => {
            const r = rootRef.current?.getBoundingClientRect();
            const [fx, fy] = VC[character];
            if (r) searchOriginRef.current = { x: r.left + r.width * fx, y: r.top + r.height * fy };
            setSearchOpen(true); setMenu(null);
          }}>
            <Search size={14} style={{ marginRight: 8 }} />
            {t('搜索', 'Search')}
          </button>
          <hr />
          <div className="clawd-menu-bar">
            <button onClick={cycleChar} title={`${t('形象', 'Character')}: ${charLabel}`}>
              <img src={THEMES[character].thumb} alt="" className="clawd-menu-thumb" />
            </button>
            <button onClick={cycleSize} title={`${t('大小', 'Size')}: ${sizeLabel}`}>
              <Maximize2 size={16} />
            </button>
            <HeaderToggles />
          </div>
          <hr />
          <button onClick={() => { if (resting) ctrlRef.current?.wake(); else ctrlRef.current?.rest(); setMenu(null); }}>
            {resting ? t('叫醒它', 'Wake up') : t('休息一下', 'Take a nap')}
          </button>
          <button onClick={() => { ctrlRef.current?.resetPos(); setMenu(null); }}>
            {t('复位位置', 'Reset position')}
          </button>
          <button onClick={() => { setHidden(true); setMenu(null); }}>
            {t('隐藏(刷新恢复)', 'Hide (until reload)')}
          </button>
        </div>
      )}

      {searchOpen && <DeskPetSearch lang={curLang} origin={searchOriginRef.current} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
