// Keys are glossary headings. Aliases help select an entry; only the entry's
// returned fields can support a definition or citation.
const spellings: ReadonlyArray<[string, readonly string[]]> = [
  ['(...)', ['()', 'parenthesis', 'parentheses', 'round bracket', 'round brackets', '圆括号', '小括号', '括号']],
  ['comm', ['commutator', 'commutators', '交换子', '换位子', '[a,b]']],
  ['conj', ['conjugate', 'conjugates', '共轭', '共轭子', '[a:b]']],
  ['prime', ['prime mark', 'prime marks', 'apostrophe', 'apostrophes', '撇号', '单引号', "'", '′', '’']],
  ['+2', ['plus two seconds', 'plus two', 'plus-two penalty', '加两秒', '加二秒', '加2秒']],
];

export const glossaryText = (text:string) => text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');

function notationText(text:string) {
  return glossaryText(text)
    .replace(/^(?:`([^`]+)`|“([^”]+)”|「([^」]+)」|"([^"]+)")$/u,
      (_match,a,b,c,d)=>(a??b??c??d).trim())
    .replace(/^\(\s*(\.{3})?\s*\)$/, '($1)')
    .replace(/^\[\s*a\s*([,:])\s*b\s*\]$/, '[a$1b]')
    .replace(/^\+\s+2$/, '+2');
}

const keys = new Map(spellings.flatMap(([key, aliases]) => [key,...aliases].map(alias => [notationText(alias),key] as const)));

export function glossaryNotationKey(text:string) {
  const normalized=notationText(text);
  const key=keys.get(normalized);
  if(key)return key;
  // A keyword query can name both the symbol and its use in move notation.
  const words=normalized.split(' ');
  if(words.some(word=>keys.get(word)==='(...)') && words.includes('分组')
    && words.every(word=>keys.get(word)==='(...)' || ['分组','转动','序列','转动序列'].includes(word)))return '(...)';
  // Planners often qualify a term by its domain. Strip only generic move
  // notation qualifiers, never a named system such as Karnaukh or Square-1.
  const bare=normalized
    .replace(/^(?:(?:cube|move|cubing) notation|(?:魔方|转动|公式)(?:记号|符号))\s+/u,'')
    .replace(/\s+(?:(?:in )?(?:(?:cube|move|cubing) )?notation|(?:魔方|转动|公式)(?:记号|符号))$/u,'')
    .replace(/^(parenthes(?:is|es)) brackets?$/,'$1');
  return keys.get(bare);
}

// A comma in a notation template and the sign in +2 are part of the term.
// Preserve bracketed expressions as-is, including unknown concrete algorithms.
export function glossaryListParts(query:string) {
  return (query.match(/(?:\[[^\[\]]*\]|\+(?=\s*2(?:\s|$|[,、/;&+]))|[^,、/;&+])+/gu) ?? [])
    .map(part=>part.trim()).filter(Boolean);
}

/** The grammar is intentionally limited to grouping in ordinary move notation.
 * A question about a specific notation or another use of brackets stays with
 * the planner, which can look up the named notation itself. */
export function glossaryGroupingSubject(item:string):string|undefined {
  const text=glossaryText(item).replace(/[?.!。！？]+$/u,'')
    .replace(/^(?:in|according to|from) (?:the )?(?:(?:site|cuberoot) )?(?:dictionary|glossary),\s*/, '');
  const match=text.match(/^what (?:purpose (?:do|does) (.+?) serve|(?:is|are) (.+?) used for)(?: in (?:cube |move |cubing )?notation)?$/)
    ?? text.match(/^why (?:put|use) (.+?) around (?:a few |some |a sequence of )?(?:moves|turns)$/)
    ?? text.match(/^([^\s]{1,24}?)(?:有什么用途|在(?:魔方)?(?:转动记号|公式记号|转动序列|记号|公式)(?:里|中)起什么作用)$/u);
  const term=match?.[1] ?? match?.[2];
  return term && glossaryNotationKey(term)==='(...)' ? term : undefined;
}

/** Prefetch only explicitly named dictionary subjects. Leave unmatched text
 * (including extra qualifiers and unknown abbreviations) for normal planning. */
export function explicitNotationLookup(question:string):string|undefined {
  const sentence=question.match(/(?:check|consult|search) (?:the )?(?:(?:site|cuberoot) )?(?:glossary|dictionary) for ([^?!。？！;\n]+?)(?:\.(?=\s|$)|[?!。？！;\n]|$)/i);
  if(sentence){
    const names=glossaryListParts(glossaryText(sentence[1])).flatMap(part=>part.split(/\s+and\s+/i));
    if(names.length && names.length<=4 && names.every(name=>glossaryNotationKey(name)))return names.join('、');
  }
  for(const item of question.split(/[?!。？！\n]|\.\s+/u)){
    const term=glossaryGroupingSubject(item);
    if(term)return term;
  }
}

/** A definition with a named source, followed by an independent transformation
 * of quoted text. Extra tasks and references to the first answer need planning. */
export function glossaryWritingRequest(question:string) {
  const parts=question.trim().match(/^([^?!。？！;；\n]+[?？。;；])\s*(.+)$/u);
  if(!parts)return;
  const [,definition,writing]=parts;
  const lookup=definition.match(/^(?:according to|in|from) (?:the )?(?:(?:site|cuberoot) )?(?:dictionary|glossary),\s*what (?:is (.+?)|does (.+?) mean)[?;]$/i)
    ?? definition.match(/^(?:请)?(?:根据|按照|查阅)(?:本站|站内)?(?:词典|辞典|百科)[，,：:\s]*(?:什么是(.+?)|(.+?)(?:是什么|是什么意思|的含义是什么))[？?。；;]$/u);
  const subject=(lookup?.[1] ?? lookup?.[2])?.trim();
  if(!subject)return;
  const quoted=subject.match(/^(?:“([^”]+)”|「([^」]+)」|"([^"]+)")$/u);
  // An initial A can be part of a name such as A Perm. Remove an article
  // only when what remains is a recognized notation alias.
  const bare=subject.replace(/^(?:an? |the )/i,'');
  const term=quoted?.[1] ?? quoted?.[2] ?? quoted?.[3] ?? (glossaryNotationKey(bare)?bare:subject);
  if(term.length>60 || (!/^[\p{L}\d'-]+(?: [\p{L}\d'-]+){0,4}$/u.test(term) && !glossaryNotationKey(term)))return;
  const instruction=writing.replace(/^(?:also |then |please |另外[，,]?|同时[，,]?|请|再)/iu,'').trim();
  // Match exactly one quoted operand. Punctuation inside it belongs to the
  // text being transformed, never to another request.
  const operand=instruction.match(/“[^”\n]{1,400}”|「[^」\n]{1,400}」|"[^"\n]{1,400}"/u);
  if(!operand || !operand[0].slice(1,-1).trim())return;
  const template=instruction.replace(operand[0],'…');
  if(!/^(?:rewrite … (?:as (?:a |one )?(?:polite|formal|short|concise) (?:english |chinese )?(?:request|sentence)|(?:more )?(?:politely|formally|concisely))|translate … (?:into|to) (?:english|chinese)|(?:把|将)\s*…\s*(?:翻译?成(?:英文|英语|中文|汉语)|改写(?:成|为)(?:一句)?(?:更)?(?:礼貌|简短|正式)的?(?:请求|句子)))[.!。！]?$/iu.test(template))return;
  return {term, definition, writing, instruction:template, text:operand[0].slice(1,-1)};
}
