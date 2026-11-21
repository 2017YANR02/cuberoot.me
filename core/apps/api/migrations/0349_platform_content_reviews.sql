CREATE TABLE platform_content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES platform_courses(id) ON DELETE RESTRICT,
  lesson_id UUID,
  base_revision INTEGER NOT NULL CHECK (base_revision > 0),
  candidate_revision INTEGER NOT NULL CHECK (candidate_revision > 0),
  target_status VARCHAR(20) NOT NULL CHECK (target_status IN ('published', 'unlisted')),
  metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  submitted_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  decided_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  decision_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  FOREIGN KEY (course_id, lesson_id) REFERENCES platform_lessons(course_id, id) ON DELETE RESTRICT,
  CHECK (lesson_id IS NULL OR target_status = 'published')
);
CREATE UNIQUE INDEX uq_platform_content_review_course ON platform_content_reviews(course_id)
  WHERE lesson_id IS NULL AND status = 'pending';
CREATE UNIQUE INDEX uq_platform_content_review_lesson ON platform_content_reviews(lesson_id)
  WHERE lesson_id IS NOT NULL AND status = 'pending';
CREATE INDEX idx_platform_content_review_history ON platform_content_reviews(course_id, lesson_id, submitted_at DESC);
