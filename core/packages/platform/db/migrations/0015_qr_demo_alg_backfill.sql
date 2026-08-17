-- 回填 demo 二维码的「背面精选公式」(alg)。
-- 线上持久库在 0013 加 alg 列之前就手动建了 demo-landing / demo-redirect 两条 demo 码,
-- 升级后 alg 一直为空,卡片只渲染 term 药丸(CFOP),而非案例图 + 记法(本地新数据有 alg)。
-- 仅当 alg 为空时回填,幂等、不覆盖后台已编辑的值;本地 alg 已填,执行为 no-op。
UPDATE `qr_codes` SET `alg` = '{"name":"OLL 33","moves":"R U R'' U'' R'' F R F''","url":"https://cuberoot.me/zh/alg/3x3/oll"}' WHERE `code` = 'demo-landing' AND `alg` IS NULL;--> statement-breakpoint
UPDATE `qr_codes` SET `alg` = '{"name":"T (F2L)","moves":"U'' R'' F R F'' R U'' R''","url":"https://cuberoot.me/zh/alg/3x3/f2l"}' WHERE `code` = 'demo-redirect' AND `alg` IS NULL;
