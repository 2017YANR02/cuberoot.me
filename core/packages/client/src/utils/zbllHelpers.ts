/**
 * ZBLL Trainer 工具函数
 * 移植自上游 zbll_trainer/src/helpers/
 */
import zbllMap from '@cuberoot/shared/data/zbll.json';

// --- 通用工具 ---

/** 随机选取数组中一个元素 */
export const randomElement = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

/** Fisher-Yates 原地洗牌 */
export const shuffle = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * 格式化 ZBLL key 为人类可读形式
 * "H RLFF OsA" → "H-RLFF O/A"
 */
export const formatZbllKey = (key: string): string => {
  if (!key) return '';
  const parts = key.split(' ');
  if (parts.length < 3) return key;
  return `${parts[0]}-${parts[1]} ${parts[2].replace('s', '/')}`;
};

/** 比较两个 Set 是否内容相同 */
export const areSetsEqual = (a: Set<string>, b: Set<string>): boolean => {
  return a.size === b.size && [...a].every((item) => b.has(item));
};

// --- 打乱工具 ---

// NOTE: y 旋转后的面映射表，用于将打乱序列旋转到 B 面步骤最少的朝向
const ROTATION_MAP: Record<string, Record<string, string>> = {
  y: { R: 'F', F: 'L', L: 'B', B: 'R' },
  "y'": { R: 'B', B: 'L', L: 'F', F: 'R' },
  y2: { R: 'L', L: 'R', B: 'F', F: 'B' },
};

/** 对打乱序列应用 y 旋转，返回等效的无旋转打乱 */
const applyRotation = (alg: string, yRotation: string): string => {
  const mapObj = ROTATION_MAP[yRotation];
  if (!mapObj) return alg;
  const re = new RegExp(Object.keys(mapObj).join('|'), 'gi');
  return alg.replace(re, (matched) => mapObj[matched]);
};

/** 随机选 2 个 y 旋转，返回 B 面步骤更少的那个 */
const applyRotationButLessB = (alg: string): string => {
  const yArr = shuffle(['', 'y', 'y2', "y'"]);
  const a1 = applyRotation(alg, yArr[0]);
  const a2 = applyRotation(alg, yArr[2]);
  const numB1 = (a1.match(/B/g) || []).length;
  const numB2 = (a2.match(/B/g) || []).length;
  return numB1 < numB2 ? a1 : a2;
};

/** 反转打乱序列（用于显示 setup moves） */
export const inverseScramble = (s: string): string => {
  return s
    .split(' ')
    .map((it) => {
      if (it.length === 0) return '';
      if (it[it.length - 1] === '2') return it;
      if (it[it.length - 1] === "'") return it.slice(0, -1);
      return `${it}'`;
    })
    .reverse()
    .join(' ');
};

/**
 * 为指定 ZBLL case 生成打乱序列
 * 从预生成的打乱池中随机选取，并应用 y 旋转以减少 B 面步骤
 */
export const makeScramble = (zbllKey: string, preferredLength: number): string => {
  if (!zbllKey) return '';
  const entry = (zbllMap as Record<string, ZbllEntry>)[zbllKey];
  if (!entry) return '';
  const scramblesMap = entry.scrambles;
  const lengthVariations = Object.keys(scramblesMap);
  const prefStr = `${preferredLength}`;
  const chosenLength = lengthVariations.includes(prefStr)
    ? prefStr
    : lengthVariations[0];
  return applyRotationButLessB(randomElement(scramblesMap[chosenLength]));
};

// --- 时间格式化 ---

/**
 * 将毫秒转为人类可读时间字符串
 * @param ms 毫秒数
 * @param numDigitsMs 小数位数（1=十分之一秒, 2=百分之一秒, 3=千分之一秒）
 * @param displayMs 是否显示毫秒部分
 */
export const msToHumanReadable = (
  ms: number,
  numDigitsMs = 2,
  displayMs = true
): string => {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const msDivider = Math.pow(10, 3 - numDigitsMs);
  const milliseconds = Math.floor((ms % 1000) / msDivider);
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;

  const pad = (num: number) => (num < 10 ? '0' : '') + num;
  const padMs = (num: number) => `${num}`.padStart(numDigitsMs, '0');

  const hoursString = hours === 0 ? '' : hours + ':';
  const minutesString =
    minutes === 0 ? '' : (hours === 0 ? minutes : pad(minutes)) + ':';
  const secondsString = ms >= 1000 * 60 ? pad(seconds) : seconds;
  const millisecondsString = displayMs ? `.${padMs(milliseconds)}` : '';

  return `${hoursString}${minutesString}${secondsString}${millisecondsString}`;
};

// --- SVG 图片路径 ---

const BASE = import.meta.env.BASE_URL; // Vite base: /

/** OLL 组缩略图路径（如 H.svg） */
export const getOllImg = (oll: string): string => {
  return `${BASE}zbll_svg/${oll}.svg`;
};

/** COLL 缩略图路径（如 top/H-RLFF.svg） */
export const getCollImg = (oll: string, coll: string, view: string): string => {
  return `${BASE}zbll_svg/${view}/${oll}-${coll}.svg`;
};

/** 单个 ZBLL case 缩略图路径（如 top/H-RLFF-OsA.svg） */
export const getZbllImg = (key: string, view: string): string => {
  const keyWithDashes = key.replaceAll(' ', '-');
  return `${BASE}zbll_svg/${view}/${keyWithDashes}.svg`;
};

// --- 类型定义 ---

export interface ZbllEntry {
  key: string;
  algs: string[];
  scrambles: Record<string, string[]>;
}

/** ZBLL 数据 map 的所有 key */
export const allZbllKeys: string[] = Object.keys(zbllMap);

/** 从 allZbllKeys 提取去重的 OLL 组名 */
export const zbllOllGroups: string[] = allZbllKeys
  .map((key) => key.split(' ')[0])
  .filter((oll, i, arr) => arr.indexOf(oll) === i);
