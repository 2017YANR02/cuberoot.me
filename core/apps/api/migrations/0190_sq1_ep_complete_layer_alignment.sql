-- Complete the final U/D alignment omitted from five imported SQ1 EP formulas.
-- Preserve every unrelated formula and its order. Accept only the exact legacy
-- state or the already-corrected state; any third state aborts the migration.

DO $$
DECLARE
  case_fix jsonb;
  formula_fix jsonb;
  case_id bigint;
  case_count integer;
  case_setup text;
  case_algs jsonb;
  old_count integer;
  new_count integer;
BEGIN
  FOR case_fix IN
    SELECT value
    FROM jsonb_array_elements($sq1_ep_fixes$
      [
        {
          "name": "Opp & Ua",
          "oldSetup": "/(3,0)/(2,0)/(-3,-3)/(0,-1)/(0,2)/(0,4)/(4,0)/(4,0)/(2,0)/(-5,0)/(-3,-3)/(1,0)/(-3,0)/(-1,0)",
          "newSetup": "(1,0)/(3,0)/(2,0)/(-3,-3)/(0,-1)/(0,2)/(0,4)/(4,0)/(4,0)/(2,0)/(-5,0)/(-3,-3)/(1,0)/(-3,0)/(-1,0)",
          "formulas": [
            {
              "oldAlg": "1,0/3,0/-1,0/3,3/5,0/-2,0/-4,0/-4,0/0,-4/0,-2/0,1/3,3/-2,0/-3,0/",
              "newAlg": "1,0/3,0/-1,0/3,3/5,0/-2,0/-4,0/-4,0/0,-4/0,-2/0,1/3,3/-2,0/-3,0/-1",
              "oldSetup": "/(3,0)/(2,0)/(-3,-3)/(0,-1)/(0,2)/(0,4)/(4,0)/(4,0)/(2,0)/(-5,0)/(-3,-3)/(1,0)/(-3,0)/(-1,0)",
              "newSetup": "(1,0)/(3,0)/(2,0)/(-3,-3)/(0,-1)/(0,2)/(0,4)/(4,0)/(4,0)/(2,0)/(-5,0)/(-3,-3)/(1,0)/(-3,0)/(-1,0)"
            }
          ]
        },
        {
          "name": "Adj / Adj",
          "oldSetup": "/(-1,2)/(1,1)/(0,-3)/(-1,0)",
          "newSetup": "(1,0)/(-1,2)/(1,1)/(0,-3)/(-1,0)",
          "formulas": [
            {
              "oldAlg": "1,0/0,3/-1,-1/1,-2/",
              "newAlg": "1,0/0,3/-1,-1/1,-2/-1",
              "oldSetup": "/(-1,2)/(1,1)/(0,-3)/(-1,0)",
              "newSetup": "(1,0)/(-1,2)/(1,1)/(0,-3)/(-1,0)"
            },
            {
              "oldAlg": "0,-1/-3,0/1,1/2,-1/",
              "newAlg": "0,-1/-3,0/1,1/2,-1/0,1",
              "oldSetup": "/(-2,1)/(-1,-1)/(3,0)/(0,1)",
              "newSetup": "(0,-1)/(-2,1)/(-1,-1)/(3,0)/(0,1)"
            },
            {
              "oldAlg": "1,0/3,0/-1,-1/-2,1/",
              "newAlg": "1,0/3,0/-1,-1/-2,1/-1",
              "oldSetup": "/(2,-1)/(1,1)/(-3,0)/(-1,0)",
              "newSetup": "(1,0)/(2,-1)/(1,1)/(-3,0)/(-1,0)"
            }
          ]
        },
        {
          "name": "Ua / Z",
          "oldSetup": "/(2,-1)/(1,1)/(-3,0)/(-3,0)/(-1,2)/(1,1)/(0,-3)/(-1,0)",
          "newSetup": "(1,0)/(2,-1)/(1,1)/(-3,0)/(-3,0)/(-1,2)/(1,1)/(0,-3)/(-1,0)",
          "formulas": [
            {
              "oldAlg": "1,0/0,3/-1,-1/1,-2/3,0/3,0/-1,-1/-2,1/",
              "newAlg": "1,0/0,3/-1,-1/1,-2/3,0/3,0/-1,-1/-2,1/-1",
              "oldSetup": "/(2,-1)/(1,1)/(-3,0)/(-3,0)/(-1,2)/(1,1)/(0,-3)/(-1,0)",
              "newSetup": "(1,0)/(2,-1)/(1,1)/(-3,0)/(-3,0)/(-1,2)/(1,1)/(0,-3)/(-1,0)"
            }
          ]
        }
      ]
    $sq1_ep_fixes$::jsonb)
  LOOP
    SELECT COUNT(*), MIN(id)
    INTO case_count, case_id
    FROM alg_cases
    WHERE puzzle = 'sq1' AND set_slug = 'ep' AND name = case_fix->>'name';

    IF case_count <> 1 THEN
      RAISE EXCEPTION 'SQ1 EP alignment expected one % case, got %', case_fix->>'name', case_count;
    END IF;

    SELECT setup, algs
    INTO case_setup, case_algs
    FROM alg_cases
    WHERE id = case_id
    FOR UPDATE;

    IF jsonb_typeof(case_algs) <> 'array'
       OR jsonb_typeof(case_algs->0) <> 'array' THEN
      RAISE EXCEPTION 'SQ1 EP alignment found invalid algs shape for %', case_fix->>'name';
    END IF;

    FOR formula_fix IN
      SELECT value FROM jsonb_array_elements(case_fix->'formulas')
    LOOP
      SELECT
        COUNT(*) FILTER (
          WHERE entry->>'alg' = formula_fix->>'oldAlg'
            AND entry->>'setup' = formula_fix->>'oldSetup'
        ),
        COUNT(*) FILTER (
          WHERE entry->>'alg' = formula_fix->>'newAlg'
            AND entry->>'setup' = formula_fix->>'newSetup'
        )
      INTO old_count, new_count
      FROM jsonb_array_elements(case_algs->0) AS entries(entry);

      IF old_count = 1 AND new_count = 0 THEN
        UPDATE alg_cases
        SET algs = jsonb_set(
          case_algs,
          '{0}',
          (
            SELECT jsonb_agg(
              CASE
                WHEN entry->>'alg' = formula_fix->>'oldAlg'
                  AND entry->>'setup' = formula_fix->>'oldSetup'
                THEN entry || jsonb_build_object(
                  'alg', formula_fix->>'newAlg',
                  'setup', formula_fix->>'newSetup'
                )
                ELSE entry
              END
              ORDER BY ord
            )
            FROM jsonb_array_elements(case_algs->0) WITH ORDINALITY AS entries(entry, ord)
          ),
          false
        )
        WHERE id = case_id
        RETURNING algs INTO case_algs;
      ELSIF old_count = 0 AND new_count = 1 THEN
        NULL;
      ELSE
        RAISE EXCEPTION
          'SQ1 EP alignment ambiguous formula state for % (old %, new %)',
          case_fix->>'name', old_count, new_count;
      END IF;
    END LOOP;

    IF case_setup = case_fix->>'oldSetup' THEN
      UPDATE alg_cases
      SET setup = case_fix->>'newSetup'
      WHERE id = case_id;
    ELSIF case_setup = case_fix->>'newSetup' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'SQ1 EP alignment ambiguous case setup for %', case_fix->>'name';
    END IF;
  END LOOP;
END $$;
