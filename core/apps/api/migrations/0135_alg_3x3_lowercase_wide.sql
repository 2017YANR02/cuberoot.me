-- 三阶宽层公式统一用小写字母，并在数据库写入边界自动规范化。

CREATE OR REPLACE FUNCTION alg_canonicalize_3x3_wide_moves(p_alg TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(
            replace(p_alg, 'Rw', 'r'),
            'Lw', 'l'
          ),
          'Uw', 'u'
        ),
        'Dw', 'd'
      ),
      'Fw', 'f'
    ),
    'Bw', 'b'
  );
$$;

CREATE OR REPLACE FUNCTION alg_canonicalize_3x3_json_wide_moves(p_node JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  field_name TEXT;
  field_value JSONB;
  result JSONB;
BEGIN
  IF jsonb_typeof(p_node) = 'array' THEN
    SELECT COALESCE(jsonb_agg(alg_canonicalize_3x3_json_wide_moves(value) ORDER BY ord), '[]'::jsonb)
      INTO result
      FROM jsonb_array_elements(p_node) WITH ORDINALITY AS entries(value, ord);
    RETURN result;
  ELSIF jsonb_typeof(p_node) = 'object' THEN
    result := p_node;
    FOR field_name, field_value IN SELECT key, value FROM jsonb_each(p_node) LOOP
      IF field_name IN ('alg', 'algHtml', 'setup', 'scramble')
         AND jsonb_typeof(field_value) = 'string' THEN
        result := jsonb_set(
          result,
          ARRAY[field_name],
          to_jsonb(alg_canonicalize_3x3_wide_moves(field_value#>>'{}'))
        );
      ELSIF jsonb_typeof(field_value) IN ('array', 'object') THEN
        result := jsonb_set(result, ARRAY[field_name], alg_canonicalize_3x3_json_wide_moves(field_value));
      END IF;
    END LOOP;
    RETURN result;
  END IF;
  RETURN p_node;
END;
$$;

UPDATE alg_cases
   SET setup = alg_canonicalize_3x3_wide_moves(setup),
       standard = alg_canonicalize_3x3_wide_moves(standard),
       algs = alg_canonicalize_3x3_json_wide_moves(algs),
       meta = alg_canonicalize_3x3_json_wide_moves(meta)
 WHERE puzzle = '3x3'
   AND (
     setup ~ '(Rw|Lw|Uw|Dw|Fw|Bw)'
     OR standard ~ '(Rw|Lw|Uw|Dw|Fw|Bw)'
     OR algs::TEXT ~ '(Rw|Lw|Uw|Dw|Fw|Bw)'
     OR meta::TEXT ~ '(Rw|Lw|Uw|Dw|Fw|Bw)'
   );

UPDATE alg_submissions
   SET alg = alg_canonicalize_3x3_wide_moves(alg)
 WHERE puzzle = '3x3'
   AND alg ~ '(Rw|Lw|Uw|Dw|Fw|Bw)';

CREATE OR REPLACE FUNCTION trg_alg_case_canonicalize_3x3_wide()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.puzzle = '3x3' THEN
    NEW.setup := alg_canonicalize_3x3_wide_moves(NEW.setup);
    NEW.standard := alg_canonicalize_3x3_wide_moves(NEW.standard);
    NEW.algs := alg_canonicalize_3x3_json_wide_moves(NEW.algs);
    NEW.meta := alg_canonicalize_3x3_json_wide_moves(NEW.meta);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_alg_submission_canonicalize_3x3_wide()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.puzzle = '3x3' THEN
    NEW.alg := alg_canonicalize_3x3_wide_moves(NEW.alg);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER alg_cases_canonicalize_3x3_wide
  BEFORE INSERT OR UPDATE OF puzzle, setup, standard, algs, meta ON alg_cases
  FOR EACH ROW EXECUTE FUNCTION trg_alg_case_canonicalize_3x3_wide();

CREATE TRIGGER alg_submissions_canonicalize_3x3_wide
  BEFORE INSERT OR UPDATE OF puzzle, alg ON alg_submissions
  FOR EACH ROW EXECUTE FUNCTION trg_alg_submission_canonicalize_3x3_wide();
