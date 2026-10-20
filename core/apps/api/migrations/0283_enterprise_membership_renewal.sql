-- Enterprise offers stay hidden from ordinary checkout. Merchant approval remains required.
INSERT INTO membership_plans (slug, name_zh, name_en, period, period_count, price_cents, currency, perks, active, sort)
SELECT renewal.slug, renewal.zh, renewal.en, p.period, 1, renewal.cents, 'CNY', p.perks, FALSE, p.sort + 1
FROM (VALUES
 ('enterprise_monthly', 'enterprise_monthly_auto_renew', '企业连续包月', 'Enterprise monthly auto-renewal', 29900)
) AS renewal(source, slug, zh, en, cents)
JOIN membership_plans p ON p.slug = renewal.source
ON CONFLICT (slug) DO NOTHING;
ALTER TABLE membership_contracts DROP CONSTRAINT membership_contracts_plan_slug_check;
ALTER TABLE membership_contracts ADD CONSTRAINT membership_contracts_plan_slug_check CHECK (plan_slug IN ('monthly_auto_renew', 'yearly_auto_renew', 'enterprise_monthly_auto_renew'));
ALTER TABLE membership_contracts DROP CONSTRAINT membership_contracts_check;
ALTER TABLE membership_contracts ADD CONSTRAINT membership_contracts_check CHECK ((plan_slug IN ('monthly_auto_renew', 'enterprise_monthly_auto_renew') AND period = 'month')
      OR (plan_slug IN ('yearly_auto_renew') AND period = 'year'));

-- Retain historical plans/orders, but stop selling enterprise annual membership.
UPDATE membership_plans SET active = FALSE WHERE slug IN ('enterprise_yearly', 'enterprise_yearly_auto_renew');
