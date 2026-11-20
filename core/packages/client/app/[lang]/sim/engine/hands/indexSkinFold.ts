import { BufferAttribute, MathUtils, Vector3 } from 'three';

type Hinge = { offsets: number[]; mobility: number[]; limit: number; cosine: number };

/** Bound the bend between neighbouring faces around the index knuckle and PIP. The
 * reference is the actual flexed grip, including its existing skin folds. */
export class IndexSkinFold {
  private readonly proximalHinges: Hinge[] = [];
  private readonly pipHinges: Hinge[] = [];
  private readonly points = Array.from({ length: 4 }, () => new Vector3());
  private readonly gradients = Array.from({ length: 4 }, () => new Vector3());
  private readonly edge = new Vector3();
  private readonly ac = new Vector3();
  private readonly ad = new Vector3();
  private readonly cross = new Vector3();

  constructor(faces: BufferAttribute, welded: number[], proximal: Float32Array, intermediate: Float32Array,
    mobile: ReadonlyMap<number, number>) {
    const opposite = new Map<number, number>();
    for (let i = 0; i < faces.count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const a = welded[faces.getX(i + k)], b = welded[faces.getX(i + (k + 1) % 3)];
        // The proximal patch follows the stroke mask. Distal contact
        // vertices are pinned even when they border a moving triangle.
        if (proximal[a] + proximal[b] < .18) continue;
        const c = welded[faces.getX(i + (k + 2) % 3)];
        const key = Math.min(a, b) * welded.length + Math.max(a, b);
        const d = opposite.get(key);
        if (d === undefined) opposite.set(key, c);
        else {
          const offsets = [a, b, c, d].map(vertex => vertex * 3);
          const mobility = offsets.map(offset => mobile.get(offset) ?? 0);
          if (!mobility.some(w => w > 0)) continue;
          const hinge = { offsets, mobility, limit: Math.PI, cosine: -1 };
          this.proximalHinges.push(hinge);
          if (intermediate[a] + intermediate[b] >= .18) this.pipHinges.push(hinge);
        }
      }
    }
  }

  capture(point: (offset: number) => Vector3): void {
    for (const hinge of this.proximalHinges) {
      for (let i = 0; i < 4; i++) this.points[i].copy(point(hinge.offsets[i]));
      this.faceNormals();
      hinge.limit = Math.min(Math.PI, this.gradients[2].angleTo(this.gradients[3]) + Math.PI / 6);
      hinge.cosine = Math.cos(hinge.limit);
    }
  }

  private faceNormals(): void {
    const [a, b, c, d] = this.points;
    this.edge.subVectors(b, a);
    this.ac.subVectors(c, a);
    this.ad.subVectors(d, a);
    this.gradients[2].crossVectors(this.edge, this.ac);
    this.gradients[3].crossVectors(this.ad, this.edge);
  }

  apply(positions: Float32Array, weight: number, region: 'pip' | 'proximal'): void {
    const hinges = region === 'proximal' ? this.proximalHinges : this.pipHinges;
    for (let pass = 0; pass < 16; pass++) {
      let corrected = false;
      for (const hinge of hinges) {
        for (let i = 0; i < 4; i++) this.points[i].fromArray(positions, hinge.offsets[i]);
        this.faceNormals();
        const [qa, qb, qc, qd] = this.gradients;
        const areaC = qc.lengthSq(), areaD = qd.lengthSq(), lengthSq = this.edge.lengthSq();
        if (!areaC || !areaD || !lengthSq) continue;
        const cosine = qc.dot(qd) / Math.sqrt(areaC * areaD);
        if (cosine >= hinge.cosine) continue;
        // Gradients of the signed dihedral angle. Distribute the correction
        // over both faces, weighted by each vertex's available mobility.
        const sign = Math.sign(this.edge.dot(this.cross.crossVectors(qd, qc))) || 1;
        const length = Math.sqrt(lengthSq);
        qc.multiplyScalar(length / areaC);
        qd.multiplyScalar(length / areaD);
        const tc = this.ac.dot(this.edge) / lengthSq, td = this.ad.dot(this.edge) / lengthSq;
        qa.copy(qc).multiplyScalar(tc - 1).addScaledVector(qd, td - 1);
        qb.copy(qc).multiplyScalar(-tc).addScaledVector(qd, -td);
        let denominator = 0;
        for (let i = 0; i < 4; i++) denominator += hinge.mobility[i] * this.gradients[i].lengthSq();
        if (!denominator) continue;
        const excess = Math.acos(MathUtils.clamp(cosine, -1, 1)) - hinge.limit;
        const step = -sign * Math.min(.35, excess) * weight / denominator;
        for (let i = 0; i < 4; i++) {
          if (hinge.mobility[i]) this.points[i].addScaledVector(this.gradients[i], step * hinge.mobility[i])
            .toArray(positions, hinge.offsets[i]);
        }
        corrected = true;
      }
      if (!corrected) break;
    }
  }
}
