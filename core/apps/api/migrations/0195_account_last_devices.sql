CREATE TABLE account_last_devices (
  user_id         BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  device_type     VARCHAR(16) NOT NULL
                  CHECK (device_type IN ('phone', 'tablet', 'desktop', 'other')),
  os_family       VARCHAR(16) NOT NULL
                  CHECK (os_family IN ('android', 'ios', 'windows', 'macos', 'linux', 'other')),
  os_major        SMALLINT,
  browser_family  VARCHAR(16) NOT NULL
                  CHECK (browser_family IN ('chrome', 'edge', 'firefox', 'safari', 'wechat', 'webview', 'other')),
  browser_major   SMALLINT,
  container       VARCHAR(16) NOT NULL
                  CHECK (container IN ('wechat', 'webview', 'browser')),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
