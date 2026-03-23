/**
 * ZBLS Trainer 工具函数
 * 数据操作、打乱生成、图片路径等
 */
import zblsMap from '@cuberoot/shared/data/zbls.json';

// --- 类型定义 ---

export interface ZblsEntry {
  f2lGroup: number;
  algs: string[];
  scrambles: string[];
}

// --- 常量 ---

const BASE = import.meta.env.BASE_URL; // Vite base: /app/

/** 所有 case key 列表（按 F2L 组和变体排序） */
export const allZblsKeys: string[] = Object.keys(zblsMap);

/** 数据 map 的类型断言 */
export const zblsData = zblsMap as Record<string, ZblsEntry>;

/** F2L 组号列表（1~41，从数据中动态提取并去重） */
export const F2L_GROUP_NUMS: number[] = [
  ...new Set(Object.values(zblsData).map((e) => e.f2lGroup)),
].sort((a, b) => a - b);

/** 按 F2L 组分组的 case key 映射 */
export const ZBLS_BY_GROUP: Record<number, string[]> = {};
for (const key of allZblsKeys) {
  const group = zblsData[key].f2lGroup;
  if (!ZBLS_BY_GROUP[group]) ZBLS_BY_GROUP[group] = [];
  ZBLS_BY_GROUP[group].push(key);
}

// --- 通用工具（复用自 zbllHelpers） ---

/** 随机选取数组中一个元素 */
export const randomElement = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

/** 比较两个 Set 是否内容相同 */
export const areSetsEqual = (a: Set<string>, b: Set<string>): boolean => {
  return a.size === b.size && [...a].every((item) => b.has(item));
};

// --- 打乱生成 ---

/** 随机 AUF 后缀（无/U/U'/U2） */
const AUF_OPTIONS = ['', ' U', " U'", ' U2'] as const;

/**
 * 从 scrambles 数组中随机选一个打乱 + 随机 AUF
 * 完整复刻上游 zblsCase.getSetup() 逻辑
 */
export const makeZblsScramble = (caseKey: string): string => {
  const entry = zblsData[caseKey];
  if (!entry || entry.scrambles.length === 0) return '';
  const baseScramble = randomElement(entry.scrambles);
  const auf = randomElement([...AUF_OPTIONS]);
  return baseScramble + auf;
};

// --- 图片路径 ---

/**
 * 获取 ZBLS case 的 PNG 图片路径
 * 文件名格式: F2L_G-V.png（空格已替换为下划线）
 */
export const getZblsImg = (caseKey: string): string => {
  return `${BASE}zbls_img/F2L_${caseKey}.png`;
};

// --- 时间格式化（复用 zbllHelpers 中的逻辑） ---

/**
 * 将毫秒转为可读时间字符串（如 "1.23", "1:02.345"）
 * @param ms 毫秒数
 * @param precision 小数位数（2=百分之一秒）
 */
export const msToDisplay = (ms: number, precision = 2): string => {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const divider = Math.pow(10, 3 - precision);
  const msDigits = Math.floor((ms % 1000) / divider);
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60));

  const padMs = (n: number) => `${n}`.padStart(precision, '0');

  if (minutes > 0) {
    const padSec = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${minutes}:${padSec}.${padMs(msDigits)}`;
  }
  return `${seconds}.${padMs(msDigits)}`;
};
