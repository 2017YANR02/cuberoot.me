import { type PlatformActor } from '../auth.js';
import { type PlatformDb, platformQuery, requireCourseOwner } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { resourceId } from '../validation.js';
import { type Context } from 'hono';

export function requiredParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) badRequest(`${name} is required`);
  return resourceId(value, name);
}

export function courseKey(c: Context): string {
  const value = c.req.param('courseId') ?? c.req.param('id');
  if (!value) badRequest('courseId is required');
  return resourceId(value, 'courseId');
}

async function courseId(db: PlatformDb, key: string): Promise<string> {
  const rows = await platformQuery<{ id: string }>(db, `
    SELECT id::text AS id FROM platform_courses
    WHERE id::text = $1 OR slug = $1
  `, [key]);
  if (!rows[0]) notFound('Course');
  return rows[0].id;
}

export async function authorizeCourseWrite(db: PlatformDb, actor: PlatformActor, key: string): Promise<string> {
  const id = await courseId(db, key);
  if (!actor.isAdmin) await requireCourseOwner(db, actor, id);
  return id;
}
