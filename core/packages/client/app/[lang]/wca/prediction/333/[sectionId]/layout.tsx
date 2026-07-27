import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import { SECTIONS } from '../../_data/sections';

// 25 sections of one long essay, one URL each, all previously sharing the
// parent's title. The list is a static array (now in _data/sections so this
// server file and the client view read the same one), so naming them is free.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; sectionId: string }>;
}): Promise<Metadata> {
  const { lang, sectionId } = await params;
  const i = SECTIONS.findIndex((s) => s.id === sectionId);
  // Unknown section falls back to the essay's first section; let it inherit.
  if (i === -1) return {};
  const s = SECTIONS[i];
  return metadataFromEntry(
    {
      title: {
        zh: `${s.labelZh}:3x3 极限预测`,
        // Colon, not an em-dash: metadataFromEntry appends " — CubeRoot".
        en: `${s.labelEn}: how fast can 3x3 get?`,
      },
      description: {
        zh: `${s.labelZh} —— 「三阶还能多快」长文第 ${i + 1}/${SECTIONS.length} 节,含数据与图表。`,
        en: `${s.labelEn} — section ${i + 1} of ${SECTIONS.length} in a data-driven look at how fast the 3x3 can ultimately be solved.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
