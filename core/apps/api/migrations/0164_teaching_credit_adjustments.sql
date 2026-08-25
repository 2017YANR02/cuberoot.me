-- Stage 2 finance hardening: serialize every package ledger write and make
-- refunds/reversals exact, append-only credit corrections.

ALTER TABLE student_packages
  ADD COLUMN credit_ledger_revision BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM lesson_credit_ledger
    WHERE NOT (
      (entry_type IN ('purchase', 'grant') AND delta > 0
        AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL)
      OR (entry_type = 'consume' AND delta < 0
        AND attendance_id IS NOT NULL AND session_id IS NOT NULL AND reversal_of_ledger_id IS NULL)
      OR (entry_type = 'refund' AND delta < 0
        AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL
        AND source_system IS NOT NULL AND source_ref IS NOT NULL
        AND reason = BTRIM(reason) AND CHAR_LENGTH(reason) BETWEEN 1 AND 500)
      OR (entry_type = 'adjustment' AND delta <> 0
        AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL)
      OR (entry_type = 'expiration' AND delta < 0
        AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL)
      OR (entry_type = 'reversal'
        AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NOT NULL
        AND source_system IS NULL AND source_ref IS NULL AND source_line_ref IS NULL
        AND reason = BTRIM(reason) AND CHAR_LENGTH(reason) BETWEEN 1 AND 500)
    )
  ) THEN
    RAISE EXCEPTION 'existing lesson credit ledger rows violate the 0164 entry shape'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM lesson_credit_ledger reversal
    LEFT JOIN lesson_credit_ledger target
      ON target.organization_id = reversal.organization_id
     AND target.id = reversal.reversal_of_ledger_id
    WHERE reversal.entry_type = 'reversal'
      AND (
        target.id IS NULL
        OR target.student_package_id <> reversal.student_package_id
        OR target.student_id <> reversal.student_id
        OR target.entry_type = 'reversal'
        OR reversal.delta <> -target.delta
      )
  ) THEN
    RAISE EXCEPTION 'existing lesson credit ledger reversals violate the 0164 target contract'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lesson_credit_ledger
    GROUP BY organization_id, student_package_id
    HAVING SUM(delta) < 0
  ) THEN
    RAISE EXCEPTION 'existing student package credit balance is negative'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE lesson_credit_ledger
  DROP CONSTRAINT lesson_credit_ledger_consume_shape;

ALTER TABLE lesson_credit_ledger
  ADD CONSTRAINT lesson_credit_ledger_entry_shape CHECK (
    (entry_type IN ('purchase', 'grant') AND delta > 0
      AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL)
    OR (entry_type = 'consume' AND delta < 0
      AND attendance_id IS NOT NULL AND session_id IS NOT NULL AND reversal_of_ledger_id IS NULL)
    OR (entry_type = 'refund' AND delta < 0
      AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL
      AND source_system IS NOT NULL AND source_ref IS NOT NULL
      AND reason = BTRIM(reason) AND CHAR_LENGTH(reason) BETWEEN 1 AND 500)
    OR (entry_type = 'adjustment' AND delta <> 0
      AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL)
    OR (entry_type = 'expiration' AND delta < 0
      AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NULL)
    OR (entry_type = 'reversal'
      AND attendance_id IS NULL AND session_id IS NULL AND reversal_of_ledger_id IS NOT NULL
      AND source_system IS NULL AND source_ref IS NULL AND source_line_ref IS NULL
      AND reason = BTRIM(reason) AND CHAR_LENGTH(reason) BETWEEN 1 AND 500)
  );

CREATE UNIQUE INDEX uq_lesson_credit_ledger_refund_source
  ON lesson_credit_ledger (
    organization_id, source_system, source_ref, COALESCE(source_line_ref, '')
  )
  WHERE entry_type = 'refund';

CREATE INDEX idx_lesson_credit_ledger_credit_adjustments
  ON lesson_credit_ledger (organization_id, created_at DESC, id DESC)
  WHERE entry_type IN ('adjustment', 'refund', 'reversal', 'expiration');

CREATE OR REPLACE FUNCTION trg_validate_lesson_credit_ledger_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_balance BIGINT;
  target_row lesson_credit_ledger%ROWTYPE;
BEGIN
  -- This real parent-row write is the serialization point shared by session
  -- completion, refunds, reversals, and direct SQL ledger inserts.
  UPDATE student_packages
  SET credit_ledger_revision = credit_ledger_revision + 1
  WHERE organization_id = NEW.organization_id
    AND id = NEW.student_package_id
    AND student_id = NEW.student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student package does not match ledger tenant and student'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.entry_type = 'reversal' THEN
    SELECT * INTO target_row
    FROM lesson_credit_ledger
    WHERE organization_id = NEW.organization_id
      AND id = NEW.reversal_of_ledger_id;

    IF NOT FOUND
       OR target_row.student_package_id <> NEW.student_package_id
       OR target_row.student_id <> NEW.student_id
       OR target_row.entry_type = 'reversal'
       OR NEW.delta <> -target_row.delta THEN
      RAISE EXCEPTION 'credit ledger reversal must exactly reverse one entry in the same package'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT COALESCE(SUM(delta), 0)
  INTO current_balance
  FROM lesson_credit_ledger
  WHERE organization_id = NEW.organization_id
    AND student_package_id = NEW.student_package_id;

  IF current_balance + NEW.delta < 0 THEN
    RAISE EXCEPTION 'student package credit balance cannot be negative'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_credit_ledger_validate_insert
BEFORE INSERT ON lesson_credit_ledger
FOR EACH ROW EXECUTE FUNCTION trg_validate_lesson_credit_ledger_insert();
