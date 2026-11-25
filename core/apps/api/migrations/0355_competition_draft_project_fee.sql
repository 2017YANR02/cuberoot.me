ALTER TABLE platform_competitions
  ADD COLUMN competition_project TEXT CHECK (competition_project IN (
    '333', '222', '444', '555', '666', '777', '333bf', '333oh',
    'clock', 'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf'
  )),
  ADD COLUMN registration_fee_minor INTEGER CHECK (registration_fee_minor BETWEEN 0 AND 10000000),
  ADD CONSTRAINT platform_competition_draft_registration CHECK (
    (competition_project IS NULL) = (registration_fee_minor IS NULL)
    AND (competition_project IS NULL OR (
      competition_format IS NOT NULL AND (competition_device <> 'smart' OR competition_project = '333')
    ))
  );
