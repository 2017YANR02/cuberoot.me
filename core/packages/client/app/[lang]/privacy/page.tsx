import LegalDocument from './LegalDocument';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <LegalDocument kind="privacy" lang={lang === 'zh' ? 'zh' : 'en'} />;
}
