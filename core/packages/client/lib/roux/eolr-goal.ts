const AUF = ['', 'U', "U'", 'U2'] as const;

/** Canonical EOLR targets shared by the Roux pruner and alg validator. */
export const EOLR_GOAL_ALGS_AC = ["U'", 'U'].flatMap(u => (
  AUF.map(auf => [u, 'M2', auf].filter(Boolean).join(' '))
));

export const EOLR_GOAL_ALGS_MC = ['U', "U'"].flatMap(u => (
  AUF.map(auf => ["M'", u, 'M2', auf].filter(Boolean).join(' '))
));

export const EOLR_GOAL_ALGS = ['', ...EOLR_GOAL_ALGS_AC, ...EOLR_GOAL_ALGS_MC];
