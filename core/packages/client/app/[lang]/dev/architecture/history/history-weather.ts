import * as T from 'three';
import { precipitationGeometry, debrisFlowSample, WEATHER_NOISE_GLSL } from '@/lib/three-weather';
import { HISTORY_PLACES, HISTORY_SPACING, clampHistoryPosition, historyWindow } from './history-days';
import { groundY, journeyWeather, historyDaylight, type JourneyWeather } from './history-environment';
import type { PaperScenery } from './history-scenery';
import { PaperClimateEffects } from './history-climate-effects';
import { HISTORY_LANDFORMS } from './history-landforms';

/** A quick strike with a soft afterglow, followed by several quiet seconds. */
export function historyLightningPulse(time: number, day: number, animate = true) {
  if (!animate || !Number.isFinite(time) || time < 0 || !Number.isFinite(day)) return 0;
  const index = Math.max(0, Math.floor(day));
  const phase = time % (8.4 + index % 4 * .7) - (1.2 + index % 5 * .13);
  if (phase < 0 || phase > .72) return 0;
  return Math.min(1, phase / .055) * Math.exp(-Math.max(0, phase - .055) * 5.8);
}

/** Weather is an authored part of the miniature, unrelated to the dates' real weather. */
export class PaperWeather {
  readonly root = new T.Group();
  private readonly materials: T.Material[] = [];
  private readonly clouds: T.Mesh[] = [];
  private readonly mist: T.Mesh[] = [];
  private readonly rainbow = new T.Group();
  private readonly rainbows = new Map<number, T.Group>();
  private readonly lightning = new T.Group();
  private readonly lightningLight = new T.PointLight();
  private readonly lightningCore: T.MeshBasicMaterial;
  private readonly lightningGlow: T.MeshBasicMaterial;
  private readonly cloudGlow: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
  private readonly climate: PaperClimateEffects;
  private readonly funnel = new T.Group();
  private readonly aurora = new T.Group();
  private readonly mud = new T.Group();
  private readonly cascades = new T.Group();
  private readonly particles: T.Points;
  private readonly rocks: T.InstancedMesh;
  private readonly matrix = new T.Object3D();
  private readonly uniforms = {
    time: { value: 0 }, kind: { value: 0 }, amount: { value: 0 }, density: { value: 1 },
    tint: { value: new T.Color() }, snowTint: { value: new T.Color() }, wind: { value: .5 },
    fallSpeed: { value: 1 }, size: { value: 1 },
    viewSize: { value: new T.Vector2(38, 19) },
    viewToLocal: { value: new T.Matrix4().makeTranslation(0, 9.5, -2) },
  };
  private weather: JourneyWeather = 'storm';
  private transition = 1;
  private previousTime = 0;
  private weatherStart = 0;
  get lightningStrength() { return this.lightningCore.opacity; }

  constructor(private readonly art: PaperScenery, narrow: boolean) {
    const p = art.palette;
    const basic = (color: string, opacity = 1) => {
      const material = new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: T.DoubleSide });
      this.materials.push(material); return material;
    };
    const ribbon = (width: number, thickness: number) => {
      const shape = new T.Shape();
      shape.moveTo(-width / 2, 0);
      shape.bezierCurveTo(-width * .3, thickness * 1.5, -width * .16, thickness * .25, 0, thickness * .6);
      shape.bezierCurveTo(width * .2, thickness * 1.1, width * .29, thickness * .2, width / 2, 0);
      shape.bezierCurveTo(width * .12, -thickness * .12, -width * .2, -thickness * .65, -width / 2, 0);
      return new T.ShapeGeometry(shape, 24);
    };
    for (let i = 0; i < 6; i++) {
      const cloud = new T.Mesh(ribbon(13 + i % 3 * 3, .7 + i % 2 * .4), basic(p.mist, .6));
      cloud.position.set(-15 + i * 6, 12.5 + i % 3 * 1.1, -18 - i % 2 * 3);
      this.clouds.push(cloud); this.root.add(cloud);
    }
    for (let i = 0; i < 4; i++) {
      const band = new T.Mesh(ribbon(18 + i * 3, .45), basic(p.snow, .4));
      band.position.set((i % 2 - .5) * 8, 1.3 + i * 1.1, -4 - i * 2.7);
      this.mist.push(band); this.root.add(band);
    }
    const rainbowColors = [p.vermilion, p.clay, p.gold, p.jade, p.water, p.heather];
    rainbowColors.forEach((color, i) => {
      const points = Array.from({ length: 65 }, (_, j) => {
        const a = j / 64 * Math.PI, r = 8.5 - i * .19;
        return new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
      });
      const arc = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 80, .075, 5, false), basic(art.mix(color, p.paper, .17), .55));
      this.rainbow.add(arc);
    });
    // This is a shared geometry prototype. Each passage owns a fixed world anchor.
    this.rainbow.position.set(2, 3, -13);
    this.lightning.name = 'history-lightning';
    this.lightningCore = basic(p.snow, 0); this.lightningGlow = basic(p.ice, 0);
    this.lightningCore.toneMapped = false; this.lightningGlow.toneMapped = false;
    // Real thin geometry remains clear when the canvas is enlarged; a soft outer edge needs no bloom pass.
    for (let variant = 0; variant < 3; variant++) {
      const fork = new T.Group();
      const bolt = [[5.9, 14, -12], [5.1, 12.6, -12], [5.55, 12.1, -12], [4.4, 10.6, -12],
        [5.05, 10.75, -12], [3.85, 8.65, -12], [4.3, 8.85, -12], [3.15, 6.6, -12]];
      const paths = [bolt, [bolt[2], [7.1, 11.5, -12], [6.7, 10.4, -12], [7.4, 9.6, -12]],
        [bolt[5], [2.25, 8.5, -12], [1.75, 7.25, -12]]];
      paths.forEach((points, branch) => {
        const curve = new T.CurvePath<T.Vector3>();
        const vertices = points.map(([x, y, z], i) => new T.Vector3(x + Math.sin(i * 2.3 + variant) * variant * .34, y, z));
        vertices.slice(1).forEach((point, i) => curve.add(new T.LineCurve3(vertices[i], point)));
        for (const [radius, material] of [[.046, this.lightningCore], [.14, this.lightningGlow]] as const) {
          fork.add(new T.Mesh(new T.TubeGeometry(curve, vertices.length * 3, radius * (branch ? .58 : 1), 5, false), material));
        }
      });
      this.lightning.add(fork);
    }
    this.cloudGlow = new T.Mesh(new T.PlaneGeometry(15, 8), new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
      uniforms: { tint: { value: new T.Color(p.ice) }, strength: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float strength;
        void main(){float halo=pow(max(0.,1.-length((vUv-.5)*2.)),2.);
          gl_FragColor=vec4(tint,halo*strength*.42);
          #include <colorspace_fragment>
        }`,
    }));
    this.materials.push(this.cloudGlow.material);
    this.cloudGlow.position.set(5.2, 13.4, -12.4); this.lightning.add(this.cloudGlow);
    this.lightningLight.color.set(p.ice); this.lightningLight.distance = 25; this.lightningLight.decay = 2;
    this.lightningLight.position.set(4, 8, -5); this.lightning.add(this.lightningLight);
    this.root.add(this.lightning);
    this.climate = new PaperClimateEffects(art, narrow); this.root.add(this.climate.root);

    const precipitation = new T.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: `attribute vec4 seed; uniform float time,kind,wind,density,fallSpeed,size;
        uniform vec2 viewSize; uniform mat4 viewToLocal; varying float strength,streak,flake;
        void main(){
          float sleet=step(3.5,kind)*(1.-step(4.5,kind));
          float leaf=step(4.5,kind);
          float snow=step(.5,kind)*(1.-step(1.5,kind))+sleet*step(.5,seed.w);
          float sand=step(1.5,kind)*(1.-step(2.5,kind));
          float hail=step(2.5,kind)*(1.-step(3.5,kind));
          streak=1.-max(max(snow,sand),max(hail,leaf));
          flake=snow;
          float speed=mix(1.25,.13,snow)*fallSpeed; speed=mix(speed,.22,sand);
          float fall=fract(seed.y+time*speed*(.6+seed.w*.4));
          vec3 volume=vec3((seed.x-.5)*viewSize.x,(.5-fall)*viewSize.y,(seed.z-.5)*38.);
          volume.x+=sin(time*.6+seed.y*30.)*snow*.65+fall*wind*3.;
          volume.x=mod(volume.x+viewSize.x*.5,viewSize.x)-viewSize.x*.5;
          vec3 p=(viewToLocal*vec4(volume,1.)).xyz;
          p.y=mix(p.y,.3+seed.z*5.+sin(seed.x*30.+time)*.4,sand);
          p.x=mix(p.x,(fract(seed.x+time*.1)-.5)*38.,sand);
          if(leaf>.5){p.x=(fract(seed.x+time*.017)-.5)*32.;p.y=1.+seed.y*5.+sin(time*.7+seed.z*20.)*.8;}
          if(sand+leaf>.5)p.z=(seed.z-.5)*18.-2.;
          if(hail>.5&&fall>.83)p.y=abs(sin((fall-.83)*37.))*.65;
          strength=.35+seed.w*.55;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
          gl_PointSize=clamp(mix(12.,4.2,snow+hail)*size*density,1.,30.);
        }`,
      fragmentShader: `uniform vec3 tint,snowTint; uniform float amount,kind; varying float strength,streak,flake;
        void main(){
          vec2 p=gl_PointCoord-.5;
          if(streak>.5){p.x+=p.y*.18; p.x*=7.;}
          if(kind>4.5){p=vec2(p.x+p.y,p.y-p.x);p.y*=2.;}
          float a=1.-smoothstep(.24,.5,length(p));
          gl_FragColor=vec4(mix(tint,snowTint,flake),a*strength*amount);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.materials.push(precipitation);
    this.particles = new T.Points(precipitationGeometry(narrow ? 850 : 1600), precipitation);
    this.particles.name = 'history-precipitation';
    this.particles.frustumCulled = false; this.root.add(this.particles);

    const cascadeGeometry = new T.PlaneGeometry(.07, .4);
    const cascadeMaterial = basic(p.snow, .65);
    for (let i = 0; i < 24; i++) {
      const spray = new T.Mesh(cascadeGeometry, cascadeMaterial); this.cascades.add(spray);
    }
    this.root.add(this.cascades);
    for (let i = 0; i < 9; i++) {
      const points = Array.from({ length: 41 }, (_, j) => {
        const a = j / 40 * Math.PI * 1.8;
        return new T.Vector3(Math.cos(a) * (.22 + i * .25), i * .72 + j / 40 * .32, Math.sin(a) * (.22 + i * .25));
      });
      const ring = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 48, .045 + i * .012, 4, false), basic(p.clay, .4));
      this.funnel.add(ring);
    }
    this.funnel.position.set(9, .3, -4); this.root.add(this.funnel);
    for (let i = 0; i < 3; i++) {
      const shape = new T.Shape(); shape.moveTo(-14, 0);
      for (let j = 0; j <= 60; j++) shape.lineTo(-14 + j * .5, Math.sin(j * .11 + i) * 1.3 + .6);
      for (let j = 60; j >= 0; j--) shape.lineTo(-14 + j * .5, Math.sin(j * .11 + i) * 1.3 - .5);
      const curtain = new T.Mesh(new T.ShapeGeometry(shape), basic([p.water, p.jade, p.heather][i], .35));
      curtain.position.set(0, 13.5 + i * .7, -19 - i); this.aurora.add(curtain);
    }
    this.root.add(this.aurora);

    // A bounded, small ravine uses the same normalized rock paths as /space.
    const vertices: number[] = [];
    const point = (t: number, side: number) => [side * (.35 + t * .7) + Math.sin(t * 5) * .55, (1 - t) ** 3 * 5 + .2, t * 9];
    for (let i = 0; i < 40; i++) {
      const a = i / 40, b = (i + 1) / 40;
      vertices.push(...point(a, -1), ...point(a, 1), ...point(b, -1), ...point(b, -1), ...point(a, 1), ...point(b, 1));
    }
    const mudGeometry = new T.BufferGeometry(); mudGeometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); mudGeometry.computeVertexNormals();
    const mudMaterial = new T.MeshStandardMaterial({ color: p.clay, roughness: .87, side: T.DoubleSide });
    const flowTime = this.uniforms.time;
    mudMaterial.onBeforeCompile = shader => {
      shader.uniforms.flowTime = flowTime;
      shader.vertexShader = `uniform float flowTime; ${WEATHER_NOISE_GLSL}\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y+=noise(vec3(position.x*2.,position.z-flowTime*1.5,0.))*.12;');
    };
    this.materials.push(mudMaterial); this.mud.add(new T.Mesh(mudGeometry, mudMaterial));
    const rockMaterial = new T.MeshStandardMaterial({ color: p.limestone, roughness: 1 }); this.materials.push(rockMaterial);
    this.rocks = new T.InstancedMesh(new T.IcosahedronGeometry(.16, 0), rockMaterial, 28);
    this.rocks.instanceMatrix.setUsage(T.DynamicDrawUsage); this.rocks.frustumCulled = false; this.mud.add(this.rocks);
    this.mud.position.set(-10.5, .3, -7); this.root.add(this.mud);
  }

  /** Fill the camera's frustum with a depth volume, including portrait and resized views. */
  fitView(camera: T.OrthographicCamera) {
    const width = (camera.right - camera.left) / camera.zoom;
    const height = (camera.top - camera.bottom) / camera.zoom;
    this.uniforms.viewSize.value.set(width + 2, height + 2);
    // The volume spans the sculptures and foreground. Depth testing still hides rain behind them.
    const depth = this.root.position.distanceTo(camera.position);
    this.uniforms.viewToLocal.value.copy(camera.matrixWorld);
    const elements = this.uniforms.viewToLocal.value.elements;
    elements[12] -= this.root.position.x + elements[8] * depth;
    elements[13] -= this.root.position.y + elements[9] * depth;
    elements[14] -= this.root.position.z + elements[10] * depth;
  }

  update(time: number, position: number, variation: number, animate: boolean, density: number, narrow: boolean) {
    time = Number.isFinite(time) ? Math.max(0, time) : 0;
    position = clampHistoryPosition(position);
    const p = this.art.palette;
    const weather = journeyWeather(position, variation);
    const light = historyDaylight(position);
    if (weather !== this.weather) { this.weather = weather; this.transition = 0; this.weatherStart = time; }
    this.transition = Math.min(1, this.transition + (animate ? Math.max(0, Math.min(.1, time - this.previousTime)) * 3 : 1));
    this.previousTime = time;
    const fade = this.transition;
    const x = position * HISTORY_SPACING;
    this.root.position.set(x, groundY(x), 0);
    const wet = ['storm', 'rain', 'drizzle', 'mudslide', 'sleet', 'sunshower', 'monsoon'].includes(weather);
    const thunder = weather === 'storm' || weather === 'monsoon';
    const snow = weather === 'snow' || weather === 'blizzard';
    const sand = weather === 'sandstorm' || weather === 'tornado';
    const breeze = weather === 'wind';
    const sunset = weather === 'sunset';
    const fog = weather === 'fog' || weather === 'sleet';
    this.uniforms.time.value = time;
    this.uniforms.density.value = Number.isFinite(density) ? Math.max(.5, Math.min(4, density)) : 1;
    this.uniforms.kind.value = snow ? 1 : sand ? 2 : weather === 'hail' ? 3 : weather === 'sleet' ? 4 : breeze ? 5 : 0;
    this.uniforms.wind.value = weather === 'blizzard' || sand ? 3 : weather === 'monsoon' ? 2.4 : thunder ? 1.8 : .5;
    this.uniforms.snowTint.value.set(p.snow);
    this.uniforms.tint.value.set(snow || weather === 'hail' ? p.snow : sand ? p.clay : breeze ? p.gold : p.water).lerp(new T.Color(p.ice), light.night * .7);
    this.uniforms.fallSpeed.value = weather === 'monsoon' ? 1.6 : weather === 'blizzard' ? 1.7 : weather === 'drizzle' ? .55 : 1;
    this.uniforms.size.value = weather === 'monsoon' ? 1.45 : weather === 'drizzle' ? .7 : weather === 'sunshower' ? .85 : 1;
    this.uniforms.amount.value = fade * (snow ? .85 : sand ? .32 : breeze ? .7 : weather === 'drizzle' ? .32 : thunder ? .8 : wet || weather === 'hail' ? .6 : 0);
    const count = this.particles.geometry.getAttribute('position').count;
    const proportion = weather === 'monsoon' || weather === 'blizzard' ? 1 : weather === 'storm' || weather === 'sandstorm' ? .75 : weather === 'drizzle' || weather === 'sunshower' ? .2 : .42;
    this.particles.geometry.setDrawRange(0, breeze ? 30 : Math.floor(count * proportion));
    this.particles.visible = this.uniforms.amount.value > 0;
    this.clouds.forEach((cloud, i) => {
      cloud.position.x = -15 + i * 6 + Math.sin(time * .035 + i) * 2;
      cloud.position.y = (narrow ? 12.5 : 7.7) + i % 3 * .85;
      const material = cloud.material as T.MeshBasicMaterial;
      material.color.set(sunset ? (i % 2 ? p.clay : p.vermilion) : thunder ? p.ink : wet && weather !== 'sunshower' ? p.ocean : snow ? p.ice : p.mist);
      material.color.lerp(new T.Color(p.ink), light.night * .72);
      if (!wet) material.color.lerp(new T.Color(p.clay), light.twilight * .35);
      material.opacity = (weather === 'clear' || weather === 'heatHaze' ? .08 : sunset ? .42 + i % 3 * .07 : thunder ? .55 : wet ? .3 : .26) * fade;
      cloud.scale.y = thunder ? 2.1 : sunset ? 1.4 : 1;
    });
    this.mist.forEach((band, i) => {
      band.position.x = (i % 2 - .5) * 8 + Math.sin(time * .09 + i) * 3;
      (band.material as T.MeshBasicMaterial).opacity = (fog ? .36 : snow ? .12 : .04) * fade;
    });
    this.rainbow.children.forEach(arc => { ((arc as T.Mesh).material as T.MeshBasicMaterial).opacity = .55 * light.daylight; });
    const rainbowDays = new Set(historyWindow(position).filter(day => journeyWeather(day, variation) === 'rainbow'));
    for (const [day, rainbow] of this.rainbows) if (!rainbowDays.has(day)) {
      rainbow.removeFromParent(); this.rainbows.delete(day);
    }
    for (const day of rainbowDays) {
      let rainbow = this.rainbows.get(day);
      if (!rainbow) {
        rainbow = this.rainbow.clone(); rainbow.name = `rainbow-${HISTORY_PLACES[day].date}`;
        this.rainbows.set(day, rainbow); this.root.add(rainbow);
      }
      // Cancel the atmosphere's camera-following translation; do not move the landscape with the walker.
      const anchorX = day * HISTORY_SPACING;
      rainbow.position.set(anchorX + 2 - x, groundY(anchorX) + 3 - groundY(x), -13);
    }
    const nearest = Math.round(position), anchorX = nearest * HISTORY_SPACING;
    const anchorY = groundY(anchorX) - groundY(x);
    const flash = thunder ? historyLightningPulse(time - this.weatherStart, nearest, animate) * fade : 0;
    this.lightningCore.opacity = flash; this.lightningGlow.opacity = flash * .18;
    this.cloudGlow.material.uniforms.strength.value = flash;
    this.lightningLight.intensity = flash * 42;
    this.lightning.visible = flash > .01;
    this.lightning.children.slice(0, 3).forEach((fork, i) => { fork.visible = i === nearest % 3; });
    this.lightning.position.set(anchorX - x, anchorY + (narrow ? 0 : -3), 0);
    this.funnel.visible = weather === 'tornado'; this.funnel.rotation.y = time * -.55;
    this.funnel.position.set(anchorX + 9 - x, anchorY + .3, -4);
    this.aurora.visible = weather === 'aurora' && light.night > .01;
    this.aurora.children.forEach((curtain, i) => {
      curtain.position.y = (narrow ? 13.5 : 8.7) + i * .7; curtain.scale.y = 1 + Math.sin(time * .2 + i) * .18;
      ((curtain as T.Mesh).material as T.MeshBasicMaterial).opacity = .35 * light.night;
    });
    const fjord = [nearest, nearest - 1, nearest + 1].find(i => HISTORY_LANDFORMS[i] === 'fjord' && Math.abs(position - i) < 1);
    this.cascades.visible = fjord !== undefined;
    if (fjord !== undefined) this.cascades.position.set((fjord - position) * HISTORY_SPACING, groundY(fjord * HISTORY_SPACING) - groundY(x), 0);
    this.cascades.children.forEach((spray, i) => {
      const t = (time * .26 + i * .618) % 1, side = i < 12 ? -1 : 1;
      const top = side < 0 ? 7.67 : 8.77, strand = i % 3, cliffX = side * 9.3;
      const points = [[cliffX - .17 + strand * .16, top, -6.63], [cliffX - .15 + strand * .18, top * .68, -5.96],
        [cliffX - .1 + strand * .14, 2.3, -5.63], [cliffX + strand * .11, .22, -5.43]];
      const segment = Math.min(2, Math.floor(t * 3)), fraction = t * 3 - segment;
      const from = points[segment], to = points[segment + 1];
      spray.position.set(T.MathUtils.lerp(from[0], to[0], fraction), T.MathUtils.lerp(from[1], to[1], fraction), T.MathUtils.lerp(from[2], to[2], fraction));
    });
    this.mud.visible = weather === 'mudslide';
    this.mud.position.set(anchorX - 10.5 - x, anchorY + .3, -7);
    if (this.mud.visible) {
      for (let i = 0; i < this.rocks.count; i++) {
        const point = debrisFlowSample(i, time * 1.5);
        this.matrix.position.set(point.x * 2.6, point.y * 5 + .3, point.z * 9);
        this.matrix.rotation.set(time + i, i * 2, time * .7);
        this.matrix.scale.setScalar(.6 + i % 4 * .2); this.matrix.updateMatrix();
        this.rocks.setMatrixAt(i, this.matrix.matrix);
      }
      this.rocks.instanceMatrix.needsUpdate = true;
    }
    this.climate.update(time, position, weather, animate, density, narrow);
    this.climate.root.position.sub(this.root.position);
    return weather;
  }

  dispose() {
    this.climate.dispose(); this.lightningLight.dispose();
    this.root.removeFromParent();
    const geometries = new Set<T.BufferGeometry>();
    const collect = (object: T.Object3D) => { if (object instanceof T.Mesh || object instanceof T.Points || object instanceof T.Line) geometries.add(object.geometry); };
    this.root.traverse(collect); this.rainbow.traverse(collect);
    geometries.forEach(geometry => geometry.dispose()); this.rainbows.clear();
    this.rocks.dispose(); this.materials.forEach(material => material.dispose());
  }
}
