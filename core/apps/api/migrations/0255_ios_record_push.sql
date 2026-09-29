ALTER TABLE notification_push_devices
    ADD COLUMN provider TEXT NOT NULL DEFAULT 'getui' CHECK (provider IN ('getui', 'apns')),
    ADD COLUMN environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production'));
ALTER TABLE notification_push_devices DROP CONSTRAINT notification_push_devices_app_id_client_id_key;
ALTER TABLE notification_push_devices ADD CONSTRAINT notification_push_devices_target_key
    UNIQUE (provider, environment, app_id, client_id);
ALTER TABLE notification_push_devices ADD CONSTRAINT notification_push_devices_getui_environment
    CHECK (provider <> 'getui' OR environment = 'production');
