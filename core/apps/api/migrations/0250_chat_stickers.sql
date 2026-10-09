CREATE TABLE friend_chat_stickers (
  id UUID PRIMARY KEY,
  owner_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  data BYTEA NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 2097152),
  mime TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_sticker_owner ON friend_chat_stickers (owner_user_id, created_at);
CREATE TABLE friend_chat_sticker_favorites (
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES friend_chat_stickers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, sticker_id)
);
ALTER TABLE friend_chat_messages ADD COLUMN sticker_id UUID REFERENCES friend_chat_stickers(id);
CREATE INDEX idx_chat_message_sticker ON friend_chat_messages (sticker_id) WHERE sticker_id IS NOT NULL;
