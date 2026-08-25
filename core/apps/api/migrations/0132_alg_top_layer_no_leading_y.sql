-- 顶层公式统一用 U 层转动表达观察角度，禁止以 y 转体开头。

CREATE OR REPLACE FUNCTION alg_is_3x3_top_layer_set(p_puzzle TEXT, p_set_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_puzzle = '3x3' AND p_set_slug IN (
    '2-look-oll', 'oll', '2-look-pll', 'pll', 'coll',
    '2-look-cmll', 'cmll', 'oh-cmll', 'anti-pll', 'ell',
    'ollcp', 'zbll', '1lll'
  );
$$;

CREATE OR REPLACE FUNCTION alg_starts_with_y_rotation(p_alg TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_alg ~ $re$^[[:space:]↑↓·=*]*(?:\[[^]]*\][[:space:]↑↓·=*]*)*y[0-9]*'?([[:space:]]|$)$re$,
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION alg_rewrite_leading_y_as_auf(p_alg TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts TEXT[];
  move_parts TEXT[];
  amount INTEGER;
  turn INTEGER;
  relabel_turns INTEGER;
  body TEXT;
  relabeled TEXT := '';
  family TEXT;
  layer_prefix TEXT;
  suffix TEXT;
  has_non_face BOOLEAN := FALSE;
  flip_amount BOOLEAN;
  before_auf TEXT;
  after_auf TEXT;
BEGIN
  IF NOT alg_starts_with_y_rotation(p_alg) THEN RETURN p_alg; END IF;
  parts := regexp_match(
    p_alg,
    $re$^[[:space:]↑↓·=*]*(?:\[[^]]*\][[:space:]↑↓·=*]*)*y([0-9]*)('?)[[:space:]]*$re$
  );
  amount := COALESCE(NULLIF(parts[1], ''), '1')::INTEGER;
  IF parts[2] = '''' THEN amount := -amount; END IF;
  turn := ((amount % 4) + 4) % 4;
  body := regexp_replace(
    p_alg,
    $re$^[[:space:]↑↓·=*]*(?:\[[^]]*\][[:space:]↑↓·=*]*)*y[0-9]*'?[[:space:]]*$re$,
    ''
  );

  -- AUF 共轭只适用于纯外层面转。带 x/z、slice 或宽层的公式会改变中心朝向，
  -- 必须把去掉的 y 旋转吸收到每一步的面名里，不能机械套 U ... U'。
  FOR move_parts IN
    SELECT match
      FROM regexp_matches(
        body,
        $re$(\d+(?:-\d+)?)?([RLUDFBMSExyzrludfbmse])(w?)([0-9]*)('?)$re$,
        'g'
      ) AS matches(match)
  LOOP
    family := move_parts[2] || move_parts[3];
    IF family NOT IN ('R', 'L', 'U', 'D', 'F', 'B') THEN
      has_non_face := TRUE;
      EXIT;
    END IF;
  END LOOP;

  IF has_non_face THEN
    IF body ~ $re$\)[0-9]+'?$re$ THEN
      RAISE EXCEPTION 'cannot safely rewrite grouped top-layer alg: %', p_alg;
    END IF;
    relabel_turns := ((-amount % 4) + 4) % 4;
    FOR move_parts IN
      SELECT match
        FROM regexp_matches(
          body,
          $re$(\d+(?:-\d+)?)?([RLUDFBMSExyzrludfbmse])(w?)([0-9]*)('?)$re$,
          'g'
        ) AS matches(match)
    LOOP
      layer_prefix := COALESCE(move_parts[1], '');
      family := move_parts[2] || move_parts[3];
      amount := COALESCE(NULLIF(move_parts[4], ''), '1')::INTEGER;
      IF move_parts[5] = '''' THEN amount := -amount; END IF;

      FOR i IN 1..relabel_turns LOOP
        flip_amount := family IN ('z', 'M', 'm');
        family := CASE family
          WHEN 'R' THEN 'F' WHEN 'U' THEN 'U' WHEN 'F' THEN 'L'
          WHEN 'D' THEN 'D' WHEN 'B' THEN 'R' WHEN 'L' THEN 'B'
          WHEN 'r' THEN 'f' WHEN 'u' THEN 'u' WHEN 'f' THEN 'l'
          WHEN 'd' THEN 'd' WHEN 'b' THEN 'r' WHEN 'l' THEN 'b'
          WHEN 'Rw' THEN 'Fw' WHEN 'Uw' THEN 'Uw' WHEN 'Fw' THEN 'Lw'
          WHEN 'Dw' THEN 'Dw' WHEN 'Bw' THEN 'Rw' WHEN 'Lw' THEN 'Bw'
          WHEN 'x' THEN 'z' WHEN 'y' THEN 'y' WHEN 'z' THEN 'x'
          WHEN 'E' THEN 'E' WHEN 'M' THEN 'S' WHEN 'S' THEN 'M'
          WHEN 'e' THEN 'e' WHEN 'm' THEN 's' WHEN 's' THEN 'm'
        END;
        IF flip_amount THEN amount := -amount; END IF;
      END LOOP;
      IF amount = -2 THEN amount := 2; END IF;
      suffix := CASE
        WHEN abs(amount) = 1 THEN ''
        ELSE abs(amount)::TEXT
      END || CASE WHEN amount < 0 THEN '''' ELSE '' END;
      relabeled := concat_ws(' ', NULLIF(relabeled, ''), layer_prefix || family || suffix);
    END LOOP;
    RETURN relabeled;
  END IF;

  before_auf := CASE turn WHEN 1 THEN 'U' WHEN 2 THEN 'U2' WHEN 3 THEN 'U''' ELSE '' END;
  after_auf := CASE turn WHEN 1 THEN 'U''' WHEN 2 THEN 'U2' WHEN 3 THEN 'U' ELSE '' END;
  RETURN trim(concat_ws(' ', NULLIF(before_auf, ''), NULLIF(body, ''), NULLIF(after_auf, '')));
END;
$$;

CREATE OR REPLACE FUNCTION alg_json_has_leading_y(p_node JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item JSONB;
BEGIN
  IF jsonb_typeof(p_node) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(p_node) LOOP
      IF alg_json_has_leading_y(item) THEN RETURN TRUE; END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_node) = 'object' THEN
    IF jsonb_typeof(p_node->'alg') = 'string' AND alg_starts_with_y_rotation(p_node->>'alg') THEN
      RETURN TRUE;
    END IF;
    IF jsonb_typeof(p_node->'algHtml') = 'string' AND alg_starts_with_y_rotation(p_node->>'algHtml') THEN
      RETURN TRUE;
    END IF;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION alg_rewrite_json_leading_y(p_node JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  item JSONB;
  result JSONB;
BEGIN
  IF jsonb_typeof(p_node) = 'array' THEN
    SELECT COALESCE(jsonb_agg(alg_rewrite_json_leading_y(value) ORDER BY ord), '[]'::jsonb)
      INTO result
      FROM jsonb_array_elements(p_node) WITH ORDINALITY AS entries(value, ord);
    RETURN result;
  ELSIF jsonb_typeof(p_node) = 'object' THEN
    result := p_node;
    IF jsonb_typeof(result->'alg') = 'string' AND alg_starts_with_y_rotation(result->>'alg') THEN
      result := jsonb_set(result, '{alg}', to_jsonb(alg_rewrite_leading_y_as_auf(result->>'alg')));
    END IF;
    IF jsonb_typeof(result->'algHtml') = 'string' AND alg_starts_with_y_rotation(result->>'algHtml') THEN
      result := jsonb_set(result, '{algHtml}', to_jsonb(alg_rewrite_leading_y_as_auf(result->>'algHtml')));
    END IF;
    RETURN result;
  END IF;
  RETURN p_node;
END;
$$;

UPDATE alg_submissions
   SET alg = alg_rewrite_leading_y_as_auf(alg)
 WHERE alg_is_3x3_top_layer_set(puzzle, set_slug)
   AND alg_starts_with_y_rotation(alg);

UPDATE alg_cases
   SET standard = CASE
         WHEN alg_starts_with_y_rotation(standard) THEN alg_rewrite_leading_y_as_auf(standard)
         ELSE standard
       END,
       algs = alg_rewrite_json_leading_y(algs)
 WHERE alg_is_3x3_top_layer_set(puzzle, set_slug)
   AND (alg_starts_with_y_rotation(standard) OR alg_json_has_leading_y(algs));

DROP FUNCTION alg_rewrite_json_leading_y(JSONB);
DROP FUNCTION alg_rewrite_leading_y_as_auf(TEXT);

CREATE OR REPLACE FUNCTION trg_alg_case_no_leading_y()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF alg_is_3x3_top_layer_set(NEW.puzzle, NEW.set_slug)
     AND (alg_starts_with_y_rotation(NEW.standard) OR alg_json_has_leading_y(NEW.algs)) THEN
    RAISE EXCEPTION 'top-layer alg cannot start with y rotation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_alg_submission_no_leading_y()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF alg_is_3x3_top_layer_set(NEW.puzzle, NEW.set_slug)
     AND alg_starts_with_y_rotation(NEW.alg) THEN
    RAISE EXCEPTION 'top-layer alg cannot start with y rotation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER alg_cases_no_leading_y
  BEFORE INSERT OR UPDATE OF puzzle, set_slug, standard, algs ON alg_cases
  FOR EACH ROW EXECUTE FUNCTION trg_alg_case_no_leading_y();

CREATE TRIGGER alg_submissions_no_leading_y
  BEFORE INSERT OR UPDATE OF puzzle, set_slug, alg ON alg_submissions
  FOR EACH ROW EXECUTE FUNCTION trg_alg_submission_no_leading_y();
