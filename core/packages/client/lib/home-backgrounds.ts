/** Shared by the homepage picker and the appearance gallery. */
export const HOME_BACKGROUND_KEY = 'home-background.v1';
export const HOME_BACKGROUND_ASSETS = '/assets/home-backgrounds/v1';
export const HOME_BACKGROUNDS = [
  { id: '01', zh: '雪山初晴', en: 'Snowy Dawn', position: '50%', family: 'Alto’s Adventure', description: { zh: '冰蓝雪山，暖白天光，清爽宁静。', en: 'Ice-blue peaks and warm morning light, fresh and still.' } },
  { id: '02', zh: '暮色松岭', en: 'Sunset Pines', position: '50%', family: 'Alto’s Adventure', description: { zh: '杏粉暮空，紫色山岭，稀疏松林。', en: 'Apricot skies, purple ridges and scattered pines at dusk.' } },
  { id: '03', zh: '蓝夜远山', en: 'Moonlit Peaks', position: '50%', family: 'Alto’s Adventure', description: { zh: '靛蓝夜幕，月下雪岭，极简星空。', en: 'Indigo night, moonlit snow and a scattering of stars.' } },
  { id: '04', zh: '沙海日落', en: 'Desert Sunset', position: '50%', family: 'Alto’s Odyssey', description: { zh: '赭红沙丘，金色落日，柔和层叠。', en: 'Terracotta dunes unfold beneath a golden setting sun.' } },
  { id: '05', zh: '紫夜沙丘', en: 'Violet Dunes', position: '50%', family: 'Alto’s Odyssey', description: { zh: '紫罗兰夜色，月牙与悠远沙丘。', en: 'A crescent moon above distant dunes in violet night.' } },
  { id: '06', zh: '青绿峡谷', en: 'Jade Canyon', position: '65%', family: 'Alto’s Odyssey', description: { zh: '青碧峡谷，细瀑与隐约古迹。', en: 'Jade canyons, a slender waterfall and ruins in the mist.' } },
  { id: '07', zh: '粉彩阶庭', en: 'Pastel Courtyard', position: '75%', family: 'Monument Valley', description: { zh: '奶油白阶梯，珊瑚拱门，薄荷水面。', en: 'Ivory stairs and coral arches over still mint water.' } },
  { id: '08', zh: '月下迷宫', en: 'Moonlit Labyrinth', position: '30%', family: 'Monument Valley', description: { zh: '深蓝水庭，淡紫回廊，温暖门光。', en: 'Lavender arcades and a warm doorway over midnight water.' } },
  { id: '09', zh: '浮岛花园', en: 'Floating Gardens', position: '65%', family: 'Monument Valley', description: { zh: '杏色天空，悬浮花园，错视桥梁。', en: 'Floating gardens and impossible bridges in an apricot sky.' } },
  { id: '10', zh: '沙丘之门', en: 'Dune Gateway', position: '70%', family: 'Alto × Monument Valley', description: { zh: '柔和沙海与等距拱门，结合两种风格。', en: 'Soft dunes meet an isometric arch, bringing both styles together.' } },
] as const;

export type HomeBackgroundChoice = 'auto' | 'none' | typeof HOME_BACKGROUNDS[number]['id'];

export function isHomeBackgroundChoice(value: unknown): value is HomeBackgroundChoice {
  return value === 'auto' || value === 'none' || HOME_BACKGROUNDS.some(scene => scene.id === value);
}

export function resolveHomeBackground(choice: HomeBackgroundChoice, theme: 'light' | 'dark') {
  const id = choice === 'auto' ? (theme === 'dark' ? '03' : '01') : choice;
  return HOME_BACKGROUNDS.find(scene => scene.id === id);
}
