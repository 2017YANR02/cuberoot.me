import { redirect } from 'next/navigation';

// /trainer -> 规范化到带 event code 的默认 hub /trainer/333(三阶).
// 每个项目的 hub 在 [puzzle]/page.tsx(/trainer/222、/trainer/333bf 等).
export default async function TrainerIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`/${lang}/trainer/333`);
}
