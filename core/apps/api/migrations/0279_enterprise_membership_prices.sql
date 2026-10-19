-- Reviewed one-time offer prices. Existing orders retain their recorded amount.
-- Renewal prices and debit authorization switches are unchanged.
UPDATE membership_plans
SET price_cents = CASE slug
  WHEN 'monthly' THEN 3999
  WHEN 'yearly' THEN 39900
  WHEN 'enterprise_monthly' THEN 39900
  WHEN 'enterprise_yearly' THEN 399900
END
WHERE slug IN ('monthly', 'yearly', 'enterprise_monthly', 'enterprise_yearly');
