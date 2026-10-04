-- Google grants are independent of website/Apple grants; deletion preserves ownership tombstones.
CREATE TABLE google_membership_accounts (
  token UUID PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX google_membership_accounts_user ON google_membership_accounts(user_id);
CREATE TABLE google_membership_subscriptions (
  purchase_token TEXT PRIMARY KEY,
  account_token UUID NOT NULL REFERENCES google_membership_accounts(token),
  product_id TEXT NOT NULL CHECK (product_id IN ('me.cuberoot.app.membership.monthly', 'me.cuberoot.app.membership.yearly')),
  state TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL,
  grants_membership BOOLEAN NOT NULL DEFAULT FALSE,
  test_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  superseded BOOLEAN NOT NULL DEFAULT FALSE,
  linked_purchase_token TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX google_membership_subscriptions_owner ON google_membership_subscriptions(account_token);
CREATE INDEX google_membership_subscriptions_link ON google_membership_subscriptions(linked_purchase_token);
CREATE OR REPLACE VIEW effective_memberships AS
SELECT DISTINCT ON (wca_id) * FROM (
  SELECT m.wca_id, m.vip_number, m.name, m.avatar_url, m.plan_slug,
    m.started_at, m.expires_at, m.source, m.last_order_no, m.contact,
    m.contact_kind, m.note, m.created_at, m.updated_at FROM memberships m
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
  UNION ALL
  SELECT COALESCE(u.wca_id, 'u' || u.id::text)::VARCHAR(20), NULL::BIGINT,
    COALESCE(u.display_name, '')::VARCHAR(200), u.avatar_url,
    'google_auto_renew'::VARCHAR(40), a.created_at, s.expires_at,
    'google'::VARCHAR(20), NULL::VARCHAR(64), NULL::VARCHAR(200), NULL::VARCHAR(12),
    NULL::TEXT, a.created_at, s.checked_at
  FROM google_membership_subscriptions s
  JOIN google_membership_accounts a ON a.token = s.account_token
  JOIN app_users u ON u.id = a.user_id
  WHERE s.grants_membership AND NOT s.superseded
    AND s.state IN ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED')
) grants ORDER BY wca_id, expires_at DESC NULLS FIRST, created_at;
