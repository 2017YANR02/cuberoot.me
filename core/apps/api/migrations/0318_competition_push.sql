-- Version 1 clients only understand record notifications and browser clicks.
ALTER TABLE notification_push_devices ADD COLUMN push_version SMALLINT NOT NULL DEFAULT 1
    CHECK (push_version IN (1, 2));
