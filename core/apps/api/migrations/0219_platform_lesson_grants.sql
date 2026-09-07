-- NULL preserves whole-course grants; scoped grants are immutable ledger snapshots.
ALTER TABLE platform_entitlement_ledger
  ADD COLUMN lesson_ids UUID[] CHECK (
    lesson_ids IS NULL OR (
      cardinality(lesson_ids) BETWEEN 1 AND 1000
      AND array_ndims(lesson_ids) = 1
      AND array_position(lesson_ids, NULL) IS NULL
    )
  );
