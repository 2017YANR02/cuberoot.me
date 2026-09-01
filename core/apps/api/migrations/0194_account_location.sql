ALTER TABLE app_users
  ADD COLUMN region_code VARCHAR(8),
  ADD COLUMN city_name VARCHAR(160),
  ADD CONSTRAINT chk_app_users_region_code CHECK (
    region_code IS NULL OR (country_iso2 IS NOT NULL AND region_code ~ '^[A-Z0-9-]{1,8}$')
  ),
  ADD CONSTRAINT chk_app_users_city_name CHECK (
    city_name IS NULL OR (
      region_code IS NOT NULL
      AND city_name = BTRIM(city_name)
      AND city_name !~ '[[:cntrl:]]'
    )
  );
