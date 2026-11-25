ALTER TABLE platform_competitions
  ADD COLUMN competition_format TEXT CHECK (competition_format IN ('average', 'advancement')),
  ADD COLUMN competition_device TEXT CHECK (competition_device IN ('ordinary', 'smart')),
  ADD COLUMN participant_limit INTEGER CHECK (participant_limit BETWEEN 1 AND 1000000),
  ADD CONSTRAINT platform_competition_draft_setup CHECK (
    num_nonnulls(competition_format, competition_device, participant_limit) IN (0, 3)
    AND (competition_format <> 'advancement' OR participant_limit >= 2)
  );
