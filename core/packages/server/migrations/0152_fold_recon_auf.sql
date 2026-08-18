-- Fold a standalone `moves // AUF` line into the preceding labelled stage.
-- This keeps AUF moves in the algorithm that actually produced the final state.
CREATE OR REPLACE FUNCTION pg_temp.fold_recon_auf(input_text TEXT) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  raw_line TEXT;
  normalized_line TEXT;
  move_part TEXT;
  comment_text TEXT;
  comment_pos INTEGER;
  previous_idx INTEGER;
  previous_line TEXT;
  previous_moves TEXT;
  previous_comment TEXT;
  previous_comment_pos INTEGER;
  out_lines TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  FOREACH raw_line IN ARRAY string_to_array(replace(input_text, E'\r\n', E'\n'), E'\n') LOOP
    comment_pos := strpos(raw_line, '//');
    IF comment_pos > 0 THEN
      move_part := btrim(substring(raw_line FROM 1 FOR comment_pos - 1));
      comment_text := btrim(substring(raw_line FROM comment_pos + 2));
      normalized_line := CASE
        WHEN move_part = '' THEN '// ' || comment_text
        ELSE rtrim(substring(raw_line FROM 1 FOR comment_pos - 1), E' \t') || ' // ' || comment_text
      END;
    ELSE
      move_part := '';
      comment_text := '';
      normalized_line := raw_line;
    END IF;

    IF move_part <> '' AND lower(comment_text) = 'auf' THEN
      previous_idx := COALESCE(array_length(out_lines, 1), 0);
      WHILE previous_idx > 0 AND btrim(out_lines[previous_idx]) = '' LOOP
        previous_idx := previous_idx - 1;
      END LOOP;

      IF previous_idx > 0 THEN
        previous_line := out_lines[previous_idx];
        previous_comment_pos := strpos(previous_line, '//');
        IF previous_comment_pos > 0 THEN
          previous_moves := btrim(substring(previous_line FROM 1 FOR previous_comment_pos - 1));
          previous_comment := btrim(substring(previous_line FROM previous_comment_pos + 2));
          IF previous_moves <> '' THEN
            out_lines[previous_idx] := previous_moves || ' ' || move_part || ' //'
              || CASE WHEN previous_comment <> '' THEN ' ' || previous_comment ELSE '' END;
            CONTINUE;
          END IF;
        END IF;
      END IF;
    END IF;

    out_lines := array_append(out_lines, normalized_line);
  END LOOP;

  RETURN array_to_string(out_lines, E'\n');
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.try_parse_jsonb(input_text TEXT) RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN input_text::JSONB;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

WITH folded AS (
  SELECT id, pg_temp.fold_recon_auf(solution) AS solution
  FROM recons
  WHERE solution ~* E'(^|\\n)[ \\t]*[^\\n]+//[ \\t]*AUF[ \\t]*(\\n|$)'
)
UPDATE recons
SET solution = folded.solution
FROM folded
WHERE recons.id = folded.id
  AND recons.solution IS DISTINCT FROM folded.solution;

WITH parsed AS (
  SELECT id, pg_temp.try_parse_jsonb(alternatives) AS value
  FROM recons
  WHERE alternatives IS NOT NULL
    AND alternatives ILIKE '%AUF%'
), rebuilt AS (
  SELECT
    parsed.id,
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(item.value) = 'object'
          AND item.value ? 'solution'
          AND jsonb_typeof(item.value -> 'solution') = 'string'
        THEN jsonb_set(
          item.value,
          '{solution}',
          to_jsonb(pg_temp.fold_recon_auf(item.value ->> 'solution')),
          false
        )
        ELSE item.value
      END
      ORDER BY item.ordinality
    ) AS value
  FROM parsed
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(parsed.value) = 'array' THEN parsed.value ELSE '[]'::JSONB END
  ) WITH ORDINALITY AS item(value, ordinality)
  GROUP BY parsed.id
)
UPDATE recons
SET alternatives = rebuilt.value::TEXT
FROM rebuilt
WHERE recons.id = rebuilt.id
  AND recons.alternatives IS DISTINCT FROM rebuilt.value::TEXT;

DROP FUNCTION pg_temp.try_parse_jsonb(TEXT);
DROP FUNCTION pg_temp.fold_recon_auf(TEXT);
