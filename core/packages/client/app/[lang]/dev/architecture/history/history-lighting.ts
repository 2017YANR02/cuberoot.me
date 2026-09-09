import * as T from 'three';
import { groundY, historyDaylight, type JourneyWeather } from './history-environment';
import { HISTORY_SPACING } from './history-days';
import type { PaperPalette } from './history-scenery';

// Cover softens direct light; the small pigment wash keeps the paper and ink readable.
const WEATHER_LIGHT = {
  clear: { cover: .03, tint: 'paper', wash: 0 },
  cloudy: { cover: .1, tint: 'mist', wash: .025 },
  wind: { cover: .08, tint: 'paper', wash: 0 },
  rainbow: { cover: .14, tint: 'paper', wash: .02 },
  sunshower: { cover: .24, tint: 'gold', wash: .065 },
  drizzle: { cover: .38, tint: 'ice', wash: .08 },
  rain: { cover: .68, tint: 'ocean', wash: .14 },
  storm: { cover: .94, tint: 'ocean', wash: .25 },
  monsoon: { cover: .98, tint: 'ocean', wash: .29 },
  mudslide: { cover: .7, tint: 'clay', wash: .09 },
  fog: { cover: .66, tint: 'mist', wash: .16 },
  seaFog: { cover: .8, tint: 'ice', wash: .27 },
  frost: { cover: .29, tint: 'ice', wash: .2 },
  diamondDust: { cover: .09, tint: 'ice', wash: .11 },
  snow: { cover: .39, tint: 'snow', wash: .18 },
  blizzard: { cover: .84, tint: 'ice', wash: .2 },
  sleet: { cover: .72, tint: 'ice', wash: .18 },
  hail: { cover: .79, tint: 'ocean', wash: .15 },
  aurora: { cover: .06, tint: 'ice', wash: .045 },
  sandstorm: { cover: .79, tint: 'sand', wash: .28 },
  tornado: { cover: .61, tint: 'clay', wash: .19 },
  heatHaze: { cover: .19, tint: 'sand', wash: .23 },
  sunset: { cover: .16, tint: 'clay', wash: .12 },
  pollen: { cover: .08, tint: 'gold', wash: .07 },
} satisfies Record<JourneyWeather, { cover: number; tint: keyof PaperPalette; wash: number }>;

/** A small paper sky, with no HDR texture, postprocessing or additional shadow maps. */
export class PaperLighting {
  readonly root = new T.Group();
  readonly ambient: T.HemisphereLight;
  readonly sun: T.DirectionalLight;
  private readonly sky: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
  private readonly disc: T.Mesh<T.CircleGeometry, T.MeshBasicMaterial>;
  private readonly halo: T.Mesh<T.CircleGeometry, T.MeshBasicMaterial>;
  private readonly moon: T.Mesh<T.ShapeGeometry, T.MeshBasicMaterial>;
  private readonly stars: T.Points<T.BufferGeometry, T.ShaderMaterial>;
  private readonly paper: T.Color;
  private readonly ink: T.Color;
  private readonly ice: T.Color;
  private readonly gold: T.Color;
  private readonly clay: T.Color;
  private readonly nightColor: T.Color;
  private readonly dawnColor: T.Color;
  private readonly duskColor: T.Color;
  private readonly color = new T.Color();
  private readonly weatherColor = new T.Color();
  private readonly direction = new T.Vector3();

  get horizonColor(): T.Color { return this.sky.material.uniforms.horizon.value; }

  constructor(private readonly palette: PaperPalette, nightColor: string) {
    const p = palette;
    this.paper = new T.Color(p.paper); this.ink = new T.Color(p.ink);
    this.ice = new T.Color(p.ice); this.gold = new T.Color(p.gold);
    this.clay = new T.Color(p.clay); this.nightColor = new T.Color(nightColor);
    this.dawnColor = new T.Color(p.paper).lerp(this.gold, .35);
    this.duskColor = new T.Color(p.clay).lerp(new T.Color(p.vermilion), .3);
    this.ambient = new T.HemisphereLight(p.paper, p.forest, 2.15);
    this.sun = new T.DirectionalLight(p.paper, 3.1);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -34, right: 34, top: 29, bottom: -29, near: 1, far: 100 });
    this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .025; this.sun.shadow.radius = 3;

    this.sky = new T.Mesh(new T.PlaneGeometry(240, 100), new T.ShaderMaterial({
      depthWrite: false,
      uniforms: { zenith: { value: new T.Color() }, horizon: { value: new T.Color() } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 zenith,horizon; varying vec2 vUv;
        void main(){gl_FragColor=vec4(mix(horizon,zenith,smoothstep(.25,.67,vUv.y)),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.position.set(0, 10, -40); this.sky.renderOrder = -10;
    const basic = (color: string, opacity = 1) => new T.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false });
    this.disc = new T.Mesh(new T.CircleGeometry(1.15, 64), basic(p.gold));
    this.halo = new T.Mesh(new T.CircleGeometry(1.65, 64), basic(p.gold, .1));
    const crescent = new T.Shape();
    crescent.moveTo(.55, 1.08);
    crescent.bezierCurveTo(-1.8, 1.25, -1.8, -1.45, .55, -1.08);
    crescent.bezierCurveTo(-.5, -.75, -.5, .72, .55, 1.08);
    this.moon = new T.Mesh(new T.ShapeGeometry(crescent, 48), basic(p.paper));
    this.disc.name = 'history-sun'; this.moon.name = 'history-moon';
    const positions: number[] = [], seeds: number[] = [];
    for (let i = 0; i < 96; i++) {
      positions.push(((i * .61803398875) % 1 - .5) * 2, .46 + (i * .41421356237 % 1) * .51, 0);
      seeds.push(i * 2.399);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new T.Float32BufferAttribute(seeds, 1));
    this.stars = new T.Points(geometry, new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, opacity: { value: 0 }, density: { value: 1 }, tint: { value: this.paper } },
      vertexShader: `attribute float seed; uniform float time,density; varying float shimmer;
        void main(){shimmer=.65+.35*sin(seed+time*.45); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=(1.5+mod(seed,1.5))*density;}`,
      fragmentShader: `uniform float opacity; uniform vec3 tint; varying float shimmer;
        void main(){float d=length(gl_PointCoord-.5); gl_FragColor=vec4(tint,(1.-smoothstep(.08,.5,d))*opacity*shimmer);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.stars.name = 'history-stars';
    this.root.add(this.sky, this.stars, this.halo, this.disc, this.moon);
  }

  update(position: number, time: number, weather: JourneyWeather, camera: T.OrthographicCamera, narrow: boolean, density: number) {
    const light = historyDaylight(position);
    const { daylight, twilight, night, angle } = light;
    const x = position * HISTORY_SPACING, y = groundY(x);
    const climate = WEATHER_LIGHT[weather], overcast = climate.cover;
    this.weatherColor.set(this.palette[climate.tint]);
    // At midnight the palette returns to moonlit paper; weather never resets the solar cycle.
    const wash = climate.wash * (.22 + daylight * .78);
    const twilightColor = light.hour < 12 ? this.dawnColor : this.duskColor;
    this.root.position.set(x, y, 0);
    this.sky.material.uniforms.zenith.value.copy(this.nightColor).lerp(this.paper, daylight).lerp(twilightColor, twilight * .6).lerp(this.weatherColor, wash);
    this.sky.material.uniforms.horizon.value.copy(this.nightColor).lerp(this.ice, .13).lerp(this.paper, daylight).lerp(twilightColor, twilight * .85).lerp(this.weatherColor, wash * .7);
    this.ambient.color.copy(this.nightColor).lerp(this.ice, .7).lerp(this.paper, daylight);
    this.ambient.color.lerp(this.weatherColor, wash * .24);
    this.ambient.groundColor.set(this.palette.forest).lerp(this.nightColor, night);
    this.ambient.intensity = .9 + daylight * (1.25 - overcast * .12);
    this.sun.color.copy(this.ice).lerp(this.nightColor, night * .2).lerp(this.paper, daylight).lerp(twilightColor, twilight * .65);
    this.sun.color.lerp(this.weatherColor, wash * .36);
    this.sun.intensity = (.62 + daylight * 2.48) * (1 - overcast * .38);
    // The same shadow light becomes soft moonlight at night, keeping the sculpture legible.
    const solarX = -Math.cos(angle) * 21;
    this.sun.position.set(x + T.MathUtils.lerp(solarX, -14, night), y + 23 + Math.max(0, Math.sin(angle)) * 12, 13);
    this.sun.target.position.set(x, y, -1);
    // A distant sky follows the orthographic framing, behind world-anchored terrain and rainbows.
    camera.getWorldDirection(this.direction);
    const skyPoint = (target: T.Vector3, sx: number, sy: number) => {
      target.set(sx, sy, .5).unproject(camera);
      target.addScaledVector(this.direction, (-34 - target.z) / this.direction.z).sub(this.root.position);
    };
    skyPoint(this.disc.position, .38 - Math.cos(angle) * .18, .82 + Math.max(0, Math.sin(angle)) * .04);
    this.disc.material.color.copy(this.gold).lerp(this.clay, twilight * .7);
    this.disc.material.opacity = daylight * (1 - overcast);
    this.disc.visible = this.disc.material.opacity > .01;
    this.halo.position.copy(this.disc.position); this.halo.position.z -= .02;
    this.halo.material.color.copy(this.disc.material.color); this.halo.material.opacity = this.disc.material.opacity * .1;
    this.halo.visible = this.disc.visible;
    skyPoint(this.moon.position, narrow ? .55 : .45, .83);
    this.moon.material.opacity = night * (1 - overcast * .55); this.moon.visible = night > .01;
    for (const body of [this.disc, this.halo, this.moon]) body.quaternion.copy(camera.quaternion);
    skyPoint(this.stars.position, 0, 0);
    this.stars.quaternion.copy(camera.quaternion);
    this.stars.scale.set((camera.right - camera.left) / 2, (camera.top - camera.bottom) / 2, 1);
    this.stars.material.uniforms.time.value = time;
    this.stars.material.uniforms.opacity.value = night * (1 - overcast);
    this.stars.material.uniforms.density.value = density;
    this.stars.visible = night > .01;
    return light;
  }

  skyInk(daylight: number) { return this.color.copy(this.paper).lerp(this.ink, daylight).getStyle(); }

  dispose() {
    this.root.removeFromParent(); this.ambient.removeFromParent(); this.sun.removeFromParent(); this.sun.target.removeFromParent();
    this.root.traverse(object => {
      if (object instanceof T.Mesh || object instanceof T.Points) { object.geometry.dispose(); object.material.dispose(); }
    });
    this.sun.dispose();
  }
}
