UPDATE membership_plans AS p
SET name_zh = label.zh, name_en = label.en
FROM (VALUES
  ('monthly', 'Pro 月付', 'Pro Monthly'),
  ('yearly', 'Pro 年付', 'Pro Annual'),
  ('monthly_auto_renew', 'Pro 连续包月', 'Pro Monthly Auto-renewal'),
  ('yearly_auto_renew', 'Pro 连续包年', 'Pro Annual Auto-renewal'),
  ('enterprise_monthly', 'Pro 企业月付', 'Pro Monthly for Business'),
  ('enterprise_yearly', 'Pro 企业年付', 'Pro Annual for Business'),
  ('enterprise_monthly_auto_renew', 'Pro 企业连续包月', 'Pro Monthly Auto-renewal for Business'),
  ('enterprise_yearly_auto_renew', 'Pro 企业连续包年', 'Pro Annual Auto-renewal for Business')
) AS label(slug, zh, en)
WHERE p.slug = label.slug;
