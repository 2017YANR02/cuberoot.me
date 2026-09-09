import * as T from 'three';
import { clampHistoryPosition, HISTORY_LAST, HISTORY_SPACING } from './history-days';
import { environmentValue, groundY, historyDaylight, riverZ, type JourneyWeather } from './history-environment';
import type { PaperScenery } from './history-scenery';

type ClimateSheet = T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
type ClimatePoints = T.Points<T.BufferGeometry, T.ShaderMaterial>;

/** Thin paper wisps and cut crystals, without a screen-space pass or external textures. */
export class PaperClimateEffects {
  readonly root = new T.Group();
  private readonly seaFog = new T.Group();
  private readonly heat = new T.Group();
  private readonly frost = new T.Group();
  private readonly frostGround = new T.Group();
  private readonly crystals: T.InstancedMesh<T.BufferGeometry, T.MeshBasicMaterial>;
  private readonly diamondDust: ClimatePoints;
  private readonly pollen: ClimatePoints;
  private readonly sheets: ClimateSheet[] = [];
  private readonly paper: T.Color;
  private readonly ice: T.Color;
  private readonly snow: T.Color;
  private readonly gold: T.Color;
  private readonly sand: T.Color;
  private readonly tint = new T.Color();
  private readonly matrix = new T.Matrix4();
  private readonly quaternion = new T.Quaternion();
  private readonly spin = new T.Quaternion();
  private readonly translation = new T.Vector3();
  private readonly scale = new T.Vector3();
  private readonly up = new T.Vector3(0, 1, 0);
  private clock = 0;
  private previousTime: number | null = null;
  private frostDay = -1;
  private disposed = false;

  constructor(art: PaperScenery, narrow: boolean) {
    const p = art.palette;
    this.paper = new T.Color(p.paper); this.ice = new T.Color(p.ice); this.snow = new T.Color(p.snow);
    this.gold = new T.Color(p.gold); this.sand = new T.Color(p.sand);
    this.root.name = 'history-climate-effects';
    this.seaFog.name = 'history-sea-fog'; this.heat.name = 'history-heat-haze';
    this.frost.name = 'history-frost'; this.frostGround.name = 'history-frost-ground';

    // The rear bank carries taller wisps; the ribbon over the river stays below the sculptures.
    for (const [width, height, x, y, z, phase, opacity] of [
      [66, 4.2, -3, 2.4, -13, .4, .67],
      [58, 2.8, 4, 1.65, -5.5, 2.3, .52],
      [62, 1.35, -1, .76, 5, 4.9, .48],
    ]) this.seaFog.add(this.sheet(width, height, x, y, z, phase, opacity, false));
    for (const [width, height, x, y, z, phase, opacity] of [
      [57, 1.55, -1, 1.02, -10, 1.1, .63],
      [48, 1.12, 2, .74, -5.9, 3.7, .54],
    ]) this.heat.add(this.sheet(width, height, x, y, z, phase, opacity, true));
    for (const [width, height, x, y, z, phase, opacity] of [
      [56, .8, -2, .35, -6.1, 1.7, .35],
      [51, .55, 1, .28, 6.1, 4.2, .27],
    ]) this.frost.add(this.sheet(width, height, x, y, z, phase, opacity, false));

    // Six branched rays form a single flat crystal. Instances rest on the actual front bank.
    const vertices: number[] = [];
    const strip = (ax: number, az: number, bx: number, bz: number, width: number) => {
      const length = Math.hypot(bx - ax, bz - az), dx = -(bz - az) / length * width, dz = (bx - ax) / length * width;
      vertices.push(ax - dx, .009, az - dz, bx - dx, .009, bz - dz, bx + dx, .009, bz + dz,
        ax - dx, .009, az - dz, bx + dx, .009, bz + dz, ax + dx, .009, az + dz);
    };
    for (let ray = 0; ray < 6; ray++) {
      const angle = ray * Math.PI / 3, dx = Math.cos(angle), dz = Math.sin(angle);
      strip(0, 0, dx, dz, .083);
      for (const radius of [.43, .7]) for (const side of [-1, 1]) {
        const branch = angle + side * .91;
        strip(dx * radius, dz * radius, dx * radius + Math.cos(branch) * .27, dz * radius + Math.sin(branch) * .27, .049);
      }
    }
    const crystalGeometry = new T.BufferGeometry();
    crystalGeometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    crystalGeometry.computeVertexNormals();
    this.crystals = new T.InstancedMesh(crystalGeometry, new T.MeshBasicMaterial({
      color: new T.Color(p.ice).lerp(new T.Color(p.ocean), .12), transparent: true, opacity: .88, depthWrite: false, side: T.DoubleSide,
    }), 54);
    this.crystals.name = 'history-ground-crystals';
    this.crystals.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.frostGround.add(this.crystals); this.frost.add(this.frostGround);
    this.diamondDust = this.particles('history-diamond-dust', 86, false);
    this.pollen = this.particles('history-pollen', 34, true);
    this.root.add(this.seaFog, this.heat, this.frost, this.diamondDust, this.pollen);
    for (const effect of this.root.children) effect.visible = false;
    this.setParticleCounts(narrow);
  }

  private sheet(width: number, height: number, x: number, y: number, z: number, phase: number, opacity: number, heat: boolean) {
    const sheet = new T.Mesh(new T.PlaneGeometry(width, height, 48, 6), new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { time: { value: 0 }, phase: { value: phase }, opacity: { value: opacity }, tint: { value: new T.Color() }, heat: { value: heat ? 1 : 0 } },
      vertexShader: `uniform float time,phase,heat; varying vec2 vUv;
        void main(){
          vUv=uv; vec3 p=position;
          p.y+=sin(uv.x*11.+phase+time*.19)*mix(.065,.11,heat);
          p.z+=sin(uv.x*8.+phase)*.2;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: `uniform float time,phase,opacity,heat; uniform vec3 tint; varying vec2 vUv;
        void main(){
          float edge=smoothstep(0.,.12,vUv.x)*(1.-smoothstep(.86,1.,vUv.x));
          edge*=smoothstep(0.,.16,vUv.y)*(1.-smoothstep(.7,1.,vUv.y));
          float bend=sin(vUv.x*12.+phase+time*.14)*.095+sin(vUv.x*27.-time*.11)*.024;
          float wisp=exp(-pow((vUv.y-.42-bend)/.19,2.));
          float filaments=.62+.24*sin(vUv.x*18.-vUv.y*7.+phase+time*.13);
          float contour=abs(sin((vUv.y+bend*.72)*15.+phase+time*.2));
          float thermal=(1.-smoothstep(.06,.36,contour))*.88;
          float alpha=edge*mix(wisp*filaments,thermal,heat)*opacity;
          if(alpha<.003) discard;
          gl_FragColor=vec4(tint,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    sheet.position.set(x, y, z); sheet.frustumCulled = false;
    this.sheets.push(sheet);
    return sheet;
  }

  private particles(name: string, count: number, pollen: boolean): ClimatePoints {
    const positions: number[] = [], seeds: number[] = [];
    for (let i = 0; i < count; i++) {
      const seed = (i + 1) * 2.3999632297;
      positions.push(((i * .61803398875) % 1 - .5) * 57, .6 + (i * .41421356237 % 1) * (pollen ? 5.1 : 10.5), -10 + (i * .73205080756 % 1) * 19);
      seeds.push(seed);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new T.Float32BufferAttribute(seeds, 1));
    const points = new T.Points(geometry, new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, density: { value: 1 }, tint: { value: new T.Color() }, pollen: { value: pollen ? 1 : 0 } },
      vertexShader: `attribute float seed; uniform float time,density,pollen; varying float shimmer;
        void main(){
          vec3 p=position;
          float airborne=mod(position.y-time*.2+10.5,10.5)+.6;
          p.y=mix(airborne,position.y+sin(time*.33+seed)*.27,pollen);
          p.x+=sin(time*.23+seed)*mix(.45,.9,pollen);
          p.z+=cos(time*.19+seed)*.25;
          shimmer=mix(.7+.3*pow(.5+.5*sin(seed+time*.7),3.),.95,pollen);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
          gl_PointSize=mix(4.+mod(seed,2.2),3.2+mod(seed,1.9),pollen)*density;
        }`,
      fragmentShader: `uniform vec3 tint; uniform float pollen; varying float shimmer;
        void main(){
          vec2 q=gl_PointCoord-.5;
          float diamond=1.-smoothstep(.3,.45,abs(q.x)+abs(q.y));
          float arms=(1.-smoothstep(.035,.105,min(abs(q.x),abs(q.y))))*(1.-smoothstep(.35,.5,max(abs(q.x),abs(q.y))));
          float crystal=max(diamond*.75,arms);
          float grain=1.-smoothstep(.23,.47,length(q*vec2(1.,1.27)));
          float alpha=mix(crystal,grain,pollen)*shimmer;
          if(alpha<.02) discard;
          gl_FragColor=vec4(tint,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    points.name = name; points.frustumCulled = false;
    return points;
  }

  private setParticleCounts(narrow: boolean) {
    this.diamondDust.geometry.setDrawRange(0, narrow ? 52 : 86);
    this.pollen.geometry.setDrawRange(0, narrow ? 20 : 34);
  }

  private placeFrost(day: number) {
    if (day === this.frostDay) return;
    this.frostDay = day;
    let index = 0;
    for (let date = Math.max(0, day - 1); date <= Math.min(HISTORY_LAST, day + 1); date++) {
      for (let i = 0; i < 18; i++) {
        const seed = (i + date * 3) * .61803398875;
        const x = date * HISTORY_SPACING - 13 + i / 17 * 26;
        const z = riverZ(x) + environmentValue(x, 'water') / 2 + 1.24 + (seed % 1) * .22;
        this.translation.set(x, groundY(x) - .023, z);
        const slope = (groundY(x + .1) - groundY(x - .1)) / .2;
        this.matrix.makeRotationZ(Math.atan(slope));
        this.quaternion.setFromRotationMatrix(this.matrix).multiply(this.spin.setFromAxisAngle(this.up, seed * 4));
        this.scale.setScalar(.36 + (i * .41421356237 % 1) * .24);
        this.matrix.compose(this.translation, this.quaternion, this.scale);
        this.crystals.setMatrixAt(index++, this.matrix);
      }
    }
    this.crystals.count = index; this.crystals.instanceMatrix.needsUpdate = true;
    this.crystals.computeBoundingBox(); this.crystals.computeBoundingSphere();
  }

  /** Sets root to world coordinates; a following parent must subtract its own translation. */
  update(time: number, position: number, weather: JourneyWeather, animate: boolean, density: number, narrow: boolean) {
    if (this.disposed) return;
    const inputTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    if (this.previousTime !== null && animate) this.clock += Math.max(0, Math.min(.1, inputTime - this.previousTime));
    this.previousTime = inputTime;
    const value = clampHistoryPosition(position), x = value * HISTORY_SPACING, y = groundY(x);
    const daylight = historyDaylight(value).daylight, brightness = .54 + daylight * .46;
    const pixelDensity = Number.isFinite(density) ? T.MathUtils.clamp(density, .5, 4) : 1;
    this.root.position.set(x, y, 0);
    this.seaFog.visible = weather === 'seaFog'; this.heat.visible = weather === 'heatHaze';
    this.frost.visible = weather === 'frost'; this.diamondDust.visible = weather === 'diamondDust';
    this.pollen.visible = weather === 'pollen';
    this.setParticleCounts(narrow);
    for (const sheet of this.sheets) {
      const uniforms = sheet.material.uniforms;
      uniforms.time.value = this.clock;
      this.tint.copy(uniforms.heat.value ? this.gold : this.snow).lerp(uniforms.heat.value ? this.sand : this.paper, uniforms.heat.value ? .35 : .2).multiplyScalar(brightness * (uniforms.heat.value ? .92 : 1.12));
      uniforms.tint.value.copy(this.tint);
    }
    for (const points of [this.diamondDust, this.pollen]) {
      const uniforms = points.material.uniforms;
      uniforms.time.value = this.clock; uniforms.density.value = pixelDensity;
      uniforms.tint.value.copy(points === this.pollen ? this.gold : this.ice).lerp(this.paper, points === this.pollen ? 0 : .28).multiplyScalar(brightness * (points === this.pollen ? .85 : 1));
    }
    if (this.frost.visible) this.placeFrost(Math.round(value));
    // These matrices use fixed world x/y, independent of both the camera and the active day.
    this.frostGround.position.set(-x, -y, 0);
    this.crystals.material.opacity = .66 + .22 * daylight;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
    this.root.traverse(object => {
      if (!(object instanceof T.Mesh || object instanceof T.Points)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object instanceof T.InstancedMesh) object.dispose();
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    this.root.clear(); this.sheets.length = 0;
  }
}
