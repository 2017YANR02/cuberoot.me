-- Run by the deployment host's PostgreSQL administrator before migrations.
-- No login/password, no business-role elevation, no changes to public grants.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cuberoot_assistant_reader') THEN
    CREATE ROLE cuberoot_assistant_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'cuberoot_assistant_reader' AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Unsafe assistant reader role attributes';
  END IF;
END $$;
