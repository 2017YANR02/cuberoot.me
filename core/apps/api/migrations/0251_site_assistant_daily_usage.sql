-- One durable, anonymous counter per Beijing calendar day, shared by all API processes.
CREATE TABLE site_assistant_daily_usage (
  day DATE PRIMARY KEY,
  questions INTEGER NOT NULL CHECK (questions BETWEEN 1 AND 100)
);
