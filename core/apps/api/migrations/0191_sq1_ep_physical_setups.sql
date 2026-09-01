-- Replace seven SQ1 EP formulas whose legacy paths try to slice through a piece.
-- Preserve unrelated formulas, notes, user data, and JSON array order. Accept
-- only the exact legacy state or the already-corrected state.

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
          "name": "Solved / H",
          "oldSetup": "(1,0)/(-1,-1)/(-6,0)/(1,1)/(-1,0)/(0,-3)/(-1,-1)/(-6,0)/(1,1)/(-1,0)",
          "newSetup": "(0,-1)/(3,-3)/(3,-3)/(1,0)/(-3,3)/(-3,3)/",
          "formulas": [
            {
              "oldAlg": "1,0/-1,-1/6,0/1,1/0,3/1,0/-1,-1/6,0/1,1/-1,0",
              "newAlg": "/3,-3/3,-3/-1,0/-3,3/-3,3/0,1",
              "oldSetup": "(1,0)/(-1,-1)/(-6,0)/(1,1)/(-1,0)/(0,-3)/(-1,-1)/(-6,0)/(1,1)/(-1,0)",
              "newSetup": "(0,-1)/(3,-3)/(3,-3)/(1,0)/(-3,3)/(-3,3)/"
            }
          ]
        },
        {
          "name": "Opp & Solved",
          "oldSetup": "(0,3)/(3,3)/(-5,0)/(2,0)/(4,0)/(4,0)/(0,4)/(0,2)/(0,-1)/(3,3)/(-1,2)/(1,1)/(0,-3)/(-1,0)",
          "newSetup": "(-3,0)/(-3,-3)/(-3,0)/(-1,5)/(4,-2)/(0,2)/(-4,2)/(-2,4)/(1,0)/(-3,-3)/",
          "formulas": [
            {
              "oldAlg": "1,0/0,3/-1,-1/1,-2/-3,-3/0,1/0,-2/0,-4/-4,0/-4,0/-2,0/5,0/-3,-3/0,-3",
              "newAlg": "/3,3/-1,0/2,-4/4,-2/0,-2/-4,2/1,-5/3,0/3,3/3,0",
              "oldSetup": "(0,3)/(3,3)/(-5,0)/(2,0)/(4,0)/(4,0)/(0,4)/(0,2)/(0,-1)/(3,3)/(-1,2)/(1,1)/(0,-3)/(-1,0)",
              "newSetup": "(-3,0)/(-3,-3)/(-3,0)/(-1,5)/(4,-2)/(0,2)/(-4,2)/(-2,4)/(1,0)/(-3,-3)/"
            }
          ]
        },
        {
          "name": "Opp / Opp",
          "oldSetup": "(1,0)/(5,-1)/(-5,1)/(-1,0)",
          "newSetup": "(1,0)/(5,-1)/(-5,1)/(-1,0)",
          "formulas": [
            {
              "oldAlg": "1,0/-3,3/-1,-1/4,2/-1,0",
              "newAlg": "1,0/-1,-1/-5,1/-1,-1/0,1",
              "oldSetup": "(1,0)/(-4,-2)/(1,1)/(3,-3)/(-1,0)",
              "newSetup": "(0,-1)/(1,1)/(5,-1)/(1,1)/(-1,0)"
            }
          ]
        },
        {
          "name": "Ub / Ub",
          "oldSetup": "(0,-1)/(-2,-1)/(-1,-1)/(3,0)/(1,1)/(5,-1)/(-5,1)/(-1,0)",
          "newSetup": "(1,0)/(2,-1)/(1,1)/(2,-1)/(-5,1)/(-1,0)",
          "formulas": [
            {
              "oldAlg": "1,0/5,-1/-5,1/-1,-1/-3,0/1,1/2,1/0,1",
              "newAlg": "1,0/5,-1/-2,1/-1,-1/-2,1/-1,0",
              "oldSetup": "(0,-1)/(-2,-1)/(-1,-1)/(3,0)/(1,1)/(5,-1)/(-5,1)/(-1,0)",
              "newSetup": "(1,0)/(2,-1)/(1,1)/(2,-1)/(-5,1)/(-1,0)"
            },
            {
              "oldAlg": "1,0/-1,-1/6,0/1,1/-1,-1/-3,0/1,1/2,1/0,1",
              "newAlg": "-2,0/3,0/-1,-1/3,0/-2,1/-1,-1/3,0/-5,1/-1,0",
              "oldSetup": "(0,-1)/(-2,-1)/(-1,-1)/(3,0)/(1,1)/(-1,-1)/(-6,0)/(1,1)/(-1,0)",
              "newSetup": "(1,0)/(5,-1)/(-3,0)/(1,1)/(2,-1)/(-3,0)/(1,1)/(-3,0)/(2,0)"
            }
          ]
        },
        {
          "name": "O+ & Solved",
          "oldSetup": "(0,2)/(-2,0)/(-1,0)/(3,3)/(-1,-2)/(2,2)/(0,-2)/(2,2)/(-1,0)/(-3,-3)/",
          "newSetup": "(-3,-3)/(-3,-3)/(0,1)/(-2,-2)/(0,2)/(2,2)/(0,-1)/(3,3)/(-2,0)/(2,2)/(0,1)",
          "formulas": [
            {
              "oldAlg": "/3,3/1,0/-2,-2/0,2/-2,-2/1,2/-3,-3/1,0/2,0/0,-2",
              "newAlg": "0,-1/-2,-2/2,0/-3,-3/0,1/-2,-2/0,-2/2,2/0,-1/3,3/3,3",
              "oldSetup": "(0,2)/(-2,0)/(-1,0)/(3,3)/(-1,-2)/(2,2)/(0,-2)/(2,2)/(-1,0)/(-3,-3)/",
              "newSetup": "(-3,-3)/(-3,-3)/(0,1)/(-2,-2)/(0,2)/(2,2)/(0,-1)/(3,3)/(-2,0)/(2,2)/(0,1)"
            }
          ]
        },
        {
          "name": "H / Solved",
          "oldSetup": "(1,0)/(-1,-1)/(-6,0)/(1,1)/(-3,0)/(1,0)/(-1,-1)/(-6,0)/(1,1)/(-1,0)",
          "newSetup": "(1,0)/(3,-3)/(3,-3)/(0,-1)/(-3,3)/(-3,3)/",
          "formulas": [
            {
              "oldAlg": "1,0/-1,-1/6,0/1,1/-1,0/3,0/-1,-1/6,0/1,1/-1,0",
              "newAlg": "/3,-3/3,-3/0,1/-3,3/-3,3/-1,0",
              "oldSetup": "(1,0)/(-1,-1)/(-6,0)/(1,1)/(-3,0)/(1,0)/(-1,-1)/(-6,0)/(1,1)/(-1,0)",
              "newSetup": "(1,0)/(3,-3)/(3,-3)/(0,-1)/(-3,3)/(-3,3)/"
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
      RAISE EXCEPTION 'SQ1 EP physical setup expected one % case, got %', case_fix->>'name', case_count;
    END IF;

    SELECT setup, algs
    INTO case_setup, case_algs
    FROM alg_cases
    WHERE id = case_id
    FOR UPDATE;

    IF jsonb_typeof(case_algs) <> 'array'
       OR jsonb_typeof(case_algs->0) <> 'array' THEN
      RAISE EXCEPTION 'SQ1 EP physical setup found invalid algs shape for %', case_fix->>'name';
    END IF;

    FOR formula_fix IN SELECT value FROM jsonb_array_elements(case_fix->'formulas')
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
          'SQ1 EP physical setup ambiguous formula state for % (old %, new %)',
          case_fix->>'name', old_count, new_count;
      END IF;
    END LOOP;

    IF case_setup = case_fix->>'oldSetup' THEN
      UPDATE alg_cases SET setup = case_fix->>'newSetup' WHERE id = case_id;
    ELSIF case_setup = case_fix->>'newSetup' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'SQ1 EP physical setup ambiguous case setup for %', case_fix->>'name';
    END IF;
  END LOOP;
END $$;
