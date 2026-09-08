import * as THREE from 'three';
import { createUniforms, updateFrameUniforms } from './core/SharedUniforms.js';
import { bakeProceduralTextures, bakeOceanTextures, disposeProceduralTextures } from './gfx/ProceduralTextures.js';
import { Atmosphere } from './sky/Atmosphere.js';
import { Clouds } from './sky/Clouds.js';
import { SkyRenderer } from './sky/SkyRenderer.js';
import { Weather } from './weather/Weather.js';
import { Rain, Spray } from './weather/Precipitation.js';
import { Lightning } from './weather/Lightning.js';
import { Waterspout } from './weather/Waterspout.js';

import { OceanFFT } from './ocean/OceanFFT.js';
import { OceanMesh } from './ocean/OceanMesh.js';
import { ISLAND } from '../space-island';

// Bounds: one renderer/scene, bounded GPU allocations, no network assets, one lazy ocean shared across room styles.
// Frozen weather never advances time or flashes; mirrors use their own view rays.
export class WeatherSystem {
  constructor(renderer, narrow, roofShader, roofUniforms, invalidate, onError) {
    this.renderer = renderer;
    this.narrow = narrow;
    this.island = false;
    this.city = false;
    this.anchorDirty = false;
    this.viewDirection = new THREE.Vector3();
    this.oceanDirty = false;
    this.U = createUniforms();
    this.root = new THREE.Group();
    this.root.name = 'abyssal-weather';
    this.atmosphere = new Atmosphere(renderer);
    this.sky = new SkyRenderer(renderer, this.atmosphere, this.U);
    this.rain = new Rain({ rainCount: narrow ? 9000 : 24000 }, this.U, roofShader, roofUniforms);
    this.lightning = new Lightning(this.U);
    this.spout = new Waterspout(this.U);
    this.spout.setLUTs(this.atmosphere);
    this.spout.setQuality({ spoutSteps: narrow ? 40 : 64 });
    this.weather = new Weather(this, this.U);
    this.flash = new THREE.DirectionalLight(0xc7dfff, 0);
    this.flash.position.set(-40, 80, -70);
    this.root.add(this.sky.mesh, this.rain.mesh, this.lightning.mesh, this.spout.mesh, this.flash, this.flash.target);
    this.generator = new THREE.PMREMGenerator(renderer);
    /** @type {THREE.WebGLRenderTarget | null} */
    this.environment = null;
    this.time = 0;
    this.frame = 0;
    this.nextStrike = 1.6;
    this.cloudAt = -Infinity;
    this.skyHeight = -Infinity;
    this.dirty = true;
    this.storm = false;
    this.tornado = false;
    this.motion = true;
    this.status = 'loading';
    this.abort = new AbortController();
    this.size = new THREE.Vector2();
    this.ready = bakeProceduralTextures(renderer, undefined, this.abort.signal).then(textures => {
      if (this.abort.signal.aborted) { disposeProceduralTextures(textures); return; }
      this.textures = textures;
      this.U.uCurlTex.value = textures.curl;
      this.clouds = new Clouds(renderer, this.atmosphere, textures, {
        envSize: narrow ? 256 : 512, cloudSteps: 256, cloudLightSteps: narrow ? 3 : 5,
      }, this.U);
      this.sky.setCloudTextures(this.clouds.screenRT.texture, this.clouds.envTexture);
      this.status = 'ready'; this.ensureOcean(); this.dirty = true; invalidate();
    }).catch(error => {
      if (this.abort.signal.aborted) return;
      this.status = 'error'; console.error('ABYSSAL weather initialization failed', error); onError();
    });
  }

  set({ cloud, rain, wind, fog, storm, tornado, sand, urban, island = false, city = false }) {
    this.island = island;
    this.city = city; this.anchorDirty = city;
    this.sky.shared.uCityHaze.value = Number(city);
    this.ensureOcean();
    this.oceanDirty = island;
    this.weather.set({
      windSpeed: island ? Math.max(3.2, wind * 1.25) : wind, windAngle: 0.6, gustiness: storm ? 0.7 : 0.25,
      swellHs: island ? .55 + wind * .22 : 1.4, swellPeriod: 8 + wind * .16,
      choppiness: .9 + Math.min(wind, 22) * .012,
      spray: island ? THREE.MathUtils.smoothstep(wind, 4, 24) : 0,
      waterScatter: new THREE.Vector3(.022 + cloud * .028, .09 + cloud * .055, .12 + cloud * .035),
      waterAbsorb: new THREE.Vector3(.004, .025, .038),
      rain, turbidity: sand ? 7 : 1 + cloud * 2.5, mieG: 0.78,
      cloudCoverage: cloud, cloudDensity: cloud > 0.8 ? 0.85 : 0.55,
      cloudBottom: cloud > 0.8 ? 600 : 1200, cloudTop: cloud > 0.8 ? 3200 : 4000,
      cloudAnvil: storm ? 0.65 : 0, storm: storm ? 1 : cloud * 0.35,
      fog, lightningRate: storm ? 0.12 : 0, seaLevel: island ? ISLAND.sea : urban ? -120 : -0.6,
    }, true);
    this.storm = storm; this.tornado = tornado;
    this.lightning.clear(); this.spout.clear(); this.flash.intensity = 0;
    if (this.spray) this.spray.reset = true;
    this.time = 0; this.nextStrike = 1.6; this.cloudAt = -Infinity;
    if (tornado) { this.spout.spawn(-950, -3500, 25); this.spout.life = 6; }
    this.dirty = true;
  }

  setTime(elevation, azimuth, day) {
    this.weather.set({ sunElevation: elevation, sunAzimuth: azimuth, sunIntensity: 4.5, starIntensity: 1 - day }, true);
    this.sky.shared.uUrbanGlow.value = this.city ? 1 - day : 0;
    this.dirty = true;
  }

  update(camera, time, dt, motion) {
    this.time = time;
    const U = this.U;
    if (this.motion && !motion) { this.lightning.clear(); this.flash.intensity = 0; this.dirty = true; }
    this.motion = motion;
    updateFrameUniforms(U, camera, camera.projectionMatrix, dt, time, this.frame++);
    this.weather.update(dt);
    if (this.island && this.ocean && (dt > 0 || this.oceanDirty)) {
      this.ocean.update(dt); this.oceanDirty = false;
    }
    this.oceanMesh?.update(camera.position, U.uSeaLevel.value);
    this.spray?.update(motion ? dt : 0, this.island ? U.uSprayAmount.value : 0);
    if (motion && this.storm && time >= this.nextStrike) {
      camera.getWorldDirection(this.viewDirection);
      const angle = this.city ? Math.atan2(this.viewDirection.z, this.viewDirection.x) + (Math.random() - .5) * 1.4 : -Math.PI * (0.25 + Math.random() * 0.6);
      this.lightning.strike((this.city ? camera.position.x : 0) + Math.cos(angle) * 3000, (this.city ? camera.position.z : 0) + Math.sin(angle) * 3000, this.weather.state.cloudBottom);
      this.nextStrike = time + 5 + Math.random() * 7;
    }
    this.lightning.update(motion ? dt : 0, time, motion ? this.weather.state : { lightningRate: 0 });
    this.flash.intensity = motion ? U.uAmbientFlash.value * 1.4 : 0;
    if (this.tornado && !this.spout.active) this.spout.spawn(-950, -3500, 25);
    // City travel spans kilometres. Keep each funnel fixed until it is far behind the camera.
    if (this.city && this.tornado && (this.anchorDirty || Math.hypot(this.spout.x - camera.position.x, this.spout.z - camera.position.z) > 4500)) {
      camera.getWorldDirection(this.viewDirection);
      this.viewDirection.y = 0;
      if (this.viewDirection.lengthSq() < .001) this.viewDirection.set(0, 0, 1);
      this.viewDirection.normalize();
      this.spout.x = camera.position.x + this.viewDirection.x * 1800 + this.viewDirection.z * 750;
      this.spout.z = camera.position.z + this.viewDirection.z * 1800 - this.viewDirection.x * 750;
      this.anchorDirty = false;
    }
    this.spout.update(motion ? dt : 0, this.weather.state.cloudBottom);
    this.renderer.getDrawingBufferSize(this.size);
    this.rain.update(camera, this.weather.state.rain, this.size.y);
    this.sky.mainCamera = camera;
    this.sky.update(time);
    this.sky.shared.uCloudEnabled.value = this.clouds && this.weather.state.cloudCoverage > 0 ? 1 : 0;

    // Screen rays follow the camera each frame; distant reflection probes update at 4 Hz.
    const refreshEnvironment = this.dirty || time - this.cloudAt >= 0.25 || Math.abs(camera.position.y - this.skyHeight) > 1;
    if (refreshEnvironment) {
      this.atmosphere.update(camera, camera.position);
      this.atmosphere.syncUniforms(U);
    }
    this.clouds?.update(time, this.size.x, this.size.y, refreshEnvironment);
    if (refreshEnvironment) {
      this.sky.renderEnv();
      this.environment = this.generator.fromEquirectangular(this.sky.envRT.texture, this.environment);
      this.cloudAt = time; this.dirty = false;
      this.skyHeight = camera.position.y;
    }
  }

  ensureOcean() {
    if (this.island && this.status === 'ready' && !this.ocean) {
      this.oceanTextures = bakeOceanTextures(this.renderer, this.narrow);
      this.U.uFoamTex.value = this.oceanTextures.foam.texture;
      this.U.uRippleTex.value = this.oceanTextures.ripple.texture;
      this.ocean = new OceanFFT(this.renderer, { size: this.narrow ? 64 : 256 });
      this.oceanMesh = new OceanMesh(this.ocean, this.atmosphere, { oceanGridX: this.narrow ? 128 : 320, oceanGridY: this.narrow ? 96 : 224 }, this.clouds?.shared, this.U);
      this.spray = new Spray(this.renderer, this.ocean, { sprayCount: this.narrow ? 4096 : 16384 }, this.oceanMesh.uniforms, this.U);
      this.root.add(this.oceanMesh.mesh, this.spray.mesh); this.oceanDirty = true;
    }
    if (this.oceanMesh) this.oceanMesh.mesh.visible = this.island;
  }

  dispose() {
    this.abort.abort();
    this.spray?.dispose(); this.oceanMesh?.dispose(); this.ocean?.dispose();
    this.oceanTextures?.foam.dispose(); this.oceanTextures?.ripple.dispose();
    this.clouds?.dispose();
    if (this.textures) disposeProceduralTextures(this.textures);
    this.rain.dispose(); this.lightning.dispose(); this.spout.dispose();
    this.sky.dispose(); this.atmosphere.dispose(); this.environment?.dispose();
    this.generator.dispose(); this.flash.shadow.dispose(); this.root.removeFromParent();
  }
}
