CREATE TABLE user_wca_friend_contacts (
  owner_user_id BIGINT      NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  wca_id        VARCHAR(10) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  country_iso2  VARCHAR(2)  NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_user_id, wca_id),
  CHECK (wca_id ~ '^[0-9]{4}[A-Z]{4}[0-9]{2}$'),
  CHECK (length(btrim(name)) > 0),
  CHECK (country_iso2 ~ '^[a-z]{2}$')
);
CREATE INDEX idx_user_wca_friend_contacts_owner_created
  ON user_wca_friend_contacts(owner_user_id, created_at DESC);
