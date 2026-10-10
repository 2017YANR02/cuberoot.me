-- Role bootstrap is deliberately separate: the application migration user cannot create roles.
CREATE SCHEMA assistant_public;
REVOKE ALL ON SCHEMA assistant_public FROM PUBLIC;
GRANT USAGE ON SCHEMA assistant_public TO cuberoot_assistant_reader;
CREATE VIEW assistant_public.results AS
  SELECT wca_id, comp_id, comp_date, event_id, round_type_id, format_id, pos, best, average, single_record, average_record
  FROM public.wca_person_results;
CREATE VIEW assistant_public.attempts AS
  SELECT r.wca_id, r.comp_id, r.comp_date, r.event_id, r.round_type_id, a.attempt_number, a.value
  FROM public.wca_person_results r CROSS JOIN LATERAL unnest(r.attempts) WITH ORDINALITY AS a(value, attempt_number);
CREATE VIEW assistant_public.competitions AS
  SELECT id, name, country_id, country_iso2, city, start_date, end_date FROM public.wca_competitions;
CREATE VIEW assistant_public.persons AS SELECT wca_id, name, country_id FROM public.wca_persons;
CREATE VIEW assistant_public.countries AS SELECT id, iso2, name, continent_id FROM public.wca_countries;
CREATE VIEW assistant_public.recons WITH (security_barrier=true) AS
  SELECT id, person, person_id, event, method, date, comp, comp_wca_id, official, raw_time, stm, tps, oll, pll, completion_status, record_type
  FROM public.recons WHERE visibility = 'public';
CREATE VIEW assistant_public.alg_cases AS
  SELECT id, puzzle, set_slug, name, number, subgroup, position FROM public.alg_cases;
CREATE VIEW assistant_public.wiki_terms WITH (security_barrier=true) AS
  SELECT id, head_en, head_zh, body_en, body_zh FROM public.wiki_terms WHERE deleted_at IS NULL;
CREATE VIEW assistant_public.freshness AS
  SELECT updated_at AS imported_at FROM public.meta_historical WHERE key = 'last_imported_at';
GRANT SELECT ON ALL TABLES IN SCHEMA assistant_public TO cuberoot_assistant_reader;
