import * as THREE from 'three';
import { CityGeometry, type MaterialFactory } from './space-shanghai-geometry';
import { shanghaiRoadElevations, type ShanghaiRoad } from './space-shanghai-bridges';
import { shanghaiRoadWidth } from './space-shanghai-streets';

type Track = { road: number; points: THREE.Vector3[]; distances: number[]; length: number; offset: number; next: number[] };
const DRIVABLE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified']);

// OSM supplies the street alignment and mapped travel direction, not live traffic.
// Follow the same elevation solution as the rendered bridges and spiral ramps.
export function shanghaiTrafficTracks(roads: ShanghaiRoad[]): Track[] {
  const elevations = shanghaiRoadElevations(roads), tracks: Track[] = [];
  roads.forEach((road, ri) => {
    if (!DRIVABLE.has(road.kind ?? '') || road.width < 5 || (road.layer ?? 0) < 0) return;
    const vertices = road.points.map(([x, z], i) => new THREE.Vector3(x, elevations[ri][i], z))
      .filter((p, i, a) => !i || p.distanceToSquared(a[i - 1]) > .0001);
    if (vertices.length < 2) return;
    for (const direction of road.oneway ? [road.oneway] : [1, -1]) {
      const points = direction === 1 ? vertices : [...vertices].reverse(), distances = [0];
      for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + points[i].distanceTo(points[i - 1]));
      if (distances.at(-1)! < 8) continue;
      tracks.push({ road: ri, points, distances, length: distances.at(-1)!, offset: road.oneway ? 0 : Math.min(shanghaiRoadWidth(road) / 4, 3.3), next: [] });
    }
  });
  const key = (p: THREE.Vector3) => `${p.x},${p.y.toFixed(2)},${p.z}`, starts = new Map<string, number[]>();
  tracks.forEach((t, i) => { const k = key(t.points[0]), entries = starts.get(k) ?? []; entries.push(i); starts.set(k, entries); });
  tracks.forEach(t => {
    const last = t.points.at(-1)!, direction = last.clone().sub(t.points.at(-2)!).normalize();
    t.next = (starts.get(key(last)) ?? []).filter(i => tracks[i].road !== t.road &&
      tracks[i].points[1].clone().sub(tracks[i].points[0]).normalize().dot(direction) > -.65);
  });
  return tracks;
}

// Piecewise-linear positions stay on the actual OSM alignment; smoothing the
// road itself with Catmull-Rom would cut across adjacent blocks.
export function sampleShanghaiTraffic(track: Track, distance: number, position: THREE.Vector3, direction: THREE.Vector3) {
  const d = THREE.MathUtils.clamp(distance, 0, track.length);
  let lo = 1, hi = track.distances.length - 1;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (track.distances[mid] < d) lo = mid + 1; else hi = mid; }
  const a = track.points[lo - 1], b = track.points[lo], segment = track.distances[lo] - track.distances[lo - 1];
  position.lerpVectors(a, b, (d - track.distances[lo - 1]) / segment);
  direction.subVectors(b, a).normalize();
  position.x -= direction.z * track.offset; position.z += direction.x * track.offset;
}

type Car = { track: number; distance: number; speed: number; seed: number; fadeIn: boolean };

export class ShanghaiTraffic {
  readonly root = new THREE.Group();
  readonly tracks: Track[];
  private cars: Car[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private matrices: THREE.InstancedBufferAttribute;
  private visibility: THREE.InstancedBufferAttribute;
  private wet = { value: 0 };
  private night = { value: 0 };
  private lastTime = 0;
  private transform = new THREE.Object3D();
  private direction = new THREE.Vector3();

  constructor(roads: ShanghaiRoad[], material: MaterialFactory, narrow: boolean, authored?: THREE.Object3D) {
    this.root.name = 'Shanghai road traffic';
    this.tracks = shanghaiTrafficTracks(roads);
    // Deterministic spread, with the dense central waterfront loaded first.
    const order = this.tracks.map((t, i) => ({ i, priority: Math.min(...t.points.map(p => Math.hypot(p.x + 650, (p.z - 1900) * .7))) })).sort((a, b) => a.priority - b.priority);
    for (const { i } of order) {
      const track = this.tracks[i], count = Math.floor(track.length / 48);
      for (let j = 0; j < count && this.cars.length < (narrow ? 420 : 1200); j++) {
        const seed = (i * 37 + j * 19) % 997;
        this.cars.push({ track: i, distance: (j + .25 + seed % 17 / 34) * track.length / count, speed: 6 + seed % 5, seed, fadeIn: false });
      }
    }
    this.matrices = new THREE.InstancedBufferAttribute(new Float32Array(this.cars.length * 16), 16).setUsage(THREE.DynamicDrawUsage);
    this.visibility = new THREE.InstancedBufferAttribute(new Float32Array(this.cars.length).fill(1), 1).setUsage(THREE.DynamicDrawUsage);
    this.root.userData.cars = this.cars.length; this.root.userData.tracks = this.tracks.length;
    if (!this.cars.length) return;

    const parts = authored?.children.filter((o): o is THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> => o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && !o.material.userData.spaceRuntimeShader);
    const beam = authored?.children.find((o): o is THREE.Mesh => o instanceof THREE.Mesh && o.material.userData.spaceRuntimeShader);
    const bodyMesh = parts?.find(o => o.material.userData.spaceShaderKey === 'traffic-shanghai-illumination-0.1');
    if (authored && (parts?.length !== 6 || !bodyMesh || !beam)) throw new Error('Incomplete Blender traffic prefab');
    const { template, body } = authored ? { template: { children: parts! }, body: bodyMesh!.material } : this.carTemplate(material);
    for(const child of template.children) {
      const mesh=child as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>, m=mesh.material, compile=m.onBeforeCompile;
      m.onBeforeCompile=(shader,renderer)=>{
        compile.call(m,shader,renderer);
        shader.vertexShader='attribute float trafficVisibility; varying float carVisibility;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncarVisibility=trafficVisibility;');
        shader.fragmentShader='varying float carVisibility;\n'+shader.fragmentShader;
        // Ordered coverage, no transparent sorting or depth-writing ghosts.
        shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nif(carVisibility < fract(dot(floor(gl_FragCoord.xy),vec2(.75487766,.56984029)))) discard;');
      };
      const key=m.customProgramCacheKey(); m.customProgramCacheKey=()=>`traffic-${key}`;
      this.instance(mesh.geometry,m);
    }
    const paint=this.meshes.find(m=>m.material===body)!;
    const palette=[0xe0ddd2,0x1e2934,0x829398,0xb9c4cd,0x342f35,0x527b83,0x754039];
    this.cars.forEach((car,i)=>paint.setColorAt(i,new THREE.Color(palette[car.seed%palette.length])));
    // Light projected onto the road is an analytic approximation. It is confined
    // to each car's lane and changes with rain; it is not a second mirror plane.
    const lightGeometry=beam?.geometry ?? new THREE.PlaneGeometry(3.1,12);
    if (!beam) { lightGeometry.rotateX(-Math.PI/2); lightGeometry.translate(0,.035,2.4); }
    const light=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2, fog:true,
      uniforms:{...THREE.UniformsLib.fog,night:this.night,wet:this.wet},
      vertexShader:`attribute float trafficVisibility; varying vec2 lightUV; varying float lightVisibility;
        #include <fog_pars_vertex>
        void main(){ lightUV=uv; lightVisibility=trafficVisibility; vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(position,1.); gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader:`uniform float night,wet; varying vec2 lightUV; varying float lightVisibility;
        #include <fog_pars_fragment>
        void main(){ float x=(lightUV.x-.5)*2., z=1.-lightUV.y;
          float front=smoothstep(.3,.42,z)*(1.-smoothstep(.55,1.,z));
          float back=(1.-smoothstep(.1,.29,z))*smoothstep(0.,.12,z);
          float width=mix(.18,.82,smoothstep(.4,1.,z));
          float beam=exp(-x*x/max(.025,width*width));
          float streak=exp(-pow((abs(x)-.39)*8.,2.));
          vec3 rgb=vec3(.68,.82,1.)*front*(beam*.26+wet*streak*.52)+vec3(1.,.018,.003)*back*wet*(beam*.2+streak*.9);
          gl_FragColor=vec4(rgb*night*lightVisibility,1.);
          #ifdef USE_FOG
            #ifdef FOG_EXP2
              float fogFactor=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
            #else
              float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
            #endif
            gl_FragColor.rgb*=1.-fogFactor;
          #endif
        }` });
    this.instance(lightGeometry,light);
    if (authored) {
      this.root.position.copy(authored.position); this.root.quaternion.copy(authored.quaternion); this.root.scale.copy(authored.scale);
      authored.removeFromParent();
      authored.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    }
    // Static bounds cover every connected road, including later junction turns.
    const bounds=new THREE.Box3(); for(const track of this.tracks) for(const point of track.points) bounds.expandByPoint(point);
    const sphere=bounds.expandByScalar(20).getBoundingSphere(new THREE.Sphere());
    for(const mesh of this.meshes) mesh.boundingSphere=sphere;
    this.update(0);
  }

  private carTemplate(material: MaterialFactory) {
    // A compact city sedan, metre-scale body panels, sloping cabin and four tyres.
    // The villa's concept-car GLB is a different vehicle and is too costly to
    // duplicate across city traffic. All city cars share these six geometry batches.
    const g = new CityGeometry(), body = material(0xc6cbd0, .55, .3, .1), glass = material(0x10212b, .55, .22, .035);
    const rubber = material(0x13191c, .05, .94), trim = material(0x606b72, .72, .28, .07);
    const head = material(0xe1efff, .1, .24, 18), tail = material(0xff2610, .1, .28, 12);
    const outline = new THREE.Shape([[-.88,-2.08],[-.72,-2.28],[.72,-2.28],[.88,-2.08],[.9,1.75],[.7,2.2],[-.7,2.2],[-.9,1.75]].map(([x,z]) => new THREE.Vector2(x,-z)));
    const shell = new THREE.ExtrudeGeometry(outline, { depth: .52, bevelEnabled: true, bevelSize: .1, bevelThickness: .1, bevelSegments: 2, steps: 1 });
    shell.rotateX(-Math.PI / 2); g.add(shell, body, [0,.38,0]);
    // Cabin slopes along Z and narrows towards the roof.
    const cabin = new THREE.BoxGeometry(1.62,.58,2.35), cp = cabin.getAttribute('position');
    for (let i=0;i<cp.count;i++) if(cp.getY(i)>0) { cp.setX(i,cp.getX(i)*.83); cp.setZ(i,cp.getZ(i)*.61-.13); }
    cabin.computeVertexNormals(); g.add(cabin, glass, [0,1.13,-.18]);
    g.box([1.39,.07,1.4],[0,1.45,-.31],body);
    for (const x of [-.77,.77]) { g.box([.055,.5,.08],[x,1.15,-.18],trim); g.box([.22,.16,.3],[x*1.27,1.04,.52],body); }
    for (const x of [-.86,.86]) for(const z of [-1.43,1.4]) {
      const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
      g.add(new THREE.CylinderGeometry(.32,.32,.22,12),rubber,[x,.32,z],rotation);
      g.add(new THREE.CylinderGeometry(.19,.19,.235,10),trim,[x,.32,z],rotation);
    }
    g.box([1.25,.14,.055],[0,.5,2.27],rubber);
    for(const x of [-.59,.59]) { g.box([.48,.13,.075],[x,.78,2.22],head); g.box([.49,.15,.08],[x,.79,-2.3],tail); }
    return { template: g.finish(), body };
  }

  private instance(geometry:THREE.BufferGeometry, material:THREE.Material) {
    geometry.setAttribute('trafficVisibility',this.visibility);
    const mesh=new THREE.InstancedMesh(geometry,material,this.cars.length); mesh.instanceMatrix=this.matrices;
    mesh.receiveShadow=true; mesh.castShadow=false;
    this.meshes.push(mesh); this.root.add(mesh);
  }

  setWeather(night:number, wet:number) { this.night.value=night; this.wet.value=wet; }

  update(elapsed:number) {
    const dt=Math.min(.1,Math.max(0,elapsed-this.lastTime)); this.lastTime=elapsed;
    for(let i=0;i<this.cars.length;i++) {
      const car=this.cars[i]; let track=this.tracks[car.track]; car.distance+=dt*car.speed;
      if(car.distance>=track.length) {
        car.distance-=track.length;
        car.fadeIn=!track.next.length;
        if(track.next.length) car.track=track.next[car.seed%track.next.length];
        track=this.tracks[car.track];
      }
      sampleShanghaiTraffic(track,car.distance,this.transform.position,this.direction);
      this.transform.rotation.set(-Math.asin(this.direction.y),Math.atan2(this.direction.x,this.direction.z),0,'YXZ');
      this.transform.updateMatrix(); this.matrices.set(this.transform.matrix.elements,i*16);
      this.visibility.setX(i,Math.min(1,car.fadeIn?car.distance/8:1,track.next.length?1:(track.length-car.distance)/8));
    }
    this.matrices.needsUpdate=true; this.visibility.needsUpdate=true;
  }
}
