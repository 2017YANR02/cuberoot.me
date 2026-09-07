import * as THREE from 'three';
import { WeatherSystem } from './abyssal/WeatherSystem.js';
import { VILLA_ROOMS, type RoomStyle, type Weather } from './space-state';

// Bounds: weather never enters layout geometry or picking; roofs shelter interiors,
// including cutaways. All effects have fixed budgets and own their GPU resources.
const presets = {
  sunny: [0, 0, 0, 0, 0], cloudy: [0.42, 0, 0, 0.7, 0], overcast: [0.9, 0, 0, 1, 0.003],
  windy: [0.45, 4, 0.3, 10, 0.002], drizzle: [0.65, 1, 0.22, 0.8, 0.004], rain: [0.8, 1, 0.6, 2, 0.005],
  downpour: [1, 1, 1, 4, 0.009], lightning: [0.92, 0, 0, 3, 0.004], thunderstorm: [1, 1, 0.85, 6, 0.008],
  fog: [0.85, 0, 0, 0, 0.032], snow: [0.62, 2, 0.65, 1, 0.007], blizzard: [1, 2, 1, 12, 0.022],
  sleet: [0.85, 2, 0.7, 4, 0.008], hail: [0.95, 3, 0.65, 5, 0.007], sandstorm: [1, 4, 1, 14, 0.02],
  typhoon: [1, 1, 1, 22, 0.015], tornado: [1, 4, 0.5, 10, 0.007], mudslide: [1, 1, 0.8, 6, 0.008],
  rainbow: [0.25, 0, 0, 0, 0.001],
} satisfies Record<Weather, number[]>;

export function weatherRoof(x: number, z: number, style: RoomStyle) {
  if (style === 'company') return x >= -26.2 && x <= 0.9 && z >= -5.9 && z <= 13.1 ? 3.8 : -120;
  return Object.values(VILLA_ROOMS).reduce((height, r) => Math.abs(x - r.x) <= r.width / 2 + 0.35 && Math.abs(z - r.z) <= r.depth / 2 + 0.35 ? Math.max(height, r.ceiling) : height, -120);
}
const roofShader = `
uniform float uCompany;
float roofAt(vec2 p) {
  if(uCompany > 0.5) return p.x >= -26.2 && p.x <= 0.9 && p.y >= -5.9 && p.y <= 13.1 ? 3.8 : -120.;
  float h = -120.;
  ${Object.values(VILLA_ROOMS).map(r => `if(abs(p.x - ${r.x.toFixed(2)}) <= ${(r.width / 2 + 0.35).toFixed(2)} && abs(p.y - ${r.z.toFixed(2)}) <= ${(r.depth / 2 + 0.35).toFixed(2)}) h = max(h, ${r.ceiling.toFixed(2)});`).join('\n')}
  return h;
}`;
const noiseShader = `
float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`;

export class SpaceWeather {
  readonly root = new THREE.Group();
  readonly engine: WeatherSystem;
  private particles: THREE.Points | THREE.LineSegments | null = null;
  private mud: THREE.Mesh | null = null;
  private rocks: THREE.InstancedMesh | null = null;
  private uniforms = {
    uTime: { value: 0 }, uCompany: { value: 0 }, uUrban: { value: 0 }, uWind: { value: 0 },
    uKind: { value: 0 }, uDensity: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 },
    uAnchor: { value: new THREE.Vector3() }, uTint: { value: new THREE.Color() },
  };
  private kind: Weather = 'sunny';
  private style: RoomStyle = 'minimal';
  private elapsed = 0;
  private lastTime = 0;
  private animated = false;
  private patched = new Set<THREE.Material>();
  private storm = false;
  private matrix = new THREE.Object3D();
  private readonly budget: number;

  constructor(narrow: boolean, renderer: THREE.WebGLRenderer, invalidate: () => void, onError: () => void) {
    this.budget = narrow ? 2400 : 6500;
    this.root.name = 'space-weather'; this.root.userData.spaceBackdrop = true;
    this.engine = new WeatherSystem(renderer, narrow, roofShader, { uCompany: this.uniforms.uCompany }, invalidate, onError);
    this.root.add(this.engine.root);
  }

  get environment() { return this.engine.environment?.texture; }

  set(kind: Weather, style: RoomStyle, room: THREE.Group) {
    this.clearEffects();
    this.kind = kind; this.style = style; this.elapsed = 0; this.lastTime = 0;
    const [cloud, particle, density, wind] = presets[kind];
    this.uniforms.uTime.value = 0;
    this.uniforms.uKind.value = particle; this.uniforms.uDensity.value = density; this.uniforms.uWind.value = wind;
    this.uniforms.uCompany.value = Number(style === 'company');
    this.uniforms.uUrban.value = Number(style === 'penthouse' || style === 'cyberpunk');
    this.uniforms.uSnow.value = kind === 'snow' || kind === 'blizzard' ? 0.88 : kind === 'sleet' ? 0.3 : 0;
    this.uniforms.uWet.value = particle === 1 || particle === 3 || kind === 'sleet' || kind === 'rainbow' ? 1 : 0;
    this.uniforms.uTint.value.setHex(particle === 4 ? kind === 'sandstorm' ? 0xb9a17c : 0x9f997b : 0xdce8f0);
    this.storm = ['lightning', 'thunderstorm', 'typhoon'].includes(kind);
    this.animated = wind > 0 || particle > 0 || this.storm || kind === 'mudslide';
    this.engine.set({ cloud, rain: particle === 1 ? density : kind === 'sleet' ? density * .5 : 0,
      wind, fog: presets[kind][4], storm: this.storm, tornado: kind === 'tornado',
      night: style === 'cyberpunk', sand: kind === 'sandstorm', urban: this.uniforms.uUrban.value > 0 });
    if (kind === 'sleet') this.precipitation(2, density * .5);
    else if (particle > 1) this.precipitation(particle, density);
    if (kind === 'mudslide') this.mudslide();
    if (kind === 'rainbow') this.rainbow();
    this.patchSurfaces(room);
  }

  lighting() {
    const [cloud, , , , fog] = presets[this.kind];
    return { sun: Math.max(0.04, 1 - cloud * 0.96), ambient: 1 - cloud * 0.32,
      fog: new THREE.FogExp2(this.kind === 'sandstorm' ? 0x978267 : this.style === 'cyberpunk' ? 0x17202e : cloud > 0.8 ? 0x647581 : 0xadc4d2, fog || 0.0008) };
  }

  private precipitation(kind: number, density: number) {
    const count = Math.floor(this.budget * density);
    const vertices = new Float32Array(count * 3), seeds = new Float32Array(count * 4);
    const rand = THREE.MathUtils.seededRandom;
    rand(7283);
    for (let i = 0; i < count; i++) {
      const seed = [rand(), rand(), rand(), rand()];
      seeds.set(seed, i * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    const material = new THREE.ShaderMaterial({ uniforms: { ...this.uniforms, uKind: { value: kind } }, transparent: true, depthWrite: false,
      vertexShader: `${roofShader}
        attribute vec4 seed; uniform float uTime, uWind, uKind, uUrban; uniform vec3 uAnchor;
        varying float vAlpha;
        void main() {
          float nearField=step(seed.w,0.68), span=mix(180.,42.,nearField), height=mix(55.,24.,nearField);
          float speed=uKind < 1.5 ? 18. : uKind < 2.5 ? 1.6 : uKind < 3.5 ? 14. : 0.6;
          vec3 p=vec3(mod(seed.x*span+uTime*uWind,span)-span*.5,mod(seed.y*height-uTime*speed,height),seed.z*span-span*.5);
          p.xz+=mix(vec2(-8.,0.),uAnchor.xz,nearField);
          p.y+=mix(-0.5,max(0.,uAnchor.y-10.),nearField);
          if(uKind>1.5) p.xz+=vec2(sin(uTime*.8+seed.x*60.),cos(uTime*.5+seed.z*80.))*.6;
          if(uKind<1.5) p+=vec3(-uWind*.015,.28,0.)*position.y;
          if(uKind>2.5 && uKind<3.5) p.y+=abs(sin(uTime*7.+seed.x*31.))*.35;
          vAlpha=p.y<roofAt(p.xz)+0.15 || (uUrban>0.5 && p.y<0. && abs(p.x+9.)<40. && abs(p.z)<25.) ? 0. : 1.;
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((uKind<2.5 ? 55. : uKind<3.5 ? 85. : 40.)/max(1.,-mv.z),1.,7.);
        }`,
      fragmentShader: `uniform vec3 uTint; varying float vAlpha;
        void main(){ float a=(1.-smoothstep(.1,.5,length(gl_PointCoord-.5)))*.65*vAlpha; if(a<.01) discard; gl_FragColor=vec4(uTint,a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    this.particles = new THREE.Points(geometry, material);
    this.particles.frustumCulled = false; this.root.add(this.particles);
  }

  private mudslide() {
    // ponytail: an authored exterior debris flow, not terrain erosion or fluid dynamics.
    const urban = this.uniforms.uUrban.value > 0;
    const bank = new THREE.PlaneGeometry(34, 110, 32, 80); bank.rotateX(-Math.PI / 2);
    const earth = bank.attributes.position;
    for (let i = 0; i < earth.count; i++) {
      const z = earth.getZ(i) + 13, t = THREE.MathUtils.clamp((z + 20) / 75, 0, 1);
      const shoulder = 1 - THREE.MathUtils.smoothstep(Math.abs(earth.getX(i) - Math.sin(t * 5) * 3), 9, 17);
      earth.setY(i, (1 - t) ** 3 * 18 * shoulder * THREE.MathUtils.smoothstep(z, -42, -20));
    }
    bank.computeVertexNormals();
    const slope = new THREE.Mesh(bank, new THREE.MeshStandardMaterial({ color: 0x4e493a, roughness: .94 }));
    slope.position.set(-42, urban ? -119.6 : -.6, 13); this.root.add(slope);
    const geometry = new THREE.PlaneGeometry(15, 75, 24, 64); geometry.rotateX(-Math.PI / 2);
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), t = (z + 37.5) / 75;
      p.setXYZ(i, p.getX(i) * (0.45 + t * 0.75) + Math.sin(t * 5) * 3, (1 - t) ** 3 * 18 + .25, z);
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ color: 0x594331, roughness: 0.24, metalness: 0.08 });
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = 'varying vec3 vFlow; uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(position.z*1.3-uTime*4.+position.x)*.12; vFlow=position;');
      shader.fragmentShader = `${noiseShader} varying vec3 vFlow; uniform float uTime;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat mudNoise=noise(vec3(vFlow.x*2.,vFlow.z*.7-uTime*3.,2.)); diffuseColor.rgb*=.55+mudNoise*.9;');
    };
    this.mud = new THREE.Mesh(geometry, material); this.mud.position.set(-42, urban ? -119.6 : -0.6, 17.5); this.root.add(this.mud);
    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x786550, roughness: .8 }), 80);
    this.rocks.frustumCulled = false; this.root.add(this.rocks);
  }

  private rainbow() {
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vArc;void main(){vArc=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vArc;void main(){
        float r=length(vArc), hue=clamp((55.-r)/9.,0.,1.)*.76;
        vec3 color=clamp(abs(mod(hue*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);
        float a=smoothstep(46.,48.,r)*(1.-smoothstep(53.,55.,r))*smoothstep(0.,14.,vArc.y)*.2;
        gl_FragColor=vec4(mix(color,vec3(1.),.2),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(46, 55, 128, 1, 0, Math.PI), material);
    mesh.position.set(-25, 0, -110); mesh.rotation.y = .3; this.root.add(mesh);
  }

  patchSurfaces(room: THREE.Group) {
    room.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || this.patched.has(material)) continue;
        this.patched.add(material);
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          shader.uniforms.uCompany = this.uniforms.uCompany; shader.uniforms.uSnow = this.uniforms.uSnow; shader.uniforms.uWet = this.uniforms.uWet;
          shader.vertexShader = 'varying vec3 vWeatherPosition; varying vec3 vWeatherNormal;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
            vec4 weatherPosition=vec4(transformed,1.); vec3 weatherNormal=objectNormal;
            #ifdef USE_INSTANCING
            weatherPosition=instanceMatrix*weatherPosition; weatherNormal=mat3(instanceMatrix)*weatherNormal;
            #endif
            vWeatherPosition=(modelMatrix*weatherPosition).xyz; vWeatherNormal=normalize(mat3(modelMatrix)*weatherNormal);`);
          shader.fragmentShader = `${roofShader}\nuniform float uSnow,uWet; varying vec3 vWeatherPosition,vWeatherNormal;\n` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat exposed=step(roofAt(vWeatherPosition.xz)-.55,vWeatherPosition.y)*smoothstep(.45,.85,vWeatherNormal.y); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.92,.95),exposed*uSnow); diffuseColor.rgb*=1.-exposed*uWet*.14;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.16,exposed*uWet); roughnessFactor=mix(roughnessFactor,.88,exposed*uSnow);');
        };
        material.customProgramCacheKey = () => key + '-space-weather'; material.needsUpdate = true;
      }
    });
  }

  update(time: number, camera: THREE.PerspectiveCamera, motion: boolean) {
    const running = motion && this.animated;
    const dt = running && this.lastTime ? Math.min(.1, (time - this.lastTime) / 1000) : 0;
    this.elapsed += dt;
    this.lastTime = running ? time : 0;
    this.uniforms.uTime.value = this.elapsed; this.uniforms.uAnchor.value.copy(camera.position);
    this.engine.update(camera, this.elapsed, dt, motion);
    if (this.rocks) {
      for (let i = 0; i < this.rocks.count; i++) {
        const t = (i * .61803398875 + this.elapsed * .045) % 1;
        this.matrix.position.set(-42 + Math.sin(t * 5) * 3 + Math.sin(i * 3.1) * 5 * (.45 + t * .75), (this.uniforms.uUrban.value ? -119.6 : -.6) + (1 - t) ** 3 * 18 + .7, -20 + t * 75);
        this.matrix.rotation.set(i + this.elapsed, i * .7, this.elapsed * .8); this.matrix.scale.setScalar(.2 + i % 7 * .09); this.matrix.updateMatrix(); this.rocks.setMatrixAt(i, this.matrix.matrix);
      }
      this.rocks.instanceMatrix.needsUpdate = true;
    }
    return running;
  }

  private clearEffects() {
    for (const o of [...this.root.children]) if (o !== this.engine.root) {
      o.removeFromParent();
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); }
    }
    this.particles = null; this.mud = null; this.rocks = null;
  }

  forgetRoom() { this.patched.clear(); }
  dispose() { this.clearEffects(); this.engine.dispose(); this.patched.clear(); this.root.removeFromParent(); }
}
