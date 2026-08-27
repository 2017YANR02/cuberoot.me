-- Extend CubePB-compatible average tiers with Ao10000.

DO $$
DECLARE
  set_size_constraint TEXT;
BEGIN
  SELECT conname
    INTO set_size_constraint
    FROM pg_constraint
   WHERE conrelid = 'pb_records'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%set_size = 3%'
   LIMIT 1;

  IF set_size_constraint IS NULL THEN
    RAISE EXCEPTION 'pb_records set-size constraint not found';
  END IF;

  EXECUTE format(
    'ALTER TABLE pb_records DROP CONSTRAINT %I',
    set_size_constraint
  );
END
$$;

ALTER TABLE pb_records
  ADD CONSTRAINT pb_records_set_size_check CHECK (
    (record_type = 'single' AND set_size = 1) OR
    (record_type = 'mean' AND set_size = 3) OR
    (record_type = 'average' AND set_size IN (5, 12, 50, 100, 1000, 10000))
  );
