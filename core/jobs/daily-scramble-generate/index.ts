import { db } from '@cuberoot/server-db';
import { generateScramble } from '@cuberoot/shared/scramble';
import * as crypto from 'crypto';

async function generateTodayChallenge() {
  const dateStr = new Date().toISOString().slice(0, 10);

  const exists = await db.query(`SELECT id FROM daily_challenges WHERE challenge_date = $1`, [dateStr]);
  if (exists.rows.length > 0) {
    console.log(`[daily] ${dateStr} 已存在，跳过`);
    return;
  }

  const scramble = generateScramble('333'); 

  await db.query(
    `INSERT INTO daily_challenges (challenge_date, event, scramble) VALUES ($1, '333', $2)`,
    [dateStr, scramble]
  );
  
  console.log(`[daily] 已生成 ${dateStr} 的打乱: ${scramble}`);
}

generateTodayChallenge()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
