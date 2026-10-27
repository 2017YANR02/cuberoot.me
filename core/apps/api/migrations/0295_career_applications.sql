CREATE TABLE career_applications (
  id UUID PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  position_id TEXT NOT NULL,
  city TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  education TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  resume_name TEXT NOT NULL,
  resume_ext TEXT NOT NULL,
  resume_data BYTEA NOT NULL,
  photo_name TEXT,
  photo_ext TEXT,
  photo_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX career_applications_created_idx ON career_applications (created_at DESC, id DESC);
