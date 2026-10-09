import * as THREE from 'three';
import { CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '../../support/cube-colors';
import { roundedSolid } from '../polytopeCut';
import { extrudeOntoFace, makeSticker, roundCorners } from '../stickerGeom';
import { GHOST_CELLS, GHOST_SCALE, type GhostCell } from './ghostModel';

export interface GhostPiece { pivot: THREE.Object3D; cell: GhostCell }

/** Shell faces in ghostModel order: -X, +X, -Y, +Y, -Z, +Z in the solved display. */
export const GHOST_FACE_LABELS = ['L', 'R', 'D', 'U', 'B', 'F'] as const;
export const GHOST_DEFAULT_FACE_COLORS: Record<CubeFace, string> = {
  U: CUBE_FILL.U, D: CUBE_FILL.U, L: CUBE_FILL.U,
  R: CUBE_FILL.U, F: CUBE_FILL.U, B: CUBE_FILL.U,
};

export function buildGhostPieces(): GhostPiece[] {
  const bodyMat = new THREE.MeshPhongMaterial({ color: CUBE_ON_FILL.U, shininess: 24 });
  const stickerMats = GHOST_FACE_LABELS.map(face => new THREE.MeshPhongMaterial({
    color: GHOST_DEFAULT_FACE_COLORS[face], shininess: 65,
  }));
  return GHOST_CELLS.map((cell, index) => {
    const pivot = new THREE.Object3D();
    pivot.userData.ghostPiece = index;
    // A small mechanical clearance is wholly inside the proven ideal cell.
    const body = new THREE.Mesh(roundedSolid(cell.planes.map((p, i) => ({
      n: p.n, d: p.d - (i >= 6 ? 0.08 * GHOST_SCALE : 0),
    })), 0.18 * GHOST_SCALE), bodyMat);
    body.userData.simRole = cell.facets.length ? 'body' : 'core';
    pivot.add(body);
    for (const facet of cell.facets) {
      if (!facet.sticker.length) continue;
      const shortestEdge = Math.min(...facet.sticker.map((p, i, points) => {
        const q = points[(i + 1) % points.length];
        return Math.hypot(q[0] - p[0], q[1] - p[1]);
      }));
      // Bound the rounding by the tiny original triangular sticker's own edge lengths.
      const outline = roundCorners(facet.sticker, Math.min(0.12 * GHOST_SCALE, shortestEdge / 6));
      const geometry = extrudeOntoFace(outline, {
        ...facet, origin: facet.origin.clone().addScaledVector(facet.normal, 0.015 * GHOST_SCALE), n: facet.normal,
      }, 0.1 * GHOST_SCALE);
      const schematicPoly = facet.raw.flatMap(([a, b]) => facet.origin.clone()
        .addScaledVector(facet.u, a).addScaledVector(facet.v, b).toArray());
      pivot.add(makeSticker(geometry, stickerMats[facet.face], bodyMat, {
        simStickerNormal: facet.normal.clone(), schematicPoly, ghostFace: facet.face,
      }));
    }
    return { pivot, cell };
  });
}
