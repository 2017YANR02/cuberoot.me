CREATE TABLE user_pets (
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  pet_id TEXT NOT NULL CHECK (pet_id ~ '^[a-z][a-z0-9-]{0,79}$'),
  adopted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  care JSONB NOT NULL CHECK (jsonb_typeof(care) = 'object'),
  PRIMARY KEY (user_id, pet_id)
);
