import * as THREE from 'three';
import { SIZE } from './engine/define';
import MegaminxCube from './engine/mega/MegaminxCube';
import PyraCube from './engine/pyra/PyraCube';
import SkewbCube from './engine/skewb/SkewbCube';
import Sq1Cube from './engine/sq1/Sq1Cube';

export type HeadlessPuzzleKind = 'sq1' | 'megaminx' | 'pyraminx' | 'skewb';
export type HeadlessPuzzleCube = Sq1Cube | MegaminxCube | PyraCube | SkewbCube;

export interface RenderWorld {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
}

function buildCube(kind: HeadlessPuzzleKind): HeadlessPuzzleCube {
  switch (kind) {
    case 'sq1': return new Sq1Cube();
    case 'megaminx': return new MegaminxCube();
    case 'pyraminx': return new PyraCube();
    case 'skewb': return new SkewbCube();
  }
}

/** Minimal scene/camera host for server SVG rendering; deliberately has no renderer. */
export class HeadlessWorld implements RenderWorld {
  width = 1;
  height = 1;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 1, SIZE * 32);
  readonly cube: HeadlessPuzzleCube;

  constructor(readonly puzzleKind: HeadlessPuzzleKind) {
    this.scene.matrixAutoUpdate = false;
    this.cube = buildCube(puzzleKind);
    this.scene.add(this.cube);
    this.resize();
  }

  resize(): void {
    const width = Math.max(1, this.width);
    const height = Math.max(1, this.height);
    const perspective = 5;
    const min = height / Math.min(width, height) / perspective;
    this.camera.aspect = width / height;
    this.camera.fov = (2 * Math.atan(min) * 180) / Math.PI;
    const refHalf = this.puzzleKind === 'sq1' ? SIZE * 4.6 : SIZE * 4;
    const distance = refHalf * perspective;
    this.camera.position.set(0, 0, distance);
    this.camera.near = Math.max(distance - SIZE * 5, SIZE * 0.4);
    this.camera.far = distance + SIZE * 8;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }
}
