CREATE TABLE notification_push_devices (
    installation_id UUID PRIMARY KEY,
    secret_hash CHAR(64) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL CHECK (app_id IN ('me.cuberoot.app', 'me.cuberoot.app.debug')),
    client_id VARCHAR(128) NOT NULL,
    bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, client_id)
);
CREATE INDEX notification_push_devices_user ON notification_push_devices(user_id);

CREATE TABLE notification_push_deliveries (
    id BIGSERIAL PRIMARY KEY,
    notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES notification_push_devices(installation_id) ON DELETE CASCADE,
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    last_error TEXT,
    UNIQUE (notification_id, installation_id)
);
CREATE INDEX notification_push_pending ON notification_push_deliveries(next_attempt_at)
    WHERE accepted_at IS NULL AND attempts < 5;
