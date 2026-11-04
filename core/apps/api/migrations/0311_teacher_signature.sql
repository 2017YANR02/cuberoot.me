-- Public attribution preferences belong to the teacher account, not student affiliations.
ALTER TABLE app_users
  ADD COLUMN teacher_signature_mode VARCHAR(16) NOT NULL DEFAULT 'name' CHECK (teacher_signature_mode IN ('name', 'organization', 'both')),
  ADD COLUMN teacher_signature_organization VARCHAR(160) NOT NULL DEFAULT '' CHECK (CHAR_LENGTH(teacher_signature_organization) <= 40);
