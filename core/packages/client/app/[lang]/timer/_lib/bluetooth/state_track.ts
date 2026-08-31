/** Web adapter around the shared smart-cube state tracker. */

import { SmartCubeStateTracker } from '@cuberoot/shared/smart-cube/cubie';
import { fromFaceletString, type CubeFaces } from '../cube/state';

export class CubeStateTracker extends SmartCubeStateTracker {
  /** Website-only face-array view used by stage detection and rendering. */
  getFaces(): CubeFaces {
    const faces = fromFaceletString(this.getFacelets());
    if (!faces) throw new Error('shared smart-cube tracker produced invalid facelets');
    return faces;
  }
}
