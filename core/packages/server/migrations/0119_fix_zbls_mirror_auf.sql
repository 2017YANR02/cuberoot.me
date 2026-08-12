-- Three self-mirrored ZBLS cases need a starting AUF after the left-right rewrite.
-- Keep generated-entry provenance intact and replace only the affected generated algorithm.
WITH fixes(id, alg) AS (
  VALUES
    (5169::bigint, $alg$L2 U2 F' L2 F U2 L U' L$alg$),
    (5170::bigint, $alg$U2 y' U F' L U2 L2 U' L2 U' F' L' F2$alg$),
    (6081::bigint, $alg$U F' L' U' L U F$alg$)
)
UPDATE alg_cases AS c
SET algs = jsonb_set(
  c.algs,
  '{1}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'gen' = 'lr' AND item->'src'->>'id' = c.id::text
          THEN jsonb_set(item, '{alg}', to_jsonb(f.alg))
        ELSE item
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(c.algs->1) WITH ORDINALITY AS entry(item, ord)
  )
)
FROM fixes AS f
WHERE c.id = f.id
  AND c.puzzle = '3x3'
  AND c.set_slug = 'zbls'
  AND jsonb_typeof(c.algs) = 'array'
  AND jsonb_array_length(c.algs) > 1
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c.algs->1) AS entry(item)
    WHERE item->>'gen' = 'lr'
      AND item->'src'->>'id' = c.id::text
      AND item->>'alg' IS DISTINCT FROM f.alg
  );
