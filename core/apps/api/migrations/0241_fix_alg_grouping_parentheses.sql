-- Repair the only two algorithm rows with unmatched grouping parentheses.
UPDATE alg_cases
   SET algs = jsonb_set(
     algs,
     '{0,2,alg}',
     to_jsonb($alg$U2 R2 U (R' U R' U') (R U' R2 U'D) (R' U R u' U')$alg$::text),
     false
   )
 WHERE id = 4309
   AND puzzle = '3x3'
   AND set_slug = 'pll'
   AND name = 'Ga'
   AND algs #>> '{0,2,alg}' = $alg$U2 R2 U (R' U R' U') (R U' R2 U'D) (R' U R u' U'$alg$;

UPDATE alg_cases
   SET algs = jsonb_set(
     algs,
     '{0,0,alg}',
     to_jsonb($alg$(F R U R' U') (R U R' F2) r U r2' F r$alg$::text),
     false
   )
 WHERE id = 1906
   AND puzzle = '3x3'
   AND set_slug = '1lll'
   AND name = '1LLL 34 5'
   AND algs #>> '{0,0,alg}' = $alg$(F R U R' U') (R U R' F2) r U r2' F r)$alg$;

UPDATE alg_cases
   SET meta = jsonb_set(
     meta,
     '{scramble}',
     to_jsonb($alg$(F R U R' U') (R U R' F2) r U r2' F r$alg$::text),
     false
   )
 WHERE id = 2622
   AND puzzle = '3x3'
   AND set_slug = '1lll'
   AND name = '1LLL 44 1'
   AND meta #>> '{scramble}' = $alg$(F R U R' U') (R U R' F2) r U r2' F r)$alg$;
