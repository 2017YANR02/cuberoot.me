/**
 * 批量出图的纯逻辑:一栏文本 → 一串「名字 + 公式」,以及文件名模板。
 * (MeiCubeTool 的主循环去掉 Word 那半边;渲染仍走 render.ts 的同一个 renderSpecSvg。)
 *
 * 一行一条。分隔符只认制表符和 `=`:
 *   - 制表符 —— 从表格 / Excel 粘过来就是它;
 *   - `=`    —— 手写时用,且它不在魔方记号里出现。
 * 刻意**不**认冒号:`[R: U D]` 是合法的换位记号,拿冒号当分隔符会把公式切两半。
 * `#` 开头的行是注释。
 */

import { safeFileName } from '@/lib/zip';

export interface BatchItem {
  /** 1 起,只数保留下来的行。 */
  index: number;
  /** 用户给的名字;没给就是空串,取文件名时回退到公式本身。 */
  name: string;
  alg: string;
}

export interface BatchList {
  items: BatchItem[];
  /** 超出上限被丢掉的行数 —— 调用方必须显示出来,别让人以为全出了。 */
  dropped: number;
}

export function parseBatchList(text: string, limit: number): BatchList {
  const rows: Array<{ name: string; alg: string }> = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = raw.includes('\t') ? '\t' : line.includes('=') ? '=' : null;
    if (sep) {
      const at = raw.indexOf(sep);
      const name = raw.slice(0, at).trim();
      const alg = raw.slice(at + 1).trim();
      if (alg) rows.push({ name, alg });
      else if (name) rows.push({ name: '', alg: name });
    } else {
      rows.push({ name: '', alg: line });
    }
  }
  const kept = rows.slice(0, Math.max(0, limit));
  return {
    items: kept.map((r, i) => ({ index: i + 1, name: r.name, alg: r.alg })),
    dropped: rows.length - kept.length,
  };
}

/**
 * 文件名模板。`{i}` 序号(按总数补零,免得文件管理器把 10 排在 2 前面)、
 * `{name}` 名字(没写名字就用公式)、`{alg}` 公式。结果过一遍非法字符清洗。
 */
export function batchFileName(
  template: string,
  item: BatchItem,
  total: number,
  ext: string,
): string {
  const width = String(Math.max(1, total)).length;
  const label = item.name || item.alg;
  const body = (template || '{i}-{name}')
    .replace(/\{i\}/g, String(item.index).padStart(width, '0'))
    .replace(/\{name\}/g, label)
    .replace(/\{alg\}/g, item.alg);
  return `${safeFileName(body, `image-${item.index}`)}.${ext}`;
}
