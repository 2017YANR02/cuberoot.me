-- Site-owned attendance corrections; official registrations/results remain unchanged.
-- Account deletion clears only the editor reference, preserving the public correction.
CREATE TABLE comp_absences (
  comp_id VARCHAR(128) NOT NULL CHECK (comp_id ~ '^[a-z0-9_]{1,128}$'),
  wca_id VARCHAR(10) NOT NULL CHECK (wca_id ~ '^[0-9]{4}[A-Z]{4}[0-9]{2}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_via VARCHAR(16) NOT NULL CHECK (updated_via IN ('admin', 'api_key', 'maintainer')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comp_id, wca_id)
);

-- Maintainer explicitly confirmed these two Jiangmen Open 2026 absences on 2026-11-01.
INSERT INTO comp_absences (comp_id, wca_id, updated_via) VALUES
  ('jiangmenopen2026', '2019JIAN54', 'maintainer'),
  ('jiangmenopen2026', '2023DONG20', 'maintainer');
