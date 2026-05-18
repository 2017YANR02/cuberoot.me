export * from './stack_tool_types';
import type { StackTool } from './stack_tool_types';

import { REACT } from './stack_tools/react';
import { REACT_ROUTER } from './stack_tools/react-router';
import { VITE } from './stack_tools/vite';
import { THREE } from './stack_tools/three';
import { CUBING_JS } from './stack_tools/cubing-js';
import { WEBCODECS } from './stack_tools/webcodecs';
import { TAILWIND } from './stack_tools/tailwind';
import { I18NEXT } from './stack_tools/i18next';
import { ZUSTAND } from './stack_tools/zustand';
import { HONO } from './stack_tools/hono';
import { NODE } from './stack_tools/node';
import { PM2 } from './stack_tools/pm2';
import { POSTGRES } from './stack_tools/postgresql';
import { PG_DUMP } from './stack_tools/pg-dump';
import { MYSQL } from './stack_tools/mysql';
import { DOCKER } from './stack_tools/docker';
import { SYSTEMD } from './stack_tools/systemd';
import { NGINX } from './stack_tools/nginx';
import { CLOUDFLARE_DNS } from './stack_tools/cloudflare-dns';
import { LETSENCRYPT } from './stack_tools/lets-encrypt';
import { GIT } from './stack_tools/git';
import { CLAUDE } from './stack_tools/claude';
import { CLAUDE_CODE } from './stack_tools/claude-code';
import { PNPM } from './stack_tools/pnpm';
import { TURBO } from './stack_tools/turbo';
import { MONOREPO } from './stack_tools/monorepo';
import { NPM } from './stack_tools/npm';
import { BUN } from './stack_tools/bun';
import { UV } from './stack_tools/uv';
import { GITHUB_ACTIONS } from './stack_tools/github-actions';
import { PLAYWRIGHT } from './stack_tools/playwright';
import { VITEST } from './stack_tools/vitest';
import { TAILSCALE } from './stack_tools/tailscale';
import { OPENSSH } from './stack_tools/openssh';
import { RSYNC } from './stack_tools/rsync';
import { OBSIDIAN } from './stack_tools/obsidian';

export const STACK_TOOLS: StackTool[] = [
  REACT,
  REACT_ROUTER,
  VITE,
  THREE,
  CUBING_JS,
  WEBCODECS,
  TAILWIND,
  I18NEXT,
  ZUSTAND,
  HONO,
  NODE,
  PM2,
  POSTGRES,
  PG_DUMP,
  MYSQL,
  DOCKER,
  SYSTEMD,
  NGINX,
  CLOUDFLARE_DNS,
  LETSENCRYPT,
  GIT,
  CLAUDE,
  CLAUDE_CODE,
  PNPM,
  TURBO,
  MONOREPO,
  NPM,
  BUN,
  UV,
  GITHUB_ACTIONS,
  PLAYWRIGHT,
  VITEST,
  TAILSCALE,
  OPENSSH,
  RSYNC,
  OBSIDIAN,
];
