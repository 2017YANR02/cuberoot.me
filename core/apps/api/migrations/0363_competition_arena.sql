CREATE TABLE platform_competition_arena_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES platform_competition_sessions(id) ON DELETE CASCADE,
  project TEXT NOT NULL,
  device TEXT NOT NULL CHECK (device IN ('ordinary', 'smart')),
  number SMALLINT NOT NULL CHECK (number BETWEEN 1 AND 5),
  scramble TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (session_id, project, device)
);

ALTER TABLE platform_competition_attempts
  ADD COLUMN arena_round_id UUID REFERENCES platform_competition_arena_rounds(id) ON DELETE SET NULL,
  ADD COLUMN inspect_at TIMESTAMPTZ,
  ADD COLUMN solve_at TIMESTAMPTZ,
  ADD COLUMN dnf_reason TEXT CHECK (dnf_reason IN ('scramble_timeout', 'solve_timeout', 'disconnected'));

CREATE INDEX platform_competition_attempts_arena_idx
  ON platform_competition_attempts(arena_round_id, attempt_number) WHERE arena_round_id IS NOT NULL;

CREATE FUNCTION notify_competition_arena() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE room_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'platform_competition_attempts' THEN
    room_id := NEW.arena_round_id;
  ELSE
    room_id := NEW.match_id;
  END IF;
  IF room_id IS NOT NULL THEN
    PERFORM pg_notify('competition_arena', room_id::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER competition_arena_attempt_changed
  AFTER INSERT OR UPDATE OF inspect_at, solve_at, recorded_at ON platform_competition_attempts
  FOR EACH ROW EXECUTE FUNCTION notify_competition_arena();

CREATE TRIGGER competition_arena_game_changed
  AFTER INSERT OR UPDATE OF start_at, inspect_a_at, inspect_b_at, solve_a_at, solve_b_at, result_a, result_b ON platform_competition_match_games
  FOR EACH ROW EXECUTE FUNCTION notify_competition_arena();
