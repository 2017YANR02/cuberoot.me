/** Minimal TwistyPlayer-shaped adapter consumed by syncPlayerToMoveCount(). */
export function createStepSeekPlayer(moveCount: number, onStep: (step: number) => void) {
  let timestamp = 0;
  return {
    get timestamp() { return timestamp; },
    set timestamp(value: number) {
      timestamp = Number.isFinite(value) ? value : 0;
      onStep(Math.min(moveCount, Math.max(0, Math.round(timestamp))));
    },
    experimentalModel: {
      indexer: {
        get: async () => ({
          numAnimatedLeaves: () => moveCount,
          algDuration: () => moveCount,
          indexToMoveStartTimestamp: (index: number) => index,
        }),
      },
    },
  };
}
