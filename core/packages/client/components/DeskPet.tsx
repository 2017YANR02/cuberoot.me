'use client';
import { useDouyinToolSurface } from '@/lib/douyin-content';
import { installedPetAvailable } from '@/lib/installed-content';

// Clawd web desk pet — ported interaction engine from clawd-on-desk renderer.js.
// Idle = inline SVG with cursor eye-tracking; other states = <img> swap.
// Only the crab body (theme hitBox) is interactive; the rest is click-through.
// Click the crab → search overlay (which also hosts the size/char/rest/reset/hide
// controls as a toolbar below the box). There is no separate right-click menu.
// Drive from anywhere: window.dispatchEvent(new CustomEvent('clawd:state', { detail: 'happy' }))
//                  or window.clawdPet?.set('thinking') / window.clawdPet?.idle()

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAssistantWorkspace } from '@/hooks/useAssistantWorkspace';
import { assistantConversations, assistantOwner } from '@/lib/assistant-conversations';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import i18n from '@/i18n/i18n-client';
import { canTestRoles, getRolePreview, hasAdminAccess, useAuthStore } from '@/lib/auth-store';
import { useFeedbackUnread, refreshFeedbackUnread } from '@/lib/feedback-unread';
import { useAlgSubmissionUnread, refreshAlgSubmissionUnread } from '@/lib/alg-submission-unread';
import { useNotificationsUnread, refreshNotificationsUnread } from '@/lib/notifications-unread';
import AppLink from '@/components/AppLink';
import { AdminTools } from '@/components/AuthTokenRefresher';
import { ClearButton } from '@/components/ClearButton';
import { persistItem } from '@/lib/safe-storage';
import { createDeskPetShakeController } from '@/lib/deskpet-shake';
import { createDeskPetIdlePlayback } from '@/lib/deskpet-idle-playback';
import { createDizzyRenderer, restartIdleDocument } from '@/lib/deskpet-dizzy';
import { createHangRenderer, HANG_HOOK_Y, nearTopHang } from '@/lib/deskpet-hang';
import { createMusicRenderer } from '@/lib/deskpet-music';
import { createDeskPetHunt } from '@/lib/deskpet-hunt';
import { createDeskPetHangInteraction } from '@/lib/deskpet-hang-interaction';
import { createDeskPetNaturalSleep } from '@/lib/deskpet-natural-sleep';
import { createDeskPetRoutineSession, deskPetLocalPeriod } from '@/lib/deskpet-routine';
import { peekSettled, readPeekLoop, restartPeekLoop } from '@/lib/deskpet-bottom-emerge';
import { bottomDragReach, bottomPeekLine, bottomPeekViewport, createBottomPeekRenderer } from '@/lib/deskpet-bottom-peek';
import { getMusicPlayerState, subscribeMusicPlayer } from '@/lib/music-player';
import { mayUseMiniProgramBridge } from '@/lib/miniprogram-bridge';
import { registerDeskPetExit, useDeskPetVisible } from '@/hooks/useDeskPetVisible';
import {
  DESKPET_EXIT_KEY, GENERIC_ENTER_MS, GENERIC_HOP_MS, GENERIC_SLEEP_MS, SLEEP_FADE_MS, enterKeyframes,
  exitFadeKeyframes, exitHopKeyframes, loadMotionBlob, parseExitStyle, runDeskPetExit, type DeskPetExitStyle,
} from '@/lib/deskpet-motion';
import { clampDeskPetAxis, readDeskPetAnchor } from '@/lib/deskpet-position';
import { subscribeBeat, getMetronomeState } from '@/lib/metronome';
import { getDeskPetScene, PLAYTIME_SCENES } from '@/lib/deskpet-playtime';
import { ORIGINAL_CHARACTERS, ORIGINAL_SCENES, type OriginalCharacterId } from '@/lib/deskpet-originals';
import { ROOTBEAST_BASE, ROOTBEAST_DIZZY, ROOTBEAST_HANG, ROOTBEAST_MUSIC, ROOTBEAST_BOTTOM_PEEK, ROOTBEAST_HUNT, ROOTBEAST_SLEEP, ROOTBEAST_FILES, ROOTBEAST_RANDOM_SCENES, ROOTBEAST_VERSION } from '@/lib/deskpet-rootbeast';
import { resolveDeskPets, type DeskPetCatalog, type DeskPetEntry } from '@cuberoot/shared/deskpet';
import { getDeskPetCatalog, saveDeskPetCatalog } from '@/lib/deskpet-api';
import { THEMES, THEME_IDS, type MiniTheme, type ThemeId } from '@/lib/deskpet-themes';
import { AudioLines, SquarePen } from '@app-foundation/icons/lucide';
import HeaderToggles from '@/components/HeaderToggles';
import { Tooltip } from '@/components/Tooltip';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { tr } from '@/i18n/tr';
// SSR-safe layout effect (DeskPet is rendered in the root layout).
const useIsoLayout = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

// Lazy: the search data layer (persons/comps indexes) only loads on open.
// The loader is a shared const, not two separate `import(...)` expressions:
// Turbopack cuts one chunk group per import call site, so a second copy of the
// expression emits a byte-identical duplicate chunk under a different hash —
// the idle prewarm below would warm that copy and dynamic() would still fetch
// its own 168KB at click time (measured).
const loadDeskPetSearch = () => import('@/components/DeskPetSearch');
const DeskPetSearch = dynamic(loadDeskPetSearch, { ssr: false });
// Lazy: admin-only new-submission dropdown, only loads when an admin opens it.
const AdminSubmissionsPanel = dynamic(() => import('@/components/AdminSubmissionsPanel'), { ssr: false });
// Lazy: the floating metronome, only loads once the user opens it from the toolbar.
const FloatingMetronome = dynamic(() => import('@/components/FloatingMetronome'), { ssr: false });

// one-shot states auto-return to idle after N ms
const AUTO: Record<string, number> = {
  happy: 4000, notification: 5000, error: 5000, sweeping: 5500, carrying: 3000,
  waking: 1400, reactDouble: 1800, reactAnnoyed: 3000, reading: 14000, bubble: 12000,
};

// Mini (edge-cling) mode — ported from clawd-on-desk src/mini.js + state.js.
// One-shot mini states auto-return to the mini rest pose after N ms.
const MINI_AUTO: Record<string, number> = { 'mini-alert': 4000, 'mini-happy': 4000, 'mini-peek': 1500 };
const MINI_ENTER_MS = 1200;       // enter art without a measured length (calico PNG); themes set mini.enterMs
const MINI_SLIDE_MS = 300;        // a drop near the edge slides onto it (eased, not a jump)
const TURN_MS = 360;              // rotating pets turn onto / off the edge (matches the CSS transition)
const CRABWALK_SPEED = 0.12;      // px/ms — sideways walk speed when entering via the toolbar
const MINI_PEEK_FRAC = 0.1;       // hover peek nudges the pet this fraction of its width back on-screen
const MINI_SNAP_FRAC = 0.32;      // on drop, if the visual center is within this fraction of W from an edge → cling

// Shared cursor reach; each character maps this offset to its own eye geometry.
const MAX = 3, BODY_SCALE = 0.33, SHADOW_STRETCH = 0.15, SHADOW_SHIFT = 0.3;
const REACH = MAX * 40;
const SLEEP_AFTER = 60000;
const POS_KEY = 'clawd-deskpet-pos';
const SIZE_KEY = 'clawd-deskpet-size';
const CHAR_KEY = 'clawd-deskpet-char';
const COMPACT_KEY = 'clawd-deskpet-compact';
const MINI_KEY = 'clawd-deskpet-mini'; // { edge, preRight, preBottom } — restore cling across reloads

type Size = 's' | 'm' | 'l';

// Each character's idle visual center as a fraction of the square container
// (measured from rendered art). The pet sits at different spots in the box, so
// we keep this point — not the box center — fixed across size/character changes.
const VC: Record<ThemeId, [number, number]> = {
  ...Object.fromEntries(ORIGINAL_CHARACTERS.map(character => [character.id, [0.5, 0.62]])) as Record<OriginalCharacterId, [number, number]>,
  clawd: [0.5, 0.775],
  calico: [0.48, 0.477],
  cloudling: [0.5, 0.5],
  rootbeast: [0.5, 0.64],
};

// Desktop fixed anchors exclude the scrollbar. Mobile layout overflow can widen
// the fixed-position containing block beyond clientWidth/clientHeight; use its size
// for coordinates, then clamp against visualViewport below.
const vpW = () => window.matchMedia('(max-width: 767px)').matches
  ? window.innerWidth : document.documentElement.clientWidth;
const vpH = () => window.matchMedia('(max-width: 767px)').matches
  ? window.innerHeight : document.documentElement.clientHeight;

// Clamp the bottom-right anchor (right/bottom px) so the pet's visual center
// (fraction fx,fy of its square box) may travel a touch PAST each viewport edge,
// letting the art hang off / peek from the edge (upstream's edge-pinning). PEEK
// is how far past the edge the visual center may go, as a fraction of box size:
// at the limit ~half the centered art is clipped, so the pet clings to the edge.
// (A positive value here would instead keep the art that far inside the edge.)
const PEEK = 0.08;
const clampAnchor = (right: number, bottom: number, w: number, h: number, fx: number, fy: number, allowBottomPeek = false) => {
  const cw = vpW(), ch = vpH();
  const viewport = window.visualViewport;
  const safe = mayUseMiniProgramBridge() || window.matchMedia('(max-width: 767px)').matches;
  const style = safe ? getComputedStyle(document.documentElement) : null;
  const top = (viewport?.offsetTop ?? 0) + (parseFloat(style?.getPropertyValue('--sat') ?? '') || 0);
  const bottomEdge = Math.min(ch, (viewport?.offsetTop ?? 0) + (viewport?.height ?? ch))
    - (parseFloat(style?.getPropertyValue('--sab') ?? '') || 0);
  const left = safe ? (viewport?.offsetLeft ?? 0) : 0;
  const rightEdge = safe ? left + (viewport?.width ?? cw) : cw;
  let clampedBottom = clampDeskPetAxis(bottom, h, fy, ch, top, bottomEdge);
  if (allowBottomPeek && !mayUseMiniProgramBridge()) {
    const petBottomEdge = bottomEdge - 8;
    const inset = Math.min(16, Math.max(0, (petBottomEdge - top) / 2));
    const min = Math.min(ch - petBottomEdge + inset - h * (1 - fy), ch - bottomPeekViewport(cw, ch, viewport).bottom - h * (1 - fy + PEEK));
    const max = Math.max(min, ch - top - inset - h * (1 - fy));
    clampedBottom = Math.min(Math.max(min, bottom), max);
  }
  return {
    right: clampDeskPetAxis(right, w, fx, cw, left, rightEdge),
    bottom: clampedBottom,
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
  z-index:100000;pointer-events:none;--pet-scale:1; /* above every page modal so it stays draggable */
  -webkit-user-select:none;user-select:none;
  width:calc(var(--pet-base) * var(--pet-scale));height:calc(var(--pet-base) * var(--pet-scale));}
.clawd-deskpet.pet-front{z-index:100020;} /* above the search backdrop (100010) so it stays sharp */
.clawd-deskpet[data-size=s]{--pet-base:192px;}
.clawd-deskpet[data-size=m]{--pet-base:252px;}
.clawd-deskpet[data-size=l]{--pet-base:324px;}
/* Each character's art fills a different fraction of its square canvas, so scale
   the box per character (clawd = reference) to equalize on-screen pet size. */
.clawd-deskpet[data-char=calico]{--pet-scale:.42;}
.clawd-deskpet[data-char=cloudling]{--pet-scale:1.27;}
.clawd-deskpet[data-char=rootbeast]{--pet-scale:.7;}
.clawd-deskpet[data-original=true]{--pet-scale:.7;}
.clawd-deskpet>svg,.clawd-deskpet>img,.clawd-deskpet>object{position:absolute;inset:0;width:100%;height:100%;
  image-rendering:pixelated;-webkit-user-drag:none;pointer-events:none;}
.clawd-deskpet>img{display:none;object-fit:contain;}
.clawd-deskpet[data-char=rootbeast]>img{image-rendering:auto;}
.clawd-deskpet[data-original=true]>img{image-rendering:auto;}
.clawd-deskpet[data-pixel=true]>img{image-rendering:pixelated;}
/* The inline SVG is clawd's art only — it doubles as the frame shown while an
   <img> pose is still decoding, so the other characters must never fall back to
   it (the engine also sets display:none on swap). */
.clawd-deskpet:not([data-char=clawd])>svg{display:none;}
.clawd-deskpet-hit{position:absolute;pointer-events:auto;cursor:grab;touch-action:none;
  -webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;}
.clawd-deskpet[data-char=clawd] .clawd-deskpet-hit{left:31%;top:66%;width:38%;height:28%;}
.clawd-deskpet[data-char=calico] .clawd-deskpet-hit{left:20%;top:30%;width:60%;height:60%;}
.clawd-deskpet[data-char=cloudling] .clawd-deskpet-hit{left:27%;top:28%;width:46%;height:54%;}
.clawd-deskpet[data-char=rootbeast] .clawd-deskpet-hit{left:19%;top:36%;width:64%;height:54%;}
.clawd-deskpet[data-bottom-peek-phase] .clawd-deskpet-hit{left:8.5%;top:8.5%;width:74%;height:71.5%;}
.clawd-deskpet[data-original=true] .clawd-deskpet-hit{left:17%;top:29%;width:66%;height:58%;}
.clawd-deskpet.dragging .clawd-deskpet-hit{cursor:grabbing;}
/* The hide action belongs to the pet itself. Reuse the shared ClearButton and
   reveal it on hover, keyboard focus, or touch long press. */
.clawd-deskpet-dismiss.clear-btn--standalone{position:absolute;z-index:4;
  opacity:0;pointer-events:none;transition:opacity .15s;}
.clawd-deskpet:focus-within .clawd-deskpet-dismiss{opacity:1;pointer-events:auto;}
@media (hover:hover){.clawd-deskpet:hover .clawd-deskpet-dismiss{opacity:1;pointer-events:auto;}}
.clawd-deskpet.touch-actions .clawd-deskpet-dismiss{opacity:1;pointer-events:auto;}
.clawd-deskpet[data-char=clawd] .clawd-deskpet-dismiss{left:calc(69% - 10px);top:calc(66% - 10px);}
.clawd-deskpet[data-char=calico] .clawd-deskpet-dismiss{left:calc(80% - 10px);top:calc(30% - 10px);}
.clawd-deskpet[data-char=cloudling] .clawd-deskpet-dismiss{left:calc(73% - 10px);top:calc(28% - 10px);}
.clawd-deskpet[data-char=rootbeast] .clawd-deskpet-dismiss{left:calc(83% - 10px);top:calc(36% - 10px);}
.clawd-deskpet[data-original=true] .clawd-deskpet-dismiss{left:calc(83% - 10px);top:calc(29% - 10px);}
.clawd-deskpet.mini-mode:not(.mini-left) .clawd-deskpet-dismiss{left:12%;top:12%;}
.clawd-deskpet.mini-mode.mini-left .clawd-deskpet-dismiss{left:calc(88% - 20px);top:12%;}
/* Unread-feedback badge — anchored to each character's body, always visible while
   the pet is on screen. Visual only; the clickable badges remain accessible. */
.clawd-deskpet-badge{position:absolute;z-index:3;pointer-events:none;
  display:flex;align-items:center;justify-content:center;
  min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;
  border-radius:9px;font-size:11px;font-weight:700;line-height:1;
  font-family:var(--font-sans,system-ui,sans-serif);color:#fff;
  background:var(--destructive,#e5484d);
  box-shadow:0 0 0 2px var(--card,var(--background)),0 1px 4px rgba(0,0,0,.35);
  animation:clawddp-badge-pop .3s ease-out;}
@keyframes clawddp-badge-pop{0%{transform:scale(0)}70%{transform:scale(1.18)}100%{transform:scale(1)}}
.clawd-deskpet[data-char=clawd] .clawd-deskpet-badge{left:60%;top:54%;}
.clawd-deskpet[data-char=calico] .clawd-deskpet-badge{left:66%;top:22%;}
.clawd-deskpet[data-char=cloudling] .clawd-deskpet-badge{left:58%;top:37%;}
.clawd-deskpet[data-char=rootbeast] .clawd-deskpet-badge{left:73%;top:35%;}
.clawd-deskpet[data-original=true] .clawd-deskpet-badge{left:73%;top:29%;}
/* Site-notification badge (recon replies / comments / alternatives) — clickable
   link to /notifications, info-colored so it reads apart from the red fb badge and
   the accent admin one. Sits above both so all three can show at once. */
.clawd-deskpet-badge-ntf{pointer-events:auto;cursor:pointer;text-decoration:none;
  background:var(--signal-info,#3b82f6);}
.clawd-deskpet[data-char=clawd] .clawd-deskpet-badge-ntf{left:46%;top:38%;}
.clawd-deskpet[data-char=calico] .clawd-deskpet-badge-ntf{left:44%;top:8%;}
.clawd-deskpet[data-char=cloudling] .clawd-deskpet-badge-ntf{left:44%;top:22%;}
.clawd-deskpet[data-char=rootbeast] .clawd-deskpet-badge-ntf{left:57%;top:21%;}
.clawd-deskpet[data-original=true] .clawd-deskpet-badge-ntf{left:57%;top:15%;}
/* Admin new-submission badge — clickable, accent-colored (distinct from the red
   fb badge). Sits on the pet's body, mirrored opposite the fb badge so both can
   show at once without overlapping (was pinned to the container corner, which is
   far from the crab since it's drawn in the box's lower-middle). */
.clawd-deskpet-badge-admin{pointer-events:auto;cursor:pointer;border:none;margin:0;appearance:none;
  background:var(--accent,#3b82f6);}
.clawd-deskpet[data-char=clawd] .clawd-deskpet-badge-admin{left:33%;top:54%;}
.clawd-deskpet[data-char=calico] .clawd-deskpet-badge-admin{left:22%;top:22%;}
.clawd-deskpet[data-char=cloudling] .clawd-deskpet-badge-admin{left:30%;top:37%;}
.clawd-deskpet[data-char=rootbeast] .clawd-deskpet-badge-admin{left:24%;top:35%;}
.clawd-deskpet[data-original=true] .clawd-deskpet-badge-admin{left:24%;top:29%;}
/* Mini (edge-cling) mode: the art is drawn lying sideways; flip on the left edge
   so it faces inward. The mini-anim class eases the slide-into-place / crabwalk /
   peek nudge; plain drags clear it so they stay 1:1 with the pointer. */
.clawd-deskpet.mini-anim{transition:right .14s ease-out,bottom .14s ease-out;}
.clawd-deskpet.mini-left>img{transform:scaleX(-1);}
.clawd-deskpet[data-char=rootbeast].mini-mode>img{transform:rotate(-90deg);}
.clawd-deskpet[data-char=rootbeast].mini-mode.mini-left>img{transform:rotate(90deg);}
.clawd-deskpet[data-original=true].mini-mode>img{transform:rotate(-90deg);}
.clawd-deskpet[data-original=true].mini-mode.mini-left>img{transform:rotate(90deg);}
/* Rotating pets turn onto and off the edge instead of snapping by 90°. */
.clawd-deskpet[data-char=rootbeast].mini-turn>img,.clawd-deskpet[data-original=true].mini-turn>img{
  transition:transform .36s cubic-bezier(.3,0,.2,1);}
.clawd-deskpet.mini-mode .clawd-deskpet-hit{left:0;top:0;width:100%;height:100%;}
/* An exit owns the pet until it is hidden: no drags, taps or badges. */
.clawd-deskpet.leaving :is(.clawd-deskpet-hit,.clawd-deskpet-dismiss,.clawd-deskpet-badge,.admin-tools-surface){pointer-events:none;}
.clawd-deskpet.leaving .clawd-deskpet-dismiss{opacity:0;}
@media (prefers-reduced-motion:reduce){
  .clawd-deskpet[data-char=rootbeast].mini-turn>img,.clawd-deskpet[data-original=true].mini-turn>img{transition:none;}
}
@media (max-width:768px){
  .clawd-deskpet{right:max(12px,var(--sar,0px));bottom:max(12px,var(--sab,0px));}
  .clawd-deskpet[data-size=s]{--pet-base:144px;}
  .clawd-deskpet[data-size=m]{--pet-base:186px;}
  .clawd-deskpet[data-size=l]{--pet-base:240px;}
}
.deskpet-compact{position:fixed;right:max(16px,var(--sar,0px),calc((100vw - 1200px)/2));bottom:max(20px,var(--sab,0px));z-index:100000;}
.deskpet-compact-bar{position:relative;isolation:isolate;display:flex;align-items:center;padding:5px;border:1px solid var(--border-strong);border-radius:999px;
  box-shadow:inset 0 1px 2px color-mix(in srgb,var(--foreground) 12%,transparent),0 6px 18px color-mix(in srgb,var(--foreground) 12%,transparent);}
.deskpet-compact-surface{position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:var(--popover);}
.deskpet-compact-bar>button,.deskpet-compact-settings{display:flex;align-items:center;justify-content:center;width:46px;height:42px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--foreground);cursor:pointer;}
.deskpet-compact-settings>svg{width:21px;height:21px;}
.deskpet-compact-bar>button:hover,.deskpet-compact-settings:hover{background:var(--muted);}
.deskpet-compact-bar button:focus-visible{outline:2px solid var(--ring);outline-offset:2px;}
.deskpet-compact-bar>button[aria-pressed=true]{color:var(--accent);background:var(--accent-soft);}
.deskpet-compact-divider{height:24px;width:1px;background:var(--border-default);}
.deskpet-compact .appearance-menu{top:auto;right:0;bottom:calc(100% + 10px);left:auto;}
.deskpet-compact-status{position:absolute;right:0;bottom:calc(100% + 10px);width:min(280px,calc(100vw - 40px));padding:12px;border-radius:12px;background:var(--popover);font-size:13px;color:var(--foreground);}
/* The homepage's fixed search occupies the bottom 2.5rem + 54px on narrow screens. */
@media (max-width:1024px){body:has(.landing-page) .deskpet-compact{bottom:calc(7rem + var(--sab,0px));}}
@media print{.clawd-deskpet,.deskpet-compact{display:none;}}
`;

function CompactPet({ lang, onCompose }: {
  lang: 'zh' | 'en';
  onCompose: (draft?: string) => void;
}) {
  const speech = useSpeechToText({
    lang: lang === 'zh' ? 'zh-CN' : 'en-US',
    onResult: (text, final) => { if (final && text.trim()) onCompose(text.trim()); },
  });
  const voiceLabel = speech.listening ? tr({ zh: '停止听写', en: 'Stop dictation' }) : tr({ zh: '语音输入', en: 'Voice input' });
  return <div className="deskpet-compact" role="group" aria-label={tr({ zh: '轻量助手', en: 'Compact assistant' })}>
    <div className="deskpet-compact-bar">
      <span className="deskpet-compact-surface" data-site-surface="popover" aria-hidden />
      <Tooltip content={tr({ zh: '新聊天', en: 'New chat' })}>{tip =>
        <button {...tip} type="button" aria-label={tr({ zh: '新聊天', en: 'New chat' })} onClick={() => onCompose()}><SquarePen size={21} aria-hidden /></button>
      }</Tooltip>
      <span className="deskpet-compact-divider" aria-hidden />
      <Tooltip content={voiceLabel}>{tip =>
        <button {...tip} type="button" aria-label={voiceLabel} aria-pressed={speech.listening} onClick={() => speech.listening ? speech.stop() : speech.start()}><AudioLines size={21} aria-hidden /></button>
      }</Tooltip>
      <span className="deskpet-compact-divider" aria-hidden />
      <HeaderToggles triggerClassName="deskpet-compact-settings" />
    </div>
    {(speech.listening || speech.error) && <div className="deskpet-compact-status" data-site-surface="popover" role="status">
      {speech.error ? tr({ zh: '语音输入不可用，请检查浏览器支持和麦克风权限，或打字输入。', en: 'Voice input is unavailable. Check browser support and microphone permissions, or type instead.' }) : tr({ zh: '正在听写…', en: 'Listening…' })}
    </div>}
  </div>;
}

export default function DeskPet() {
  const douyin = useDouyinToolSurface();
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState<Size>('m');
  const [character, setCharacter] = useState<ThemeId>('rootbeast');
  const [compact, setCompact] = useState(false);
  const [visible] = useDeskPetVisible();
  const [temporarilyHidden, setHidden] = useState(false);
  const hidden = !visible || temporarilyHidden;
  const [resting, setResting] = useState(false);
  const user = useAuthStore((s) => s.user);
  const owner = assistantOwner(user);
  const workspace = useAssistantWorkspace(owner);
  const pathname = usePathname();
  const router = useRouter();
  const searchOpen = /^\/(?:zh\/|en\/)?chat\/?$/.test(pathname || '');
  const setSearchOpen = useCallback((open: boolean) => {
    const prefix = pathname?.startsWith('/zh') ? '/zh' : '';
    if (open) {
      assistantConversations.setOpen(owner, true);
      if (!searchOpen) router.push(`${prefix}/chat`);
    } else if (searchOpen) router.push(prefix || '/');
  }, [owner, pathname, router, searchOpen]);
  // Pet gesture listeners live across navigation; always use the current route
  // and account without restarting the animation/gesture lifecycle.
  const searchNavigationRef = useRef(setSearchOpen);
  useLayoutEffect(() => { searchNavigationRef.current = setSearchOpen; }, [setSearchOpen]);
  useEffect(() => { assistantConversations.setOpen(owner, searchOpen); }, [owner, searchOpen]);
  useEffect(() => {
    setHidden(false);
  }, [visible]);
  const [touchActionsVisible, setTouchActionsVisible] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>('en');
  const [randomMode, setRandomMode] = useState(false);
  const [exitStyle, setExitStyle] = useState<DeskPetExitStyle>('hop');
  // Floating metronome panel — opened from the toolbar, lives here (root layout)
  // so it survives client-side navigation and keeps ticking across pages.
  const [metronomeOpen, setMetronomeOpen] = useState(false);
  const fbUnread = useFeedbackUnread();
  const isAdmin = hasAdminAccess(user);
  const [catalog, setCatalog] = useState<DeskPetCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const catalogBusy = useRef(false);
  const entries = resolveDeskPets(THEME_IDS, catalog?.entries ?? []);
  const visibleEntries = entries.filter(entry => installedPetAvailable(entry.id) && (isAdmin || (catalog && !entry.locked && !entry.removed)));
  const visibleIds = visibleEntries.map(entry => entry.id);
  const visibleKey = visibleIds.join(',');
  const petAvailable = installedPetAvailable(character) && (isAdmin || visibleIds.includes(character));
  const petChoices = visibleEntries.map(entry => ({
    ...entry, label: entry.label ?? THEMES[entry.id as ThemeId].label,
    thumb: THEMES[entry.id as ThemeId].thumb, thumbScale: THEMES[entry.id as ThemeId].thumbScale,
  }));
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (catalogBusy.current) return;
      void getDeskPetCatalog().then(value => {
        if (active && !catalogBusy.current) {
          setCatalog(current => current && current.revision > value.revision ? current : value);
          setCatalogError(false);
        }
      }).catch(() => { if (active) { setCatalogError(true); setCatalog(null); } });
    };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { active = false; window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [isAdmin, searchOpen]);

  useEffect(() => {
    if (!catalog && !isAdmin) return;
    const allowed = resolveDeskPets(THEME_IDS, catalog?.entries ?? [])
      .filter(entry => isAdmin || (!entry.locked && !entry.removed));
    let saved: string | null = null;
    try { saved = localStorage.getItem(CHAR_KEY); } catch {}
    const next = allowed.find(entry => entry.id === saved)?.id ?? allowed[0]?.id;
    if (next) setCharacter(next as ThemeId);
  }, [catalog, isAdmin]);

  const updateCatalog = async (nextEntries: DeskPetEntry[]) => {
    if (!isAdmin || !catalog || catalogBusy.current) return false;
    catalogBusy.current = true;
    setCatalogSaving(true);
    setCatalogError(false);
    try {
      // Another deployed client may know assets this version does not yet have.
      const unknown = catalog.entries.filter(entry => !THEME_IDS.includes(entry.id as ThemeId));
      setCatalog(await saveDeskPetCatalog({ revision: catalog.revision, entries: [...nextEntries, ...unknown] }));
      return true;
    }
    catch {
      setCatalogError(true);
      try { setCatalog(await getDeskPetCatalog()); } catch { setCatalog(null); }
      return false;
    } finally { catalogBusy.current = false; setCatalogSaving(false); }
  };
  const algUnread = useAlgSubmissionUnread();
  const ntfUnread = useNotificationsUnread();
  const [submPanelOpen, setSubmPanelOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rootIdleRef = useRef<HTMLObjectElement>(null);
  const rootDizzyRef = useRef<HTMLObjectElement>(null);
  const rootHangRef = useRef<HTMLObjectElement>(null);
  const rootMusicRef = useRef<HTMLObjectElement>(null);
  const rootBottomPeekRef = useRef<HTMLObjectElement>(null);
  const rootHuntRef = useRef<HTMLObjectElement>(null);
  const rootSleepRef = useRef<HTMLObjectElement>(null);
  const routineSessionRef = useRef<ReturnType<typeof createDeskPetRoutineSession> | null>(null);
  const [routineBootReady, setRoutineBootReady] = useState(false);
  const searchOpenRef = useRef(searchOpen);
  searchOpenRef.current = searchOpen;
  const huntControlRef = useRef<{ defer: (action: () => void) => boolean; hard: () => void } | null>(null);
  const bottomPeekingRef = useRef(false);
  const hangingRef = useRef(false);
  const hitRef = useRef<HTMLDivElement>(null);
  // Off-screen primer input: on touch we focus it synchronously inside the tap
  // gesture so the mobile keyboard opens; the search overlay's real input then
  // takes over once it mounts (which is async, hence out of the gesture).
  const kbdRef = useRef<HTMLInputElement>(null);
  const ctrlRef = useRef<{ rest: () => void; wake: () => void; naturalSleep: (mode: 'drowsy' | 'sleep') => boolean; cling: () => void; inMini: () => boolean; resetPos: () => void; reposition: () => void; hide: () => void } | null>(null);
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
  const pendingPlaytimeRef = useRef<string | null>(null);
  // Read by the running engine, so changing the exit never restarts it.
  const exitStyleRef = useRef<DeskPetExitStyle>('hop');
  // Set while hidden; the next engine start plays the entrance once.
  const reshowRef = useRef(false);
  useEffect(() => { if (hidden) reshowRef.current = true; }, [hidden]);
  useEffect(() => {
    const updateExit = (event: StorageEvent) => {
      if (event.key !== DESKPET_EXIT_KEY && event.key !== null) return;
      const next = parseExitStyle(event.newValue);
      exitStyleRef.current = next;
      setExitStyle(next);
    };
    window.addEventListener('storage', updateExit);
    return () => window.removeEventListener('storage', updateExit);
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const sz = localStorage.getItem(SIZE_KEY);
      setCompact(localStorage.getItem(COMPACT_KEY) === 'true');
      if (sz === 's' || sz === 'l') setSize(sz);
      // 动画(随机播放)默认关闭:仅显式存为 'random' 才开,空/未设(新用户)→ 关。
      if (localStorage.getItem('clawd-deskpet-mode') === 'random') setRandomMode(true);
      const exit = parseExitStyle(localStorage.getItem(DESKPET_EXIT_KEY));
      exitStyleRef.current = exit;
      setExitStyle(exit);
    } catch {}
    // Warm the search overlay chunk so the first tap mounts it without an async
    // gap — on touch that gap drops focus out of the gesture and the mobile
    // keyboard won't open.
    let active = true;
    const warm = () => { if (active) loadDeskPetSearch().catch(() => {}); };
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(warm);
    else timer = setTimeout(warm, 1500);
    return () => {
      active = false;
      if (idle !== undefined && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);

  // Re-render menu text live when language changes (DeskPet is outside I18nProvider).
  useEffect(() => {
    const update = () => setLang((i18n.language.startsWith('zh') ? 'zh' : 'en'));
    update();
    // defer via setTimeout — languageChanged fires synchronously inside I18nProvider's render,
    // calling setState during another component's render throws in React strict mode.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deferred = () => { clearTimeout(timer); timer = setTimeout(update, 0); };
    i18n.on('languageChanged', deferred);
    return () => { i18n.off('languageChanged', deferred); clearTimeout(timer); };
  }, []);


  // Keep the pet and its attached tools above the mobile search input.
  // Move the actual anchor so dragging and the touch dismiss button still work.
  useEffect(() => {
    if (!searchOpen) return;
    const avoidControls = () => ctrlRef.current?.reposition();
    const resize = new ResizeObserver(avoidControls);
    const observeControls = () => {
      const box = document.querySelector('.deskpet-search-box');
      if (!box) return;
      mount.disconnect();
      resize.observe(box);
      // Keyboard/URL-bar changes resize the parent even if the input stays the same size.
      if (box.parentElement) resize.observe(box.parentElement);
      // Responsive pet sizing and expanded tools can settle after the search mounts.
      // Repositioning changes only offsets, so these size observations do not loop.
      if (rootRef.current) resize.observe(rootRef.current);
      const tools = rootRef.current?.querySelector('.admin-tools-surface');
      if (tools) resize.observe(tools);
      avoidControls();
    };
    const mount = new MutationObserver(observeControls);
    mount.observe(document.body, { childList: true, subtree: true });
    observeControls();
    return () => { mount.disconnect(); resize.disconnect(); };
  }, [searchOpen, character, size]);

  useEffect(() => {
    const showAudioControls = () => setMetronomeOpen(true);
    window.addEventListener('cuberoot:music-start', showAudioControls);
    return () => window.removeEventListener('cuberoot:music-start', showAudioControls);
  }, []);

  // Beat pulse: while the metronome is sounding the pet bounces on every tick,
  // so it doubles as the visual beat (usable muted, or when the panel is
  // scrolled out of view). Animates the standalone `scale` property, not
  // `transform` — mini-left flips the art with transform:scaleX(-1).
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let live: Animation[] = [];
    return subscribeBeat(({ accent }) => {
      if (rootRef.current?.classList.contains('leaving') || rootRef.current?.dataset.hangPhase || rootRef.current?.dataset.bottomPeekPhase || rootMusicRef.current?.style.visibility === '') return;
      for (const a of live) a.cancel();
      live = [];
      const peak = accent ? 1.1 : 1.05;
      // Each beat cancels the previous bounce, so the bounce has to fit inside
      // the beat interval — at the top of the tempo range a fixed 130ms would be
      // cancelled mid-swell every time and leave the pet stuck enlarged.
      const duration = Math.max(24, Math.min(130, (60000 / getMetronomeState().bpm) * 0.8));
      if (rootRef.current?.dataset.shakePhase) return;
      for (const el of [svgRef.current, imgRef.current, rootIdleRef.current]) {
        if (!el || el.style.visibility === 'hidden') continue;
        live.push(el.animate(
          [{ scale: '1' }, { scale: `${peak}` }, { scale: '1' }],
          { duration, easing: 'ease-out' },
        ));
      }
    });
  }, []);

  // 反馈未读:登录用户挂载时 + 标签可见时 + 每 90s 拉一次,数字挂到桌宠身上(每页可见)。
  // 未登录 → refreshFeedbackUnread 内部归零。
  useEffect(() => {
    const all = () => { refreshFeedbackUnread(); refreshAlgSubmissionUnread(); refreshNotificationsUnread(); };
    all();
    if (!user) return;
    const onVis = () => { if (document.visibilityState === 'visible') all(); };
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(all, 90000);
    return () => { document.removeEventListener('visibilitychange', onVis); clearInterval(iv); };
  }, [user]);

  // 未读数上升(来了新回复)→ 桌宠做一次通知姿势吸引注意(引擎监听 clawd:state)。
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    const total = fbUnread + ntfUnread;
    if (total > prevUnreadRef.current) {
      try { window.dispatchEvent(new CustomEvent('clawd:state', { detail: 'notification' })); } catch {}
    }
    prevUnreadRef.current = total;
  }, [fbUnread, ntfUnread]);


  // After a size or character change, re-anchor so the pet's visual center lands
  // on the captured point (grows/shrinks about itself; characters share one
  // point). recenterRef is only set by cycleSize/selectChar, so mount/restore skips.
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
      if (rootIdleRef.current) rootIdleRef.current.style.visibility = 'hidden';
      if (rootHangRef.current) rootHangRef.current.style.visibility = 'hidden';
      if (rootMusicRef.current) rootMusicRef.current.style.visibility = 'hidden';
      if (rootBottomPeekRef.current) rootBottomPeekRef.current.style.visibility = 'hidden';
      if (rootHuntRef.current) rootHuntRef.current.style.visibility = 'hidden';
    }
    const r = root.getBoundingClientRect();
    // While clinging, a size change must re-pin to the edge, not recenter.
    if (hangingRef.current && character === 'rootbeast') {
      root.style.bottom = vpH() - (window.visualViewport?.offsetTop ?? 0) - r.height + r.height * HANG_HOOK_Y + 'px';
      return;
    }
    if (miniRef.current.active) {
      root.style.right = miniRightPx(THEMES[character].mini.offsetRatio, miniRef.current.edge, r.width) + 'px';
      root.style.bottom = clampAnchor(0, vpH() - r.bottom, r.width, r.height, ...VC[character], character === 'rootbeast').bottom + 'px';
      return;
    }
    const [fx, fy] = VC[character];
    const c = clampAnchor(
      vpW() - pt.x - r.width * (1 - fx), vpH() - pt.y - r.height * (1 - fy),
      r.width, r.height, fx, fy, character === 'rootbeast');
    root.style.right = c.right + 'px';
    root.style.bottom = c.bottom + 'px';
    persistItem(POS_KEY, JSON.stringify({ right: c.right, bottom: c.bottom }));
    if (bottomPeekingRef.current) ctrlRef.current?.reposition();
  }, [size, character]);

  useEffect(() => {
    if (!mounted || hidden || !petAvailable || compact) return;
    const root = rootRef.current, svg = svgRef.current, img = imgRef.current, hit = hitRef.current;
    if (!root || !svg || !img || !hit) return;
    const eyes = svg.querySelector<SVGGElement>('#clawddp-eyes');
    const body = svg.querySelector<SVGGElement>('#clawddp-body');
    const shadow = svg.querySelector<SVGGElement>('#clawddp-shadow');
    const theme = THEMES[character];
    const rootIdle = rootIdleRef.current;
    const idlePlayback = rootIdle ? createDeskPetIdlePlayback(rootIdle) : undefined;
    const rootDizzy = character === 'rootbeast' ? rootDizzyRef.current : null;
    const rootHang = character === 'rootbeast' ? rootHangRef.current : null;
    const rootMusic = character === 'rootbeast' ? rootMusicRef.current : null;
    const rootBottomPeek = character === 'rootbeast' ? rootBottomPeekRef.current : null;
    const rootHunt = character === 'rootbeast' ? rootHuntRef.current : null;
    const rootSleep = character === 'rootbeast' ? rootSleepRef.current : null;
    const routine = character === 'rootbeast' ? (routineSessionRef.current ??= createDeskPetRoutineSession()) : null;
    routine?.initialize(new Date());
    let rootPupils: SVGGElement[] = [];
    const assetUrl = (file: string) => theme.base + file + (theme.version ? `?v=${theme.version}` : '');
    const characterScene = (state: unknown) => {
      const scene = getDeskPetScene(state);
      return scene?.character === character ? scene : undefined;
    };
    const grouped = hasAdminAccess(user) || canTestRoles() || !!getRolePreview();

    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && typeof p.right === 'number' && typeof p.bottom === 'number') {
        const rb = root.getBoundingClientRect();
        const c = clampAnchor(p.right, p.bottom, rb.width, rb.height, VC[character][0], VC[character][1], character === 'rootbeast');
        root.style.right = c.right + 'px';
        root.style.bottom = c.bottom + 'px';
      }
    } catch {}

    let state = 'idle';
    let asleep = false;
    let dragging = false;
    let dnd = resting;
    let autoTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let randomTimer: ReturnType<typeof setTimeout> | undefined;
    let leaving = false;
    let disposed = false;
    let capturedPointer: number | undefined;
    let cancelSequence: (() => void) | undefined;
    const motionAnimations: Animation[] = [];
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = (frames: Keyframe[], duration: number) => {
      if (typeof root.animate === 'function') motionAnimations.push(root.animate(frames, { duration, fill: 'forwards', easing: 'ease-in-out' }));
    };
    const clearMotion = () => { motionAnimations.splice(0).forEach(animation => animation.cancel()); };
    let dizzyRenderer: ReturnType<typeof createDizzyRenderer> | undefined;
    let hangRenderer: ReturnType<typeof createHangRenderer> | undefined;
    let musicRenderer: ReturnType<typeof createMusicRenderer> | undefined;
    let bottomRenderer: ReturnType<typeof createBottomPeekRenderer> | undefined;
    let hunt: ReturnType<typeof createDeskPetHunt> | undefined;
    let hangPlay: ReturnType<typeof createDeskPetHangInteraction> | undefined;
    let natural: ReturnType<typeof createDeskPetNaturalSleep> | undefined;
    let automaticNatural = false;
    let lastDragEnded = performance.now();
    let idleGaze = { gx: 0, gy: 0 };
    const deferHunt = (action: () => void) => {
      hangPlay?.stop('soft');
      if (!hunt?.active) return false;
      hunt.stop('soft', action); return true;
    };
    huntControlRef.current = { defer: deferHunt, hard: () => { natural?.stop(); hangPlay?.stop('hard'); hunt?.stop('hard'); } };
    const dismissBottom = () => {
      if (!bottomRenderer?.visible && !bottomRenderer?.active) return;
      const visible = bottomRenderer?.visible;
      bottomRenderer?.hide();
      if (visible && img.dataset.character === character && img.getAttribute('src')) {
        img.style.display = 'block'; img.style.visibility = '';
      }
    };
    let musicReadyToShow = false;
    const suspendMusic = () => {
      const wasVisible = musicRenderer?.visible;
      musicRenderer?.suspend();
      if (wasVisible && img.dataset.character === character && img.getAttribute('src')) {
        img.style.display = 'block'; img.style.visibility = '';
      }
    };
    let restartIdle = false;
    let restartDrag = false;
    const shake = createDeskPetShakeController({
      reducedMotion: reducedMotion(),
      onChange: snapshot => {
        if (snapshot.phase !== 'idle') hangPlay?.stop('hard');
        if (snapshot.phase !== 'idle' && hunt?.emerging) hunt.stop('hard');
        if (snapshot.phase !== 'idle') { dismissBottom(); suspendMusic(); }
        if (snapshot.phase !== 'idle' && hangRenderer?.visible) {
          hangRenderer.interrupt();
          if (!dizzyRenderer?.ready) setState(dragging ? 'reactDrag' : 'idle', true);
        }
        if (snapshot.phase === 'idle') delete root.dataset.shakePhase;
        else root.dataset.shakePhase = snapshot.phase;
        dizzyRenderer?.sync();
      },
    });
    const dizzyOwnsArt = () => !!dizzyRenderer?.ready && shake.snapshot().phase !== 'idle';
    const physicalInteractionOwnsArt = () => !!natural?.active || dizzyOwnsArt() || !!hangRenderer?.active || (!!bottomRenderer?.active && !hunt?.emerging);
    const interactionOwnsArt = () => physicalInteractionOwnsArt() || !!musicRenderer?.active || !!hunt?.active;
    const sleepTimers = new Set<ReturnType<typeof setTimeout>>();
    const clearSleepTimers = () => { sleepTimers.forEach(clearTimeout); sleepTimers.clear(); };
    const afterSleep = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { sleepTimers.delete(timer); if (!disposed && !leaving) callback(); }, delay);
      sleepTimers.add(timer);
    };
    const releasePointer = () => {
      if (capturedPointer === undefined) return;
      try { hit.releasePointerCapture(capturedPointer); } catch {}
      capturedPointer = undefined;
    };

    // ── Mini (edge-cling) mode ── ported from clawd-on-desk mini.js + state.js
    let mini = false;
    let miniEdge: 'left' | 'right' = 'right';
    let miniTransitioning = false; // during enter/crabwalk — external state changes wait
    let mouseOverPet = false;
    let preMiniRight = 0, preMiniBottom = 0; // normal anchor to restore on exit
    let miniTimer: ReturnType<typeof setTimeout> | undefined;
    const syncMiniRef = () => { miniRef.current = { active: mini, edge: miniEdge }; };

    const applyEye = (ox: number, oy: number) => {
      idleGaze = { gx: ox / MAX * 9, gy: oy / MAX * 7 };
      if (character === 'rootbeast') {
        for (const pupil of rootPupils) {
          // Match the generated rig's safe gaze bounds inside the eye whites.
          pupil.style.transform = `translate(${ox / MAX * 9}px,${oy / MAX * 7}px)`;
        }
        return;
      }
      eyes?.setAttribute('transform', `translate(${ox},${oy})`);
      const bdx = Math.round(ox * BODY_SCALE * 2) / 2;
      const bdy = Math.round(oy * BODY_SCALE * 2) / 2;
      body?.setAttribute('transform', `translate(${bdx},${bdy})`);
      const sx = 1 + Math.abs(bdx) * SHADOW_STRETCH;
      const shift = Math.round(bdx * SHADOW_SHIFT * 2) / 2;
      shadow?.setAttribute('transform', `translate(${shift},0) scale(${sx},1)`);
    };

    const showRootIdle = () => {
      if (!rootIdle || rootPupils.length < 2 || state !== 'idle' || mini || dragging || randomMode || dizzyRenderer?.visible || hangRenderer?.visible || musicRenderer?.visible || bottomRenderer?.visible || hunt?.visible || natural?.visible) return;
      rootIdle.style.visibility = ''; idlePlayback?.sync();
      img.style.display = 'none';
      svg.style.display = 'none';
    };
    // Same-origin generated art stays the single source. Loading or accessing
    // the document may fail; the already decoded img remains the fallback.
    const loadRootIdle = () => {
      try {
        const doc = rootIdle?.contentDocument;
        const pupils = Array.from(doc?.querySelectorAll<SVGGElement>('[data-rig-part="pupil"]') ?? []);
        // Idle has separate normal and happy expression layers for each eye.
        if (pupils.length < 2) return;
        rootPupils = pupils.map(pupil => pupil.parentNode as SVGGElement);
        for (const pupil of rootPupils) {
          pupil.style.animation = 'none';
          pupil.style.transition = 'transform .12s ease-out';
        }
        applyEye(0, 0);
        showRootIdle();
      } catch { /* Keep the image if the SVG document is unavailable. */ }
    };
    rootIdle?.addEventListener('load', loadRootIdle);
    loadRootIdle();

    // Paint an <img> frame. Decode first, swap after: assigning img.src directly
    // blanks the box for the whole round-trip — and forever if the request fails
    // — which is why the pet used to vanish on a flaky or slow network. On
    // failure keep a decoded frame of the same character, or try its idle art.
    // A previous character stays hidden while the replacement loads.
    // `replay` restarts a one-shot animation from the memory
    // cache instead of re-downloading it.
    let frameSeq = 0;
    let activeFrameUrl: string | undefined;
    const motionUrls = new Set<string>();
    const releaseMotionUrls = () => {
      for (const url of motionUrls) if (url !== activeFrameUrl) { URL.revokeObjectURL(url); motionUrls.delete(url); }
    };
    const paintFrame = (url: string, replay: boolean, onPaint: () => void, story = false) => {
      const seq = ++frameSeq;
      let painted = false;
      const show = (src: string) => {
        if (disposed || seq !== frameSeq) return;
        if (painted) return;
        painted = true;
        if (replay && img.getAttribute('src') === src) img.removeAttribute('src');
        img.src = src;
        activeFrameUrl = motionUrls.has(src) ? src : undefined;
        releaseMotionUrls();
        img.dataset.character = character;
        img.style.display = 'block';
        img.style.visibility = '';
        svg.style.display = 'none';
        onPaint();
        showRootIdle();
      };
      const fail = () => {
        if (disposed || seq !== frameSeq) return;
        releaseMotionUrls();
        if (img.getAttribute('src') && img.dataset.character === character) {
          img.style.visibility = ''; // only keep a frame belonging to this pet
          onPaint();
          return;
        }
        if (theme.inlineIdle) {
          img.style.display = 'none';
          svg.style.display = 'block';
          svg.style.visibility = '';
          applyEye(0, 0);
          onPaint();
        } else {
          // A failed first pose must not reveal the previous character. Load
          // this pet's idle art once; show() still rejects superseded loads.
          img.style.visibility = 'hidden';
          const fallback = new Image();
          const idle = assetUrl(theme.files.idle);
          fallback.onload = () => show(idle);
          fallback.onerror = () => { if (seq === frameSeq) onPaint(); };
          fallback.src = idle;
        }
      };
      const decode = (src: string) => {
        const pre = new Image();
        pre.onload = () => show(src);
        pre.onerror = fail;
        pre.src = src;
        if (pre.complete && pre.naturalWidth) show(src);
      };
      if (!story) { decode(url); return; }
      // Give each story its own timeline, even while the gallery is showing the
      // same SVG. The versioned fetch still uses the browser's immutable cache.
      loadMotionBlob(url)
        .then((blob) => {
          if (disposed || seq !== frameSeq) return;
          const url = URL.createObjectURL(blob);
          motionUrls.add(url);
          decode(url);
        })
        .catch(fail);
    };

    // Prewarm the poses the pet reaches on its own (idle → yawn → doze → sleep,
    // plus the two most common reactions) so the first swap paints from cache.
    const prewarm = () => {
      if (disposed) return;
      for (const k of ['working', 'happy', 'yawning', 'dozing', 'sleeping', 'idle']) {
        const f = theme.files[k];
        if (f) new Image().src = assetUrl(f);
      }
    };
    let prewarmIdle: number | undefined;
    let prewarmTimer: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback === 'function') prewarmIdle = requestIdleCallback(prewarm);
    else prewarmTimer = setTimeout(prewarm, 2000);

    const setState = (s: string, force = false, ready?: () => void) => {
      if (disposed || (leaving && !s.startsWith('exit-'))) return;
      if (interactionOwnsArt() && !s.startsWith('exit-')) return;
      if (s === state && !force) { ready?.(); return; }
      clearTimeout(autoTimer);
      ++frameSeq; // invalidate pending loads, including transitions to inline idle
      releaseMotionUrls(); // Keep the decoded current frame until its replacement paints.
      state = s;
      if (rootIdle) {
        rootIdle.style.visibility = 'hidden'; idlePlayback?.sync();
        img.style.display = 'block';
      }
      root.dataset.state = s;
      const isMini = s.startsWith('mini-');
      const story = characterScene(s);
      const motion = theme.motion?.[s];
      const replayIdle = s === 'idle' && restartIdle;
      const replayDrag = s === 'reactDrag' && restartDrag;
      restartIdle = false;
      restartDrag = false;
      const back = ready ? undefined : story?.durationMs ?? (isMini ? MINI_AUTO[s] : theme.auto?.[s] ?? AUTO[s]);
      const onPaint = () => {
        if (replayIdle) { restartIdleDocument(rootIdle); applyEye(0, 0); }
        // New pose is decoded before retiring the final vector frame.
        if (!dizzyOwnsArt() || leaving) dizzyRenderer?.hide();
        if (!hangRenderer?.active || leaving) hangRenderer?.hide();
        if (!musicRenderer?.active || leaving) musicRenderer?.suspend();
        if (!bottomRenderer?.active || leaving) bottomRenderer?.hide();
        if (!hunt?.active || leaving) hunt?.retire();
        if (!natural?.active || leaving) { natural?.retire(); delete root.dataset.naturalSleep; }
        ready?.();
        if (back) autoTimer = setTimeout(() => {
          if (isMini) onMiniAutoReturn(s);
          else setState('idle');
        }, back);
        musicRenderer?.sync();
      };
      asleep = s === 'sleeping' || s === 'dozing' || s === 'mini-sleep';
      if (!isMini && s === 'idle' && theme.inlineIdle) {
        activeFrameUrl = undefined;
        releaseMotionUrls();
        img.style.display = 'none';
        svg.style.display = 'block';
        svg.style.visibility = ''; // clear any hide from a character switch
        applyEye(0, 0);
        ready?.();
      } else {
        let file: string;
        if (isMini) {
          // calico lacks mini-working / mini-enter-sleep → fall back to idle / sleep.
          file = theme.mini.files[MINI_KEYS[s]] || theme.mini.files.idle;
        } else {
          file = theme.files[s] || theme.files[s === 'exit-sleep' ? 'sleeping' : s === 'exit-hop' ? 'reactDrag' : 'idle'] || theme.files.working;
        }
        // A stable asset version preserves caching; stories get independent
        // timelines so selecting a gallery thumbnail starts a complete loop.
        paintFrame(motion?.src ?? story?.src ?? assetUrl(file), force, onPaint, !!(motion || story || replayIdle || replayDrag));
        showRootIdle();
      }
    };

    if (rootDizzy) dizzyRenderer = createDizzyRenderer({
      object: rootDizzy,
      snapshot: shake.snapshot,
      reducedMotion,
      interrupted: () => disposed || leaving || dnd || mini || miniTransitioning,
      onShow: () => {
        ++frameSeq;
        releaseMotionUrls();
        clearTimeout(autoTimer); clearTimeout(idleTimer); clearSleepTimers();
        applyEye(0, 0);
      },
      onHandoff: () => {
        hangRenderer?.hide();
        img.style.visibility = 'hidden'; svg.style.visibility = 'hidden';
        if (rootIdle) { rootIdle.style.visibility = 'hidden'; idlePlayback?.sync(); }
      },
      onRest: () => {
        if (disposed || leaving || dnd || mini || miniTransitioning) return;
        restartIdle = true;
        setState('idle', true);
        if (!randomMode) resetIdle();
      },
      onUnavailable: () => {
        if (disposed || leaving) return;
        // Keep a known same-character frame if the embedded document fails.
        if (img.dataset.character === character && img.getAttribute('src')) {
          img.style.display = 'block'; img.style.visibility = '';
        }
        setState(dnd ? 'sleeping' : 'idle', true);
      },
    });

    const topLine = () => window.visualViewport?.offsetTop ?? 0;
    const pinHang = () => {
      const r = root.getBoundingClientRect();
      // Only the vertical anchor changes; the release's horizontal coordinate stays exact.
      root.style.transition = '';
      root.style.bottom = vpH() - topLine() - r.height + r.height * HANG_HOOK_Y + 'px';
    };
    if (rootHang) hangRenderer = createHangRenderer({
      object: rootHang, reducedMotion,
      onPhase: phase => {
        hangingRef.current = phase === 'hanging';
        if (phase) root.dataset.hangPhase = phase; else delete root.dataset.hangPhase;
      },
      onShow: () => {
        suspendMusic();
        dismissBottom();
        ++frameSeq; releaseMotionUrls();
        clearTimeout(autoTimer); clearTimeout(idleTimer); clearTimeout(randomTimer); clearSleepTimers();
        dizzyRenderer?.hide(); applyEye(0, 0);
        img.style.visibility = 'hidden'; svg.style.visibility = 'hidden';
        if (rootIdle) { rootIdle.style.visibility = 'hidden'; idlePlayback?.sync(); }
      },
      onRest: () => {
        if (disposed || leaving || dnd || mini || miniTransitioning || dizzyOwnsArt()) return;
        restartIdle = !dragging;
        setState(dragging ? 'reactDrag' : 'idle', true);
        if (randomMode) scheduleRandom(); else resetIdle();
      },
      onUnavailable: () => {
        if (disposed || leaving) return;
        setState(dnd ? 'sleeping' : dragging ? 'reactDrag' : 'idle', true);
      },
    });

    if (rootHang) hangPlay = createDeskPetHangInteraction({
      object: rootHang,
      box: () => { const r = root.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width }; },
      enabled: () => !!hangRenderer?.hanging && !disposed && !leaving && !dragging && !dnd && !asleep
        && !mini && !miniTransitioning && !randomMode && !document.hidden && !reducedMotion()
        && !searchOpenRef.current && shake.snapshot().phase === 'idle' && !dizzyRenderer?.visible
        && !mayUseMiniProgramBridge() && performance.now() - lastDragEnded >= 1200,
      interruption: () => disposed || leaving || document.hidden || shake.snapshot().phase !== 'idle'
        || dizzyRenderer?.visible || !hangRenderer?.visible ? 'hard'
        : dragging ? 'drag' : !hangRenderer.hanging || dnd || asleep || mini || miniTransitioning || randomMode
          || searchOpenRef.current || reducedMotion() || mayUseMiniProgramBridge() ? 'soft' : null,
    });

    if (rootMusic) musicRenderer = createMusicRenderer({
      object: rootMusic, read: getMusicPlayerState,
      subscribe: listener => subscribeMusicPlayer(() => {
        if (getMusicPlayerState().playing && natural?.mode === 'drowsy') { natural.stop(); setState('idle', true); }
        if (getMusicPlayerState().playing && !hunt?.emerging) dismissBottom();
        listener();
      }),
      reducedMotion,
      blocked: () => !musicReadyToShow || disposed || leaving || dragging || dnd || mini || miniTransitioning || document.hidden || state === 'waking' || state === 'enter'
        || shake.snapshot().phase !== 'idle' || !!dizzyRenderer?.visible || !!hangRenderer?.visible || !!bottomRenderer?.visible || !!hunt?.active || !!hunt?.visible || !!natural?.active || !!natural?.visible,
      onShow: () => {
        ++frameSeq; releaseMotionUrls();
        clearTimeout(autoTimer); clearTimeout(idleTimer); clearTimeout(randomTimer); clearSleepTimers();
        asleep = false;
        applyEye(0, 0);
        img.style.visibility = 'hidden'; svg.style.visibility = 'hidden';
        if (rootIdle) { rootIdle.style.visibility = 'hidden'; idlePlayback?.sync(); }
      },
      onRest: () => {
        if (disposed || leaving || dnd || mini || miniTransitioning || physicalInteractionOwnsArt()) return;
        restartIdle = !dragging;
        setState(dragging ? 'reactDrag' : 'idle', true);
        if (randomMode) scheduleRandom(); else resetIdle();
      },
      onUnavailable: () => {
        if (disposed || leaving || physicalInteractionOwnsArt()) return;
        if (img.dataset.character === character && img.getAttribute('src')) {
          img.style.display = 'block'; img.style.visibility = '';
        }
        setState(dnd ? 'sleeping' : dragging ? 'reactDrag' : 'idle', true);
      },
    });

    const bottomViewportNow = () => bottomPeekViewport(vpW(), vpH(), window.visualViewport);
    const bottomAnchorHeight = (box = root.getBoundingClientRect()) => {
      if (character !== 'rootbeast' || mayUseMiniProgramBridge()) return vpH();
      // Fixed-position CSS anchors can have a fractional containing height even
      // though documentElement.clientHeight has already rounded it to an integer.
      const bottom = parseFloat(getComputedStyle(root).bottom);
      return Number.isFinite(bottom) ? box.bottom + bottom : vpH();
    };
    const peekLineNow = (box = root.getBoundingClientRect()) => {
      const pixel = 1 / ((window.devicePixelRatio || 1) * (window.visualViewport?.scale || 1));
      const geometry = bottomRenderer?.geometry(pixel);
      return geometry ? bottomPeekLine(box, bottomViewportNow(), geometry) : undefined;
    };
    let lastBottomDrop: { reason: string; line: number | null; rawLine: number;
      box: { top: number; left: number; width: number; height: number }; viewportBottom: number } | undefined;
    let lastBottomCancel: string | undefined;
    let lastBottomPresentation: object | undefined;
    const inspectBottom = () => {
      const rect = root.getBoundingClientRect();
      let rig: object | undefined;
      try {
        const element = rootBottomPeek?.contentDocument?.documentElement as unknown as SVGSVGElement | undefined;
        if (element) {
          const style = element.ownerDocument.defaultView?.getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          const matrix = element.getScreenCTM?.();
          const riseNode = element.querySelector<SVGElement>('.pk-rise');
          rig = { width: element.getAttribute('width'), height: element.getAttribute('height'),
            tag: element.localName, marker: element.getAttribute('data-rootbeast-peek'), viewBox: element.getAttribute('viewBox'),
            bounds: { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height },
            matrix: matrix ? { a: matrix.a, d: matrix.d, e: matrix.e, f: matrix.f } : null,
            peek: element.getAttribute('data-peek'), line: element.style.getPropertyValue('--peek-y'),
            pk: style?.getPropertyValue('--pk'), pu: style?.getPropertyValue('--pu'), rise: style?.getPropertyValue('--rise'),
            riseTransform: riseNode ? element.ownerDocument.defaultView?.getComputedStyle(riseNode).transform : undefined };
        }
      } catch { rig = { unavailable: true }; }
      return { revision: 'bottom-peek-geometry-20261025', lastDrop: lastBottomDrop, lastCancel: lastBottomCancel,
        beforeInterruption: lastBottomPresentation, state, bottomPhase: root.dataset.bottomPeekPhase ?? null,
        drag: { pointerX: lastPointerX, pointerY: lastPointerY, gripY: dragGripY, baseAssist: baseBottomAssist,
          layoutHeight: vpH(), visualHeight: window.visualViewport?.height, visualOffset: window.visualViewport?.offsetTop,
          fullscreenElement: !!document.fullscreenElement },
        ready: !!bottomRenderer?.ready, visible: !!bottomRenderer?.visible,
        gates: { leaving, dragging, dnd, mini, miniTransitioning, shake: shake.snapshot().phase,
          hang: !!hangRenderer?.active, playing: getMusicPlayerState().playing, musicArt: !!musicRenderer?.active,
          nativeBoundary: mayUseMiniProgramBridge() },
        box: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, rig };
    };
    if (rootBottomPeek) bottomRenderer = createBottomPeekRenderer({
      object: rootBottomPeek, reducedMotion,
      onPhase: phase => {
        bottomPeekingRef.current = phase === 'peeking';
        if (phase) root.dataset.bottomPeekPhase = phase; else delete root.dataset.bottomPeekPhase;
      },
      onShow: () => {
        ++frameSeq; releaseMotionUrls();
        clearTimeout(autoTimer); clearTimeout(idleTimer); clearTimeout(randomTimer); clearSleepTimers();
        asleep = false; applyEye(0, 0);
        img.style.visibility = 'hidden'; svg.style.visibility = 'hidden';
        if (rootIdle) { rootIdle.style.visibility = 'hidden'; idlePlayback?.sync(); }
      },
      onRest: () => {
        if (disposed || leaving || dnd || mini || miniTransitioning || dizzyOwnsArt() || hangRenderer?.active) return;
        restartIdle = !dragging; restartDrag = dragging;
        setState(dragging ? 'reactDrag' : 'idle', true);
        if (randomMode) scheduleRandom(); else resetIdle();
      },
      onUnavailable: () => {
        if (disposed || leaving) return;
        if (img.dataset.character === character) img.style.visibility = '';
        setState(dnd ? 'sleeping' : dragging ? 'reactDrag' : 'idle', true);
      },
    });

    const bottomHuntAllowed = () => !(disposed || leaving || dragging || dnd || asleep || mini || miniTransitioning
      || (state !== 'idle' && !bottomRenderer?.peeking) || randomMode || searchOpenRef.current || document.hidden || reducedMotion() || mayUseMiniProgramBridge()
      || natural?.active || natural?.visible || dizzyOwnsArt() || shake.snapshot().phase !== 'idle' || hangRenderer?.active
      || musicRenderer?.active || musicRenderer?.visible || getMusicPlayerState().playing
      || performance.now() - lastDragEnded < 1200);
    if (rootHunt) hunt = createDeskPetHunt({
      object: rootHunt,
      box: () => { const r = root.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width }; },
      travel: box => {
        const margin = box.width * MINI_SNAP_FRAC + 12, center = box.left + box.width * VC[character][0];
        return { min: margin - center, max: vpW() - margin - center };
      },
      canStart: () => {
        if (disposed || leaving || dragging || dnd || asleep || mini || miniTransitioning || state !== 'idle'
          || randomMode || searchOpenRef.current || document.hidden || reducedMotion() || mayUseMiniProgramBridge()
          || physicalInteractionOwnsArt() || musicRenderer?.active || musicRenderer?.visible || getMusicPlayerState().playing
          || hunt?.visible || natural?.visible || performance.now() - lastDragEnded < 1200) return false;
        const r = root.getBoundingClientRect(), viewport = bottomViewportNow();
        return r.top >= (window.visualViewport?.offsetTop ?? 0) && r.bottom <= viewport.bottom;
      },
      interruption: () => disposed || leaving || dragging || document.hidden || dizzyOwnsArt() || hangRenderer?.active
        || (bottomRenderer?.active && !bottomRenderer.peeking) || reducedMotion() ? 'hard'
        : dnd || asleep || mini || miniTransitioning || randomMode || searchOpenRef.current || (state !== 'idle' && !bottomRenderer?.peeking)
          || getMusicPlayerState().playing || musicRenderer?.active ? 'soft' : null,
      idle: () => {
        try {
          const element = rootIdle?.contentDocument?.documentElement as unknown as SVGSVGElement | undefined;
          const animation = element?.getAnimations?.({ subtree: true })?.[0];
          const time = animation?.currentTime;
          return { time: typeof time === 'number' ? time / 1000 : element?.getCurrentTime?.() ?? 0, ...idleGaze };
        } catch { return { time: 0, ...idleGaze }; }
      },
      onStart: () => {
        // Peek owns the picture independently of the previous drag state.
        // Adopt its neutral logical state without painting over the shared rig.
        if (bottomRenderer?.peeking) { state = 'idle'; root.dataset.state = 'idle'; }
        ++frameSeq; releaseMotionUrls(); clearTimeout(autoTimer); clearTimeout(idleTimer); clearTimeout(randomTimer); clearSleepTimers();
        img.style.visibility = 'hidden'; svg.style.visibility = 'hidden'; if (rootIdle) { rootIdle.style.visibility = 'hidden'; idlePlayback?.sync(); }
        root.dataset.huntPhase = 'active';
      },
      onTravel: (pixels, bodyOffset) => {
        root.style.translate = `${pixels}px 0`;
        // Keep the existing body hit area with the airborne body, without
        // adding a large transparent layer that intercepts nearby page clicks.
        hit.style.translate = `0 ${bodyOffset}px`;
      },
      onCommit: pixels => {
        const right = parseFloat(getComputedStyle(root).right);
        root.style.right = (Number.isFinite(right) ? right - pixels : vpW() - root.getBoundingClientRect().right) + 'px';
        root.style.translate = ''; hit.style.translate = ''; delete root.dataset.huntPhase;
        persistItem(POS_KEY, JSON.stringify({ right: parseFloat(root.style.right), bottom: parseFloat(getComputedStyle(root).bottom) || 0 }));
        if (!disposed && !physicalInteractionOwnsArt() && img.dataset.character === character && img.getAttribute('src')) {
          img.style.display = 'block'; img.style.visibility = '';
        }
      },
      onRest: () => {
        if (disposed || leaving || dragging || dnd || mini || miniTransitioning || state !== 'idle' || physicalInteractionOwnsArt()) return;
        restartIdle = true; setState('idle', true); resetIdle();
      },
      bottom: {
        peek: () => {
          const element = bottomRenderer?.document, line = bottomRenderer?.contactLine;
          if (!bottomRenderer?.peeking || !element || line === undefined || !peekSettled(element)) return;
          return { line, loop: () => readPeekLoop(element) };
        },
        canStart: bottomHuntAllowed,
        suspend: line => bottomRenderer?.suspend(line),
        restore: line => {
          if (!bottomHuntAllowed()) return false;
          const element = bottomRenderer?.document;
          if (element) restartPeekLoop(element);
          return bottomRenderer?.resume(line) ?? false;
        },
        clear: () => bottomRenderer?.hide(),
        onLift: pixels => { root.style.translate = `0 ${-pixels}px`; },
        onCommitLift: pixels => {
          const bottom = parseFloat(getComputedStyle(root).bottom) || 0;
          root.style.bottom = `${bottom + pixels}px`; root.style.translate = '';
          persistItem(POS_KEY, JSON.stringify({ right: parseFloat(getComputedStyle(root).right) || 0, bottom: bottom + pixels }));
        },
        onDragRest: () => {
          if (disposed || leaving) return;
          restartDrag = dragging; restartIdle = !dragging;
          setState(dragging ? 'reactDrag' : 'idle', true);
        },
      },
    });

    if (rootSleep) natural = createDeskPetNaturalSleep({
      object: rootSleep, reducedMotion,
      canStart: () => !(disposed || leaving || dragging || dnd || asleep || mini || miniTransitioning || randomMode
        || document.hidden || mayUseMiniProgramBridge() || physicalInteractionOwnsArt() || hunt?.active
        || natural?.visible || musicRenderer?.active || musicRenderer?.visible || getMusicPlayerState().playing || state !== 'idle'),
      idle: () => {
        let idleTime = 0;
        try { const element = rootIdle?.contentDocument?.documentElement as unknown as SVGSVGElement | undefined;
          const time = element?.getAnimations?.({ subtree: true })?.[0]?.currentTime;
          idleTime = typeof time === 'number' ? time / 1000 : element?.getCurrentTime?.() ?? 0;
        } catch { /* Idle frame zero is the existing fallback. */ }
        return { idleTime, ...idleGaze };
      },
      onShow: () => {
        ++frameSeq; releaseMotionUrls(); clearTimeout(autoTimer); clearTimeout(idleTimer); clearTimeout(randomTimer);
        clearSleepTimers(); clearTimeout(clickTimer); clicks = 0;
        setSearchOpen(false); setTouchActionsVisible(false); root.dataset.naturalSleep = 'on';
        setRoutineBootReady(true);
        img.style.visibility = 'hidden'; svg.style.visibility = 'hidden'; if (rootIdle) { rootIdle.style.visibility = 'hidden'; idlePlayback?.sync(); }
      },
      onAwake: () => {
        if (disposed || leaving) return;
        routine?.awake(new Date()); automaticNatural = false;
        restartIdle = true; setState('idle', true); resetIdle();
      },
      onUnavailable: () => {
        if (disposed || leaving) return;
        routine?.cancelInitial(); setRoutineBootReady(true); automaticNatural = false;
        delete root.dataset.naturalSleep; restartIdle = true; setState('idle', true); resetIdle();
      },
    });

    // After a one-shot mini pose (peek/alert/happy) finishes, settle back to the
    // mini rest pose — staying nudged-in if the cursor is still over the pet.
    const onMiniAutoReturn = (from: string) => {
      if (!mini) return;
      if (from === 'mini-peek') { setState('mini-idle', true); return; }
      setState(dnd ? 'mini-sleep' : (mouseOverPet ? 'mini-peek' : 'mini-idle'), true);
    };

    const trackCursor = (cx: number, cy: number) => {
      if ((!theme.inlineIdle && rootPupils.length < 2) || state !== 'idle' || dragging || randomMode || hunt?.active) return;
      const r = root.getBoundingClientRect();
      const dx = cx - (r.left + r.width * (character === 'rootbeast' ? .42 : .489));
      const dy = cy - (r.top + r.height * (character === 'rootbeast' ? .59 : .756));
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) return applyEye(0, 0);
      const clamp = (Math.min(dist, REACH) / REACH) * MAX;
      applyEye((dx / dist) * clamp, (dy / dist) * clamp);
    };

    const goSleep = () => {
      if (character === 'rootbeast' || disposed || leaving || dnd || randomMode || hunt?.active || natural?.active) return;
      clearSleepTimers();
      setState('yawning');
      afterSleep(() => { if (state === 'yawning') setState('dozing'); }, 2500);
      afterSleep(() => { if (state === 'dozing') setState('sleeping'); }, 5000);
    };
    const wakeUp = () => {
      clearSleepTimers();
      setState('waking', true);
      afterSleep(() => { if (state === 'waking') setState('idle'); }, 1400);
    };
    const resetIdle = () => {
      clearTimeout(idleTimer);
      if (character === 'rootbeast' || disposed || leaving || dnd || randomMode || natural?.active) return;
      idleTimer = setTimeout(goSleep, SLEEP_AFTER);
    };

    const enterRest = () => {
      if (natural?.active) return;
      if (leaving) return;
      if (deferHunt(enterRest)) return;
      dnd = true;
      dismissBottom();
      suspendMusic();
      hangRenderer?.interrupt();
      shake.cancel();
      clearSleepTimers();
      clearTimeout(idleTimer);
      clearTimeout(autoTimer);
      setState(mini ? 'mini-sleep' : 'sleeping', true);
      setResting(true);
    };
    const exitRest = () => {
      if (leaving) return;
      if (natural?.active) { natural.wake(); return; }
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
      persistItem(MINI_KEY, JSON.stringify({ edge: miniEdge, preRight: preMiniRight, preBottom: preMiniBottom }));
    };

    // Enter cling. viaMenu → crabwalk sideways to the edge first; drag-drop →
    // slide straight into place. Both then play mini-enter, then settle to rest.
    const enterMini = (edge: 'left' | 'right', viaMenu: boolean) => {
      if (leaving || (mini && !viaMenu)) return;
      if (deferHunt(() => enterMini(edge, viaMenu))) return;
      dismissBottom();
      const r = root.getBoundingClientRect();
      preMiniRight = vpW() - r.right;
      preMiniBottom = vpH() - r.bottom;
      mini = true; miniEdge = edge; miniTransitioning = true;
      syncMiniRef();
      clearTimeout(idleTimer); clearTimeout(autoTimer); clearTimeout(miniTimer);
      root.classList.add('mini-turn');
      void img.getBoundingClientRect();
      root.classList.add('mini-mode');
      root.classList.toggle('mini-left', edge === 'left');
      const target = miniRight(false);
      const settle = () => {
        miniTransitioning = false;
        setState(dnd ? 'mini-sleep' : 'mini-idle', true);
      };
      const playEnter = () => {
        root.style.transition = '';
        const duration = reducedMotion() ? 0 : theme.mini.enterMs ?? MINI_ENTER_MS;
        let begun = false;
        let painted = false;
        const begin = () => { if (begun || disposed || leaving || !mini) return; begun = true; if (!painted) ++frameSeq; clearTimeout(miniTimer); miniTimer = setTimeout(settle, duration); };
        miniTimer = setTimeout(begin, 600);
        setState(dnd ? 'mini-enter-sleep' : 'mini-enter', true, () => { painted = true; begin(); });
      };
      if (viaMenu) {
        setState('mini-crabwalk', true);
        const dist = Math.abs((vpW() - r.right) - target);
        const dur = reducedMotion() ? 0 : Math.max(250, Math.round(dist / CRABWALK_SPEED));
        root.style.transition = `right ${dur}ms linear`;
        root.style.right = target + 'px';
        miniTimer = setTimeout(playEnter, dur + 30);
      } else {
        root.style.transition = reducedMotion() ? '' : `right ${MINI_SLIDE_MS}ms ease-out`;
        root.style.right = target + 'px';
        miniTimer = setTimeout(playEnter, reducedMotion() ? 0 : Math.max(MINI_SLIDE_MS, TURN_MS));
      }
      persistMini();
    };

    // Pull out of cling back into normal mode, keeping the on-screen position.
    const liftFromMini = (pose?: string) => {
      mini = false; miniTransitioning = false; mouseOverPet = false;
      syncMiniRef();
      clearTimeout(miniTimer);
      root.classList.remove('mini-mode', 'mini-left');
      root.style.transition = '';
      try { localStorage.removeItem(MINI_KEY); } catch {}
      const motion = theme.motion?.['mini-leave'];
      if (pose && motion && !reducedMotion()) {
        miniTransitioning = true;
        let begun = false;
        let painted = false;
        const begin = () => {
          if (begun || disposed || leaving || mini) return;
          begun = true;
          if (!painted) ++frameSeq;
          clearTimeout(miniTimer);
          miniTimer = setTimeout(() => {
            miniTransitioning = false;
            setState(dnd ? 'sleeping' : dragging ? pose : 'idle', true);
          }, motion.durationMs);
        };
        miniTimer = setTimeout(begin, 600);
        setState('mini-leave', true, () => { painted = true; begin(); });
      } else if (pose) setState(pose, true);
    };

    // Cursor over the clinging pet → nudge it on-screen and peek (mouse only).
    const peekIn = () => { if (!mini || dnd || miniTransitioning) return; root.style.transition = 'right .18s ease-out'; root.style.right = miniRight(true) + 'px'; };
    const peekOut = () => { if (!mini) return; root.style.transition = 'right .18s ease-out'; root.style.right = miniRight(false) + 'px'; };

    // On drop: cling if the visual center landed within MINI_SNAP_FRAC of an edge.
    const snapEdge = (): 'left' | 'right' | null => {
      if (grouped) return null;
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
      if (leaving || dizzyOwnsArt() || hangRenderer?.active || grouped) return;
      dismissBottom();
      suspendMusic();
      if (mini) {
        const pr = preMiniRight, pb = preMiniBottom;
        liftFromMini(dnd ? 'sleeping' : 'idle');
        const rb = root.getBoundingClientRect();
        const c = clampAnchor(pr, pb, rb.width, rb.height, VC[character][0], VC[character][1], character === 'rootbeast');
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
      if (!leaving && deferHunt(() => drive(s))) return;
      if (leaving || interactionOwnsArt() || miniTransitioning || dnd) return;
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
      if (s === 'idle' || theme.files[s] || characterScene(s)) setState(s, true);
    };

    let lastMove = 0;
    // Random-play mode: cycle a random expression every ~6–15s, no cursor eye-track
    // and no sleep timer (skipped while dragged / resting; drive() honors mini-cling).
    // Pool = every expressive state this character actually has art for (so clawd's
    // debugger/wizard/ultrathink/boss/error all show too), minus interaction-only
    // reactions and the sleep-cycle poses that shouldn't fire unprompted.
    const RANDOM_EXCLUDE = new Set(['idle', 'reactDouble', 'reactAnnoyed', 'reactDrag', 'waking', 'sleeping', 'dozing']);
    const RANDOM_POOL = [
      ...(character === 'rootbeast' ? ROOTBEAST_RANDOM_SCENES.map(scene => scene.state)
        : ORIGINAL_CHARACTERS.some(pet => pet.id === character)
          ? ORIGINAL_SCENES.filter(scene => scene.character === character && !['idle', 'sleep', 'doze', 'wake'].includes(scene.id)).map(scene => scene.state)
          : Object.keys(theme.files).filter((k) => !RANDOM_EXCLUDE.has(k))),
      ...(character === 'clawd' ? PLAYTIME_SCENES.map((scene) => scene.state) : []),
    ];
    let lastRandom = '';
    const playRandom = () => {
      if (dnd || dragging || document.hidden || getDeskPetScene(state) || RANDOM_POOL.length === 0) return;
      // Avoid repeating the same pose twice in a row so the variety reads.
      let pick = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)];
      if (RANDOM_POOL.length > 1 && pick === lastRandom)
        pick = RANDOM_POOL[(RANDOM_POOL.indexOf(pick) + 1) % RANDOM_POOL.length];
      lastRandom = pick;
      drive(pick);
    };
    const scheduleRandom = () => {
      randomTimer = setTimeout(() => { playRandom(); scheduleRandom(); }, 6000 + Math.random() * 9000);
    };

    const onMove = (e: PointerEvent) => {
      if (natural?.active) { if (!dragging && e.pointerType === 'mouse') natural.notice(e.clientX, e.clientY); return; }
      if (e.pointerType === 'mouse') { hunt?.pointer(e.clientX, e.clientY); hangPlay?.pointer(e.clientX, e.clientY); }
      if (leaving || dnd || mini) return; // mini uses hover enter/leave; no eye-track / sleep timer
      const now = performance.now();
      if (now - lastMove > 16) { trackCursor(e.clientX, e.clientY); lastMove = now; }
      if (asleep) exitRest(); else if (!randomMode && !hunt?.active) resetIdle();
    };

    const openSearch = () => {
      hangPlay?.stop('soft');
      // Touch: raise the keyboard now, inside the tap gesture, via the primer
      // input. The overlay mounts async, so focusing its real input later loses
      // the gesture and mobile browsers refuse to open the keyboard. The real
      // input takes over (no blur in between → keyboard stays up).
      if (lastTouch) { try { kbdRef.current?.focus({ preventScroll: true }); } catch {} }
      const r = root.getBoundingClientRect();
      const [fx, fy] = VC[character];
      searchOriginRef.current = { x: r.left + r.width * fx, y: r.top + r.height * fy };
      searchNavigationRef.current(true);
    };

    let clicks = 0;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    let touchActionsTimer: ReturnType<typeof setTimeout> | undefined;
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    const revealTouchActions = () => {
      clearTimeout(touchActionsTimer);
      setTouchActionsVisible(true);
      touchActionsTimer = setTimeout(() => setTouchActionsVisible(false), 3000);
    };
    const onClick = (event: MouseEvent) => {
      if (leaving) return;
      if (suppressClick) { suppressClick = false; return; }
      if (dragging) return;
      if (natural?.active) { if (natural.contains(event.clientX, event.clientY)) natural.tap(event.clientX, event.clientY); return; }
      if (dnd || asleep) { exitRest(); return; }
      // In cling mode a tap just opens search (no multi-click react poses).
      if (mini) { openSearch(); return; }
      // Touch: open synchronously inside the tap gesture so the search input can
      // grab focus + raise the mobile keyboard (the debounced multi-click
      // reactions below are mouse-only and would push focus past the gesture).
      if (lastTouch) { openSearch(); return; }
      clicks++;
      // Open on the very first click — waiting out the multi-click window first
      // cost 280ms on every single open (measured). The reactions still work:
      // a 2nd/4th click inside the window takes the overlay back down and plays
      // the pose instead (the pet sits above the backdrop, so it stays clickable).
      if (clicks === 1) openSearch();
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        if (clicks >= 4) { searchNavigationRef.current(false); setState('reactAnnoyed', true); }
        else if (clicks === 2) { searchNavigationRef.current(false); setState('reactDouble', true); }
        clicks = 0;
      }, 280);
    };

    let sx = 0, sy = 0, baseR = 0, baseB = 0, baseW = 0, baseH = 0, baseAnchorHeight = vpH(), moved = false;
    let lastPointerX = 0, lastPointerY = 0, dragGripY = 0, baseBottomAssist = 0, assistBottomDrag = false;
    let lastDragBox = { left: 0, top: 0, width: 0, height: 0 };
    const dragBottomEdge = () => bottomViewportNow().bottom;
    const reach = (y: number) => assistBottomDrag
      ? bottomDragReach(y, dragGripY, baseH, dragBottomEdge(), VC[character][1] - PEEK) : 0;
    const rebaseDrag = () => {
      if (!dragging) return;
      const r = root.getBoundingClientRect();
      sx = lastPointerX; sy = lastPointerY;
      baseAnchorHeight = bottomAnchorHeight(r);
      baseR = vpW() - r.right; baseB = baseAnchorHeight - r.bottom;
      baseW = r.width; baseH = r.height; dragGripY = sy - r.top;
      lastDragBox = { left: r.left, top: r.top, width: r.width, height: r.height };
      baseBottomAssist = reach(sy);
    };
    let suppressClick = false;
    let lastTouch = false;
    const onDown = (e: PointerEvent) => {
      if (leaving) return;
      if (e.button === 2) return; // ignore right mouse button (no context menu)
      hangPlay?.stop('drag');
      hunt?.grab();
      lastBottomDrop = undefined; lastBottomCancel = undefined; lastBottomPresentation = undefined;
      bottomRenderer?.release();
      suspendMusic();
      hangRenderer?.release();
      lastTouch = e.pointerType !== 'mouse';
      suppressClick = false;
      dragging = true; moved = false;
      root.classList.add('dragging');
      root.style.transition = ''; // a leftover mini slide would fight the 1:1 drag
      hit.setPointerCapture(e.pointerId);
      capturedPointer = e.pointerId;
      sx = e.clientX; sy = e.clientY;
      lastPointerX = sx; lastPointerY = sy;
      const r = root.getBoundingClientRect();
      baseR = vpW() - r.right;
      baseAnchorHeight = bottomAnchorHeight(r);
      baseB = baseAnchorHeight - r.bottom;
      baseW = r.width; baseH = r.height;
      lastDragBox = { left: r.left, top: r.top, width: r.width, height: r.height };
      dragGripY = sy - r.top;
      assistBottomDrag = character === 'rootbeast' && !dnd && !getMusicPlayerState().playing
        && shake.snapshot().phase === 'idle' && !mayUseMiniProgramBridge();
      baseBottomAssist = reach(sy);
      if (e.pointerType === 'mouse' && e.button === 0 && !dnd && !natural?.active) {
        shake.begin(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }, r.width);
      }
      clearTimeout(longPressTimer);
      if (lastTouch) longPressTimer = setTimeout(() => {
        if (!dragging || moved) return;
        suppressClick = true;
        revealTouchActions();
      }, 550);
      // While clinging, mousedown alone must not change the pose — a mere tap
      // should still open search. The lift happens on the first real move.
      if (!dnd && !mini && e.pointerType === 'mouse') setState('reactDrag', true);
      e.preventDefault();
    };
    const onDragMove = (e: PointerEvent) => {
      if (!dragging) return;
      if (capturedPointer !== undefined && e.pointerId !== capturedPointer) return;
      lastPointerX = e.clientX; lastPointerY = e.clientY;
      if (e.pointerType === 'mouse' && capturedPointer === e.pointerId && !dnd && !mini && !miniTransitioning) {
        shake.move(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      }
      const dist = Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
      if (dist > 4 && !moved) {
        if (natural?.mode === 'drowsy') natural.stop();
        clearTimeout(longPressTimer);
        moved = true;
        if (mini) liftFromMini(dnd ? 'sleeping' : 'reactDrag'); // pull out of cling
        else if (!dnd) setState('reactDrag', true); // first real move (covers touch)
      }
      const c = clampAnchor(baseR - (e.clientX - sx), baseB - (e.clientY - sy) - (reach(e.clientY) - baseBottomAssist),
        baseW, baseH, VC[character][0], VC[character][1], character === 'rootbeast');
      if (character === 'rootbeast' && !mayUseMiniProgramBridge()) {
        // The visible viewport may be shorter than clientHeight (zoom/overlays).
        // Use the same bottom edge for the reachable drag limit and contact line.
        const visibleBottom = dragBottomEdge();
        c.bottom = Math.max(c.bottom, baseAnchorHeight - visibleBottom - baseH * (1 - VC[character][1] + PEEK));
      }
      root.style.right = c.right + 'px';
      root.style.bottom = c.bottom + 'px';
      lastDragBox = { left: vpW() - c.right - baseW, top: baseAnchorHeight - c.bottom - baseH, width: baseW, height: baseH };
    };
    const onUp = (event?: PointerEvent) => {
      clearTimeout(longPressTimer);
      if (!dragging) return;
      if (event && event.pointerId !== capturedPointer) return;
      // Fullscreen/low-rate input can coalesce the last move; consume the real release sample.
      if (event) onDragMove(event);
      if (capturedPointer !== undefined) shake.end(capturedPointer);
      dragging = false;
      lastDragEnded = performance.now();
      root.classList.remove('dragging');
      releasePointer();
      if (natural?.active) {
        suppressClick = moved;
        persistItem(POS_KEY, JSON.stringify({ right: parseFloat(root.style.right) || 0, bottom: parseFloat(root.style.bottom) || 0 }));
        return;
      }
      // A very short grab may release before the 280ms joint handoff ends.
      // Commit that handoff before evaluating this same real release sample.
      if (hunt?.emerging) hunt.stop('hard');
      if (moved) {
        suppressClick = true; // a real drag fires a trailing click — don't open search
        const released = root.getBoundingClientRect();
        const line = peekLineNow(released);
        const viewportBottom = dragBottomEdge();
        lastBottomDrop = { reason: 'not-entered', line: line ?? null,
          rawLine: (viewportBottom - released.top) * 640 / released.height, viewportBottom,
          box: { top: released.top, left: released.left, width: released.width, height: released.height } };
        // Release only: merely crossing the top during a drag never attaches.
        // Top wins over a side at a corner; dizziness keeps its existing timeline.
        if (character === 'rootbeast' && !dnd && !mini && !miniTransitioning
          && shake.snapshot().phase === 'idle' && hangRenderer?.ready
          && nearTopHang(released.top, released.height, topLine())) {
          persistItem(POS_KEY, JSON.stringify({ right: vpW() - released.right, bottom: vpH() - released.bottom }));
          lastBottomDrop.reason = 'top-hang'; pinHang(); hangRenderer.enter(); return;
        }
        const edge = snapEdge();
        // A triggered gesture must not move the pet to an edge on release.
        if (edge && !hangRenderer?.active && shake.snapshot().phase === 'idle') {
          lastBottomDrop.reason = 'side-cling'; enterMini(edge, false); return;
        }
        persistItem(POS_KEY, JSON.stringify({
          right: parseInt(root.style.right || '20', 10),
          bottom: parseInt(root.style.bottom || '20', 10),
        }));
        if (character === 'rootbeast' && line !== undefined && bottomRenderer?.ready
          && !dnd && !mini && !miniTransitioning && shake.snapshot().phase === 'idle'
          && !hangRenderer?.active && !getMusicPlayerState().playing && !musicRenderer?.active) {
          if (bottomRenderer.enter(line)) { lastBottomDrop.reason = 'entered'; return; }
        }
        lastBottomDrop.reason = character !== 'rootbeast' ? 'other-character' : line === undefined ? 'contact-or-side-crop'
          : !bottomRenderer?.ready ? 'rig-not-ready' : dnd ? 'resting' : mini || miniTransitioning ? 'side-transition'
          : shake.snapshot().phase !== 'idle' ? 'dizzy' : hangRenderer?.active ? 'top-hang'
          : getMusicPlayerState().playing || musicRenderer?.active ? 'music-priority' : 'renderer-rejected';
      }
      if (!dnd && !mini && !miniTransitioning) { setState('idle', true); resetIdle(); }
    };
    const onShakeCancel = (event?: Event) => {
      hangPlay?.stop('hard');
      const wasHunting = hunt?.visible;
      hunt?.stop('hard');
      // Opening DevTools can blur the page and cancel this pose. Preserve one
      // plain-data snapshot first so inspecting it does not destroy the evidence.
      if (event?.type === 'blur' && bottomRenderer?.visible) lastBottomPresentation = inspectBottom();
      if (event?.type === 'blur') lastBottomCancel = 'blur';
      const wasHanging = hangRenderer?.visible;
      const wasPeeking = bottomRenderer?.visible;
      dismissBottom();
      hangRenderer?.interrupt(); shake.cancel();
      if ((wasHanging || wasPeeking || wasHunting) && !disposed && !leaving) setState(dnd ? 'sleeping' : 'idle', true);
      if (dragging) { moved = false; onUp(); }
    };
    const onPointerCancel = () => { lastBottomCancel = 'pointercancel'; onShakeCancel(); onUp(); if (natural?.active) suppressClick = true; };
    const onLostCapture = () => { if (dragging) { lastBottomCancel = 'lostpointercapture'; onShakeCancel(); onUp(); if (natural?.active) suppressClick = true; } };
    const onShakeVisibility = () => {
      if (document.hidden) { clearTimeout(routineTimer); natural?.pause(); lastBottomCancel = 'visibilitychange'; suspendMusic(); onShakeCancel(); }
      else { natural?.resume(); checkRoutine(); musicRenderer?.sync(); }
    };

    const requestState = (s: string) => {
      if (!leaving && deferHunt(() => requestState(s))) return;
      if (leaving || interactionOwnsArt()) return;
      const scene = getDeskPetScene(s);
      if (!scene) { drive(s); return; }
      if (!visibleIds.includes(scene.character)) return;
      // A gallery selection wakes the selected character and leaves edge-cling
      // so the entire scene is visible.
      searchNavigationRef.current(false);
      if (mini) {
        const pr = preMiniRight, pb = preMiniBottom;
        liftFromMini();
        const r = root.getBoundingClientRect();
        const c = clampAnchor(pr, pb, r.width, r.height, VC[character][0], VC[character][1], character === 'rootbeast');
        root.style.right = c.right + 'px'; root.style.bottom = c.bottom + 'px';
        persistItem(POS_KEY, JSON.stringify(c));
      }
      if (character !== scene.character) {
        const r = root.getBoundingClientRect();
        recenterRef.current = { x: r.left + r.width * VC[character][0], y: r.top + r.height * VC[character][1] };
        pendingPlaytimeRef.current = s;
        persistItem(CHAR_KEY, scene.character);
        setCharacter(scene.character);
        return;
      }
      dnd = false;
      setResting(false);
      clearTimeout(idleTimer);
      setState(s, true);
      if (!randomMode) resetIdle();
    };
    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const s = typeof detail === 'string' ? detail : detail?.state;
      if (typeof s === 'string') requestState(s);
    };

    // Hover the clinging pet (mouse only) → nudge it on-screen + peek pose.
    const onEnter = (e: PointerEvent) => {
      if (leaving) return;
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouseOverPet = true;
      if (mini && !dnd && !miniTransitioning) { peekIn(); setState('mini-peek', true); }
    };
    const onLeave = (e: PointerEvent) => {
      if (leaving) return;
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouseOverPet = false;
      if (mini && !dnd && !miniTransitioning && !dragging) { peekOut(); setState('mini-idle', true); }
    };

    const onHuntLeave = (event: PointerEvent) => { if (event.relatedTarget === null) { hunt?.leave(); hangPlay?.leave(); } };
    const onPageBusy = () => { hangPlay?.busy(); hunt?.busy(); if (hunt?.active && !dragging) hunt.stop('soft'); };
    document.addEventListener('pointerout', onHuntLeave, { passive: true });
    document.addEventListener('pointerdown', onPageBusy, { passive: true });
    document.addEventListener('keydown', onPageBusy, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('clawd:state', onExternal as EventListener);
    hit.addEventListener('click', onClick);
    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onDragMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onPointerCancel);
    hit.addEventListener('lostpointercapture', onLostCapture);
    window.addEventListener('blur', onShakeCancel);
    document.addEventListener('visibilitychange', onShakeVisibility);
    hit.addEventListener('pointerenter', onEnter);
    hit.addEventListener('pointerleave', onLeave);

    let exitDone: (() => void) | undefined;
    const cancelLeaving = () => {
      cancelSequence?.();
      cancelSequence = undefined;
      exitDone = undefined;
      leaving = false;
      root.classList.remove('leaving');
      clearMotion();
      if (!disposed) {
        setState(mini ? (dnd ? 'mini-sleep' : 'mini-idle') : (dnd ? 'sleeping' : 'idle'), true);
        if (!randomMode && !mini && !dnd) resetIdle();
        if (randomMode) scheduleRandom();
      }
    };
    const startExit = (done: () => void) => {
      natural?.stop();
      hangPlay?.stop('hard');
      hunt?.stop('hard');
      // A persistent hide can join a temporary exit without restarting it.
      exitDone = done;
      if (leaving) return cancelLeaving;
      if (reducedMotion()) { releasePointer(); exitDone = undefined; done(); return; }
      leaving = true;
      dismissBottom();
      suspendMusic();
      hangRenderer?.interrupt();
      shake.cancel();
      clearSleepTimers();
      releasePointer();
      dragging = false;
      miniTransitioning = false;
      root.classList.remove('dragging');
      root.classList.add('leaving');
      const rect = root.getBoundingClientRect();
      root.style.transition = '';
      root.style.right = vpW() - rect.right + 'px';
      root.style.bottom = vpH() - rect.bottom + 'px';
      clearTimeout(autoTimer); clearTimeout(idleTimer); clearTimeout(randomTimer);
      clearTimeout(miniTimer); clearTimeout(clickTimer); clearTimeout(longPressTimer);
      clearMotion();
      setSearchOpen(false);
      const sleep = exitStyleRef.current === 'sleep';
      const pose = sleep ? 'exit-sleep' : 'exit-hop';
      const clip = theme.motion?.[pose];
      const duration = clip?.durationMs ?? (sleep ? GENERIC_SLEEP_MS : GENERIC_HOP_MS);
      const dx = rect.left + rect.width / 2 < vpW() / 2 ? -rect.right - 20 : vpW() - rect.left + 20;
      let painted = false;
      cancelSequence = runDeskPetExit({
        play: ready => setState(pose, true, () => { painted = true; ready(); }),
        move: () => {
          if (!painted) ++frameSeq; // A stalled load must not replace the retained frame halfway through exit.
          if (!sleep) animate(exitHopKeyframes(dx, !clip), duration);
        },
        holdMs: duration,
        fade: () => animate(exitFadeKeyframes(), SLEEP_FADE_MS),
        fadeMs: sleep ? SLEEP_FADE_MS : 0,
        finish: () => { const complete = exitDone; exitDone = undefined; complete?.(); },
      });
      return cancelLeaving;
    };
    const unregisterExit = registerDeskPetExit(startExit);

    ctrlRef.current = {
      hide: () => { if (!leaving) startExit(() => { setSearchOpen(false); setHidden(true); }); },
      rest: enterRest,
      wake: exitRest,
      naturalSleep: mode => { const started = natural?.start(mode) ?? false; if (started) automaticNatural = false; return started; },
      cling: clingViaMenu,
      inMini: () => mini,
      reposition: () => keepInViewport(),
      resetPos: () => {
        if (leaving || dizzyOwnsArt() || hangRenderer?.active) return;
        if (deferHunt(() => ctrlRef.current?.resetPos())) return;
        dismissBottom();
        if (mini) liftFromMini(dnd ? 'sleeping' : 'idle');
        root.style.right = '';
        root.style.bottom = '';
        root.style.transition = '';
        keepInViewport();
        try { localStorage.removeItem(POS_KEY); localStorage.removeItem(MINI_KEY); } catch {}
        if (!dnd) resetIdle();
      },
    };

    (window as unknown as { clawdPet?: object }).clawdPet = {
      set: (s: string) => requestState(s),
      idle: () => drive('idle'),
      cling: () => clingViaMenu(),
      inspectBottom,
    };

    // Restore a saved cling (persists across reloads + character switches).
    let restoredMini = false;
    try {
      const m = JSON.parse(localStorage.getItem(MINI_KEY) || 'null');
      if (!routine?.pendingInitial && !grouped && m && (m.edge === 'left' || m.edge === 'right')) {
        mini = true; miniEdge = m.edge;
        preMiniRight = typeof m.preRight === 'number' ? m.preRight : 0;
        preMiniBottom = typeof m.preBottom === 'number' ? m.preBottom : 0;
        syncMiniRef();
        root.classList.add('mini-mode');
        root.classList.toggle('mini-left', miniEdge === 'left');
        root.style.right = miniRight(false) + 'px';
        restoredMini = true;
      }
    } catch {}

    const keepInViewport = () => {
      if (leaving) return;
      if (deferHunt(keepInViewport)) return;
      if (dragging && lastDragBox.width > 0 && lastDragBox.height > 0) {
        const r = root.getBoundingClientRect();
        const gx = (lastPointerX - lastDragBox.left) / lastDragBox.width;
        const gy = (lastPointerY - lastDragBox.top) / lastDragBox.height;
        const anchorHeight = bottomAnchorHeight(r);
        const c = clampAnchor(vpW() - lastPointerX - r.width * (1 - gx),
          anchorHeight - lastPointerY - r.height * (1 - gy), r.width, r.height, ...VC[character], character === 'rootbeast');
        if (character === 'rootbeast' && !mayUseMiniProgramBridge()) {
          c.bottom = Math.max(c.bottom, anchorHeight - dragBottomEdge() - r.height * (1 - VC[character][1] + PEEK));
        }
        root.style.right = c.right + 'px'; root.style.bottom = c.bottom + 'px';
        rebaseDrag(); return;
      }
      if (hangRenderer?.hanging) { pinHang(); return; }
      if (bottomRenderer?.peeking && !dragging) {
        const line = peekLineNow();
        if (line !== undefined) bottomRenderer.updateLine(line);
        else { dismissBottom(); setState('idle', true); }
        return;
      }
      const r = root.getBoundingClientRect();
      const anchor = readDeskPetAnchor(root, vpW(), vpH());
      let bottom = anchor.bottom;
      const box = window.innerWidth <= 768 ? document.querySelector<HTMLElement>('.deskpet-search-box') : null;
      if (box?.parentElement) {
        // The search animates from the pet. Reserve its final layout position,
        // not the transient transformed bounds sampled during that animation.
        const main = box.parentElement.getBoundingClientRect();
        const paddingBottom = parseFloat(getComputedStyle(box.parentElement).paddingBottom) || 0;
        const inputLeft = main.left + (main.width - box.offsetWidth) / 2;
        const input = { left: inputLeft, right: inputLeft + box.offsetWidth,
          top: main.bottom - paddingBottom - box.offsetHeight };
        const admin = root.querySelector('.admin-tools-surface')?.getBoundingClientRect();
        const controlBottom = Math.max(r.bottom, admin?.bottom ?? r.bottom);
        if (Math.max(r.right, admin?.right ?? r.right) > input.left
          && Math.min(r.left, admin?.left ?? r.left) < input.right && controlBottom > input.top - 12) {
          bottom += Math.min(controlBottom - input.top + 12, Math.max(0, r.top - 12));
        }
      }
      const c = clampAnchor(anchor.right, bottom, r.width, r.height, ...VC[character], character === 'rootbeast');
      const rightStyle = (mini ? miniRight(false) : c.right) + 'px';
      const bottomStyle = c.bottom + 'px';
      if (root.style.right !== rightStyle) root.style.right = rightStyle;
      if (root.style.bottom !== bottomStyle) root.style.bottom = bottomStyle;
      rebaseDrag();
    };
    keepInViewport();
    window.addEventListener('resize', keepInViewport);
    document.addEventListener('fullscreenchange', keepInViewport);
    window.visualViewport?.addEventListener('resize', keepInViewport);
    window.visualViewport?.addEventListener('scroll', keepInViewport);

    // force: on character switch state is already 'idle', must repaint
    setState(restoredMini ? (dnd ? 'mini-sleep' : 'mini-idle') : (dnd ? 'sleeping' : 'idle'), true);
    if (reshowRef.current && !routine?.pendingInitial && !reducedMotion()) {
      reshowRef.current = false;
      const clip = theme.motion?.[restoredMini ? 'mini-enter' : 'enter'];
      const duration = clip?.durationMs ?? GENERIC_ENTER_MS;
      let begun = false;
      let painted = false;
      const begin = () => {
        if (begun || disposed || leaving) return;
        begun = true;
        if (!painted) ++frameSeq;
        clearTimeout(autoTimer);
        animate(enterKeyframes(!!clip), duration);
        autoTimer = setTimeout(() => { clearMotion(); setState(restoredMini ? (dnd ? 'mini-sleep' : 'mini-idle') : (dnd ? 'sleeping' : 'idle'), true); }, duration);
      };
      autoTimer = setTimeout(begin, 600);
      setState(restoredMini ? 'mini-enter' : 'enter', true, () => { painted = true; begin(); });
    }
    reshowRef.current = false;
    if (randomMode) { if (state === 'idle') playRandom(); scheduleRandom(); }
    else if (!mini) resetIdle();
    if (pendingPlaytimeRef.current) {
      const pending = pendingPlaytimeRef.current;
      pendingPlaytimeRef.current = null;
      requestState(pending);
    }
    musicReadyToShow = true;
    musicRenderer?.sync();

    let routineTimer: ReturnType<typeof setTimeout> | undefined;
    const bootDeadline = performance.now() + 10000;
    function checkRoutine() {
      clearTimeout(routineTimer); routineTimer = undefined;
      if (disposed || document.hidden || !routine) return;
      const now = new Date();
      const idle = state === 'idle' && !leaving && !dragging && !dnd && !asleep && !mini && !miniTransitioning
        && !randomMode && !searchOpenRef.current && !physicalInteractionOwnsArt() && !hunt?.active
        && !natural?.visible && !musicRenderer?.active && !musicRenderer?.visible && !getMusicPlayerState().playing
        && !mayUseMiniProgramBridge();
      // User actions and missing resources may cancel the initial mask; they
      // never cause a delayed forced sleep after the user has taken control.
      if (routine.pendingInitial && (!idle || (!natural?.ready && performance.now() >= bootDeadline))) {
        routine.cancelInitial(); setRoutineBootReady(true);
      }
      const action = routine.decide(now, natural?.active ? natural.mode : 'off', automaticNatural, idle);
      if (action === 'wake') natural?.wake();
      else if (action && natural?.ready && natural.start(action)) {
        automaticNatural = true; routine.started(now);
      }
      const wait = routine.pendingInitial ? 500 : Math.max(1, 60000 - now.getSeconds() * 1000 - now.getMilliseconds());
      routineTimer = setTimeout(checkRoutine, wait);
    }
    checkRoutine();
    window.addEventListener('focus', checkRoutine);

    return () => {
      disposed = true;
      clearTimeout(routineTimer); window.removeEventListener('focus', checkRoutine);
      natural?.dispose();
      hangPlay?.dispose();
      hunt?.dispose(); huntControlRef.current = null;
      shake.dispose();
      dizzyRenderer?.dispose();
      hangRenderer?.dispose();
      musicRenderer?.dispose();
      bottomRenderer?.dispose();
      delete root.dataset.shakePhase;
      clearSleepTimers();
      releasePointer();
      if (prewarmIdle !== undefined && typeof cancelIdleCallback === 'function') cancelIdleCallback(prewarmIdle);
      clearTimeout(prewarmTimer);
      cancelSequence?.();
      unregisterExit();
      clearMotion();
      root.classList.remove('leaving', 'mini-turn', 'mini-mode', 'mini-left');
      rootIdle?.removeEventListener('load', loadRootIdle);
      idlePlayback?.dispose();
      if (rootIdle) { rootIdle.style.visibility = 'hidden'; idlePlayback?.sync(); }
      rootPupils = [];
      ++frameSeq;
      activeFrameUrl = undefined;
      releaseMotionUrls();
      clearTimeout(autoTimer);
      clearTimeout(idleTimer);
      clearTimeout(clickTimer);
      clearTimeout(touchActionsTimer);
      clearTimeout(longPressTimer);
      clearTimeout(miniTimer);
      clearTimeout(randomTimer);
      window.removeEventListener('resize', keepInViewport);
      document.removeEventListener('fullscreenchange', keepInViewport);
      window.visualViewport?.removeEventListener('resize', keepInViewport);
      window.visualViewport?.removeEventListener('scroll', keepInViewport);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onHuntLeave);
      document.removeEventListener('pointerdown', onPageBusy);
      document.removeEventListener('keydown', onPageBusy);
      window.removeEventListener('clawd:state', onExternal as EventListener);
      hit.removeEventListener('click', onClick);
      hit.removeEventListener('pointerdown', onDown);
      hit.removeEventListener('pointermove', onDragMove);
      hit.removeEventListener('pointerup', onUp);
      hit.removeEventListener('pointercancel', onPointerCancel);
      hit.removeEventListener('lostpointercapture', onLostCapture);
      window.removeEventListener('blur', onShakeCancel);
      document.removeEventListener('visibilitychange', onShakeVisibility);
      hit.removeEventListener('pointerenter', onEnter);
      hit.removeEventListener('pointerleave', onLeave);
      ctrlRef.current = null;
      delete (window as unknown as { clawdPet?: object }).clawdPet;
    };
  }, [mounted, hidden, character, randomMode, user, petAvailable, visibleKey, compact]);

  if (douyin || !mounted) return null;

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

  const selectSize = (next: Size) => {
    if (next === size) return;
    if (huntControlRef.current?.defer(() => selectSize(next))) return;
    captureCenter();
    setSize(next);
    persistItem(SIZE_KEY, next);
  };

  const selectChar = (value: string) => {
    if (value === 'none') {
      setCompact(true);
      persistItem(COMPACT_KEY, 'true');
      return;
    }
    const next = THEME_IDS.find(id => id === value && visibleIds.includes(id));
    if (!next || (!compact && next === character)) return;
    huntControlRef.current?.hard();
    if (!compact) captureCenter(); // preserve the old pet's visual center
    setCompact(false);
    persistItem(COMPACT_KEY, 'false');
    setCharacter(next);
    persistItem(CHAR_KEY, next);
  };

  const toggleRandom = () => {
    setRandomMode(m => {
      const next = !m;
      persistItem('clawd-deskpet-mode', next ? 'random' : 'default');
      return next;
    });
  };

  const curLang: 'zh' | 'en' = zh ? 'zh' : 'en';
  // SSR and the first hydration render return null above. Read local time only
  // once the client is mounted, and conceal every initial pose until asleep is drawn.
  const maskInitialNight = character === 'rootbeast' && !routineBootReady
    && (routineSessionRef.current?.pendingInitial
      || (!routineSessionRef.current?.initialized && deskPetLocalPeriod(new Date()).instant));


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
      {compact && !hidden && !searchOpen && <CompactPet key={`compact:${owner}`} lang={curLang}
        onCompose={draft => {
          const id = crypto.randomUUID();
          assistantConversations.create(owner, id);
          if (draft) assistantConversations.patch(owner, id, { draft });
          setSearchOpen(true);
        }} />}
      <div style={hidden || compact || !petAvailable || searchOpen ? { display: 'none' } : maskInitialNight ? { visibility: 'hidden' } : undefined} className={`clawd-deskpet${touchActionsVisible ? ' touch-actions' : ''}`} data-size={size} data-char={character} data-original={ORIGINAL_CHARACTERS.some(pet => pet.id === character)} data-pixel={THEMES[character].pixel} ref={rootRef}>
        <style>{CSS}</style>
        <AdminTools centerX={VC[character][0]} />
        <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="-15 -25 45 45" aria-hidden>
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
        {character === 'rootbeast' && !randomMode && (
          <object ref={rootIdleRef} data={`${ROOTBEAST_BASE}${ROOTBEAST_FILES.idle}?v=${ROOTBEAST_VERSION}`} type="image/svg+xml" aria-hidden tabIndex={-1} style={{ visibility: 'hidden', imageRendering: 'auto', colorScheme: 'normal' }} />
        )}
        {character === 'rootbeast' && (
          <object ref={rootDizzyRef} data={ROOTBEAST_DIZZY.loop.src} type="image/svg+xml" aria-hidden tabIndex={-1}
            style={{ visibility: 'hidden', imageRendering: 'auto', colorScheme: 'normal' }} />
        )}
        {character === 'rootbeast' && (
          <object ref={rootHangRef} data={ROOTBEAST_HANG.rig.src} type="image/svg+xml" aria-hidden tabIndex={-1}
            style={{ visibility: 'hidden', imageRendering: 'auto', colorScheme: 'normal' }} />
        )}
        {character === 'rootbeast' && (
          <object ref={rootMusicRef} data={ROOTBEAST_MUSIC.rig.src} type="image/svg+xml" aria-hidden tabIndex={-1}
            style={{ visibility: 'hidden', imageRendering: 'auto', colorScheme: 'normal' }} />
        )}
        {character === 'rootbeast' && (
          <object ref={rootBottomPeekRef} data={ROOTBEAST_BOTTOM_PEEK.src} type="image/svg+xml" aria-hidden tabIndex={-1}
            style={{ visibility: 'hidden', imageRendering: 'auto', colorScheme: 'normal' }} />
        )}
          {character === 'rootbeast' && (
            <object ref={rootHuntRef} data={ROOTBEAST_HUNT.src} type="image/svg+xml" aria-hidden tabIndex={-1}
              style={{ visibility: 'hidden', imageRendering: 'auto', colorScheme: 'normal' }} />
          )}
        {character === 'rootbeast' && (
          <object ref={rootSleepRef} data={ROOTBEAST_SLEEP.src} type="image/svg+xml" aria-hidden tabIndex={-1}
            style={{ visibility: 'hidden', imageRendering: 'auto', colorScheme: 'normal' }} />
        )}
        {fbUnread > 0 && (
          <span className="clawd-deskpet-badge" aria-hidden>{fbUnread > 9 ? '9+' : fbUnread}</span>
        )}
        {ntfUnread > 0 && (
          <AppLink
            href="/notifications"
            className="clawd-deskpet-badge clawd-deskpet-badge-ntf"
            title={t('新消息', 'New notifications')}
            aria-label={t('新消息', 'New notifications')}
            prefetch={false}
          >
            {ntfUnread > 9 ? '9+' : ntfUnread}
          </AppLink>
        )}
        {isAdmin && algUnread > 0 && (
          <button
            type="button"
            className="clawd-deskpet-badge clawd-deskpet-badge-admin"
            title={t('新公式投稿', 'New alg submissions')}
            aria-label={t('新公式投稿', 'New alg submissions')}
            onClick={() => setSubmPanelOpen(true)}
          >
            {algUnread > 9 ? '9+' : algUnread}
          </button>
        )}
        <ClearButton
          variant="standalone"
          className="clawd-deskpet-dismiss"
          ariaLabel={t('隐藏,刷新后恢复', 'Hide, restored on reload')}
          onClick={() => ctrlRef.current?.hide()}
        />
        <div
          className="clawd-deskpet-hit"
          ref={hitRef}
          aria-hidden
          title={t('点我搜索 / 拖动', 'click to search · drag')}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {(workspace.opened || searchOpen) && (
        <DeskPetSearch
          key={`chat:${owner}`}
          open={searchOpen}
          lang={curLang}
          origin={searchOriginRef.current}
          onClose={() => setSearchOpen(false)}
          onOpenPetHome={() => { setSearchOpen(false); setTouchActionsVisible(false); window.location.assign(`${curLang === 'zh' ? '/zh' : ''}/pets?pet=${character}`); }}
          character={compact ? 'none' : character}
          characters={petChoices}
          catalogAdmin={isAdmin}
          catalogDisabled={!catalog || catalogSaving}
          catalogError={catalogError}
          onUpdateCatalog={updateCatalog}
          size={size}
          resting={resting}
          onSelectChar={selectChar}
          onSelectSize={selectSize}
          onToggleRest={() => { if (resting) ctrlRef.current?.wake(); else ctrlRef.current?.rest(); }}
          onNaturalSleep={character === 'rootbeast' ? mode => { ctrlRef.current?.naturalSleep(mode); } : undefined}
          randomMode={randomMode}
          onToggleRandom={toggleRandom}
          exitStyle={exitStyle}
          onSelectExitStyle={value => {
            const next = parseExitStyle(value);
            exitStyleRef.current = next;
            setExitStyle(next);
            persistItem(DESKPET_EXIT_KEY, next);
          }}
        />
      )}



      {metronomeOpen && (
        <FloatingMetronome
          lang={curLang}
          onClose={() => setMetronomeOpen(false)}
        />
      )}

      {submPanelOpen && (
        <AdminSubmissionsPanel lang={curLang} onClose={() => setSubmPanelOpen(false)} />
      )}
    </>
  );
}
