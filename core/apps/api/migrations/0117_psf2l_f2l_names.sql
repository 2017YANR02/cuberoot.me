-- Rename the 33 PSF2L cases after their corresponding F2L cases.
-- Matching rule: remove the outer D / D' moves from each primary PSF2L algorithm.

WITH names(position, name) AS (VALUES
  (0, 'A+'),
  (1, 'A-'),
  (2, 'B+'),
  (3, 'B-'),
  (4, 'R+'),
  (5, 'R-'),
  (6, 'K+'),
  (7, 'K-'),
  (8, 'X+'),
  (9, 'X-'),
  (10, 'W+'),
  (11, 'W-'),
  (12, 'M+'),
  (13, 'M-'),
  (14, 'Q+'),
  (15, 'Q-'),
  (16, 'P+'),
  (17, 'P-'),
  (18, 'I+'),
  (19, 'I-'),
  (20, 'H+'),
  (21, 'H-'),
  (22, 'G+'),
  (23, 'G-'),
  (24, 'J+'),
  (25, 'J-'),
  (26, 'L+'),
  (27, 'L-'),
  (28, 'T'),
  (29, 'V+'),
  (30, 'V-'),
  (31, 'C+'),
  (32, 'C-')
)
UPDATE alg_cases AS c
SET name = names.name
FROM names
WHERE c.puzzle = '3x3' AND c.set_slug = 'psf2l' AND c.position = names.position;

DO $psf2l_f2l_names$
DECLARE got_names TEXT[];
BEGIN
  SELECT array_agg(name ORDER BY position) INTO got_names FROM alg_cases WHERE puzzle = '3x3' AND set_slug = 'psf2l';
  IF got_names IS DISTINCT FROM ARRAY['A+', 'A-', 'B+', 'B-', 'R+', 'R-', 'K+', 'K-', 'X+', 'X-', 'W+', 'W-', 'M+', 'M-', 'Q+', 'Q-', 'P+', 'P-', 'I+', 'I-', 'H+', 'H-', 'G+', 'G-', 'J+', 'J-', 'L+', 'L-', 'T', 'V+', 'V-', 'C+', 'C-']::TEXT[] THEN
    RAISE EXCEPTION '3x3/psf2l: F2L case names or positions do not match: %', got_names;
  END IF;
END
$psf2l_f2l_names$;
