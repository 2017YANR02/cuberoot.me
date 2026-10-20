import { redirect } from 'next/navigation';

export default async function Page({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const { lang } = await params;
  const { section } = await searchParams;
  const query = section === 'sop' || section === 'offboarding' ? `?section=${section}` : '';
  redirect((lang === 'zh' ? '/zh' : '') + '/dev/team' + query);
}
