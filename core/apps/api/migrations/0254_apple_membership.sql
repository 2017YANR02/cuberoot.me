-- Apple evidence is separate from website payment grants. Account deletion
-- tombstones ownership; a restored receipt cannot attach to a different account.
CREATE TABLE apple_membership_accounts (
  token UUID PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX apple_membership_accounts_user ON apple_membership_accounts(user_id);
CREATE TABLE apple_membership_subscriptions (
  environment TEXT NOT NULL CHECK (environment IN ('Production', 'Sandbox')),
  original_transaction_id TEXT NOT NULL,
  account_token UUID NOT NULL REFERENCES apple_membership_accounts(token),
  transaction_id TEXT NOT NULL,
  product_id TEXT NOT NULL CHECK (product_id IN ('me.cuberoot.app.membership.monthly', 'me.cuberoot.app.membership.yearly')),
  status SMALLINT NOT NULL CHECK (status BETWEEN 1 AND 5),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL,
  grants_membership BOOLEAN NOT NULL DEFAULT FALSE,
  signed_transaction TEXT NOT NULL,
  signed_renewal TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (environment, original_transaction_id)
);
CREATE TABLE apple_membership_notifications (
  environment TEXT NOT NULL CHECK (environment IN ('Production', 'Sandbox')),
  notification_id UUID NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (environment, notification_id)
);
-- Every existing website grant remains intact, including lifetime memberships.
-- Effective expiry is the maximum independent grant, never their sum.
CREATE VIEW effective_memberships AS
SELECT DISTINCT ON (wca_id) * FROM (
  SELECT m.* FROM memberships m
  UNION ALL
  SELECT COALESCE(u.wca_id, 'u' || u.id::text)::VARCHAR(20), NULL::BIGINT,
    COALESCE(u.display_name, '')::VARCHAR(200), u.avatar_url,
    'apple_auto_renew'::VARCHAR(40), a.created_at, s.expires_at,
    'apple'::VARCHAR(20), NULL::VARCHAR(64), NULL::VARCHAR(200), NULL::VARCHAR(12),
    NULL::TEXT, a.created_at, s.checked_at
  FROM apple_membership_subscriptions s
  JOIN apple_membership_accounts a ON a.token = s.account_token
  JOIN app_users u ON u.id = a.user_id
  WHERE s.grants_membership AND s.status IN (1, 4)
) grants ORDER BY wca_id, expires_at DESC NULLS FIRST, created_at;
