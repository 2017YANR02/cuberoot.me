'use client';
import { Suspense, useMemo, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { useRouter } from 'next/navigation';
import { WorkspaceProvider, WorkspaceShell, WorkspaceLoginFrame, ReportEditor, Reports, ReportDetailPanel, Projects, ErrorNotice, Form, Field, useResource, value, RequestError, workspaceText, type StaffActor, type MemberDirectory } from '@app-foundation/workspace-ui';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { apiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import '@app-foundation/workspace-ui/workspace.css';
import './workspace.css';

// Product adapter: only CubeRoot auth headers and CubeRoot API are used here.
async function api<T>(action: string, body?: unknown): Promise<T> {
  const response = await sessionFetch(apiUrl(`/v1/workspace/${action}`), { method: body === undefined ? 'GET' : 'POST', headers: authHeaders(body !== undefined), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000), ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  const data = await response.json().catch(() => ({error:'工作台服务暂不可用 / Workspace unavailable'}));
  if(!response.ok)throw new RequestError(typeof data.error === 'string' ? data.error : 'Workspace unavailable',response.status);
  return data as T;
}
function workspaceHref(href: string) {
  if(!href.startsWith('/workspace'))return href;
  const parts=href.split('/').filter(Boolean);
  if(parts[1]==='updates' && parts[2])return `/workspace?section=detail&id=${encodeURIComponent(parts[2])}`;
  return parts[1] ? `/workspace?section=${encodeURIComponent(parts[1])}` : '/workspace';
}
function Link({href,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string}) { return <AppLink {...props} href={workspaceHref(href)} prefetch={false} />; }
function Button({variant,size,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'secondary';size?:'sm'}) { return <button type="button" {...props} className={`btn ${variant==='secondary'?'btn-secondary':'btn-primary'} ${props.className??''}`} data-size={size} />; }
const sections=['mine','updates','projects','members','detail'] as const;
function Workspace() {
  const lang=useLang();const router=useRouter();
  const host=useMemo(()=>({api,Link,Button,t:(text:string)=>workspaceText(lang,text),navigate:(href:string)=>router.push(`${lang==='zh'?'/zh':''}${workspaceHref(href)}`)}),[lang,router]);
  return <WorkspaceProvider host={host}><WorkspaceContent /></WorkspaceProvider>;
}
function WorkspaceContent() {
  const t=useT();const user=useAuthUser();
  return user ? <SignedInWorkspace key={user.uid} /> : <WorkspaceLoginFrame brand="CubeRoot"><h1>{t('工作台','Workspace')}</h1><Button onClick={()=>useAuthStore.getState().login()}>{t('登录 CubeRoot','Sign in to CubeRoot')}</Button></WorkspaceLoginFrame>;
}
function SignedInWorkspace() {
  const t=useT();const [section]=useQueryState('section',parseAsStringEnum([...sections]).withDefault('mine'));
  const [id]=useQueryState('id',parseAsString.withDefault(''));
  const session=useResource<{actor:StaffActor;employee:StaffActor;directory:MemberDirectory}>('session');const actor=session.data?.actor;const employee=session.data?.employee;
  const items=[{key:'mine',label:t('我的工作','My work')},{key:'updates',label:t('团队动态','Team updates')},{key:'projects',label:t('项目','Projects')},...(actor?.kind==='admin'?[{key:'members',label:t('成员与权限','Members and access')}]:[])];
  return <WorkspaceShell brand="CubeRoot" title={items.find(i=>i.key===section)?.label??t('工作记录','Work report')} actions={<AppLink href="/account" prefetch={false}>{actor?.name??t('我的账号','My account')}</AppLink>} navigation={<>{items.map(item=><AppLink key={item.key} href={`/workspace?section=${item.key}`} aria-current={section===item.key?'page':undefined} prefetch={false}>{item.label}</AppLink>)}<AppLink href="/dev/team" prefetch={false}>{t('团队手册','Team handbook')}</AppLink></>}>
    <ErrorNotice error={session.error} retry={session.reload} />
    {session.error?.status===401&&<Button onClick={()=>useAuthStore.getState().login()}>{t('重新登录','Sign in again')}</Button>}
    {session.loading&&<p role="status">{t('正在加载…','Loading…')}</p>}
    {actor&&<>
      {section==='mine'&&employee&&<><ReportEditor /><Reports actor={employee} directory={session.data!.directory} mine /></>}
      {section==='updates'&&<Reports actor={actor} directory={session.data!.directory} />}
      {section==='projects'&&<Projects actor={actor} directory={session.data!.directory} />}
      {section==='detail'&&id&&employee&&<ReportDetailPanel actor={employee} id={id} />}
      {section==='members'&&actor.kind==='admin'&&<Members onSaved={session.reload} />}
    </>}
  </WorkspaceShell>;
}
type Member={id:number;userId:number;name:string;role:'member'|'manager';active:boolean;adminAccess:boolean};
function Members({onSaved}:{onSaved:()=>void}) {
  const t=useT();const resource=useResource<{members:Member[]}>('members');
  const reload=()=>{resource.reload();onSaved();};
  const form=(member?:Member)=><Form key={member?.id??'new'} submit={async data=>{await api('member',{userId:Number(value(data,'userId')),name:value(data,'name'),role:value(data,'role'),active:value(data,'active')==='true'});reload();}}>
    <Field label={t('CubeRoot ID','CubeRoot ID')}><input name="userId" type="number" min={1} required readOnly={!!member} defaultValue={member?.userId} /></Field>
    <Field label={t('姓名','Name')}><input name="name" maxLength={60} required defaultValue={member?.name} /></Field>
    <Field label={t('角色','Role')}><select name="role" defaultValue={member?.role??'member'}><option value="member">{t('成员','Member')}</option><option value="manager">{t('负责人','Manager')}</option></select></Field>
    <Field label={t('状态','Status')}><select name="active" defaultValue={String(member?.active??true)}><option value="true">{t('启用','Enabled')}</option><option value="false">{t('停用','Disabled')}</option></select></Field>
    <Button type="submit">{member?t('保存','Save'):t('开通','Enable')}</Button>
  </Form>;
  return <><ErrorNotice error={resource.error} retry={resource.reload} /><section className="staff-panel"><h2>{t('开通员工权限','Enable employee access')}</h2>{form()}</section>{resource.data?.members.map(m=><section key={m.id} className="staff-panel"><h2>{m.name}</h2>{m.adminAccess?<p>{t('管理员 · 已自动开通','Administrator · Enabled automatically')}</p>:form(m)}</section>)}</>;
}
export default function WorkspacePage(){return <Suspense><Workspace /></Suspense>;}
