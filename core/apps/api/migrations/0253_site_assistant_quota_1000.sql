-- Preserve existing daily usage while increasing the shared allowance.
ALTER TABLE site_assistant_daily_usage
  DROP CONSTRAINT site_assistant_daily_usage_questions_check,
  ADD CONSTRAINT site_assistant_daily_usage_questions_check CHECK (questions BETWEEN 1 AND 1000);
