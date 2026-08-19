ALTER TABLE notifications
  ADD COLUMN dedupe_key VARCHAR(200),
  ADD CONSTRAINT notifications_dedupe_key_check CHECK (
    dedupe_key IS NULL OR (
      dedupe_key = btrim(dedupe_key)
      AND length(dedupe_key) BETWEEN 1 AND 200
    )
  );

CREATE UNIQUE INDEX uq_notifications_user_kind_dedupe
  ON notifications (user_key, kind, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE teaching_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  student_display_name_snapshot VARCHAR(160) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  last_message_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_message_sequence >= 0),
  last_message_at TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_by_display_name_snapshot VARCHAR(200) NOT NULL,
  created_by_role_snapshot VARCHAR(16) NOT NULL,
  created_by_relationship_snapshot VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, id, student_id),
  CONSTRAINT teaching_conversations_student_fk
    FOREIGN KEY (organization_id, student_id)
    REFERENCES student_profiles(organization_id, id) ON DELETE RESTRICT,
  CHECK (subject = btrim(subject) AND length(subject) BETWEEN 1 AND 200),
  CHECK (student_display_name_snapshot = btrim(student_display_name_snapshot)
    AND length(student_display_name_snapshot) BETWEEN 1 AND 160),
  CHECK (created_by_display_name_snapshot = btrim(created_by_display_name_snapshot)
    AND length(created_by_display_name_snapshot) BETWEEN 1 AND 200),
  CHECK (created_by_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant', 'student', 'guardian')),
  CHECK (created_by_relationship_snapshot IS NULL OR (
    created_by_relationship_snapshot = btrim(created_by_relationship_snapshot)
    AND length(created_by_relationship_snapshot) BETWEEN 1 AND 32
  )),
  CHECK ((last_message_sequence = 0) = (last_message_at IS NULL))
);

CREATE INDEX idx_teaching_conversations_student_recent
  ON teaching_conversations (organization_id, student_id, last_message_at DESC, id DESC);

CREATE TABLE teaching_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  conversation_id UUID NOT NULL,
  student_id UUID NOT NULL,
  participant_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  participant_display_name_snapshot VARCHAR(200) NOT NULL,
  participant_role_snapshot VARCHAR(16) NOT NULL,
  participant_relationship_snapshot VARCHAR(32),
  last_read_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_read_sequence >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  CONSTRAINT teaching_conversation_participants_conversation_fk
    FOREIGN KEY (organization_id, conversation_id, student_id)
    REFERENCES teaching_conversations(organization_id, id, student_id) ON DELETE RESTRICT,
  CHECK (participant_display_name_snapshot = btrim(participant_display_name_snapshot)
    AND length(participant_display_name_snapshot) BETWEEN 1 AND 200),
  CHECK (participant_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant', 'student', 'guardian')),
  CHECK (participant_relationship_snapshot IS NULL OR (
    participant_relationship_snapshot = btrim(participant_relationship_snapshot)
    AND length(participant_relationship_snapshot) BETWEEN 1 AND 32
  ))
);

CREATE UNIQUE INDEX uq_teaching_conversation_participants_live_user
  ON teaching_conversation_participants (organization_id, conversation_id, participant_user_id)
  WHERE participant_user_id IS NOT NULL;
CREATE INDEX idx_teaching_conversation_participants_user
  ON teaching_conversation_participants (participant_user_id, organization_id, conversation_id)
  WHERE participant_user_id IS NOT NULL;

CREATE TABLE teaching_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  conversation_id UUID NOT NULL,
  student_id UUID NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  body TEXT NOT NULL,
  author_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  author_display_name_snapshot VARCHAR(200) NOT NULL,
  author_role_snapshot VARCHAR(16) NOT NULL,
  author_relationship_snapshot VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, conversation_id, sequence),
  CONSTRAINT teaching_conversation_messages_conversation_fk
    FOREIGN KEY (organization_id, conversation_id, student_id)
    REFERENCES teaching_conversations(organization_id, id, student_id) ON DELETE RESTRICT,
  CHECK (body = btrim(body) AND length(body) BETWEEN 1 AND 10000),
  CHECK (author_display_name_snapshot = btrim(author_display_name_snapshot)
    AND length(author_display_name_snapshot) BETWEEN 1 AND 200),
  CHECK (author_role_snapshot IN ('owner', 'admin', 'teacher', 'assistant', 'student', 'guardian')),
  CHECK (author_relationship_snapshot IS NULL OR (
    author_relationship_snapshot = btrim(author_relationship_snapshot)
    AND length(author_relationship_snapshot) BETWEEN 1 AND 32
  ))
);

CREATE INDEX idx_teaching_conversation_messages_sequence
  ON teaching_conversation_messages (organization_id, conversation_id, sequence);

CREATE FUNCTION trg_guard_teaching_conversation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'teaching conversations are retained'
      USING ERRCODE = '55000';
  END IF;
  IF OLD.created_by_user_id IS NOT NULL
     AND NEW.created_by_user_id IS NULL
     AND (to_jsonb(NEW) - 'created_by_user_id') IS NOT DISTINCT FROM
         (to_jsonb(OLD) - 'created_by_user_id') THEN
    RETURN NEW;
  END IF;
  IF NEW.last_message_sequence = OLD.last_message_sequence + 1
     AND NEW.last_message_at IS NOT NULL
     AND (OLD.last_message_at IS NULL OR NEW.last_message_at >= OLD.last_message_at)
     AND (to_jsonb(NEW) - 'last_message_sequence' - 'last_message_at') IS NOT DISTINCT FROM
         (to_jsonb(OLD) - 'last_message_sequence' - 'last_message_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'teaching conversation content is immutable and sequence advances one at a time'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_conversations_guard
  BEFORE UPDATE OR DELETE ON teaching_conversations
  FOR EACH ROW EXECUTE FUNCTION trg_guard_teaching_conversation();

CREATE FUNCTION trg_guard_teaching_conversation_participant() RETURNS TRIGGER AS $$
DECLARE
  max_sequence INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'teaching conversation participants are retained'
      USING ERRCODE = '55000';
  END IF;
  SELECT last_message_sequence INTO max_sequence
  FROM teaching_conversations
  WHERE organization_id = NEW.organization_id
    AND id = NEW.conversation_id
    AND student_id = NEW.student_id;
  IF max_sequence IS NULL OR NEW.last_read_sequence > max_sequence THEN
    RAISE EXCEPTION 'conversation read sequence is outside the conversation range'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF OLD.participant_user_id IS NOT NULL
     AND NEW.participant_user_id IS NULL
     AND (to_jsonb(NEW) - 'participant_user_id') IS NOT DISTINCT FROM
         (to_jsonb(OLD) - 'participant_user_id') THEN
    RETURN NEW;
  END IF;
  IF NEW.last_read_sequence >= OLD.last_read_sequence
     AND (to_jsonb(NEW) - 'last_read_sequence') IS NOT DISTINCT FROM
         (to_jsonb(OLD) - 'last_read_sequence') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'conversation participant identity is immutable and read sequence cannot decrease'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_conversation_participants_guard
  BEFORE INSERT OR UPDATE OR DELETE ON teaching_conversation_participants
  FOR EACH ROW EXECUTE FUNCTION trg_guard_teaching_conversation_participant();

CREATE FUNCTION trg_guard_teaching_conversation_message() RETURNS TRIGGER AS $$
DECLARE
  max_sequence INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT last_message_sequence INTO max_sequence
    FROM teaching_conversations
    WHERE organization_id = NEW.organization_id
      AND id = NEW.conversation_id
      AND student_id = NEW.student_id;
    IF max_sequence IS NOT NULL AND NEW.sequence = max_sequence THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'teaching conversation message sequence does not match its parent'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.author_user_id IS NOT NULL
     AND NEW.author_user_id IS NULL
     AND (to_jsonb(NEW) - 'author_user_id') IS NOT DISTINCT FROM
         (to_jsonb(OLD) - 'author_user_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'teaching conversation messages are append-only'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teaching_conversation_messages_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON teaching_conversation_messages
  FOR EACH ROW EXECUTE FUNCTION trg_guard_teaching_conversation_message();

CREATE FUNCTION trg_check_teaching_conversation_message_appended() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_message_sequence <> OLD.last_message_sequence
     AND NOT EXISTS (
       SELECT 1
       FROM teaching_conversation_messages message
       WHERE message.organization_id = NEW.organization_id
         AND message.conversation_id = NEW.id
         AND message.student_id = NEW.student_id
         AND message.sequence = NEW.last_message_sequence
     ) THEN
    RAISE EXCEPTION 'teaching conversation sequence advance requires one appended message'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER teaching_conversations_message_appended
  AFTER UPDATE ON teaching_conversations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_check_teaching_conversation_message_appended();
