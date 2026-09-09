import * as THREE from 'three';

type Crown = { height: number; depth: number; width: number };
type Frontage = { building: THREE.Object3D; width: number; height: number; crown?: Crown; centre: THREE.Vector3; id: number };

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
    root.traverse(building => {
      const frontage = building.userData.facadeLighting as { width: number; height: number; crown?: Crown } | undefined;
      if (!frontage || !Number.isFinite(frontage.width) || !Number.isFinite(frontage.height) || frontage.width <= 0 || frontage.height <= 0) return;
      const id = this.frontages.length + 1;
      const crown = frontage.crown && Object.values(frontage.crown).every(Number.isFinite) && frontage.crown.width > 0 && frontage.crown.height > frontage.height ? frontage.crown : undefined;
      building.traverse(mesh => {
        if (!(mesh instanceof THREE.Mesh) || Array.isArray(mesh.material) || !(mesh.material.userData.bundStone || mesh.material.userData.bundRoof)) return;
        if (mesh.material.userData.bundRoof && !crown) return;
        const count = mesh.geometry.getAttribute('position').count;
        mesh.geometry.setAttribute('bundBuildingId', new THREE.Float32BufferAttribute(new Float32Array(count).fill(id), 1));
        // The facade pool does not reach independent high clock towers.
        mesh.geometry.setAttribute('bundLightTop', new THREE.Float32BufferAttribute(new Float32Array(count).fill(crown ? crown.height + 6 : frontage.height), 1));
      });
      this.frontages.push({ building, ...frontage, crown, id, centre: building.localToWorld(new THREE.Vector3(0, frontage.height / 2, 0)) });
    });
  }

  update(camera: THREE.Camera, night: number) {
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
    let shadowChanged = false;
    if (selected !== this.selected) {
      this.selected = selected;
      if (selected) {
        const { building, width, height, crown } = selected;
        for (let i = 0; i < this.lights.length; i++) {
          const light = this.lights[i], x = width * ((i + .5) / 4 - .5);
          const roof = i >= 4 && crown;
          // Street-pole facade wash and independent roof-mounted crown lights.
          light.position.copy(building.localToWorld(roof ? new THREE.Vector3((i === 4 ? -1 : 1) * crown.width, height + 3.6, -9) : new THREE.Vector3(x, 5.5, -12)));
          light.target.position.copy(building.localToWorld(roof ? new THREE.Vector3(0, crown.height, crown.depth) : new THREE.Vector3(x, height * .65, .5)));
          light.distance = roof ? 45 : Math.max(65, height * 2.2);
          light.angle = Math.PI * (roof ? .22 : .29);
          light.shadow.camera.far = light.distance;
          light.shadow.camera.updateProjectionMatrix();
          light.shadow.needsUpdate = true;
        }
        shadowChanged = true;
      }
    }
    const blend = selected ? 1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(selected.centre), 150, 320) : 0;
    this.active.value.set(selected?.id ?? -1, blend);
    // Calibrated against the HSBC frontage; smaller facades need less power.
    const facadePower = selected ? 1050 * THREE.MathUtils.clamp(selected.width * selected.height / (83.45 * 29.4), .12, 1.25) : 0;
    this.lights.forEach((light, i) => { light.intensity = night * blend * (i < 4 ? facadePower : selected?.crown ? 1300 : 0); });
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
