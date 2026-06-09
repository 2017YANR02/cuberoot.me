/**
 * About page entry schema — 共用于所有 /wca/about/:id 页面。
 *
 * 每个 stat / lookup 一条 AboutEntry,渲染时按 zh/en 切换。
 * 文本里不写 markdown — 直接段落,需要列表写 string[]。
 */

export interface AboutStep {
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  /** 标红的"最后一步" — 通常是把前面的产物落地 */
  highlight?: boolean;
    titleZhHant?: string;
    bodyZhHant?: string;
}

export interface AboutStat {
  value: string;           // 已格式化字符串,如 "2.27 × 10⁷⁴" 或 "~1.5 s"
  labelZh: string;
  labelEn: string;
  hintZh?: string;
  hintEn?: string;
    labelZhHant?: string;
    hintZhHant?: string;
}

export interface AboutFormula {
  /** 公式上方的标签,zh/en 切换 */
  labelZh: string;
  labelEn: string;
  /** 公式表达 — 等宽渲染,允许 unicode 数学符号 */
  expr: string;
  /** 公式下方解释 */
  bodyZh?: string;
  bodyEn?: string;
    labelZhHant?: string;
    bodyZhHant?: string;
}

export interface AboutCode {
  /** 顶上的语言标签 */
  lang: 'sql' | 'ts' | 'sh' | 'js' | 'java' | 'text';
  /** 代码块内容 */
  body: string;
  /** 代码块上方一行中文说明,可选 */
  captionZh?: string;
  captionEn?: string;
    captionZhHant?: string;
}

export interface AboutRelated {
  /** 跳转目标 id —— 默认是 about page 内部跳转 (/wca/about/<id>) */
  id: string;
  /** 中文标题(给链接) */
  titleZh: string;
  titleEn: string;
  /** 一句话解释相关性 */
  hintZh?: string;
  hintEn?: string;
  /** 跳到 stat 详情而非 about (默认 about) */
  toStat?: boolean;
  /** 覆盖 toStat 生成的内部链接(需带 query 时用,如合并到 all-results 的名次和) */
  statHref?: string;
  /** 完全外部链接(覆盖前两者) */
  href?: string;
    titleZhHant?: string;
    hintZhHant?: string;
}

export interface AboutSection {
  /** 段落标题(每段都强制一个) */
  titleZh: string;
  titleEn: string;
  /** 段落主体 — 多段时换数组 */
  bodyZh?: string | string[];
  bodyEn?: string | string[];
    titleZhHant?: string;
}

export interface AboutEntry {
  id: string;
  titleZh: string;
  titleEn: string;
  /** 右上小徽章,如 "WR" / "排名" / "选手" */
  badgeZh?: string;
  badgeEn?: string;
  /** 1-3 段引言 */
  introZh: string | string[];
  introEn: string | string[];
  /** 4 个一排的大数字 callout */
  stats?: AboutStat[];
  /** 数据源 (WCA 表/字段),通常 1 段 */
  sourceZh: string | string[];
  sourceEn: string | string[];
  /** 可选:跟 sourceZh 同段呈现的 SQL/伪码片段 */
  sourceCode?: AboutCode;
  /** 算法 / 流程的有序步骤 */
  steps: AboutStep[];
  /** 关键公式(0-3 条),可选 */
  formulae?: AboutFormula[];
  /** 口径 / 边界 / 易混点 */
  edgesZh?: string[];
  edgesEn?: string[];
  /** 自由扩展段落 — 放在 steps 之后、related 之前 */
  extraSections?: AboutSection[];
  /** 相关统计 / 链接 */
  related?: AboutRelated[];
    titleZhHant?: string;
    badgeZhHant?: string;
    edgesZhHant?: string[];
}
