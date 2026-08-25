-- 0167_platform_core.sql
-- Main-site Platform catalog, learning, commerce, content, instructor, QR,
-- privacy, outbox, and idempotency foundation. This intentionally does not
-- reuse the support-membership or organization-teaching purchase models.

CREATE OR REPLACE FUNCTION trg_platform_reject_update_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE platform_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE RESTRICT,
  teacher_entry_id BIGINT UNIQUE REFERENCES teacher_directory_entries(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  display_name_snapshot VARCHAR(200) NOT NULL
    CHECK (display_name_snapshot = BTRIM(display_name_snapshot) AND display_name_snapshot <> ''),
  bio_zh TEXT NOT NULL DEFAULT '',
  bio_en TEXT NOT NULL DEFAULT '',
  payout_profile_encrypted BYTEA,
  payout_key_version SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((payout_profile_encrypted IS NULL) = (payout_key_version IS NULL)),
  CHECK (payout_key_version IS NULL OR payout_key_version > 0)
);
CREATE INDEX idx_platform_instructors_status ON platform_instructors(status, created_at, id);
CREATE TRIGGER platform_instructors_set_updated_at BEFORE UPDATE ON platform_instructors
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_instructor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  applicant_display_name_snapshot VARCHAR(200) NOT NULL
    CHECK (applicant_display_name_snapshot = BTRIM(applicant_display_name_snapshot) AND applicant_display_name_snapshot <> ''),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  application_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(application_snapshot) = 'object'),
  decided_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  decided_by_actor_key VARCHAR(160)
    CHECK (decided_by_actor_key = BTRIM(decided_by_actor_key) AND decided_by_actor_key <> ''),
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  approved_instructor_id UUID REFERENCES platform_instructors(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'pending' AND decided_at IS NULL AND decided_by_user_id IS NULL AND decided_by_actor_key IS NULL AND approved_instructor_id IS NULL)
    OR (status = 'withdrawn' AND decided_at IS NOT NULL AND decided_by_actor_key IS NOT NULL AND approved_instructor_id IS NULL)
    OR (status = 'rejected' AND decided_at IS NOT NULL AND decided_by_actor_key IS NOT NULL AND approved_instructor_id IS NULL)
    OR (status = 'approved' AND decided_at IS NOT NULL AND decided_by_actor_key IS NOT NULL AND approved_instructor_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX uq_platform_instructor_applications_pending_user
  ON platform_instructor_applications(applicant_user_id) WHERE status = 'pending' AND applicant_user_id IS NOT NULL;
CREATE TRIGGER platform_instructor_applications_set_updated_at BEFORE UPDATE ON platform_instructor_applications
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  owner_instructor_id UUID REFERENCES platform_instructors(id) ON DELETE SET NULL,
  storage_key VARCHAR(512) NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL CHECK (mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 1073741824),
  sha256 BYTEA NOT NULL CHECK (octet_length(sha256) = 32),
  access_scope VARCHAR(20) NOT NULL
    CHECK (access_scope IN ('public', 'entitled', 'instructor', 'admin')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'quarantined', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (owner_user_id IS NOT NULL OR owner_instructor_id IS NOT NULL)
);
CREATE INDEX idx_platform_media_assets_owner_user ON platform_media_assets(owner_user_id, created_at DESC);
CREATE INDEX idx_platform_media_assets_owner_instructor ON platform_media_assets(owner_instructor_id, created_at DESC);
CREATE TRIGGER platform_media_assets_set_updated_at BEFORE UPDATE ON platform_media_assets
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE
    CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'unlisted', 'archived')),
  current_revision INTEGER CHECK (current_revision > 0),
  base_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (base_amount_minor BETWEEN 0 AND 9007199254740991),
  member_amount_minor BIGINT CHECK (member_amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL DEFAULT 'CNY' CHECK (currency ~ '^[A-Z]{3}$'),
  enrollment_mode VARCHAR(20) NOT NULL DEFAULT 'purchase'
    CHECK (enrollment_mode IN ('free', 'purchase', 'invite', 'admin_grant')),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status NOT IN ('published', 'unlisted') OR published_at IS NOT NULL),
  CHECK (status <> 'archived' OR archived_at IS NOT NULL),
  CHECK (status = 'draft' OR current_revision IS NOT NULL),
  CHECK (member_amount_minor IS NULL OR member_amount_minor <= base_amount_minor)
);
CREATE INDEX idx_platform_courses_public ON platform_courses(status, published_at DESC, id)
  WHERE status IN ('published', 'unlisted');
CREATE TRIGGER platform_courses_set_updated_at BEFORE UPDATE ON platform_courses
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_course_owners (
  course_id UUID NOT NULL REFERENCES platform_courses(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES platform_instructors(id) ON DELETE RESTRICT,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'co_instructor', 'editor')),
  revenue_share_bps INTEGER NOT NULL DEFAULT 0 CHECK (revenue_share_bps BETWEEN 0 AND 10000),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, instructor_id),
  CHECK (role IN ('owner', 'co_instructor') OR revenue_share_bps = 0)
);
CREATE UNIQUE INDEX uq_platform_course_owners_one_owner
  ON platform_course_owners(course_id) WHERE role = 'owner' AND status = 'active';
CREATE TRIGGER platform_course_owners_set_updated_at BEFORE UPDATE ON platform_course_owners
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_course_revisions (
  course_id UUID NOT NULL REFERENCES platform_courses(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  summary_zh TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  cover_media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  content_hash BYTEA NOT NULL CHECK (octet_length(content_hash) = 32),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  PRIMARY KEY (course_id, revision),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK ((status = 'draft' AND published_at IS NULL) OR (status IN ('published', 'retired') AND published_at IS NOT NULL))
);
ALTER TABLE platform_courses ADD CONSTRAINT platform_courses_current_revision_fk
  FOREIGN KEY (id, current_revision) REFERENCES platform_course_revisions(course_id, revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE platform_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES platform_courses(id) ON DELETE RESTRICT,
  slug VARCHAR(120) NOT NULL CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 1000000),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  access_scope VARCHAR(20) NOT NULL DEFAULT 'entitled' CHECK (access_scope IN ('public', 'entitled')),
  current_revision INTEGER CHECK (current_revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, id),
  UNIQUE (course_id, slug),
  UNIQUE (course_id, ordinal),
  CHECK (status = 'draft' OR current_revision IS NOT NULL)
);
CREATE INDEX idx_platform_lessons_course ON platform_lessons(course_id, ordinal, id);
CREATE TRIGGER platform_lessons_set_updated_at BEFORE UPDATE ON platform_lessons
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_lesson_revisions (
  lesson_id UUID NOT NULL REFERENCES platform_lessons(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  body_zh JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(body_zh) = 'object'),
  body_en JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(body_en) = 'object'),
  media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL,
  duration_seconds INTEGER CHECK (duration_seconds BETWEEN 0 AND 86400),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  content_hash BYTEA NOT NULL CHECK (octet_length(content_hash) = 32),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  PRIMARY KEY (lesson_id, revision),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK ((status = 'draft' AND published_at IS NULL) OR (status IN ('published', 'retired') AND published_at IS NOT NULL))
);
ALTER TABLE platform_lessons ADD CONSTRAINT platform_lessons_current_revision_fk
  FOREIGN KEY (id, current_revision) REFERENCES platform_lesson_revisions(lesson_id, revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE platform_learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE TRIGGER platform_learning_paths_set_updated_at BEFORE UPDATE ON platform_learning_paths
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_learning_path_items (
  path_id UUID NOT NULL REFERENCES platform_learning_paths(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 1000000),
  course_id UUID REFERENCES platform_courses(id) ON DELETE RESTRICT,
  lesson_id UUID REFERENCES platform_lessons(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (path_id, ordinal),
  CHECK ((course_id IS NOT NULL)::integer + (lesson_id IS NOT NULL)::integer = 1)
);
CREATE UNIQUE INDEX uq_platform_learning_path_items_course
  ON platform_learning_path_items(path_id, course_id) WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX uq_platform_learning_path_items_lesson
  ON platform_learning_path_items(path_id, lesson_id) WHERE lesson_id IS NOT NULL;

CREATE TABLE platform_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES platform_lessons(id) ON DELETE RESTRICT,
  slug VARCHAR(120) NOT NULL CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  current_revision INTEGER CHECK (current_revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_id, slug),
  CHECK (status = 'draft' OR current_revision IS NOT NULL)
);
CREATE TRIGGER platform_quizzes_set_updated_at BEFORE UPDATE ON platform_quizzes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_quiz_revisions (
  quiz_id UUID NOT NULL REFERENCES platform_quizzes(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  passing_score_bps INTEGER NOT NULL CHECK (passing_score_bps BETWEEN 0 AND 10000),
  max_attempts INTEGER CHECK (max_attempts BETWEEN 1 AND 1000000),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  content_hash BYTEA NOT NULL CHECK (octet_length(content_hash) = 32),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  PRIMARY KEY (quiz_id, revision),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK ((status = 'draft' AND published_at IS NULL) OR (status IN ('published', 'retired') AND published_at IS NOT NULL))
);
ALTER TABLE platform_quizzes ADD CONSTRAINT platform_quizzes_current_revision_fk
  FOREIGN KEY (id, current_revision) REFERENCES platform_quiz_revisions(quiz_id, revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE platform_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL,
  quiz_revision INTEGER NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 1000000),
  question_type VARCHAR(24) NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'boolean', 'text')),
  prompt_zh TEXT NOT NULL DEFAULT '',
  prompt_en TEXT NOT NULL DEFAULT '',
  choices JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(choices) = 'array'),
  answer_key_encrypted BYTEA NOT NULL,
  answer_key_version SMALLINT NOT NULL CHECK (answer_key_version > 0),
  points INTEGER NOT NULL DEFAULT 1 CHECK (points BETWEEN 1 AND 1000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_quiz_questions_revision_fk FOREIGN KEY (quiz_id, quiz_revision)
    REFERENCES platform_quiz_revisions(quiz_id, revision) ON DELETE RESTRICT,
  UNIQUE (quiz_id, quiz_revision, ordinal),
  CHECK (prompt_zh <> '' OR prompt_en <> ''),
  CHECK (octet_length(answer_key_encrypted) > 0)
);

CREATE TABLE platform_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('physical', 'digital')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  cover_media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (title_zh <> '' OR title_en <> '')
);
CREATE INDEX idx_platform_products_public ON platform_products(status, created_at DESC, id) WHERE status = 'active';
CREATE TRIGGER platform_products_set_updated_at BEFORE UPDATE ON platform_products
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES platform_products(id) ON DELETE RESTRICT,
  sku VARCHAR(120) NOT NULL CHECK (sku = UPPER(BTRIM(sku)) AND sku ~ '^[A-Z0-9][A-Z0-9_-]{0,119}$'),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold_out', 'archived')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 0 AND 9007199254740991),
  member_amount_minor BIGINT CHECK (member_amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  inventory_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (inventory_on_hand >= 0),
  inventory_reserved INTEGER NOT NULL DEFAULT 0 CHECK (inventory_reserved BETWEEN 0 AND inventory_on_hand),
  inventory_revision BIGINT NOT NULL DEFAULT 0 CHECK (inventory_revision >= 0),
  weight_grams INTEGER CHECK (weight_grams BETWEEN 0 AND 100000000),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, sku),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK (member_amount_minor IS NULL OR member_amount_minor <= amount_minor)
);
CREATE INDEX idx_platform_product_variants_product ON platform_product_variants(product_id, status, id);
CREATE TRIGGER platform_product_variants_set_updated_at BEFORE UPDATE ON platform_product_variants
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,119}$'),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed', 'archived')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(80) NOT NULL CHECK (timezone = BTRIM(timezone) AND timezone <> ''),
  venue_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(venue_snapshot) = 'object'),
  cover_media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX idx_platform_events_public ON platform_events(status, starts_at, id) WHERE status = 'published';
CREATE TRIGGER platform_events_set_updated_at BEFORE UPDATE ON platform_events
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_event_ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL CHECK (code = LOWER(BTRIM(code)) AND code ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  title_zh VARCHAR(160) NOT NULL DEFAULT '',
  title_en VARCHAR(160) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold_out', 'archived')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 1000000),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  sold_quantity INTEGER NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  capacity_revision BIGINT NOT NULL DEFAULT 0 CHECK (capacity_revision >= 0),
  sales_start_at TIMESTAMPTZ,
  sales_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, code),
  UNIQUE (event_id, id),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK (reserved_quantity + sold_quantity <= capacity),
  CHECK (sales_end_at IS NULL OR sales_start_at IS NULL OR sales_end_at > sales_start_at)
);
CREATE INDEX idx_platform_event_ticket_types_event ON platform_event_ticket_types(event_id, status, id);
CREATE TRIGGER platform_event_ticket_types_set_updated_at BEFORE UPDATE ON platform_event_ticket_types
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(160) NOT NULL UNIQUE CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,159}$'),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  body_zh JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(body_zh) = 'object'),
  body_en JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(body_en) = 'object'),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  cover_media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL,
  author_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (title_zh <> '' OR title_en <> ''),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX idx_platform_news_articles_public ON platform_news_articles(published_at DESC, id) WHERE status = 'published';
CREATE TRIGGER platform_news_articles_set_updated_at BEFORE UPDATE ON platform_news_articles
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE CHECK (slug = LOWER(BTRIM(slug)) AND slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  name_zh VARCHAR(160) NOT NULL DEFAULT '',
  name_en VARCHAR(160) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  period_unit VARCHAR(16) NOT NULL CHECK (period_unit IN ('day', 'month', 'year', 'lifetime')),
  period_count INTEGER NOT NULL CHECK (period_count BETWEEN 1 AND 1200),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  benefits_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(benefits_snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (name_zh <> '' OR name_en <> ''),
  CHECK ((period_unit = 'lifetime' AND period_count = 1) OR period_unit <> 'lifetime')
);
CREATE TRIGGER platform_membership_plans_set_updated_at BEFORE UPDATE ON platform_membership_plans
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE CHECK (code = UPPER(BTRIM(code)) AND code ~ '^[A-Z0-9][A-Z0-9_-]{2,63}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'archived')),
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_amount_minor BIGINT CHECK (discount_amount_minor BETWEEN 1 AND 9007199254740991),
  discount_bps INTEGER CHECK (discount_bps BETWEEN 1 AND 10000),
  currency VARCHAR(3) CHECK (currency ~ '^[A-Z]{3}$'),
  minimum_order_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (minimum_order_amount_minor BETWEEN 0 AND 9007199254740991),
  max_redemptions INTEGER CHECK (max_redemptions BETWEEN 1 AND 1000000000),
  per_user_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_user_limit BETWEEN 1 AND 1000000),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(eligibility) = 'object'),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (discount_type = 'fixed' AND discount_amount_minor IS NOT NULL AND discount_bps IS NULL AND currency IS NOT NULL)
    OR (discount_type = 'percent' AND discount_amount_minor IS NULL AND discount_bps IS NOT NULL AND currency IS NULL)
  ),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX idx_platform_coupons_status ON platform_coupons(status, starts_at, ends_at);
CREATE TRIGGER platform_coupons_set_updated_at BEFORE UPDATE ON platform_coupons
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE CASCADE,
  label VARCHAR(80) NOT NULL DEFAULT '',
  recipient_hint VARCHAR(80) NOT NULL DEFAULT '',
  phone_last4 VARCHAR(4) CHECK (phone_last4 ~ '^[0-9]{4}$'),
  country_code VARCHAR(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  encrypted_payload BYTEA NOT NULL CHECK (octet_length(encrypted_payload) > 0),
  key_version SMALLINT NOT NULL CHECK (key_version > 0),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_platform_shipping_addresses_default
  ON platform_shipping_addresses(user_id) WHERE is_default AND archived_at IS NULL;
CREATE INDEX idx_platform_shipping_addresses_user ON platform_shipping_addresses(user_id, updated_at DESC);
CREATE TRIGGER platform_shipping_addresses_set_updated_at BEFORE UPDATE ON platform_shipping_addresses
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(40) NOT NULL UNIQUE CHECK (order_number ~ '^PLT-[A-Z0-9]{12,32}$'),
  buyer_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  buyer_display_name_snapshot VARCHAR(200) NOT NULL DEFAULT '',
  client_order_key VARCHAR(120) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_payment', 'paid', 'partially_fulfilled', 'fulfilled', 'cancelled', 'partially_refunded', 'refunded', 'chargeback')),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal_amount_minor BIGINT NOT NULL CHECK (subtotal_amount_minor BETWEEN 0 AND 9007199254740991),
  discount_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount_minor BETWEEN 0 AND 9007199254740991),
  shipping_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (shipping_amount_minor BETWEEN 0 AND 9007199254740991),
  total_amount_minor BIGINT NOT NULL CHECK (total_amount_minor BETWEEN 0 AND 9007199254740991),
  coupon_id UUID REFERENCES platform_coupons(id) ON DELETE RESTRICT,
  pricing_snapshot JSONB NOT NULL CHECK (jsonb_typeof(pricing_snapshot) = 'object'),
  shipping_snapshot_encrypted BYTEA,
  shipping_key_version SMALLINT,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_user_id, client_order_key),
  UNIQUE (id, currency),
  UNIQUE (id, total_amount_minor, currency),
  CHECK (subtotal_amount_minor - discount_amount_minor + shipping_amount_minor = total_amount_minor),
  CHECK (discount_amount_minor <= subtotal_amount_minor),
  CHECK ((shipping_snapshot_encrypted IS NULL) = (shipping_key_version IS NULL)),
  CHECK (shipping_key_version IS NULL OR shipping_key_version > 0),
  CHECK (status NOT IN ('paid', 'partially_fulfilled', 'fulfilled', 'partially_refunded', 'refunded', 'chargeback') OR paid_at IS NOT NULL),
  CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL),
  CHECK (status <> 'fulfilled' OR fulfilled_at IS NOT NULL)
);
CREATE INDEX idx_platform_orders_buyer ON platform_orders(buyer_user_id, created_at DESC, id);
CREATE INDEX idx_platform_orders_status ON platform_orders(status, created_at, id);
CREATE TRIGGER platform_orders_set_updated_at BEFORE UPDATE ON platform_orders
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES platform_orders(id) ON DELETE RESTRICT,
  line_number INTEGER NOT NULL CHECK (line_number BETWEEN 1 AND 10000),
  course_id UUID REFERENCES platform_courses(id) ON DELETE RESTRICT,
  product_variant_id UUID REFERENCES platform_product_variants(id) ON DELETE RESTRICT,
  event_ticket_type_id UUID REFERENCES platform_event_ticket_types(id) ON DELETE RESTRICT,
  membership_plan_id UUID REFERENCES platform_membership_plans(id) ON DELETE RESTRICT,
  sellable_type VARCHAR(24) NOT NULL CHECK (sellable_type IN ('course', 'product_variant', 'event_ticket', 'platform_membership')),
  sellable_snapshot JSONB NOT NULL CHECK (jsonb_typeof(sellable_snapshot) = 'object'),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  unit_amount_minor BIGINT NOT NULL CHECK (unit_amount_minor BETWEEN 0 AND 9007199254740991),
  discount_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount_minor BETWEEN 0 AND 9007199254740991),
  line_total_amount_minor BIGINT NOT NULL CHECK (line_total_amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  fulfillment_type VARCHAR(24) NOT NULL CHECK (fulfillment_type IN ('course_entitlement', 'download', 'shipment', 'event_registration', 'platform_membership')),
  revenue_share_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(revenue_share_snapshot) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, line_number),
  UNIQUE (order_id, id),
  CONSTRAINT platform_order_items_currency_fk FOREIGN KEY (order_id, currency)
    REFERENCES platform_orders(id, currency) ON DELETE RESTRICT,
  CHECK ((course_id IS NOT NULL)::integer + (product_variant_id IS NOT NULL)::integer + (event_ticket_type_id IS NOT NULL)::integer + (membership_plan_id IS NOT NULL)::integer = 1),
  CHECK (
    (sellable_type = 'course' AND course_id IS NOT NULL AND fulfillment_type = 'course_entitlement')
    OR (sellable_type = 'product_variant' AND product_variant_id IS NOT NULL AND fulfillment_type IN ('download', 'shipment'))
    OR (sellable_type = 'event_ticket' AND event_ticket_type_id IS NOT NULL AND fulfillment_type = 'event_registration')
    OR (sellable_type = 'platform_membership' AND membership_plan_id IS NOT NULL AND fulfillment_type = 'platform_membership')
  ),
  CHECK (sellable_type = 'product_variant' OR quantity = 1),
  CHECK (unit_amount_minor * quantity - discount_amount_minor = line_total_amount_minor),
  CHECK (discount_amount_minor <= unit_amount_minor * quantity)
);
CREATE INDEX idx_platform_order_items_order ON platform_order_items(order_id, line_number);
CREATE INDEX idx_platform_order_items_course ON platform_order_items(course_id, order_id) WHERE course_id IS NOT NULL;

CREATE TABLE platform_coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES platform_coupons(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  order_id UUID NOT NULL UNIQUE REFERENCES platform_orders(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'applied', 'released')),
  discount_amount_minor BIGINT NOT NULL CHECK (discount_amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reservation_expires_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status <> 'reserved' OR reservation_expires_at IS NOT NULL),
  CHECK (status <> 'applied' OR applied_at IS NOT NULL),
  CHECK (status <> 'released' OR released_at IS NOT NULL)
);
CREATE INDEX idx_platform_coupon_redemptions_usage ON platform_coupon_redemptions(coupon_id, user_id, status, created_at);
CREATE TRIGGER platform_coupon_redemptions_set_updated_at BEFORE UPDATE ON platform_coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES platform_orders(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 1000),
  provider VARCHAR(32) NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  merchant_account VARCHAR(120) NOT NULL CHECK (merchant_account = BTRIM(merchant_account) AND merchant_account <> ''),
  provider_order_id VARCHAR(200) NOT NULL,
  provider_transaction_id VARCHAR(200),
  status VARCHAR(24) NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'chargeback')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  request_hash BYTEA NOT NULL CHECK (octet_length(request_hash) = 32),
  failure_code VARCHAR(120),
  expires_at TIMESTAMPTZ,
  succeeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, attempt_number),
  UNIQUE (id, order_id),
  UNIQUE (id, order_id, amount_minor, currency),
  UNIQUE (id, order_id, currency, provider),
  UNIQUE (provider, merchant_account, provider_order_id),
  CONSTRAINT platform_payment_attempts_order_amount_fk FOREIGN KEY (order_id, amount_minor, currency)
    REFERENCES platform_orders(id, total_amount_minor, currency) ON DELETE RESTRICT,
  CHECK (status <> 'succeeded' OR (succeeded_at IS NOT NULL AND provider_transaction_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_platform_payment_attempts_transaction
  ON platform_payment_attempts(provider, merchant_account, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX idx_platform_payment_attempts_order ON platform_payment_attempts(order_id, created_at DESC);
CREATE TRIGGER platform_payment_attempts_set_updated_at BEFORE UPDATE ON platform_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_attempt_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES platform_orders(id) ON DELETE RESTRICT,
  provider VARCHAR(32) NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  merchant_account VARCHAR(120) NOT NULL CHECK (merchant_account = BTRIM(merchant_account) AND merchant_account <> ''),
  provider_event_id VARCHAR(240) NOT NULL,
  provider_transaction_id VARCHAR(200),
  event_type VARCHAR(80) NOT NULL CHECK (event_type = BTRIM(event_type) AND event_type <> ''),
  status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'rejected')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 0 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  signature_verified BOOLEAN NOT NULL CHECK (signature_verified),
  merchant_verified BOOLEAN NOT NULL CHECK (merchant_verified),
  order_verified BOOLEAN NOT NULL CHECK (order_verified),
  amount_currency_verified BOOLEAN NOT NULL CHECK (amount_currency_verified),
  payload_hash BYTEA NOT NULL CHECK (octet_length(payload_hash) = 32),
  payload_sanitized JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload_sanitized) = 'object'),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  rejection_code VARCHAR(120),
  UNIQUE (provider, merchant_account, provider_event_id),
  CONSTRAINT platform_provider_events_attempt_fk FOREIGN KEY (payment_attempt_id, order_id, amount_minor, currency)
    REFERENCES platform_payment_attempts(id, order_id, amount_minor, currency) ON DELETE RESTRICT,
  CHECK (status <> 'processed' OR processed_at IS NOT NULL),
  CHECK (status <> 'rejected' OR rejection_code IS NOT NULL)
);
CREATE INDEX idx_platform_provider_events_processing ON platform_provider_events(status, received_at, id);

CREATE TABLE platform_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES platform_orders(id) ON DELETE RESTRICT,
  payment_attempt_id UUID NOT NULL,
  order_item_id UUID,
  refund_number INTEGER NOT NULL CHECK (refund_number BETWEEN 1 AND 1000),
  provider VARCHAR(32) NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  provider_refund_id VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'pending', 'succeeded', 'failed', 'cancelled', 'chargeback')),
  reason_code VARCHAR(64) NOT NULL CHECK (reason_code = BTRIM(reason_code) AND reason_code <> ''),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  requested_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  decided_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  decided_by_actor_key VARCHAR(160)
    CHECK (decided_by_actor_key = BTRIM(decided_by_actor_key) AND decided_by_actor_key <> ''),
  succeeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, refund_number),
  UNIQUE (id, order_id),
  CONSTRAINT platform_refunds_attempt_fk FOREIGN KEY (payment_attempt_id, order_id, currency, provider)
    REFERENCES platform_payment_attempts(id, order_id, currency, provider) ON DELETE RESTRICT,
  CONSTRAINT platform_refunds_item_fk FOREIGN KEY (order_id, order_item_id)
    REFERENCES platform_order_items(order_id, id) ON DELETE RESTRICT,
  CHECK (status <> 'succeeded' OR succeeded_at IS NOT NULL)
);
CREATE UNIQUE INDEX uq_platform_refunds_provider_ref
  ON platform_refunds(provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
CREATE INDEX idx_platform_refunds_order ON platform_refunds(order_id, created_at DESC);
CREATE TRIGGER platform_refunds_set_updated_at BEFORE UPDATE ON platform_refunds
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES platform_product_variants(id) ON DELETE RESTRICT,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('stock_in', 'reserve', 'release', 'sell', 'refund', 'adjustment', 'reversal')),
  delta_on_hand INTEGER NOT NULL DEFAULT 0,
  delta_reserved INTEGER NOT NULL DEFAULT 0,
  order_item_id UUID REFERENCES platform_order_items(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES platform_refunds(id) ON DELETE RESTRICT,
  reversal_of_ledger_id UUID UNIQUE REFERENCES platform_inventory_ledger(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  actor_key VARCHAR(160) CHECK (actor_key = BTRIM(actor_key) AND actor_key <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (delta_on_hand <> 0 OR delta_reserved <> 0),
  CHECK (entry_type = 'reversal' OR reversal_of_ledger_id IS NULL),
  CHECK (entry_type <> 'reversal' OR reversal_of_ledger_id IS NOT NULL),
  CHECK (entry_type <> 'adjustment' OR (
    BTRIM(reason) <> '' AND (actor_user_id IS NOT NULL OR NULLIF(BTRIM(actor_key), '') IS NOT NULL)
  ))
);
CREATE INDEX idx_platform_inventory_ledger_variant ON platform_inventory_ledger(product_variant_id, created_at, id);

CREATE TABLE platform_fulfillment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES platform_orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL,
  entry_type VARCHAR(24) NOT NULL CHECK (entry_type IN ('reserve', 'grant', 'ship', 'deliver', 'release', 'revoke', 'return', 'reversal')),
  delta_quantity INTEGER NOT NULL CHECK (delta_quantity <> 0),
  external_reference VARCHAR(240),
  refund_id UUID REFERENCES platform_refunds(id) ON DELETE RESTRICT,
  reversal_of_ledger_id UUID UNIQUE REFERENCES platform_fulfillment_ledger(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_fulfillment_ledger_item_fk FOREIGN KEY (order_id, order_item_id)
    REFERENCES platform_order_items(order_id, id) ON DELETE RESTRICT,
  CHECK (entry_type = 'reversal' OR reversal_of_ledger_id IS NULL),
  CHECK (entry_type <> 'reversal' OR reversal_of_ledger_id IS NOT NULL)
);
CREATE INDEX idx_platform_fulfillment_ledger_item ON platform_fulfillment_ledger(order_item_id, created_at, id);

CREATE TABLE platform_event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES platform_events(id) ON DELETE RESTRICT,
  ticket_type_id UUID NOT NULL REFERENCES platform_event_ticket_types(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  order_item_id UUID NOT NULL UNIQUE REFERENCES platform_order_items(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'refunded', 'attended')),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  attendee_snapshot_encrypted BYTEA,
  attendee_key_version SMALLINT,
  reservation_expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_event_registrations_ticket_fk FOREIGN KEY (event_id, ticket_type_id)
    REFERENCES platform_event_ticket_types(event_id, id) ON DELETE RESTRICT,
  CHECK ((attendee_snapshot_encrypted IS NULL) = (attendee_key_version IS NULL)),
  CHECK (attendee_key_version IS NULL OR attendee_key_version > 0),
  CHECK (status <> 'reserved' OR reservation_expires_at IS NOT NULL),
  CHECK (status NOT IN ('confirmed', 'attended') OR confirmed_at IS NOT NULL),
  CHECK (status NOT IN ('cancelled', 'refunded') OR cancelled_at IS NOT NULL)
);
CREATE INDEX idx_platform_event_registrations_event ON platform_event_registrations(event_id, status, created_at);
CREATE INDEX idx_platform_event_registrations_user ON platform_event_registrations(user_id, created_at DESC);
CREATE TRIGGER platform_event_registrations_set_updated_at BEFORE UPDATE ON platform_event_registrations
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_course_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  course_id UUID NOT NULL REFERENCES platform_courses(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  ledger_revision BIGINT NOT NULL DEFAULT 0 CHECK (ledger_revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id),
  UNIQUE (id, user_id),
  UNIQUE (id, user_id, course_id),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX idx_platform_course_entitlements_user ON platform_course_entitlements(user_id, status, valid_until);
CREATE TRIGGER platform_course_entitlements_set_updated_at BEFORE UPDATE ON platform_course_entitlements
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_entitlement_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id UUID NOT NULL REFERENCES platform_course_entitlements(id) ON DELETE RESTRICT,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('purchase', 'grant', 'refund', 'expiration', 'revocation', 'reversal')),
  delta_access SMALLINT NOT NULL CHECK (delta_access IN (-1, 1)),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  order_item_id UUID REFERENCES platform_order_items(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES platform_refunds(id) ON DELETE RESTRICT,
  reversal_of_ledger_id UUID UNIQUE REFERENCES platform_entitlement_ledger(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (entry_type = 'reversal' OR reversal_of_ledger_id IS NULL),
  CHECK (entry_type <> 'reversal' OR reversal_of_ledger_id IS NOT NULL),
  CHECK (entry_type NOT IN ('grant', 'revocation') OR (reason <> '' AND actor_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_platform_entitlement_ledger_order_grant
  ON platform_entitlement_ledger(order_item_id) WHERE entry_type = 'purchase' AND order_item_id IS NOT NULL;
CREATE UNIQUE INDEX uq_platform_entitlement_ledger_refund
  ON platform_entitlement_ledger(refund_id) WHERE entry_type = 'refund' AND refund_id IS NOT NULL;
CREATE INDEX idx_platform_entitlement_ledger_entitlement ON platform_entitlement_ledger(entitlement_id, created_at, id);

CREATE TABLE platform_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES platform_membership_plans(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'revoked')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  ledger_revision BIGINT NOT NULL DEFAULT 0 CHECK (ledger_revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, plan_id),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX idx_platform_memberships_user ON platform_memberships(user_id, status, valid_until);
CREATE TRIGGER platform_memberships_set_updated_at BEFORE UPDATE ON platform_memberships
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_membership_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES platform_memberships(id) ON DELETE RESTRICT,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('purchase', 'grant', 'renewal', 'refund', 'expiration', 'revocation', 'reversal')),
  delta_access SMALLINT NOT NULL CHECK (delta_access IN (-1, 1)),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  order_item_id UUID REFERENCES platform_order_items(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES platform_refunds(id) ON DELETE RESTRICT,
  reversal_of_ledger_id UUID UNIQUE REFERENCES platform_membership_ledger(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (entry_type = 'reversal' OR reversal_of_ledger_id IS NULL),
  CHECK (entry_type <> 'reversal' OR reversal_of_ledger_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_platform_membership_ledger_order_grant
  ON platform_membership_ledger(order_item_id) WHERE entry_type IN ('purchase', 'renewal') AND order_item_id IS NOT NULL;
CREATE UNIQUE INDEX uq_platform_membership_ledger_refund
  ON platform_membership_ledger(refund_id) WHERE entry_type = 'refund' AND refund_id IS NOT NULL;
CREATE INDEX idx_platform_membership_ledger_membership ON platform_membership_ledger(membership_id, created_at, id);

CREATE TABLE platform_lesson_progress (
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES platform_lessons(id) ON DELETE RESTRICT,
  lesson_revision INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_bps INTEGER NOT NULL DEFAULT 0 CHECK (progress_bps BETWEEN 0 AND 10000),
  position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (position_seconds BETWEEN 0 AND 86400),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_id),
  CONSTRAINT platform_lesson_progress_revision_fk FOREIGN KEY (lesson_id, lesson_revision)
    REFERENCES platform_lesson_revisions(lesson_id, revision) ON DELETE RESTRICT,
  CHECK (status <> 'completed' OR (progress_bps = 10000 AND completed_at IS NOT NULL))
);
CREATE INDEX idx_platform_lesson_progress_user ON platform_lesson_progress(user_id, updated_at DESC);
CREATE TRIGGER platform_lesson_progress_set_updated_at BEFORE UPDATE ON platform_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_lesson_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES platform_lessons(id) ON DELETE RESTRICT,
  position_seconds INTEGER CHECK (position_seconds BETWEEN 0 AND 86400),
  body TEXT NOT NULL CHECK (body = BTRIM(body) AND CHAR_LENGTH(body) BETWEEN 1 AND 20000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_platform_lesson_notes_user_lesson ON platform_lesson_notes(user_id, lesson_id, position_seconds, created_at);
CREATE TRIGGER platform_lesson_notes_set_updated_at BEFORE UPDATE ON platform_lesson_notes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_favorites (
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('course', 'product', 'event')),
  course_id UUID REFERENCES platform_courses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES platform_products(id) ON DELETE CASCADE,
  event_id UUID REFERENCES platform_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((course_id IS NOT NULL)::integer + (product_id IS NOT NULL)::integer + (event_id IS NOT NULL)::integer = 1),
  CHECK (
    (target_type = 'course' AND course_id IS NOT NULL)
    OR (target_type = 'product' AND product_id IS NOT NULL)
    OR (target_type = 'event' AND event_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX uq_platform_favorites_course ON platform_favorites(user_id, course_id) WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX uq_platform_favorites_product ON platform_favorites(user_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX uq_platform_favorites_event ON platform_favorites(user_id, event_id) WHERE event_id IS NOT NULL;

CREATE TABLE platform_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  quiz_id UUID NOT NULL,
  quiz_revision INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 1000000),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded', 'void')),
  answers_snapshot_encrypted BYTEA NOT NULL CHECK (octet_length(answers_snapshot_encrypted) > 0),
  answers_key_version SMALLINT NOT NULL CHECK (answers_key_version > 0),
  score_points INTEGER CHECK (score_points >= 0),
  max_points INTEGER CHECK (max_points > 0),
  score_bps INTEGER CHECK (score_bps BETWEEN 0 AND 10000),
  passed BOOLEAN,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  UNIQUE (user_id, quiz_id, attempt_number),
  CONSTRAINT platform_quiz_attempts_revision_fk FOREIGN KEY (quiz_id, quiz_revision)
    REFERENCES platform_quiz_revisions(quiz_id, revision) ON DELETE RESTRICT,
  CHECK (status = 'in_progress' OR submitted_at IS NOT NULL),
  CHECK (status <> 'graded' OR (graded_at IS NOT NULL AND score_points IS NOT NULL AND max_points IS NOT NULL AND score_bps IS NOT NULL AND passed IS NOT NULL)),
  CHECK (score_points IS NULL OR max_points IS NULL OR score_points <= max_points)
);
CREATE INDEX idx_platform_quiz_attempts_user ON platform_quiz_attempts(user_id, started_at DESC);

CREATE TABLE platform_course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  course_id UUID NOT NULL REFERENCES platform_courses(id) ON DELETE RESTRICT,
  entitlement_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '' CHECK (CHAR_LENGTH(body) <= 20000),
  status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'hidden', 'removed')),
  moderation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id),
  CONSTRAINT platform_course_reviews_entitlement_fk FOREIGN KEY (entitlement_id, user_id, course_id)
    REFERENCES platform_course_entitlements(id, user_id, course_id) ON DELETE RESTRICT
);
CREATE INDEX idx_platform_course_reviews_public ON platform_course_reviews(course_id, created_at DESC) WHERE status = 'published';
CREATE TRIGGER platform_course_reviews_set_updated_at BEFORE UPDATE ON platform_course_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(verification_code_hash) = 32),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  course_id UUID NOT NULL REFERENCES platform_courses(id) ON DELETE RESTRICT,
  entitlement_id UUID NOT NULL REFERENCES platform_course_entitlements(id) ON DELETE RESTRICT,
  recipient_name_snapshot VARCHAR(200) NOT NULL CHECK (recipient_name_snapshot = BTRIM(recipient_name_snapshot) AND recipient_name_snapshot <> ''),
  course_title_snapshot VARCHAR(240) NOT NULL CHECK (course_title_snapshot = BTRIM(course_title_snapshot) AND course_title_snapshot <> ''),
  status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked')),
  image_media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL,
  issued_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  CHECK (status <> 'revoked' OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL AND revoke_reason <> ''))
);
CREATE INDEX idx_platform_certificates_user ON platform_certificates(user_id, issued_at DESC);

CREATE TABLE platform_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  timezone VARCHAR(80) NOT NULL CHECK (timezone = BTRIM(timezone) AND timezone <> ''),
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded BETWEEN 0 AND 1000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, local_date)
);

CREATE TABLE platform_point_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('checkin', 'purchase', 'achievement', 'redeem', 'adjustment', 'expiration', 'reversal')),
  delta_points BIGINT NOT NULL CHECK (delta_points <> 0 AND delta_points BETWEEN -9007199254740991 AND 9007199254740991),
  balance_after BIGINT NOT NULL CHECK (balance_after BETWEEN 0 AND 9007199254740991),
  checkin_id UUID REFERENCES platform_checkins(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES platform_orders(id) ON DELETE RESTRICT,
  reversal_of_ledger_id UUID UNIQUE REFERENCES platform_point_ledger(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (entry_type = 'reversal' OR reversal_of_ledger_id IS NULL),
  CHECK (entry_type <> 'reversal' OR reversal_of_ledger_id IS NOT NULL),
  CHECK (entry_type <> 'checkin' OR checkin_id IS NOT NULL),
  CHECK (entry_type <> 'purchase' OR order_id IS NOT NULL),
  CHECK (entry_type <> 'adjustment' OR (reason <> '' AND actor_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_platform_point_ledger_checkin ON platform_point_ledger(checkin_id) WHERE checkin_id IS NOT NULL;
CREATE INDEX idx_platform_point_ledger_user ON platform_point_ledger(user_id, created_at, id);

CREATE TABLE platform_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_key VARCHAR(120) NOT NULL UNIQUE CHECK (achievement_key = LOWER(BTRIM(achievement_key)) AND achievement_key ~ '^[a-z0-9][a-z0-9_.-]{0,119}$'),
  title_zh VARCHAR(160) NOT NULL DEFAULT '',
  title_en VARCHAR(160) NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'archived')),
  rule_snapshot JSONB NOT NULL CHECK (jsonb_typeof(rule_snapshot) = 'object'),
  point_reward INTEGER NOT NULL DEFAULT 0 CHECK (point_reward BETWEEN 0 AND 1000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (title_zh <> '' OR title_en <> '')
);
CREATE TRIGGER platform_achievements_set_updated_at BEFORE UPDATE ON platform_achievements
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  achievement_id UUID NOT NULL REFERENCES platform_achievements(id) ON DELETE RESTRICT,
  evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence_snapshot) = 'object'),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);
CREATE INDEX idx_platform_user_achievements_user ON platform_user_achievements(user_id, awarded_at DESC);

CREATE TABLE platform_instructor_revenue_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES platform_instructors(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES platform_orders(id) ON DELETE RESTRICT,
  order_item_id UUID REFERENCES platform_order_items(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES platform_refunds(id) ON DELETE RESTRICT,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('sale', 'refund', 'chargeback', 'adjustment', 'reversal')),
  delta_amount_minor BIGINT NOT NULL CHECK (delta_amount_minor <> 0 AND delta_amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  share_bps_snapshot INTEGER CHECK (share_bps_snapshot BETWEEN 0 AND 10000),
  reversal_of_ledger_id UUID UNIQUE REFERENCES platform_instructor_revenue_ledger(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (entry_type = 'reversal' OR reversal_of_ledger_id IS NULL),
  CHECK (entry_type <> 'reversal' OR reversal_of_ledger_id IS NOT NULL),
  CHECK (entry_type <> 'sale' OR (order_id IS NOT NULL AND order_item_id IS NOT NULL AND delta_amount_minor > 0 AND share_bps_snapshot IS NOT NULL)),
  CHECK (entry_type NOT IN ('refund', 'chargeback') OR (refund_id IS NOT NULL AND delta_amount_minor < 0)),
  CHECK (entry_type <> 'adjustment' OR (reason <> '' AND actor_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_platform_instructor_revenue_sale
  ON platform_instructor_revenue_ledger(instructor_id, order_item_id) WHERE entry_type = 'sale';
CREATE INDEX idx_platform_instructor_revenue_ledger_owner
  ON platform_instructor_revenue_ledger(instructor_id, currency, created_at, id);

CREATE TABLE platform_instructor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES platform_instructors(id) ON DELETE RESTRICT,
  payout_number VARCHAR(48) NOT NULL UNIQUE CHECK (payout_number ~ '^PLT-PO-[A-Z0-9]{10,32}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'processing', 'paid', 'failed', 'cancelled')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN 1 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payout_profile_snapshot_encrypted BYTEA NOT NULL CHECK (octet_length(payout_profile_snapshot_encrypted) > 0),
  payout_key_version SMALLINT NOT NULL CHECK (payout_key_version > 0),
  provider_reference VARCHAR(240),
  approved_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  approved_by_actor_key VARCHAR(160)
    CHECK (approved_by_actor_key = BTRIM(approved_by_actor_key) AND approved_by_actor_key <> ''),
  paid_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  paid_by_actor_key VARCHAR(160)
    CHECK (paid_by_actor_key = BTRIM(paid_by_actor_key) AND paid_by_actor_key <> ''),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_code VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status NOT IN ('approved', 'processing', 'paid') OR (approved_at IS NOT NULL AND approved_by_actor_key IS NOT NULL)),
  CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND paid_by_actor_key IS NOT NULL AND provider_reference IS NOT NULL)),
  CHECK (status <> 'failed' OR failure_code IS NOT NULL)
);
CREATE INDEX idx_platform_instructor_payouts_owner ON platform_instructor_payouts(instructor_id, created_at DESC);
CREATE TRIGGER platform_instructor_payouts_set_updated_at BEFORE UPDATE ON platform_instructor_payouts
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_instructor_payout_items (
  payout_id UUID NOT NULL REFERENCES platform_instructor_payouts(id) ON DELETE RESTRICT,
  revenue_ledger_id UUID NOT NULL REFERENCES platform_instructor_revenue_ledger(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor <> 0 AND amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  CHECK (released_at IS NULL OR released_at >= created_at),
  PRIMARY KEY (payout_id, revenue_ledger_id)
);
CREATE UNIQUE INDEX uq_platform_instructor_payout_items_active_revenue
  ON platform_instructor_payout_items(revenue_ledger_id) WHERE released_at IS NULL;

CREATE TABLE platform_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(code_hash) = 32),
  label VARCHAR(160) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'archived')),
  max_redemptions INTEGER CHECK (max_redemptions BETWEEN 1 AND 1000000000),
  expires_at TIMESTAMPTZ,
  benefit_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(benefit_snapshot) = 'object'),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER platform_invite_codes_set_updated_at BEFORE UPDATE ON platform_invite_codes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_invite_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES platform_invite_codes(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  entitlement_id UUID REFERENCES platform_course_entitlements(id) ON DELETE RESTRICT,
  membership_id UUID REFERENCES platform_memberships(id) ON DELETE RESTRICT,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invite_code_id, user_id),
  CHECK ((entitlement_id IS NOT NULL)::integer + (membership_id IS NOT NULL)::integer = 1)
);

CREATE TABLE platform_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE CHECK (code = LOWER(BTRIM(code)) AND code ~ '^[a-z0-9][a-z0-9_-]{5,79}$'),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  current_revision INTEGER NOT NULL CHECK (current_revision > 0),
  is_printed BOOLEAN NOT NULL DEFAULT FALSE,
  owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  disabled_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status <> 'disabled' OR disabled_at IS NOT NULL),
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);
CREATE INDEX idx_platform_qr_codes_status ON platform_qr_codes(status, created_at DESC, id);
CREATE TRIGGER platform_qr_codes_set_updated_at BEFORE UPDATE ON platform_qr_codes
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_qr_revisions (
  qr_code_id UUID NOT NULL REFERENCES platform_qr_codes(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  target_kind VARCHAR(24) NOT NULL CHECK (target_kind IN ('internal_path', 'external_url', 'content')),
  target_value TEXT NOT NULL CHECK (target_value = BTRIM(target_value) AND CHAR_LENGTH(target_value) BETWEEN 1 AND 4000 AND target_value !~ '[[:cntrl:]]'),
  title_zh VARCHAR(240) NOT NULL DEFAULT '',
  title_en VARCHAR(240) NOT NULL DEFAULT '',
  approved_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  approved_by_actor_key VARCHAR(160)
    CHECK (approved_by_actor_key = BTRIM(approved_by_actor_key) AND approved_by_actor_key <> ''),
  approved_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (qr_code_id, revision),
  CHECK (
    (target_kind = 'internal_path' AND target_value ~ '^/[A-Za-z0-9/_?&=.#%+~-]*$' AND LEFT(target_value, 2) <> '//')
    OR (target_kind = 'external_url' AND target_value ~ '^https?://[^[:space:]]+$' AND approved_by_actor_key IS NOT NULL AND approved_at IS NOT NULL)
    OR target_kind = 'content'
  )
);
ALTER TABLE platform_qr_codes ADD CONSTRAINT platform_qr_codes_current_revision_fk
  FOREIGN KEY (id, current_revision) REFERENCES platform_qr_revisions(qr_code_id, revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE platform_qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id UUID NOT NULL REFERENCES platform_qr_codes(id) ON DELETE RESTRICT,
  qr_revision INTEGER NOT NULL,
  visitor_hash BYTEA NOT NULL CHECK (octet_length(visitor_hash) = 32),
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  first_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scan_count BIGINT NOT NULL DEFAULT 1 CHECK (scan_count BETWEEN 1 AND 9007199254740991),
  coarse_context JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(coarse_context) = 'object')
    CHECK (NOT (coarse_context ?| ARRAY['ip', 'ip_address', 'ua', 'user_agent', 'email', 'phone', 'url', 'referrer'])),
  UNIQUE (qr_code_id, visitor_hash),
  CONSTRAINT platform_qr_scans_revision_fk FOREIGN KEY (qr_code_id, qr_revision)
    REFERENCES platform_qr_revisions(qr_code_id, revision) ON DELETE RESTRICT,
  CHECK (last_scanned_at >= first_scanned_at)
);
CREATE INDEX idx_platform_qr_scans_code_time ON platform_qr_scans(qr_code_id, last_scanned_at DESC);

CREATE TABLE platform_qr_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(120) NOT NULL UNIQUE CHECK (template_key = LOWER(BTRIM(template_key)) AND template_key ~ '^[a-z0-9][a-z0-9_.-]{0,119}$'),
  name_zh VARCHAR(160) NOT NULL DEFAULT '',
  name_en VARCHAR(160) NOT NULL DEFAULT '',
  template_kind VARCHAR(20) NOT NULL CHECK (template_kind IN ('prompt', 'landing', 'card')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN -1000000 AND 1000000),
  template JSONB NOT NULL CHECK (jsonb_typeof(template) = 'object'),
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (name_zh <> '' OR name_en <> ''),
  CHECK (status <> 'archived' OR archived_at IS NOT NULL)
);
CREATE INDEX idx_platform_qr_templates_sort ON platform_qr_templates(status, template_kind, sort_order, id);
CREATE TRIGGER platform_qr_templates_set_updated_at BEFORE UPDATE ON platform_qr_templates
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_qr_card_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  template_id UUID NOT NULL REFERENCES platform_qr_templates(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  request_snapshot JSONB NOT NULL CHECK (jsonb_typeof(request_snapshot) = 'object'),
  output_media_id UUID REFERENCES platform_media_assets(id) ON DELETE SET NULL,
  failure_code VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  CHECK (status <> 'running' OR started_at IS NOT NULL),
  CHECK (status NOT IN ('succeeded', 'failed', 'cancelled') OR finished_at IS NOT NULL),
  CHECK (status <> 'succeeded' OR output_media_id IS NOT NULL),
  CHECK (status <> 'failed' OR failure_code IS NOT NULL)
);
CREATE INDEX idx_platform_qr_card_jobs_queue ON platform_qr_card_jobs(status, created_at, id);

CREATE TABLE platform_privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES app_users(id) ON DELETE CASCADE,
  anonymous_subject_hash BYTEA CHECK (octet_length(anonymous_subject_hash) = 32),
  purpose VARCHAR(40) NOT NULL CHECK (purpose IN ('essential', 'analytics', 'marketing')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('granted', 'denied', 'withdrawn')),
  policy_version VARCHAR(40) NOT NULL CHECK (policy_version = BTRIM(policy_version) AND policy_version <> ''),
  source VARCHAR(40) NOT NULL CHECK (source = BTRIM(source) AND source <> ''),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  supersedes_consent_id UUID UNIQUE REFERENCES platform_privacy_consents(id) ON DELETE RESTRICT,
  CHECK ((user_id IS NOT NULL)::integer + (anonymous_subject_hash IS NOT NULL)::integer = 1)
);
CREATE INDEX idx_platform_privacy_consents_user
  ON platform_privacy_consents(user_id, purpose, policy_version) WHERE user_id IS NOT NULL;
CREATE INDEX idx_platform_privacy_consents_anonymous
  ON platform_privacy_consents(anonymous_subject_hash, purpose, policy_version) WHERE anonymous_subject_hash IS NOT NULL;

CREATE TABLE platform_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID REFERENCES platform_privacy_consents(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  anonymous_subject_hash BYTEA CHECK (octet_length(anonymous_subject_hash) = 32),
  event_name VARCHAR(80) NOT NULL CHECK (event_name ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  surface VARCHAR(80) NOT NULL CHECK (surface ~ '^[a-z0-9/_-]{1,80}$'),
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(dimensions) = 'object')
    CHECK (NOT (dimensions ?| ARRAY['ip', 'ip_address', 'ua', 'user_agent', 'email', 'phone', 'url', 'referrer'])),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CHECK (expires_at > occurred_at),
  CHECK (user_id IS NOT NULL OR anonymous_subject_hash IS NOT NULL)
);
CREATE INDEX idx_platform_analytics_events_retention ON platform_analytics_events(expires_at, id);
CREATE INDEX idx_platform_analytics_events_rollup ON platform_analytics_events(event_name, occurred_at);

CREATE TABLE platform_analytics_daily_aggregates (
  local_date DATE NOT NULL,
  event_name VARCHAR(80) NOT NULL CHECK (event_name ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  surface VARCHAR(80) NOT NULL CHECK (surface ~ '^[a-z0-9/_-]{1,80}$'),
  dimensions_hash BYTEA NOT NULL CHECK (octet_length(dimensions_hash) = 32),
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(dimensions) = 'object'),
  event_count BIGINT NOT NULL CHECK (event_count >= 0),
  unique_subject_count BIGINT NOT NULL CHECK (unique_subject_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (local_date, event_name, surface, dimensions_hash)
);
CREATE TRIGGER platform_analytics_daily_aggregates_set_updated_at BEFORE UPDATE ON platform_analytics_daily_aggregates
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_retention_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_class VARCHAR(40) NOT NULL CHECK (data_class IN ('analytics_events', 'qr_scans', 'idempotency', 'outbox_payloads', 'shipping_addresses')),
  cutoff_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  rows_affected BIGINT CHECK (rows_affected >= 0),
  failure_code VARCHAR(120),
  requested_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  CHECK (status <> 'running' OR started_at IS NOT NULL),
  CHECK (status NOT IN ('succeeded', 'failed') OR finished_at IS NOT NULL),
  CHECK (status <> 'failed' OR failure_code IS NOT NULL)
);
CREATE INDEX idx_platform_retention_jobs_queue ON platform_retention_jobs(status, created_at, id);

CREATE TABLE platform_reconciliation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  merchant_account VARCHAR(120) NOT NULL CHECK (merchant_account = BTRIM(merchant_account) AND merchant_account <> ''),
  statement_date DATE NOT NULL,
  provider_transaction_id VARCHAR(200) NOT NULL,
  payment_attempt_id UUID REFERENCES platform_payment_attempts(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES platform_refunds(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor BETWEEN -9007199254740991 AND 9007199254740991),
  currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status VARCHAR(20) NOT NULL CHECK (status IN ('matched', 'missing_local', 'amount_mismatch', 'currency_mismatch', 'ignored')),
  evidence_hash BYTEA NOT NULL CHECK (octet_length(evidence_hash) = 32),
  resolved_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  resolved_by_actor_key VARCHAR(160)
    CHECK (resolved_by_actor_key = BTRIM(resolved_by_actor_key) AND resolved_by_actor_key <> ''),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (provider, merchant_account, statement_date, provider_transaction_id),
  CHECK ((payment_attempt_id IS NOT NULL)::integer + (refund_id IS NOT NULL)::integer <= 1),
  CHECK (status <> 'matched' OR (payment_attempt_id IS NOT NULL)::integer + (refund_id IS NOT NULL)::integer = 1),
  CHECK (resolved_at IS NULL OR resolved_by_actor_key IS NOT NULL)
);
CREATE INDEX idx_platform_reconciliation_records_status ON platform_reconciliation_records(status, statement_date, id);

CREATE TABLE platform_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  actor_key VARCHAR(160) NOT NULL CHECK (actor_key = BTRIM(actor_key) AND actor_key <> ''),
  action VARCHAR(120) NOT NULL CHECK (action ~ '^[a-z][a-z0-9_.:-]{0,119}$'),
  resource_type VARCHAR(80) NOT NULL CHECK (resource_type ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  resource_id VARCHAR(160) CHECK (resource_id = BTRIM(resource_id) AND resource_id <> ''),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('allowed', 'denied', 'failed')),
  reason_code VARCHAR(120),
  request_id VARCHAR(160),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object')
    CHECK (NOT (metadata ?| ARRAY['authorization', 'cookie', 'password', 'secret', 'token', 'body', 'email', 'phone'])),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (outcome = 'allowed' OR reason_code IS NOT NULL)
);
CREATE INDEX idx_platform_audit_events_resource
  ON platform_audit_events(resource_type, resource_id, occurred_at DESC, id);
CREATE INDEX idx_platform_audit_events_actor
  ON platform_audit_events(actor_user_id, occurred_at DESC, id) WHERE actor_user_id IS NOT NULL;

CREATE TABLE platform_outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(120) NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{0,119}$'),
  aggregate_type VARCHAR(80) NOT NULL CHECK (aggregate_type ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  aggregate_id VARCHAR(160) NOT NULL CHECK (aggregate_id = BTRIM(aggregate_id) AND aggregate_id <> ''),
  dedupe_key VARCHAR(240) NOT NULL UNIQUE CHECK (dedupe_key = BTRIM(dedupe_key) AND dedupe_key <> ''),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'dead_letter')),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 1000),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(120),
  delivered_at TIMESTAMPTZ,
  last_error_code VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((locked_at IS NULL) = (locked_by IS NULL)),
  CHECK (status <> 'processing' OR locked_at IS NOT NULL),
  CHECK (status <> 'delivered' OR delivered_at IS NOT NULL),
  CHECK (status <> 'dead_letter' OR last_error_code IS NOT NULL)
);
CREATE INDEX idx_platform_outbox_events_dispatch ON platform_outbox_events(status, available_at, id)
  WHERE status IN ('pending', 'processing');
CREATE TRIGGER platform_outbox_events_set_updated_at BEFORE UPDATE ON platform_outbox_events
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TABLE platform_idempotency_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_key VARCHAR(160) NOT NULL CHECK (actor_key = BTRIM(actor_key) AND actor_key <> ''),
  actor_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  scope VARCHAR(120) NOT NULL CHECK (scope ~ '^[a-z][a-z0-9_.:/-]{0,119}$'),
  idempotency_key VARCHAR(160) NOT NULL CHECK (idempotency_key = BTRIM(idempotency_key) AND idempotency_key <> ''),
  request_hash BYTEA NOT NULL CHECK (octet_length(request_hash) = 32),
  state VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (state IN ('processing', 'completed', 'failed')),
  response_status INTEGER CHECK (response_status BETWEEN 100 AND 599),
  response_body JSONB,
  resource_type VARCHAR(80),
  resource_id VARCHAR(160),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_key, scope, idempotency_key),
  CHECK (expires_at > created_at),
  CHECK (state = 'processing' OR response_status IS NOT NULL),
  CHECK (response_body IS NULL OR jsonb_typeof(response_body) IN ('object', 'array')),
  CHECK ((resource_type IS NULL) = (resource_id IS NULL))
);
CREATE INDEX idx_platform_idempotency_requests_expiry ON platform_idempotency_requests(expires_at, id);
CREATE TRIGGER platform_idempotency_requests_set_updated_at BEFORE UPDATE ON platform_idempotency_requests
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER platform_course_revisions_append_only
  BEFORE UPDATE OR DELETE ON platform_course_revisions
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_lesson_revisions_append_only
  BEFORE UPDATE OR DELETE ON platform_lesson_revisions
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_quiz_revisions_append_only
  BEFORE UPDATE OR DELETE ON platform_quiz_revisions
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_quiz_questions_append_only
  BEFORE UPDATE OR DELETE ON platform_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_inventory_ledger_append_only
  BEFORE UPDATE OR DELETE ON platform_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_fulfillment_ledger_append_only
  BEFORE UPDATE OR DELETE ON platform_fulfillment_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_entitlement_ledger_append_only
  BEFORE UPDATE OR DELETE ON platform_entitlement_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_membership_ledger_append_only
  BEFORE UPDATE OR DELETE ON platform_membership_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_point_ledger_append_only
  BEFORE UPDATE OR DELETE ON platform_point_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_instructor_revenue_ledger_append_only
  BEFORE UPDATE OR DELETE ON platform_instructor_revenue_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_qr_revisions_append_only
  BEFORE UPDATE OR DELETE ON platform_qr_revisions
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_privacy_consents_append_only
  BEFORE UPDATE OR DELETE ON platform_privacy_consents
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();
CREATE TRIGGER platform_audit_events_append_only
  BEFORE UPDATE OR DELETE ON platform_audit_events
  FOR EACH ROW EXECUTE FUNCTION trg_platform_reject_update_delete();

CREATE OR REPLACE FUNCTION trg_validate_platform_course_owner_share() RETURNS TRIGGER AS $$
DECLARE
  active_share INTEGER;
  excluded_instructor UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.course_id <> OLD.course_id OR NEW.instructor_id <> OLD.instructor_id) THEN
    RAISE EXCEPTION 'platform course owner identity is immutable';
  END IF;
  IF TG_OP = 'UPDATE' THEN excluded_instructor := OLD.instructor_id; END IF;
  PERFORM 1 FROM platform_courses WHERE id = NEW.course_id FOR UPDATE;
  SELECT COALESCE(SUM(revenue_share_bps), 0)
    INTO active_share
    FROM platform_course_owners
    WHERE course_id = NEW.course_id
      AND status = 'active'
      AND (excluded_instructor IS NULL OR instructor_id <> excluded_instructor);
  IF NEW.status = 'active' THEN active_share := active_share + NEW.revenue_share_bps; END IF;
  IF active_share > 10000 THEN
    RAISE EXCEPTION 'active platform course owner revenue shares cannot exceed 10000 bps';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_course_owners_validate_share
  BEFORE INSERT OR UPDATE ON platform_course_owners
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_course_owner_share();

CREATE OR REPLACE FUNCTION trg_validate_platform_inventory_ledger_insert() RETURNS TRIGGER AS $$
DECLARE
  source platform_inventory_ledger%ROWTYPE;
  current_on_hand INTEGER;
  current_reserved INTEGER;
BEGIN
  SELECT inventory_on_hand, inventory_reserved
    INTO current_on_hand, current_reserved
    FROM platform_product_variants
    WHERE id = NEW.product_variant_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'platform inventory parent missing'; END IF;

  IF NEW.reversal_of_ledger_id IS NOT NULL THEN
    SELECT * INTO source FROM platform_inventory_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF NOT FOUND OR source.product_variant_id <> NEW.product_variant_id OR source.reversal_of_ledger_id IS NOT NULL
       OR NEW.delta_on_hand <> -source.delta_on_hand OR NEW.delta_reserved <> -source.delta_reserved THEN
      RAISE EXCEPTION 'platform inventory reversal must exactly reverse one entry for the same variant';
    END IF;
  END IF;

  IF current_on_hand + NEW.delta_on_hand < 0
     OR current_reserved + NEW.delta_reserved < 0
     OR current_reserved + NEW.delta_reserved > current_on_hand + NEW.delta_on_hand THEN
    RAISE EXCEPTION 'platform inventory balance cannot be negative or oversold';
  END IF;

  UPDATE platform_product_variants
    SET inventory_on_hand = inventory_on_hand + NEW.delta_on_hand,
        inventory_reserved = inventory_reserved + NEW.delta_reserved,
        inventory_revision = inventory_revision + 1
    WHERE id = NEW.product_variant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_inventory_ledger_validate_insert
  BEFORE INSERT ON platform_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_inventory_ledger_insert();

CREATE OR REPLACE FUNCTION trg_validate_platform_exact_reversal() RETURNS TRIGGER AS $$
DECLARE
  source_id UUID;
  source_parent UUID;
  source_delta BIGINT;
  source_currency VARCHAR(3);
  source_is_reversal BOOLEAN;
BEGIN
  IF NEW.reversal_of_ledger_id IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'platform_fulfillment_ledger' THEN
    SELECT id, order_item_id, delta_quantity::bigint, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_fulfillment_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.order_item_id OR source_is_reversal OR NEW.delta_quantity::bigint <> -source_delta THEN
      RAISE EXCEPTION 'platform fulfillment reversal must exactly reverse one entry for the same order item';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_entitlement_ledger' THEN
    SELECT id, entitlement_id, delta_access::bigint, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_entitlement_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.entitlement_id OR source_is_reversal OR NEW.delta_access::bigint <> -source_delta THEN
      RAISE EXCEPTION 'platform entitlement reversal must exactly reverse one entry for the same entitlement';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_membership_ledger' THEN
    SELECT id, membership_id, delta_access::bigint, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_membership_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.membership_id OR source_is_reversal OR NEW.delta_access::bigint <> -source_delta THEN
      RAISE EXCEPTION 'platform membership reversal must exactly reverse one entry for the same membership';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_point_ledger' THEN
    SELECT id, NULL::uuid, delta_points, NULL::varchar, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_point_ledger WHERE id = NEW.reversal_of_ledger_id AND user_id IS NOT DISTINCT FROM NEW.user_id FOR UPDATE;
    IF source_id IS NULL OR source_is_reversal OR NEW.delta_points <> -source_delta THEN
      RAISE EXCEPTION 'platform point reversal must exactly reverse one entry for the same user';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_instructor_revenue_ledger' THEN
    SELECT id, instructor_id, delta_amount_minor, currency, reversal_of_ledger_id IS NOT NULL
      INTO source_id, source_parent, source_delta, source_currency, source_is_reversal
      FROM platform_instructor_revenue_ledger WHERE id = NEW.reversal_of_ledger_id FOR UPDATE;
    IF source_id IS NULL OR source_parent <> NEW.instructor_id OR source_is_reversal
       OR NEW.delta_amount_minor <> -source_delta OR NEW.currency <> source_currency THEN
      RAISE EXCEPTION 'platform instructor revenue reversal must exactly reverse one entry in the same currency';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_fulfillment_ledger_validate_reversal BEFORE INSERT ON platform_fulfillment_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_exact_reversal();
CREATE TRIGGER platform_entitlement_ledger_validate_reversal BEFORE INSERT ON platform_entitlement_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_exact_reversal();
CREATE TRIGGER platform_membership_ledger_validate_reversal BEFORE INSERT ON platform_membership_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_exact_reversal();
CREATE TRIGGER platform_point_ledger_validate_reversal BEFORE INSERT ON platform_point_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_exact_reversal();
CREATE TRIGGER platform_instructor_revenue_ledger_validate_reversal BEFORE INSERT ON platform_instructor_revenue_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_exact_reversal();

CREATE OR REPLACE FUNCTION trg_guard_platform_instructor_payout() RETURNS TRIGGER AS $$
DECLARE
  active_total BIGINT;
BEGIN
  IF NEW.instructor_id <> OLD.instructor_id OR NEW.payout_number <> OLD.payout_number
     OR NEW.currency <> OLD.currency
     OR NEW.payout_profile_snapshot_encrypted <> OLD.payout_profile_snapshot_encrypted
     OR NEW.payout_key_version <> OLD.payout_key_version THEN
    RAISE EXCEPTION 'platform payout identity, currency, and payout profile snapshot are immutable';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('approved', 'cancelled'))
    OR (OLD.status = 'approved' AND NEW.status IN ('processing', 'paid', 'cancelled'))
    OR (OLD.status = 'processing' AND NEW.status IN ('paid', 'failed', 'cancelled'))
    OR (OLD.status = 'failed' AND OLD.failure_code = 'refund_after_processing' AND NEW.status = 'paid')
  ) THEN
    RAISE EXCEPTION 'invalid platform payout status transition: % -> %', OLD.status, NEW.status;
  END IF;
  IF OLD.status <> 'draft' AND NEW.amount_minor <> OLD.amount_minor THEN
    RAISE EXCEPTION 'approved platform payout amount is immutable';
  END IF;
  IF NEW.status IN ('approved', 'processing', 'paid') THEN
    SELECT COALESCE(SUM(amount_minor), 0)
      INTO active_total
      FROM platform_instructor_payout_items
      WHERE payout_id = NEW.id AND released_at IS NULL;
    IF active_total <= 0 OR active_total <> NEW.amount_minor THEN
      RAISE EXCEPTION 'platform payout amount must equal its positive active signed item total';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_instructor_payouts_guard
  BEFORE UPDATE ON platform_instructor_payouts
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_instructor_payout();

CREATE OR REPLACE FUNCTION trg_guard_platform_instructor_payout_item() RETURNS TRIGGER AS $$
DECLARE
  payout_instructor UUID;
  payout_currency VARCHAR(3);
  payout_status VARCHAR(20);
  revenue_instructor UUID;
  revenue_amount BIGINT;
  revenue_currency VARCHAR(3);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'platform payout items may only be released, not deleted';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.payout_id <> OLD.payout_id OR NEW.revenue_ledger_id <> OLD.revenue_ledger_id
       OR NEW.amount_minor <> OLD.amount_minor OR NEW.currency <> OLD.currency
       OR NEW.created_at <> OLD.created_at OR OLD.released_at IS NOT NULL OR NEW.released_at IS NULL THEN
      RAISE EXCEPTION 'platform payout item identity and signed amount are immutable';
    END IF;
    SELECT status INTO payout_status
      FROM platform_instructor_payouts WHERE id = NEW.payout_id FOR UPDATE;
    IF payout_status NOT IN ('cancelled', 'failed') THEN
      RAISE EXCEPTION 'platform payout items may only be released from cancelled or failed payouts';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.released_at IS NOT NULL THEN
    RAISE EXCEPTION 'new platform payout items cannot start released';
  END IF;
  SELECT instructor_id, currency, status
    INTO payout_instructor, payout_currency, payout_status
    FROM platform_instructor_payouts WHERE id = NEW.payout_id FOR UPDATE;
  IF payout_instructor IS NULL OR payout_status <> 'draft' THEN
    RAISE EXCEPTION 'platform payout items may only be allocated to a draft payout';
  END IF;
  SELECT instructor_id, delta_amount_minor, currency
    INTO revenue_instructor, revenue_amount, revenue_currency
    FROM platform_instructor_revenue_ledger WHERE id = NEW.revenue_ledger_id FOR UPDATE;
  IF revenue_instructor IS NULL OR revenue_instructor <> payout_instructor
     OR NEW.amount_minor <> revenue_amount
     OR NEW.currency <> revenue_currency OR NEW.currency <> payout_currency THEN
    RAISE EXCEPTION 'platform payout item must exactly match its instructor revenue ledger and payout currency';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_instructor_payout_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON platform_instructor_payout_items
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_instructor_payout_item();

CREATE OR REPLACE FUNCTION trg_guard_platform_qr_code() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'platform QR codes are soft-delete only';
  END IF;
  IF OLD.is_printed AND NEW.code <> OLD.code THEN
    RAISE EXCEPTION 'printed platform QR code cannot be renamed';
  END IF;
  IF OLD.status = 'archived' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION 'archived platform QR code cannot be restored without a new revisioned code';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_qr_codes_guard
  BEFORE UPDATE OR DELETE ON platform_qr_codes
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_qr_code();

CREATE OR REPLACE FUNCTION trg_guard_platform_order_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('pending_payment', 'cancelled'))
    OR (OLD.status = 'pending_payment' AND NEW.status IN ('paid', 'cancelled'))
    OR (OLD.status = 'paid' AND NEW.status IN ('partially_fulfilled', 'fulfilled', 'partially_refunded', 'refunded', 'chargeback'))
    OR (OLD.status = 'partially_fulfilled' AND NEW.status IN ('fulfilled', 'partially_refunded', 'refunded', 'chargeback'))
    OR (OLD.status = 'fulfilled' AND NEW.status IN ('partially_refunded', 'refunded', 'chargeback'))
    OR (OLD.status = 'partially_refunded' AND NEW.status IN ('refunded', 'chargeback'))
  ) THEN
    RAISE EXCEPTION 'invalid platform order status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_orders_guard_status BEFORE UPDATE ON platform_orders
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_order_status();

CREATE OR REPLACE FUNCTION trg_guard_platform_payment_attempt() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id <> OLD.order_id OR NEW.provider <> OLD.provider OR NEW.merchant_account <> OLD.merchant_account
     OR NEW.provider_order_id <> OLD.provider_order_id OR NEW.amount_minor <> OLD.amount_minor OR NEW.currency <> OLD.currency
     OR NEW.request_hash <> OLD.request_hash THEN
    RAISE EXCEPTION 'platform payment identity, merchant, amount, currency, and request hash are immutable';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'initiated' AND NEW.status IN ('pending', 'succeeded', 'failed', 'cancelled'))
    OR (OLD.status = 'pending' AND NEW.status IN ('succeeded', 'failed', 'cancelled'))
    OR (
      OLD.status IN ('failed', 'cancelled')
      AND OLD.failure_code IN ('provider_not_succeeded', 'attempt_expired', 'reservation_expired', 'order_cancelled')
      AND NEW.status = 'succeeded'
      AND NEW.provider_transaction_id IS NOT NULL
      AND NEW.succeeded_at IS NOT NULL
    )
    OR (OLD.status = 'succeeded' AND NEW.status IN ('refunded', 'chargeback'))
  ) THEN
    RAISE EXCEPTION 'invalid platform payment status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_payment_attempts_guard BEFORE UPDATE ON platform_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_payment_attempt();

CREATE OR REPLACE FUNCTION trg_guard_platform_provider_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'verified platform provider events are append-only';
  END IF;
  IF ROW(NEW.payment_attempt_id, NEW.order_id, NEW.provider, NEW.merchant_account, NEW.provider_event_id,
         NEW.provider_transaction_id, NEW.event_type, NEW.amount_minor, NEW.currency, NEW.signature_verified,
         NEW.merchant_verified, NEW.order_verified, NEW.amount_currency_verified, NEW.payload_hash, NEW.payload_sanitized,
         NEW.received_at)
     IS DISTINCT FROM
     ROW(OLD.payment_attempt_id, OLD.order_id, OLD.provider, OLD.merchant_account, OLD.provider_event_id,
         OLD.provider_transaction_id, OLD.event_type, OLD.amount_minor, OLD.currency, OLD.signature_verified,
         OLD.merchant_verified, OLD.order_verified, OLD.amount_currency_verified, OLD.payload_hash, OLD.payload_sanitized,
         OLD.received_at) THEN
    RAISE EXCEPTION 'verified platform provider event evidence is immutable';
  END IF;
  IF OLD.status <> 'received' OR NEW.status NOT IN ('processed', 'rejected') THEN
    RAISE EXCEPTION 'invalid platform provider event status transition';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_provider_events_guard BEFORE UPDATE OR DELETE ON platform_provider_events
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_provider_event();

CREATE OR REPLACE FUNCTION trg_guard_platform_refund() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id <> OLD.order_id OR NEW.payment_attempt_id <> OLD.payment_attempt_id
     OR NEW.order_item_id IS DISTINCT FROM OLD.order_item_id OR NEW.amount_minor <> OLD.amount_minor
     OR NEW.currency <> OLD.currency OR NEW.provider <> OLD.provider OR NEW.reason_code <> OLD.reason_code THEN
    RAISE EXCEPTION 'platform refund target, amount, currency, and reason are immutable';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'requested' AND NEW.status IN ('pending', 'succeeded', 'failed', 'cancelled'))
    OR (OLD.status = 'pending' AND NEW.status IN ('succeeded', 'failed', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'invalid platform refund status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_refunds_guard BEFORE UPDATE ON platform_refunds
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_refund();

CREATE OR REPLACE FUNCTION trg_validate_platform_refund_total() RETURNS TRIGGER AS $$
DECLARE
  paid_amount BIGINT;
  committed_refunds BIGINT;
BEGIN
  SELECT amount_minor INTO paid_amount
    FROM platform_payment_attempts
    WHERE id = NEW.payment_attempt_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'platform refund payment attempt missing'; END IF;

  SELECT COALESCE(SUM(amount_minor), 0)
    INTO committed_refunds
    FROM platform_refunds
    WHERE payment_attempt_id = NEW.payment_attempt_id
      AND status IN ('requested', 'pending', 'succeeded')
      AND id <> NEW.id;
  IF NEW.status IN ('requested', 'pending', 'succeeded') THEN
    committed_refunds := committed_refunds + NEW.amount_minor;
  END IF;
  IF committed_refunds > paid_amount THEN
    RAISE EXCEPTION 'platform refunds cannot exceed the captured payment amount';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_refunds_validate_total
  BEFORE INSERT OR UPDATE ON platform_refunds
  FOR EACH ROW EXECUTE FUNCTION trg_validate_platform_refund_total();

CREATE OR REPLACE FUNCTION trg_guard_platform_reconciliation_record() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'platform reconciliation evidence cannot be deleted';
  END IF;
  IF ROW(NEW.provider, NEW.merchant_account, NEW.statement_date, NEW.provider_transaction_id,
         NEW.payment_attempt_id, NEW.refund_id, NEW.amount_minor, NEW.currency, NEW.status,
         NEW.evidence_hash, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.provider, OLD.merchant_account, OLD.statement_date, OLD.provider_transaction_id,
         OLD.payment_attempt_id, OLD.refund_id, OLD.amount_minor, OLD.currency, OLD.status,
         OLD.evidence_hash, OLD.created_at) THEN
    RAISE EXCEPTION 'platform reconciliation source evidence is immutable';
  END IF;
  IF OLD.resolved_at IS NOT NULL AND ROW(NEW.resolved_by_user_id, NEW.resolved_by_actor_key, NEW.resolution_note, NEW.resolved_at)
     IS DISTINCT FROM ROW(OLD.resolved_by_user_id, OLD.resolved_by_actor_key, OLD.resolution_note, OLD.resolved_at) THEN
    RAISE EXCEPTION 'resolved platform reconciliation evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_reconciliation_records_guard
  BEFORE UPDATE OR DELETE ON platform_reconciliation_records
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_reconciliation_record();

CREATE OR REPLACE FUNCTION trg_guard_platform_outbox_event() RETURNS TRIGGER AS $$
BEGIN
  IF ROW(NEW.event_type, NEW.aggregate_type, NEW.aggregate_id, NEW.dedupe_key, NEW.payload, NEW.created_at)
     IS DISTINCT FROM ROW(OLD.event_type, OLD.aggregate_type, OLD.aggregate_id, OLD.dedupe_key, OLD.payload, OLD.created_at) THEN
    RAISE EXCEPTION 'platform outbox event identity and payload are immutable';
  END IF;
  IF NEW.attempt_count < OLD.attempt_count THEN
    RAISE EXCEPTION 'platform outbox attempt count cannot decrease';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'pending' AND NEW.status = 'processing')
    OR (OLD.status = 'processing' AND NEW.status IN ('pending', 'delivered', 'dead_letter'))
  ) THEN
    RAISE EXCEPTION 'invalid platform outbox status transition: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_outbox_events_guard
  BEFORE UPDATE ON platform_outbox_events
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_outbox_event();

CREATE OR REPLACE FUNCTION trg_guard_platform_idempotency_request() RETURNS TRIGGER AS $$
DECLARE
  is_finishing BOOLEAN;
  is_reclaiming BOOLEAN;
BEGIN
  is_finishing := OLD.state = 'processing' AND NEW.state IN ('completed', 'failed');
  is_reclaiming := NEW.state = 'processing'
    AND (OLD.state = 'failed' OR (OLD.state = 'processing' AND OLD.lease_expires_at <= NOW()))
    AND NEW.lease_expires_at > NOW();

  IF ROW(NEW.actor_key, NEW.actor_user_id, NEW.scope, NEW.idempotency_key, NEW.request_hash, NEW.created_at)
     IS DISTINCT FROM ROW(OLD.actor_key, OLD.actor_user_id, OLD.scope, OLD.idempotency_key, OLD.request_hash, OLD.created_at) THEN
    RAISE EXCEPTION 'platform idempotency identity and request hash are immutable';
  END IF;
  IF NEW.state <> OLD.state AND NOT (OLD.state = 'processing' AND NEW.state IN ('completed', 'failed')) THEN
    IF NOT (OLD.state = 'failed' AND NEW.state = 'processing') THEN
      RAISE EXCEPTION 'invalid platform idempotency state transition: % -> %', OLD.state, NEW.state;
    END IF;
  END IF;
  IF NEW.expires_at < OLD.expires_at
     OR (NEW.expires_at <> OLD.expires_at AND NOT (is_finishing OR is_reclaiming)) THEN
    RAISE EXCEPTION 'platform idempotency retention boundary may only be extended while finalizing or safely reclaiming';
  END IF;
  IF NEW.lease_expires_at <> OLD.lease_expires_at AND NOT (is_finishing OR is_reclaiming) THEN
    RAISE EXCEPTION 'platform idempotency lease may only change while finalizing or safely reclaiming';
  END IF;
  IF NOT (is_finishing OR is_reclaiming)
     AND ROW(NEW.response_status, NEW.response_body, NEW.resource_type, NEW.resource_id)
     IS DISTINCT FROM ROW(OLD.response_status, OLD.response_body, OLD.resource_type, OLD.resource_id) THEN
    RAISE EXCEPTION 'platform idempotency response is immutable outside finalization or safe reclaim';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_idempotency_requests_guard
  BEFORE UPDATE ON platform_idempotency_requests
  FOR EACH ROW EXECUTE FUNCTION trg_guard_platform_idempotency_request();
