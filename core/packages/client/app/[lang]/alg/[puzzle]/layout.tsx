import type { Metadata } from 'next';
import { ALG_CATALOG, ALG_PUZZLES, type AlgPuzzle } from '@cuberoot/shared/alg';
import { metadataFromEntry } from '@/lib/page-meta';
import { eventProseName } from '@/lib/wca-events';

// The eight puzzle hubs all inherited /alg's title, so "2x2 algorithms" and
// "Megaminx algorithms" were the same result in search. Unlike most dynamic
// routes here this one costs nothing to fix: ALG_PUZZLES is a static array and
// the page already prerenders every value, so the metadata is baked at build.
//
// The puzzle name comes from eventProseName, not the eventDisplayName the
// heading uses: that one is the compact chip label ('Mega', '3×3'), which is
// the wrong register for a title and for search — see the PROSE_EN note in
// lib/wca-events. Literal strings are picked by indexing a { zh, en } object,
// never an inline ternary: tr() is client-only and can't run in a server layout.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; puzzle: string }>;
}): Promise<Metadata> {
  const { lang, puzzle } = await params;
  // Legacy slugs redirect client-side; let those inherit rather than title a
  // URL that is about to bounce.
  if (!(ALG_PUZZLES as readonly string[]).includes(puzzle)) return {};
  const l: 'zh' | 'en' = lang === 'zh' ? 'zh' : 'en';
  const isZh = l === 'zh';
  const name = eventProseName(puzzle, isZh) || puzzle;
  const sets = ALG_CATALOG[puzzle as AlgPuzzle] ?? [];
  // Name the first few sets: "OLL, PLL, F2L" is what people actually search for,
  // and it is the difference between eight identical descriptions and eight
  // useful ones.
  const namedZh = sets.slice(0, 4).map((s) => s.zh).join('、');
  const namedEn = sets.slice(0, 4).map((s) => s.en).join(', ');
  const n = sets.length;
  return metadataFromEntry(
    {
      title: {
        zh: `${name}公式`,
        en: `${name} Algorithms`,
      },
      description: {
        zh: n
          ? `${name}公式库:${n} 套公式${namedZh ? `,含 ${namedZh}` : ''}。每个情况配图,可切换多种解法并进入练习。`
          : `${name}公式库,每个情况配图并可进入练习。`,
        en: n
          ? `${name} algorithm library: ${n} sets${namedEn ? ` including ${namedEn}` : ''}. Every case has a diagram, alternative solutions and a trainer.`
          : `${name} algorithm library, with a diagram and a trainer for every case.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
