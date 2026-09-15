CREATE TABLE nav_topics (
  tag TEXT PRIMARY KEY CHECK (length(btrim(tag)) BETWEEN 1 AND 160)
);
