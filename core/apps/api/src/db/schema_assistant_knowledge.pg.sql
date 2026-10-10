-- pgvector is provisioned by the deployment preflight as the PostgreSQL owner.
-- Immutable corpus generations become visible only after a complete successful build.
CREATE TABLE IF NOT EXISTS site_assistant_knowledge_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  generation text NOT NULL,
  corpus_hash text NOT NULL,
  embedding_identity text NOT NULL,
  source_updated timestamptz NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_assistant_knowledge_chunks (
  generation text NOT NULL,
  id text NOT NULL,
  document_id text NOT NULL,
  lang text NOT NULL CHECK (lang IN ('en','zh')),
  href text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  fingerprint text NOT NULL,
  embedding_identity text NOT NULL,
  search tsvector NOT NULL,
  embedding vector(512) NOT NULL,
  PRIMARY KEY (generation,id)
);
CREATE INDEX IF NOT EXISTS assistant_knowledge_search ON site_assistant_knowledge_chunks USING gin(search);
CREATE INDEX IF NOT EXISTS assistant_knowledge_reuse ON site_assistant_knowledge_chunks(embedding_identity,fingerprint);
CREATE INDEX IF NOT EXISTS assistant_knowledge_document ON site_assistant_knowledge_chunks(generation,lang,href);
-- Exact distance search is intentional for the bounded corpus. Add ANN only after
-- measuring latency/recall; a global approximate index can lose filtered matches.
