'use client';
import { useMemo, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { RequestError, WorkspaceProvider, workspaceText } from '@app-foundation/workspace-ui';
import AppLink from '@/components/AppLink';
import { DateInput } from '@/components/DateInput';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { useLang } from '@/i18n/tr';
import { authHeaders } from '@/lib/admin-api';
import { apiUrl } from '@/lib/api-base';
import { displayCuberName } from '@/lib/cuber-name-display';
import { sessionFetch } from '@/lib/session-fetch';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';

// Product adapter: only CubeRoot auth headers and CubeRoot API are used here.
async function api<T>(action: string, body?: unknown): Promise<T> {
  const response = await sessionFetch(apiUrl(`/v1/workspace/${action}`), { method: body === undefined ? 'GET' : 'POST', headers: authHeaders(body !== undefined), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000), ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  const data = await response.json().catch(() => ({error:'工作台服务暂不可用 / Workspace unavailable'}));
  if(!response.ok)throw new RequestError(typeof data.error === 'string' ? data.error : 'Workspace unavailable',response.status);
  return data as T;
}
export function workspaceHref(href: string) {
  if(!href.startsWith('/workspace'))return href;
  const parts=href.split('/').filter(Boolean);
  if(parts[1]==='updates' && parts[2])return `/admin/team?section=detail&id=${encodeURIComponent(parts[2])}`;
  return parts[1] ? `/admin/team?section=${encodeURIComponent(parts[1])}` : '/admin/team';
}
function Link({href,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}) { return <AppLink {...props} href={workspaceHref(href)} prefetch={false} />; }
export default function WorkspaceHost({ children }: { children: ReactNode }) {
  const lang = useLang();
  const router = useEntryRouter();
  const host = useMemo(() => ({
    api,
    Link,
    Button,
    Dialog: WorkspaceDialog,
    DateInput,
    formatName: (name: string) => displayCuberName(name, lang === 'zh'),
    t: (text: string) => workspaceText(lang, text),
    navigate: (href: string) => router.push(`${lang === 'zh' ? '/zh' : ''}${workspaceHref(href)}`),
  }), [lang, router]);
  return <WorkspaceProvider host={host}>{children}</WorkspaceProvider>;
}
