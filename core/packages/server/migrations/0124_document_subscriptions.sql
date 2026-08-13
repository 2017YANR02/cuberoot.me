-- Per-user change subscriptions for collaborative documents and spreadsheets.

CREATE TABLE collaborative_document_subscriptions (
  document_id  UUID        NOT NULL REFERENCES collaborative_documents(id) ON DELETE CASCADE,
  user_key     VARCHAR(20) NOT NULL,
  subscribed   BOOLEAN     NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, user_key)
);

CREATE INDEX idx_collaborative_document_subscriptions_user
  ON collaborative_document_subscriptions(user_key, updated_at DESC);

CREATE TRIGGER collaborative_document_subscriptions_updated_at BEFORE UPDATE ON collaborative_document_subscriptions
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
