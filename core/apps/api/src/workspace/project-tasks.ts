import { z } from 'zod';
import { PROJECT_MAX_CENTS, isPlanningDate, type ProjectAssignee, type ProjectTask, type ProjectTaskList } from '@cuberoot/shared/workspace-planning';
import type { QueryRunner } from '../db/connection.js';
import { activeRecipients } from './project-recipient.js';

const reference = z.strictObject({ id: z.uuid(), version: z.number().int().min(0).max(2_147_483_646) });
const termsInput = reference.extend({
  userId: z.number().int().positive().safe(),
  title: z.string().trim().min(1).max(120),
  dueDate: z.string().refine(isPlanningDate),
  criteria: z.string().trim().min(1).max(3000),
  amountCents: z.number().int().min(1).max(PROJECT_MAX_CENTS),
  bonusCents: z.number().int().min(0).max(PROJECT_MAX_CENTS),
});
const transitions = {
  agree: { from: 'proposed', to: 'in_progress', by: 'employee' },
  submit: { from: 'in_progress', to: 'submitted', by: 'employee' },
  return: { from: 'submitted', to: 'in_progress', by: 'superAdmin' },
  accept: { from: 'submitted', to: 'accepted', by: 'superAdmin' },
} as const;
const transitionInput = reference.extend({ decision: z.enum(['agree', 'submit', 'return', 'accept']) });
const columns = `p.id,p.user_id::int AS "userId",p.title,p.due_date::text AS "dueDate",p.criteria,
  p.amount_cents AS "amountCents",p.bonus_cents AS "bonusCents",p.status,p.version`;

export function projectTasksService(q: QueryRunner, access: {
  userId: number;
  canManage: boolean;
  audit: (action: string, target: string) => Promise<void>;
  fail: (message: string, status: number) => never;
}) {
  const { userId, canManage, audit, fail } = access;
  const unavailable = () => fail('项目任务不存在或无权访问 / Project task unavailable', 404);
  const stale = () => fail('项目任务已更新，请刷新后重试 / Reload the project task and retry', 409);
  async function current(id: string, version: number) {
    const [task] = await q<Omit<ProjectTask, 'assignee'>>(
      `SELECT ${columns} FROM workspace_project_tasks p WHERE p.id=? AND (p.user_id=? OR ?) FOR UPDATE`,
      [id, userId, canManage],
    );
    if (!task) return unavailable();
    if (task.version !== version) return stale();
    return task;
  }
  return {
    async list(search: URLSearchParams): Promise<ProjectTaskList> {
      const page = z.number().int().min(1).max(10000).parse(Number(search.get('page') || 1));
      const tasks = await q<ProjectTask>(`SELECT ${columns},COALESCE(NULLIF(m.name,''),u.display_name,u.id::text) AS assignee
        FROM workspace_project_tasks p JOIN app_users u ON u.id=p.user_id
        LEFT JOIN workspace_members m ON m.user_id=p.user_id
        WHERE p.user_id=? OR ?
        ORDER BY (p.status='accepted'),p.due_date,p.id LIMIT 21 OFFSET ?`, [userId, canManage, (page - 1) * 20]);
      const assignees = canManage ? await q<ProjectAssignee>(`SELECT u.id::int AS "userId",m.name ${activeRecipients} ORDER BY m.name,u.id`) : [];
      return { tasks: tasks.slice(0, 20), assignees, viewerUserId: userId, canManage, hasMore: tasks.length > 20 };
    },
    async save(input: unknown) {
      if (!canManage) return fail('需要超级管理员权限 / Super administrator required', 403);
      const { id, version, userId: assignee, title, dueDate, criteria, amountCents, bonusCents } = termsInput.parse(input);
      if (version > 0) {
        const task = await current(id, version);
        if (task.userId !== assignee || task.status === 'accepted' || task.status === 'submitted') {
          return fail('员工不可变更，待验收和已验收任务不可编辑 / Keep the assignee and edit only before review', 409);
        }
        // Updated terms must be agreed by the employee again.
        await q(`UPDATE workspace_project_tasks SET title=?,due_date=?,criteria=?,amount_cents=?,bonus_cents=?,
          status='proposed',version=version+1 WHERE id=?`, [title, dueDate, criteria, amountCents, bonusCents, id]);
      } else {
        const [member] = await q(`SELECT u.id ${activeRecipients} AND u.id=?`, [assignee]);
        if (!member) return fail('员工不存在或未启用 / Employee unavailable', 400);
        await q(`INSERT INTO workspace_project_tasks(id,user_id,title,due_date,criteria,amount_cents,bonus_cents)
          VALUES (?,?,?,?,?,?,?)`, [id, assignee, title, dueDate, criteria, amountCents, bonusCents]);
      }
      await audit('project-task.save', `${id}:${version + 1}`);
      return { id, version: version + 1 };
    },
    async changeStatus(input: unknown) {
      const { id, version, decision } = transitionInput.parse(input);
      const transition = transitions[decision];
      if (transition.by === 'superAdmin' && !canManage) return fail('需要超级管理员权限 / Super administrator required', 403);
      const task = await current(id, version);
      if (transition.by === 'employee' && task.userId !== userId) return unavailable();
      if (task.status !== transition.from) return stale();
      // Acceptance confirms the agreed bonus and never changes either amount.
      await q(`UPDATE workspace_project_tasks SET status=?,version=version+1,
        accepted_at=CASE WHEN ? THEN clock_timestamp() ELSE NULL END WHERE id=?`, [transition.to, decision === 'accept', id]);
      await audit(`project-task.${decision}`, `${id}:${version + 1}`);
      return { id, version: version + 1, status: transition.to };
    },
  };
}
