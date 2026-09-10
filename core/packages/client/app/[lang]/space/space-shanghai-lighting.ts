import * as THREE from 'three';

type Crown = { height: number; depth: number; width: number };
type Triple = [number, number, number];
type Lamp = { position: Triple; target: Triple; color: Triple; intensity: number; angle: number; penumbra: number; distance: number };
type FrontageData = { width: number; height: number; crown?: Crown; centre?: Triple; washTop?: number; lamps?: Lamp[] };
type Frontage = Omit<FrontageData, 'centre'> & { building: THREE.Object3D; centre: THREE.Vector3; id: number };

const triple = (value: unknown): value is Triple => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
function validateRig(data: FrontageData) {
  if (data.centre !== undefined && !triple(data.centre)) throw new Error('Invalid Blender facade light centre');
  if (data.washTop !== undefined && (!Number.isFinite(data.washTop) || data.washTop < 0)) throw new Error('Invalid Blender facade wash height');
  if (data.lamps === undefined) return;
  if (!Array.isArray(data.lamps) || data.lamps.length !== 6 || !data.lamps.every(lamp => lamp &&
    triple(lamp.position) && triple(lamp.target) && lamp.position.some((v, i) => Math.abs(v - lamp.target[i]) > .00001) &&
    triple(lamp.color) && lamp.color.every(v => v >= 0 && v <= 1) &&
    Number.isFinite(lamp.intensity) && lamp.intensity >= 0 &&
    Number.isFinite(lamp.angle) && lamp.angle > 0 && lamp.angle <= Math.PI / 2 &&
    Number.isFinite(lamp.penumbra) && lamp.penumbra >= 0 && lamp.penumbra <= 1 &&
    Number.isFinite(lamp.distance) && lamp.distance > .3)) throw new Error('Invalid Blender facade light rig');
}

// A fixed pool follows the inspected frontage. Light positions stay attached to
// the building, never to the camera. Distant elevations retain their cheaper wash.
export class ShanghaiFacadeLighting {
  readonly root = new THREE.Group();
  readonly active = { value: new THREE.Vector2(-1, 0) };
  readonly lights = Array.from({ length: 6 }, () => new THREE.SpotLight(0xffdbaf, 0, 100, Math.PI * .29, .8, 2));
  private frontages: Frontage[] = [];
  private selected: Frontage | undefined;
  private direction = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private lastNight = -1;
  private initialized = false;
  transitioning = false;

  constructor(narrow: boolean) {
    this.root.name = 'Bund facade light pool';
    for (const light of this.lights) {
      light.castShadow = true;
      light.shadow.mapSize.setScalar(narrow ? 512 : 1024);
      light.shadow.camera.near = .3;
      light.shadow.normalBias = .04;
      light.shadow.bias = -.00007;
      light.shadow.autoUpdate = false;
      // PCF uses depth-comparison samplers even at zero light intensity.
      // Populate every map once before leaving the pool dormant in far views.
      light.shadow.needsUpdate = true;
      light.target.position.set(0, 1, 0);
      this.root.add(light, light.target);
    }
  }

  register(root: THREE.Object3D) {
    root.updateWorldMatrix(true, true);
    this.frontages = [];
    this.selected = undefined;
    this.initialized = false;
    this.transitioning = false;
    this.active.value.set(-1, 0);
    this.lights.forEach(light => { light.intensity = 0; });
    root.traverse(building => {
      const frontage = building.userData.facadeLighting as FrontageData | undefined;
      if (!frontage || !Number.isFinite(frontage.width) || !Number.isFinite(frontage.height) || frontage.width <= 0 || frontage.height <= 0) return;
      validateRig(frontage);
      const id = this.frontages.length + 1;
      const crown = frontage.crown && Object.values(frontage.crown).every(Number.isFinite) && frontage.crown.width > 0 && frontage.crown.height > frontage.height ? frontage.crown : undefined;
      building.traverse(mesh => {
        if (!(mesh instanceof THREE.Mesh) || Array.isArray(mesh.material) || !(mesh.material.userData.bundStone || mesh.material.userData.bundRoof)) return;
        if (mesh.material.userData.bundRoof && !crown) return;
        const count = mesh.geometry.getAttribute('position').count;
        mesh.geometry.setAttribute('bundBuildingId', new THREE.Float32BufferAttribute(new Float32Array(count).fill(id), 1));
        // The facade pool does not reach independent high clock towers.
        mesh.geometry.setAttribute('bundLightTop', new THREE.Float32BufferAttribute(new Float32Array(count).fill(frontage.washTop ?? (crown ? crown.height + 6 : frontage.height)), 1));
      });
      this.frontages.push({ building, ...frontage, crown, id, centre: building.localToWorld(new THREE.Vector3(...(frontage.centre ?? [0, frontage.height / 2, 0]))) });
    });
  }

  update(camera: THREE.Camera, night: number, deltaSeconds = 0) {
    night = Number.isFinite(night) ? THREE.MathUtils.clamp(night, 0, 1) : 0;
    camera.getWorldDirection(this.direction);
    let selected: Frontage | undefined, best = Infinity;
    for (const frontage of this.frontages) {
      this.offset.copy(frontage.centre).sub(camera.position);
      const distance = this.offset.length(), facing = this.offset.normalize().dot(this.direction);
      // Ignore buildings behind the viewer and high-altitude overview cameras.
      if (distance > 320 || facing < .35) continue;
      // Aim takes priority over a closer neighbour at the edge of the image.
      const score = distance * (1 + 8 * (1 - facing));
      if (score < best) { best = score; selected = frontage; }
    }
    // Hysteresis prevents adjacent frontages alternating at their bisector.
    if (this.selected && selected && selected !== this.selected) {
      this.offset.copy(this.selected.centre).sub(camera.position);
      const distance = this.offset.length(), facing = this.offset.normalize().dot(this.direction);
      if (distance < 320 && facing > .35 && distance * (1 + 8 * (1 - facing)) < best * 1.15) selected = this.selected;
    }
    const desired = selected;
    const desiredBlend = desired ? 1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(desired.centre), 150, 320) : 0;
    let blend = this.active.value.y;
    if (!this.initialized || night === 0) {
      // Initial compilation and daylight need no visible light handoff.
      blend = desiredBlend;
      this.initialized = true;
    } else {
      // Restore the outgoing wall's distant wash before moving the light pool.
      // Both the real lamps and the shader wash use this same weight, so neither
      // the wall nor the crown jumps when the selected building ID changes.
      const target = desired === this.selected ? desiredBlend : 0;
      const step = (Number.isFinite(deltaSeconds) ? THREE.MathUtils.clamp(deltaSeconds, 0, .1) : 0) / .3;
      blend += THREE.MathUtils.clamp(target - blend, -step, step);
      if (blend < .000001) blend = 0;
      if (selected !== this.selected && blend > 0) selected = this.selected;
    }
    this.transitioning = selected !== desired || Math.abs(blend - desiredBlend) > .000001;
    let shadowChanged = false;
    if (selected !== this.selected) {
      this.selected = selected;
      if (selected) {
        const { building, width, height, crown, lamps } = selected;
        for (let i = 0; i < this.lights.length; i++) {
          const light = this.lights[i], x = width * ((i + .5) / 4 - .5);
          const roof = i >= 4 && crown;
          // Street-pole facade wash and independent roof-mounted crown lights.
          light.position.copy(building.localToWorld(roof ? new THREE.Vector3((i === 4 ? -1 : 1) * crown.width, height + 3.6, -9) : new THREE.Vector3(x, 5.5, -12)));
          light.target.position.copy(building.localToWorld(roof ? new THREE.Vector3(0, crown.height, crown.depth) : new THREE.Vector3(x, height * .65, .5)));
          light.distance = roof ? 45 : Math.max(65, height * 2.2);
          light.angle = Math.PI * (roof ? .22 : .29);
          light.color.set(0xffdbaf); light.penumbra = .8;
          if (lamps) {
            const lamp = lamps[i];
            light.position.copy(building.localToWorld(new THREE.Vector3(...lamp.position)));
            light.target.position.copy(building.localToWorld(new THREE.Vector3(...lamp.target)));
            light.color.setRGB(...lamp.color, THREE.LinearSRGBColorSpace);
            light.distance = lamp.distance; light.angle = lamp.angle; light.penumbra = lamp.penumbra;
          }
          light.shadow.camera.far = light.distance;
          light.shadow.camera.updateProjectionMatrix();
          light.shadow.needsUpdate = true;
        }
        shadowChanged = true;
      }
    }
    this.active.value.set(selected?.id ?? -1, blend);
    // Calibrated against the HSBC frontage; smaller facades need less power.
    const facadePower = selected ? 1050 * THREE.MathUtils.clamp(selected.width * selected.height / (83.45 * 29.4), .12, 1.25) : 0;
    this.lights.forEach((light, i) => { light.intensity = night * blend * (selected?.lamps?.[i].intensity ?? (i < 4 ? facadePower : selected?.crown ? 1300 : 0)); });
    // Maps are static between frontage changes. Enabling night after daylight
    // must also populate them, including when weather motion is paused.
    if (night > 0 && this.lastNight <= 0 && selected) {
      this.lights.forEach(light => { light.shadow.needsUpdate = true; });
      shadowChanged = true;
    }
    this.lastNight = night;
    return shadowChanged;
  }

  dispose() {
    this.lights.forEach(light => light.shadow.dispose());
    this.frontages = []; this.selected = undefined; this.root.clear(); this.root.removeFromParent();
  }
}
