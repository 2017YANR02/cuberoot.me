import { notFound } from 'next/navigation';

const SUPPORTED = ['en', 'zh'] as const;
type Locale = typeof SUPPORTED[number];

// Phase 3 [lang] migration: routes under app/[lang]/* get URL-driven locale
// (/zh/foo, /en/foo). Root app/layout.tsx owns <html>/<body>, I18nProvider,
// and reads x-lang (set by proxy.ts) → cookie → Accept-Language to pick lang.
//
// NOTE: this layout MUST NOT wrap children in another <I18nProvider>. Nesting
// providers under an async-root layout deadlocks Turbopack dev — RSC
// serializer enters an infinite loop on any nontrivial page (about, math/god,
// etc), pegs CPU, OOMs the system. Audited 2026-05-26.
//
// NOTE: do not add `generateStaticParams` + `dynamicParams = false` here. The
// root layout is dynamic (await cookies/headers), so child SSG conflicts with
// parent dynamic-rendering and pegs Turbopack dev into an infinite recompile
// loop, freezing the dev server. notFound() below handles unknown locales.

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!SUPPORTED.includes(lang as Locale)) notFound();
  return children;
}
