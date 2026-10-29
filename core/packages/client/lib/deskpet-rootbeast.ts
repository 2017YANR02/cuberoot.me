import manifest from '../public/deskpet/rootbeast/manifest.json';
import motionManifest from '../public/deskpet/rootbeast-motion/manifest.json';

// One generated manifest supplies the theme, gallery, and story durations.
export const ROOTBEAST_BASE = '/deskpet/rootbeast/';
export const ROOTBEAST_VERSION = '15';
export const ROOTBEAST_SCENES = manifest.map(scene => ({
  ...scene,
  character: 'rootbeast' as const,
  state: `rootbeast:${scene.id}`,
  src: `${ROOTBEAST_BASE}${scene.file}?v=${ROOTBEAST_VERSION}`,
  durationMs: scene.duration * 1000,
}));

// Shared release selection for gallery previews and future WeChat exports.
export const ROOTBEAST_COLLECTIONS = [
  {
    id: 'daily', zh: '第一期 日常回应', en: 'Vol. 1 Everyday Reactions',
    sceneIds: [
      'hello', 'annoyed', 'thinking', 'typing', 'headphones', 'boss', 'happy', 'error',
      'notification', 'reading', 'yawning', 'dozing', 'sleeping', 'waking', 'box', 'soda',
      'catch-star', 'umbrella', 'popcorn', 'sneak', 'dance', 'moon-hug', 'carrying', 'sweeping',
    ],
  },
  {
    id: 'adventures', zh: '第二期 魔方奇遇', en: 'Vol. 2 Cube Adventures',
    sceneIds: [
      'double-jump', 'drag', 'building', 'juggling', 'debugger', 'wizard', 'deep-thought', 'bubble',
      'inspection', 'cubing', 'timer', 'personal-best', 'pop', 'teaching', 'bubblegum', 'fishing',
      'skateboard', 'paper-plane', 'puddle', 'balloon', 'butterfly', 'paper-boat', 'portal', 'cube-pop',
    ],
  },
  { id: 'candidates', zh: '候选', en: 'Candidates', sceneIds: ['idle', 'walk', 'stretch'] },
];

export function getRootBeastScene(state: unknown) {
  return typeof state === 'string' ? ROOTBEAST_SCENES.find(scene => scene.state === state) : undefined;
}

const file = (id: string) => {
  const scene = getRootBeastScene(`rootbeast:${id}`);
  if (!scene) throw new Error(`Unknown Root Beast animation: ${id}`);
  return scene.file;
};

export const ROOTBEAST_FILES: Record<string, string> = {
  idle: file('idle'), thinking: file('thinking'), working: file('typing'),
  building: file('building'), groove: file('headphones'), juggling: file('juggling'),
  sweeping: file('sweeping'), carrying: file('carrying'), cubing: file('cubing'),
  debugger: file('debugger'), wizard: file('wizard'), ultrathink: file('deep-thought'),
  boss: file('boss'), error: file('error'), happy: file('happy'),
  notification: file('notification'), reading: file('reading'), bubble: file('bubble'),
  yawning: file('yawning'), dozing: file('dozing'), sleeping: file('sleeping'),
  waking: file('waking'), reactDouble: file('double-jump'), reactAnnoyed: file('annoyed'),
  reactDrag: file('drag'),
};

export const ROOTBEAST_MINI_FILES = {
  idle: file('idle'), peek: file('hello'), enter: file('walk'), crabwalk: file('walk'),
  alert: file('notification'), happy: file('happy'), sleep: file('sleeping'),
  working: file('typing'), enterSleep: file('dozing'),
};

export const ROOTBEAST_AUTO = Object.fromEntries(
  ['happy', 'notification', 'error', 'sweeping', 'carrying', 'waking', 'reactDouble', 'reactAnnoyed', 'reading', 'bubble']
    .map(state => [state, ROOTBEAST_SCENES.find(scene => scene.file === ROOTBEAST_FILES[state])!.durationMs]),
);

const interactionOnly = new Set(['idle', 'drag', 'annoyed', 'sleeping', 'dozing', 'waking']);
export const ROOTBEAST_RANDOM_SCENES = ROOTBEAST_SCENES.filter(scene => !interactionOnly.has(scene.id));

// One-shot transitions (edge cling, exits, entrance). They are not gallery
// scenes; each plays once and holds its last frame until the pet moves on.
export const ROOTBEAST_MOTION_BASE = '/deskpet/rootbeast-motion/';
export const ROOTBEAST_MOTION_VERSION = '9';
export const ROOTBEAST_MOTION = motionManifest.map(clip => ({
  ...clip,
  src: `${ROOTBEAST_MOTION_BASE}${clip.file}?v=${ROOTBEAST_MOTION_VERSION}`,
  durationMs: Math.round(clip.duration * 1000),
}));
const motion = (id: string) => {
  const clip = ROOTBEAST_MOTION.find(item => item.id === id);
  if (!clip) throw new Error(`Unknown Root Beast transition: ${id}`);
  return { src: clip.src, durationMs: clip.durationMs };
};

// Pet state → transition clip.
export const ROOTBEAST_MOTION_STATES = {
  enter: motion('enter'), 'exit-hop': motion('exit-hop'), 'exit-sleep': motion('exit-sleep'),
  'mini-enter': motion('edge-enter'), 'mini-leave': motion('edge-leave'),
};

// Keep one loop document alive for both shaking and controller-driven recovery.
// The standalone recovery file is delivered for preview; do not swap to it mid-loop.
export const ROOTBEAST_DIZZY = {
  loop: motion('dizzy-loop'), recover: motion('dizzy-recover'),
};

export const ROOTBEAST_HANG = {
  rig: motion('hang-rig'), enter: motion('hang-enter'), loop: motion('hang-loop'), release: motion('hang-release'),
};

export const ROOTBEAST_MUSIC = {
  rig: motion('music-rig-v3'), on: motion('music-on-v3'), loop: motion('music-loop-v3'), off: motion('music-off-v3'),
};

export const ROOTBEAST_BOTTOM_PEEK = motion('bottom-peek');
export const ROOTBEAST_HUNT = motion('mouse-hunt');

export const ROOTBEAST_SLEEP = motion('sleep-in-place');
