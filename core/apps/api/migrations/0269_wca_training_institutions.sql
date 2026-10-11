-- Public learning affiliations reuse the teaching platform's organization identity.
-- This registry is explicit opt-in; private tenant/student data is never published.
CREATE TABLE wca_training_institutions (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT
);
CREATE TABLE wca_student_institutions (
  id BIGSERIAL PRIMARY KEY,
  student_wca_id VARCHAR(10),
  named_student_id UUID REFERENCES wca_teacher_named_students(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES wca_training_institutions(organization_id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((student_wca_id IS NOT NULL)::int + (named_student_id IS NOT NULL)::int = 1),
  UNIQUE (student_wca_id),
  UNIQUE (named_student_id)
);

-- Maintainer-requested institution and one-time assignment of existing students.
-- Existing organizations retain their membership. A new organization must have
-- its real maintainer as an active owner before the deferred guard runs at COMMIT.
DO $$
DECLARE
  owner_user_id BIGINT;
  institution_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE name = '上海魔方根科技有限公司') THEN
    SELECT id INTO STRICT owner_user_id
    FROM app_users
    WHERE wca_id = '2017YANR02' AND merged_into_user_id IS NULL;

    INSERT INTO organizations (slug, name, created_by_user_id)
    VALUES ('shanghai-cuberoot-training', '上海魔方根科技有限公司', owner_user_id)
    RETURNING id INTO institution_id;
    INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
    VALUES (institution_id, owner_user_id, 'owner', 'active', NOW());
  END IF;
END;
$$;
-- Do not infer future affiliations or grant students tenant access.
INSERT INTO wca_training_institutions (organization_id)
SELECT id FROM organizations WHERE name = '上海魔方根科技有限公司'
ORDER BY created_at, id LIMIT 1
ON CONFLICT DO NOTHING;
INSERT INTO wca_student_institutions (student_wca_id, organization_id)
SELECT DISTINCT teacher.student_wca_id, institution.organization_id
FROM wca_teachers teacher
CROSS JOIN wca_training_institutions institution
JOIN organizations org ON org.id = institution.organization_id
WHERE teacher.teacher_wca_id = '2017YANR02' AND org.name = '上海魔方根科技有限公司'
ON CONFLICT (student_wca_id) DO NOTHING;
INSERT INTO wca_student_institutions (named_student_id, organization_id)
SELECT student.id, institution.organization_id
FROM wca_teacher_named_students student
CROSS JOIN wca_training_institutions institution
JOIN organizations org ON org.id = institution.organization_id
WHERE student.teacher_wca_id = '2017YANR02' AND org.name = '上海魔方根科技有限公司'
ON CONFLICT (named_student_id) DO NOTHING;
