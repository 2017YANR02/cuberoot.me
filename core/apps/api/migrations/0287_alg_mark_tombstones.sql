-- Retain clear timestamps so an older device cannot recreate a deleted mark.
-- The existing CHECK permits NULL; NULL means a tombstone, not a visible status.
ALTER TABLE alg_case_marks ALTER COLUMN status DROP NOT NULL;
