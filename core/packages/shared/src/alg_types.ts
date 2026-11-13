import type { AlgPuzzle } from './alg_catalog';
import type { MirrorGen } from './alg_mirror';
/** 公式标签。前五项转写自站长 1LLL 表；`beginner` 标记新手应优先学习的公式。 */
export const ALG_TAGS = ['oh', 'ft', 'fmc', 'big', 'key', 'beginner', 'mainstream', 's-style'] as const;
export type AlgTag = (typeof ALG_TAGS)[number];

/** 用户提交的算法——挂在 (puzzle, set, case_name) 上;任何登录用户能投,作者+admin 可改/删 */
export interface AlgSubmission {
  id: number;
  puzzle: string;
  setSlug: string;
  caseName: string;
  alg: string;
  notes: string | null;
  tags: AlgTag[];
  authorId: string;
  authorName: string;
  authorUserId?: number | null;
  /** ISO timestamp from DB */
  createdAt: string;
}

export interface AlgEntry {
  /** Plain-text alg, used for clipboard copy (no HTML, but `[OH]` prefix and
   *  finger-trick UTF-8 chars like `·` `↑` `↓` `←` `→` are kept inline). */
  alg: string;
  /** Optional per-algorithm setup when alternatives represent the same visual case from different orientations. */
  setup?: string;
  /** Optional HTML markup for display, with whitelist tags `<u> <s> <em>
   *  <strong> <sub> <sup>` preserving docx finger-trick notation
   *  (underline / strike / italic-wave / bold / sub / sup). When absent,
   *  display falls back to plain `alg`. */
  algHtml?: string;
  altId?: string;
  /** YouTube finger-tricks tutorial id (no full URL — caller composes) */
  ytId?: string;
  /** 单手 / 脚拧 / 最少步 / 高阶 / 虚拟键盘 / 新手首选。UI 据此做筛选。 */
  tags?: AlgTag[];
  /** 公式出处。站长自编的排在外部数据源前面。 */
  source?: 'cuberoot' | 'speedcubedb' | 'cubingapp' | 'LowCubes / Raul Low';
  /** Optional source annotation shown beside the formula. */
  note?: { en: string; zh: string };
  /** 这条公式**照写**的步数(`R4` = 1 STM / 4 SQTM —— 它是个真实的物理动作,见 alg_notation)。 */
  stm?: number;
  sqtm?: number;
  /**
   * 这条是**自动镜像生成**的,不是人写的(issue #40 T5)。值 = 用了哪种重写
   * (`lr` 左右镜 / `fb` 前后镜 / `y2` 掉头)。人工原创条**没有**这个字段 —— 全站一律靠
   * 「有没有 `gen`」区分原创与生成,别再引第二个判据。
   */
  gen?: MirrorGen;
  /** 生成条的源头:源 case 的 `alg_cases.id` + 第几个视角 + 视角内第几条(都从 0 起)。 */
  src?: { id: number; ori: number; i: number };
}

/**
 * case 的富元数据。主要来自站长自编的公式表,其余 case 为 `undefined`。
 * 字段跨公式集不一定齐全,所以整块塞 `alg_cases.meta` JSONB,不给表加列。
 * 前端走弹窗展示,不占主视图。
 */
export interface AlgCaseMeta {
  /** 表里的 case 编号(1–3916;缺 0005 = LL 连跳) */
  no: number;
  /** OLLCP 名:`AB3` = OLL `A` + 角换 `B` + 识别特征 `3`(十六进制 1–9,A,B,C) */
  ollcp?: string;
  /** `PLL` / `ZBLL-U` / `1LLL` / `ELL-A` … */
  subset?: string;
  /** 字母制 OLL 名 */
  oll?: string;
  /** 角换类型 */
  cp?: string;
  /** 首条人工整理公式的执行步数(不是最优值)。 */
  etm?: number;
  /** 打乱 = 逆 case 的公式(已剥掉起手 AUF) */
  scramble?: string;
  /** 生成元集合,如 `FLlMU`(大小写不敏感排序,同字母按首次出现) */
  gen?: string;
  /** 叠加公式类型:`OO` = OLL+OLL、`OP` = OLL+PLL、`CC` = conjugate commutator … */
  type?: string;
  /** 镜像 / 逆 / 镜像逆 case 的**表编号**(不是 DB id —— 表编号才是站长认的那套) */
  mirror?: number;
  inv?: number;
  im?: number;
  /** 各度量下的最优步数 + 对应打乱。 */
  optimal?: Partial<Record<'etm' | 'htm' | 'qtm' | 'stm' | 'sqtm' | 'atm', { len: number; scramble?: string }>>;
  /** COEP(角朝向 + 棱排列)—— 只有 ZBLL / PLL 有 */
  coep?: { alg?: string; scramble?: string };
  /** 对称性 */
  sym?: {
    /** 循环对称阶,如 `C2` / `C4` */
    cn?: string;
    selfMirror?: boolean;
    selfInv?: boolean;
    any?: boolean;
    full?: boolean;
    anti?: boolean;
  };
  /** speedcubedb 的 ZBLL 编号(只有 472 行有) */
  sdbNo?: string;
  /** 旧编号,备查 */
  docNo?: string;
  oldNo?: string;
}

export type AlgSticker =
  | { kind: 'f2l'; fl: string }
  | {
      kind: 'face'; us: string; ub: string; uf: string; ul: string; ur: string;
      /** Optional DB-driven VisualCube mask/scheme for stage sets such as 2 Look OLL. */
      mask?: string; scheme?: string;
    }
  | { kind: 'raw'; tag: string; attrs: Record<string, string> };

export interface AlgCase {
  /** PG `alg_cases.id` — populated by API responses; absent in legacy code paths. */
  id?: number;
  name: string;
  /** Per-set business 编号 (F2L 1..41 = CFOP 文献规范);其它 set 为 undefined。跟 排序的 position 解耦。 */
  number?: number;
  subgroup: string;
  setup: string;
  standard?: string;
  sticker: AlgSticker;
  /** F2L: 4 entries (FR / FL / BL / BR). Most others: single entry. */
  algs: AlgEntry[][];
  /** F2L only — names of each orientation tab (e.g. "Front Right") */
  oriNames?: string[];
  /** ZBLS only — links cases into the trainer's grid layout. */
  trainerKey?: string;
  /** Optional rich metadata for sets such as OLL, PLL, ZBLL, ELL, and 1LLL. */
  meta?: AlgCaseMeta;
  /**
   * 镜像伙伴的 `alg_cases.id`(issue #40 T5)—— 左右镜 + 把最后一槽转回 FR 得到的那张 case。
   * 互指;自镜像指自己;不适用的 set 恒 undefined。只有 {@link MIRROR_SETS} 里的 set 有。
   */
  mirrorCaseId?: number | null;
  /**
   * 合练会话(多个 set 混在一起练)专用:标明该 case 来自哪个 set。
   * 单集会话不设 —— `caseKey()` 据此保持原样,历史进度不失效。
   */
  srcSet?: string;
}

/** Lightweight catalog read model; source cases remain owned by the algorithm DB. */
export interface AlgCatalogSnapshot {
  puzzle: AlgPuzzle;
  order: string[];
  sets: { slug: string; count: number; first: AlgCase | null }[];
}

export interface AlgFile {
  scrapedAt: string;
  source: string;
  /** "2x2" | "3x3" | "4x4" | "5x5" */
  puzzle: string;
  /** slug — e.g. "f2l", "zbll", "ortega-oll", "oll-parity" */
  set: string;
  cases: AlgCase[];
}
