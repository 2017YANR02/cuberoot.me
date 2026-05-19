export * from './stack_tool_types';
export { STACK_TOOLS_META, type StackToolMeta } from './stack_meta';

import type { StackTool } from './stack_tool_types';

// Vite scans this glob at build and emits one chunk per tool file.
// `/code/stack/<slug>` only downloads its own ~10KB chunk + the shell.
const detailLoaders = import.meta.glob<{ default: StackTool }>('./stack_tools/*.tsx');

export function loadStackTool(slug: string): Promise<StackTool> {
  const loader = detailLoaders[`./stack_tools/${slug}.tsx`];
  if (!loader) return Promise.reject(new Error(`unknown stack tool: ${slug}`));
  return loader().then((m) => m.default);
}
