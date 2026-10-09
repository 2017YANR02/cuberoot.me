ALTER TABLE role_preview_sessions
  ADD COLUMN reason TEXT;

ALTER TABLE role_preview_sessions
  DROP CONSTRAINT role_preview_sessions_role_check;
ALTER TABLE role_preview_sessions
  ADD CONSTRAINT role_preview_sessions_role_check
  CHECK (role IN ('admin', 'member', 'user', 'user-complete', 'guest', 'impersonation'));

ALTER TABLE role_preview_sessions
  ADD CONSTRAINT role_preview_sessions_impersonation_check
  CHECK (
    (role = 'impersonation' AND user_id IS NOT NULL AND reason IS NOT NULL
      AND CHAR_LENGTH(BTRIM(reason)) BETWEEN 5 AND 200)
    OR (role <> 'impersonation' AND reason IS NULL)
  );
