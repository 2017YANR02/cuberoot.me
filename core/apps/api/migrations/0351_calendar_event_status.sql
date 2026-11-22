ALTER TABLE calendar_events
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'
  CONSTRAINT calendar_events_status_check CHECK (status IN ('confirmed', 'tentative'));
