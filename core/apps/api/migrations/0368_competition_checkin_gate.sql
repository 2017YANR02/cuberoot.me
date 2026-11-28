ALTER TABLE platform_event_registrations ADD COLUMN IF NOT EXISTS arena_ready_at TIMESTAMPTZ;

DROP TRIGGER IF EXISTS competition_arena_game_changed ON platform_competition_match_games;
CREATE TRIGGER competition_arena_game_changed
  AFTER INSERT OR UPDATE OF start_at, inspect_a_at, inspect_b_at, solve_a_at, solve_b_at, result_a, result_b,
    ready_a_at, ready_b_at, phase_a, phase_b, resolved_at ON platform_competition_match_games
  FOR EACH ROW EXECUTE FUNCTION notify_competition_arena();
