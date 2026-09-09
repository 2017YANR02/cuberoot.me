import * as T from 'three';
import { WEATHER_NOISE_GLSL } from '@/lib/three-weather';
import type { JourneyWeather } from './history-environment';
import type { PaperPalette } from './history-scenery';

/** One flowing ink wash shared by the streamed river sections, in world coordinates. */
export class PaperWater {
  readonly material: T.MeshStandardMaterial;
  private readonly uniforms = {
    riverTime: { value: 0 }, riverWind: { value: 0 }, riverRain: { value: 0 },
    riverNight: { value: 0 }, riverLight: { value: new T.Color() },
    riverFoam: { value: new T.Color() }, riverSky: { value: new T.Color() },
  };

  constructor(palette: PaperPalette) {
    this.uniforms.riverFoam.value.set(palette.paper).lerp(new T.Color(palette.ice), .55);
    this.material = new T.MeshStandardMaterial({
      color: new T.Color(1, 1, 1), vertexColors: true, side: T.DoubleSide,
      roughness: .6, metalness: 0,
    });
    this.material.name = 'history-flowing-water';
    this.material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = `attribute float riverWidth,riverCenter;
        varying vec3 riverPosition; varying vec2 riverUV; varying float riverSpan,riverMidline;
        ${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
          riverPosition=(modelMatrix*vec4(position,1.)).xyz; riverUV=uv; riverSpan=riverWidth; riverMidline=riverCenter;`);
      shader.fragmentShader = `
        uniform float riverTime,riverWind,riverRain,riverNight;
        uniform vec3 riverLight,riverFoam,riverSky;
        varying vec3 riverPosition; varying vec2 riverUV; varying float riverSpan,riverMidline;
        ${WEATHER_NOISE_GLSL}
        float riverLine(float phase,float width){
          float wave=sin(phase);
          return 1.-smoothstep(width,width+max(fwidth(wave),.025),abs(wave));
        }
        ${shader.fragmentShader}`
        .replace('#include <color_fragment>', `#include <color_fragment>
          // The same world position and clock meet at both sides of every chunk seam.
          float bank=min(riverUV.y,1.-riverUV.y)*riverSpan;
          float crossStream=riverPosition.z-riverMidline;
          float downstream=riverPosition.x-riverTime*.46;
          float wash=noise(vec3(downstream*.21,crossStream*.65,0.));
          float bend=sin(downstream*.43+crossStream*.9)*.14+noise(vec3(downstream*.24,crossStream*.8,3.))*.52;
          float threads=riverLine((crossStream+bend)*5.4,.028);
          float broken=smoothstep(.44,.72,noise(vec3(downstream*.42,crossStream*1.7,1.)));
          float current=threads*broken*smoothstep(.16,.65,bank);
          float undertow=sin(crossStream*3.2+sin(downstream*.3)*.7);
          float shallows=exp(-bank*2.1);
          // Small, broken parallel curls wash against the paper banks.
          float shore=riverLine(bank*19.+sin(riverPosition.x*.85-riverTime*.7)*.45,.13)
            *exp(-bank*3.4)*(.38+wash*.62)*smoothstep(.015,.08,bank);
          float glints=riverLine((crossStream+bend)*11.+downstream*.2,.035)
            *smoothstep(.66,.87,wash)*smoothstep(.25,.8,bank);
          // Rain impacts are seeded on the river itself, never on a camera-following plane.
          vec2 rainCell=riverPosition.xz*vec2(.7,1.1);
          vec2 cell=floor(rainCell), local=fract(rainCell)-.5;
          float seed=hash(vec3(cell,2.));
          float age=fract(riverTime*.72+seed*7.);
          vec2 center=vec2(seed-.5,hash(vec3(cell,4.))-.5)*.35;
          float distanceToDrop=length((local-center)*vec2(1.,.78));
          float ring=1.-smoothstep(.009,.009+max(fwidth(distanceToDrop),.008),abs(distanceToDrop-age*.34));
          float rain=ring*(1.-age)*(1.-age)*riverRain;
          diffuseColor.rgb*=.77+wash*.17+undertow*.035;
          diffuseColor.rgb=mix(diffuseColor.rgb,riverFoam,shallows*.18);
          diffuseColor.rgb=mix(diffuseColor.rgb,riverSky,.045+wash*.04);
          diffuseColor.rgb=mix(diffuseColor.rgb,riverFoam,current*(.20+riverWind*.08)+shore*.38+rain*.20);
        `)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          float slopeX=cos(downstream*.75+crossStream*2.7)*.015;
          float slopeZ=sin(crossStream*2.7+sin(downstream*.43))*.035;
          normal=normalize(normal+mat3(viewMatrix)*vec3(slopeX,0.,slopeZ)*(1.+riverWind*1.3));
        `)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance+=riverLight*(glints*.12+current*.018+shore*.025)*(1.+riverNight*.35);
        `);
    };
    this.material.customProgramCacheKey = () => 'history-flowing-water-v1';
  }

  update(time: number, weather: JourneyWeather, night: number, sky: T.Color, light: T.Color) {
    this.uniforms.riverTime.value = Number.isFinite(time) ? Math.max(0, time) : 0;
    this.uniforms.riverWind.value = ['storm', 'monsoon', 'blizzard', 'tornado'].includes(weather) ? 1 : ['wind', 'rain', 'hail', 'sandstorm'].includes(weather) ? .55 : .12;
    this.uniforms.riverRain.value = ['storm', 'rain', 'monsoon', 'mudslide', 'sleet', 'hail'].includes(weather) ? 1 : ['drizzle', 'sunshower'].includes(weather) ? .4 : 0;
    this.uniforms.riverNight.value = night;
    this.uniforms.riverSky.value.copy(sky);
    this.uniforms.riverLight.value.copy(light);
  }

  dispose() { this.material.dispose(); }
}
