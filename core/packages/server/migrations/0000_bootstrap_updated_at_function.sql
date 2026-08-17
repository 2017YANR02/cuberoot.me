-- Grandfathered bootstrap migration: 0001_nav_sites historically referenced
-- this canonical trigger function before 0010 first created it. Keep this file
-- at the start of fresh replays; existing databases can apply it safely.
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
