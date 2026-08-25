-- Privacy-safe timer startup telemetry. One UUID represents one page opening;
-- the row advances from attempt to success/failure without storing UA, IP, or error text.

CREATE TABLE timer_boot_events (
  boot_id UUID PRIMARY KEY,
  path VARCHAR(16) NOT NULL CHECK (path IN ('/timer', '/zh/timer')),
  outcome VARCHAR(12) NOT NULL CHECK (outcome IN ('attempt', 'success', 'failure')),
  failure_kind VARCHAR(16) CHECK (failure_kind IN (
    'network', 'chunk', 'script', 'promise', 'timeout', 'runtime', 'unknown'
  )),
  engine_family VARCHAR(16) NOT NULL CHECK (engine_family IN ('chromium', 'webkit', 'gecko', 'other')),
  engine_major SMALLINT CHECK (engine_major BETWEEN 1 AND 999),
  os_family VARCHAR(16) NOT NULL CHECK (os_family IN ('android', 'ios', 'windows', 'macos', 'linux', 'other')),
  os_major SMALLINT CHECK (os_major BETWEEN 1 AND 999),
  container VARCHAR(16) NOT NULL CHECK (container IN ('wechat', 'webview', 'browser')),
  support_status VARCHAR(20) NOT NULL CHECK (support_status IN ('supported', 'below-baseline', 'unknown')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT timer_boot_events_failure_shape CHECK (
    (outcome = 'failure' AND failure_kind IS NOT NULL)
    OR (outcome <> 'failure' AND failure_kind IS NULL)
  )
);

CREATE INDEX idx_timer_boot_events_attempted_at ON timer_boot_events(attempted_at);
