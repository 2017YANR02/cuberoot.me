import * as THREE from 'three';
import { CityGeometry, shanghaiShape, type MaterialFactory, type ShanghaiPolygon } from './space-shanghai-geometry';
import type { Vec3 } from './space-state';

// 32 x 64 rooms, eight texels per room. A fixed CPU pattern with mipmaps avoids
// fragment-hash precision noise and keeps distant windows stable during flight.
// The caller owns the texture; both city blocks and landmark glazing share it.
export function shanghaiWindowTexture(office: boolean) {
  const width = 256, height = 512, data = new Uint8Array(width * height * 4);
  let seed = office ? 107 : 307;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let row = 0; row < 64; row++) {
    const occupied = !office || random() > .35;
    let brightness = 0;
    for (let column = 0; column < 32; column++) {
      if (!office || column % 2 === 0) brightness = occupied && random() > (office ? .48 : .7) ? Math.round(100 + random() * 155) : 0;
      const blind = random() > .75 ? 3 : 1;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const offset = ((row * 8 + y) * width + column * 8 + x) * 4;
        const light = x >= 1 && x <= 6 && y >= blind && y <= 6 ? brightness : 0;
        data.set([light, light, light, 255], offset);
      }
    }
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.name = office ? 'Shanghai office windows' : 'Shanghai residential windows';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
  return texture;
}

export function centre(p: ShanghaiPolygon): [number, number] {
  // Bounding centre avoids bias from densely mapped rounded corners.
  return [(Math.min(...p.points.map(p => p[0])) + Math.max(...p.points.map(p => p[0]))) / 2,
    (Math.min(...p.points.map(p => p[1])) + Math.max(...p.points.map(p => p[1]))) / 2];
}
export function scaleRing(p: ShanghaiPolygon, scale: number, at = centre(p)): ShanghaiPolygon {
  return { ...p, points: p.points.map(([x, z]) => [at[0] + (x - at[0]) * scale, at[1] + (z - at[1]) * scale]) };
}
export function edges(p: ShanghaiPolygon, visit: (a: [number, number], b: [number, number], length: number) => void) {
  for (let i = 0; i < p.points.length; i++) {
    const a = p.points[i], b = p.points[(i + 1) % p.points.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > .1) visit(a, b, len);
  }
}

// Author façades in metres along the street, then rotate them onto the OSM frontage.
// Keeping the plan in this same frame also preserves mapped courtyards and setbacks.
export function buildingFrame(origin: [number, number], angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    plan: (p: ShanghaiPolygon): ShanghaiPolygon => {
      const ring = (r: [number, number][]) => r.map(([x, z]): [number, number] => [c * (x - origin[0]) - s * (z - origin[1]), s * (x - origin[0]) + c * (z - origin[1])]);
      return { ...p, points: ring(p.points), holes: p.holes?.map(ring) };
    },
    place: (g: THREE.Group) => { g.position.set(origin[0], 0, origin[1]); g.rotation.y = angle; return g; },
  };
}

export function windowBay(g: CityGeometry, at: Vec3, q: THREE.Quaternion, glass: THREE.Material, trim: THREE.Material) {
  const y = at[1];
  g.add(new THREE.BoxGeometry(1.55, 2.5, .16), glass, at, q);
  g.add(new THREE.BoxGeometry(1.9, .2, .4), trim, [at[0], y - 1.35, at[2]], q);
  g.add(new THREE.BoxGeometry(.065, 2.5, .22), trim, at, q);
  g.add(new THREE.BoxGeometry(1.9, .22, .38), trim, [at[0], y + 1.35, at[2]], q);
  g.add(new THREE.BoxGeometry(1.55, .065, .24), trim, [at[0], y + .35, at[2]], q);
  for (const side of [-1, 1]) {
    const offset = new THREE.Vector3(side * .86, 0, 0).applyQuaternion(q);
    g.add(new THREE.BoxGeometry(.16, 2.6, .3), trim, [at[0] + offset.x, y, at[2] + offset.z], q);
  }
}

export function windowBays(g: CityGeometry, p: ShanghaiPolygon, levels: number[], spacing: number, glass: THREE.Material, trim: THREE.Material, omitFront = false, frontDepths: readonly number[] = [0]) {
  edges(p, (a, b, length) => {
    if (omitFront && frontDepths.some(z => Math.abs(a[1]-z) < .25 && Math.abs(b[1]-z) < .25)) return;
    const count = Math.floor(length / spacing);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(b[1] - a[1], b[0] - a[0]));
    for (let i = 0; i < count; i++) for (const y of levels) {
      const at: Vec3 = [THREE.MathUtils.lerp(a[0], b[0], (i + .5) / count), y, THREE.MathUtils.lerp(a[1], b[1], (i + .5) / count)];
      windowBay(g, at, q, glass, trim);
    }
  });
}

// Metre-scaled stone and distant fixture irradiance. The nearby light pool
// replaces this approximation with shadowed Three.js spotlights.
export function bundStone(material: MaterialFactory, color: number, wash: number, courses = true, bands: number[] = [], lampSpacing = 4.7) {
  const m = material(color, .025, .84, .001);
  m.userData.bundStone = true;
  const compile = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    compile.call(m, shader, renderer);
    shader.uniforms.cityFacadeLight = m.userData.cityFacadeLight ?? { value: new THREE.Vector2(-1, 0) };
    shader.vertexShader = 'attribute float bundBuildingId, bundLightTop; varying float bundId, bundTop; varying vec3 bundPosition, bundNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nbundPosition=position; bundNormal=normal; bundId=bundBuildingId; bundTop=bundLightTop;');
    shader.fragmentShader = `uniform vec2 cityFacadeLight; varying float bundId, bundTop; varying vec3 bundPosition, bundNormal;
      float bundHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float bundNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(bundHash(i),bundHash(i+vec2(1,0)),f.x),mix(bundHash(i+vec2(0,1)),bundHash(i+vec2(1)),f.x),f.y);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 stoneUV=abs(bundNormal.x)>.65 ? bundPosition.zy : bundPosition.xy;
      if(abs(bundNormal.y)>.65) stoneUV=bundPosition.xz;
      float course=stoneUV.y/.68;
      vec2 blockUV=vec2(stoneUV.x/1.55+mod(floor(course),2.)*.5,course);
      vec2 seam= min(fract(blockUV),1.-fract(blockUV));
      vec2 footprint=max(fwidth(blockUV),vec2(.0001));
      float resolved=1.-smoothstep(.18,.6,max(footprint.x,footprint.y));
      float mortar=(1.-smoothstep(.009,.009+footprint.x,seam.x))+(1.-smoothstep(.012,.012+footprint.y,seam.y));
      float blockTint=mix(1.,.95+.08*bundHash(floor(blockUV)),resolved);
      float grainResolved=1.-smoothstep(.12,.6,max(fwidth(stoneUV.x*18.),fwidth(stoneUV.y*18.)));
      float grain=(bundNoise(stoneUV*18.)-.5)*grainResolved;
      float age=bundNoise(stoneUV*.34);
      diffuseColor.rgb*= ${courses ? 'blockTint*(1.-min(1.,mortar)*.16*resolved)' : '1.'} *(.95+.06*age+grain*.055);
      float bundDistantWash=1.-.92*cityFacadeLight.y*(1.-step(.1,abs(bundId-cityFacadeLight.x)))*(1.-smoothstep(bundTop-2.,bundTop+4.,bundPosition.y));
      // Fade subpixel courses and grain to avoid crawling in drone/zoom views.
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+grain*.14,0.55,1.);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
      float wall=1.-smoothstep(.45,.85,abs(bundNormal.y));
      float height=max(0.,bundPosition.y);
      // Broad overlapping uplights: no repeating vertical reset that paints
      // every storey with a scalloped, self-luminous checkerboard.
      float spread=2.1+height*.035;
      float lampOffset=abs(mod(stoneUV.x+${(lampSpacing / 2).toFixed(3)},${lampSpacing.toFixed(3)})-${(lampSpacing / 2).toFixed(3)});
      float pools=exp(-lampOffset*lampOffset/(spread*spread));
      float wash=(.19+.3*pools)*(.7+.3*exp(-height/35.));
      ${bands.map(y => `wash+=.22*exp(-abs(height-${y.toFixed(3)})/1.8);`).join('\n')}
      // Upward light responds to the actual surface orientation. Undersides,
      // curved columns and side returns no longer emit the same golden colour.
      vec3 fixtureDirection=normalize(vec3(.16,-.64,-.75));
      float relief=max(0.,dot(normalize(bundNormal),fixtureDirection));
      float frontage=mix(.32,1.,1.-smoothstep(.2,2.,bundPosition.z));
      reflectedLight.directDiffuse+=vec3(1.,.69,.38)*diffuseColor.rgb*cityNight*${wash.toFixed(3)}*wash*(.12+.88*relief)*mix(.08,1.,wall)*frontage*bundDistantWash*2.1;
      }
    `);
  };
  m.customProgramCacheKey = () => `${key}-bund-stone-shadowed-${wash}-${courses}-${bands.join(',')}-${lampSpacing}`;
  return m;
}

// Copper roofs remain shaded objects at night. A directional wash and resolved
// standing seams preserve the faces instead of making an evenly luminous cap.
export function roofMetal(material: MaterialFactory, color: number, strength: number, panels: number) {
  const m = material(color, .28, .62, .001), compile = m.onBeforeCompile, key = m.customProgramCacheKey();
  // Optional Blender-authored wash in mesh-local Y-up metres and linear RGB.
  // Keep legacy roofs unchanged when the authored profile is absent.
  const wash = m.userData.spaceRoofWash;
  if (wash !== undefined && (!wash || typeof wash !== 'object'
    || !Number.isFinite(wash.bottom) || !Number.isFinite(wash.top) || wash.top <= wash.bottom
    || !Array.isArray(wash.color) || wash.color.length !== 3
    || !wash.color.every((v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1))) {
    throw new Error('Invalid Blender roof wash profile');
  }
  m.userData.bundRoof = true;
  m.onBeforeCompile = (shader, renderer) => {
    compile.call(m, shader, renderer);
    if (wash) {
      shader.uniforms.roofWashHeight = { value: new THREE.Vector2(wash.bottom, wash.top) };
      shader.uniforms.roofWashColor = { value: new THREE.Color().fromArray(wash.color) };
      shader.vertexShader = 'varying float roofHeight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nroofHeight=position.y;');
      shader.fragmentShader = 'uniform vec2 roofWashHeight; uniform vec3 roofWashColor; varying float roofHeight;\n' + shader.fragmentShader;
    }
    shader.uniforms.cityFacadeLight = m.userData.cityFacadeLight ?? { value: new THREE.Vector2(-1, 0) };
    shader.vertexShader = 'attribute float bundBuildingId; varying float roofId; varying vec3 roofNormal; varying vec2 roofUV;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nroofNormal=normal; roofUV=uv; roofId=bundBuildingId;');
    shader.fragmentShader = 'uniform vec2 cityFacadeLight; varying float roofId; varying vec3 roofNormal; varying vec2 roofUV;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float panel=roofUV.x*${panels.toFixed(1)}, footprint=max(fwidth(panel),.0001);
      float joint=(1.-smoothstep(.007,.007+footprint,min(fract(panel),1.-fract(panel))))*(1.-smoothstep(.15,.6,footprint));
      diffuseColor.rgb*=1.-joint*.35;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      float grazing=.26+.74*pow(max(0.,dot(normalize(roofNormal),normalize(vec3(.65,.55,-.45)))),.75);
      float roofDistantWash=1.-.92*cityFacadeLight.y*(1.-step(.1,abs(roofId-cityFacadeLight.x)));
      reflectedLight.directDiffuse+=diffuseColor.rgb*${wash ? 'roofWashColor*mix(1.,.04,smoothstep(roofWashHeight.x,roofWashHeight.y,roofHeight))' : 'vec3(1.,.9,.7)'}*cityNight*${strength.toFixed(3)}*grazing*roofDistantWash;
    `);
  };
  m.customProgramCacheKey = () => `${key}-bund-roof-shadowed-${strength}-${panels}${wash ? '-height-wash-v1' : ''}`;
  return m;
}

export type FrontOpening = { x: number; y: number; width: number; height: number; arch?: boolean | 'pointed' | 'segmental'; pediment?: boolean };
export function openingPath(o: FrontOpening) {
  const left = o.x - o.width / 2, right = o.x + o.width / 2, bottom = o.y - o.height / 2, top = o.y + o.height / 2;
  const path = new THREE.Path().moveTo(left, bottom).lineTo(right, bottom);
  if (o.arch === 'pointed') {
    path.lineTo(right, top - o.width * .72);
    path.quadraticCurveTo(right, top - o.width * .3, o.x, top);
    path.quadraticCurveTo(left, top - o.width * .3, left, top - o.width * .72);
  }
  else if (o.arch === 'segmental') {
    path.lineTo(right, top - o.width * .18);
    path.quadraticCurveTo(o.x, top + o.width * .18, left, top - o.width * .18);
  }
  else if (o.arch) { path.lineTo(right, top - o.width / 2); path.absarc(o.x, top - o.width / 2, o.width / 2, 0, Math.PI, false); }
  else path.lineTo(right, top).lineTo(left, top);
  path.closePath(); return path;
}

export function wallLedge(g: CityGeometry, plan: ShanghaiPolygon, y: number, width: number, trim: THREE.Material, openings: FrontOpening[]) {
  edges(plan, (a, b) => {
    if (Math.abs(a[1]) >= .25 || Math.abs(b[1]) >= .25) {
      g.beam([a[0], y, a[1]], [b[0], y, b[1]], width, trim); return;
    }
    // Keep the plinth between the doors/windows instead of bridging their holes.
    let start = Math.min(a[0], b[0]); const end = Math.max(a[0], b[0]);
    const gaps = openings.filter(o => Math.abs(y - o.y) < (o.height + width) / 2)
      .map(o => [o.x - o.width / 2 - .12, o.x + o.width / 2 + .12]).sort((a, b) => a[0] - b[0]);
    for (const [left, right] of [...gaps, [end, end]]) {
      if (left > start) g.beam([start, y, 0], [Math.min(left, end), y, 0], width, trim);
      start = Math.max(start, right);
      if (start >= end) break;
    }
  });
}

// Replace the street-facing wall in the local plan. The remaining OSM shell,
// roof and courtyard are unchanged; openings have real reveals and recessed glass.
export function frontShell(g: CityGeometry, plan: ShanghaiPolygon, top: number, openings: FrontOpening[], stone: THREE.Material, trim: THREE.Material, glass: THREE.Material, bronze: THREE.Material, options: { outline?: THREE.Shape; decorate?: boolean; frontDepths?: readonly number[] } = {}) {
  const shell = new THREE.ExtrudeGeometry(shanghaiShape(plan), { depth: top + .65, bevelEnabled: false });
  shell.rotateX(-Math.PI / 2); shell.translate(0, -.65, 0);
  const positions = shell.getAttribute('position'), normals = shell.getAttribute('normal'), indices: number[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    if (normals.getZ(i) < -.9 && (options.frontDepths ?? [0]).some(z => [i, i + 1, i + 2].every(j => Math.abs(positions.getZ(j)-z) < .25))) continue;
    indices.push(i, i + 1, i + 2);
  }
  shell.setIndex(indices); g.add(shell, stone);
  const front = plan.points.filter(p => Math.abs(p[1]) < .25);
  const left = Math.min(...front.map(p => p[0])), right = Math.max(...front.map(p => p[0]));
  g.group.userData.facadeLighting = { width: right - left, height: top };
  const wall = options.outline ?? new THREE.Shape().moveTo(left, -.65).lineTo(right, -.65).lineTo(right, top).lineTo(left, top).closePath();
  wall.holes = openings.map(openingPath);
  g.add(new THREE.ExtrudeGeometry(wall, { depth: .72, bevelEnabled: false, curveSegments: 16 }), stone, [0, 0, -.06]);
  for (const o of openings) {
    const bottom = o.y - o.height / 2, upper = o.y + o.height / 2;
    const face = new THREE.Shape(openingPath(o).getPoints(32));
    const glazing = new THREE.ShapeGeometry(face);
    glazing.rotateY(Math.PI);
    g.add(glazing, glass, [2 * o.x, 0, .6]);
    if (options.decorate === false) continue;
    if (o.arch) {
      // Radial voussoirs surround the real opening, with a projecting keystone.
      const radius = o.width / 2, rise = o.arch === 'pointed' ? o.width * .72 : o.arch === 'segmental' ? o.width * .18 : radius, spring = upper - rise;
      if (o.arch === 'pointed') {
        for (const side of [-1, 1]) {
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(o.x + side * (radius + .2), upper - o.width * .72, -.2), new THREE.Vector3(o.x + side * (radius + .2), upper - o.width * .3, -.2), new THREE.Vector3(o.x, upper + .2, -.2));
          const points = curve.getPoints(12);
          for (let i = 0; i < 12; i++) g.beam(points[i].toArray(), points[i + 1].toArray(), .28, trim, .38);
        }
      } else if (o.arch === 'segmental') {
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(o.x-radius-.2, upper-o.width*.18, -.2), new THREE.Vector3(o.x, upper+o.width*.18+.25, -.2), new THREE.Vector3(o.x+radius+.2, upper-o.width*.18, -.2));
        const points = curve.getPoints(16);
        for (let i=0;i<16;i++) g.beam(points[i].toArray(),points[i+1].toArray(),.28,trim,.38);
      } else for (let i = 0; i < 17; i++) {
        const a = (i + .5) * Math.PI / 17;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2);
        g.add(new THREE.BoxGeometry((radius + .22) * Math.PI / 17 * .95, .4, .38), trim, [o.x + Math.cos(a) * (radius + .22), spring + Math.sin(a) * (radius + .22), -.21], q);
      }
      g.box([.4, .58, .48], [o.x, upper + .17, -.25], trim);
      for (const offset of [-o.width * .28, 0, o.width * .28]) g.box([.055, o.height - rise, .1], [o.x + offset, bottom + (o.height - rise) / 2, .49], bronze);
      for (let y = bottom + .9; y < spring; y += 1.1) g.box([o.width, .065, .1], [o.x, y, .49], bronze);
      g.box([o.width, .08, .1], [o.x, spring, .49], bronze);
      for (let ray = 1; o.arch === true && ray < 6; ray++) {
        const a = ray * Math.PI / 6;
        g.beam([o.x, spring, .49], [o.x + Math.cos(a) * radius, spring + Math.sin(a) * radius, .49], .045, bronze, .08);
      }
    } else {
      for (const side of [-1, 1]) g.box([.18, o.height + .3, .35], [o.x + side * (o.width / 2 + .1), o.y, -.2], trim);
      g.box([o.width + .65, .22, .7], [o.x, bottom - .12, -.28], trim);
      g.box([o.width + .4, .22, .4], [o.x, upper + .12, -.18], trim);
      g.box([.065, o.height, .09], [o.x, o.y, .46], bronze);
      g.box([o.width, .075, .09], [o.x, o.y + o.height * .18, .46], bronze);
      if (o.pediment) {
        for (const side of [-1, 1]) {
          g.box([.24, .5, .56], [o.x + side * o.width * .48, upper + .4, -.3], trim);
          g.beam([o.x + side * (o.width / 2 + .45), upper + .6, -.35], [o.x, upper + 1.12, -.35], .22, trim, .5);
        }
      }
    }
  }
}
