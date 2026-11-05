ALTER TABLE collaborative_documents
  ADD COLUMN general_access VARCHAR(16) NOT NULL DEFAULT 'restricted' CHECK (general_access IN ('restricted', 'admins', 'anyone')),
  ADD COLUMN general_role VARCHAR(9) NOT NULL DEFAULT 'viewer' CHECK (general_role IN ('viewer', 'commenter', 'editor')),
  ADD COLUMN editors_can_share BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN editors_can_export BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN viewers_can_export BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE collaborative_document_members DROP CONSTRAINT collaborative_document_members_role_check;
ALTER TABLE collaborative_document_members ALTER COLUMN role TYPE VARCHAR(9);
ALTER TABLE collaborative_document_members ADD CONSTRAINT collaborative_document_members_role_check
  CHECK (role IN ('owner', 'editor', 'commenter', 'viewer'));
