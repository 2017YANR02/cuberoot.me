// NOTE: 排查脚本——检查几个可疑 mismatch 的数据库原始数据
import { query, closePool } from '../src/core/database.js';

async function main() {
  // 1. best_round 333ft: md 显示 2010-2012 老比赛，json 显示 2019 比赛
  const ftCount = await query(`SELECT COUNT(*) c FROM results WHERE event_id='333ft' AND average > 0`);
  console.log('=== 333ft average>0:', ftCount[0]['c'], '===');

  const ftTop = await query(`
    SELECT result.average, result.best, competition.cell_name comp, competition.start_date dt
    FROM results result
    JOIN competitions competition ON competition.id=result.competition_id
    WHERE event_id='333ft' AND average > 0
    ORDER BY average LIMIT 5`);
  ftTop.forEach(r => console.log(`  avg=${r['average']} best=${r['best']} comp=${r['comp']} date=${String(r['dt']).slice(0,10)}`));

  // 2. worst_result_on_podium 333bf: Stefan Pochmann 35:00.00
  const pochmann = await query(`
    SELECT result.best, result.average, result.pos, competition.cell_name comp, competition.start_date dt
    FROM results result JOIN competitions competition ON competition.id=result.competition_id
    JOIN persons person ON person.wca_id=result.person_id AND person.sub_id=1
    WHERE event_id='333bf' AND round_type_id IN ('c','f') AND pos<=3 AND person.name='Stefan Pochmann'
    ORDER BY result.best DESC LIMIT 3`);
  console.log('\n=== Stefan Pochmann 333bf podium ===');
  pochmann.forEach(r => console.log(`  best=${r['best']} avg=${r['average']} pos=${r['pos']} comp=${r['comp']}`));

  // 3. best_potential_fmc_mean: 检查 TS 版 best_potential_fmc_mean 逻辑
  const fmcTop = await query(`
    SELECT result.average, person.name, competition.cell_name comp
    FROM results result
    JOIN persons person ON person.wca_id=result.person_id AND person.sub_id=1
    JOIN competitions competition ON competition.id=result.competition_id
    WHERE event_id='333fm' AND average > 0 ORDER BY average LIMIT 5`);
  console.log('\n=== 333fm top5 average ===');
  fmcTop.forEach(r => console.log(`  avg=${r['average']} name=${r['name']} comp=${r['comp']}`));

  await closePool();
}

main();
