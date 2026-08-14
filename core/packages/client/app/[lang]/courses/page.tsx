import TeachingClient from './TeachingClient';

export default async function TeachingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <TeachingClient lang={lang} />;
}
