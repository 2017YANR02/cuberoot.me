ALTER TABLE app_users
  ADD COLUMN birth_date DATE,
  ADD COLUMN gender VARCHAR(16),
  ADD COLUMN country_iso2 VARCHAR(2),
  ADD CONSTRAINT chk_app_users_birth_date
    CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01'),
  ADD CONSTRAINT chk_app_users_gender
    CHECK (gender IS NULL OR gender IN ('male', 'female', 'nonbinary', 'other', 'undisclosed')),
  ADD CONSTRAINT chk_app_users_country_iso2
    CHECK (country_iso2 IS NULL OR country_iso2 ~ '^[A-Z]{2}$');

-- Existing linked users may already have a cached WCA result snapshot. Use it once;
-- otherwise their next WCA sign-in or link refreshes the authoritative country.
DO $$
BEGIN
  IF to_regclass('public.wca_person_results_snapshot') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE app_users AS app
      SET country_iso2 = UPPER(snapshot.country_iso2)
      FROM wca_person_results_snapshot AS snapshot
      WHERE app.wca_id = snapshot.wca_id
        AND snapshot.country_iso2 ~* '^[A-Z]{2}$'
    $sql$;
  END IF;
END
$$;
