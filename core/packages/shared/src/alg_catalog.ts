export type AlgPuzzle = '2x2' | '3x3' | '4x4' | '5x5' | 'sq1' | 'megaminx' | 'pyraminx' | 'skewb' | 'fto';


/** 3x3 set slug — matches `slug` in {@link ALG_CATALOG['3x3']}. */
export type Alg3x3Set =
  | 'f2l' | 'adv-f2l' | 'psf2l' | '2-look-oll' | 'oll' | '2-look-pll' | 'pll'
  | 'coll' | 'wv' | '2-look-cmll' | 'cmll' | 'oh-cmll' | 'sbls' | 'eo4a' | 'lse-eolr'
  | 'anti-pll' | 'sv' | 'ell' | 'fruf'
  | 'cls' | 'vls' | 'ollcp' | 'zbll' | '1lll' | 'zbls';

/**
 * Whether a 3x3 set solves only the last layer. This exhaustive map forces a
 * deliberate classification whenever a new 3x3 set is added.
 */
export const ALG_3X3_TOP_LAYER_SET: Readonly<Record<Alg3x3Set, boolean>> = {
  'f2l': false,
  'adv-f2l': false,
  'psf2l': false,
  '2-look-oll': true,
  'oll': true,
  '2-look-pll': true,
  'pll': true,
  'coll': true,
  'wv': false,
  '2-look-cmll': true,
  'cmll': true,
  'oh-cmll': true,
  'sbls': false,
  'eo4a': false,
  'lse-eolr': false,
  'anti-pll': true,
  'sv': false,
  'ell': true,
  'fruf': false,
  'cls': false,
  'vls': false,
  'ollcp': true,
  'zbll': true,
  '1lll': true,
  'zbls': false,
};

export function is3x3TopLayerSet(puzzle: string, setSlug: string): boolean {
  return puzzle === '3x3'
    && Object.prototype.hasOwnProperty.call(ALG_3X3_TOP_LAYER_SET, setSlug)
    && ALG_3X3_TOP_LAYER_SET[setSlug as Alg3x3Set];
}

/** These case families need an explicit legal state; five-face sticker projections are insufficient. */
export const ALG_3X3_SETUP_REQUIRED_SETS = ['f2l', 'adv-f2l'] as const;

export function requires3x3AlgCaseSetup(puzzle: string, setSlug: string): boolean {
  return puzzle === '3x3'
    && (ALG_3X3_SETUP_REQUIRED_SETS as readonly string[]).includes(setSlug);
}

/** Catalogue of available sets per puzzle (display name + slug). Drives the index pages. */
export interface AlgSetMeta {
  /** URL slug (matches data filename: alg_<puzzle>_<slug>.json) */
  slug: string;
  /** Speedcubedb subset key (just for reference; not used at runtime) */
  scd: string;
  en: string;
  zh: string;
  /** Optional longer set-page explanation. The compact heading still comes from short/en/zh. */
  intro?: { en: string; zh: string };
  /** Compact language-neutral label for index cards and set page headings. */
  short?: string;
  /** True for sets that speedcubedb organises under sub-pages (ZBLL → ZBLL U/L/T/...).
   *  UI shows a subgroup-picker landing page first, then cases for the picked subgroup. */
  umbrella?: boolean;
}

/** Core 3x3 CFOP formula sets, shared by the catalog grouping and assistant navigation. */
export const CFOP_SET_SLUGS = new Set(['f2l', 'oll', 'pll']);

export const ALG_CATALOG: Record<AlgPuzzle, AlgSetMeta[]> = {
  '2x2': [
    { slug: 'ortega-oll', scd: 'OrtegaOLL', short: 'OLL', en: 'Ortega OLL', zh: 'Ortega OLL', umbrella: true },
    { slug: 'ortega-pbl', scd: 'OrtegaPBL', short: 'PBL', en: 'Ortega PBL', zh: 'Ortega PBL', umbrella: true },
    { slug: 'cll',        scd: 'CLL',       en: 'CLL',        zh: 'CLL', umbrella: true },
    { slug: 'eg1',        scd: 'EG1',       en: 'EG1',        zh: 'EG1', umbrella: true },
    { slug: 'eg2',        scd: 'EG2',       en: 'EG2',        zh: 'EG2', umbrella: true },
    { slug: 'leg1',       scd: '',          en: 'LEG1',       zh: 'LEG1', umbrella: true },
    { slug: 'tcll-plus',  scd: '',          en: 'TCLL+',      zh: 'TCLL+', umbrella: true },
    { slug: 'tcll-minus', scd: '',          en: 'TCLL-',      zh: 'TCLL-', umbrella: true },
    { slug: 'ls1',        scd: '',          en: 'LS1',        zh: 'LS1', umbrella: true },
    { slug: 'ls2',        scd: '',          en: 'LS2',        zh: 'LS2', umbrella: true },
    { slug: 'ls3',        scd: '',          en: 'LS3',        zh: 'LS3', umbrella: true },
    { slug: 'ls4',        scd: '',          en: 'LS4',        zh: 'LS4', umbrella: true },
    { slug: 'ls5',        scd: '',          en: 'LS5',        zh: 'LS5', umbrella: true },
    { slug: 'ls6',        scd: '',          en: 'LS6',        zh: 'LS6', umbrella: true },
    { slug: 'ls7',        scd: '',          en: 'LS7',        zh: 'LS7', umbrella: true },
    { slug: 'ls8',        scd: '',          en: 'LS8',        zh: 'LS8', umbrella: true },
    { slug: 'ls9',        scd: '',          en: 'LS9',        zh: 'LS9', umbrella: true },
    { slug: 'teg2-plus',  scd: '',          en: 'TEG2+',      zh: 'TEG2+', umbrella: true },
  ],
  '3x3': [
    { slug: 'f2l',       scd: 'F2L',         en: 'F2L',                  zh: 'F2L' },
    { slug: 'adv-f2l',   scd: 'AdvancedF2L', en: 'Advanced F2L',         zh: '非标F2L' },
    {
      slug: 'psf2l', scd: '', en: 'Pseudoslotting', zh: '伪槽',
      intro: {
        en: 'Temporarily misalign the D layer, insert a mismatched corner and edge as a normal F2L pair, then restore D. This advanced double-keyhole technique solves pieces from two slots together and is especially useful for the last two slots, pseudo X-crosses and FMC.',
        zh: '先暂时错开 D 层，把不属于同一槽的角块和棱块当作普通 F2L 对插入，再复原 D 层。这是一种进阶的“双锁孔”技巧，可同时处理两个槽的块，常用于最后两槽、伪拓展十字与最少步。',
      },
    },
    {
      slug: '2-look-oll', scd: '', en: '2 Look OLL', zh: '2 步 OLL',
      intro: {
        en: 'Orient the last layer in two passes: edges first, then corners.',
        zh: '分两步完成顶层朝向：先棱块，后角块。',
      },
    },
    { slug: 'oll',       scd: 'OLL',         en: 'OLL',                  zh: 'OLL' },
    {
      slug: '2-look-pll', scd: '', en: '2 Look PLL', zh: '2 步 PLL',
      intro: {
        en: 'Permute the last layer in two passes: corners first, then edges.',
        zh: '分两步完成顶层排列：先角块，后棱块。',
      },
    },
    { slug: 'pll',       scd: 'PLL',         en: 'PLL',                  zh: 'PLL' },
    /* ZBLS / ZBLL(以及页面上紧跟其后的 LSLL)是 CFOP 之后最常练的大套,顶到 PLL 后面免得埋在长尾里 */
    { slug: 'zbls',      scd: 'ZBLS',        en: 'ZBLS',                 zh: 'ZBLS',  umbrella: true },
    { slug: 'zbll',      scd: 'ZBLL',        en: 'ZBLL',                 zh: 'ZBLL',  umbrella: true },
    { slug: 'coll',      scd: 'COLL',        en: 'COLL',                 zh: 'COLL', umbrella: true },
    { slug: 'wv',        scd: 'WV',          en: 'WV',                   zh: 'WV' },
    {
      slug: '2-look-cmll', scd: '', en: '2 Look CMLL', zh: '2 步 CMLL',
      intro: {
        en: 'Solve Roux last-layer corners in two passes: orient them first, then permute them.',
        zh: '把桥式顶层角块分两步完成：先调整朝向，再完成排列。',
      },
    },
    { slug: 'cmll',      scd: 'CMLL',        en: 'CMLL',                 zh: 'CMLL' },
    {
      slug: 'oh-cmll', scd: '', en: 'OH CMLL', zh: '单手 CMLL',
      intro: {
        en: 'CMLL algorithms selected for one-handed Roux solves.',
        zh: '为单手桥式还原挑选的 CMLL 公式。',
      },
    },
    { slug: 'sbls',      scd: 'SBLS',        en: 'SBLS',                 zh: 'SBLS' },
    { slug: 'eo4a',      scd: 'EO4A',        en: 'LSE EO (4a)',          zh: 'LSE 棱朝向 (4a)' },
    {
      slug: 'lse-eolr', scd: '', en: 'LSE EOLR', zh: 'LSE EOLR',
      intro: {
        en: 'Combine Roux LSE edge orientation with placing the UL and UR edges.',
        zh: '在桥式 LSE 中同时完成棱块朝向，并放置 UL 与 UR 棱块。',
      },
    },
    { slug: 'anti-pll',  scd: 'AntiPLL',     en: 'Anti PLL',             zh: 'Anti PLL' },
    { slug: 'sv',        scd: 'SV',          en: 'SV',                   zh: 'SV' },
    { slug: 'ell',       scd: 'ELL',         en: 'ELL',                  zh: 'ELL' },
    { slug: 'fruf',      scd: 'FRUF',        en: "F <R,U> F'",           zh: "F <R,U> F'" },
    { slug: 'cls',       scd: 'CLS',         en: 'CLS',                  zh: 'CLS' },
    { slug: 'vls',       scd: 'VLS',         en: 'VLS',                  zh: 'VLS',   umbrella: true },
    { slug: 'ollcp',     scd: 'OLLCP',       en: 'OLLCP',                zh: 'OLLCP', umbrella: true },
    { slug: '1lll',      scd: '1LLL',        en: '1LLL',                 zh: '1LLL',  umbrella: true },
  ],
  '4x4': [
    { slug: 'oll-parity', scd: 'OLLParity', en: 'OLL Parity', zh: 'OLL Parity' },
    { slug: 'pll-parity', scd: 'PLLParity', en: 'PLL Parity', zh: 'PLL Parity' },
  ],
  '5x5': [
    { slug: 'l2e', scd: 'L2E', en: 'Last Two Edges',   zh: 'Last Two Edges (L2E)' },
    { slug: 'l2c', scd: 'L2C', en: 'Last Two Centers', zh: 'Last Two Centers (L2C)' },
  ],
  'sq1': [
    { slug: 'cs',     scd: 'SQ1CS',     short: 'CS',     en: 'Cube Shape',         zh: '复形' },
    {
      slug: 'csp', scd: 'SQ1CSP', short: 'CSP', en: 'Cubeshape Parity', zh: '复形奇偶',
      intro: {
        en: 'Detect and correct Square-1 parity during cubeshape; the parity check can be done during inspection.',
        zh: '在复形阶段判断并修正 Square-1 奇偶；奇偶检查可以在观察阶段完成。',
      },
    },
    { slug: 'co',     scd: 'SQ1CO',     short: 'CO',     en: 'Corner Orientation', zh: '角块朝向' },
    { slug: 'eo',     scd: 'SQ1EO',     short: 'EO',     en: 'Edge Orientation',   zh: '棱块朝向' },
    { slug: 'cp',     scd: 'SQ1CP',     short: 'CP',     en: 'Corner Permutation', zh: '角块排列' },
    { slug: 'ep',     scd: 'SQ1EP',     short: 'EP',     en: 'Edge Permutation',   zh: '棱块排列' },
    {
      slug: 'obl', scd: 'SQ1OBL', short: 'OBL', en: 'Orientation of Both Layers', zh: '双层色向',
      intro: {
        en: 'Solve the orientation of both layers while preserving cubeshape.',
        zh: '在保持复形的同时完成上下两层色向。',
      },
    },
    {
      slug: 'pbl', scd: '', short: 'PBL', en: 'Permutation of Both Layers', zh: '双层排列', umbrella: true,
      intro: {
        en: 'Solve the permutation of both layers after restoring cubeshape and orientation.',
        zh: '在完成复形与双层色向后，排列上下两层的块。',
      },
    },
    { slug: 'parity', scd: 'SQ1Parity', short: 'Parity', en: 'Parity',             zh: 'Parity' },
  ],
  'megaminx': [
    { slug: 'full-pll', scd: '', short: 'Full PLL', en: 'Full PLL', zh: 'Full PLL' },
    { slug: 'eo', scd: 'MegaminxEO', en: 'Edge Orientation',    zh: '棱块朝向 (EO)' },
    { slug: 'co', scd: 'MegaminxCO', en: 'Corner Orientation',  zh: '角块朝向 (CO)' },
    { slug: 'ep', scd: 'MegaminxEP', en: 'Edge Permutation',    zh: '棱块排列 (EP)' },
    { slug: 'cp', scd: 'MegaminxCP', en: 'Corner Permutation',  zh: '角块排列 (CP)' },
  ],
  'pyraminx': [
    { slug: 'l3e', scd: 'L3E', en: 'Last 3 Edges', zh: 'Last 3 Edges (L3E)' },
    { slug: 'l4e', scd: 'L4E', en: 'Last 4 Edges', zh: 'Last 4 Edges (L4E)' },
  ],
  'skewb': [
    { slug: 'sarahs-advanced', scd: 'SarahsAdvanced', en: "Sarah's Advanced", zh: "Sarah's Advanced" },
  ],
  'fto': [
    { slug: 'pf', scd: '', short: 'PF', en: 'Pair Formation', zh: '配对成形' },
    { slug: 'tl', scd: '', short: 'TL', en: 'Top Layer', zh: '顶层' },
    { slug: 'lt', scd: '', short: 'LT', en: 'Last Triangles', zh: '最后三角' },
    { slug: 'tcp', scd: '', short: 'TCP', en: 'Triangle Combination and Permutation', zh: '三角组合与排列' },
    { slug: '1l3t', scd: '', short: '1L3T', en: 'One-Look Last Three Triangles', zh: '一步最后三角' },
  ],
};

/** Optional grouped landing layout. A slug may appear in more than one section. */
export interface AlgCatalogSection {
  id: string;
  en: string;
  zh: string;
  slugs: string[];
}

export const ALG_CATALOG_SECTIONS: Partial<Record<AlgPuzzle, AlgCatalogSection[]>> = {
  '2x2': [
    { id: 'ortega', en: 'Ortega', zh: 'Ortega', slugs: ['ortega-oll', 'ortega-pbl'] },
    { id: 'eg', en: 'EG', zh: 'EG', slugs: ['cll', 'eg1', 'eg2', 'leg1'] },
    { id: 'teg', en: 'TEG', zh: 'TEG', slugs: ['tcll-plus', 'tcll-minus', 'teg2-plus'] },
  ],
  fto: [
    { id: '3-look-l3t', en: '3-Look L3T', zh: '3-Look L3T', slugs: ['pf', 'tl', 'lt'] },
    { id: '2-look-l3t', en: '2-Look L3T', zh: '2-Look L3T', slugs: ['pf', 'tcp'] },
    { id: '1-look-l3t', en: '1-Look L3T', zh: '1-Look L3T', slugs: ['1l3t'] },
  ],
  megaminx: [
    { id: 'megaminx-last-layer', en: 'Last Layer', zh: '最后一层', slugs: ['full-pll'] },
    { id: 'megaminx-stages', en: 'Stage Algorithms', zh: '阶段公式', slugs: ['eo', 'co', 'ep', 'cp'] },
  ],
};

export const ALG_PUZZLES: AlgPuzzle[] = ['2x2', '3x3', '4x4', '5x5', 'sq1', 'megaminx', 'pyraminx', 'skewb', 'fto'];

export function getAlgSetMeta(puzzle: AlgPuzzle, slug: string): AlgSetMeta | undefined {
  return ALG_CATALOG[puzzle]?.find(s => s.slug === slug);
}
