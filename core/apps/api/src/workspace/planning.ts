/** @module Shared planning persistence, using the workspace transaction and access policy. */
import { z } from 'zod';
import type { QueryRunner } from '../db/connection.js';
import { isPlanningDate, scheduleRange, type Checklist, type Schedule, type WorkspaceBoard } from '@cuberoot/shared/workspace-planning';

const uuid = z.string().uuid();
const version = z.number().int().nonnegative();
const boardInput = z.object({
  id: uuid, projectId: uuid.nullable(), version,
  name: z.string().trim().min(1).max(80), active: z.boolean(),
});
export const checklistInput = boardInput.extend({
  items: z.array(z.object({ id: uuid, text: z.string().trim().min(1).max(160), done: z.boolean(), archived: z.boolean().optional() })).max(200),
}).refine(value => new Set(value.items.map(item => item.id)).size === value.items.length, 'Duplicate item ID');

const date = z.string().refine(isPlanningDate);
export const scheduleInput = boardInput.extend({
  tasks: z.array(z.object({
    id: uuid, group: z.string().trim().min(1).max(60), name: z.string().trim().min(1).max(120),
    owner: z.string().trim().max(60), start: date, end: date,
    kind: z.enum(['task', 'milestone']), progress: z.number().int().min(0).max(100),
  }).refine(task => task.start <= task.end && (task.kind !== 'milestone' || task.start === task.end), 'Invalid task dates')).max(150),
}).refine(value => new Set(value.tasks.map(task => task.id)).size === value.tasks.length, 'Duplicate task ID')
  .refine(value => (scheduleRange(value.tasks)?.days ?? 0) <= 732, 'Schedule exceeds two years');

type PlanningAccess = {
  memberId: number; admin: boolean; manager: boolean;
  projectWrite: (id: string | null) => Promise<void>;
  audit: (action: string, id: string) => Promise<void>;
  fail: (message: string, status: number) => never;
};

export function planningService(q: QueryRunner, access: PlanningAccess) {
  const columns = 'b.id,b.project_id AS "projectId",b.name,b.active,b.version,p.name AS "projectName",p.active AS "projectActive"';
  const readable = access.admin ? 'TRUE' : '(b.project_id IS NULL OR EXISTS(SELECT 1 FROM workspace_project_members pm WHERE pm.project_id=b.project_id AND pm.member_id=?))';
  const params = access.admin ? [] : [access.memberId];
  function pageOptions(search: URLSearchParams) {
    const page = z.number().int().min(1).max(10000).parse(Number(search.get('page') || 1));
    return { page, active: search.get('archived') === 'true' ? '' : ' AND b.active', offset: (page - 1) * 20 };
  }
  async function existing(id: string, table: 'workspace_checklists' | 'workspace_schedules' = 'workspace_checklists') {
    const [row] = await q<WorkspaceBoard>(`SELECT ${columns} FROM ${table} b LEFT JOIN workspace_projects p ON p.id=b.project_id WHERE b.id=? AND ${readable}`, [id, ...params]);
    return row;
  }
  return {
    async schedules(search = new URLSearchParams()) {
      const { page, active, offset } = pageOptions(search);
      const rows = await q<Schedule>(`SELECT ${columns},b.tasks FROM workspace_schedules b LEFT JOIN workspace_projects p ON p.id=b.project_id WHERE ${readable}${active} ORDER BY b.created_at,b.id LIMIT 21 OFFSET ?`, [...params, offset]);
      const id = search.get('id');
      const [selected] = id ? await q<Schedule>(`SELECT ${columns},b.tasks FROM workspace_schedules b LEFT JOIN workspace_projects p ON p.id=b.project_id WHERE b.id=? AND ${readable}${active}`, [uuid.parse(id), ...params]) : [];
      const withAccess = (row: Schedule) => ({ ...row, canEdit: access.manager && row.projectActive !== false });
      return { schedules: rows.slice(0,20).map(withAccess), selected: selected ? withAccess(selected) : null, hasMore: rows.length > 20, page };
    },
    async saveSchedule(input: unknown) {
      if (!access.manager) access.fail('需要负责人权限 / Manager access required', 403);
      const data = scheduleInput.parse(input);
      const old = await existing(data.id, 'workspace_schedules');
      if (!old && data.version !== 0) access.fail('排期不存在或无权访问 / Schedule unavailable', 404);
      if (old && old.projectId !== data.projectId) access.fail('不能更改共享范围 / Scope cannot change', 409);
      if ((old?.version ?? 0) !== data.version) access.fail('排期已更新，请重新加载 / Reload schedule before saving', 409);
      await access.projectWrite(data.projectId);
      const time = Math.floor(Date.now() / 1000);
      if (old) {
        await q('UPDATE workspace_schedules SET name=?,tasks=?,active=?,version=?,updated_at=? WHERE id=?', [data.name,data.tasks,data.active,data.version+1,time,data.id]);
      } else {
        await q('INSERT INTO workspace_schedules(id,project_id,name,tasks,active,version,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)', [data.id,data.projectId,data.name,data.tasks,data.active,time,time]);
      }
      await access.audit('schedule.save', data.id);
      return { id: data.id, version: data.version + 1 };
    },
    async deleteSchedule(input: unknown) {
      if (!access.manager) access.fail('需要负责人权限 / Manager access required', 403);
      const data = z.object({ id: uuid, version }).parse(input);
      const old = await existing(data.id, 'workspace_schedules');
      if (!old) access.fail('排期不存在或无权访问 / Schedule unavailable', 404);
      if (old.version !== data.version) access.fail('排期已更新，请重新加载 / Reload schedule before deleting', 409);
      await access.projectWrite(old.projectId);
      const deleted = await q<{ id: string }>('DELETE FROM workspace_schedules WHERE id=? AND version=? RETURNING id', [data.id, data.version]);
      if (!deleted.length) access.fail('排期已更新，请重新加载 / Reload schedule before deleting', 409);
      await access.audit('schedule.delete', data.id);
      return { id: data.id };
    },
    async checklists(search = new URLSearchParams()) {
      const { page, active, offset } = pageOptions(search);
      const rows = await q<Checklist>(`SELECT ${columns},b.items FROM workspace_checklists b LEFT JOIN workspace_projects p ON p.id=b.project_id WHERE ${readable}${active} ORDER BY b.created_at,b.id LIMIT 21 OFFSET ?`, [...params,offset]);
      return { checklists: rows.slice(0,20).map(row => ({ ...row, canEdit: row.projectActive !== false })), hasMore: rows.length > 20, page, itemArchiveSupported: true };
    },
    async saveChecklist(input: unknown) {
      const data = checklistInput.parse(input);
      const old = await existing(data.id);
      // An inaccessible existing ID must not be overwritten through an upsert.
      if (!old && data.version !== 0) access.fail('清单不存在或无权访问 / Checklist unavailable', 404);
      if (old && old.projectId !== data.projectId) access.fail('不能更改共享范围 / Scope cannot change', 409);
      if ((old?.version ?? 0) !== data.version) access.fail('清单已更新，请重新加载 / Reload checklist before saving', 409);
      await access.projectWrite(data.projectId);
      const time = Math.floor(Date.now() / 1000);
      if (old) {
        await q('UPDATE workspace_checklists SET name=?,items=?,active=?,version=?,updated_at=? WHERE id=?', [data.name,data.items,data.active,data.version+1,time,data.id]);
      } else {
        await q('INSERT INTO workspace_checklists(id,project_id,name,items,active,version,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)', [data.id,data.projectId,data.name,data.items,data.active,time,time]);
      }
      await access.audit('checklist.save', data.id);
      return { id: data.id, version: data.version + 1 };
    },
    async deleteChecklist(input: unknown) {
      const data = z.object({ id: uuid, version }).parse(input);
      const old = await existing(data.id);
      if (!old) access.fail('清单不存在或无权访问 / Checklist unavailable', 404);
      if (old.version !== data.version) access.fail('清单已更新，请重新加载 / Reload checklist before deleting', 409);
      await access.projectWrite(old.projectId);
      const deleted = await q<{ id: string }>('DELETE FROM workspace_checklists WHERE id=? AND version=? RETURNING id', [data.id, data.version]);
      if (!deleted.length) access.fail('清单已更新，请重新加载 / Reload checklist before deleting', 409);
      await access.audit('checklist.delete', data.id);
      return { id: data.id };
    },
  };
}
