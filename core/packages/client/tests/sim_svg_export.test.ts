/**
 * sim_svg_export 单测 — 用合成 three 场景验证投影几何 / 剔除 / 光照 / 实例化 /
 * 原核分色 / painter 排序的纯数学部分(不碰 DOM;贴图路径由 Playwright 实测覆盖)。
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { exportSimSvg } from '@/app/[lang]/sim/sim_svg_export';

const W = 200;
const H = 200;

function makeWorld(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; width: number; height: number } {
  const scene = new THREE.Scene();
  // fov 90° / z=100 → z=0 平面上可视半宽恰 100(便于手算屏幕坐标)
  const camera = new THREE.PerspectiveCamera(90, 1, 1, 10000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return { scene, camera, width: W, height: H };
}

function pathNumbers(svg: string): number[] {
  const d = [...svg.matchAll(/d="([^"]+)"/g)].map((m) => m[1]).join(' ');
  return [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

describe('exportSimSvg', () => {
  it('正对相机的平面渲染,大面片细分但同色合并为一条 path,屏幕坐标正确', () => {
    const world = makeWorld();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }),
    );
    world.scene.add(mesh);
    const svg = exportSimSvg({ world });
    expect(svg).toContain('#ff0000');
    // 100×100px 超细分阈值 → 多个 M 子路径;同色 → 仍只有一条 <path>
    expect((svg.match(/M/g) ?? []).length).toBeGreaterThan(2);
    expect((svg.match(/<path/g) ?? []).length).toBe(1);
    // world ±50 @ fov90/z100 → NDC ±0.5 → px 50..150
    const nums = pathNumbers(svg);
    expect(Math.min(...nums)).toBeCloseTo(50, 0);
    expect(Math.max(...nums)).toBeCloseTo(150, 0);
  });

  it('FrontSide 背对相机剔除;DoubleSide 保留', () => {
    const world = makeWorld();
    const geo = new THREE.PlaneGeometry(100, 100);
    const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 1, 0) }));
    front.rotation.y = Math.PI; // 背对相机
    world.scene.add(front);
    expect(exportSimSvg({ world })).not.toContain('<path');

    (front.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
    expect(exportSimSvg({ world })).toContain('#00ff00');
  });

  it('painter 排序: 近的画在后面(输出顺序 = 远→近)', () => {
    const world = makeWorld();
    const far = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }));
    const nearP = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 1) }));
    nearP.position.z = 50;
    world.scene.add(far, nearP);
    const svg = exportSimSvg({ world });
    expect(svg.indexOf('#ff0000')).toBeGreaterThan(-1);
    expect(svg.indexOf('#0000ff')).toBeGreaterThan(svg.indexOf('#ff0000'));
  });

  it('Lambert 光照: ambient intensity π = 全亮,π/2 = 线性 0.5', () => {
    const world = makeWorld();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshLambertMaterial({ color: new THREE.Color(1, 1, 1) }));
    world.scene.add(mesh);
    const amb = new THREE.AmbientLight(0xffffff, Math.PI);
    world.scene.add(amb);
    expect(exportSimSvg({ world })).toContain('#ffffff');

    amb.intensity = Math.PI / 2;
    const expected = `#${new THREE.Color(0.5, 0.5, 0.5).getHexString()}`;
    expect(exportSimSvg({ world })).toContain(expected);
  });

  it('directional 光照按 N·L, 且 layers 不相交的灯不参与', () => {
    const world = makeWorld();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshLambertMaterial({ color: new THREE.Color(1, 1, 1) }));
    world.scene.add(mesh);
    const dir = new THREE.DirectionalLight(0xffffff, Math.PI); // N·L=1 → 因子 1
    dir.position.set(0, 0, 10);
    world.scene.add(dir);
    expect(exportSimSvg({ world })).toContain('#ffffff');

    dir.layers.set(1); // mesh 在 layer 0 → 灯不照 → 全黑
    expect(exportSimSvg({ world })).toContain('#000000');
  });

  it('InstancedMesh: 零缩放实例跳过,instanceColor 调色', () => {
    const world = makeWorld();
    const inst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1) }),
      2,
    );
    inst.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-30, 0, 0));
    inst.setMatrixAt(1, new THREE.Matrix4().makeScale(0, 0, 0)); // 隐藏实例
    inst.setColorAt(0, new THREE.Color(1, 0, 0));
    inst.setColorAt(1, new THREE.Color(0, 1, 0));
    world.scene.add(inst);
    const svg = exportSimSvg({ world });
    expect(svg).toContain('#ff0000');
    expect(svg).not.toContain('#00ff00'); // 零缩放实例一个面片都不该出
    expect((svg.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('原核 aRaw 属性: argmax 分割平面切色,两色都出现', () => {
    const world = makeWorld();
    const geo = new THREE.PlaneGeometry(40, 40);
    // slot0 N=(1,0,0) 红,slot1 N=(0,1,0) 绿 → 对角线 x=y 分割
    geo.setAttribute('aRawN0', new THREE.InstancedBufferAttribute(new Float32Array([1, 0, 0]), 3));
    geo.setAttribute('aRawC0', new THREE.InstancedBufferAttribute(new Float32Array([1, 0, 0]), 3));
    geo.setAttribute('aRawN1', new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 0]), 3));
    geo.setAttribute('aRawC1', new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 0]), 3));
    geo.setAttribute('aRawN2', new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 0]), 3));
    geo.setAttribute('aRawC2', new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 0]), 3));
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), 1);
    inst.setMatrixAt(0, new THREE.Matrix4());
    world.scene.add(inst);
    const svg = exportSimSvg({ world });
    expect(svg).toContain('#ff0000');
    expect(svg).toContain('#00ff00');
  });

  it('超上限抛 SVG_TOO_COMPLEX', () => {
    const world = makeWorld();
    world.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial()));
    expect(() => exportSimSvg({ world, maxTriangles: 1 })).toThrow(/SVG_TOO_COMPLEX/);
  });

  it('透明材质输出 fill-opacity,不透明面片带同色描边', () => {
    const world = makeWorld();
    const solid = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }));
    const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 1), transparent: true, opacity: 0.5 });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), glassMat);
    glass.position.z = 50;
    world.scene.add(solid, glass);
    const svg = exportSimSvg({ world });
    expect(svg).toMatch(/fill="#ff0000" stroke="#ff0000"/);
    expect(svg).toMatch(/fill="#0000ff" fill-opacity="0.5"/);
  });

  it('背景参数输出底色矩形;默认透明无矩形', () => {
    const world = makeWorld();
    expect(exportSimSvg({ world })).not.toContain('<rect');
    expect(exportSimSvg({ world, background: '#123456' })).toContain('<rect width="100%" height="100%" fill="#123456"/>');
  });
});
