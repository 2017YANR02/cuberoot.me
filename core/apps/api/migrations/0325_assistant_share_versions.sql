ALTER TABLE site_assistant_shares ADD COLUMN snapshot_hash TEXT;
-- Preserve every published URL and deduplicate identical content versions.
UPDATE site_assistant_shares SET snapshot_hash =
  encode(sha256(convert_to(question, 'UTF8')), 'hex') || ':' ||
  encode(sha256(convert_to(answer, 'UTF8')), 'hex');
ALTER TABLE site_assistant_shares ALTER COLUMN snapshot_hash SET NOT NULL;
ALTER TABLE site_assistant_shares DROP CONSTRAINT site_assistant_shares_user_id_request_id_key;
ALTER TABLE site_assistant_shares ADD CONSTRAINT site_assistant_shares_version_key
  UNIQUE (user_id, request_id, snapshot_hash);
