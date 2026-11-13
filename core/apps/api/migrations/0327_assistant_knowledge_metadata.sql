ALTER TABLE site_assistant_knowledge_chunks ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE site_assistant_knowledge_state
  ADD COLUMN release_id TEXT,
  ADD COLUMN chunk_version TEXT,
  ADD COLUMN coverage JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN previous_snapshot JSONB;
-- Preserve the pre-upgrade generation as a rollback target. Its release/chunk
-- version remain unknown; do not fabricate readiness for the new reader.
UPDATE site_assistant_knowledge_state s SET chunk_count=(
  SELECT COUNT(*) FROM site_assistant_knowledge_chunks c WHERE c.generation=s.generation
);
