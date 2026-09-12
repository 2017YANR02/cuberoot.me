import { DEFAULT_OPEN_PETS } from '@cuberoot/shared/deskpet';
import { ORIGINAL_THEMES, type OriginalCharacterId, getOriginalScene, ORIGINAL_SCENES } from './deskpet-originals';
import { ROOTBEAST_BASE, ROOTBEAST_VERSION, ROOTBEAST_FILES, ROOTBEAST_AUTO, ROOTBEAST_MINI_FILES, getRootBeastScene, ROOTBEAST_SCENES } from './deskpet-rootbeast';
import type { CareAction } from './deskpet-care';

export type ThemeId = 'clawd' | 'calico' | 'cloudling' | 'rootbeast' | OriginalCharacterId;

export interface MiniTheme {
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
  pixel?: boolean;
  base: string;
  version?: string;
  auto?: Record<string, number>;
  inlineIdle: boolean; // clawd uses the inline eye-tracking SVG for idle
  thumb: string;
  thumbScale?: number; // zoom the toolbar thumb to crop dead viewBox margin
  label: { zh: string; en: string
 };
  files: Record<string, string>;
  mini: MiniTheme;
}

// State→asset maps mirror each clawd-on-desk theme.json `states`/`reactions`.
export const THEMES: Record<ThemeId, PetTheme> = {
  ...ORIGINAL_THEMES,
  rootbeast: {
    base: ROOTBEAST_BASE, version: ROOTBEAST_VERSION, inlineIdle: false,
    thumb: `${ROOTBEAST_BASE}${ROOTBEAST_FILES.idle}?v=${ROOTBEAST_VERSION}`, thumbScale: 1.5,
    label: { zh: '根号兽', en: 'Root Beast' }, files: ROOTBEAST_FILES, auto: ROOTBEAST_AUTO,
    mini: { offsetRatio: .14, files: ROOTBEAST_MINI_FILES },
  },
  clawd: {
    base: '/deskpet/', inlineIdle: true,
    thumb: '/deskpet/clawd-happy.svg', thumbScale: 1.6, label: { zh: '螃蟹', en: 'Clawd' },
    files: {
      idle: 'clawd-idle-reading.svg',
      thinking: 'clawd-working-thinking.svg', working: 'clawd-working-typing.svg',
      building: 'clawd-working-building.svg', groove: 'clawd-headphones-groove.svg',
      juggling: 'clawd-working-juggling.svg', sweeping: 'clawd-working-sweeping.svg',
      carrying: 'clawd-working-carrying.svg', cubing: 'clawd-cubing.svg',
      debugger: 'clawd-working-debugger.svg', wizard: 'clawd-working-wizard.svg',
      ultrathink: 'clawd-working-ultrathink.svg', boss: 'clawd-working-typing-boss.svg',
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
    thumb: '/deskpet/calico/calico-idle.png', label: { zh: '三花猫', en: 'Calico'
    },
    files: {
      idle: 'calico-idle.png',
      thinking: 'calico-thinking.png', working: 'calico-working-typing.png',
      building: 'calico-working-building.png', groove: 'calico-working-conducting.png',
      juggling: 'calico-working-juggling.png', sweeping: 'calico-working-sweeping.png',
      carrying: 'calico-working-carrying.png', cubing: 'calico-working-juggling.png',
      error: 'calico-error.png',
      happy: 'calico-happy.png', notification: 'calico-notification.png',
      reading: 'calico-idle.png', bubble: 'calico-idle.png',
      yawning: 'calico-yawning.png', dozing: 'calico-dozing.png',
      sleeping: 'calico-sleeping.png', waking: 'calico-waking.png',
      reactDouble: 'calico-react-poke.png', reactAnnoyed: 'calico-react-left.png',
      reactDrag: 'calico-react-drag.png',
    },
    mini: {
      offsetRatio: 0.4,
      files: {
        idle: 'calico-mini-idle.png', peek: 'calico-mini-peek.png',
        enter: 'calico-mini-enter.png', crabwalk: 'calico-mini-crabwalk.png',
        alert: 'calico-mini-alert.png', happy: 'calico-mini-happy.png',
        sleep: 'calico-mini-sleep.png',
      },
    },
  },
  cloudling: {
    base: '/deskpet/cloudling/', inlineIdle: false,
    thumb: '/deskpet/cloudling/cloudling-idle.svg', thumbScale: 3, label: { zh: '云宝', en: 'Cloud'
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

export const THEME_IDS = [...DEFAULT_OPEN_PETS.filter(id => id in THEMES), ...Object.keys(THEMES).filter(id => !DEFAULT_OPEN_PETS.includes(id))] as ThemeId[];

export function petCareArt(character: ThemeId, action: CareAction | 'idle') {
  if (character === 'rootbeast' && action === 'feed') return getRootBeastScene('rootbeast:popcorn')!.src;
  const scene = getOriginalScene(`original:${character}:${({idle:'idle',feed:'snack',pet:'happy',play:'ball',rest:'doze'})[action]}`);
  if (scene) return scene.src;
  const theme = THEMES[character];
  const state = ({idle:'idle',feed:'happy',pet:'happy',play:'cubing',rest:'dozing'})[action];
  return `${theme.base}${theme.files[state]}${theme.version ? `?v=${theme.version}` : ''}`;
}
export function petCareDuration(character: ThemeId, action: CareAction) {
  const src = petCareArt(character, action);
  return [...ROOTBEAST_SCENES,...ORIGINAL_SCENES].find(scene=>scene.src===src)?.durationMs ?? 4000;
}
