-- Correct FTO Top Layer cases imported by 0121.
--
-- 0121 inverted each TL algorithm from a solved FTO. TL is an intermediate
-- stage: every algorithm must instead finish at the Last Triangles start state.

DO $$
DECLARE
  compatible_count integer;
BEGIN
  SELECT COUNT(*) INTO compatible_count
  FROM alg_cases
  WHERE puzzle = 'fto'
    AND set_slug = 'tl'
    AND jsonb_typeof(algs) = 'array'
    AND jsonb_array_length(algs) = 1
    AND jsonb_typeof(algs -> 0) = 'array'
    AND jsonb_array_length(algs -> 0) = 1;

  IF compatible_count <> 5 THEN
    RAISE EXCEPTION 'Expected 5 single-alg FTO TL cases before correction, got %', compatible_count;
  END IF;
END $$;

WITH fixes AS (
  SELECT item ->> 'name' AS name, item ->> 'setup' AS setup
  FROM jsonb_array_elements($fto_tl_stage_setups$[
    {
      "name": "TL 1",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S'"
    },
    {
      "name": "TL 2",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' H'"
    },
    {
      "name": "TL 3",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' H'"
    },
    {
      "name": "TL 4",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' H' S"
    },
    {
      "name": "TL 5",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' H"
    }
  ]$fto_tl_stage_setups$::jsonb) AS entry(item)
)
UPDATE alg_cases AS c
SET setup = fixes.setup,
    algs = jsonb_set(c.algs, '{0,0,setup}', to_jsonb(fixes.setup), true),
    updated_at = NOW()
FROM fixes
WHERE c.puzzle = 'fto'
  AND c.set_slug = 'tl'
  AND c.name = fixes.name;

DO $$
DECLARE
  corrected_count integer;
BEGIN
  WITH fixes AS (
    SELECT item ->> 'name' AS name, item ->> 'setup' AS setup
    FROM jsonb_array_elements($fto_tl_stage_setups$[
      {"name":"TL 1","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S'"},
      {"name":"TL 2","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' H'"},
      {"name":"TL 3","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' H'"},
      {"name":"TL 4","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' H' S"},
      {"name":"TL 5","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' H"}
    ]$fto_tl_stage_setups$::jsonb) AS entry(item)
  )
  SELECT COUNT(*) INTO corrected_count
  FROM alg_cases AS c
  JOIN fixes ON fixes.name = c.name
  WHERE c.puzzle = 'fto'
    AND c.set_slug = 'tl'
    AND c.setup = fixes.setup
    AND c.algs -> 0 -> 0 ->> 'setup' = fixes.setup;

  IF corrected_count <> 5 THEN
    RAISE EXCEPTION 'Expected 5 corrected FTO TL setups, got %', corrected_count;
  END IF;
END $$;
