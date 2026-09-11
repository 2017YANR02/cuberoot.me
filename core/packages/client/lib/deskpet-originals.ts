import manifest from '../public/deskpet/originals/manifest.json';

export type OriginalCharacterId = 'hermit-crab' | 'fox' | 'postbird' | 'snail' | 'ray' | 'pangolin' | 'beetle' | 'owl' | 'chameleon' | 'squid' | 'lobster' | 'pixel-lobster';
export const ORIGINAL_BASE = '/deskpet/originals/';
export const ORIGINAL_VERSION = manifest.version;
export const ORIGINAL_CHARACTERS = manifest.characters.map(character => ({ ...character, id: character.id as OriginalCharacterId }));
export const ORIGINAL_SCENES = manifest.scenes.map(scene => ({
  ...scene,
  character: scene.character as OriginalCharacterId,
  state: `original:${scene.character}:${scene.id}`,
  src: `${ORIGINAL_BASE}${scene.file}?v=${ORIGINAL_VERSION}`,
  durationMs: scene.duration * 1000,
}));
export const ORIGINAL_COLLECTIONS = [
  { id: 'daily', zh: '第一期 日常', en: 'Vol. 1 Everyday' },
  { id: 'play', zh: '第二期 玩耍', en: 'Vol. 2 Playtime' },
];

export function getOriginalScene(state: unknown) {
  return typeof state === 'string' ? ORIGINAL_SCENES.find(scene => scene.state === state) : undefined;
}

// Adapt the existing pet state machine to each character's authored scenes.
// Names, files and durations continue to come from the generated manifest.
const stateScenes: Record<string, string> = {
  idle: 'idle', thinking: 'curious', working: 'draw', building: 'balance', groove: 'music',
  juggling: 'ball', sweeping: 'groom', carrying: 'gift', cubing: 'ball', debugger: 'butterfly',
  wizard: 'star', ultrathink: 'look-around', boss: 'letter', error: 'sad', happy: 'happy',
  notification: 'surprised', reading: 'read', bubble: 'bubbles', yawning: 'yawn', dozing: 'doze',
  sleeping: 'sleep', waking: 'wake', reactDouble: 'cheer', reactAnnoyed: 'angry', reactDrag: 'surprised',
};
const miniScenes = { idle: 'idle', peek: 'peek', enter: 'walk', crabwalk: 'walk', alert: 'surprised', happy: 'happy', sleep: 'sleep', working: 'draw', enterSleep: 'doze' };

export const ORIGINAL_THEMES = Object.fromEntries(ORIGINAL_CHARACTERS.map(character => {
  const scenes = ORIGINAL_SCENES.filter(scene => scene.character === character.id);
  const scene = (id: string) => {
    const found = scenes.find(item => item.id === id);
    if (!found) throw new Error(`Missing pet scene: ${character.id}/${id}`);
    return found;
  };
  return [character.id, {
    base: ORIGINAL_BASE, version: ORIGINAL_VERSION, inlineIdle: false, pixel: character.pixel,
    thumb: scene('idle').src, label: { zh: character.zh, en: character.en },
    files: Object.fromEntries(Object.entries(stateScenes).map(([state, id]) => [state, scene(id).file])),
    auto: Object.fromEntries(['happy', 'notification', 'error', 'sweeping', 'carrying', 'waking', 'reactDouble', 'reactAnnoyed', 'reading', 'bubble'].map(state => [state, scene(stateScenes[state]).durationMs])),
    mini: { offsetRatio: .16, files: Object.fromEntries(Object.entries(miniScenes).map(([state, id]) => [state, scene(id).file])) as Record<keyof typeof miniScenes, string> },
  }];
})) as Record<OriginalCharacterId, {
  base: string; version: string; inlineIdle: boolean; pixel: boolean; thumb: string;
  label: { zh: string; en: string }; files: Record<string, string>; auto: Record<string, number>;
  mini: { offsetRatio: number; files: Record<keyof typeof miniScenes, string> };
}>;
