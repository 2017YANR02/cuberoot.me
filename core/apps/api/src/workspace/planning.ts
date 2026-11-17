/** @module Shared planning persistence, using the workspace transaction and access policy. */
import { z } from 'zod';
import type { QueryRunner } from '../db/connection.js';
import { isPlanningDate, scheduleRange, type Checklist, type Schedule, type WorkspaceBoard } from '@cuberoot/shared/workspace-planning';

const uuid = z.string().uuid();
const version = z.number().int().nonnegative();
const boardInput = z.object({
  id: uuid, version,
  name: z.string().trim().min(1).max(80), active: z.boolean(),
});
export const checklistInput = boardInput.extend({
  categories: z.array(z.object({ id: uuid, name: z.string().trim().min(1).max(80) })).max(100).optional(),
  items: z.array(z.object({ id: uuid, text: z.string().trim().min(1).max(160), done: z.boolean(), archived: z.boolean().optional(), categoryId: uuid.optional() })).max(200),
}).refine(value => new Set(value.items.map(item => item.id)).size === value.items.length, 'Duplicate item ID')
  .refine(value => new Set(value.categories?.map(category => category.id)).size === (value.categories?.length ?? 0), 'Duplicate category ID')
  .refine(value => value.items.every(item => !item.categoryId || value.categories?.some(category => category.id === item.categoryId)), 'Unknown category');

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
  manager: boolean;
  audit: (action: string, id: string) => Promise<void>;
  fail: (message: string, status: number) => never;
};

export function planningService(q: QueryRunner, access: PlanningAccess) {
  const columns = 'b.id,b.name,b.active,b.version';
  function pageOptions(search: URLSearchParams) {
    const page = z.number().int().min(1).max(10000).parse(Number(search.get('page') || 1));
    return { page, active: search.get('archived') === 'true' ? '' : ' AND b.active', offset: (page - 1) * 20 };
  }
  async function existing(id: string, table: 'workspace_checklists' | 'workspace_schedules' = 'workspace_checklists') {
    const [row] = await q<WorkspaceBoard>(`SELECT ${columns} FROM ${table} b WHERE b.id=?`, [id]);
    return row;
  }
  return {
    async schedules(search = new URLSearchParams()) {
      const { page, active, offset } = pageOptions(search);
      const rows = await q<Schedule>(`SELECT ${columns},b.tasks FROM workspace_schedules b WHERE TRUE${active} ORDER BY b.created_at,b.id LIMIT 21 OFFSET ?`, [offset]);
      const id = search.get('id');
      const [selected] = id ? await q<Schedule>(`SELECT ${columns},b.tasks FROM workspace_schedules b WHERE b.id=?${active}`, [uuid.parse(id)]) : [];
      const withAccess = (row: Schedule) => ({ ...row, canEdit: access.manager });
      return { schedules: rows.slice(0,20).map(withAccess), selected: selected ? withAccess(selected) : null, hasMore: rows.length > 20, page };
    },
    async saveSchedule(input: unknown) {
      if (!access.manager) access.fail('需要负责人权限 / Manager access required', 403);
      const data = scheduleInput.parse(input);
      const old = await existing(data.id, 'workspace_schedules');
      if (!old && data.version !== 0) access.fail('排期不存在或无权访问 / Schedule unavailable', 404);
      if ((old?.version ?? 0) !== data.version) access.fail('排期已更新，请重新加载 / Reload schedule before saving', 409);
      const time = Math.floor(Date.now() / 1000);
      if (old) {
        await q('UPDATE workspace_schedules SET name=?,tasks=?,active=?,version=?,updated_at=? WHERE id=?', [data.name,data.tasks,data.active,data.version+1,time,data.id]);
      } else {
        await q('INSERT INTO workspace_schedules(id,name,tasks,active,version,created_at,updated_at) VALUES (?,?,?,?,1,?,?)', [data.id,data.name,data.tasks,data.active,time,time]);
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
      const deleted = await q<{ id: string }>('DELETE FROM workspace_schedules WHERE id=? AND version=? RETURNING id', [data.id, data.version]);
      if (!deleted.length) access.fail('排期已更新，请重新加载 / Reload schedule before deleting', 409);
      await access.audit('schedule.delete', data.id);
      return { id: data.id };
    },
    async checklists(search = new URLSearchParams()) {
      const { page, active, offset } = pageOptions(search);
      const rows = await q<Checklist>(`SELECT ${columns},b.items,b.categories FROM workspace_checklists b WHERE TRUE${active} ORDER BY b.created_at,b.id LIMIT 21 OFFSET ?`, [offset]);
      return { checklists: rows.slice(0,20).map(row => ({ ...row, canEdit: true })), hasMore: rows.length > 20, page, itemArchiveSupported: true };
    },
    async saveChecklist(input: unknown) {
      const data = checklistInput.parse(input);
      const [old] = await q<Checklist>(`SELECT ${columns},b.items,b.categories FROM workspace_checklists b WHERE b.id=?`, [data.id]);
      if (old?.categories?.length && data.categories === undefined) access.fail('请刷新页面后编辑分类 / Reload before editing categories', 409);
      // A deleted record must not be recreated by a stale save.
      if (!old && data.version !== 0) access.fail('清单不存在或无权访问 / Checklist unavailable', 404);
      if ((old?.version ?? 0) !== data.version) access.fail('清单已更新，请重新加载 / Reload checklist before saving', 409);
      const time = Math.floor(Date.now() / 1000);
      if (old) {
        await q('UPDATE workspace_checklists SET name=?,items=?,categories=?,active=?,version=?,updated_at=? WHERE id=?', [data.name,data.items,data.categories ?? [],data.active,data.version+1,time,data.id]);
      } else {
        await q('INSERT INTO workspace_checklists(id,name,items,categories,active,version,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)', [data.id,data.name,data.items,data.categories ?? [],data.active,time,time]);
      }
      await access.audit('checklist.save', data.id);
      return { id: data.id, version: data.version + 1 };
    },
    async moveChecklistItems(input: unknown) {
      const data = z.object({
        id: uuid, version, targetId: uuid, targetVersion: version,
        itemIds: z.array(uuid).min(1).max(200), categoryId: uuid.optional(),
      }).parse(input);
      const rows = await q<Checklist>(`SELECT ${columns},b.items,b.categories FROM workspace_checklists b WHERE b.id IN (?,?) ORDER BY b.id FOR UPDATE`, [data.id, data.targetId]);
      const source = rows.find(row => row.id === data.id);
      const target = rows.find(row => row.id === data.targetId);
      if (!source || !target) return access.fail('清单不存在 / Checklist unavailable', 404);
      if (!source.active || !target.active) access.fail('请先恢复已归档的清单 / Restore archived checklists first', 409);
      if (source.version !== data.version || target.version !== data.targetVersion) access.fail('清单已更新，请重新加载 / Reload checklists before moving', 409);
      if (data.categoryId && !target.categories?.some(category => category.id === data.categoryId)) access.fail('分类不存在 / Category unavailable', 400);
      const ids = new Set(data.itemIds);
      const moving = source.items.filter(item => ids.has(item.id)).map(item => ({ ...item, categoryId: data.categoryId }));
      if (ids.size !== data.itemIds.length || moving.length !== ids.size) access.fail('事项不存在 / Task unavailable', 400);
      if (source.id !== target.id && (target.items.length + moving.length > 200 || target.items.some(item => ids.has(item.id)))) access.fail('目标清单已满或存在相同事项 / Target is full or contains duplicate tasks', 400);
      const changed = source.id === target.id
        ? [{ ...source, items: source.items.map(item => ids.has(item.id) ? { ...item, categoryId: data.categoryId } : item) }]
        : [{ ...source, items: source.items.filter(item => !ids.has(item.id)) }, { ...target, items: [...target.items, ...moving] }];
      // Called inside the workspace write transaction: either both lists change or neither does.
      for (const row of changed) {
        await q('UPDATE workspace_checklists SET items=?,version=?,updated_at=? WHERE id=?', [row.items,row.version+1,Math.floor(Date.now()/1000),row.id]);
        row.version++;
        row.canEdit = true;
        await access.audit('checklist.move', row.id);
      }
      return { checklists: changed };
    },
    async deleteChecklist(input: unknown) {
      const data = z.object({ id: uuid, version }).parse(input);
      const old = await existing(data.id);
      if (!old) access.fail('清单不存在或无权访问 / Checklist unavailable', 404);
      if (old.version !== data.version) access.fail('清单已更新，请重新加载 / Reload checklist before deleting', 409);
      const deleted = await q<{ id: string }>('DELETE FROM workspace_checklists WHERE id=? AND version=? RETURNING id', [data.id, data.version]);
      if (!deleted.length) access.fail('清单已更新，请重新加载 / Reload checklist before deleting', 409);
      await access.audit('checklist.delete', data.id);
      return { id: data.id };
    },
  };
}
