import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';

// Dynamic recognition sets derive metadata from the set id so every
// prerendered trainer gets a specific title and description.
const SETS: Record<string, { zh: string; en: string; caseCount: number }> = {
  pll: { zh: 'PLL', en: 'PLL', caseCount: 21 },
  oll: { zh: 'OLL', en: 'OLL', caseCount: 57 },
  coll: { zh: 'COLL', en: 'COLL', caseCount: 40 },
  ell: { zh: 'ELL', en: 'ELL', caseCount: 25 },
  zbll: { zh: 'ZBLL', en: 'ZBLL', caseCount: 472 },
  '1lll': { zh: '1LLL', en: '1LLL', caseCount: 3397 },
};

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; algSetId: string }>;
}): Promise<Metadata> {
  const { lang, algSetId } = await params;
  const set = SETS[algSetId];
  if (!set) return {};
  return metadataFromEntry(
    {
      title: {
        zh: `${set.zh} 观察`,
        en: `${set.en} Recognition Trainer`,
      },
      description: {
        zh: `计时练习 ${set.caseCount} 个 ${set.zh} 情况的观察:只认图形,不还原,统计每个情况的反应时间。`,
        en: `A timed drill for recognising all ${set.caseCount} ${set.en} cases — pattern only, no solving — with per-case reaction times.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
