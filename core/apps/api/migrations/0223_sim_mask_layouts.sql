CREATE TABLE sim_mask_layouts (
  cube_size INTEGER PRIMARY KEY CHECK (cube_size BETWEEN 2 AND 9),
  groups JSONB NOT NULL CHECK (jsonb_typeof(groups) = 'array')
);
