ALTER TABLE app_users ADD COLUMN site_settings JSONB CHECK (jsonb_typeof(site_settings) = 'object');
