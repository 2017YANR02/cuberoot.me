type PostTitle = { zh: string; en: string };

const committees = [
  ['WIC', '(?:廉政|诚信)委员会', 'Integrity Committee'],
  ['WRC', '规则委员会', 'Regulations Committee'],
  ['WFC', '财务委员会', '(?:Financial|Finance) Committee'],
  ['WQAC', '质量保证委员会', 'Quality Assurance Committee'],
  ['WDC', '纪律委员会', 'Disciplinary Committee'],
  ['WEC', '道德委员会', 'Ethics Committee'],
  ['WDPC', '数据保护委员会', 'Data Protection Committee'],
] as const;

function shortenCommittee(title: PostTitle, acronym: string, zh: string, en: string): PostTitle {
  return {
    zh: title.zh.replace(new RegExp(`(?:WCA\\s*)?${zh}(?:\\s*[（(]${acronym}[）)])?`, 'g'),
      (name: string, offset: number, text: string) => {
        const spaceBefore = /\p{Script=Han}/u.test(text.charAt(offset - 1)) ? ' ' : '';
        const spaceAfter = /\p{Script=Han}/u.test(text.charAt(offset + name.length)) ? ' ' : '';
        return spaceBefore + acronym + spaceAfter;
      }),
    en: title.en.replace(new RegExp(`\\b(?:WCA\\s+)?${en}\\b(?:\\s+\\(${acronym}\\))?`, 'gi'), acronym),
  };
}

/** Format only the site's display title. The versioned titles remain in the source ledgers. */
export function shortenWcaPostTitle(title: PostTitle, sourceText: string): PostTitle {
  const shortened = committees.reduce(
    (current, [acronym, zh, en]) => shortenCommittee(current, acronym, zh, en), title,
  );
  // The Appeals Committee has used both acronyms. Prefer the one already in the source title.
  const acronym = (
    title.en.match(/\b(WAC|WAPC)\b/) ??
    sourceText.match(/\bAppeals? Committee\s*\((WAC|WAPC)\)/i)
  )?.[1]?.toUpperCase();
  return acronym ? shortenCommittee(shortened, acronym, '申诉委员会', 'Appeals? Committee') : shortened;
}
