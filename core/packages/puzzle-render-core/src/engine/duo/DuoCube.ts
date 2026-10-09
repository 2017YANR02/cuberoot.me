import * as THREE from 'three';
import {
  applyDuoMove, duoMoveToString, DUO_VERTEX_AXES, isDuoSolved, solvedDuo,
  type DuoMove, type DuoState,
} from '@cuberoot/puzzle-solvers/pyraminx-duo';
import CornerTurnCube from '../CornerTurnCube';
import { APEX_UP_QUAT } from '../pyra/pyraGeometry';
import { buildDuoCore, buildDuoPiece, type DuoPiece } from './duoGeometry';
import DuoTwister from './DuoTwister';

/** Four fixed-position corners and four travelling centres, one origin pivot per
 * piece. Discrete colours determine completion: a plain triangular centre may
 * return with a 120° logo rotation, which is not part of the standard puzzle. */
export default class DuoCube extends CornerTurnCube<DuoMove> {
  readonly puzzleType = 'pyraminx_duo' as const;
  readonly corners: DuoPiece[] = [];
  readonly centres: DuoPiece[] = [];
  state: DuoState = solvedDuo();
  twister: DuoTwister;
  private carved = false;

  constructor() {
    super(DUO_VERTEX_AXES);
    this.quaternion.copy(APEX_UP_QUAT);
    this.add(buildDuoCore());
    for (let i = 0; i < 4; i++) {
      const corner = buildDuoPiece('corner', i);
      const centre = buildDuoPiece('centre', i);
      this.corners.push(corner);
      this.centres.push(centre);
      this.add(corner.pivot, centre.pivot);
    }
    this.twister = new DuoTwister(this);
  }

  protected pivotsForMove(move: DuoMove): THREE.Object3D[] {
    return [
      this.corners[move.corner].pivot,
      ...this.state.centers.flatMap((piece, face) => face === move.corner ? [] : [this.centres[piece].pivot]),
    ];
  }

  protected advanceState(move: DuoMove): void {
    this.state = applyDuoMove(this.state, move);
    this.setCarve(this.carved);
  }

  protected moveToString(move: DuoMove): string { return duoMoveToString(move); }

  reset(): void {
    this.twister?.finish();
    this.state = solvedDuo();
    for (const piece of [...this.corners, ...this.centres]) piece.pivot.quaternion.identity();
    this.setCarve(this.carved);
    this.dirty = true;
    for (const callback of this.callbacks) callback();
  }

  setCarve(on: boolean): void {
    this.carved = on;
    for (let i = 0; i < 4; i++) {
      this.corners[i].pivot.visible = !on || i !== 0;
      this.centres[i].pivot.visible = !on || this.state.centers[0] === i;
    }
    this.dirty = true;
  }

  get complete(): boolean { return isDuoSolved(this.state); }

  dispose(): void {
    this.twister.finish();
    super.dispose();
    this.corners.length = 0;
    this.centres.length = 0;
  }
}
