import type { StackTool } from '../../stack/_lib/stack_tool_types';

// LLM detail loaders. Explicit map = one chunk per tool (Next has no
// import.meta.glob). Each tool file default-exports a StackTool data object.
const LOADERS: Record<string, () => Promise<{ default: StackTool }>> = {
  'claude': () => import('../_tools/claude'),
  'claude-code': () => import('../_tools/claude-code'),
};

export async function loadLlmTool(slug: string): Promise<StackTool> {
  const l = LOADERS[slug];
  if (!l) throw new Error(`unknown llm tool: ${slug}`);
  const m = await l();
  return m.default;
}
