import * as T from 'three';
import { HISTORY_LAST, HISTORY_SPACING, historyWindow } from './history-days';
import { groundY, pathZ } from './history-environment';
import type { PaperScenery } from './history-scenery';

export interface HistoryPlayScore { lights: number; score: number; combo: number; flips: number; status: 'cruise' | 'boost' | 'stumble' }
export const EMPTY_HISTORY_SCORE: HistoryPlayScore = { lights: 0, score: 0, combo: 0, flips: 0, status: 'cruise' };

/** Three sparse lights per passage, fixed to the landscape rather than the camera. */
export function historyLight(day: number, slot: number) {
  return { id: day * 3 + slot, x: (day + .3 + slot * .2) * HISTORY_SPACING - 1.5, height: [2, 3.1, 2.2][slot] };
}

/** Explicit travel alone advances play. Seeking and paused frames cannot earn points. */
export class HistoryPlay {
  height = 0;
  landing = 0;
  rotation = 0;
  private holding = false;
  private gliding = false;
  private airtime = 0;
  private boostTime = 0;
  private stumbleTime = 0;
  private velocity = 0;
  private jumps = 0;
  private comboTime = 0;
  readonly collected = new Set<number>();
  score: HistoryPlayScore = { ...EMPTY_HISTORY_SCORE };

  get speedFactor() { return this.stumbleTime > 0 ? .38 : this.boostTime > 0 ? 1.15 : 1; }
  get boost() { return Math.min(1, this.boostTime); }
  get stumble() { return Math.min(1, this.stumbleTime); }
  hold(enabled: boolean) { this.holding = enabled && this.gliding; }
  setGliding(enabled: boolean) {
    this.gliding = enabled;
    if (!enabled) { this.holding = false; this.rotation = this.boostTime = this.stumbleTime = 0; this.setStatus('cruise'); }
  }
  private setStatus(status: HistoryPlayScore['status']) {
    if (this.score.status !== status) this.score = { ...this.score, status };
  }

  jump() {
    if (this.jumps >= 2 || this.stumbleTime > 0) return false;
    if (!this.jumps) this.airtime = this.rotation = 0;
    this.velocity = this.jumps === 0 ? 9.6 : 7.8;
    this.jumps++;
    this.landing = 0;
    return true;
  }

  seek() {
    this.height = this.velocity = this.jumps = this.landing = this.comboTime = 0;
    this.rotation = this.airtime = this.boostTime = this.stumbleTime = 0;
    this.holding = false;
    this.score = { ...this.score, combo: 0, status: 'cruise' };
  }

  reset() { this.seek(); this.collected.clear(); this.score = { ...EMPTY_HISTORY_SCORE }; }

  step(seconds: number, from: number, to: number, narrow = false) {
    if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(from) || !Number.isFinite(to)) return;
    const dt = Math.min(.08, seconds), previousHeight = this.height;
    this.boostTime = Math.max(0, this.boostTime - dt);
    this.stumbleTime = Math.max(0, this.stumbleTime - dt);
    this.setStatus(this.stumbleTime > 0 ? 'stumble' : this.boostTime > 0 ? 'boost' : 'cruise');
    this.landing = Math.max(0, this.landing - dt * 3.5);
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (!this.comboTime && this.score.combo) this.score = { ...this.score, combo: 0 };
    if (this.jumps) {
      this.airtime += dt;
      // A tap remains a jump. Holding turns the board; release near upright to land.
      if (this.gliding && this.holding && this.airtime > .16) this.rotation += dt * 9;
      if (!this.holding) {
        const upright = Math.round(this.rotation / (Math.PI * 2)) * Math.PI * 2;
        if (Math.abs(upright - this.rotation) < 1.05) this.rotation += (upright - this.rotation) * (1 - Math.exp(-dt * 18));
      }
      this.height = Math.max(0, this.height + this.velocity * dt - 9 * dt * dt);
      this.velocity -= 18 * dt;
      if (this.height === 0) {
        const turns = Math.round(this.rotation / (Math.PI * 2));
        const upright = Math.abs(this.rotation - turns * Math.PI * 2) < 1.05;
        if (this.gliding && this.rotation > .1 && !upright) {
          this.stumbleTime = 1.15; this.boostTime = 0;
          this.score = { ...this.score, combo: 0, status: 'stumble' };
        } else if (turns > 0) {
          this.boostTime = 2.4;
          this.score = { ...this.score, flips: this.score.flips + turns, score: this.score.score + 100 * turns, status: 'boost' };
        }
        this.rotation = this.velocity = this.jumps = this.airtime = 0; this.holding = false; this.landing = 1;
      }
    }
    const distance = to - from;
    // A seek is discontinuous; even a caller mistake must not collect an entire map.
    if (distance <= 0 || distance > 4) return;
    const first = Math.max(0, Math.floor((from + 1.5) / HISTORY_SPACING));
    const last = Math.min(HISTORY_LAST - 1, Math.floor((to + 1.5) / HISTORY_SPACING));
    const scale = narrow ? 1.4 : 1;
    for (let day = first; day <= last; day++) for (let slot = 0; slot < 3; slot++) {
      const light = historyLight(day, slot);
      if (this.collected.has(light.id) || light.x < from - .65 || light.x > to + .65) continue;
      const fraction = T.MathUtils.clamp((light.x - from) / distance, 0, 1);
      const altitude = previousHeight + (this.height - previousHeight) * fraction;
      if (altitude < .25 || Math.abs(altitude + scale * 1.05 - light.height * scale) > .8 * scale) continue;
      this.collected.add(light.id);
      const combo = this.score.combo + 1;
      this.score = { ...this.score, lights: this.score.lights + 1, score: this.score.score + 10 * Math.min(5, combo), combo };
      this.comboTime = 3.5;
    }
  }
}

/** A fixed mesh pool keeps GPU resources bounded throughout the 204-day journey. */
export class PaperJourneyPlay {
  readonly root = new T.Group();
  readonly game = new HistoryPlay();
  private readonly lights: T.Group[] = [];
  private readonly landing: T.Mesh;
  private readonly material: T.MeshBasicMaterial;
  private landingX = 0;
  private wasLanding = 0;

  constructor(art: PaperScenery) {
    this.root.name = 'history-play';
    for (let i = 0; i < 15; i++) {
      const light = new T.Group();
      const crystal = art.mesh(light, new T.OctahedronGeometry(.23), art.palette.gold);
      crystal.scale.y = 1.55;
      const halo = art.ring(light, .4, .012, [0, 0, 0], art.palette.gold);
      halo.rotation.x = Math.PI / 2;
      this.root.add(light); this.lights.push(light);
    }
    this.material = new T.MeshBasicMaterial({ color: art.palette.gold, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
    this.landing = new T.Mesh(new T.RingGeometry(.45, .49, 32), this.material);
    this.landing.rotation.x = -Math.PI / 2;
    this.landing.visible = false;
    this.root.add(this.landing);
  }

  update(time: number, position: number, narrow: boolean) {
    let i = 0;
    const scale = narrow ? 1.4 : 1;
    for (const day of historyWindow(position)) {
      if (day >= HISTORY_LAST) continue;
      for (let slot = 0; slot < 3; slot++) {
        const data = historyLight(day, slot), light = this.lights[i++];
        light.visible = !this.game.collected.has(data.id);
        light.position.set(data.x, groundY(data.x) + data.height * scale, pathZ(data.x) - .8);
        light.rotation.y = time * .8 + slot;
        light.scale.setScalar(scale);
      }
    }
    for (; i < this.lights.length; i++) this.lights[i].visible = false;
    if (this.game.landing > this.wasLanding) this.landingX = position * HISTORY_SPACING - 1.5;
    this.wasLanding = this.game.landing;
    this.landing.position.set(this.landingX, groundY(this.landingX) + .05, pathZ(this.landingX) - .8);
    this.landing.scale.setScalar(1 + (1 - this.game.landing) * 3);
    this.material.opacity = this.game.landing * .65;
    this.landing.visible = this.game.landing > 0;
  }

  dispose() { this.material.dispose(); }
}
