import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { DEFAULT_OPEN_PETS, type DeskPetEntry } from '@cuberoot/shared/deskpet';
import { CARE_ACTIONS, careFor, createPetCare, currentCare, type CareAction, type PetCare } from '@cuberoot/shared/deskpet-care';
import { withTransaction, type QueryRunner } from '../db/connection.js';
import { requireAppUserId } from '../utils/app_user_auth.js';

export const petRoutes = new Hono();
type Row = { pet_id: string; adopted_at: Date; care: PetCare };
const present = (r: Row) => ({ id: r.pet_id, adoptedAt: r.adopted_at, care: currentCare(r.care, Date.now()) });
async function lockOwner(uid: number, run: QueryRunner) {
  const [owner] = await run('SELECT id FROM app_users WHERE id = ? AND merged_into_user_id IS NULL FOR SHARE', [uid]);
  if (!owner) throw new HTTPException(401, { message: 'Authentication required' });
}
async function available(id: string, run: QueryRunner) {
  const [catalog] = await run<{ entries: DeskPetEntry[] }>('SELECT entries FROM deskpet_catalog WHERE id = 1 FOR SHARE');
  if (!catalog) return false;
  const entry = catalog.entries.find(pet => pet.id === id);
  return entry ? !entry.locked && !entry.removed : DEFAULT_OPEN_PETS.includes(id);
}
petRoutes.use('/pets/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
petRoutes.get('/pets/mine', async c => {
  const uid = await requireAppUserId(c);
  return withTransaction(async run => {
    await lockOwner(uid, run);
    const rows = await run<Row>('SELECT pet_id, adopted_at, care FROM user_pets WHERE user_id = ? ORDER BY adopted_at, pet_id', [uid]);
    return c.json(rows.map(present));
  });
});
petRoutes.post('/pets/:id/adopt', async c => {
  const uid = await requireAppUserId(c);
  const id = c.req.param('id');
  return withTransaction(async run => {
    await lockOwner(uid, run);
    if (!await available(id, run)) return c.json({ error: 'Pet unavailable' }, 404);
    await run('INSERT INTO user_pets (user_id, pet_id, care) VALUES (?, ?, ?) ON CONFLICT (user_id, pet_id) DO NOTHING', [uid, id, createPetCare(Date.now())]);
    const [row] = await run<Row>('SELECT pet_id, adopted_at, care FROM user_pets WHERE user_id = ? AND pet_id = ?', [uid, id]);
    return c.json(present(row));
  });
});
petRoutes.post('/pets/:id/care', async c => {
  const uid = await requireAppUserId(c);
  const id = c.req.param('id');
  const body = await c.req.json<{ action?: unknown }>().catch(() => null);
  if (!body || !CARE_ACTIONS.includes(body.action as CareAction)) return c.json({ error: 'Invalid care action' }, 400);
  return withTransaction(async run => {
    await lockOwner(uid, run);
    if (!await available(id, run)) return c.json({ error: 'Pet unavailable' }, 404);
    const [row] = await run<Row>('SELECT pet_id, adopted_at, care FROM user_pets WHERE user_id = ? AND pet_id = ? FOR UPDATE', [uid, id]);
    if (!row) return c.json({ error: 'Adopt this pet first' }, 403);
    const result = careFor(row.care, body.action as CareAction, Date.now());
    if (result.accepted) await run('UPDATE user_pets SET care = ? WHERE user_id = ? AND pet_id = ?', [result.pet, uid, id]);
    return c.json({ ...result, pet: present({ ...row, care: result.pet }) });
  });
});
