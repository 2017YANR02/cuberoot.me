ALTER TABLE app_users ADD COLUMN deskpet_selection VARCHAR(80)
  CHECK (deskpet_selection IS NULL OR deskpet_selection ~ '^[a-z][a-z0-9-]{0,79}$');
