import * as THREE from 'three';
import { WeatherSystem } from './abyssal/WeatherSystem.js';
import { VILLA_ROOMS, validSceneTime, type RoomStyle, type Weather } from './space-state';

export function sceneDaylight(timeOfDay: string) {
  if (!validSceneTime(timeOfDay)) throw new Error('timeOfDay');
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const angle = ((hours * 60 + minutes) / 720 - 1) * Math.PI;
  const latitude = THREE.MathUtils.degToRad(31.2534);
  // NOAA hour-angle/zenith equations: docs/space-sources.md.
  // ponytail: fixed equinox and local solar time; calendar/time-zone astronomy needs a date/location control.
  const direction = new THREE.Vector3(-Math.sin(angle), Math.cos(latitude) * Math.cos(angle), Math.sin(latitude) * Math.cos(angle));
  const elevation = Math.asin(direction.y);
  return { direction, elevation, azimuth: Math.atan2(direction.z, direction.x),
    day: THREE.MathUtils.smoothstep(elevation, -.12, .12), sun: THREE.MathUtils.smoothstep(elevation, 0, .18) };
}

// One linear-radiance horizon for city fog, sky and the reflection probe. At
// sunset the old 50% daylight fog sat next to an already-dark atmosphere LUT.
export function cityHorizon(day: number, cloud: number, sand = false) {
  return new THREE.Color(0x283344).lerp(new THREE.Color(sand ? 0x978267 : cloud > .7 ? 0x869aa9 : 0xadc4d2), day ** 3);
}

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
  daylight = sceneDaylight('09:00');
  private particles: THREE.Points | THREE.LineSegments | null = null;
  private mud: THREE.Mesh | null = null;
  private rocks: THREE.InstancedMesh | null = null;
  private rainbowSky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
  private uniforms = {
    uTime: { value: 0 }, uCompany: { value: 0 }, uUrban: { value: 0 }, uCity: { value: 0 }, uWind: { value: 0 },
    uKind: { value: 0 }, uDensity: { value: 0 }, uSnow: { value: 0 }, uWet: { value: 0 },
    uAnchor: { value: new THREE.Vector3() }, uTint: { value: new THREE.Color() },
  };
  private kind: Weather = 'sunny';
  private elapsed = 0;
  private lastTime = 0;
  private animated = false;
  private patched = new Set<THREE.Material>();
  private storm = false;
  private fogScale = 1;
  private matrix = new THREE.Object3D();
  private readonly budget: number;

  constructor(narrow: boolean, renderer: THREE.WebGLRenderer, invalidate: () => void, onError: () => void) {
    this.budget = narrow ? 2400 : 6500;
    this.root.name = 'space-weather'; this.root.userData.spaceBackdrop = true;
    this.engine = new WeatherSystem(renderer, narrow, roofShader, { uCompany: this.uniforms.uCompany }, invalidate, onError);
    this.root.add(this.engine.root);
  }

  get environment() { return this.engine.environment?.texture; }

  set(kind: Weather, style: RoomStyle, room: THREE.Group, island = false, city = false) {
    this.clearEffects();
    this.kind = kind; this.elapsed = 0; this.lastTime = 0;
    this.fogScale = city ? .025 : island && kind !== 'fog' ? .15 : 1;
    const [cloud, particle, density, wind] = presets[kind];
    this.uniforms.uTime.value = 0;
    this.uniforms.uKind.value = particle; this.uniforms.uDensity.value = density; this.uniforms.uWind.value = wind;
    this.uniforms.uCompany.value = Number(style === 'company');
    this.uniforms.uCity.value = Number(city);
    this.uniforms.uUrban.value = Number(!island && !city && (style === 'penthouse' || style === 'cyberpunk'));
    this.uniforms.uSnow.value = kind === 'snow' || kind === 'blizzard' ? 0.88 : kind === 'sleet' ? 0.3 : 0;
    this.uniforms.uWet.value = particle === 1 || particle === 3 || kind === 'sleet' || kind === 'rainbow' ? 1 : 0;
    this.uniforms.uTint.value.setHex(particle === 4 ? kind === 'sandstorm' ? 0xb9a17c : 0x9f997b : 0xdce8f0);
    this.storm = ['lightning', 'thunderstorm', 'typhoon'].includes(kind);
    this.animated = island || city || wind > 0 || particle > 0 || this.storm || kind === 'mudslide';
    this.engine.set({ cloud, rain: particle === 1 ? density : kind === 'sleet' ? density * .5 : 0,
      island, city, wind, fog: presets[kind][4] * this.fogScale, storm: this.storm, tornado: kind === 'tornado',
      sand: kind === 'sandstorm', urban: this.uniforms.uUrban.value > 0 });
    if (kind === 'sleet') this.precipitation(2, density * .5);
    else if (particle > 1) this.precipitation(particle, density);
    if (kind === 'mudslide') this.mudslide();
    if (kind === 'rainbow') this.rainbow();
    this.patchSurfaces(room);
  }

  setTime(timeOfDay: string) {
    this.daylight = sceneDaylight(timeOfDay);
    const { elevation, azimuth, day } = this.daylight;
    this.engine.setTime(elevation, azimuth, day);
    this.engine.sky.shared.uHorizonColor.value.copy(this.lighting().fog.color);
  }

  lighting() {
    const [cloud, , , , fog] = presets[this.kind];
    const fogColor = this.uniforms.uCity.value ? cityHorizon(this.daylight.day, cloud, this.kind === 'sandstorm') : new THREE.Color(0x17202e).lerp(new THREE.Color(this.kind === 'sandstorm' ? 0x978267 : cloud > 0.8 ? 0x647581 : 0xadc4d2), this.daylight.day);
    return { sun: Math.max(0.04, 1 - cloud * 0.96), ambient: 1 - cloud * 0.32,
      fog: new THREE.FogExp2(fogColor, Math.max(this.fogScale === .025 ? .000035 : 0, (fog || 0.0008) * this.fogScale)) };
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
    // An angular sky effect keeps its apparent size from a room to a city flight.
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: { uSun: { value: this.daylight.direction.clone() }, uDay: { value: 1 } },
      vertexShader: 'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vDirection;uniform vec3 uSun;uniform float uDay;void main(){
        vec3 direction=normalize(vDirection);
        float angle=degrees(acos(clamp(dot(direction,-uSun),-1.,1.)));
        float band=(angle-40.4)/2.4, hue=(1.-clamp(band,0.,1.))*.76;
        vec3 color=clamp(abs(mod(hue*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);
        float a=smoothstep(0.,.18,band)*(1.-smoothstep(.78,1.,band))*smoothstep(-.01,.025,direction.y)*.34*uDay;
        gl_FragColor=vec4(mix(color,vec3(1.),.2),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    this.rainbowSky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
    this.rainbowSky.name = 'rainbow-sky';
    this.rainbowSky.frustumCulled = false;
    this.root.add(this.rainbowSky);
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
          shader.uniforms.uCompany = this.uniforms.uCompany; shader.uniforms.uSnow = this.uniforms.uSnow; shader.uniforms.uWet = this.uniforms.uWet; shader.uniforms.uCity = this.uniforms.uCity;
          shader.vertexShader = 'varying vec3 vWeatherPosition; varying vec3 vWeatherNormal;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
            vec4 weatherPosition=vec4(transformed,1.); vec3 weatherNormal=objectNormal;
            #ifdef USE_INSTANCING
            weatherPosition=instanceMatrix*weatherPosition; weatherNormal=mat3(instanceMatrix)*weatherNormal;
            #endif
            vWeatherPosition=(modelMatrix*weatherPosition).xyz; vWeatherNormal=normalize(mat3(modelMatrix)*weatherNormal);`);
          shader.fragmentShader = `${roofShader}\n${noiseShader}\nuniform float uSnow,uWet,uCity; varying vec3 vWeatherPosition,vWeatherNormal;\n` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat exposed=step(roofAt(vWeatherPosition.xz)-.55,vWeatherPosition.y)*smoothstep(.45,.85,vWeatherNormal.y); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.92,.95),exposed*uSnow); diffuseColor.rgb*=1.-exposed*uWet*.14;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            // Rain darkens porous surfaces but does not turn an entire city into
            // polished metal. Broad puddle variation stays stable while flying.
            float puddle=noise(vec3(vWeatherPosition.xz*.012,2.7))*.7+noise(vec3(vWeatherPosition.xz*.037,7.1))*.3;
            float wetRoughness=mix(.16,mix(.42,.64,puddle),uCity);
            roughnessFactor=mix(roughnessFactor,min(roughnessFactor,wetRoughness),exposed*uWet);
            roughnessFactor=mix(roughnessFactor,.88,exposed*uSnow);
          `);
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
    if (this.rainbowSky) {
      this.rainbowSky.position.copy(camera.position);
      this.rainbowSky.scale.setScalar(camera.far * .8);
      this.rainbowSky.material.uniforms.uSun.value.copy(this.daylight.direction);
      this.rainbowSky.material.uniforms.uDay.value = this.daylight.sun;
      this.rainbowSky.visible = this.daylight.sun > 0;
    }
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
    this.particles = null; this.mud = null; this.rocks = null; this.rainbowSky = null;
  }

  forgetRoom() { this.patched.clear(); }
  dispose() { this.clearEffects(); this.engine.dispose(); this.patched.clear(); this.root.removeFromParent(); }
}
