/**
 * alg-build pipeline 数据模型
 *
 * 数据流：
 *   DocxFile[] (walkDocx)
 *   → SlugGroup[] (pairCnEn 按 slug 聚合中英版本)
 *   → ExtractedPost[] (extractDocx + detectAlgs + transformHtml)
 *   → CatalogEntry[] + PostContent (writeCatalog 分列表/详情)
 */

export type Lang = 'en' | 'zh';

export type PostView = 'article' | 'algset';

/** walkDocx 扫出来的原始 docx 文件 meta */
export interface DocxFile {
  /** 相对 --src 的路径，如 '3x3/CFOP/PLL.docx' */
  relPath: string;
  /** 绝对路径 */
  absPath: string;
  /** 纯文件名，含 .docx */
  filename: string;
  /** 最近修改时间 (ms since epoch) */
  mtime: number;
  /** 字节数 */
  sizeBytes: number;
}

/** 一个 slug 聚合的中英版本（pairCnEn 产物） */
export interface SlugGroup {
  slug: string;
  category: string;
  subcategory: string | null;
  /** 顶层目录 (用于排序权重) */
  topDir: string;
  versions: {
    en?: DocxFile;
    zh?: DocxFile;
  };
  /** 同 slug 同语言的非最新版本，保留但不显示 */
  archived: DocxFile[];
  /** max(en.mtime, zh.mtime) */
  primaryMtime: number;
}

/** HTML 里被识别到的单个公式 chip */
export interface DetectedAlg {
  /** 公式文本，如 "R U R' U'" */
  alg: string;
  /** 来源：auto (启发式识别) / manual (override) */
  source: 'auto' | 'manual';
  /** 上下文描述，例如"在表格 row 3 col 2" — 用于 log 审查 */
  context?: string;
}

/** extractDocx + transformHtml 后的 extracted post (article 视图) */
export interface ExtractedArticle {
  view: 'article';
  slug: string;
  category: string;
  subcategory: string | null;
  topDir: string;
  title: Partial<Record<Lang, string>>;
  /** 每个语言一份 HTML */
  content: Partial<Record<Lang, string>>;
  /** 去重后的公式列表（用于全局搜索） */
  algs: string[];
  /** 首张图 URL（缩略图） */
  thumb: string | null;
  /** docx 里提取时的 mammoth warning 数量 */
  warningCount: number;
  /** 是否有表格 / 图片等富内容 */
  hasImages: boolean;
  hasTables: boolean;
}

/** algset 视图的 post */
export interface ExtractedAlgset {
  view: 'algset';
  slug: string;
  category: string;
  subcategory: string | null;
  topDir: string;
  title: Partial<Record<Lang, string>>;
  /** case 列表 */
  cases: AlgsetCase[];
  /** group 元数据 */
  groups: AlgsetGroup[];
  /** 首张 case 图作为 thumb */
  thumb: string | null;
  warningCount: number;
}

export interface AlgsetCase {
  /** 全局唯一 id，如 'pll-jperm-a' */
  id: string;
  /** 显示 label，如 'J Perm (a)' */
  label: string;
  /** 所属 group id，如 'adj' */
  group: string;
  /** case 图路径（相对 site root） */
  image: string | null;
  /** 公式列表（至少 1 条） */
  algs: CaseAlg[];
  /** 可选说明 HTML */
  notes?: string;
}

export interface CaseAlg {
  alg: string;
  /** 是否是此 case 的主公式（默认列表第一条） */
  primary: boolean;
  /** 作者/来源（可选，供 author-attribution color tag 用） */
  author?: string;
  /** setup move (inverse) */
  setup?: string;
}

export interface AlgsetGroup {
  id: string;
  label: string;
  count: number;
  /** 显示顺序 */
  order: number;
}

export type ExtractedPost = ExtractedArticle | ExtractedAlgset;

/** catalog.json 的 entry (精简版，供列表页用) */
export interface CatalogEntry {
  slug: string;
  view: PostView;
  title: Partial<Record<Lang, string>>;
  category: string;
  subcategory: string | null;
  topDir: string;
  thumb: string | null;
  mtime: number;
  hasEn: boolean;
  hasZh: boolean;
  /** 排序权重，越小越靠前；默认 100，核心内容在 manual_overrides 里设 < 100 */
  order: number;
  /** 是否被 hidden_slugs 标记 */
  hidden: boolean;
  /** 质量等级：ok / degraded (mammoth warnings 多) / fallback */
  quality: 'ok' | 'degraded';
  /** 公式总数（article view 是 algs.length，algset view 是 cases.length） */
  algCount: number;
}

/** posts/<slug>.json 的完整内容 (详情页用) */
export type PostContent = ExtractedArticle | ExtractedAlgset;

/** 手工 override 结构 */
export interface ManualOverride {
  title?: Partial<Record<Lang, string>>;
  category?: string;
  subcategory?: string | null;
  hidden?: boolean;
  view?: PostView;
  order?: number;
  /** algset 视图时的 group 定义 */
  algset_groups?: AlgsetGroup[];
}

export type ManualOverrides = Record<string, ManualOverride>;

/** CLI 配置 */
export interface BuildOptions {
  /** 源 docx 根目录，如 D:/cube/CubeRoot */
  src: string;
  /** 产物输出根，如 ../../../stats/data/alg */
  out: string;
  /** 仅处理 mtime 比上次新的 */
  incremental?: boolean;
  /** 详细日志 */
  verbose?: boolean;
}
