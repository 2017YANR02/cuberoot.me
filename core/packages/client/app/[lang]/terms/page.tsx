import LegalDocument from '../privacy/LegalDocument';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <LegalDocument kind="terms" lang={lang === 'zh' ? 'zh' : 'en'} />;
}
