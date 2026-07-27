import type { Metadata } from 'next';
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import { metadataFromEntry } from '@/lib/page-meta';
import { eventProseName } from '@/lib/wca-events';

// Case picker that feeds ../run. Same reasoning as the run layout: not sitemap
// content, but it should not share a title with the set page.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; puzzle: string; set: string }>;
}): Promise<Metadata> {
  const { lang, puzzle, set } = await params;
  if (!(ALG_PUZZLES as readonly string[]).includes(puzzle)) return {};
  const l: 'zh' | 'en' = lang === 'zh' ? 'zh' : 'en';
  const name = eventProseName(puzzle, l === 'zh') || puzzle;
  const meta = ALG_CATALOG[puzzle as AlgPuzzle]?.find((s) => s.slug === set);
  const setName = meta ? { zh: meta.zh, en: meta.en }[l] : { zh: '合练', en: 'Mixed' }[l];
  return metadataFromEntry(
    {
      title: {
        zh: `挑选 ${name} ${setName}情况`,
        en: `Pick ${name} ${setName} cases`,
      },
      description: {
        zh: `勾选要练的 ${name} ${setName} 情况,再进入计时练习。`,
        en: `Choose which ${name} ${setName} cases to drill, then start the timed trainer.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
