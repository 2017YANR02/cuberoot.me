-- wca-monitor TS 移植:各监控已推送 uid 去重台账(替代 known_*.json)。
CREATE TABLE monitor_pushed_state (
  monitor   VARCHAR(40)  NOT NULL,
  uid       VARCHAR(200) NOT NULL,
  pushed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (monitor, uid)
);
