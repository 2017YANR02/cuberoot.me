ALTER TABLE platform_competitions
  DROP CONSTRAINT platform_competition_draft_setup,
  DROP CONSTRAINT platform_competition_draft_registration,
  ADD COLUMN supervision_mode TEXT NOT NULL DEFAULT 'supervised'
    CHECK (supervision_mode IN ('self_service', 'supervised', 'offline')),
  ADD COLUMN review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'pending_approval', 'rejected', 'approved')),
  ADD COLUMN review_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN reviewed_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN refund_template TEXT NOT NULL DEFAULT 'before_24h'
    CHECK (refund_template IN ('before_24h', 'before_start', 'custom')),
  ADD COLUMN offline_venue JSONB CHECK (jsonb_typeof(offline_venue) = 'object');

UPDATE platform_competitions c SET review_status = CASE
  WHEN e.status IN ('published', 'completed') THEN 'approved'
  WHEN c.submitted_at IS NOT NULL AND e.status = 'draft' THEN 'pending_approval'
  ELSE 'draft' END, refund_template='custom'
FROM platform_events e WHERE e.id = c.event_id;

ALTER TABLE platform_event_ticket_types
  DROP CONSTRAINT platform_event_ticket_types_competition_project_check,
  ADD CONSTRAINT platform_event_ticket_types_competition_project_check CHECK (competition_project IN (
    '333', '222', '444', '555', '666', '777', '333bf', '333oh',
    'clock', 'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf'
  ));

DROP INDEX idx_competition_registration_active;
CREATE UNIQUE INDEX idx_competition_registration_active
  ON platform_event_registrations(event_id, user_id, ticket_type_id)
  WHERE competition_project IS NOT NULL AND status IN ('reserved', 'confirmed', 'attended');

ALTER TABLE platform_competition_sessions
  DROP CONSTRAINT platform_competition_sessions_capacity_check,
  ADD CONSTRAINT platform_competition_sessions_capacity_check CHECK (capacity BETWEEN 1 AND 1000000),
  ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'supervised'
    CHECK (session_kind IN ('supervised', 'self_service', 'offline')),
  ADD CONSTRAINT platform_competition_session_staffing CHECK (
    session_kind = 'supervised' OR (supervisor_user_id IS NULL AND NOT assistance_requested)
  );
CREATE UNIQUE INDEX idx_competition_default_session
  ON platform_competition_sessions(event_id) WHERE session_kind <> 'supervised';

INSERT INTO platform_event_ticket_types (
  event_id, code, title_zh, title_en, amount_minor, currency, capacity,
  sales_start_at, sales_end_at, competition_project, competition_device
)
SELECT c.event_id, c.competition_project || '-' || c.competition_device,
  c.competition_project, c.competition_project, c.registration_fee_minor, 'CNY',
  c.participant_limit, c.registration_opens_at, c.registration_closes_at,
  c.competition_project, c.competition_device
FROM platform_competitions c JOIN platform_events e ON e.id = c.event_id
WHERE e.status = 'draft' AND c.competition_project IS NOT NULL
  AND c.competition_device IS NOT NULL AND c.participant_limit IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM platform_event_ticket_types t WHERE t.event_id = c.event_id AND t.competition_project IS NOT NULL)
ON CONFLICT (event_id, code) DO NOTHING;

ALTER TABLE platform_competition_attempts ADD COLUMN review_required BOOLEAN NOT NULL DEFAULT FALSE;
