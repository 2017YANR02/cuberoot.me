import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';

// Two prerendered sets. /recognize/pll already has its own entry in
// lib/page-meta (it predates this route being dynamic and is listed in the
// sitemap), so this only has to cover the pair uniformly.
const SETS: Record<string, { zh: string; en: string; caseCount: number }> = {
  pll: { zh: 'PLL', en: 'PLL', caseCount: 21 },
  oll: { zh: 'OLL', en: 'OLL', caseCount: 57 },
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
        zh: `${set.zh} 识别训练`,
        en: `${set.en} Recognition Trainer`,
      },
      description: {
        zh: `计时练习 ${set.caseCount} 个 ${set.zh} 情况的识别:只认图形,不还原,统计每个情况的反应时间。`,
        en: `A timed drill for recognising all ${set.caseCount} ${set.en} cases — pattern only, no solving — with per-case reaction times.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
