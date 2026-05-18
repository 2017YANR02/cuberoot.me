export * from './stack_tool_types';
import type { StackTool } from './stack_tool_types';

import { REACT } from './stack_tools/react';
import { VITE } from './stack_tools/vite';
import { HONO } from './stack_tools/hono';
import { NODE } from './stack_tools/node';
import { PM2 } from './stack_tools/pm2';
import { POSTGRES } from './stack_tools/postgresql';
import { PG_DUMP } from './stack_tools/pg-dump';
import { NGINX } from './stack_tools/nginx';
import { CLOUDFLARE_DNS } from './stack_tools/cloudflare-dns';
import { LETSENCRYPT } from './stack_tools/lets-encrypt';

export const STACK_TOOLS: StackTool[] = [
  REACT,
  VITE,
  HONO,
  NODE,
  PM2,
  POSTGRES,
  PG_DUMP,
  NGINX,
  CLOUDFLARE_DNS,
  LETSENCRYPT,
];
