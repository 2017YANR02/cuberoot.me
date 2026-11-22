import type { Hono } from 'hono';
import { requirePlatformActor } from '../auth.js';
import { platformDb, platformQuery } from '../db.js';
import { privateNoStore } from '../http.js';
import { booleanField, enumField, readJsonObject } from '../validation.js';

const stageIds = ['first-solve', 'sub60', 'sub30', 'sub20', 'sub15', 'sub10'] as const;

async function readStage(userId: number | null) {
  const rows = await platformQuery<{stage: string}>(platformDb(),
    'SELECT stage FROM platform_learning_stage_preferences WHERE user_id = $1', [userId]);
  return rows[0]?.stage ?? null;
}

export function registerStageRoutes(platformLearningRoutes: Hono) {
  platformLearningRoutes.get('/me/learning-stage', async c => {
    privateNoStore(c);
    const actor = await requirePlatformActor(c);
    return c.json({ stage: await readStage(actor.userId) });
  });
  platformLearningRoutes.put('/me/learning-stage', async c => {
    privateNoStore(c);
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const stage = enumField(body, 'stage', stageIds, { required: true });
    // A legacy preference on a second device must never replace an account choice.
    const initialize = booleanField(body, 'initializeOnly');
    await platformQuery(platformDb(), `
      INSERT INTO platform_learning_stage_preferences (user_id, stage) VALUES ($1, $2)
      ON CONFLICT (user_id) ${initialize ? 'DO NOTHING' : 'DO UPDATE SET stage = EXCLUDED.stage'}
    `, [actor.userId, stage]);
    return c.json({ stage: initialize ? await readStage(actor.userId) : stage });
  });
}
