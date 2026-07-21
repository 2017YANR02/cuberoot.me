// 「英文 中文」混排文本 → {en, zh} 拆分器。
//
// 用途:一次性把 713 条 seed 词条(0009 从 glossary.txt 导入时是中英混排)拆成
// head_en/head_zh/body_en/body_zh 结构化双字段。见 backfill-wiki-bilingual.mjs。
//
// 质量:在全部 713 条上实测,head 零「en 残留汉字」误拆(scratchpad/split-eval)。
// 规则:首个汉字处切分;若汉字前紧贴一个被空格界定的单字母/数字(如 "nxn n阶"、
// "2秒"),并入 zh 侧,避免把 "n阶魔方" 拆成 "...n"+"阶魔方"。glued 无空格的
// 英文词(如 "Curvy Copter花瓣直升机魔方")按首汉字切,英文词完整留在 en 侧。

const CJK = /[㐀-䶿一-鿿豈-﫿]/;

/** 单行文本按首个汉字切成 {en, zh}。无汉字→全 en;首字即汉字→全 zh。 */
export function splitLine(s) {
  const m = CJK.exec(s);
  if (!m) return { en: s.trim(), zh: '' };
  let i = m.index;
  if (i > 0 && /[A-Za-z0-9]/.test(s[i - 1]) && (i === 1 || s[i - 2] === ' ')) i -= 1;
  return { en: s.slice(0, i).trim(), zh: s.slice(i).trim() };
}

/** 逐行拆 body,en 行与 zh 行各自 join(空行不产生条目)。 */
export function splitBody(body) {
  const enL = [], zhL = [];
  for (const line of (body ?? '').split('\n')) {
    const { en, zh } = splitLine(line);
    if (en) enL.push(en);
    if (zh) zhL.push(zh);
  }
  return { en: enL.join('\n'), zh: zhL.join('\n') };
}

/** 一个词条(head 单行 + body 多行)→ 四字段。 */
export function splitTerm(head, body) {
  const h = splitLine(head ?? '');
  const b = splitBody(body ?? '');
  return { headEn: h.en, headZh: h.zh, bodyEn: b.en, bodyZh: b.zh };
}
