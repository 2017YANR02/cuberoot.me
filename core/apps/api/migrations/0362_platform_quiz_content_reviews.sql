ALTER TABLE platform_quizzes
  ADD CONSTRAINT platform_quizzes_lesson_identity UNIQUE (lesson_id, id);

ALTER TABLE platform_content_reviews
  ADD COLUMN quiz_id UUID,
  ADD CONSTRAINT platform_content_reviews_quiz_parent_check CHECK (quiz_id IS NULL OR lesson_id IS NOT NULL),
  ADD CONSTRAINT platform_content_reviews_quiz_parent_fk FOREIGN KEY (lesson_id, quiz_id)
    REFERENCES platform_quizzes(lesson_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT platform_content_reviews_quiz_base_fk FOREIGN KEY (quiz_id, base_revision)
    REFERENCES platform_quiz_revisions(quiz_id, revision) ON DELETE RESTRICT,
  ADD CONSTRAINT platform_content_reviews_quiz_candidate_fk FOREIGN KEY (quiz_id, candidate_revision)
    REFERENCES platform_quiz_revisions(quiz_id, revision) ON DELETE RESTRICT;

DROP INDEX uq_platform_content_review_lesson;
CREATE UNIQUE INDEX uq_platform_content_review_lesson ON platform_content_reviews(lesson_id)
  WHERE lesson_id IS NOT NULL AND quiz_id IS NULL AND status = 'pending';
CREATE UNIQUE INDEX uq_platform_content_review_quiz ON platform_content_reviews(quiz_id)
  WHERE quiz_id IS NOT NULL AND status = 'pending';
CREATE INDEX idx_platform_content_review_quiz_history ON platform_content_reviews(quiz_id, submitted_at DESC)
  WHERE quiz_id IS NOT NULL;
