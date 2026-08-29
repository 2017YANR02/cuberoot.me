-- Keep the unreleased auto-renew offers in the shared plan admin, hidden by default.
INSERT INTO membership_plans (
  slug, name_zh, name_en, period, period_count, price_cents, currency, perks, active, sort
) VALUES
  (
    'monthly_auto_renew', '连续包月', 'Monthly auto-renewal', 'month', 1, 1999, 'CNY',
    '["auto_renew","notice","cancel"]'::jsonb, FALSE, 5
  ),
  (
    'yearly_auto_renew', '连续包年', 'Annual auto-renewal', 'year', 1, 9900, 'CNY',
    '["auto_renew","notice","cancel"]'::jsonb, FALSE, 15
  )
ON CONFLICT (slug) DO NOTHING;
