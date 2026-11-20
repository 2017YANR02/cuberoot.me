-- The three GAN rosters are separate teams. The parent is only a filter.
-- The existing membership foreign key prevents deleting any team with members.
DELETE FROM wca_teams WHERE lower(btrim(name)) = 'gan';

ALTER TABLE wca_teams ADD CONSTRAINT wca_teams_no_legacy_gan
  CHECK (lower(btrim(name)) <> 'gan');
