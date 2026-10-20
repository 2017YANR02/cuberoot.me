import { z } from 'zod';
import { ADMIN_WCA_IDS, isAdminWcaId } from '@cuberoot/shared/admin';
import { canReadReport, reportReadScope, canWriteProject, decideReportChange, isWorkDate, isResultUrl, type WorkspaceActor, type ReportState } from '@app-foundation/workspace-policy';
import type { QueryRunner } from '../db/connection.js';

export type Actor = WorkspaceActor & { name: string; memberId?: number };
export type Identity = { uid: number; isAdmin: boolean; name: string };
export type Transaction = <T>(run: (q: QueryRunner) => Promise<T>) => Promise<T>;
export class WorkspaceError extends Error { constructor(message: string, public status = 400) { super(message); } }
const uuid = z.string().uuid();
const positive = z.number().int().positive().safe();
const version = z.number().int().nonnegative();
const name = z.string().trim().min(1).max(60);
const role = z.enum(['member', 'manager']);
const url = z.string().max(2000).refine(isResultUrl, 'HTTPS URL required');
const memberInput = z.object({ userId: positive, name, role, active: z.boolean() });
const projectInput = z.object({ id: uuid, name: z.string().trim().min(1).max(80), url, active: z.boolean(), version, memberIds: z.array(positive).max(500) });
const reportInput = z.object({ id: uuid, projectId: uuid.nullable().default(null), version, workDate: z.string().refine(isWorkDate), status: z.enum(['draft', 'submitted']), visibility: z.enum(['company', 'managers']), progress: z.string().trim().max(5000), resultUrl: url, help: z.string().trim().max(2000), next: z.string().trim().max(2000) });
const commentInput = z.object({ id: uuid, reportId: uuid, body: z.string().trim().min(1).max(2000) });
const now = () => Math.floor(Date.now() / 1000);
const key = (actor: Actor) => `${actor.kind}:${actor.id}`;
export type Report = ReportState & { id: string; name: string; projectName: string | null; projectActive: boolean | null; progress: string; resultUrl: string; help: string; next: string; createdAt: number; updatedAt: number };
const reportColumns = `r.id, r.member_id AS "memberId", r.project_id AS "projectId", r.work_date::text AS "workDate", r.status, r.visibility, r.version, r.payload, r.created_at AS "createdAt", r.updated_at AS "updatedAt", m.name, p.name AS "projectName", p.active AS "projectActive"`;
const reportFrom = 'workspace_reports r JOIN workspace_members m ON m.id=r.member_id LEFT JOIN workspace_projects p ON p.id=r.project_id';
const flatten = (row: Report & { payload: Pick<Report, 'progress'|'resultUrl'|'help'|'next'> }): Report => { const { payload, ...rest } = row; return { ...rest, ...payload }; };

export function createWorkspaceService(query: QueryRunner, transact: Transaction) {
  // Serializes membership changes and writes so revocation cannot race a write.
  async function write<T>(identity: Identity, fn: (q: QueryRunner, actor: Actor) => Promise<T>) {
    return transact(async q => { await q("SELECT pg_advisory_xact_lock(2812026)"); return fn(q, await actor(q, identity)); });
  }
  async function syncAdminMembers(q: QueryRunner) {
    const admins = await q<{id:number}>(`INSERT INTO workspace_members(user_id,name,role,active,admin_access)
      SELECT id,LEFT(COALESCE(NULLIF(display_name,''),id::text),60),'member',FALSE,TRUE
      FROM app_users WHERE (is_admin OR wca_id=ANY(?::text[])) AND merged_into_user_id IS NULL AND NOT forum_banned
      ON CONFLICT(user_id) DO UPDATE SET admin_access=TRUE WHERE NOT workspace_members.admin_access RETURNING id`,[[...ADMIN_WCA_IDS]]);
    const revoked = await q<{id:number}>(`UPDATE workspace_members m SET admin_access=FALSE WHERE admin_access AND NOT EXISTS (
      SELECT 1 FROM app_users u WHERE u.id=m.user_id AND (u.is_admin OR u.wca_id=ANY(?::text[]))
      AND u.merged_into_user_id IS NULL AND NOT u.forum_banned) RETURNING m.id`,[[...ADMIN_WCA_IDS]]);
    for (const [action,rows] of [['member.admin-grant',admins],['member.admin-revoke',revoked]] as const)
      for (const row of rows) await q('INSERT INTO workspace_audit(actor,action,target,created_at) VALUES (?,?,?,?)',['system',action,String(row.id),now()]);
  }
  function employee(a: Actor): Actor & {kind:'staff'} {
    if (a.kind==='staff') return a;
    if (!a.memberId) throw new WorkspaceError('员工权限暂不可用 / Employee access unavailable',403);
    return {kind:'staff',id:a.memberId,role:'manager',name:a.name};
  }
  async function actor(q: QueryRunner, identity: Identity): Promise<Actor> {
    const [user] = await q<{ is_admin: boolean; display_name: string; wca_id: string | null }>('SELECT is_admin, display_name, wca_id FROM app_users WHERE id=? AND merged_into_user_id IS NULL AND NOT forum_banned', [identity.uid]);
    if (!user) throw new WorkspaceError('登录已失效 / Sign in again', 401);
    await syncAdminMembers(q);
    const [member] = await q<{id: number; name: string; role: 'member'|'manager'}>('SELECT id,name,role FROM workspace_members WHERE user_id=? AND (active OR admin_access)', [identity.uid]);
    if (!member) throw new WorkspaceError('请将 CubeRoot ID 交给负责人开通员工权限 / Ask your administrator to enable your CubeRoot ID', 403);
    if (identity.isAdmin && (user.is_admin || isAdminWcaId(user.wca_id))) return { kind: 'admin', role: 'admin', id: identity.uid, name: user.display_name, memberId:member.id };
    return { ...member, kind: 'staff' };
  }
  function admin(a: Actor) { if (a.kind !== 'admin') throw new WorkspaceError('需要管理员权限 / Administrator required', 403); }
  async function audit(q: QueryRunner, a: Actor, action: string, target: string) { await q('INSERT INTO workspace_audit(actor,action,target,created_at) VALUES (?,?,?,?)', [key(a),action,target,now()]); }
  async function scope(q: QueryRunner, a: Actor) {
    const ids = a.kind === 'staff' ? await q<{id: string}>('SELECT project_id AS id FROM workspace_project_members WHERE member_id=?', [a.id]) : [];
    return {...reportReadScope(a, ids.map(p => p.id)),ownMemberId:employee(a).id};
  }
  async function readFilter(q: QueryRunner, a: Actor) {
    const s = await scope(q,a); const params: unknown[] = [];
    const own = s.ownMemberId === null ? '' : (params.push(s.ownMemberId), 'r.member_id=? OR ');
    params.push([...s.submittedVisibilities]);
    let sql = `(${own}(r.status='submitted' AND r.visibility=ANY(?::text[])))`;
    if (s.projectIds !== null) { sql += ' AND (r.project_id IS NULL OR r.project_id=ANY(?::uuid[]))'; params.push([...s.projectIds]); }
    return {sql,params};
  }
  async function projectWrite(q: QueryRunner, a: Actor, id: string | null) {
    if (id === null) return;
    const [p] = await q<{active: boolean; assigned: boolean}>('SELECT p.active, EXISTS(SELECT 1 FROM workspace_project_members pm WHERE pm.project_id=p.id AND pm.member_id=?) AS assigned FROM workspace_projects p WHERE p.id=?', [a.kind === 'staff' ? a.id : -1, id]);
    if (!p || (a.kind === 'admin' ? !p.active : !canWriteProject(a,p))) throw new WorkspaceError('项目已归档或无权写入 / Project unavailable',403);
  }
  async function detail(q: QueryRunner, a: Actor, id: string) {
    uuid.parse(id);
    const filter = await readFilter(q,a);
    const [raw] = await q<Report & {payload: Pick<Report,'progress'|'resultUrl'|'help'|'next'>}>(`SELECT ${reportColumns} FROM ${reportFrom} WHERE r.id=? AND ${filter.sql}`, [id,...filter.params]);
    if (!raw) throw new WorkspaceError('记录不存在或无权访问 / Report unavailable',404);
    const report = flatten(raw);
    if (!canReadReport(await scope(q,a),report)) throw new WorkspaceError('无权访问 / Access denied',404);
    const comments = await q('SELECT id,name,body,created_at AS "createdAt" FROM workspace_comments WHERE report_id=? ORDER BY created_at,id',[id]);
    const revisions = report.memberId===employee(a).id ? await q('SELECT version,created_at AS "createdAt",snapshot FROM workspace_revisions WHERE report_id=? ORDER BY version DESC',[id]) : [];
    return {report,comments,revisions};
  }
  async function directory(q: QueryRunner) { return q('SELECT id,name,(active OR admin_access) AS active FROM workspace_members WHERE user_id IS NOT NULL ORDER BY id'); }
  return {
    async get(identity: Identity, action: string, search: URLSearchParams) {
      return transact(async query => {
      await query("SELECT pg_advisory_xact_lock(2812026)");
      const a = await actor(query,identity);
      switch(action) {
        case 'session': return {actor:a,employee:employee(a),directory:await directory(query)};
        case 'members': admin(a); return {members:await query('SELECT id,user_id::int AS "userId",name,role,(active OR admin_access) AS active,admin_access AS "adminAccess" FROM workspace_members WHERE user_id IS NOT NULL ORDER BY id')};
        case 'projects': {
          const projects = await query<{id:string}>(`SELECT p.id,p.name,p.url,p.active,p.version,p.created_at AS "createdAt" FROM workspace_projects p ${a.kind==='admin'?'':'WHERE EXISTS(SELECT 1 FROM workspace_project_members pm WHERE pm.project_id=p.id AND pm.member_id=?)'} ORDER BY p.name,p.id`,a.kind==='admin'?[]:[a.id]);
          return {projects:await Promise.all(projects.map(async p=>({...p,memberIds:a.kind==='admin'?(await query<{id:number}>('SELECT member_id AS id FROM workspace_project_members WHERE project_id=?',[p.id])).map(m=>m.id):[]})))};
        }
        case 'detail': return detail(query,a,search.get('id')??'');
        case 'reports': {
          const filter=await readFilter(query,a);let clause=filter.sql;const params=filter.params;
          if(search.get('mine')==='true') {clause+=' AND r.member_id=?';params.push(employee(a).id);} else clause+=" AND r.status='submitted'";
          const project=search.get('projectId');if(project){if(project==='unassigned')clause+=' AND r.project_id IS NULL';else{clause+=' AND r.project_id=?';params.push(uuid.parse(project));}}
          const member=search.get('memberId');if(member){clause+=' AND r.member_id=?';params.push(positive.parse(Number(member)));}
          const date=search.get('date');if(date){clause+=' AND r.work_date=?';params.push(z.string().refine(isWorkDate).parse(date));}
          const text=search.get('search');if(text){z.string().max(100).parse(text);clause+=" AND (r.payload->>'progress' ILIKE ? ESCAPE '!' OR r.payload->>'help' ILIKE ? ESCAPE '!' OR r.payload->>'next' ILIKE ? ESCAPE '!')";const escaped='%'+text.replace(/[!%_]/g,'!$&')+'%';params.push(escaped,escaped,escaped);}
          const page=z.number().int().min(1).max(10000).parse(Number(search.get('page')||1));
          const rows=await query<Report & {payload:Pick<Report,'progress'|'resultUrl'|'help'|'next'>}>(`SELECT ${reportColumns} FROM ${reportFrom} WHERE ${clause} ORDER BY r.work_date DESC,r.id DESC LIMIT 21 OFFSET ?`,[...params,(page-1)*20]);
          return {reports:rows.slice(0,20).map(flatten),hasMore:rows.length>20,page};
        }
        default: throw new WorkspaceError('接口不存在 / Not found',404);
      }
      });
    },
    async post(identity: Identity, action: string, input: unknown) {
      return write(identity,async(q,a)=>{
        switch(action){
          case 'member': {
            admin(a);const data=memberInput.parse(input);
            const [user]=await q('SELECT id FROM app_users WHERE id=? AND merged_into_user_id IS NULL AND NOT forum_banned',[data.userId]);if(!user)throw new WorkspaceError('CubeRoot 用户不存在 / User unavailable',404);
            const [saved]=await q<{id:number}>('INSERT INTO workspace_members(user_id,name,role,active) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,active=EXCLUDED.active RETURNING id',[data.userId,data.name,data.role,data.active]);
            await audit(q,a,'member.save',String(saved.id));return {id:saved.id};
          }
          case 'project': {
            admin(a);const d=projectInput.parse(input);const ids=[...new Set(d.memberIds)];
            const [old]=await q<{version:number}>('SELECT version FROM workspace_projects WHERE id=?',[d.id]);if((old?.version??0)!==d.version)throw new WorkspaceError('版本已更新 / Reload project',409);
            if(ids.length){const members=await q('SELECT id FROM workspace_members WHERE id=ANY(?::int[])',[ids]);if(members.length!==ids.length)throw new WorkspaceError('成员不存在 / Member unavailable');}
            await q('INSERT INTO workspace_projects(id,name,url,active,version,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,url=EXCLUDED.url,active=EXCLUDED.active,version=EXCLUDED.version',[d.id,d.name,d.url,d.active,d.version+1,now()]);
            await q('DELETE FROM workspace_project_members WHERE project_id=?',[d.id]);for(const id of ids)await q('INSERT INTO workspace_project_members(project_id,member_id) VALUES (?,?)',[d.id,id]);await audit(q,a,'project.save',d.id);return {id:d.id,version:d.version+1};
          }
          case 'report': {
            const author=employee(a);
            const d=reportInput.parse(input);if(d.status==='submitted'&&!d.progress)throw new WorkspaceError('请填写进展 / Progress required');
            if(d.workDate>new Date(Date.now()+14*3600000).toISOString().slice(0,10))throw new WorkspaceError('日期不能在未来 / Future date');
            const [previous]=await q<ReportState>('SELECT member_id AS "memberId", project_id AS "projectId", work_date::text AS "workDate",status,visibility,version FROM workspace_reports WHERE id=?',[d.id]);
            const decision=decideReportChange(author,previous??null,d);if(decision!=='allow')throw new WorkspaceError(decision,decision==='not-author'?403:409);
            await projectWrite(q,a,d.projectId);
            const payload={progress:d.progress,resultUrl:d.resultUrl,help:d.help,next:d.next};const time=now();
            await q('INSERT INTO workspace_reports(id,member_id,project_id,work_date,status,visibility,version,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,visibility=EXCLUDED.visibility,version=EXCLUDED.version,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at',[d.id,author.id,d.projectId,d.workDate,d.status,d.visibility,d.version+1,payload,time,time]);
            const saved=(await detail(q,a,d.id)).report;
            await q('INSERT INTO workspace_revisions(report_id,version,snapshot,created_at) VALUES (?,?,?,?)',[d.id,saved.version,saved,time]);await audit(q,a,'report.save',d.id);return {id:d.id,version:saved.version};
          }
          case 'comment': {
            const d=commentInput.parse(input);const report=(await detail(q,a,d.reportId)).report;
            if(report.status!=='submitted')throw new WorkspaceError('草稿不能评论 / Drafts cannot receive comments');await projectWrite(q,a,report.projectId);
            const [old]=await q<{report_id:string;actor:string;body:string}>('SELECT report_id,actor,body FROM workspace_comments WHERE id=?',[d.id]);
            if(old){if(old.report_id===d.reportId&&old.actor===key(a)&&old.body===d.body)return{id:d.id};throw new WorkspaceError('评论编号冲突 / Comment conflict',409);}
            const [count]=await q<{n:number}>('SELECT count(*)::int AS n FROM workspace_comments WHERE report_id=?',[d.reportId]);if(count.n>=500)throw new WorkspaceError('评论已达上限 / Comment limit');
            await q('INSERT INTO workspace_comments(id,report_id,actor,name,body,created_at) VALUES (?,?,?,?,?,?)',[d.id,d.reportId,key(a),a.name,d.body,now()]);await audit(q,a,'comment.create',d.id);return{id:d.id};
          }
          default: throw new WorkspaceError('接口不存在 / Not found',404);
        }
      });
    },
  };
}
