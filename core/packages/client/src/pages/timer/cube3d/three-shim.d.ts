/**
 * Local ambient type shim for `three` and `three/examples/jsm/controls/OrbitControls`.
 *
 * The bundled `three@0.183` ships JS only and we don't have `@types/three`
 * installed, so we declare just the bits Cube3D actually uses. This is
 * intentionally loose — runtime behaviour is what matters.
 */

declare module 'three' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Any = any;

  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    setScalar(s: number): this;
    copy(v: Vector3): this;
    clone(): Vector3;
  }

  export class Euler {
    x: number;
    y: number;
    z: number;
  }

  export class Color {
    constructor(c?: number | string);
    set(c: number | string): this;
  }

  export class Object3D {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    children: Object3D[];
    add(...o: Object3D[]): this;
    remove(...o: Object3D[]): this;
    traverse(cb: (o: Object3D) => void): void;
  }

  export class Scene extends Object3D {
    background: Color | null;
  }

  export class Camera extends Object3D {}

  export class PerspectiveCamera extends Camera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    aspect: number;
    fov: number;
    near: number;
    far: number;
    updateProjectionMatrix(): void;
    lookAt(v: Vector3 | number, y?: number, z?: number): void;
  }

  export class BufferGeometry {
    dispose(): void;
  }

  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }

  export interface MaterialParameters {
    color?: number | string | Color;
    transparent?: boolean;
    opacity?: number;
    side?: number;
  }

  export class Material {
    dispose(): void;
    transparent: boolean;
    opacity: number;
    color: Color;
  }

  export class MeshBasicMaterial extends Material {
    constructor(p?: MaterialParameters);
  }

  export class Mesh<
    G extends BufferGeometry = BufferGeometry,
    M extends Material | Material[] = Material | Material[],
  > extends Object3D {
    geometry: G;
    material: M;
    constructor(geometry?: G, material?: M);
  }

  export class Group extends Object3D {}

  export class Light extends Object3D {
    intensity: number;
  }

  export class AmbientLight extends Light {
    constructor(color?: number | string, intensity?: number);
  }

  export class DirectionalLight extends Light {
    constructor(color?: number | string, intensity?: number);
  }

  export interface WebGLRendererParameters {
    canvas?: HTMLCanvasElement;
    antialias?: boolean;
    alpha?: boolean;
    premultipliedAlpha?: boolean;
    powerPreference?: 'default' | 'high-performance' | 'low-power';
  }

  export class WebGLRenderer {
    constructor(p?: WebGLRendererParameters);
    domElement: HTMLCanvasElement;
    setSize(w: number, h: number, updateStyle?: boolean): void;
    setPixelRatio(r: number): void;
    setClearColor(c: number | string | Color, alpha?: number): void;
    render(scene: Scene, camera: Camera): void;
    dispose(): void;
    forceContextLoss?: () => void;
  }

  export const DoubleSide: number;
  export const FrontSide: number;
  export const BackSide: number;
}

declare module 'three/examples/jsm/controls/OrbitControls' {
  import type { Camera, Vector3 } from 'three';

  export class OrbitControls {
    constructor(camera: Camera, domElement?: HTMLElement);
    target: Vector3;
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    enableZoom: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    minDistance: number;
    maxDistance: number;
    rotateSpeed: number;
    update(): boolean;
    dispose(): void;
    addEventListener(type: string, listener: (e: { type: string }) => void): void;
    removeEventListener(type: string, listener: (e: { type: string }) => void): void;
  }
}
