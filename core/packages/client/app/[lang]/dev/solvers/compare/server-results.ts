export type ServerVersion = 'wasm' | 'native';
export type ServerPass = {
  solveSeconds: number;
  startupSeconds: number;
  verifiedSolutions: 100;
  optimalLengthsMatched: 100;
  rawSha256: string;
};
export type ServerComparison = {
  measuredAt: string;
  environment: { os: 'Linux'; vcpus: 4; cpu: string };
  cases: 100;
  threads: 4;
  corpusSha256: string;
  table: { name: string; sha256: string };
  versions: Record<ServerVersion, { sourceId: string; artifactSha256: string }>;
  passes: 1;
  warmupCases: 0;
  order: readonly ['wasm', 'native'] | readonly ['native', 'wasm'];
  wasm: ServerPass;
  native: ServerPass;
  timingDefinition: { solve: string; startup: string };
};

// Publish only the complete, independently verified server comparison.
export const SERVER_RESULTS: ServerComparison = {
  measuredAt: '2026-10-22T00:24:50.764Z',
  environment: { os: 'Linux', vcpus: 4, cpu: 'Intel(R) Xeon(R) Platinum' },
  cases: 100,
  threads: 4,
  corpusSha256: '92171d593d13982924ed16723f099bd771a873aaa2c30a0e08f319c86b75dcde',
  table: { name: 'h48prun31h8.dat', sha256: '0c742e0ad31d2c6bb428ae8658fa0fe88ffe2f7ac09072dbc3eaab8fcad850f1' },
  versions: {
    wasm: {
      sourceId: 'cubeopt-opt8-rustb600c699ab91-20261014',
      artifactSha256: 'b600c699ab91c29f0bef5a14b7c2871bf1fb03d840b8813d5656266132433bb6',
    },
    native: {
      sourceId: 'cubeopt-opt8-native-39681945513-1-9890b860f7d5aec6c24d72c03929a11184ea3422',
      artifactSha256: '0f6f481c5f98130d5295aaf2b073f2b642a5b8c4e271dfb60c19f42c6c9a50c0',
    },
  },
  passes: 1,
  warmupCases: 0,
  order: ['wasm', 'native'],
  wasm: {
    solveSeconds: 128.27944568900006,
    startupSeconds: 106.013499621,
    verifiedSolutions: 100,
    optimalLengthsMatched: 100,
    rawSha256: 'bc1c893f0de19a133932c78d20080e4ce50565505418bed162cb341b92b89683',
  },
  native: {
    solveSeconds: 87.9764358779999,
    startupSeconds: 48.36550826599999,
    verifiedSolutions: 100,
    optimalLengthsMatched: 100,
    rawSha256: '6fa2e7e19c9342369c956429578ed136205c4756b5e977157bc8f9abeec150c6',
  },
  timingDefinition: {
    solve: 'Sum of 100 sequential engine stdin-to-stdout request times, including Node/IPC/search overhead where applicable. Excludes initialization, HTTP/network and API queue time. One pass per version without warmup; this does not measure repeatability.',
    startup: 'Benchmark entry spawn-to-READY: historical WASM through its Node daemon, native through the direct ELF. Not comparable complete production API cold-start times; excluded from solveSeconds.',
  },
};

export function summarizeServerResults(result: ServerComparison) {
  const rows = (['wasm', 'native'] as const).map(id => {
    const seconds = result[id].solveSeconds;
    return { id, seconds, solvesPerSecond: result.cases / seconds };
  });
  return {
    rows,
    timeReductionPercent: (1 - rows[1].seconds / rows[0].seconds) * 100,
  };
}
