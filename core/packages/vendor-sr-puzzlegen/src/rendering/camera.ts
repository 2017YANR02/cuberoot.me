import { Matrix4 } from "../math/matrix";

/** sr's native camera distance (upstream hardcoded translate z=−5, scale 4). */
export const NATIVE_CAMERA_DIST = 5;
const NATIVE_SCALE = 4;

export class Camera {
  matrix: Matrix4;

  /**
   * @param distance camera z-distance (透视): smaller = stronger perspective,
   *   larger = flatter. The xy scale tracks distance so the on-screen size stays
   *   constant — only the foreshortening changes. Default = sr's native camera
   *   (identical matrix to upstream). Fork change: upstream had no parameter;
   *   the app drove this via a runtime matrix-rebuild patch (setSrPerspective).
   */
  constructor(distance: number = NATIVE_CAMERA_DIST) {
    this.matrix = Matrix4.perspective(Math.PI / 2, 1, 0.1, 1000);
    this.matrix.translate(0, 0, -distance);
    const s = NATIVE_SCALE * (distance / NATIVE_CAMERA_DIST);
    this.matrix.scale(s, s, 1);
  }
}
