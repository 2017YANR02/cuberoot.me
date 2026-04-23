import { pinyin } from 'pinyin-pro';

/** 文件名 → URL slug 的规范化 */
export function slugify(filename: string): string {
  let s = filename.replace(/\.docx$/i, '');
  // 去 -CHS / _CHS / CHS 后缀
  s = s.replace(/[-_\s]?CHS\b/gi, '');
  // 去尾部版本号标记：(v2) (v1.1) (2024)
  s = s.replace(/\s*\(v?\d+(\.\d+)?\)\s*$/i, '');
  // 去尾部日期数字串 240203 / 20240203
  s = s.replace(/\s*\d{6,8}$/, '');
  // 中文转 pinyin（无声调，连字符分隔，非中文段保留）
  s = pinyin(s, { toneType: 'none', separator: '-', nonZh: 'consecutive' });
  // 其余非 [a-z0-9] 转 -
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s || 'untitled';
}
