-- 清空 LSLL 的 per-case 进度(标记 + 记忆)。
-- 2026-07-28 起,已收录范围出题的是一条两步路线 ≤4 个 mid-AUF 变体里整方最优最短的那个
-- (client `lib/lsll/trainer-set` 的 shortestVariant)。同一条路线换了 canonical key ⇒ 旧的
-- 标记 / 记忆全落在不再出题的 case 上,既指不回去也没法迁移。按「现在还没什么人练」直接删。
-- 本机那半由 client `lib/trainer-marks.ts` 的一次性重置删,必须先于任何一次云端合并跑,
-- 否则本地那份会在 last-write-wins 里原样飞回来。
--
-- 「过遍」进度(alg_set_progress)不动:它按 scope 计数,302 条路线一条没变,过没过遍照样成立。
DELETE FROM alg_case_marks WHERE puzzle = '3x3' AND set_slug = 'lsll';
DELETE FROM alg_case_srs   WHERE puzzle = '3x3' AND set_slug = 'lsll';
