// NOTE: 核心类型定义——前后端共享，修改时需同步考虑两端影响

/** 单个公式 case */
export interface TrainerCase {
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
export interface TrainerSet {
  /** 唯一标识，如 "3x3-pll" */
  id: string;
  /** 显示名称，如 "3×3 PLL" */
  name: string;
  /** 魔方类型，供 cubing.js 使用 */
  puzzle: string;
  /** 所有 case */
  cases: TrainerCase[];
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

// ── Recon 复盘模块类型 ──

/**
 * 复盘记录主体——对齐数据库 recons 表（40+ 列）
 * NOTE: 字段名 camelCase，与后端 rowToJson 输出一致
 */
export interface ReconSolve {
  id: number;
  /** 是否 WCA 官方比赛 */
  official: boolean;
  /** 项目（如 "3x3", "2x2", "3bld"） */
  event: string;
  /** 解法方法（如 "CFOP", "Roux", "ZB"） */
  method?: string;
  /** 比赛日期 YYYY-MM-DD */
  date?: string;
  /** 比赛名称 */
  comp?: string;
  /** 比赛 WCA ID（如 "WC2025"） */
  compWcaId?: string;
  /** 比赛所在国家 */
  country?: string;
  /** 轮次（如 "f" = 决赛, "1" = 第一轮） */
  round?: string;
  /** 第几把（1-5） */
  solveNum?: number;
  /** 选手名 */
  person?: string;
  /** 选手 WCA ID */
  personId?: string;
  /** 选手国籍 ISO 3166-1 alpha-2 小写 */
  personCountry?: string;
  /** 单次成绩（秒） */
  rawTime?: number;
  /** 盲拧执行时间（秒） */
  execTime?: number;
  /** 盲拧记忆时间（秒） */
  memoTime?: number;
  /** 平均成绩（秒） */
  average?: number;
  /** 单次成绩显示值（截断后） */
  value?: string;
  /** 单次纪录标记（如 "WR", "CR", "NR"） */
  regionalSingleRecord?: string;
  /** 平均纪录标记 */
  regionalAverageRecord?: string;
  /** Ao 类型（如 "Ao5", "Mo3"） */
  aoType?: string;
  /** AoXR 纪录标记 */
  regionalAoxrRecord?: string;
  /** 原始 recon 文本（含统计行+打乱+解法，旧格式） */
  recon?: string;
  /** 纯解法文本（新格式） */
  solution?: string;
  /** 优化打乱 */
  optimalScramble?: string;
  /** WCA 官方打乱 */
  wcaScramble?: string;
  /** 描述/标题 */
  caption?: string;
  /** 备注 */
  note?: string;
  /** STM 步数 */
  stm?: number;
  /** TPS (Turns Per Second) */
  tps?: number;
  /** OLL 全名 */
  oll?: string;
  /** PLL 全名 */
  pll?: string;
  /** OLL 缩写 */
  ollShort?: string;
  /** PLL 缩写 */
  pllShort?: string;
  /** Free pair 数量 */
  freePair?: number;
  /** Y 旋转次数 */
  yRot?: number;
  /** Regrip 次数 */
  regrip?: number;
  /** Lockup 次数 */
  lockup?: number;
  /** Cross 类型编码 */
  crossType?: number;
  /** Cross STM */
  crossStm?: number;
  /** F2L STM */
  f2l?: number;
  /** LL STM */
  ll?: number;
  /** S 系列转动次数 */
  sMove?: number;
  /** Cross 颜色单字符（W/Y/R/O/G/B） */
  crossColor?: string;
  /** 魔方型号 */
  cube?: string;
  /** 复盘者名 */
  reconer?: string;
  /** 复盘者 WCA ID */
  reconerId?: string;
  /** 分组 ID */
  groupId?: string;
  /** 复盘日期 YYYY-MM-DD */
  reconDate?: string;
  /** 创建时间（Unix timestamp） */
  createdAt?: number;
  /** 添加者名 */
  addedBy?: string;
  /** 添加者 WCA ID */
  addedById?: string;
  /** 视频链接（多行，每行一个 URL） */
  videoUrl?: string;
  /** 另解列表——任何登录用户都能给同一个 solve 投自己的另解 */
  alternatives?: ReconAlternative[];
  /** 前端标记：是否有编辑覆盖层 */
  _edited?: boolean;
  /** 前端标记：本地未同步数据 */
  _local?: boolean;
}

/** 另解条目——挂在某个 solve 下的子还原(同打乱、不同解法) */
export interface ReconAlternative {
  solution: string;
  addedById: string;
  addedBy: string;
  /** Unix timestamp */
  createdAt: number;
}

/** 用户提交的算法——挂在 (puzzle, set, case_name) 上;任何登录用户能投,作者+admin 可改/删 */
export interface AlgSubmission {
  id: number;
  puzzle: string;
  setSlug: string;
  caseName: string;
  alg: string;
  notes: string | null;
  authorId: string;
  authorName: string;
  /** ISO timestamp from DB */
  createdAt: string;
}

/** 评论 */
export interface ReconComment {
  id: number;
  reconId: number;
  authorId: string;
  authorName: string;
  content: string;
  /** Unix timestamp */
  createdAt: number;
  /** Unix timestamp，未编辑则 null */
  updatedAt: number | null;
  /** 管理员置顶（仅顶层评论可置顶） */
  pinned: boolean;
  /** 父评论 id；null 表示顶层评论。回复只支持单层（YouTube 风格） */
  parentId: number | null;
}

/** 编辑历史条目 */
export interface EditHistoryItem {
  id: string;
  solveId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  editedBy: string;
  /** Unix timestamp */
  editedAt: number;
}

/** computeAllStats 返回值 */
export interface ReconStatsResult {
  stm: number;
  tps: number;
  /** OLL 全名（如 "OLL 21"） */
  ollFull: string;
  /** PLL 全名（如 "T-Perm"） */
  pllFull: string;
  ollShort: string;
  pllShort: string;
  freePair: number;
  yRot: number;
  regrip: number;
  lockup: number;
  /** Cross 类型：0=无, 1=xCross, 2=xxCross... */
  crossType: number;
  crossStm: number;
  f2l: number;
  ll: number;
  sMove: number;
  /** Cross 颜色单字符 */
  crossColor: string;
}
