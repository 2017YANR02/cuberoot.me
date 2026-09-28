import { query, type QueryRunner } from '../db/connection.js';

/** Reserve before any model call. Failed/cancelled calls retain their reservation. */
export async function reserveAssistantQuestion(run: QueryRunner = query): Promise<{ allowed: boolean; retryAfter: number }> {
  const rows = await run<{ allowed: boolean; retry_after: number }>(`
    WITH today AS (
      SELECT (statement_timestamp() AT TIME ZONE 'Asia/Shanghai')::date AS day
    ), reserved AS (
      INSERT INTO site_assistant_daily_usage (day, questions)
      SELECT day, 1 FROM today
      ON CONFLICT (day) DO UPDATE
        SET questions = site_assistant_daily_usage.questions + 1
        WHERE site_assistant_daily_usage.questions < 100
      RETURNING questions
    )
    SELECT EXISTS (SELECT 1 FROM reserved) AS allowed,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
        ((today.day + 1)::timestamp AT TIME ZONE 'Asia/Shanghai') - statement_timestamp()
      ))))::integer AS retry_after
    FROM today
  `);
  if (!rows[0]) throw new Error('quota unavailable');
  return { allowed: rows[0].allowed, retryAfter: rows[0].retry_after };
}
