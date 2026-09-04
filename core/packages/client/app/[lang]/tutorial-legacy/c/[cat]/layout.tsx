import type { Metadata } from 'next';
import { metadataFromEntry } from '@/lib/page-meta';
import { fetchTutorialCatalog } from '@/lib/tutorial-seo';
import { categoryLabel } from '../../_data/categories';

// Every /tutorial-legacy/c/<cat> page inherited the same "Cubing Tutorials" title, so
// the 31 category listings were indistinguishable from each other and from the
// hub. The label comes from _data/categories — the same table the index cards
// render — so the tab and the card can never disagree; the post count comes
// from the catalog, and a category with no posts simply omits it.
export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; cat: string }>;
}): Promise<Metadata> {
  const { lang, cat: raw } = await params;
  const cat = decodeURIComponent(raw);
  if (!cat) return {};
  const label = categoryLabel(cat);
  const catalog = await fetchTutorialCatalog();
  const count = catalog.filter((e) => e.category === cat && !e.hidden).length;
  const count_ = count > 0 ? count : null;
  return metadataFromEntry(
    {
      title: {
        zh: `${label.zh}教程`,
        en: `${label.en} tutorials`,
      },
      description: {
        zh: count_
          ? `${label.zh}分类下的 ${count_} 篇魔方教程与公式表,含图解。`
          : `${label.zh}分类下的魔方教程与公式表。`,
        en: count_
          ? `${count_} speedcubing tutorials and algorithm sheets filed under ${label.en}.`
          : `Speedcubing tutorials and algorithm sheets filed under ${label.en}.`,
      },
    },
    lang,
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
