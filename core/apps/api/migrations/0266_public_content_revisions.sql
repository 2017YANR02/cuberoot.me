-- Shared committed versions keep browser revalidation and all API workers coherent.
CREATE TABLE public_content_revisions (
  domain text PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 1
);

INSERT INTO public_content_revisions (domain) VALUES
  ('alg'),
  ('nav'),
  ('support'),
  ('ops'),
  ('notices'),
  ('recon'),
  ('gallery'),
  ('sim'),
  ('article');

CREATE FUNCTION bump_public_content_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public_content_revisions SET revision = revision + 1 WHERE domain = TG_ARGV[0];
  RETURN NULL;
END;
$$;

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON alg_sets
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('alg');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON alg_cases
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('alg');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON alg_catalog_positions
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('alg');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON nav_sites
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('nav');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON nav_topics
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('nav');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON home_card_positions
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('nav');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON sponsors
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('support');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON contributors
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('support');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ops_commands
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('ops');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON page_notices
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('notices');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON recons
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('recon');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON edits
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('recon');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON creator_gallery_captions
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('gallery');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON sim_masks
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('sim');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON sim_mask_layouts
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('sim');

CREATE TRIGGER public_content_revision
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON article
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('article');


-- Recon list links also depend on public account identity mappings. Avoid
-- invalidating on unrelated session/profile updates to app_users.
CREATE TRIGGER public_content_revision_identity_write
AFTER INSERT OR DELETE OR TRUNCATE ON app_users
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('recon');

CREATE TRIGGER public_content_revision_identity_update
AFTER UPDATE OF wca_id, merged_into_user_id ON app_users
FOR EACH STATEMENT EXECUTE FUNCTION bump_public_content_revision('recon');
