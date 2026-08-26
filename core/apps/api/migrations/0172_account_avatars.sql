-- Canonical avatar source: Clawd preset, owned upload, or automatic WCA profile photo.
ALTER TABLE app_users
  ADD COLUMN avatar_source VARCHAR(16) NOT NULL DEFAULT 'auto',
  ADD COLUMN avatar_preset VARCHAR(32),
  ADD CONSTRAINT chk_app_users_avatar_source
    CHECK (avatar_source IN ('auto', 'clawd', 'upload')),
  ADD CONSTRAINT chk_app_users_avatar_shape CHECK (
    (avatar_source = 'clawd' AND avatar_preset IS NOT NULL AND avatar_url IS NULL)
    OR (avatar_source = 'upload' AND avatar_preset IS NULL AND avatar_url IS NOT NULL)
    OR (avatar_source = 'auto' AND avatar_preset IS NULL)
  );

-- Before this feature, only identity providers populated avatar_url. Keep the
-- verified WCA default and let every other automatic profile fall back to Clawd.
UPDATE app_users
SET avatar_url = NULL
WHERE wca_id IS NULL;

DO $$
BEGIN
  -- Domain-scoped local seeds may omit the WCA cache table.
  IF to_regclass('public.wca_users') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE app_users AS app
      SET avatar_url = wca.avatar_url
      FROM wca_users AS wca
      WHERE app.wca_id = wca.wca_id
    $sql$;
  END IF;
END
$$;
