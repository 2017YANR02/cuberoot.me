ALTER TABLE app_users
  ADD COLUMN full_name VARCHAR(50),
  ADD CONSTRAINT chk_app_users_full_name CHECK (
    full_name IS NULL OR (
      full_name = BTRIM(full_name)
      AND CHAR_LENGTH(full_name) BETWEEN 1 AND 50
      AND full_name !~ '[[:cntrl:]]'
    )
  );
