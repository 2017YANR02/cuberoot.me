import { renderArticleMarkdown } from '@/lib/article-markdown';

/**
 * ArticleBody — server-renderable wrapper around the secure markdown pipeline.
 * Renders untrusted community markdown + directives. Safe inside a React Server Component;
 * the heavy interactive leaves (cubing.js / visualcube) are 'use client' dynamic imports
 * inside ArticleAlgEmbed / ArticleCubeEmbed and only mount where directives appear.
 */
export function ArticleBody({ body }: { body: string }) {
  return <div className="article-content">{renderArticleMarkdown(body)}</div>;
}
