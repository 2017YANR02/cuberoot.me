-- Private, bounded evidence snapshots; never included in response/share JSON.
ALTER TABLE site_assistant_requests ADD COLUMN assistant_context JSONB;
