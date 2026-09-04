CREATE TABLE music_tracks (
  id                 UUID PRIMARY KEY,
  owner_user_id      BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  title              VARCHAR(300) NOT NULL CHECK (title = BTRIM(title) AND title <> ''),
  artist             VARCHAR(300) NOT NULL DEFAULT '',
  album              VARCHAR(300),
  genre              VARCHAR(100),
  lyrics_lrc         TEXT CHECK (lyrics_lrc IS NULL OR OCTET_LENGTH(lyrics_lrc) <= 65536),
  audio_storage_key  VARCHAR(100) NOT NULL UNIQUE,
  audio_mime         VARCHAR(32) NOT NULL CHECK (audio_mime IN ('audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/wav')),
  audio_size_bytes   BIGINT NOT NULL CHECK (audio_size_bytes BETWEEN 1 AND 104857600),
  audio_filename     VARCHAR(255) NOT NULL CHECK (audio_filename <> ''),
  cover_storage_key  VARCHAR(100) UNIQUE,
  cover_mime         VARCHAR(32) CHECK (cover_mime IS NULL OR cover_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  status             VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  review_note        VARCHAR(1000),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at       TIMESTAMPTZ,
  CONSTRAINT music_tracks_cover_pair CHECK ((cover_storage_key IS NULL) = (cover_mime IS NULL)),
  CONSTRAINT music_tracks_publish_time CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status <> 'published' AND published_at IS NULL)
  )
);

CREATE INDEX idx_music_tracks_published ON music_tracks(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_music_tracks_owner_created ON music_tracks(owner_user_id, created_at DESC);
CREATE INDEX idx_music_tracks_review ON music_tracks(status, created_at DESC);
CREATE TRIGGER music_tracks_updated_at BEFORE UPDATE ON music_tracks
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
