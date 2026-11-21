-- Instructor identity remains platform_instructors.id; directory entries are
-- its profile, not a separate grant of teaching authority. No existing
-- course, order, application, profile or visibility preference is deleted.
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid='teacher_directory_entries'::regclass AND contype='c'
      AND ((pg_get_constraintdef(oid) LIKE '%contact%' AND pg_get_constraintdef(oid) LIKE '%website%')
        OR (pg_get_constraintdef(oid) LIKE '%description_zh%' AND pg_get_constraintdef(oid) LIKE '%description_en%'))
  LOOP
    EXECUTE format('ALTER TABLE teacher_directory_entries DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

-- A hidden teacher draft can be completed later; contact details are optional
-- for teachers. Organizations keep the previous requirements.
ALTER TABLE teacher_directory_entries
  ADD CONSTRAINT teacher_directory_description_required
    CHECK ((kind='teacher' AND NOT is_visible) OR description_zh<>'' OR description_en<>''),
  ADD CONSTRAINT teacher_directory_organization_contact_required
    CHECK (kind='teacher' OR contact<>'' OR website<>'');

-- Attach an existing profile only where the account owner key matches exactly,
-- there is exactly one candidate, and nobody else has claimed it.
WITH candidates AS (
  SELECT i.id AS instructor_id, MIN(t.id) AS entry_id
  FROM platform_instructors i
  JOIN app_users u ON u.id=i.user_id
  JOIN teacher_directory_entries t ON t.owner_key=COALESCE(NULLIF(u.wca_id,''),'u'||u.id::text) AND t.kind='teacher'
    AND (t.wca_id IS NULL OR t.wca_id=u.wca_id)
  WHERE i.teacher_entry_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM platform_instructors other WHERE other.teacher_entry_id=t.id)
  GROUP BY i.id HAVING COUNT(*)=1
)
UPDATE platform_instructors i SET teacher_entry_id=c.entry_id
FROM candidates c WHERE i.id=c.instructor_id AND i.teacher_entry_id IS NULL;

-- Existing active instructors without any possible legacy profile receive a
-- hidden draft. Ambiguous/curated WCA records are left for administrator review.
WITH inserted AS (
  INSERT INTO teacher_directory_entries
    (kind,name_zh,description_zh,description_en,is_visible,owner_key,owner_name,wca_id)
  SELECT 'teacher',LEFT(i.display_name_snapshot,160),LEFT(i.bio_zh,2000),LEFT(i.bio_en,2000),FALSE,
    COALESCE(NULLIF(u.wca_id,''),'u'||u.id::text),i.display_name_snapshot,NULLIF(u.wca_id,'')
  FROM platform_instructors i JOIN app_users u ON u.id=i.user_id
  WHERE i.status='active' AND i.teacher_entry_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM teacher_directory_entries t WHERE t.kind='teacher'
        AND (t.owner_key=COALESCE(NULLIF(u.wca_id,''),'u'||u.id::text)
          OR (u.wca_id IS NOT NULL AND t.wca_id=u.wca_id))
    )
  RETURNING id,owner_key
)
UPDATE platform_instructors i SET teacher_entry_id=t.id
FROM app_users u, inserted t
WHERE i.user_id=u.id AND i.teacher_entry_id IS NULL
  AND t.owner_key=COALESCE(NULLIF(u.wca_id,''),'u'||u.id::text);
