import * as THREE from 'three';
import { CityGeometry, type MaterialFactory, type ShanghaiPolygon } from './space-shanghai-geometry';
import { bundStone, frontShell, openingPath, roofMetal, windowBays, type FrontOpening } from './space-shanghai-facades';

// East elevation: Shanghai Urban Construction Archives, 2023-12-16, and the
// Asisbiz front photograph. Four window orders, 2+2+3+2+2 axes and five gables.
// The OSM frontage is measured in metres; vertical sizes are photo estimates.
export function commercialBank(g: CityGeometry, plan: ShanghaiPolygon, width: number, material: MaterialFactory) {
  const axes = [-.405, -.368, -.241, -.203, -.0715, 0, .0715, .203, .241, .368, .405].map(x => x * width);
  const wingEdge = plan.points.filter(([x,z])=>x>width/2-.2 && z<-.5);
  const wingLeft=Math.min(...wingEdge.map(p=>p[0])), wingRight=Math.max(...wingEdge.map(p=>p[0]));
  const wingZ=Math.min(...wingEdge.map(p=>p[1])), wingWidth=wingRight-wingLeft;
  if(!Number.isFinite(wingWidth) || wingWidth<1 || !Number.isFinite(wingZ)) throw new Error('Commercial Bank requires its mapped annex frontage');
  const wingAxes=[.24,.5,.76].map(t=>THREE.MathUtils.lerp(wingLeft,wingRight,t));
  const plaster = facadeStone(0xa9aaa5);
  const trim = facadeStone(0xdbdbce);
  const plinth = facadeStone(0x818782);
  const frame = material(0x28322e, .45, .34, .035);
  const glass = material(0x3e4b49, .3, .24, .025);
  const roof = roofMetal(material, 0x454b4d, .18, 110);
  const lamp = material(0xf4dab1, .1, .5, 2.4);
  const bayWidth = width * .031, eaves = 14.15;
  const groups = [
    { x: -width * .3865, half: width * .0575, peak: 18.7 },
    { x: -width * .222, half: width * .0575, peak: 18.7 },
    { x: 0, half: width * .128, peak: 22.1 },
    { x: width * .222, half: width * .0575, peak: 18.7 },
    { x: width * .3865, half: width * .0575, peak: 18.7 },
  ];
  const ridge: [number, number][] = [[-width / 2, eaves]];
  for (const { x, half, peak } of groups) ridge.push([x-half,eaves],[x-half,16.5],[x,peak],[x+half,16.5],[x+half,eaves]);
  ridge.push([width / 2, eaves]);
  const outline = new THREE.Shape().moveTo(-width/2,-.65).lineTo(width/2,-.65);
  for (const [x,y] of ridge.toReversed()) outline.lineTo(x,y);
  outline.closePath();
  const openings: FrontOpening[] = [];
  for (const [i,x] of axes.entries()) {
    const central = i >= 4 && i <= 6;
    const w=central ? width*.054 : bayWidth;
    openings.push({ x, y: central ? 2.35 : 2.7, width: w, height: central ? 4.2 : 3.5, arch: true });
    openings.push({ x, y: 7.35, width: w, height: 2.65, arch: 'segmental' });
    openings.push({ x, y: 11.65, width: w, height: 2.3 });
    openings.push({ x, y: i === 5 ? 16.2 : 15.7, width: w * .84, height: i === 5 ? 3.25 : 2.25, arch: 'pointed' });
  }
  // The tall central gable has a recessed round-headed panel and three slits.
  const atticPanel: FrontOpening = { x: 0, y: 19.62, width: 1.25, height: 1.9, arch: true };
  openings.push(atticPanel);
  for (const { x,peak } of groups.filter(p=>p.x!==0)) openings.push({ x, y: peak-1, width: .15, height: .48 });
  frontShell(g,plan,eaves,openings,plaster,trim,glass,frame,{outline,decorate:false,frontDepths:[0,wingZ]});
  g.group.userData.groundOpeningCenters = axes;
  g.group.userData.groundOpeningWidth = bayWidth;
  // Elevation/width ratio measured from the archive's near-frontal photograph.
  // Signs are children of this same frame, so their height follows the facade.
  g.group.scale.y = .94;
  g.group.userData.reconstruction = 'Shanghai Urban Construction Archives east elevation and Asisbiz photograph; OSM frontage, photo-estimated heights; not surveyed';

  const ring = (o: FrontOpening, border: number, z: number, depth: number, m: THREE.Material) => {
    const outer = new THREE.Shape(openingPath({...o,width:o.width+border*2,height:o.height+border*2}).getPoints(24));
    outer.holes.push(openingPath(o));
    g.add(new THREE.ExtrudeGeometry(outer,{depth,bevelEnabled:false,curveSegments:16}),m,[0,0,z]);
  };
  const atticFace = new THREE.Shape(openingPath(atticPanel).getPoints(32));
  for (const [x,height] of [[-.34,1.05],[0,1.5],[.34,1.05]]) {
    atticFace.holes.push(openingPath({x,y:18.83+height/2,width:.13,height,arch:true}));
  }
  g.add(new THREE.ExtrudeGeometry(atticFace,{depth:.12,bevelEnabled:false,curveSegments:16}),plaster,[0,0,.15]);
  const panel = (x: number, y: number, w: number, h: number, z = -.18) => {
    g.box([w,h,.1],[x,y,z],plaster);
    for (const side of [-1,1]) g.box([.055,h+.08,.08],[x+side*w/2,y,z-.08],trim);
    for (const side of [-1,1]) g.box([w+.1,.055,.08],[x,y+side*h/2,z-.08],trim);
  };
  const column = (x: number, bottom: number, top: number, radius: number, z: number) => {
    const h=top-bottom;
    const profile = [[radius*1.45,0],[radius*1.45,.12],[radius*1.2,.17],[radius*1.15,.26],[radius,.34],[radius*.85,h-.32],[radius*1.2,h-.22],[radius*1.4,h-.16],[radius*1.4,h]];
    g.add(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),20),trim,[x,bottom,z]);
    g.box([radius*3.2,.12,radius*3.2],[x,top,z],trim);
  };
  // The photographed three-column annex projects forward of the main frontage.
  // Its OSM edge stays in place; replace its wall as well as its window trim.
  const wingWall=new THREE.Shape().moveTo(wingLeft,-.65).lineTo(wingRight,-.65).lineTo(wingRight,eaves).lineTo(wingLeft,eaves).closePath();
  for(const x of wingAxes) for(const y of [2.7,7.35,11.65]) {
    const o: FrontOpening={x,y,width:wingWidth*.2,height:y<4?3.5:2.65};
    wingWall.holes.push(openingPath(o));
    const pane=new THREE.ShapeGeometry(new THREE.Shape(openingPath(o).getPoints(4)));
    pane.rotateY(Math.PI);g.add(pane,glass,[2*x,0,wingZ+.6]);
    ring(o,.13,wingZ-.23,.17,trim);
    ring({...o,width:o.width-.1,height:o.height-.1},.05,wingZ+.42,.08,frame);
    g.box([o.width,.045,.065],[x,y+.65,wingZ+.47],frame);
    panel(x,y-o.height/2-.5,o.width,.55,wingZ-.18);
  }
  g.add(new THREE.ExtrudeGeometry(wingWall,{depth:.72,bevelEnabled:false}),plaster,[0,0,wingZ-.06]);
  for(const y of [4.95,9.65,eaves]) {
    for(const [dy,h,d] of [[-.22,.12,.23],[0,.18,.45],[.17,.12,.64]]) g.box([wingWidth,h,d],[(wingLeft+wingRight)/2,y+dy,wingZ-d/2],trim);
    for(const side of [-1,1]) g.box([.18,3.3,.28],[side===-1?wingLeft+.14:wingRight-.14,y-2,wingZ-.14],trim);
  }
  const parapet=(left:number,right:number,z:number)=>{
    for(const h of [.27,.9]) g.beam([left,eaves+h,z],[right,eaves+h,z],.12,trim,.27);
    const count=Math.floor((right-left)/.36);
    for(let i=0;i<=count;i++) g.box([.13,.55,.2],[THREE.MathUtils.lerp(left,right,i/count),eaves+.57,z],trim);
  };
  parapet(wingLeft,wingRight,wingZ-.05);
  for(let i=0;i<groups.length-1;i++) parapet(groups[i].x+groups[i].half,groups[i+1].x-groups[i+1].half,-.05);
  for (const [index,o] of openings.entries()) {
    if (index >= 44) { if(index===44) ring(o,.16,-.19,.15,trim); continue; }
    const bottom=o.y-o.height/2, top=o.y+o.height/2;
    ring(o,.15,-.25,.17,trim);
    ring({...o,width:o.width+.36,height:o.height+.36},.045,-.15,.1,trim);
    ring({...o,width:o.width-.1,height:o.height-.1},.05,.42,.08,frame);
    const rise=o.arch==='pointed' ? o.width*.72 : o.arch==='segmental' ? o.width*.18 : o.arch ? o.width/2 : 0;
    const spring=top-rise;
    g.box([.045,spring-bottom,.065],[o.x,(bottom+spring)/2,.47],frame);
    if(index%4!==0) g.box([o.width,.04,.065],[o.x,bottom+(spring-bottom)*.76,.47],frame);
    g.box([o.width,.05,.065],[o.x,spring,.47],frame);
    if (o.arch==='pointed') {
      g.box([.04,rise-.12,.065],[o.x,spring+(rise-.12)/2,.47],frame);
    } else if (o.arch===true) {
      for (const a of [Math.PI/4,Math.PI/2,Math.PI*3/4]) g.beam([o.x,spring,.47],[o.x+Math.cos(a)*o.width/2,spring+Math.sin(a)*o.width/2,.47],.035,frame,.065);
    }
    g.box([o.width+.42,.12,.65],[o.x,bottom-.15,-.27],trim);
    if(index%4===1 || index%4===2) panel(o.x,bottom-.5,o.width,.48);
    if(index%4===0 && (index<16 || index>27)) {
      panel(o.x,.57,o.width+.2,.5);
      g.box([o.width+.5,.15,.7],[o.x,.22,-.25],plinth);
    }
  }
  // Layered floor cornices and their undercut/dentil shadows, not a stone grid.
  for (const y of [4.95,9.65,eaves]) {
    for (const [dy,h,d] of [[-.22,.12,.23],[0,.18,.45],[.17,.12,.64]]) g.box([width+.18,h,d],[0,y+dy,-d/2],trim);
    for (let x=-width/2+.26;x<width/2;x+=.48) g.box([.19,.2,.36],[x,y-.29,-.22],trim);
    if(y!==eaves) for (const x of axes) g.box([.18,.18,.035],[x,y-.58,-.075],frame);
  }
  for (const {x,half} of groups) {
    // The upper rectangular windows share a continuous architrave by group.
    g.box([half*2-.1,.13,.36],[x,13.35,-.21],trim);
    for (const side of [-1,1]) g.box([.13,2.98,.32],[x+side*(half-.11),11.92,-.2],trim);
    const members=axes.filter(a=>a>x-half && a<x+half);
    for (let i=0;i<members.length-1;i++) {
      const between=(members[i]+members[i+1])/2;
      column(between,5.67,8.54,.11,-.3);
      column(between,10.03,12.95,.09,-.24);
      column(between,14.43,16.22,.09,-.29);
    }
  }
  // Three entrance arches with a projecting Roman colonnade and balcony.
  for (const x of [-.1125,-.0375,.0375,.1125].map(x=>x*width)) {
    column(x,.15,3.63,.22,-.58);
    g.box([.67,.18,.75],[x,3.69,-.55],trim);
  }
  g.box([width*.269,.23,1.1],[0,5.24,-.4],trim);
  panel(0,5.76,width*.269,.82,-.59);
  g.box([width*.282,.14,1.2],[0,6.23,-.45],trim);
  // Steep longitudinal roof, kept behind dormer reveals and glazed openings.
  const back=Math.min(15,Math.max(...plan.points.map(p=>p[1]))), ridgeZ=back*.54;
  const roofVertices=[-width/2,eaves,1.2, width/2,21.7,ridgeZ, width/2,eaves,1.2,
    -width/2,eaves,1.2, -width/2,21.7,ridgeZ, width/2,21.7,ridgeZ,
    -width/2,21.7,ridgeZ, width/2,eaves,back, width/2,21.7,ridgeZ,
    -width/2,21.7,ridgeZ, -width/2,eaves,back, width/2,eaves,back];
  const roofGeometry=new THREE.BufferGeometry();
  roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices,3));
  roofGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(roofVertices.flatMap((_,i)=>i%3===0 ? [roofVertices[i]/width,roofVertices[i+2]/back] : []),2));
  roofGeometry.computeVertexNormals(); g.add(roofGeometry,roof);
  for (const {x,half,peak} of groups) {
    // Solid dormer cheeks behind the perforated front; ridge joins the main roof.
    for (const side of [-1,1]) {
      g.box([.16,2.3,1.7],[x+side*half,15.3,1.05],plaster);
      g.beam([x+side*(half+.04),16.52,-.16],[x,peak+.08,-.16],.17,trim,.42);
      g.beam([x+side*(half+.1),16.57,-.07],[x,peak+.19,-.07],.11,trim,.6);
      const vertices=[x+side*half,16.5,.3,x,peak,.3,x,peak,3.4,x+side*half,16.5,.3,x,peak,3.4,x+side*half,16.5,3.4];
      if(side<0) for(let i=0;i<vertices.length;i+=9) { const a=vertices.slice(i,i+3);vertices.splice(i,3,...vertices.slice(i+6,i+9));vertices.splice(i+6,3,...a); }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((_,i)=>i%3===0?[vertices[i]/width,vertices[i+2]/back]:[]),2));
      geo.computeVertexNormals();g.add(geo,roof);
    }
    g.beam([x,peak,-.04],[x,peak+.6,-.04],.11,trim,.11,true);
    g.add(new THREE.SphereGeometry(.12,10,8),trim,[x,peak+.58,-.04]);
    g.beam([x-.18,peak+.5,-.04],[x+.18,peak+.5,-.04],.09,trim,.09,true);
  }
  // Four circular Gothic turrets, with cone caps and cross finials.
  for (const x of [-width*.493,-width*.128,width*.128,width*.493]) {
    column(x,10.9,16.5,.23,-.25);
    for(const y of [13.9,16.45]) g.add(new THREE.CylinderGeometry(.34,.34,.16,20),trim,[x,y,-.25]);
    g.add(new THREE.ConeGeometry(.34,1.45,24),trim,[x,17.25,-.25]);
    g.beam([x,17.96,-.25],[x,18.44,-.25],.085,trim,.085,true);
    g.beam([x-.17,18.25,-.25],[x+.17,18.25,-.25],.085,trim,.085,true);
    for(const dx of [-.17,0,.17]) g.add(new THREE.SphereGeometry(.085,8,6),trim,[x+dx,dx===0?18.44:18.25,-.25]);
  }
  for (const x of [-width*.32,width*.32]) {
    g.beam([x,.1,-.17],[x,14.05,-.17],.09,frame,.09,true);
    for(const y of [2,6.2,10.8,13.2]) g.box([.17,.065,.24],[x,y,-.19],frame);
  }
  // Photographed floodlight housings at the ledges, with a separate warm lens.
  for(const x of axes) for(const y of [.25,5.2,9.9,14.4]) {
    g.box([.22,.18,.26],[x,y,-.53],plinth);
    g.box([.18,.035,.2],[x,y+.11,-.56],lamp);
  }
  for(const x of wingAxes) for(const y of [.25,5.2,9.9]) {
    g.box([.22,.18,.26],[x,y,wingZ-.53],plinth);
    g.box([.18,.035,.2],[x,y+.11,wingZ-.56],lamp);
  }
  windowBays(g,plan,[2.7,7.35,11.65],3.6,glass,trim,true,[0,wingZ]);

  // Fixed facade fixtures, evaluated in the building frame: cone angle,
  // inverse-square falloff and Lambert response preserve curved columns and
  // unlit undersides. Ledge limits approximate occlusion; this is not a full
  // shadow/lightmap bake. No global lights or per-frame shadow passes are added.
  function facadeStone(color: number) {
    const m = bundStone(material, color, 0, false);
    applyCommercialFixtures(m, width, axes, wingAxes, wingZ);
    return m;
  }
}

export function applyCommercialFixtures(m: THREE.Material, width: number, axes: number[], wingAxes: number[], wingZ: number) {
  const compile=m.onBeforeCompile, key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,renderer)=>{
    compile.call(m,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      {
      float fixtureX[14]=float[14](${[...axes,...wingAxes].map(x=>x.toFixed(4)).join(',')});
      float fixtureY[4]=float[4](.25,5.2,9.9,14.4);
      float irradiance=0.;
      for(int row=0;row<4;row++) {
        float ceiling=row==0?4.95:row==1?9.65:row==2?14.15:24.;
        float visible=smoothstep(fixtureY[row]-.1,fixtureY[row]+.2,bundPosition.y)*(1.-smoothstep(ceiling-.18,ceiling+.05,bundPosition.y));
        for(int i=0;i<14;i++) {
          if(i>=11 && row==3) continue;
          float depth=i<11?0.:${wingZ.toFixed(4)};
          vec3 toLight=vec3(fixtureX[i],fixtureY[row],depth-.85)-bundPosition;
          float d2=max(.1,dot(toLight,toLight));
          vec3 l=toLight*inversesqrt(d2);
          float cone=smoothstep(.2,.88,dot(-l,normalize(vec3(0.,1.,.27))));
          float facade=1.-smoothstep(depth+.2,depth+.65,bundPosition.z);
          irradiance+=facade*visible*cone*max(0.,dot(normalize(bundNormal),l))*8./(1.+d2);
        }
      }
      // The 2010 night photograph also shows continuous illuminated cornices.
      // Approximate shielded linear fixtures separately from the window lights;
      // retain the underside response and keep this light off the roof/rear.
      float ledges[3]=float[3](4.95,9.65,14.15);
      float depth=bundPosition.x>${(width/2).toFixed(4)}?${wingZ.toFixed(4)}:0.;
      float frontage=1.-smoothstep(depth+.1,depth+.4,bundPosition.z);
      for(int row=0;row<3;row++) {
        vec3 toLight=vec3(0.,ledges[row]-.48-bundPosition.y,depth-1.05-bundPosition.z);
        float d2=max(.1,dot(toLight,toLight));
        float strip=exp(-pow((bundPosition.y-ledges[row])/.62,2.));
        irradiance+=frontage*strip*max(0.,dot(normalize(bundNormal),normalize(toLight)))*1.8/(1.+d2);
      }
      // Deep reveals and the unlit rear keep their environment lighting.
      reflectedLight.directDiffuse+=diffuseColor.rgb*vec3(1.,.52,.19)*cityNight*irradiance*bundDistantWash;
      }
    `);
  };
  m.customProgramCacheKey=()=>key+'-commercial-bank-fixtures-'+width;
}
