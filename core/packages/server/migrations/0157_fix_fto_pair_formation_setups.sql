-- Correct FTO Pair Formation cases imported by 0121.
--
-- 0121 inverted each PF algorithm from a solved FTO, which made PF incorrectly
-- finish the whole puzzle. PF must instead finish at a Top Layer starting state.
-- The shared target below is derived stage-by-stage from LT 1 setup followed by
-- inverse(TL 1), so every PF algorithm now finishes before TL and LT.

DO $$
DECLARE
  compatible_count integer;
BEGIN
  SELECT COUNT(*) INTO compatible_count
  FROM alg_cases
  WHERE puzzle = 'fto'
    AND set_slug = 'pf'
    AND jsonb_typeof(algs) = 'array'
    AND jsonb_array_length(algs) = 1
    AND jsonb_typeof(algs -> 0) = 'array'
    AND jsonb_array_length(algs -> 0) = 1;

  IF compatible_count <> 10 THEN
    RAISE EXCEPTION 'Expected 10 single-alg FTO PF cases before correction, got %', compatible_count;
  END IF;
END $$;

WITH fixes AS (
  SELECT item ->> 'name' AS name, item ->> 'setup' AS setup
  FROM jsonb_array_elements($fto_pf_stage_setups$[
    {
      "name": "PF 1",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S'"
    },
    {
      "name": "PF 2",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' H' F S"
    },
    {
      "name": "PF 3",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S F S"
    },
    {
      "name": "PF 4",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F S F S"
    },
    {
      "name": "PF 5",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F S'"
    },
    {
      "name": "PF 6",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S"
    },
    {
      "name": "PF 7",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S'"
    },
    {
      "name": "PF 8",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F S"
    },
    {
      "name": "PF 9",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F H F S"
    },
    {
      "name": "PF 10",
      "setup": "Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' H' F S F S"
    }
  ]$fto_pf_stage_setups$::jsonb) AS entry(item)
)
UPDATE alg_cases AS c
SET setup = fixes.setup,
    algs = jsonb_set(c.algs, '{0,0,setup}', to_jsonb(fixes.setup), true),
    updated_at = NOW()
FROM fixes
WHERE c.puzzle = 'fto'
  AND c.set_slug = 'pf'
  AND c.name = fixes.name;

DO $$
DECLARE
  corrected_count integer;
BEGIN
  WITH fixes AS (
    SELECT item ->> 'name' AS name, item ->> 'setup' AS setup
    FROM jsonb_array_elements($fto_pf_stage_setups$[
      {"name":"PF 1","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S'"},
      {"name":"PF 2","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' H' F S"},
      {"name":"PF 3","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S F S"},
      {"name":"PF 4","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F S F S"},
      {"name":"PF 5","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F S'"},
      {"name":"PF 6","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S"},
      {"name":"PF 7","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' S'"},
      {"name":"PF 8","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F S"},
      {"name":"PF 9","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F H F S"},
      {"name":"PF 10","setup":"Uo R U R' U' Rw R' U R U' Rw' Uo' S' F' H' F S F S"}
    ]$fto_pf_stage_setups$::jsonb) AS entry(item)
  )
  SELECT COUNT(*) INTO corrected_count
  FROM alg_cases AS c
  JOIN fixes ON fixes.name = c.name
  WHERE c.puzzle = 'fto'
    AND c.set_slug = 'pf'
    AND c.setup = fixes.setup
    AND c.algs -> 0 -> 0 ->> 'setup' = fixes.setup;

  IF corrected_count <> 10 THEN
    RAISE EXCEPTION 'Expected 10 corrected FTO PF setups, got %', corrected_count;
  END IF;
END $$;
