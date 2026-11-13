interface Target { csv: string; stages: number; outDir: string }
export const COMP_STEP_TARGETS: Target[] = [
  { csv: 'std.csv', stages: 5, outDir: 'comp_steps' },
  { csv: 'daisy.csv', stages: 1, outDir: 'comp_steps_daisy' },
  { csv: 'first_layer.csv', stages: 2, outDir: 'comp_steps_first_layer' },
  { csv: 'eo.csv', stages: 5, outDir: 'comp_steps_eo' },
  { csv: 'pseudo.csv', stages: 4, outDir: 'comp_steps_pseudo' },
  { csv: 'pseudo_pair.csv', stages: 4, outDir: 'comp_steps_pseudo_pair' },
  { csv: 'pair.csv', stages: 4, outDir: 'comp_steps_pair' },
  { csv: 'f2leo.csv', stages: 4, outDir: 'comp_steps_f2leo' },
  { csv: 'pseudo_f2leo.csv', stages: 4, outDir: 'comp_steps_pseudo_f2leo' },
  // 块类(UI key 123/222/223;123 的 CSV 管道名是 roux)
  { csv: 'roux.csv', stages: 2, outDir: 'comp_steps_123' },
  { csv: '222.csv', stages: 1, outDir: 'comp_steps_222' },
  { csv: '223.csv', stages: 1, outDir: 'comp_steps_223' },
  // 双 1x2x3(UI key 123x2;CSV 管道名 f2b)+ EOLine 系 + DR
  { csv: 'f2b.csv', stages: 1, outDir: 'comp_steps_123x2' },
  { csv: 'eoline.csv', stages: 2, outDir: 'comp_steps_eoline' },
  { csv: 'dr.csv', stages: 1, outDir: 'comp_steps_dr' },
];
