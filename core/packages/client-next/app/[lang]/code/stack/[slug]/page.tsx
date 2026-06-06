// Server wrapper: prerender every known stack tool at build (SSG) so the route
// is fully static instead of SSR-per-request. The UI is a client shell
// (StackToolClient) that lazy-loads the tool detail in the browser.
// Import the data module directly, NOT the '@cuberoot/shared' barrel — and note
// stack_meta.ts is pure data (no React) so a Server Component can pull it in.
import { STACK_TOOLS_META } from '../_lib/stack_meta';
import StackToolClient from './StackToolClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return STACK_TOOLS_META.map((t) => ({ slug: t.slug }));
}

export default function Page() {
  return <StackToolClient />;
}
