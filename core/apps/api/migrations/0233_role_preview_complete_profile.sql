-- Extend test personas only; account permissions still come from is_admin / drive_members.
ALTER TABLE role_preview_profiles DROP CONSTRAINT role_preview_profiles_role_check;
ALTER TABLE role_preview_profiles ADD CONSTRAINT role_preview_profiles_role_check
  CHECK (role IN ('admin', 'member', 'user', 'user-complete'));
ALTER TABLE role_preview_sessions DROP CONSTRAINT role_preview_sessions_role_check;
ALTER TABLE role_preview_sessions ADD CONSTRAINT role_preview_sessions_role_check
  CHECK (role IN ('admin', 'member', 'user', 'user-complete', 'guest'));
