-- Reuse the consent/event store; never revive the retired raw pageviews table.
CREATE INDEX idx_platform_analytics_web_report
  ON platform_analytics_events (occurred_at, (dimensions->>'audience'))
  WHERE surface = 'web' AND dimensions->>'schemaVersion' = '1';
CREATE INDEX idx_platform_privacy_consents_analytics_latest
  ON platform_privacy_consents (user_id, decided_at DESC, id DESC)
  WHERE purpose = 'analytics' AND user_id IS NOT NULL;
CREATE INDEX idx_platform_privacy_consents_analytics_anonymous_latest
  ON platform_privacy_consents (anonymous_subject_hash, decided_at DESC, id DESC)
  WHERE purpose = 'analytics' AND anonymous_subject_hash IS NOT NULL;
