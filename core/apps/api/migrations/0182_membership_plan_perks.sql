-- Keep personal entitlements consistent across one-time and future auto-renew plans.
UPDATE membership_plans
SET perks = '["unlimited_333_cloud_optimal","expert_recon_10_monthly","badge","early","thanks"]'::jsonb
WHERE slug IN ('monthly', 'yearly', 'monthly_auto_renew', 'yearly_auto_renew');

UPDATE membership_plans
SET perks = '["unlimited_333_cloud_optimal","expert_recon_10_monthly","badge","early","thanks","lifetime"]'::jsonb
WHERE slug = 'lifetime';

-- Enterprise plans include every personal entitlement plus organization features.
UPDATE membership_plans
SET perks = '["unlimited_333_cloud_optimal","expert_recon_10_monthly","badge","early","thanks","teacher_student_profile_ranking","enterprise_profile","enterprise_content_storage_custom_course"]'::jsonb
WHERE slug IN ('enterprise_monthly', 'enterprise_yearly');
