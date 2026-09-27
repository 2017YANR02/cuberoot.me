CREATE TABLE friend_chat_conversations (
  id UUID PRIMARY KEY,
  user_low_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  user_high_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  last_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  low_read_sequence BIGINT NOT NULL DEFAULT 0,
  high_read_sequence BIGINT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_low_id, user_high_id),
  CHECK (user_low_id < user_high_id),
  CHECK (low_read_sequence BETWEEN 0 AND last_sequence),
  CHECK (high_read_sequence BETWEEN 0 AND last_sequence)
);
CREATE INDEX idx_friend_chat_low ON friend_chat_conversations (user_low_id, last_message_at DESC, id DESC);
CREATE INDEX idx_friend_chat_high ON friend_chat_conversations (user_high_id, last_message_at DESC, id DESC);

CREATE TABLE friend_chat_messages (
  conversation_id UUID NOT NULL REFERENCES friend_chat_conversations(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL CHECK (sequence > 0),
  sender_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  client_message_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000 AND body ~ '[^[:space:]]'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, sequence),
  UNIQUE (conversation_id, sender_user_id, client_message_id)
);
CREATE INDEX idx_friend_chat_sender_time ON friend_chat_messages (sender_user_id, created_at DESC);
CREATE INDEX idx_friend_chat_unread ON friend_chat_messages (conversation_id, sender_user_id, sequence);
