'use client';
import { Suspense, useMemo, useState, type AnchorHTMLAttributes } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import { useRouter } from 'next/navigation';
import { WorkspaceProvider, WorkspaceLoginFrame, ReportEditor, Reports, ReportDetailPanel, Projects, ErrorNotice, Form, Field, useResource, value, RequestError, workspaceText, type StaffActor, type MemberDirectory } from '@app-foundation/workspace-ui';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useAuthStore, useAuthUser } from '@/lib/auth-store';
import { apiUrl } from '@/lib/api-base';
import { authHeaders } from '@/lib/admin-api';
import { sessionFetch } from '@/lib/session-fetch';
import '@app-foundation/workspace-ui/workspace.css';
import '../dev/team/get-started.css';
import './workspace.css';
import Onboarding from '../dev/team/Onboarding';
import Offboarding from '../dev/team/Offboarding';
import Sop from '../dev/team/Sop';
import QualityStandards from '../dev/team/QualityStandards';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Checklists from './Checklists';
import Schedules from './Schedules';
import { WorkspaceButton as Button, WorkspaceDialog, WorkspaceMemberPicker } from './WorkspaceControls';
import { DateInput } from '@/components/DateInput';

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
const sections=['mine','updates','projects','checklists','schedule','members','detail','onboarding','offboarding','sop','quality'] as const;
function Workspace() {
  const lang=useLang();const router=useRouter();
  const host=useMemo(()=>({api,Link,Button,Dialog:WorkspaceDialog,DateInput,MemberPicker:WorkspaceMemberPicker,t:(text:string)=>workspaceText(lang,text),navigate:(href:string)=>router.push(`${lang==='zh'?'/zh':''}${workspaceHref(href)}`)}),[lang,router]);
  return <WorkspaceProvider host={host}><WorkspaceContent /></WorkspaceProvider>;
}
function WorkspaceContent() {
  const t=useT();const user=useAuthUser();
  return user ? <SignedInWorkspace key={user.uid} /> : <WorkspaceLoginFrame brand="CubeRoot"><h1>{t('Workspace','Workspace')}</h1><Button onClick={()=>useAuthStore.getState().login()}>{t('登录 CubeRoot','Sign in to CubeRoot')}</Button></WorkspaceLoginFrame>;
}
function SignedInWorkspace() {
  const t=useT();const [section]=useQueryState('section',parseAsStringEnum([...sections]).withDefault('mine'));
  const [id]=useQueryState('id',parseAsString.withDefault(''));
  const session=useResource<{actor:StaffActor;employee:StaffActor;directory:MemberDirectory}>('session');const actor=session.data?.actor;const employee=session.data?.employee;
  const items=[{key:'mine',label:t('我的工作','My work')},{key:'updates',label:t('团队动态','Team updates')},{key:'projects',label:t('项目','Projects')},{key:'checklists',label:t('清单','Checklists')},{key:'schedule',label:t('总排期','Schedule')},...(actor?.kind==='admin'?[{key:'members',label:t('成员与权限','Members and access')}]:[])];
  const handbookItems = [{ key: 'onboarding', label: t('入职','Onboarding') }, { key: 'sop', label: 'SOP' }, { key: 'quality', label: t('质量标准','Quality standards') }, { key: 'offboarding', label: t('离职','Offboarding') }];
  const handbook = handbookItems.some(item => item.key === section);
  return <main className={handbook ? 'staff-handbook-main' : undefined}>
    <div className="staff-page-heading"><h1>{[...items,...handbookItems].find(i=>i.key===section)?.label??t('工作记录','Work report')}</h1></div>
    {!handbook&&<ErrorNotice error={session.error} retry={session.reload} />}
    {session.error?.status===401&&<Button onClick={()=>useAuthStore.getState().login()}>{t('重新登录','Sign in again')}</Button>}
    {!handbook&&session.loading&&<p role="status"><LoadingIndicator>{t('正在加载…','Loading…')}</LoadingIndicator></p>}
    {handbook&&<div className="staff-start staff-workspace-handbook">{section==='offboarding'?<Offboarding />:section==='sop'?<Sop />:section==='quality'?<QualityStandards />:<Onboarding />}</div>}
    {actor&&<>
      {section==='mine'&&employee&&<MyWork actor={employee} directory={session.data!.directory} />}
      {section==='updates'&&<Reports actor={actor} directory={session.data!.directory} />}
      {section==='projects'&&<Projects actor={actor} directory={session.data!.directory} />}
      {section==='checklists'&&<Checklists />}
      {section==='schedule'&&<Schedules actor={actor} />}
      {section==='detail'&&id&&employee&&<ReportDetailPanel actor={employee} id={id} />}
      {section==='members'&&actor.kind==='admin'&&<Members onSaved={session.reload} />}
    </>}
  </main>;
}
function MyWork({ actor, directory }: { actor: StaffActor; directory: MemberDirectory }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  return <><Reports actor={actor} directory={directory} mine actions={<Button action="add" onClick={() => setEditing(true)}>{t('记录今日进展', 'Record today’s progress')}</Button>} />
    {editing && <WorkspaceDialog wide title={t('记录今日进展', 'Record today’s progress')} onClose={() => setEditing(false)}><ReportEditor /></WorkspaceDialog>}
  </>;
}
type Member={id:number;userId:number;name:string;role:'member'|'manager';active:boolean;adminAccess:boolean};
function Members({onSaved}:{onSaved:()=>void}) {
  const t=useT();const resource=useResource<{members:Member[]}>('members');
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const reload=()=>{resource.reload();onSaved();};
  const form=(member?:Member)=><Form key={member?.id??'new'} submit={async data=>{await api('member',{userId:Number(value(data,'userId')),name:value(data,'name'),role:value(data,'role'),active:value(data,'active')==='true'});setEditing(null);reload();}}>
    <Field width="medium" label={t('CubeRoot ID','CubeRoot ID')}><input name="userId" type="number" min={1} required readOnly={!!member} defaultValue={member?.userId} /></Field>
    <Field label={t('姓名','Name')}><input name="name" maxLength={60} required defaultValue={member?.name} /></Field>
    <Field label={t('角色','Role')}><select name="role" defaultValue={member?.role??'member'}><option value="member">{t('成员','Member')}</option><option value="manager">{t('负责人','Manager')}</option></select></Field>
    <Field label={t('状态','Status')}><select name="active" defaultValue={String(member?.active??true)}><option value="true">{t('启用','Enabled')}</option><option value="false">{t('停用','Disabled')}</option></select></Field>
    <div className="staff-actions staff-form-actions"><Button action="save" type="submit">{member?t('保存','Save'):t('开通','Enable')}</Button></div>
  </Form>;
  const members = resource.data?.members.filter(member => `${member.name} ${member.userId}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <><div className="workspace-toolbar staff-actions"><Field width="medium" label={t('搜索成员','Find a member')}><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('姓名或 CubeRoot ID','Name or CubeRoot ID')} /></Field><div className="staff-toolbar-actions"><Button action="add" onClick={() => setEditing('new')}>{t('开通员工权限','Enable employee access')}</Button></div></div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.loading && <p role="status">{t('正在加载…','Loading…')}</p>}
    {members?.length === 0 && <p className="staff-empty">{t('暂无匹配成员','No matching members')}</p>}
    <div className="staff-feed">{members?.map(member => <article key={member.id} className="workspace-member-row"><div><h2>{member.name}</h2><p className="staff-muted">{t('CubeRoot ID','CubeRoot ID')} · {member.userId}</p></div><span>{member.adminAccess ? t('管理员','Administrator') : member.role === 'manager' ? t('负责人','Manager') : t('成员','Member')}</span><span className="staff-muted">{member.active ? t('已启用','Active') : t('已停用','Inactive')}</span>{member.adminAccess ? <span className="staff-muted">{t('自动开通','Automatic access')}</span> : <Button action="edit" variant="secondary" onClick={() => setEditing(member)}>{t('编辑成员','Edit member')}</Button>}</article>)}</div>
    {editing && <WorkspaceDialog title={editing === 'new' ? t('开通员工权限','Enable employee access') : t('编辑成员','Edit member')} onClose={() => setEditing(null)}>{form(editing === 'new' ? undefined : editing)}</WorkspaceDialog>}
  </>;
}
export default function WorkspacePage(){return <Suspense><Workspace /></Suspense>;}
