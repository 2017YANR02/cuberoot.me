-- Reuse the collaborative-document permission and Yjs storage model for spreadsheets.

ALTER TABLE collaborative_documents
  ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'document'
  CHECK (kind IN ('document', 'spreadsheet'));

CREATE INDEX idx_collaborative_documents_kind_updated
  ON collaborative_documents(kind, updated_at DESC);
