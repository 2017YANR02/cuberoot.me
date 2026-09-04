CREATE TABLE app_boot_diagnostics (
  event_id         UUID PRIMARY KEY,
  diagnostic_code  VARCHAR(40) NOT NULL CHECK (
    diagnostic_code ~ '^(APP|TMR)-(NET|CHUNK|SCRIPT|PROMISE|TIMEOUT|RUNTIME|UNKNOWN)-[0-9A-Z]{7}$'
  ),
  kind              VARCHAR(16) NOT NULL CHECK (kind IN (
    'network', 'chunk', 'script', 'promise', 'timeout', 'runtime', 'unknown'
  )),
  path              VARCHAR(512) NOT NULL CHECK (
    LEFT(path, 1) = '/' AND POSITION('?' IN path) = 0 AND POSITION('#' IN path) = 0
  ),
  online            BOOLEAN,
  error_name        VARCHAR(100) NOT NULL,
  error_message     VARCHAR(500) NOT NULL,
  evidence          JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  device_type       VARCHAR(16) NOT NULL CHECK (device_type IN ('phone', 'tablet', 'desktop', 'other')),
  browser_family    VARCHAR(16) NOT NULL CHECK (browser_family IN ('chrome', 'edge', 'firefox', 'safari', 'wechat', 'webview', 'other')),
  browser_major     SMALLINT CHECK (browser_major BETWEEN 1 AND 999),
  os_family         VARCHAR(16) NOT NULL CHECK (os_family IN ('android', 'ios', 'windows', 'macos', 'linux', 'other')),
  os_major          SMALLINT CHECK (os_major BETWEEN 1 AND 999),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_boot_diagnostics_code_time
  ON app_boot_diagnostics(diagnostic_code, received_at DESC);
CREATE INDEX idx_app_boot_diagnostics_received_at
  ON app_boot_diagnostics(received_at);
