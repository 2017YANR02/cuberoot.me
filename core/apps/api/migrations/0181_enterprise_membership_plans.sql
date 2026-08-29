-- Label the existing transition offers as individual plans, then add enterprise plans.
UPDATE membership_plans
SET name_zh = CASE slug
      WHEN 'monthly' THEN '个人用户（月度）'
      WHEN 'yearly' THEN '个人用户（年度）'
    END,
    name_en = CASE slug
      WHEN 'monthly' THEN 'Individual monthly'
      WHEN 'yearly' THEN 'Individual annual'
    END
WHERE slug IN ('monthly', 'yearly');

INSERT INTO membership_plans (
  slug, name_zh, name_en, period, period_count, price_cents, currency, perks, active, sort
) VALUES
  (
    'enterprise_monthly', '企业用户（月度）', 'Enterprise monthly', 'month', 1, 69900, 'CNY',
    '["badge","early","thanks"]'::jsonb, TRUE, 25
  ),
  (
    'enterprise_yearly', '企业用户（年度）', 'Enterprise annual', 'year', 1, 698000, 'CNY',
    '["badge","early","thanks"]'::jsonb, TRUE, 26
  )
ON CONFLICT (slug) DO NOTHING;
