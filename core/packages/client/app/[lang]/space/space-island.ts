import * as THREE from 'three';

// Metres. The same coastal profile drives terrain, shallow water and surf.
export const ISLAND = { x: -6, z: 3, rx: 79, rz: 65, sea: -5.5 } as const;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
export function islandHeight(x: number, z: number) {
  const px = (x - ISLAND.x) / ISLAND.rx, pz = (z - ISLAND.z) / ISLAND.rz;
  const angle = Math.atan2(pz, px);
  const r = Math.hypot(px, pz) / (1 + .055 * Math.sin(angle * 3) + .035 * Math.cos(angle * 7));
  return -.65 - 4.05 * smooth(.64, .9, r) - 1.8 * smooth(.9, 1.02, r) - 20 * smooth(1.02, 1.5, r);
}
export const ISLAND_GLSL = `
float islandHeight(vec2 p) {
  vec2 q = (p - vec2(${ISLAND.x.toFixed(1)}, ${ISLAND.z.toFixed(1)})) / vec2(${ISLAND.rx.toFixed(1)}, ${ISLAND.rz.toFixed(1)});
  float angle = atan(q.y, q.x);
  float r = length(q) / (1. + .055 * sin(angle * 3.) + .035 * cos(angle * 7.));
  return -.65 - 4.05 * smoothstep(.64, .9, r) - 1.8 * smoothstep(.9, 1.02, r) - 20. * smoothstep(1.02, 1.5, r);
}`;

// One inward-moving breaker field for geometry, normals and residual foam.
export const SHORE_GLSL = /* glsl */ `
float shorePhase(vec2 p, float depth) {
  return depth * 1.75 + uTime * 1.25 + sin(p.x * .11 + p.y * .08) * 1.1
       + sin(p.x * .23 - p.y * .17) * .45;
}
float shoreBreakup(vec2 p) {
  return .45 + .55 * smoothstep(-.6, .65, sin(p.x * .19 + sin(p.y * .13) * 2.) * cos(p.y * .21));
}
float shoreHeight(vec2 p) {
  float depth = uSeaLevel - islandHeight(p);
  float phase = shorePhase(p, depth);
  float envelope = smoothstep(0., 1., depth) * (1. - smoothstep(1.5, 8., depth));
  return (sin(phase) * .82 - cos(phase * 2.) * .18) * envelope * min(1.25, .16 + uWindSpeed * .035) * shoreBreakup(p);
}
`;

export function createIsland() {
  const root = new THREE.Group(); root.name = 'island'; root.userData.spaceBackdrop = true;
  const geometry = new THREE.PlaneGeometry(270, 240, 200, 180); geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, islandHeight(p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ roughness: .88 });
  applyIslandMaterial(material);
  const terrain = new THREE.Mesh(geometry, material); terrain.receiveShadow = true; root.add(terrain);
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0x746f60, roughness: .82 }), 54);
  const transform = new THREE.Object3D();
  for (let i = 0; i < rocks.count; i++) {
    const cluster = Math.floor(i / 9), angle = cluster * 1.39 + Math.sin(i * 2.39) * .105, radius = .86 + (i % 7) * .021;
    const x = ISLAND.x + Math.cos(angle) * ISLAND.rx * radius, z = ISLAND.z + Math.sin(angle) * ISLAND.rz * radius;
    transform.position.set(x, islandHeight(x,z) + .15, z);
    transform.rotation.set(i*.73,i*1.19,i*.31);
    transform.scale.set(1.2+i%3*.55,.5+i%5*.27,.9+i%4*.42); transform.updateMatrix(); rocks.setMatrixAt(i, transform.matrix);
  }
  rocks.castShadow = rocks.receiveShadow = true; root.add(rocks);
  return root;
}

export function applyIslandMaterial(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vCoast;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoast = (modelMatrix * vec4(position,1.)).xyz;');
    shader.fragmentShader = 'varying vec3 vCoast;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain = fract(sin(dot(floor(vCoast.xz * 24.),vec2(127.1,311.7))) * 43758.5453);
      float patches = sin(vCoast.x*.31 + sin(vCoast.z*.18)*2.) * cos(vCoast.z*.27);
      float grass = smoothstep(-3.7,-1.1,vCoast.y + patches*.35);
      vec3 sand = mix(vec3(.30,.23,.13),vec3(.67,.56,.37),smoothstep(-5.65,-4.3,vCoast.y));
      diffuseColor.rgb *= mix(sand,vec3(.15,.20,.075)*(1.+patches*.20),grass) * (.94+grain*.12);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(.34,.9,smoothstep(-5.8,-4.4,vCoast.y));');
  };
  material.customProgramCacheKey = () => 'space-island-terrain';
}
