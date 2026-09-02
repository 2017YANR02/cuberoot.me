-- Add the versioned landing-page fields used by printed QR codes.

CREATE OR REPLACE FUNCTION platform_qr_links_valid(value JSONB) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT CASE WHEN JSONB_TYPEOF(value) <> 'array' THEN FALSE ELSE
    JSONB_ARRAY_LENGTH(value) <= 20
      AND OCTET_LENGTH(value::TEXT) <= 100000
      AND NOT EXISTS (
        SELECT 1
        FROM JSONB_ARRAY_ELEMENTS(value) AS link
        WHERE CASE WHEN JSONB_TYPEOF(link) <> 'object' THEN TRUE ELSE
          (link - ARRAY['label', 'href', 'note']) <> '{}'::JSONB
            OR JSONB_TYPEOF(link->'label') IS DISTINCT FROM 'string'
            OR CHAR_LENGTH(link->>'label') NOT BETWEEN 1 AND 160
            OR link->>'label' <> BTRIM(link->>'label')
            OR link->>'label' ~ '[[:cntrl:]]'
            OR JSONB_TYPEOF(link->'href') IS DISTINCT FROM 'string'
            OR CHAR_LENGTH(link->>'href') NOT BETWEEN 1 AND 4000
            OR NOT (
              (link->>'href' ~ '^/[A-Za-z0-9/_?&=.#%+~-]*$' AND LEFT(link->>'href', 2) <> '//')
              OR link->>'href' ~ '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$'
            )
            OR (
              link ? 'note'
              AND (
                JSONB_TYPEOF(link->'note') IS DISTINCT FROM 'string'
                OR CHAR_LENGTH(link->>'note') > 240
                OR link->>'note' <> BTRIM(link->>'note')
                OR link->>'note' ~ '[[:cntrl:]]'
              )
            )
        END
      )
  END
$$;

ALTER TABLE platform_qr_codes
  ADD COLUMN label VARCHAR(160) NOT NULL DEFAULT ''
    CHECK (label = BTRIM(label) AND CHAR_LENGTH(label) <= 160 AND label !~ '[[:cntrl:]]');

ALTER TABLE platform_qr_revisions
  ADD COLUMN qr_type VARCHAR(20) NOT NULL DEFAULT 'redirect'
    CHECK (qr_type IN ('redirect', 'landing')),
  ADD COLUMN links JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (platform_qr_links_valid(links));

-- Content QR codes could never be redirected; preserve that behavior while
-- making type independent for all subsequent revisions.
ALTER TABLE platform_qr_revisions DISABLE TRIGGER platform_qr_revisions_append_only;
UPDATE platform_qr_revisions SET qr_type = 'landing' WHERE target_kind = 'content';
ALTER TABLE platform_qr_revisions ENABLE TRIGGER platform_qr_revisions_append_only;
