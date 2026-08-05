/**
 * Best 2x2 Algs 表格的抓取层 —— **零依赖**(只用 node 内置 + 全局 fetch)。
 *
 * 零依赖是硬要求:漂移检测 workflow 照 `scripts/reg-check.mjs` 的模式跑,
 * 那套 job 不跑 `pnpm install`,任何 npm 依赖或 tsx 都会让它挂。导入管道
 * (best2x2/*.mts,靠根 devDependency tsx 跑)反过来 import 这一份,
 * **抓取只此一处**,不许第二个地方再拼一次 URL。
 *
 * 表是公开可读的。gviz 端点按**表名**导 CSV(不需要 gid,连网页版隐藏的 TEG2+ 也导得出):
 *   https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=<name>
 *
 * ⚠ 本机连 Google 要走代理,而 Node 的 fetch **不读** HTTPS_PROXY —— 必须
 * `NODE_USE_ENV_PROXY=1`(Node ≥ 24 内建)。GitHub runner 直连,不需要。
 */

export const DOC_ID = '1OFXakCV85Mp2zsQBXMxiMX9a506JeAcLnUXZr8FgXAY';

/** 人看的表地址(报告里回链用)。 */
export const DOC_URL = `https://docs.google.com/spreadsheets/d/${DOC_ID}/edit`;

/** 公式页,按表内顺序。TEG2+ 在网页版是隐藏页,gviz 仍能按名导出。 */
export const ALG_SHEETS = [
  'PBL', 'CLL', 'EG-1', 'EG-2', 'LEG-1', 'TCLL+', 'TCLL-',
  'LS-1', 'LS-2', 'LS-3', 'LS-4', 'LS-5', 'LS-6', 'LS-7', 'LS-8', 'LS-9',
  'TEG2+',
];

/** 说明页 —— 不含公式,但漂移要盯(编者名单 / 外部方法目录 / PBL 换角写法会变)。 */
export const META_SHEETS = ['Home', 'External Catalog', 'PBL Angles', 'LS Explanation'];

export const ALL_SHEETS = [...ALG_SHEETS, ...META_SHEETS];

/** @param {string} sheet */
export const csvUrl = (sheet) =>
  `https://docs.google.com/spreadsheets/d/${DOC_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

/**
 * 抓一页 CSV。失败重试 3 次(退避 1s/2s)—— Google 偶发 5xx,reg-check 那边裸重试
 * 已经证明够用,这里加了退避。
 *
 * @param {string} sheet
 * @param {{ timeoutMs?: number, tries?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function fetchSheetCsv(sheet, opts = {}) {
  const { timeoutMs = 30_000, tries = 3 } = opts;
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(csvUrl(sheet), {
        signal: ctl.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'cuberoot.me best2x2 drift check' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // 表名写错 / 表被改成不公开时,gviz 回的是 HTML 错误页而不是 CSV。
      if (/^\s*</.test(text)) throw new Error('回的不是 CSV(表名写错,或表已不公开)');
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < tries) await new Promise((r) => setTimeout(r, 1000 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${sheet}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

/**
 * RFC4180 CSV → 二维字符串数组(gviz 的引号转义只有 `""` 这一种)。
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  /** @type {string[][]} */ const rows = [];
  /** @type {string[]} */ let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
