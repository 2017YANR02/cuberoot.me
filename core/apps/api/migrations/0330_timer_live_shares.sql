-- Capabilities only; timer snapshots and recordings stay transient.
CREATE TABLE timer_live_shares (
    id TEXT PRIMARY KEY,
    host_hash TEXT NOT NULL,
    viewer_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX timer_live_shares_expiry_idx ON timer_live_shares (expires_at);
