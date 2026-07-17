// NOTE: 核心类型定义——前后端共享，修改时需同步考虑两端影响

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

/** /comp 页 Psych Sheet 用:每选手每项目本比赛前累积 PB(centiseconds) + best 那条 result 的
 *  区域纪录 marker.server (wca_db 路径) 预算,client 直接消费,避免逐选手并发 fetch WCA REST 触发 429. */
export interface CompPersonalRecordSlot {
  single?: number;
  average?: number;
  /** best 那条 result 的 regional record tag (WR/AsR/NR/...);仅非空非 'PR' 时填. */
  singleTag?: string;
  averageTag?: string;
}

// ── Recon 复盘模块类型 ──

/**
 * 复盘记录主体——对齐数据库 recons 表（40+ 列）
 * NOTE: 字段名 camelCase，与后端 rowToJson 输出一致
 */
/** 复盘性质:wca=WCA 官方比赛, non_wca=非 WCA 比赛, practice=练习(个人/家用还原) */
export type ReconOfficial = 'wca' | 'non_wca' | 'practice';

export interface ReconSolve {
  id: number;
  /** 比赛性质(见 ReconOfficial);旧布尔 official=1 迁移为 'wca',=0 为 'practice' */
  official: ReconOfficial;
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
  /** 比赛所在国家 ISO 3166-1 alpha-2 小写 */
  country?: string;
  /** 比赛所在城市（自由文本，主要给非 WCA 比赛用；WCA 比赛城市由 compWcaId 解析） */
  city?: string;
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
  /** 共同完成的其他选手——主选手(成绩归属)仍是 person/personId,这里存额外合作者(两人合作还原等) */
  coPersons?: ReconCuber[];
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
  /** 同选手+同打乱重复提交时的原因(必选其一):'repeat_scramble' 重复打乱 / 'different_comp' 不同比赛。非重复=空 */
  dupReason?: 'repeat_scramble' | 'different_comp';
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

/** 共同完成者——除主选手外的额外合作者(同一把由多人合作完成时用) */
export interface ReconCuber {
  /** 选手名(WCA API 原始名,渲染走 displayCuberName) */
  name: string;
  /** WCA ID(可空——非 WCA 选手) */
  id?: string;
  /** 国籍 ISO 3166-1 alpha-2 小写 */
  country?: string;
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
