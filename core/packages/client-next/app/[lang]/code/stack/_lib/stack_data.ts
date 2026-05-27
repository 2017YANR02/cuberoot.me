import type { StackTool } from './stack_tool_types';

// Next.js doesn't have import.meta.glob. Explicit map = one chunk per tool.
// Each tool file default-exports a StackTool (data object, not a component),
// so dynamic() isn't appropriate — we use raw dynamic import() and resolve to .default.
const LOADERS: Record<string, () => Promise<{ default: StackTool }>> = {
  'bun': () => import('../_tools/bun'),
  'claude': () => import('../_tools/claude'),
  'claude-code': () => import('../_tools/claude-code'),
  'cloudflare-dns': () => import('../_tools/cloudflare-dns'),
  'cubing-js': () => import('../_tools/cubing-js'),
  'curl': () => import('../_tools/curl'),
  'docker': () => import('../_tools/docker'),
  'git': () => import('../_tools/git'),
  'github': () => import('../_tools/github'),
  'github-actions': () => import('../_tools/github-actions'),
  'hono': () => import('../_tools/hono'),
  'i18next': () => import('../_tools/i18next'),
  'lets-encrypt': () => import('../_tools/lets-encrypt'),
  'monorepo': () => import('../_tools/monorepo'),
  'mysql': () => import('../_tools/mysql'),
  'nginx': () => import('../_tools/nginx'),
  'node': () => import('../_tools/node'),
  'npm': () => import('../_tools/npm'),
  'obsidian': () => import('../_tools/obsidian'),
  'openssh': () => import('../_tools/openssh'),
  'pg-dump': () => import('../_tools/pg-dump'),
  'playwright': () => import('../_tools/playwright'),
  'pm2': () => import('../_tools/pm2'),
  'pnpm': () => import('../_tools/pnpm'),
  'postgresql': () => import('../_tools/postgresql'),
  'react': () => import('../_tools/react'),
  'react-router': () => import('../_tools/react-router'),
  'rsync': () => import('../_tools/rsync'),
  'systemd': () => import('../_tools/systemd'),
  'tailscale': () => import('../_tools/tailscale'),
  'tailwind': () => import('../_tools/tailwind'),
  'three': () => import('../_tools/three'),
  'turbo': () => import('../_tools/turbo'),
  'uv': () => import('../_tools/uv'),
  'vite': () => import('../_tools/vite'),
  'vitest': () => import('../_tools/vitest'),
  'webcodecs': () => import('../_tools/webcodecs'),
  'zustand': () => import('../_tools/zustand'),
};

export async function loadStackTool(slug: string): Promise<StackTool> {
  const l = LOADERS[slug];
  if (!l) throw new Error(`unknown stack tool: ${slug}`);
  const m = await l();
  return m.default;
}
