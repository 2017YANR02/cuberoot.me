export type RegulationReference = {
  id: string;
  sourceUrl: string;
  aliases?: string[];
  date: string;
  title: { zh: string; en: string };
  html: { zh: string; en: string };
  contentKind: 'summary' | 'translation';
};
