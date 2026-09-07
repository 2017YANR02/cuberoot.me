// ABYSSAL, MIT, Copyright (c) 2026 Davi (Token-Gremlin). See LICENSE and UPSTREAM.md.
import * as THREE from 'three';

const lerp = THREE.MathUtils.lerp;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));

export const BEAUFORT = [
  [0.3, 'CALM'], [1.5, 'LIGHT AIR'], [3.3, 'LIGHT BREEZE'], [5.5, 'GENTLE BREEZE'],
  [7.9, 'MODERATE BREEZE'], [10.7, 'FRESH BREEZE'], [13.8, 'STRONG BREEZE'],
  [17.1, 'NEAR GALE'], [20.7, 'GALE'], [24.4, 'STRONG GALE'], [28.4, 'STORM'],
  [32.6, 'VIOLENT STORM'], [1e9, 'HURRICANE'],
];

export function beaufort(ws) {
  for (let i = 0; i < BEAUFORT.length; i++) if (ws < BEAUFORT[i][0]) return [i, BEAUFORT[i][1]];
  return [12, 'HURRICANE'];
}

/**
 * Continuous atmospheric/oceanic state. The director writes `target`, this
 * class integrates towards it and pushes everything into shared uniforms.
 */
export class Weather {
  constructor(app, U) {
    this.U = U;
    this.app = app;

    this.state = {
      windSpeed: 7.0,
      windAngle: 0.6,
      gustiness: 0.25,
      swellHs: 1.4,
      swellAngle: 1.1,
      swellPeriod: 11.0,
      spread: 0.7,
      amplitude: 1.0,
      choppiness: 1.3,
      rain: 0.0,
      turbidity: 1.0,
      mieG: 0.78,
      sunElevation: 0.22,
      sunAzimuth: 2.1,
      cloudCoverage: 0.42,
      cloudDensity: 0.55,
      cloudBottom: 900,
      cloudTop: 5200,
      cloudAnvil: 0.0,
      storm: 0.0,
      fog: 0.0,
      spray: 0.0,
      lightningRate: 0.0,
      seaLevel: 0.0,
      // Volume reflectance of the water body. Molecular scattering goes as
      // 1/lambda^4 and absorption climbs steeply past 500 nm, so open ocean
      // peaks hard in the blue: green comes back at roughly half the blue, red
      // at almost nothing. Bringing green up level with blue — which is what
      // chlorophyll and dissolved organics do near a coast — is what turned
      // every wave face into turquoise enamel.
      waterScatter: new THREE.Vector3(0.010, 0.045, 0.092),
      waterAbsorb: new THREE.Vector3(0.003, 0.016, 0.036),
      foamStrength: 1.0,
      sunIntensity: 22.0,
      starIntensity: 1.0,
      timeScale: 1.0,
    };
    this.target = JSON.parse(JSON.stringify({ ...this.state, waterScatter: undefined, waterAbsorb: undefined }));
    this.target.waterScatter = this.state.waterScatter.clone();
    this.target.waterAbsorb = this.state.waterAbsorb.clone();
    this.rates = {
      windSpeed: 0.28, windAngle: 0.15, rain: 0.4, turbidity: 0.25,
      sunElevation: 0.10, sunAzimuth: 0.06, cloudCoverage: 0.22, cloudDensity: 0.25,
      storm: 0.3, spray: 0.5, fog: 0.3, amplitude: 0.3, swellHs: 0.16,
      swellPeriod: 0.14, choppiness: 0.3, cloudAnvil: 0.2, sunIntensity: 0.4, seaLevel: 0.5,
      _default: 0.35,
    };

    this._sunDirTmp = new THREE.Vector3();
  }

  set(partial, immediate = false) {
    for (const k of Object.keys(partial)) {
      if (k === 'waterScatter' || k === 'waterAbsorb') {
        this.target[k].copy(partial[k]);
        if (immediate) this.state[k].copy(partial[k]);
      } else {
        this.target[k] = partial[k];
        if (immediate) this.state[k] = partial[k];
      }
    }
  }

  update(dt) {
    const s = this.state, t = this.target;
    for (const k of Object.keys(s)) {
      if (k === 'waterScatter' || k === 'waterAbsorb') {
        const rate = 0.4;
        s[k].x = damp(s[k].x, t[k].x, rate, dt);
        s[k].y = damp(s[k].y, t[k].y, rate, dt);
        s[k].z = damp(s[k].z, t[k].z, rate, dt);
        continue;
      }
      if (typeof s[k] !== 'number') continue;
      const rate = (this.rates[k] ?? this.rates._default) * 4.0;
      s[k] = damp(s[k], t[k], rate, dt);
    }

    // ------------------------------------------------------- derived values
    const ws = s.windSpeed;
    const gustPhase = this.app.time * 0.21;
    const gust = 1.0 + s.gustiness * (Math.sin(gustPhase) * 0.5 + Math.sin(gustPhase * 2.37 + 1.1) * 0.3 + Math.sin(gustPhase * 5.1) * 0.2);
    const wsGust = ws * gust;

    this.U.uWindSpeed.value = wsGust;
    this.U.uWindDir.value.set(Math.cos(s.windAngle), Math.sin(s.windAngle));
    this.U.uGustiness.value = s.gustiness;
    this.U.uRain.value = s.rain;
    this.U.uFogDensity.value = s.fog;
    this.U.uSprayAmount.value = s.spray;
    this.U.uStormFactor.value = s.storm;
    this.U.uSeaLevel.value = s.seaLevel;

    // sun
    const el = s.sunElevation, az = s.sunAzimuth;
    this._sunDirTmp.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    this.U.uSunDir.value.copy(this._sunDirTmp);
    this.app.atmosphere.sunDir.copy(this._sunDirTmp);
    this.app.atmosphere.turbidity = s.turbidity;
    this.app.atmosphere.mieG = s.mieG;
    this.app.atmosphere.sunIntensity = s.sunIntensity;
    this.U.uSunIntensity.value = s.sunIntensity;
    this.U.uAtmoTurbidity.value = s.turbidity;
    this.U.uAtmoMieG.value = s.mieG;
    this.U.uMoonDir.value.set(-Math.cos(el * 0.6) * Math.cos(az + 2.6), Math.max(0.25, -Math.sin(el) * 0.8 + 0.35), -Math.cos(el * 0.6) * Math.sin(az + 2.6)).normalize();

    this.app.sky.starIntensity = s.starIntensity;

    const cu = this.app.clouds?.shared;
    if (cu) {
      cu.uCoverage.value = s.cloudCoverage;
      cu.uCloudDensity.value = s.cloudDensity;
      cu.uCloudBottom.value = s.cloudBottom;
      cu.uCloudTop.value = Math.max(s.cloudTop, s.cloudBottom + 400);
      cu.uAnvil.value = s.cloudAnvil;
      // Clouds ride the geostrophic flow: faster and veered from the surface
      // wind, but well short of the surface gale — a deck that crosses the sky
      // at 40 m/s outruns the temporal filter and shimmers.
      const cloudAngle = s.windAngle + 0.35;
      const cloudSpeed = 2.5 + ws * 0.42;
      cu.uCloudWind.value.set(Math.cos(cloudAngle) * cloudSpeed, Math.sin(cloudAngle) * cloudSpeed);
      // fair-weather cumulus are ~1 km cells; storm cells are far bigger
      cu.uCloudScaleM.value = lerp(7000, 20000, THREE.MathUtils.clamp(s.storm, 0, 1));
    }

    this.beaufort = beaufort(wsGust);
  }
}
