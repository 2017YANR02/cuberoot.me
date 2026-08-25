-- F2L / AF2L thumbnails and players require a complete legal case state.

ALTER TABLE alg_cases
  ADD CONSTRAINT alg_cases_f2l_setup_required
  CHECK (
    puzzle <> '3x3'
    OR set_slug NOT IN ('f2l', 'adv-f2l')
    OR btrim(setup) <> ''
  );
