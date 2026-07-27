import type { Metadata } from 'next';
import { STACK_TOOLS_META } from '../_lib/stack_meta';
import { metadataFromEntry } from '@/lib/page-meta';

// One page per tool in the stack, all prerendered from a static array. Name and
// tagline come from the same record the landing card renders.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const tool = STACK_TOOLS_META.find((t) => t.slug === slug);
  if (!tool) return {};
  return metadataFromEntry(
    {
      title: {
        zh: `${tool.name}:本站怎么用它`,
        en: `${tool.name}: how this site uses it`,
      },
      description: {
        zh: `${tool.zh.tagline}。${tool.zh.role}`,
        en: `${tool.en.tagline}. ${tool.en.role}`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
