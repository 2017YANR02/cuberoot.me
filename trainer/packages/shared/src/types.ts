// NOTE: 核心类型定义——前后端共享，修改时需同步考虑两端影响

/** 单个公式 case */
export interface AlgCase {
  /** 唯一标识，如 "Aa", "Ab", "E", "OLL-1" */
  id: string;
  /** 显示名称 */
  name: string;
  /** 分组名，如 "Adjacent", "Diagonal" */
  group: string;
  /** 公式列表，第一个为推荐公式 */
  algorithms: string[];
  /** 逆序打乱（用于 cubing.js 渲染 case 状态） */
  scramble: string;
}

/** 一组公式集（如 PLL、OLL） */
export interface AlgSet {
  /** 唯一标识，如 "3x3-pll" */
  id: string;
  /** 显示名称，如 "3×3 PLL" */
  name: string;
  /** 魔方类型，供 cubing.js 使用 */
  puzzle: string;
  /** 所有 case */
  cases: AlgCase[];
}

/** 单次训练结果 */
export interface TrainResult {
  caseId: string;
  /** 计时（毫秒） */
  timeMs: number;
  /** Unix 时间戳 */
  timestamp: number;
  /** 是否识别正确（识别模式下使用） */
  correct: boolean;
}

/** 用户的训练进度 */
export interface UserProgress {
  /** WCA ID 或匿名 UUID */
  userId: string;
  /** 公式集 ID */
  algSetId: string;
  /** 训练结果历史 */
  results: TrainResult[];
  /** 选中的 case ID 列表 */
  selectedCases: string[];
  /** 用户设置 */
  settings: UserSettings;
}

/** 用户设置 */
export interface UserSettings {
  /** 是否启用 15 秒观察 */
  inspection: boolean;
  /** 是否显示公式提示 */
  showHints: boolean;
  /** 自适应学习开关 */
  adaptiveLearning: boolean;
  /** 魔方显示角度 */
  cubeViewAngle: string;
  /** 主题 ("light" | "dark") */
  theme: 'light' | 'dark';
}

// ── WCA 共享类型（calc / viz / recon 通用） ──

/** WCA 选手搜索结果 */
export interface WcaPerson {
  wcaId: string;
  name: string;
  /** ISO 3166-1 alpha-2 小写国家代码 */
  iso2: string;
  avatarUrl: string;
}

/** WCA OAuth 登录用户信息 */
export interface WcaAuthUser {
  wcaId: string;
  name: string;
  avatar: string;
  country: string;
}

/** 选手在某项目的成绩摘要（fetchUserTimes 返回值） */
export interface WcaUserTimes {
  /** 最近有效单次成绩（centiseconds），最多 100 个 */
  times: number[];
  /** Ao100 trimmed average (centiseconds) */
  ao100: number;
  /** 官方最佳 average (centiseconds)，无则 null */
  averagePR: number | null;
  name: string;
  country: string;
}
