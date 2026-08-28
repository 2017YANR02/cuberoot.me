CREATE TABLE creator_gallery_captions (
  image_key   VARCHAR(16)  PRIMARY KEY,
  caption_zh  VARCHAR(800) NOT NULL DEFAULT '',
  caption_en  VARCHAR(800) NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (image_key IN (
    'photo-01', 'photo-02', 'photo-03', 'photo-04',
    'photo-05', 'photo-06', 'photo-07', 'photo-08'
  )),
  CHECK (caption_zh = BTRIM(caption_zh)),
  CHECK (caption_en = BTRIM(caption_en))
);

CREATE TRIGGER creator_gallery_captions_updated_at
  BEFORE UPDATE ON creator_gallery_captions
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
