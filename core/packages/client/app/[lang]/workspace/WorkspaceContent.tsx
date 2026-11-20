'use client';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import PageBackLink from '@/components/PageBackLink';
import { Suspense, useState } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import { WorkspaceLoginFrame, ReportEditor, Reports, ReportDetailPanel, ErrorNotice, Form, Field, useResource, useWorkspace, value, type StaffActor, type MemberDirectory } from '@app-foundation/workspace-ui';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useAuthUser, authActions } from '@/lib/auth-store';
import '@app-foundation/workspace-ui/workspace.css';
import '../dev/team/get-started.css';
import './workspace.css';
import Onboarding from '../dev/team/Onboarding';
import Offboarding from '../dev/team/Offboarding';
import Sop from '../dev/team/Sop';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Checklists from './Checklists';
import Schedules from './Schedules';
import { WorkspaceButton as Button, WorkspaceDialog } from './WorkspaceControls';
import WorkspaceHost from './WorkspaceHost';
import { MemberAccessApprovals } from './MemberAccess';

export { workspaceHref } from './WorkspaceHost';

const Contracts = dynamic(() => import('./Contracts'));
const WorkCalendar = dynamic(() => import('./WorkCalendar'));
const ProjectTasks = dynamic(() => import('./ProjectTasks'));
const Payroll = dynamic(() => import('./Payroll'));

const sections=['mine','updates','checklists','schedule','work-calendar','members','contracts','detail','onboarding','offboarding','sop'] as const;
function WorkspaceContent() {
  const t=useT();const user=useAuthUser();
  return user ? <SignedInWorkspace key={user.uid ?? user.wcaId} /> : <WorkspaceLoginFrame brand="CubeRoot"><h1>{t('Workspace','Workspace')}</h1><Button onClick={()=>authActions.login()}>{t('登录 CubeRoot','Sign in to CubeRoot')}</Button></WorkspaceLoginFrame>;
}
function SignedInWorkspace() {
  const t=useT();const [section,setSection]=useQueryState('section',parseAsString.withDefault('mine'));
  const [id]=useQueryState('id',parseAsString.withDefault(''));
  const [projectRevision, setProjectRevision] = useState(0);
  const session=useResource<{actor:StaffActor;employee:StaffActor;directory:MemberDirectory}>('session');const actor=session.data?.actor;const employee=session.data?.employee;
  if (!(sections as readonly string[]).includes(section)) notFound();
  const items=[{key:'mine',label:t('我的','Mine')},{key:'updates',label:t('动态','Updates')},{key:'checklists',label:t('清单','Checklists')},{key:'contracts',label:t('合同','Contracts')},{key:'schedule',label:t('总排期','Schedule')},...(actor?.kind==='admin'?[{key:'work-calendar',label:t('日历','Calendar')},{key:'members',label:t('成员','Members')}]:[])];
  const lifecycle = section === 'onboarding' || section === 'offboarding';
  const handbookItems = [{ key: 'onboarding', label: t('入/离职','Onboarding / Offboarding') }, { key: 'sop', label: t('开发规范','Development standards') }, { key: 'offboarding', label: t('入/离职','Onboarding / Offboarding') }];
  const handbook = handbookItems.some(item => item.key === section);
  return <main className={handbook ? 'staff-handbook-main' : undefined}>
    <div className="staff-page-heading page-back-heading"><PageBackLink contextOnly /><h1>{[...items,...handbookItems].find(i=>i.key===section)?.label??t('工作记录','Work report')}</h1></div>
    {lifecycle&&<div className="staff-actions workspace-toolbar"><select className="staff-input workspace-toolbar-select" aria-label={t('入/离职','Onboarding / Offboarding')} value={section} onChange={event=>void setSection(event.target.value)}><option value="onboarding">{t('入职','Onboarding')}</option><option value="offboarding">{t('离职','Offboarding')}</option></select><AppLink href="/admin/team?section=contracts" prefetch={false}>{t('合同','Contracts')}</AppLink></div>}
    {!handbook&&<ErrorNotice error={session.error} retry={session.reload} />}
    {!handbook&&session.error?.status===403&&<AppLink href="/admin/team?section=onboarding" prefetch={false}>{t('前往入职页','Go to onboarding')}</AppLink>}
    {session.error?.status===401&&<Button onClick={()=>authActions.login()}>{t('重新登录','Sign in again')}</Button>}
    {!handbook&&session.loading&&<p role="status"><LoadingIndicator>{t('正在加载…','Loading…')}</LoadingIndicator></p>}
    {handbook&&<div className="staff-start staff-workspace-handbook">{section==='offboarding'?<Offboarding />:section==='sop'?<Sop />:<Onboarding />}</div>}
    {actor&&<>
      {section==='mine'&&employee&&<>
        <Payroll projectRevision={projectRevision} />
        <ProjectTasks onAccepted={() => setProjectRevision(revision => revision + 1)} />
        <WorkReports actor={employee} directory={session.data!.directory} mine />
      </>}
      {section==='updates'&&employee&&<WorkReports actor={employee} directory={session.data!.directory} />}
      {section==='contracts'&&<Contracts />}
      {section==='checklists'&&<Checklists />}
      {section==='schedule'&&<Schedules actor={actor} />}
      {section==='work-calendar'&&(actor.kind==='admin'?<WorkCalendar />:<p>{t('需要管理员权限','Administrator access required')}</p>)}
      {section==='detail'&&id&&employee&&<ReportDetailPanel actor={employee} id={id} />}
      {section==='members'&&actor.kind==='admin'&&<Members onSaved={session.reload} />}
    </>}
  </main>;
}
function WorkReports({ actor, directory, mine }: { actor: StaffActor; directory: MemberDirectory; mine?: boolean }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  return <>
    <Reports actor={actor} directory={directory} mine={mine} actions={<Button action="add" onClick={() => setEditing(true)}>{t('记录今日进展', 'Record today’s progress')}</Button>} />
    {editing && <WorkspaceDialog wide title={t('记录今日进展', 'Record today’s progress')} onClose={() => setEditing(false)}><ReportEditor actor={actor} directory={directory} /></WorkspaceDialog>}
  </>;
}
type Member={id:number;userId:number;name:string;role:'member'|'manager';active:boolean;adminAccess:boolean};
function Members({onSaved}:{onSaved:()=>void}) {
  const t=useT();const resource=useResource<{members:Member[]}>('members');
  const {api, formatName = name => name}=useWorkspace();
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
  return <><MemberAccessApprovals onReviewed={reload} /><div className="workspace-toolbar staff-actions"><div className="staff-field staff-field-medium"><input className="staff-input" aria-label={t('搜索成员','Find a member')} value={search} onChange={event => setSearch(event.target.value)} placeholder={t('姓名或 CubeRoot ID','Name or CubeRoot ID')} /></div><div className="staff-toolbar-actions"><Button action="add" onClick={() => setEditing('new')}>{t('开通员工权限','Enable employee access')}</Button></div></div>
    <ErrorNotice error={resource.error} retry={resource.reload} />
    {resource.loading && <p role="status">{t('正在加载…','Loading…')}</p>}
    {members?.length === 0 && <p className="staff-empty">{t('暂无匹配成员','No matching members')}</p>}
    <div className="staff-feed">{members?.map(member => <article key={member.id} className="workspace-member-row"><div><h2>{formatName(member.name)}</h2><p className="staff-muted">{t('CubeRoot ID','CubeRoot ID')} · {member.userId}</p></div><span>{member.adminAccess ? t('管理员','Administrator') : member.role === 'manager' ? t('负责人','Manager') : t('成员','Member')}</span><span className="staff-muted">{member.active ? t('已启用','Active') : t('已停用','Inactive')}</span>{member.adminAccess ? <span className="staff-muted">{t('自动开通','Automatic access')}</span> : <Button action="edit" variant="secondary" className="workspace-member-edit" showTooltip={false} onClick={() => setEditing(member)}>{t('编辑成员','Edit member')}</Button>}</article>)}</div>
    {editing && <WorkspaceDialog title={editing === 'new' ? t('开通员工权限','Enable employee access') : t('编辑成员','Edit member')} onClose={() => setEditing(null)}>{form(editing === 'new' ? undefined : editing)}</WorkspaceDialog>}
  </>;
}
export default function WorkspacePage(){return <Suspense><WorkspaceHost><WorkspaceContent /></WorkspaceHost></Suspense>;}
