// /article/person/[wcaId] — 某人的已发布文章。
// 与 /article/author/[wcaId] 同义,复用同一 client(命名对齐 /person、/recon/person、/wca/persons)。
import ArticleAuthorClient from '../../author/[wcaId]/ArticleAuthorClient';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <ArticleAuthorClient />;
}
