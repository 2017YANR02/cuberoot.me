// Server wrapper: prerender every known recognition set at build (SSG) so the
// route is fully static instead of SSR-per-request. The UI is a client shell;
// the four DB-backed sets fetch their cases in the browser, so nothing here is
// per-request.
import RecognizeTrainer from '@/components/RecognizeTrainer';

export const dynamic = 'force-static';
export const dynamicParams = false;

// 手写而不是 import lib/recognize-sets 的清单:那份定义(以及它引的题图参数)整条链都是
// client 模块,拽进 server 图只为拿几个字符串不值。加一套记得同步这里和 layout 的 SETS。
export function generateStaticParams() {
  return ['pll', 'oll', 'coll', 'ell', 'zbll', '1lll'].map((algSetId) => ({ algSetId }));
}

export default async function Page({ params }: {
  params: Promise<{ algSetId: string }>;
}) {
  const { algSetId } = await params;
  return <RecognizeTrainer algSetId={algSetId} />;
}
