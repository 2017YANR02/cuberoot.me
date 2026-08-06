import type { Metadata } from 'next';
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import { metadataFromEntry } from '@/lib/page-meta';
import { eventProseName } from '@/lib/wca-events';

// The 41 alg sets are the library's actual content pages, and every one of them
// showed the same inherited "Algorithms" title — so "3x3 OLL" and "Square-1
// Parity" were indistinguishable in search results. Both the puzzle list and
// the set list are static arrays that this route already prerenders in full, so
// per-set metadata is baked at build and costs nothing at runtime.
//
// This layout also wraps the /run and /select trainer leaves, which is the
// intent: the set is what those pages are about.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; puzzle: string; set: string }>;
}): Promise<Metadata> {
  const { lang, puzzle, set } = await params;
  if (!(ALG_PUZZLES as readonly string[]).includes(puzzle)) return {};
  const meta = ALG_CATALOG[puzzle as AlgPuzzle]?.find((s) => s.slug === set);
  // 'mix' (multi-set practice) and the [subgroup] sentinel land here with no
  // catalog entry; let them inherit rather than name a set that isn't one.
  if (!meta) return {};
  const l: 'zh' | 'en' = lang === 'zh' ? 'zh' : 'en';
  const name = eventProseName(puzzle, l === 'zh') || puzzle;
  return metadataFromEntry(
    {
      title: {
        zh: `${name} ${meta.short ?? meta.zh}公式`,
        en: `${name} ${meta.short ?? meta.en} Algorithms`,
      },
      description: {
        zh: `${name} ${meta.zh} 完整公式表:每个情况配图,给出多套解法与作者,可直接进入练习。`,
        en: `The complete ${meta.en} algorithm set for the ${name}: every case with a diagram, alternative solutions and attribution, plus a built-in trainer.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
