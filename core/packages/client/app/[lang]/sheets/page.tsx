import { redirect } from 'next/navigation';

export default async function LegacySpreadsheetsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`${lang === 'zh' ? '/zh' : ''}/docs`);
}
