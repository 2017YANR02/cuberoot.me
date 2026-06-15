// Server wrapper: prerender every LLM tool at build (SSG). The UI is the shared
// client shell (CodeToolIntroClient) keyed to the 'llm' section.
import { LLM_TOOLS_META } from '../_lib/llm_meta';
import CodeToolIntroClient from '../../_shared/CodeToolIntroClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return LLM_TOOLS_META.map((t) => ({ slug: t.slug }));
}

export default function Page() {
  return <CodeToolIntroClient section="llm" />;
}
