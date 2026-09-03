ALTER TABLE app_users
  ADD COLUMN public_intro TEXT
  CHECK (public_intro IS NULL OR CHAR_LENGTH(public_intro) <= 1000),
  ADD COLUMN public_intro_image_ids JSONB NOT NULL DEFAULT '[]'::jsonb
  CHECK (
    JSONB_TYPEOF(public_intro_image_ids) = 'array'
    AND JSONB_ARRAY_LENGTH(public_intro_image_ids) <= 8
  );
