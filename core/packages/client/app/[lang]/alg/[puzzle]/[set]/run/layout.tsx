import type { Metadata } from 'next';
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import { metadataFromEntry } from '@/lib/page-meta';
import { eventProseName } from '@/lib/wca-events';

// Without this, the trainer inherits the set page's title verbatim and two
// different pages compete under one name. It is deliberately absent from the
// sitemap — an interactive drill, not content — but it still needs to say what
// it is when someone lands on it or bookmarks it.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; puzzle: string; set: string }>;
}): Promise<Metadata> {
  const { lang, puzzle, set } = await params;
  if (!(ALG_PUZZLES as readonly string[]).includes(puzzle)) return {};
  const l: 'zh' | 'en' = lang === 'zh' ? 'zh' : 'en';
  const name = eventProseName(puzzle, l === 'zh') || puzzle;
  const meta = ALG_CATALOG[puzzle as AlgPuzzle]?.find((s) => s.slug === set);
  // 'mix' is the multi-set practice sentinel: the actual sets come from ?sets=,
  // so the server cannot name them.
  const setName = meta ? { zh: meta.zh, en: meta.en }[l] : { zh: '合练', en: 'Mixed' }[l];
  return metadataFromEntry(
    {
      title: {
        zh: `${name}训练`,
        en: `${name} Trainer`,
      },
      description: {
        zh: `逐个情况抽题计时,练 ${name} ${setName},并记录每个情况的用时。`,
        en: `A timed drill over ${name} ${setName} cases, recording your time on each one.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
