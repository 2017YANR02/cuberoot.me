ALTER TABLE career_applications
  ADD COLUMN ai_tools TEXT NOT NULL DEFAULT '',
  ADD COLUMN ai_subscription_cost TEXT NOT NULL DEFAULT '';
