-- Private, account-bound contracts. File bytes share transactional DB backups.
CREATE TABLE workspace_contracts (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  version INTEGER NOT NULL CHECK (version >= 0)
);
CREATE INDEX workspace_contracts_owner ON workspace_contracts(user_id);
CREATE TABLE workspace_contract_versions (
  contract_id UUID NOT NULL REFERENCES workspace_contracts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  filename TEXT NOT NULL CHECK (length(filename) BETWEEN 1 AND 200),
  mime TEXT NOT NULL CHECK (mime IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 5242880),
  created_at BIGINT NOT NULL,
  PRIMARY KEY (contract_id, version)
);
