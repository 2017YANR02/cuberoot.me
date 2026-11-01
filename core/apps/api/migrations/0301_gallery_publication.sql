-- Gallery images require an explicit request and administrator approval.
-- NULL remains an ordinary article image; existing gallery photos become private.
ALTER TABLE article_image
  ADD COLUMN gallery_status TEXT CHECK (gallery_status IN ('private', 'pending', 'public', 'rejected')),
  ADD COLUMN gallery_requested_at TIMESTAMPTZ,
  ADD COLUMN gallery_reviewed_at TIMESTAMPTZ,
  ADD COLUMN gallery_reviewed_by VARCHAR(20);

UPDATE article_image i SET gallery_status = 'private'
WHERE EXISTS (
  SELECT 1 FROM app_users u
  WHERE u.public_intro_image_ids @> jsonb_build_array(i.id)
);

CREATE INDEX idx_article_image_gallery_pending ON article_image (gallery_requested_at, id)
  WHERE gallery_status = 'pending';
