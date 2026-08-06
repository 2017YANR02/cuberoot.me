export type VideoRotation = 0 | 90 | 180 | 270;

/**
 * QuickTime/MP4 tkhd matrices store [a,b,u,c,d,v,x,y,w] in fixed-point form.
 * Only accept the four pure quarter-turn matrices. Missing, malformed, mirrored,
 * scaled unevenly, or skewed matrices fall back to 0 so we never "correct" a
 * transform we do not understand.
 */
export function trackMatrixToRotation(matrix: ArrayLike<number> | null | undefined): VideoRotation {
  if (!matrix || matrix.length < 5) return 0;

  const values = [Number(matrix[0]), Number(matrix[1]), Number(matrix[3]), Number(matrix[4])];
  if (values.some((value) => !Number.isFinite(value))) return 0;

  const scale = Math.max(...values.map(Math.abs));
  if (scale === 0) return 0;

  const normalized = values.map((value) => value / scale);
  const candidates: Array<{ rotation: VideoRotation; values: readonly number[] }> = [
    { rotation: 0, values: [1, 0, 0, 1] },
    { rotation: 90, values: [0, 1, -1, 0] },
    { rotation: 180, values: [-1, 0, 0, -1] },
    { rotation: 270, values: [0, -1, 1, 0] },
  ];

  let best = candidates[0];
  let bestError = Infinity;
  for (const candidate of candidates) {
    const error = normalized.reduce(
      (sum, value, index) => sum + Math.abs(value - candidate.values[index]),
      0,
    );
    if (error < bestError) {
      best = candidate;
      bestError = error;
    }
  }

  return bestError <= 0.02 ? best.rotation : 0;
}

export function orientedDimensions(width: number, height: number, rotation: VideoRotation) {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

/** Draw raw decoder pixels with the container track rotation baked into the result. */
export function drawOrientedFrame(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  rotation: VideoRotation,
): void {
  const output = orientedDimensions(width, height, rotation);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, output.width, output.height);

  if (rotation === 90) context.setTransform(0, 1, -1, 0, output.width, 0);
  else if (rotation === 180) context.setTransform(-1, 0, 0, -1, output.width, output.height);
  else if (rotation === 270) context.setTransform(0, -1, 1, 0, 0, output.height);

  context.drawImage(source, 0, 0, width, height);
  context.setTransform(1, 0, 0, 1, 0, 0);
}
