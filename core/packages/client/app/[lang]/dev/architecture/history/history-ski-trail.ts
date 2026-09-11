import * as T from 'three';
import { HISTORY_ENVIRONMENTS, groundY, pathZ, type JourneyWeather } from './history-environment';
import { clampHistoryPosition, HISTORY_SPACING, type HistoryGait } from './history-days';
import type { PaperPalette } from './history-scenery';

/** Surface response shares the landform and weather already displayed by the journey. */
export function skiSurface(position: number, weather: JourneyWeather): 'snow' | 'sand' | 'water' | 'paper' {
  const ground = HISTORY_ENVIRONMENTS[Math.round(clampHistoryPosition(position))].ground;
  if (['snow', 'blizzard', 'sleet', 'frost', 'diamondDust'].includes(weather) || ground === 'snow' || ground === 'ice') return 'snow';
  if (['rain', 'storm', 'drizzle', 'monsoon', 'sunshower', 'hail'].includes(weather)) return 'water';
  if (ground === 'sand' || weather === 'sandstorm') return 'sand';
  return 'paper';
}

const PARTICLES = 160, TRACKS = 256;
type Fleck = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number };
type Track = { x: number; y: number; z: number; pitch: number; yaw: number; length: number; age: number };

/** Bounded world-space pools: the skier leaves the spray and tracks behind. */
export class PaperSkiTrail {
  readonly root = new T.Group();
  private readonly powder: T.InstancedMesh;
  private readonly tracks: T.InstancedMesh;
  private readonly powderMaterial: T.MeshBasicMaterial;
  private readonly trackMaterial: T.MeshBasicMaterial;
  private readonly flecks: Fleck[] = [];
  private readonly marks: Track[] = [];
  private readonly dummy = new T.Object3D();
  private particleCursor = 0;
  private trackCursor = 0;
  private seed = 104729;
  private previousX: number | undefined;
  private previousTime = 0;
  private previousLanding = 0;
  private residue = 0;
  surface: ReturnType<typeof skiSurface> = 'paper';

  constructor(private readonly palette: PaperPalette) {
    this.root.name = 'history-ski-trail';
    this.powderMaterial = new T.MeshBasicMaterial({ color: palette.snow, transparent: true, opacity: .68, depthWrite: false });
    this.trackMaterial = new T.MeshBasicMaterial({ color: palette.paper, transparent: true, opacity: .48, depthWrite: false, side: T.DoubleSide });
    this.powder = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), this.powderMaterial, PARTICLES);
    this.tracks = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.trackMaterial, TRACKS);
    this.powder.name = 'ski-powder'; this.tracks.name = 'ski-tracks';
    for (const mesh of [this.powder, this.tracks]) {
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false;
      mesh.count = 0; this.root.add(mesh);
    }
  }

  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  clear() {
    this.flecks.length = this.marks.length = 0;
    this.particleCursor = this.trackCursor = this.residue = 0;
    this.powder.count = this.tracks.count = 0;
    this.previousX = undefined; this.previousLanding = 0;
  }

  private emit(x: number, scale: number, burst: boolean) {
    const side = this.random() * 2 - 1;
    const fleck: Fleck = {
      x: x - .65 * scale, y: groundY(x) + .13, z: pathZ(x) - .8 + side * .2,
      vx: -2.5 - this.random() * 5, vy: (burst ? 3 : 1.2) + this.random() * 2.4,
      vz: side * (burst ? 4 : 1.7), age: 0, life: .55 + this.random() * .65,
      size: (.055 + this.random() * .12) * scale * (burst ? 1.3 : 1),
    };
    const index = this.particleCursor++ % PARTICLES;
    this.flecks[index] = fleck;
    const color = new T.Color(this.palette[this.surface === 'paper' ? 'limestone' : this.surface]);
    color.lerp(new T.Color(this.palette.paper), this.random() * .35);
    this.powder.setColorAt(index, color);
  }

  update(time: number, position: number, narrow: boolean, gait: HistoryGait, height: number, landing: number, boost: number, weather: JourneyWeather) {
    const x = position * HISTORY_SPACING - 1.5, lastX = this.previousX ?? x;
    const elapsed = Math.min(.08, Math.max(0, time - this.previousTime));
    const distance = x - lastX;
    this.previousX = x; this.previousTime = time;
    this.surface = skiSurface(position, weather);
    // Explicit seeks must never draw a stripe across the map, or leave an old landing burst.
    if (Math.abs(distance) > 6 || distance < -.001) { this.clear(); this.previousX = x; return; }
    if (gait !== 'glide') { this.clear(); this.previousX = x; return; }
    const dt = distance > .00001 ? elapsed : 0;
    const scale = narrow ? 1.4 : 1;
    const landed = landing > this.previousLanding;
    this.previousLanding = landing;
    if (dt > 0 && height < .18) {
      this.residue += distance;
      while (this.residue >= .28) {
        this.residue -= .28;
        const markX = x - this.residue;
        this.emit(markX, scale, false);
        if (boost > .1) this.emit(markX, scale, false);
        const grade = (groundY(markX + .16) - groundY(markX - .16)) / .32;
        const bend = (pathZ(markX + .16) - pathZ(markX - .16)) / .32;
        for (const side of [-1, 1]) {
          const index = this.trackCursor++ % TRACKS;
          this.marks[index] = { x: markX - .7, y: groundY(markX - .7) + .035, z: pathZ(markX - .7) - .8 + side * .16 * scale, pitch: Math.atan(grade), yaw: -Math.atan(bend), length: .33 * Math.hypot(1, bend), age: 0 };
          this.tracks.setColorAt(index, new T.Color(this.palette[this.surface === 'sand' ? 'clay' : this.surface === 'water' ? 'ice' : 'snow']));
        }
      }
    } else if (height > .18) this.residue = 0;
    if (landed && dt > 0) for (let i = 0; i < 26; i++) this.emit(x, scale, true);
    this.flecks.forEach((p, i) => {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 6;
      this.dummy.position.set(p.x, Math.max(groundY(p.x) + .025, p.y), p.z);
      this.dummy.rotation.set(p.age * 2, i, p.age * 3);
      const size = Math.max(0, 1 - p.age / p.life) * p.size;
      this.dummy.scale.set(size, size * .65, size); this.dummy.updateMatrix(); this.powder.setMatrixAt(i, this.dummy.matrix);
    });
    this.marks.forEach((mark, i) => {
      mark.age += dt;
      this.dummy.position.set(mark.x, mark.y, mark.z);
      this.dummy.rotation.set(0, mark.yaw, mark.pitch, 'YXZ');
      this.dummy.scale.set(mark.length, 1, .035 * scale * Math.max(0, 1 - mark.age / 2.8));
      this.dummy.updateMatrix(); this.tracks.setMatrixAt(i, this.dummy.matrix);
    });
    for (const [mesh, count] of [[this.powder, this.flecks.length], [this.tracks, this.marks.length]] as const) {
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() { this.powderMaterial.dispose(); this.trackMaterial.dispose(); }
}
