import{_ as Ye}from"./preload-helper-C1DZI3o1.js";import{L as _e,M as k,A as T,e as Ct,g as Et,p as Ge,c as Pt,b as Nt,o as Rt,T as se,f as ae,d as we,h as Ot,I as C,i as Ft,G as ie,C as Te,P as I,j as jt,N as Vt,a as Se,s as R,k as q,l as Bt,m as ze}from"./chunk-6R47S6MP-ByVpAfxC.js";import{c as Ut,a as qt,b as Wt,C as w}from"./chunk-UKAXYOG2-D-_wOE7j.js";var oe=class{#e=0;#t=0;queue(e){return new Promise(async(t,r)=>{try{const i=++this.#e,n=await e;i>this.#t&&(this.#t=i,t(n))}catch(i){r(i)}})}},Xe=0,Ze=class{canReuse(e,t){return e===t||this.canReuseValue(e,t)}canReuseValue(e,t){return!1}debugGetChildren(){return Array.from(this.#e.values())}#e=new Set;addChild(e){this.#e.add(e)}removeChild(e){this.#e.delete(e)}lastSourceGeneration=0;markStale(e){if(e.detail.generation!==Xe)throw new Error("A TwistyProp was marked stale too late!");if(this.lastSourceGeneration!==e.detail.generation){this.lastSourceGeneration=e.detail.generation;for(const t of this.#e)t.markStale(e);this.#r()}}#t=new Set;addRawListener(e,t){this.#t.add(e),t?.initial&&e()}removeRawListener(e){this.#t.delete(e)}#r(){this.#i||(this.#i=!0,setTimeout(()=>this.#s(),0))}#i=!1;#s(){if(!this.#i)throw new Error("Invalid dispatch state!");for(const e of this.#t)e();this.#i=!1}#n=new Map;addFreshListener(e){const t=new oe;let r=null;const i=async()=>{const n=await t.queue(this.get());r!==null&&this.canReuse(r,n)||(r=n,e(n))};this.#n.set(e,i),this.addRawListener(i,{initial:!0})}removeFreshListener(e){this.removeRawListener(this.#n.get(e)),this.#n.delete(e)}},P=class extends Ze{#e;constructor(e){super(),this.#e=new _e(async()=>this.getDefaultValue()),e&&(this.#e=this.deriveFromPromiseOrValue(e,this.#e))}set(e){this.#e=this.deriveFromPromiseOrValue(e,this.#e);const t={sourceProp:this,value:this.#e,generation:++Xe};this.markStale(new CustomEvent("stale",{detail:t}))}async get(){return this.#e}async deriveFromPromiseOrValue(e,t){return this.derive(await e,t)}},h=class extends P{derive(e){return e}},B=Symbol("no value"),p=class extends Ze{#e;userVisibleErrorTracker;constructor(e,t){super(),this.userVisibleErrorTracker=t,this.#e=e;for(const r of Object.values(e))r.addChild(this)}#t=null;#r=null;async get(){const e=this.lastSourceGeneration;if(this.#r?.generation===e)return this.#r.output;const t={generation:e,output:this.#s(this.#i(),e,this.#t)};return this.#r=t,this.userVisibleErrorTracker?.reset(),t.output}async#i(){const e={};for(const[r,i]of Object.entries(this.#e))e[r]=i.get();const t={};for(const r in this.#e)t[r]=await e[r];return t}async#s(e,t,r=null){const i=await e,n=a=>(this.#t={inputs:i,output:Promise.resolve(a),generation:t},a);if(!r)return n(await this.derive(i));const s=r.inputs;for(const a in this.#e)if(!this.#e[a].canReuse(i[a],s[a]))return n(await this.derive(i));return r.output}},_=class{#e=[];addListener(e,t){let r=!1;const i=n=>{r||t(n)};e.addFreshListener(i),this.#e.push(()=>{e.removeFreshListener(i),r=!0})}addMultiListener3(e,t){this.addMultiListener(e,t)}addMultiListener(e,t){let r=!1,i=e.length-1;const n=async s=>{if(i>0){i--;return}if(r)return;const a=e.map(c=>c.get()),o=await Promise.all(a);t(o)};for(const s of e)s.addFreshListener(n);this.#e.push(()=>{for(const s of e)s.removeFreshListener(n);r=!0})}disconnect(){for(const e of this.#e)e()}},Ht=class{},H;globalThis.HTMLElement?H=globalThis.HTMLElement:H=Ht;var Qt=class{define(){}},y;globalThis.customElements?y=globalThis.customElements:y=new Qt;var x,Yt=class{replaceSync(){}};globalThis.CSSStyleSheet?x=globalThis.CSSStyleSheet:x=Yt;var S=class extends H{shadow;contentWrapper;constructor(e){super(),this.shadow=this.attachShadow({mode:e?.mode??"closed"}),this.contentWrapper=document.createElement("div"),this.contentWrapper.classList.add("wrapper"),this.shadow.appendChild(this.contentWrapper)}addCSS(e){this.shadow.adoptedStyleSheets.push(e)}removeCSS(e){const t=this.shadow.adoptedStyleSheets.indexOf(e);typeof t<"u"&&this.shadow.adoptedStyleSheets.splice(t,t+1)}addElement(e){return this.contentWrapper.appendChild(e)}prependElement(e){this.contentWrapper.prepend(e)}removeElement(e){return this.contentWrapper.removeChild(e)}};y.define("twisty-managed-custom-element",S);var U=class{animFrameID=null;animFrame=this.animFrameWrapper.bind(this);callback;constructor(e){this.callback=e}requestIsPending(){return!!this.animFrameID}requestAnimFrame(){this.animFrameID||(this.animFrameID=requestAnimationFrame(this.animFrame))}cancelAnimFrame(){this.animFrameID&&(cancelAnimationFrame(this.animFrameID),this.animFrameID=0)}animFrameWrapper(e){this.animFrameID=0,this.callback(e)}},_t={floating:!0,none:!0},Gt=class extends h{getDefaultValue(){return"auto"}},Xt=Math.PI*2,Q=360/Xt,b=new _e(()=>Ye(()=>import("./twisty-dynamic-3d-HSYJR5CM-DsMidOZc.js"),[]));function ue(){return devicePixelRatio||1}var be=.1,Zt=class extends EventTarget{#e=new Map;target;constructor(e){super(),this.target=e}start(){this.addTargetListener("pointerdown",this.onPointerDown.bind(this)),this.addTargetListener("contextmenu",e=>{e.preventDefault()}),this.addTargetListener("touchmove",e=>e.preventDefault()),this.addTargetListener("dblclick",e=>e.preventDefault())}stop(){for(const[e,t]of this.#t.entries())this.target.removeEventListener(e,t);this.#t.clear(),this.#r=!1}#t=new Map;addTargetListener(e,t){this.#t.has(e)||(this.target.addEventListener(e,t),this.#t.set(e,t))}#r=!1;#i(){this.#r||(this.addTargetListener("pointermove",this.onPointerMove.bind(this)),this.addTargetListener("pointerup",this.onPointerUp.bind(this)),this.#r=!0)}#s(e){this.#e.delete(e.pointerId)}#n(e){const t=this.#e.get(e.pointerId);if(!t)return{movementInfo:null,hasMoved:!1};let r;return(e.movementX??0)!==0||(e.movementY??0)!==0?r={attachedInfo:t.attachedInfo,movementX:e.movementX,movementY:e.movementY,elapsedMs:e.timeStamp-t.lastTimeStamp}:r={attachedInfo:t.attachedInfo,movementX:e.clientX-t.lastClientX,movementY:e.clientY-t.lastClientY,elapsedMs:e.timeStamp-t.lastTimeStamp},t.lastClientX=e.clientX,t.lastClientY=e.clientY,t.lastTimeStamp=e.timeStamp,Math.abs(r.movementX)<be&&Math.abs(r.movementY)<be?{movementInfo:null,hasMoved:t.hasMoved}:(t.hasMoved=!0,{movementInfo:r,hasMoved:t.hasMoved})}onPointerDown(e){this.#i();const t={attachedInfo:{},hasMoved:!1,lastClientX:e.clientX,lastClientY:e.clientY,lastTimeStamp:e.timeStamp};this.#e.set(e.pointerId,t),this.target.setPointerCapture(e.pointerId)}onPointerMove(e){const t=this.#n(e).movementInfo;t&&(e.preventDefault(),this.dispatchEvent(new CustomEvent("move",{detail:t})))}onPointerUp(e){const t=this.#n(e),r=this.#e.get(e.pointerId);this.#s(e),this.target.releasePointerCapture(e.pointerId);let i;if(t.hasMoved)i=new CustomEvent("up",{detail:{attachedInfo:r.attachedInfo}});else{const{altKey:n,ctrlKey:s,metaKey:a,shiftKey:o}=e;i=new CustomEvent("press",{detail:{normalizedX:e.offsetX/this.target.offsetWidth*2-1,normalizedY:1-e.offsetY/this.target.offsetHeight*2,rightClick:!!(e.button&2),keys:{altKey:n,ctrlOrMetaKey:s||a,shiftKey:o}}})}this.dispatchEvent(i)}},W=[];async function $e(e,t,r,i){W.length===0&&W.push(ye());const n=await W[0];return n.setSize(e,t),n.render(r,i),n.domElement}async function $t(e,t,r,i,n){if(e===0||t===0)return;W.length===0&&W.push(ye());const s=await $e(e,t,i,n),a=r.getContext("2d");a.clearRect(0,0,r.width,r.height),a.drawImage(s,0,0)}var Jt="srgb-linear";async function ye(){const e=(await b).ThreeWebGLRenderer,t=new e({antialias:!0,alpha:!0});return t.outputColorSpace=Jt,t.setPixelRatio(ue()),t}var Je=new x;Je.replaceSync(`
:host {
  width: 384px;
  height: 256px;
  display: grid;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: grid;
  overflow: hidden;
  place-content: center;
  contain: strict;
}

.loading {
  width: 4em;
  height: 4em;
  border-radius: 2.5em;
  border: 0.5em solid rgba(0, 0, 0, 0);
  border-top: 0.5em solid rgba(0, 0, 0, 0.7);
  border-right: 0.5em solid rgba(0, 0, 0, 0.7);
  animation: fade-in-delayed 4s, rotate 1s linear infinite;
}

@keyframes fade-in-delayed {
  0% { opacity: 0; }
  25% {opacity: 0; }
  100% { opacity: 1; }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* TODO: This is due to stats hack. Replace with \`canvas\`. */
.wrapper > canvas {
  max-width: 100%;
  max-height: 100%;
  animation: fade-in 0.25s ease-in;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.wrapper.invisible {
  opacity: 0;
}

.wrapper.drag-input-enabled > canvas {
  cursor: grab;
}

.wrapper.drag-input-enabled > canvas:active {
  cursor: grabbing;
}
`);var Kt=!0,le=500,er=50,tr=.75;function Ie(e){return(Math.exp(1-e)-(1-e))/(1-Math.E)+1}var rr=class{scheduler=new U(this.render.bind(this));lastTimestamp;startTimestamp;momentumX;momentumY;callback;constructor(e,t,r,i){this.startTimestamp=e,this.momentumX=t,this.momentumY=r,this.callback=i,this.scheduler.requestAnimFrame(),this.lastTimestamp=e}render(e){const t=(this.lastTimestamp-this.startTimestamp)/le,r=Math.min(1,(e-this.startTimestamp)/le);if(t===0&&r>er/le)return;const i=Ie(r)-Ie(t);this.callback(this.momentumX*i*1e3,this.momentumY*i*1e3),r<1&&this.scheduler.requestAnimFrame(),this.lastTimestamp=e}},ir=class{experimentalInertia=Kt;onMovementBound=this.onMovement.bind(this);experimentalHasBeenMoved=!1;model;mirror;canvas;dragTracker;constructor(e,t,r,i){this.model=e,this.mirror=t,this.canvas=r,this.dragTracker=i,this.dragTracker.addEventListener("move",this.onMove.bind(this)),this.dragTracker.addEventListener("up",this.onUp.bind(this))}temperMovement(e){return Math.sign(e)*Math.log(Math.abs(e*10)+1)/6}onMove(e){e.detail.attachedInfo??={};const{temperedX:t,temperedY:r}=this.onMovement(e.detail.movementX,e.detail.movementY),i=e.detail.attachedInfo;i.lastTemperedX=t*10,i.lastTemperedY=r*10,i.timestamp=e.timeStamp}onMovement(e,t){const r=this.mirror?-1:1,i=Math.min(this.canvas.offsetWidth,this.canvas.offsetHeight),n=this.temperMovement(e/i),s=this.temperMovement(t/i*tr);return this.model.twistySceneModel.orbitCoordinatesRequest.set((async()=>{const a=await this.model.twistySceneModel.orbitCoordinates.get();return{latitude:a.latitude+2*s*Q*r,longitude:a.longitude-2*n*Q}})()),{temperedX:n,temperedY:s}}onUp(e){e.preventDefault(),"lastTemperedX"in e.detail.attachedInfo&&"lastTemperedY"in e.detail.attachedInfo&&"timestamp"in e.detail.attachedInfo&&e.timeStamp-e.detail.attachedInfo.timestamp<60&&new rr(e.timeStamp,e.detail.attachedInfo.lastTemperedX,e.detail.attachedInfo.lastTemperedY,this.onMovementBound)}};async function Ke(e,t,r=!1){const i=new(await b).ThreeSpherical(t.distance,(90-(r?-1:1)*t.latitude)/Q,((r?180:0)+t.longitude)/Q);i.makeSafe(),e.position.setFromSpherical(i),e.lookAt(0,0,0)}var ke=0,nr=2,et=!1;function sr(){return ke<nr?(ke++,!1):(et=!0,!0)}function vn(){return et}var he=class extends S{scene=null;stats=null;rendererIsShared=sr();loadingElement=null;model;options;constructor(e,t,r){super(),this.model=e,this.options=r,this.scene=t??null,this.loadingElement=this.addElement(document.createElement("div")),this.loadingElement.classList.add("loading")}async connectedCallback(){this.addCSS(Je),this.addElement((await this.canvasInfo()).canvas),this.#s(),new ResizeObserver(this.#s.bind(this)).observe(this.contentWrapper),this.orbitControls(),this.#e(),this.scheduleRender()}async#e(){(await this.#l()).addEventListener("press",(async t=>{await this.model.twistySceneModel.movePressInput.get()==="basic"&&this.dispatchEvent(new CustomEvent("press",{detail:{pressInfo:t.detail,cameraPromise:this.camera()}}))}))}#t=new oe;async clearCanvas(){if(this.rendererIsShared){const e=await this.canvasInfo();e.context.clearRect(0,0,e.canvas.width,e.canvas.height)}else{const t=(await this.renderer()).getContext();t.clear(t.COLOR_BUFFER_BIT)}}#r=0;#i=0;async#s(){const e=await this.#t.queue(this.camera()),t=this.contentWrapper.clientWidth,r=this.contentWrapper.clientHeight;this.#r=t,this.#i=r;const i=0;let n=0,s=0;if(r>t&&(s=r-t,n=-Math.floor(.5*s)),e.aspect=t/r,e.setViewOffset(t,r-s,i,n,t,r),e.updateProjectionMatrix(),this.clearCanvas(),this.rendererIsShared){const a=await this.canvasInfo();a.canvas.width=t*ue(),a.canvas.height=r*ue(),a.canvas.style.width=`${t.toString()}px`,a.canvas.style.height=`${r.toString()}px`}else(await this.renderer()).setSize(t,r,!0);this.scheduleRender()}#n=null;async renderer(){if(this.rendererIsShared)throw new Error("renderer expected to be shared.");return this.#n??=ye()}#a=null;async canvasInfo(){return this.#a??=(async()=>{let e;if(this.rendererIsShared)e=this.addElement(document.createElement("canvas"));else{const r=await this.renderer();e=this.addElement(r.domElement)}this.loadingElement?.remove();const t=e.getContext("2d");return{canvas:e,context:t}})()}#o=null;async#l(){return this.#o??=(async()=>{const e=new Zt((await this.canvasInfo()).canvas);return this.model?.twistySceneModel.dragInput.addFreshListener(t=>{let r=!1;switch(t){case"auto":{e.start(),r=!0;break}case"none":{e.stop();break}}this.contentWrapper.classList.toggle("drag-input-enabled",r)}),e})()}#d=null;async camera(){return this.#d??=(async()=>{const e=new(await b).ThreePerspectiveCamera(20,1,.1,20);return e.position.copy(new(await b).ThreeVector3(2,4,4).multiplyScalar(this.options?.backView?-1:1)),e.lookAt(0,0,0),e})()}#u=null;async orbitControls(){return this.#u??=(async()=>{const e=new ir(this.model,!!this.options?.backView,(await this.canvasInfo()).canvas,await this.#l());return this.model&&this.addListener(this.model.twistySceneModel.orbitCoordinates,async t=>{const r=await this.camera();Ke(r,t,this.options?.backView),this.scheduleRender()}),e})()}addListener(e,t){e.addFreshListener(t),this.#c.push(()=>{e.removeFreshListener(t)})}#c=[];disconnect(){for(const e of this.#c)e();this.#c=[]}#h=null;experimentalNextRenderFinishedCallback(e){this.#h=e}async render(){if(!this.scene)throw new Error("Attempted to render without a scene");this.stats?.begin();const[e,t,r]=await Promise.all([this.scene.scene(),this.camera(),this.canvasInfo()]);this.rendererIsShared?await $t(this.#r,this.#i,r.canvas,e,t):(await this.renderer()).render(e,t),this.stats?.end(),this.#h?.(),this.#h=null}#m=new U(this.render.bind(this));scheduleRender(){this.#m.requestAnimFrame()}};y.define("twisty-3d-vantage",he);function A(e){switch(Math.abs(e)){case 0:return 0;case 1:return 1e3;case 2:return 1500;default:return 2e3}}var tt=class extends se{durationForAmount=A;constructor(e=A){super(),this.durationForAmount=e}traverseAlg(e){let t=0;for(const r of e.childAlgNodes())t+=this.traverseAlgNode(r);return t}traverseGrouping(e){return e.amount*this.traverseAlg(e.alg)}traverseMove(e){return this.durationForAmount(e.amount)}traverseCommutator(e){return 2*(this.traverseAlg(e.A)+this.traverseAlg(e.B))}traverseConjugate(e){return 2*this.traverseAlg(e.A)+this.traverseAlg(e.B)}traversePause(e){return this.durationForAmount(1)}traverseNewline(e){return this.durationForAmount(1)}traverseLineComment(e){return this.durationForAmount(0)}},rt=class{moves;durationFn=new tt(A);kpuzzle;constructor(e,t){this.kpuzzle=e,this.moves=new T(t.experimentalExpand())}getAnimLeaf(e){return Array.from(this.moves.childAlgNodes())[e]}indexToMoveStartTimestamp(e){const t=new T(Array.from(this.moves.childAlgNodes()).slice(0,e));return this.durationFn.traverseAlg(t)}timestampToIndex(e){let t=0,r;for(r=0;r<this.numAnimatedLeaves();r++)if(t+=this.durationFn.traverseMove(this.getAnimLeaf(r)),t>=e)return r;return r}patternAtIndex(e){return this.kpuzzle.defaultPattern().applyTransformation(this.transformationAtIndex(e))}transformationAtIndex(e){let t=this.kpuzzle.identityTransformation();for(const r of Array.from(this.moves.childAlgNodes()).slice(0,e))t=t.applyMove(r);return t}algDuration(){return this.durationFn.traverseAlg(this.moves)}numAnimatedLeaves(){return qt(this.moves)}moveDuration(e){return this.durationFn.traverseMove(this.getAnimLeaf(e))}},N=class{moveCount;duration;forward;backward;children=[];constructor(e,t,r,i,n=[]){this.moveCount=e,this.duration=t,this.forward=r,this.backward=i,this.children=n}},ar=class extends se{identity;dummyLeaf;durationFn=new tt(A);cache={};kpuzzle;constructor(e){super(),this.kpuzzle=e,this.identity=e.identityTransformation(),this.dummyLeaf=new N(0,0,this.identity,this.identity,[])}traverseAlg(e){let t=0,r=0,i=this.identity;const n=[];for(const s of e.childAlgNodes()){const a=this.traverseAlgNode(s);t+=a.moveCount,r+=a.duration,i===this.identity?i=a.forward:i=i.applyTransformation(a.forward),n.push(a)}return new N(t,r,i,i.invert(),n)}traverseGrouping(e){const t=this.traverseAlg(e.alg);return this.mult(t,e.amount,[t])}traverseMove(e){const t=e.toString();let r=this.cache[t];if(r)return r;const i=this.kpuzzle.moveToTransformation(e);return r=new N(1,this.durationFn.traverseAlgNode(e),i,i.invert()),this.cache[t]=r,r}traverseCommutator(e){const t=this.traverseAlg(e.A),r=this.traverseAlg(e.B),i=t.forward.applyTransformation(r.forward),n=t.backward.applyTransformation(r.backward),s=i.applyTransformation(n),a=new N(2*(t.moveCount+r.moveCount),2*(t.duration+r.duration),s,s.invert(),[t,r]);return this.mult(a,1,[a,t,r])}traverseConjugate(e){const t=this.traverseAlg(e.A),r=this.traverseAlg(e.B),n=t.forward.applyTransformation(r.forward).applyTransformation(t.backward),s=new N(2*t.moveCount+r.moveCount,2*t.duration+r.duration,n,n.invert(),[t,r]);return this.mult(s,1,[s,t,r])}traversePause(e){return e.experimentalNISSGrouping?this.dummyLeaf:new N(1,this.durationFn.traverseAlgNode(e),this.identity,this.identity)}traverseNewline(e){return this.dummyLeaf}traverseLineComment(e){return this.dummyLeaf}mult(e,t,r){const i=Math.abs(t),n=e.forward.selfMultiply(t);return new N(e.moveCount*i,e.duration*i,n,n.invert(),r)}},f=class{apd;back;constructor(e,t){this.apd=e,this.back=t}},or=class extends we{move;moveDuration;back;st;root;i;dur;goalIndex;goalDuration;kpuzzle;algOrAlgNode;apd;constructor(e,t,r){super(),this.kpuzzle=e,this.algOrAlgNode=t,this.apd=r,this.i=-1,this.dur=-1,this.goalIndex=-1,this.goalDuration=-1,this.move=void 0,this.back=!1,this.moveDuration=0,this.st=this.kpuzzle.identityTransformation(),this.root=new f(this.apd,!1)}moveByIndex(e){return this.i>=0&&this.i===e?this.move!==void 0:this.dosearch(e,1/0)}moveByDuration(e){return this.dur>=0&&this.dur<e&&this.dur+this.moveDuration>=e?this.move!==void 0:this.dosearch(1/0,e)}dosearch(e,t){return this.goalIndex=e,this.goalDuration=t,this.i=0,this.dur=0,this.move=void 0,this.moveDuration=0,this.back=!1,this.st=this.kpuzzle.identityTransformation(),this.algOrAlgNode.is(T)?this.traverseAlg(this.algOrAlgNode,this.root):this.traverseAlgNode(this.algOrAlgNode,this.root)}traverseAlg(e,t){if(!this.firstcheck(t))return!1;let r=t.back?e.experimentalNumChildAlgNodes()-1:0;for(const i of Ot(e.childAlgNodes(),t.back?C.Backwards:C.Forwards)){if(this.traverseAlgNode(i,new f(t.apd.children[r],t.back)))return!0;r+=t.back?-1:1}return!1}traverseGrouping(e,t){if(!this.firstcheck(t))return!1;const r=this.domult(t,e.amount);return this.traverseAlg(e.alg,new f(t.apd.children[0],r))}traverseMove(e,t){return this.firstcheck(t)?(this.move=e,this.moveDuration=t.apd.duration,this.back=t.back,!0):!1}traverseCommutator(e,t){if(!this.firstcheck(t))return!1;const r=this.domult(t,1);return r?this.traverseAlg(e.B,new f(t.apd.children[2],!r))||this.traverseAlg(e.A,new f(t.apd.children[1],!r))||this.traverseAlg(e.B,new f(t.apd.children[2],r))||this.traverseAlg(e.A,new f(t.apd.children[1],r)):this.traverseAlg(e.A,new f(t.apd.children[1],r))||this.traverseAlg(e.B,new f(t.apd.children[2],r))||this.traverseAlg(e.A,new f(t.apd.children[1],!r))||this.traverseAlg(e.B,new f(t.apd.children[2],!r))}traverseConjugate(e,t){if(!this.firstcheck(t))return!1;const r=this.domult(t,1);return r?this.traverseAlg(e.A,new f(t.apd.children[1],!r))||this.traverseAlg(e.B,new f(t.apd.children[2],r))||this.traverseAlg(e.A,new f(t.apd.children[1],r)):this.traverseAlg(e.A,new f(t.apd.children[1],r))||this.traverseAlg(e.B,new f(t.apd.children[2],r))||this.traverseAlg(e.A,new f(t.apd.children[1],!r))}traversePause(e,t){return this.firstcheck(t)?(this.move=e,this.moveDuration=t.apd.duration,this.back=t.back,!0):!1}traverseNewline(e,t){return!1}traverseLineComment(e,t){return!1}firstcheck(e){return e.apd.moveCount+this.i<=this.goalIndex&&e.apd.duration+this.dur<this.goalDuration?this.keepgoing(e):!0}domult(e,t){let r=e.back;if(t===0)return r;t<0&&(r=!r,t=-t);const i=e.apd.children[0],n=Math.min(Math.floor((this.goalIndex-this.i)/i.moveCount),Math.ceil((this.goalDuration-this.dur)/i.duration-1));return n>0&&this.keepgoing(new f(i,r),n),r}keepgoing(e,t=1){return this.i+=t*e.apd.moveCount,this.dur+=t*e.apd.duration,t!==1?e.back?this.st=this.st.applyTransformation(e.apd.backward.selfMultiply(t)):this.st=this.st.applyTransformation(e.apd.forward.selfMultiply(t)):e.back?this.st=this.st.applyTransformation(e.apd.backward):this.st=this.st.applyTransformation(e.apd.forward),!1}},lr=16;function cr(e,t){const r=new Se,i=new Se;for(const n of e.childAlgNodes())i.push(n),i.experimentalNumAlgNodes()>=t&&(r.push(new ie(i.toAlg())),i.reset());return r.push(new ie(i.toAlg())),r.toAlg()}var dr=class extends se{traverseAlg(e){const t=e.experimentalNumChildAlgNodes();return t<lr?e:cr(e,Math.ceil(Math.sqrt(t)))}traverseGrouping(e){return new ie(this.traverseAlg(e.alg),e.amount)}traverseMove(e){return e}traverseCommutator(e){return new Te(this.traverseAlg(e.A),this.traverseAlg(e.B))}traverseConjugate(e){return new Te(this.traverseAlg(e.A),this.traverseAlg(e.B))}traversePause(e){return e}traverseNewline(e){return e}traverseLineComment(e){return e}},ur=ae(dr),me=class{decoration;walker;kpuzzle;constructor(e,t){this.kpuzzle=e;const r=new ar(this.kpuzzle),i=ur(t);this.decoration=r.traverseAlg(i),this.walker=new or(this.kpuzzle,i,this.decoration)}getAnimLeaf(e){if(this.walker.moveByIndex(e)){if(!this.walker.move)throw new Error("`this.walker.mv` missing");const t=this.walker.move;return this.walker.back?t.invert():t}return null}indexToMoveStartTimestamp(e){if(this.walker.moveByIndex(e)||this.walker.i===e)return this.walker.dur;throw new Error(`Out of algorithm: index ${e}`)}indexToMovesInProgress(e){if(this.walker.moveByIndex(e)||this.walker.i===e)return this.walker.dur;throw new Error(`Out of algorithm: index ${e}`)}patternAtIndex(e,t){return this.walker.moveByIndex(e),(t??this.kpuzzle.defaultPattern()).applyTransformation(this.walker.st)}transformationAtIndex(e){return this.walker.moveByIndex(e),this.walker.st}numAnimatedLeaves(){return this.decoration.moveCount}timestampToIndex(e){return this.walker.moveByDuration(e),this.walker.i}algDuration(){return this.decoration.duration}moveDuration(e){return this.walker.moveByIndex(e),this.walker.moveDuration}},hr=class extends h{getDefaultValue(){return"auto"}},J="http://www.w3.org/2000/svg",Le="data-copy-id",Ae=0;function mr(){return Ae+=1,`svg${Ae.toString()}`}var pr={dim:{white:"#dddddd",orange:"#884400",limegreen:"#008800",red:"#660000","rgb(34, 102, 255)":"#000088",yellow:"#888800","rgb(102, 0, 153)":"rgb(50, 0, 76)",purple:"#3f003f"},oriented:"#44ddcc",ignored:"#555555",invisible:"#00000000"},it=class{wrapperElement;svgElement;gradientDefs;originalColors={};gradients={};svgID;kpuzzle;showUnknownOrientations=!1;constructor(e,t,r,i=!1){if(this.kpuzzle=e,this.showUnknownOrientations=i,!t)throw new Error(`No SVG definition for puzzle type: ${e.name()}`);this.svgID=mr(),this.wrapperElement=document.createElement("div"),this.wrapperElement.classList.add("svg-wrapper"),this.wrapperElement.innerHTML=t;const n=this.wrapperElement.querySelector("svg");if(!n)throw new Error("Could not get SVG element");if(this.svgElement=n,J!==n.namespaceURI)throw new Error("Unexpected XML namespace");n.style.maxWidth="100%",n.style.maxHeight="100%",this.gradientDefs=document.createElementNS(J,"defs"),n.insertBefore(this.gradientDefs,n.firstChild);for(const s of e.definition.orbits)for(let a=0;a<s.numPieces;a++)for(let o=0;o<s.numOrientations;o++){const c=this.elementID(s.orbitName,a,o),l=this.elementByID(c);let m=l?.style.fill;r?(()=>{const d=r.orbits;if(!d)return;const v=d[s.orbitName];if(!v)return;const g=v.pieces[a];if(!g)return;const z=g.facelets[o];if(!z)return;const Z=typeof z=="string"?z:z?.mask,L=pr[Z];typeof L=="string"?m=L:L&&(m=L[m])})():m=l?.style.fill,this.originalColors[c]=m,this.gradients[c]=this.newGradient(c,m),this.gradientDefs.appendChild(this.gradients[c]),l?.setAttribute("style",`fill: url(#grad-${this.svgID}-${c})`)}for(const s of Array.from(n.querySelectorAll(`[${Le}]`))){const a=s.getAttribute(Le);s.setAttribute("style",`fill: url(#grad-${this.svgID}-${a})`)}this.showUnknownOrientations&&this.drawPattern(this.kpuzzle.defaultPattern())}drawPattern(e,t,r){this.draw(e,t,r)}draw(e,t,r){const i=t?.experimentalToTransformation();if(!e)throw new Error("Distinguishable pieces are not handled for SVG yet!");for(const n of e.kpuzzle.definition.orbits){const s=e.patternData[n.orbitName],a=i?i.transformationData[n.orbitName]:null;for(let o=0;o<n.numPieces;o++)for(let c=0;c<n.numOrientations;c++){const l=this.elementID(n.orbitName,o,c),m=this.elementID(n.orbitName,s.pieces[o],(n.numOrientations-s.orientation[o]+c)%n.numOrientations);let d=!1;if(a){const v=this.elementID(n.orbitName,a.permutation[o],(n.numOrientations-a.orientationDelta[o]+c)%n.numOrientations);m===v&&(d=!0),r=r||0;const g=100*(1-r*r*(2-r*r));this.gradients[l].children[0].setAttribute("stop-color",this.originalColors[m]),this.gradients[l].children[0].setAttribute("offset",`${Math.max(g-5,0)}%`),this.gradients[l].children[1].setAttribute("offset",`${Math.max(g-5,0)}%`),this.gradients[l].children[2].setAttribute("offset",`${g}%`),this.gradients[l].children[3].setAttribute("offset",`${g}%`),this.gradients[l].children[3].setAttribute("stop-color",this.originalColors[v])}else d=!0;d&&(this.showUnknownOrientations&&s.orientationMod?.[o]===1?(this.gradients[l].children[0].setAttribute("stop-color","#000"),this.gradients[l].children[0].setAttribute("offset","5%"),this.gradients[l].children[1].setAttribute("offset","5%"),this.gradients[l].children[2].setAttribute("offset","20%"),this.gradients[l].children[3].setAttribute("offset","20%"),this.gradients[l].children[3].setAttribute("stop-color",this.originalColors[m])):(this.gradients[l].children[0].setAttribute("stop-color",this.originalColors[m]),this.gradients[l].children[0].setAttribute("offset","100%"),this.gradients[l].children[1].setAttribute("offset","100%"),this.gradients[l].children[2].setAttribute("offset","100%"),this.gradients[l].children[3].setAttribute("offset","100%")))}}}newGradient(e,t){const r=document.createElementNS(J,"radialGradient");r.setAttribute("id",`grad-${this.svgID}-${e}`),r.setAttribute("r","70.7107%");const i=[{offset:0,color:t},{offset:0,color:"black"},{offset:0,color:"black"},{offset:0,color:t}];for(const n of i){const s=document.createElementNS(J,"stop");s.setAttribute("offset",`${n.offset}%`),s.setAttribute("stop-color",n.color),s.setAttribute("stop-opacity","1"),r.appendChild(s)}return r}elementID(e,t,r){return`${e}-l${t}-o${r}`}elementByID(e){return this.wrapperElement.querySelector(`#${e}`)}},G=class{#e=null;elem;prefix;validSuffixes;constructor(e,t,r){this.elem=e,this.prefix=t,this.validSuffixes=r}clearValue(){this.#e&&this.elem.contentWrapper.classList.remove(this.#e),this.#e=null}setValue(e){if(!this.validSuffixes.includes(e))throw new Error(`Invalid suffix: ${e}`);const t=`${this.prefix}${e}`,r=this.#e!==t;return r&&(this.clearValue(),this.elem.contentWrapper.classList.add(t),this.#e=t),r}};function pe(e,t){if(e===t)return!0;if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(e[r]!==t[r])return!1;return!0}function De(e,t,r){if(e===t)return!0;if(e.length!==t.length)return!1;for(let i=0;i<e.length;i++)if(!r(e[i],t[i]))return!1;return!0}function ge(e,t,r){return Rt(e,r-t,t)}var M={Forwards:1,Paused:0,Backwards:-1};var D={Move:"move",EntireTimeline:"entire-timeline"},gr=class{catchingUp=!1;pendingFrame=!1;tempoScale=1;model;constructor(e){this.model=e,e.tempoScale.addFreshListener(t=>{this.tempoScale=t})}scheduler=new U(this.animFrame.bind(this));start(){this.catchingUp||(this.lastTimestamp=performance.now()),this.catchingUp=!0,this.pendingFrame=!0,this.scheduler.requestAnimFrame()}stop(){this.catchingUp=!1,this.scheduler.cancelAnimFrame()}catchUpMs=500;lastTimestamp=0;animFrame(e){this.scheduler.requestAnimFrame();const t=this.tempoScale*(e-this.lastTimestamp)/this.catchUpMs;this.lastTimestamp=e,this.model.catchUpMove.set((async()=>{const r=await this.model.catchUpMove.get();if(r.move===null)return r;const i=r.amount+t;return i>=1?(this.pendingFrame=!0,this.stop(),this.model.timestampRequest.set("end"),{move:null,amount:0}):(this.pendingFrame=!1,{move:r.move,amount:i})})())}},fr=class{playing=!1;direction=M.Forwards;catchUpHelper;model;lastDatestamp=0;lastTimestampPromise;scheduler=new U(this.animFrame.bind(this));delegate;constructor(e,t){this.delegate=t,this.model=e,this.lastTimestampPromise=this.#e(),this.model.playingInfo.addFreshListener(this.onPlayingProp.bind(this)),this.catchUpHelper=new gr(this.model),this.model.catchUpMove.addFreshListener(this.onCatchUpMoveProp.bind(this))}async onPlayingProp(e){e.playing!==this.playing&&(e.playing?this.play(e):this.pause())}async onCatchUpMoveProp(e){const t=e.move!==null;t!==this.catchUpHelper.catchingUp&&(t?this.catchUpHelper.start():this.catchUpHelper.stop()),this.scheduler.requestAnimFrame()}async#e(){return(await this.model.detailedTimelineInfo.get()).timestamp}jumpToStart(e){this.model.timestampRequest.set("start"),this.pause(),e?.flash&&this.delegate.flash()}jumpToEnd(e){this.model.timestampRequest.set("end"),this.pause(),e?.flash&&this.delegate.flash()}playPause(){this.playing?this.pause():this.play()}play(e){(async()=>{const t=e?.direction??M.Forwards,r=await this.model.coarseTimelineInfo.get();(e?.autoSkipToOtherEndIfStartingAtBoundary??!0)&&(t===M.Forwards&&r.atEnd&&(this.model.timestampRequest.set("start"),this.delegate.flash()),t===M.Backwards&&r.atStart&&(this.model.timestampRequest.set("end"),this.delegate.flash())),this.model.playingInfo.set({playing:!0,direction:t,untilBoundary:e?.untilBoundary??D.EntireTimeline,loop:e?.loop??!1}),this.playing=!0,this.lastDatestamp=performance.now(),this.lastTimestampPromise=this.#e(),this.scheduler.requestAnimFrame()})()}pause(){this.playing=!1,this.scheduler.cancelAnimFrame(),this.model.playingInfo.set({playing:!1,untilBoundary:D.EntireTimeline})}#t=new oe;async animFrame(e){this.playing&&this.scheduler.requestAnimFrame();const t=this.lastDatestamp,r=await this.#t.queue(Promise.all([this.model.playingInfo.get(),this.lastTimestampPromise,this.model.timeRange.get(),this.model.tempoScale.get(),this.model.currentMoveInfo.get()])),[i,n,s,a,o]=r;if(!i.playing){this.playing=!1;return}let c=o.earliestEnd;(o.currentMoves.length===0||i.untilBoundary===D.EntireTimeline)&&(c=s.end);let l=o.latestStart;(o.currentMoves.length===0||i.untilBoundary===D.EntireTimeline)&&(l=s.start);let m=(e-t)*this.direction*a;m=Math.max(m,1),m*=i.direction;let d=n+m,v=null;d>=c?i.loop?d=ge(d,s.start,s.end):(d===s.end?v="end":d=c,this.playing=!1,this.model.playingInfo.set({playing:!1})):d<=l&&(i.loop?d=ge(d,s.start,s.end):(d===s.start?v="start":d=l,this.playing=!1,this.model.playingInfo.set({playing:!1}))),this.lastDatestamp=e,this.lastTimestampPromise=Promise.resolve(d),this.model.timestampRequest.set(v??d)}},vr=class{animationController;model;constructor(e,t){this.model=e,this.animationController=new fr(e,t)}jumpToStart(e){this.animationController.jumpToStart(e)}jumpToEnd(e){this.animationController.jumpToEnd(e)}togglePlay(e){typeof e>"u"&&this.animationController.playPause(),e?this.animationController.play():this.animationController.pause()}async visitTwizzleLink(){const e=document.createElement("a");e.href=await this.model.twizzleLink(),e.target="_blank",e.click()}},wr={"bottom-row":!0,none:!0},yr=class extends h{getDefaultValue(){return"auto"}},Me=new x;Me.replaceSync(`
:host {
  width: 384px;
  height: 256px;
  display: grid;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: grid;
  overflow: hidden;
}

.wrapper > * {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wrapper.back-view-side-by-side {
  grid-template-columns: 1fr 1fr;
}

.wrapper.back-view-top-right {
  grid-template-columns: 3fr 1fr;
  grid-template-rows: 1fr 3fr;
}

.wrapper.back-view-top-right > :nth-child(1) {
  grid-row: 1 / 3;
  grid-column: 1 / 3;
}

.wrapper.back-view-top-right > :nth-child(2) {
  grid-row: 1 / 2;
  grid-column: 2 / 3;
}
`);var nt=new x;nt.replaceSync(`
:host {
  width: 384px;
  height: 256px;
  display: grid;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: grid;
  overflow: hidden;
}

.svg-wrapper,
twisty-2d-svg,
svg {
  width: 100%;
  height: 100%;
  display: grid;
  min-height: 0;
}

svg {
  animation: fade-in 0.25s ease-in;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.hint-facelets-none .hint-facelet {
  display: none;
}
`);var st=class extends S{svgWrapper;scheduler=new U(this.render.bind(this));#e=null;model;kpuzzle;svgSource;options;puzzleLoader;constructor(e,t,r,i,n){super(),this.model=e,this.kpuzzle=t,this.svgSource=r,this.options=i,this.addCSS(nt),this.resetSVG(),this.#t.addListener(this.model.puzzleID,s=>{n?.id!==s&&this.disconnect()}),this.#t.addListener(this.model.twistySceneModel.hintFacelet,s=>{this.setHintFacelet(s)}),this.#t.addListener(this.model.legacyPosition,this.onPositionChange.bind(this)),this.options?.experimentalStickeringMask&&this.experimentalSetStickeringMask(this.options.experimentalStickeringMask)}#t=new _;disconnect(){this.#t.disconnect()}onPositionChange(e){try{if(e.movesInProgress.length>0){const t=e.movesInProgress[0].move;let r=t;e.movesInProgress[0].direction===M.Backwards&&(r=t.invert());const i=e.pattern.applyMove(r);this.svgWrapper?.draw(e.pattern,i,e.movesInProgress[0].fraction)}else this.svgWrapper?.draw(e.pattern),this.#e=e}catch(t){console.warn("Bad position (this doesn't necessarily mean something is wrong). Pre-emptively disconnecting:",this.puzzleLoader?.id,t),this.disconnect()}}scheduleRender(){this.scheduler.requestAnimFrame()}experimentalSetStickeringMask(e){this.resetSVG(e)}resetSVG(e){this.svgWrapper&&this.removeElement(this.svgWrapper.wrapperElement),this.kpuzzle&&(this.svgWrapper=new it(this.kpuzzle,this.svgSource,e),this.addElement(this.svgWrapper.wrapperElement),this.#e&&this.onPositionChange(this.#e))}hintFaceletsClassListManager=new G(this,"hint-facelets-",Object.keys(_t));setHintFacelet(e){this.hintFaceletsClassListManager.setValue(e==="auto"?"floating":e)}render(){}};y.define("twisty-2d-puzzle",st);var Mr=class{model;schedulable;puzzleLoader;effectiveVisualization;constructor(e,t,r,i){this.model=e,this.schedulable=t,this.puzzleLoader=r,this.effectiveVisualization=i,this.twisty2DPuzzle(),this.#e.addListener(this.model.twistySceneModel.stickeringMask,async n=>{(await this.twisty2DPuzzle()).experimentalSetStickeringMask(n)})}#e=new _;disconnect(){this.#e.disconnect()}scheduleRender(){}#t=null;async twisty2DPuzzle(){return this.#t??=(async()=>{const e=this.effectiveVisualization==="experimental-2D-LL-face"?this.puzzleLoader.llFaceSVG():this.effectiveVisualization==="experimental-2D-LL"?this.puzzleLoader.llSVG():this.puzzleLoader.svg();return new st(this.model,await this.puzzleLoader.kpuzzle(),await e,{},this.puzzleLoader)})()}},at=class extends S{#e=new _;disconnect(){this.#e.disconnect()}model;effectiveVisualization;constructor(e,t){super(),this.model=e,this.effectiveVisualization=t}async connectedCallback(){this.addCSS(Me),this.model&&this.#e.addListener(this.model.twistyPlayerModel.puzzleLoader,this.onPuzzleLoader.bind(this))}#t;async scene(){return this.#t??=(async()=>new(await b).ThreeScene)()}scheduleRender(){this.#r?.scheduleRender()}#r;currentTwisty2DPuzzleWrapper(){return this.#r}async setCurrentTwisty2DPuzzleWrapper(e){const t=this.#r;this.#r=e,t?.disconnect();const r=e.twisty2DPuzzle();this.contentWrapper.textContent="",this.addElement(await r)}async onPuzzleLoader(e){this.#r?.disconnect();const t=new Mr(this.model.twistyPlayerModel,this,e,this.effectiveVisualization);this.setCurrentTwisty2DPuzzleWrapper(t)}};y.define("twisty-2d-scene-wrapper",at);var ot=class{#e;reject;promise;constructor(){this.promise=new Promise((e,t)=>{this.#e=e,this.reject=t})}handleNewValue(e){this.#e(e)}},lt=class extends EventTarget{model;schedulable;puzzleLoader;visualizationStrategy;constructor(e,t,r,i){super(),this.model=e,this.schedulable=t,this.puzzleLoader=r,this.visualizationStrategy=i,this.twisty3DPuzzle(),this.#e.addListener(this.model.puzzleLoader,n=>{this.puzzleLoader.id!==n.id&&this.disconnect()}),this.#e.addListener(this.model.legacyPosition,async n=>{try{(await this.twisty3DPuzzle()).onPositionChange(n),this.scheduleRender()}catch{this.disconnect()}}),this.#e.addListener(this.model.twistySceneModel.hintFacelet,async n=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({hintFacelets:n==="auto"?"floating":n}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.foundationDisplay,async n=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({showFoundation:n!=="none"}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.stickeringMask,async n=>{(await this.twisty3DPuzzle()).setStickeringMask(n),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.faceletScale,async n=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({faceletScale:n}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.hintFaceletsElevation,async n=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({hintFaceletsElevation:n}),this.scheduleRender()}),this.#e.addMultiListener3([this.model.twistySceneModel.stickeringMask,this.model.twistySceneModel.foundationStickerSprite,this.model.twistySceneModel.hintStickerSprite],async n=>{"experimentalUpdateTexture"in await this.twisty3DPuzzle()&&((await this.twisty3DPuzzle()).experimentalUpdateTexture(n[0].specialBehaviour==="picture",n[1],n[2]),this.scheduleRender())})}#e=new _;disconnect(){this.#e.disconnect()}scheduleRender(){this.schedulable.scheduleRender(),this.dispatchEvent(new CustomEvent("render-scheduled"))}#t=null;async twisty3DPuzzle(){return this.#t??=(async()=>{if(this.puzzleLoader.id==="3x3x3"&&this.visualizationStrategy==="Cube3D"){const[e,t,r,i,n,s]=await Promise.all([this.model.twistySceneModel.foundationStickerSprite.get(),this.model.twistySceneModel.hintStickerSprite.get(),this.model.twistySceneModel.stickeringMask.get(),this.model.twistySceneModel.initialHintFaceletsAnimation.get(),this.model.twistySceneModel.faceletScale.get(),this.model.twistySceneModel.hintFaceletsElevation.get()]);return(await b).cube3DShim(()=>this.schedulable.scheduleRender(),{foundationSprite:e,hintSprite:t,experimentalStickeringMask:r,initialHintFaceletsAnimation:i,faceletScale:n,hintFaceletsElevation:s})}else{const[e,t,r,i]=await Promise.all([this.model.twistySceneModel.hintFacelet.get(),this.model.twistySceneModel.foundationStickerSprite.get(),this.model.twistySceneModel.hintStickerSprite.get(),this.model.twistySceneModel.faceletScale.get()]),n=(await b).pg3dShim(()=>this.schedulable.scheduleRender(),this.puzzleLoader,e==="auto"?"floating":e,i,this.puzzleLoader.id==="kilominx");return n.then(s=>s.experimentalUpdateTexture(!0,t??void 0,r??void 0)),n}})()}async raycastMove(e,t){const r=await this.twisty3DPuzzle();if(!("experimentalGetControlTargets"in r)){console.info("not PG3D! skipping raycast");return}const i=r.experimentalGetControlTargets(),[n,s]=await Promise.all([e,this.model.twistySceneModel.movePressCancelOptions.get()]),a=n.intersectObjects(i);if(a.length>0){const o=r.getClosestMoveToAxis(a[0].point,t);o?this.model.experimentalAddMove(o.move,{cancel:s}):console.info("Skipping move!")}}},fe=class extends S{#e=new G(this,"back-view-",["auto","none","side-by-side","top-right"]);#t=new _;disconnect(){this.#t.disconnect()}model;constructor(e){super(),this.model=e}async connectedCallback(){this.addCSS(Me);const e=new he(this.model,this);this.addVantage(e),this.model&&(this.#t.addMultiListener([this.model.puzzleLoader,this.model.visualizationStrategy],this.onPuzzle.bind(this)),this.#t.addListener(this.model.backView,this.setBackView.bind(this))),this.scheduleRender()}#r=null;setBackView(e){const t=["side-by-side","top-right"].includes(e),r=this.#r!==null;this.#e.setValue(e),t?r||(this.#r=new he(this.model,this,{backView:!0}),this.addVantage(this.#r),this.scheduleRender()):this.#r&&(this.removeVantage(this.#r),this.#r=null)}async onPress(e){const t=this.#n;if(!t){console.info("no wrapper; skipping scene wrapper press!");return}const r=(async()=>{const[i,{ThreeRaycaster:n,ThreeVector2:s}]=await Promise.all([e.detail.cameraPromise,(async()=>{const{ThreeRaycaster:c,ThreeVector2:l}=await b;return{ThreeRaycaster:c,ThreeVector2:l}})()]),a=new n,o=new s(e.detail.pressInfo.normalizedX,e.detail.pressInfo.normalizedY);return a.setFromCamera(o,i),a})();await t.raycastMove(r,{invert:!e.detail.pressInfo.rightClick,depth:e.detail.pressInfo.keys.ctrlOrMetaKey?"rotation":e.detail.pressInfo.keys.shiftKey?"secondSlice":"none"})}#i;async scene(){return this.#i??=(async()=>new(await b).ThreeScene)()}#s=new Set;addVantage(e){e.addEventListener("press",this.onPress.bind(this)),this.#s.add(e),this.contentWrapper.appendChild(e)}removeVantage(e){this.#s.delete(e),e.remove(),e.disconnect(),this.#n?.disconnect()}experimentalVantages(){return this.#s.values()}scheduleRender(){for(const e of this.#s)e.scheduleRender()}#n=null;async setCurrentTwisty3DPuzzleWrapper(e,t){const r=this.#n;try{this.#n=t,r?.disconnect(),e.add(await t.twisty3DPuzzle())}finally{r&&e.remove(await r.twisty3DPuzzle())}this.#a.handleNewValue(t)}#a=new ot;async experimentalTwisty3DPuzzleWrapper(){return this.#n||this.#a.promise}#o=new oe;async onPuzzle(e){if(e[1]==="2D")return;this.#n?.disconnect();const[t,r]=await this.#o.queue(Promise.all([this.scene(),new lt(this.model,this,e[0],e[1])]));this.setCurrentTwisty3DPuzzleWrapper(t,r)}};y.define("twisty-3d-scene-wrapper",fe);var E=typeof document>"u"?null:document,xr=E?.fullscreenEnabled||!!E?.webkitFullscreenEnabled;function Tr(){return document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen()}function Ce(){return document.fullscreenElement?document.fullscreenElement:document.webkitFullscreenElement??null}function Sr(e){return e.requestFullscreen?e.requestFullscreen():e.webkitRequestFullscreen()}var zr=["skip-to-start","skip-to-end","step-forward","step-backward","pause","play","enter-fullscreen","exit-fullscreen","twizzle-tw"],br=class extends p{derive(e){return{fullscreen:{enabled:xr,icon:document.fullscreenElement===null?"enter-fullscreen":"exit-fullscreen",title:"Enter fullscreen"},"jump-to-start":{enabled:!e.coarseTimelineInfo.atStart,icon:"skip-to-start",title:"Restart"},"play-step-backwards":{enabled:!e.coarseTimelineInfo.atStart,icon:"step-backward",title:"Step backward"},"play-pause":{enabled:!(e.coarseTimelineInfo.atStart&&e.coarseTimelineInfo.atEnd),icon:e.coarseTimelineInfo.playing?"pause":"play",title:e.coarseTimelineInfo.playing?"Pause":"Play"},"play-step":{enabled:!e.coarseTimelineInfo.atEnd,icon:"step-forward",title:"Step forward"},"jump-to-end":{enabled:!e.coarseTimelineInfo.atEnd,icon:"skip-to-end",title:"Skip to End"},"twizzle-link":{enabled:!0,icon:"twizzle-tw",title:"View at Twizzle",hidden:e.viewerLink==="none"}}}},ct=new x;ct.replaceSync(`
:host {
  width: 384px;
  height: 24px;
  display: grid;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: grid;
  overflow: hidden;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.wrapper {
  grid-auto-flow: column;
}

.viewer-link-none .twizzle-link-button {
  display: none;
}

.wrapper twisty-button,
.wrapper twisty-control-button {
  width: inherit;
  height: inherit;
}
`);var dt=new x;dt.replaceSync(`
:host:not([hidden]) {
  display: grid;
}

:host {
  width: 48px;
  height: 24px;
}

.wrapper {
  width: 100%;
  height: 100%;
}

button {
  width: 100%;
  height: 100%;
  border: none;
  
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;

  background-color: rgba(196, 196, 196, 0.75);
}

button:enabled {
  background-color: rgba(196, 196, 196, 0.75)
}

.dark-mode button:enabled {
  background-color: #88888888;
}

button:disabled {
  background-color: rgba(0, 0, 0, 0.4);
  opacity: 0.25;
  pointer-events: none;
}

.dark-mode button:disabled {
  background-color: #ffffff44;
}

button:enabled:hover {
  background-color: rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 1em rgba(0, 0, 0, 0.25);
  cursor: pointer;
}

/* TODO: fullscreen icons have too much padding?? */
.svg-skip-to-start button,
button.svg-skip-to-start {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNTg0IiBoZWlnaHQ9IjM1ODQiIHZpZXdCb3g9IjAgMCAzNTg0IDM1ODQiPjxwYXRoIGQ9Ik0yNjQzIDEwMzdxMTktMTkgMzItMTN0MTMgMzJ2MTQ3MnEwIDI2LTEzIDMydC0zMi0xM2wtNzEwLTcxMHEtOS05LTEzLTE5djcxMHEwIDI2LTEzIDMydC0zMi0xM2wtNzEwLTcxMHEtOS05LTEzLTE5djY3OHEwIDI2LTE5IDQ1dC00NSAxOUg5NjBxLTI2IDAtNDUtMTl0LTE5LTQ1VjEwODhxMC0yNiAxOS00NXQ0NS0xOWgxMjhxMjYgMCA0NSAxOXQxOSA0NXY2NzhxNC0xMSAxMy0xOWw3MTAtNzEwcTE5LTE5IDMyLTEzdDEzIDMydjcxMHE0LTExIDEzLTE5eiIvPjwvc3ZnPg==");
}

.svg-skip-to-end button,
button.svg-skip-to-end {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNTg0IiBoZWlnaHQ9IjM1ODQiIHZpZXdCb3g9IjAgMCAzNTg0IDM1ODQiPjxwYXRoIGQ9Ik05NDEgMjU0N3EtMTkgMTktMzIgMTN0LTEzLTMyVjEwNTZxMC0yNiAxMy0zMnQzMiAxM2w3MTAgNzEwcTggOCAxMyAxOXYtNzEwcTAtMjYgMTMtMzJ0MzIgMTNsNzEwIDcxMHE4IDggMTMgMTl2LTY3OHEwLTI2IDE5LTQ1dDQ1LTE5aDEyOHEyNiAwIDQ1IDE5dDE5IDQ1djE0MDhxMCAyNi0xOSA0NXQtNDUgMTloLTEyOHEtMjYgMC00NS0xOXQtMTktNDV2LTY3OHEtNSAxMC0xMyAxOWwtNzEwIDcxMHEtMTkgMTktMzIgMTN0LTEzLTMydi03MTBxLTUgMTAtMTMgMTl6Ii8+PC9zdmc+");
}

.svg-step-forward button,
button.svg-step-forward {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNTg0IiBoZWlnaHQ9IjM1ODQiIHZpZXdCb3g9IjAgMCAzNTg0IDM1ODQiPjxwYXRoIGQ9Ik0yNjg4IDE1NjhxMCAyNi0xOSA0NWwtNTEyIDUxMnEtMTkgMTktNDUgMTl0LTQ1LTE5cS0xOS0xOS0xOS00NXYtMjU2aC0yMjRxLTk4IDAtMTc1LjUgNnQtMTU0IDIxLjVxLTc2LjUgMTUuNS0xMzMgNDIuNXQtMTA1LjUgNjkuNXEtNDkgNDIuNS04MCAxMDF0LTQ4LjUgMTM4LjVxLTE3LjUgODAtMTcuNSAxODEgMCA1NSA1IDEyMyAwIDYgMi41IDIzLjV0Mi41IDI2LjVxMCAxNS04LjUgMjV0LTIzLjUgMTBxLTE2IDAtMjgtMTctNy05LTEzLTIydC0xMy41LTMwcS03LjUtMTctMTAuNS0yNC0xMjctMjg1LTEyNy00NTEgMC0xOTkgNTMtMzMzIDE2Mi00MDMgODc1LTQwM2gyMjR2LTI1NnEwLTI2IDE5LTQ1dDQ1LTE5cTI2IDAgNDUgMTlsNTEyIDUxMnExOSAxOSAxOSA0NXoiLz48L3N2Zz4=");
}

.svg-step-backward button,
button.svg-step-backward {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNTg0IiBoZWlnaHQ9IjM1ODQiIHZpZXdCb3g9IjAgMCAzNTg0IDM1ODQiPjxwYXRoIGQ9Ik0yNjg4IDIwNDhxMCAxNjYtMTI3IDQ1MS0zIDctMTAuNSAyNHQtMTMuNSAzMHEtNiAxMy0xMyAyMi0xMiAxNy0yOCAxNy0xNSAwLTIzLjUtMTB0LTguNS0yNXEwLTkgMi41LTI2LjV0Mi41LTIzLjVxNS02OCA1LTEyMyAwLTEwMS0xNy41LTE4MXQtNDguNS0xMzguNXEtMzEtNTguNS04MC0xMDF0LTEwNS41LTY5LjVxLTU2LjUtMjctMTMzLTQyLjV0LTE1NC0yMS41cS03Ny41LTYtMTc1LjUtNmgtMjI0djI1NnEwIDI2LTE5IDQ1dC00NSAxOXEtMjYgMC00NS0xOWwtNTEyLTUxMnEtMTktMTktMTktNDV0MTktNDVsNTEyLTUxMnExOS0xOSA0NS0xOXQ0NSAxOXExOSAxOSAxOSA0NXYyNTZoMjI0cTcxMyAwIDg3NSA0MDMgNTMgMTM0IDUzIDMzM3oiLz48L3N2Zz4=");
}

.svg-pause button,
button.svg-pause {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNTg0IiBoZWlnaHQ9IjM1ODQiIHZpZXdCb3g9IjAgMCAzNTg0IDM1ODQiPjxwYXRoIGQ9Ik0yNTYwIDEwODh2MTQwOHEwIDI2LTE5IDQ1dC00NSAxOWgtNTEycS0yNiAwLTQ1LTE5dC0xOS00NVYxMDg4cTAtMjYgMTktNDV0NDUtMTloNTEycTI2IDAgNDUgMTl0MTkgNDV6bS04OTYgMHYxNDA4cTAgMjYtMTkgNDV0LTQ1IDE5aC01MTJxLTI2IDAtNDUtMTl0LTE5LTQ1VjEwODhxMC0yNiAxOS00NXQ0NS0xOWg1MTJxMjYgMCA0NSAxOXQxOSA0NXoiLz48L3N2Zz4=");
}

.svg-play button,
button.svg-play {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNTg0IiBoZWlnaHQ9IjM1ODQiIHZpZXdCb3g9IjAgMCAzNTg0IDM1ODQiPjxwYXRoIGQ9Ik0yNDcyLjUgMTgyM2wtMTMyOCA3MzhxLTIzIDEzLTM5LjUgM3QtMTYuNS0zNlYxMDU2cTAtMjYgMTYuNS0zNnQzOS41IDNsMTMyOCA3MzhxMjMgMTMgMjMgMzF0LTIzIDMxeiIvPjwvc3ZnPg==");
}

.svg-enter-fullscreen button,
button.svg-enter-fullscreen {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgd2lkdGg9IjI4Ij48cGF0aCBkPSJNMiAyaDI0djI0SDJ6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTkgMTZIN3Y1aDV2LTJIOXYtM3ptLTItNGgyVjloM1Y3SDd2NXptMTIgN2gtM3YyaDV2LTVoLTJ2M3pNMTYgN3YyaDN2M2gyVjdoLTV6Ii8+PC9zdmc+");
}

.svg-exit-fullscreen button,
button.svg-exit-fullscreen {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgd2lkdGg9IjI4Ij48cGF0aCBkPSJNMiAyaDI0djI0SDJ6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTcgMThoM3YzaDJ2LTVIN3Yyem0zLThIN3YyaDVWN2gtMnYzem02IDExaDJ2LTNoM3YtMmgtNXY1em0yLTExVjdoLTJ2NWg1di0yaC0zeiIvPjwvc3ZnPg==");
}

.svg-twizzle-tw button,
button.svg-twizzle-tw {
  background-image: url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODY0IiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMzk3LjU4MSAxNTEuMTh2NTcuMDg0aC04OS43MDN2MjQwLjM1MmgtNjYuOTU1VjIwOC4yNjRIMTUxLjIydi01Ny4wODNoMjQ2LjM2MXptNTQuMzEgNzEuNjc3bDcuNTEyIDMzLjY5MmMyLjcxOCAxMi4xNiA1LjU4IDI0LjY4IDguNTg0IDM3LjU1NWEyMTgwLjc3NSAyMTgwLjc3NSAwIDAwOS40NDIgMzguODQzIDEyNjYuMyAxMjY2LjMgMCAwMDEwLjA4NiAzNy41NTVjMy43Mi0xMi41OSA3LjM2OC0yNS40NjYgMTAuOTQ1LTM4LjYyOCAzLjU3Ni0xMy4xNjIgNy4wMS0yNi4xMSAxMC4zLTM4Ljg0M2w1Ljc2OS0yMi40NTZjMS4yNDgtNC44ODcgMi40NzItOS43MDUgMy42NzQtMTQuNDU1IDMuMDA0LTExLjg3NSA1LjY1MS0yMi45NjIgNy45NC0zMy4yNjNoNDYuMzU0bDIuMzg0IDEwLjU2M2EyMDAwLjc3IDIwMDAuNzcgMCAwMDMuOTM1IDE2LjgyOGw2LjcxMSAyNy43MWMxLjIxMyA0Ljk1NiAyLjQ1IDkuOTggMy43MDkgMTUuMDczYTMxMTkuNzc3IDMxMTkuNzc3IDAgMDA5Ljg3MSAzOC44NDMgMTI0OS4yMjcgMTI0OS4yMjcgMCAwMDEwLjczIDM4LjYyOCAxOTA3LjYwNSAxOTA3LjYwNSAwIDAwMTAuMzAxLTM3LjU1NSAxMzk3Ljk0IDEzOTcuOTQgMCAwMDkuNjU3LTM4Ljg0M2w0LjQtMTkuMDQ2Yy43MTUtMy4xMyAxLjQyMS02LjIzNiAyLjExOC05LjMyMWw5LjU3Ny00Mi44OGg2Ni41MjZhMjk4OC43MTggMjk4OC43MTggMCAwMS0xOS41MjkgNjYuMzExbC01LjcyOCAxOC40ODJhMzIzNy40NiAzMjM3LjQ2IDAgMDEtMTQuMDE1IDQzLjc1MmMtNi40MzggMTkuNi0xMi43MzMgMzcuNjk4LTE4Ljg4NSA1NC4yOTRsLTMuMzA2IDguODI1Yy00Ljg4NCAxMi44OTgtOS40MzMgMjQuMjYzLTEzLjY0NyAzNC4wOTVoLTQ5Ljc4N2E4NDE3LjI4OSA4NDE3LjI4OSAwIDAxLTIxLjAzMS02NC44MDkgMTI4OC42ODYgMTI4OC42ODYgMCAwMS0xOC44ODUtNjQuODEgMTk3Mi40NDQgMTk3Mi40NDQgMCAwMS0xOC4yNCA2NC44MSAyNTc5LjQxMiAyNTc5LjQxMiAwIDAxLTIwLjM4OCA2NC44MWgtNDkuNzg3Yy00LjY4Mi0xMC45MjYtOS43Mi0yMy43NDMtMTUuMTEtMzguNDUxbC0xLjYyOS00LjQ3Yy01LjI1OC0xNC41MjEtMTAuNjgtMzAuMTkyLTE2LjI2Ni00Ny4wMTRsLTIuNDA0LTcuMjhjLTYuNDM4LTE5LjYtMTMuMDItNDAuMzQ0LTE5Ljc0My02Mi4yMzRhMjk4OC43MDcgMjk4OC43MDcgMCAwMS0xOS41MjktNjYuMzExaDY3LjM4NXoiIGZpbGw9IiM0Mjg1RjQiIGZpbGwtcnVsZT0ibm9uemVybyIvPjwvc3ZnPg==");
}
`);var Ee={fullscreen:!0,"jump-to-start":!0,"play-step-backwards":!0,"play-pause":!0,"play-step":!0,"jump-to-end":!0,"twizzle-link":!0},ut=class extends S{buttons=null;model;controller;defaultFullscreenElement;constructor(e,t,r){super(),this.model=e,this.controller=t,this.defaultFullscreenElement=r}connectedCallback(){this.addCSS(ct);const e={};for(const t in Ee){const r=new ht;e[t]=r,r.htmlButton.addEventListener("click",()=>this.#e(t)),this.addElement(r)}this.buttons=e,this.model?.buttonAppearance.addFreshListener(this.update.bind(this)),this.model?.twistySceneModel.colorScheme.addFreshListener(this.updateColorScheme.bind(this))}#e(e){switch(e){case"fullscreen":{this.onFullscreenButton();break}case"jump-to-start":{this.controller?.jumpToStart({flash:!0});break}case"play-step-backwards":{this.controller?.animationController.play({direction:M.Backwards,untilBoundary:D.Move});break}case"play-pause":{this.controller?.togglePlay();break}case"play-step":{this.controller?.animationController.play({direction:M.Forwards,untilBoundary:D.Move});break}case"jump-to-end":{this.controller?.jumpToEnd({flash:!0});break}case"twizzle-link":{this.controller?.visitTwizzleLink();break}default:throw new Error("Missing command")}}async onFullscreenButton(){if(!this.defaultFullscreenElement)throw new Error("Attempted to go fullscreen without an element.");if(Ce()===this.defaultFullscreenElement)Tr();else{this.buttons?.fullscreen.setIcon("exit-fullscreen"),Sr(await this.model?.twistySceneModel.fullscreenElement.get()??this.defaultFullscreenElement);const e=()=>{Ce()!==this.defaultFullscreenElement&&(this.buttons?.fullscreen.setIcon("enter-fullscreen"),globalThis.removeEventListener("fullscreenchange",e))};globalThis.addEventListener("fullscreenchange",e)}}async update(e){for(const t in Ee){const r=this.buttons[t],i=e[t];r.htmlButton.disabled=!i.enabled,r.htmlButton.title=i.title,r.setIcon(i.icon),r.hidden=!!i.hidden}}updateColorScheme(e){for(const t of Object.values(this.buttons??{}))t.updateColorScheme(e)}};y.define("twisty-buttons",ut);var ht=class extends S{htmlButton=document.createElement("button");updateColorScheme(e){this.contentWrapper.classList.toggle("dark-mode",e==="dark")}connectedCallback(){this.addCSS(dt),this.addElement(this.htmlButton)}#e=new G(this,"svg-",zr);setIcon(e){this.#e.setValue(e)}};y.define("twisty-button",ht);var mt=new x;mt.replaceSync(`
:host {
  width: 384px;
  height: 16px;
  display: grid;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: grid;
  overflow: hidden;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  background: rgba(196, 196, 196, 0.75);
}

input:not(:disabled) {
  cursor: ew-resize;
}

.wrapper.dark-mode {
  background: #666666;
}
`);E?.addEventListener("mousedown",e=>{e.which},!0);E?.addEventListener("mouseup",e=>{e.which},!0);E?.addEventListener("mousedown",()=>{},!1);E?.addEventListener("mousemove",pt,!1);E?.addEventListener("mouseenter",pt,!1);function pt(e){e.pageY}var gt=class extends S{model;controller;constructor(e,t){super(),this.model=e,this.controller=t}async onDetailedTimelineInfo(e){const t=await this.inputElem();t.min=e.timeRange.start.toString(),t.max=e.timeRange.end.toString(),t.disabled=t.min===t.max,t.value=e.timestamp.toString()}async connectedCallback(){this.addCSS(mt),this.addElement(await this.inputElem()),this.model?.twistySceneModel.colorScheme.addFreshListener(this.updateColorScheme.bind(this))}updateColorScheme(e){this.contentWrapper.classList.toggle("dark-mode",e==="dark")}#e=null;async inputElem(){return this.#e??=(async()=>{const e=document.createElement("input");return e.type="range",e.disabled=!0,this.model?.detailedTimelineInfo.addFreshListener(this.onDetailedTimelineInfo.bind(this)),e.addEventListener("input",this.onInput.bind(this)),e.addEventListener("keydown",this.onKeypress.bind(this)),e})()}async onInput(e){const t=await this.inputElem();await this.slowDown(e,t);const r=parseInt(t.value,10);this.model?.playingInfo.set({playing:!1}),this.model?.timestampRequest.set(r)}onKeypress(e){switch(e.key){case"ArrowLeft":case"ArrowRight":{this.controller?.animationController.play({direction:e.key==="ArrowLeft"?M.Backwards:M.Forwards,untilBoundary:D.Move}),e.preventDefault();break}case" ":{this.controller?.togglePlay(),e.preventDefault();break}}}async slowDown(e,t){}};y.define("twisty-scrubber",gt);var Ir=null;async function Pe(e,t){const[{ThreePerspectiveCamera:r,ThreeScene:i},n,s,a,o,c,l]=await Promise.all([(async()=>{const{ThreePerspectiveCamera:F,ThreeScene:Dt}=await b;return{ThreePerspectiveCamera:F,ThreeScene:Dt}})(),await e.puzzleLoader.get(),await e.visualizationStrategy.get(),await e.twistySceneModel.stickeringRequest.get(),await e.twistySceneModel.stickeringMaskRequest.get(),await e.legacyPosition.get(),await e.twistySceneModel.orbitCoordinates.get()]),m=t?.width??2048,d=t?.height??2048,v=m/d,g=Ir??=await(async()=>new r(20,v,.1,20))(),z=new i,Z=new lt(e,{scheduleRender:()=>{}},n,s);z.add(await Z.twisty3DPuzzle()),await Ke(g,l);const O=(await $e(m,d,z,g)).toDataURL(),$=await ft(e);return{dataURL:O,download:async F=>{vt(O,F??$)}}}async function ft(e){const[t,r]=await Promise.all([e.puzzleID.get(),e.alg.get()]);return`[${t}]${r.alg.experimentalNumChildAlgNodes()===0?"":` ${r.alg.toString()}`}`}function vt(e,t,r="png"){const i=document.createElement("a");i.href=e,i.download=`${t}.${r}`,i.click()}var wt=new x;wt.replaceSync(`
:host {
  width: 384px;
  height: 256px;
  display: grid;

  -webkit-user-select: none;
  user-select: none;
}

.wrapper {
  display: grid;
  overflow: hidden;
  contain: size;
  grid-template-rows: 7fr minmax(1.5em, 0.5fr) minmax(2em, 1fr);
}

.wrapper > * {
  width: inherit;
  height: inherit;
  overflow: hidden;
}

.wrapper.controls-none {
  grid-template-rows: 7fr;
}

.wrapper.controls-none twisty-scrubber,
.wrapper.controls-none twisty-control-button-panel ,
.wrapper.controls-none twisty-scrubber,
.wrapper.controls-none twisty-buttons {
  display: none;
}

twisty-scrubber {
  background: rgba(196, 196, 196, 0.5);
}

.wrapper.checkered,
.wrapper.checkered-transparent {
  background-color: #EAEAEA;
  background-image: linear-gradient(45deg, #DDD 25%, transparent 25%, transparent 75%, #DDD 75%, #DDD),
    linear-gradient(45deg, #DDD 25%, transparent 25%, transparent 75%, #DDD 75%, #DDD);
  background-size: 32px 32px;
  background-position: 0 0, 16px 16px;
}

.wrapper.checkered-transparent {
  background-color: #F4F4F4;
  background-image: linear-gradient(45deg, #DDDDDD88 25%, transparent 25%, transparent 75%, #DDDDDD88 75%, #DDDDDD88),
    linear-gradient(45deg, #DDDDDD88 25%, transparent 25%, transparent 75%, #DDDDDD88 75%, #DDDDDD88);
}

.wrapper.dark-mode {
  background-color: #444;
  background-image: linear-gradient(45deg, #DDDDDD0b 25%, transparent 25%, transparent 75%, #DDDDDD0b 75%, #DDDDDD0b),
    linear-gradient(45deg, #DDDDDD0b 25%, transparent 25%, transparent 75%, #DDDDDD0b 75%, #DDDDDD0b);
}

.visualization-wrapper > * {
  width: 100%;
  height: 100%;
}

.error-elem {
  width: 100%;
  height: 100%;
  display: none;
  place-content: center;
  font-family: sans-serif;
  box-shadow: inset 0 0 2em rgb(255, 0, 0);
  color: red;
  text-shadow: 0 0 0.2em white;
  background: rgba(255, 255, 255, 0.25);
}

.wrapper.error .visualization-wrapper {
  display: none;
}

.wrapper.error .error-elem {
  display: grid;
}
`);var Ne=class extends h{getDefaultValue(){return null}},ve=class extends P{getDefaultValue(){return null}derive(e){return typeof e=="string"?new URL(e,location.href):e}},Y=class yt{warnings;errors;constructor(t){this.warnings=Object.freeze(t?.warnings??[]),this.errors=Object.freeze(t?.errors??[]),Object.freeze(this)}add(t){return new yt({warnings:this.warnings.concat(t?.warnings??[]),errors:this.errors.concat(t?.errors??[])})}log(){this.errors.length>0?console.error(`🚨 ${this.errors[0]}`):this.warnings.length>0?console.warn(`⚠️ ${this.warnings[0]}`):console.info("😎 No issues!")}};function Mt(e){try{const t=T.fromString(e),r=[];return t.toString()!==e&&r.push("Alg is non-canonical!"),{alg:t,issues:new Y({warnings:r})}}catch(t){return{alg:new T,issues:new Y({errors:[`Malformed alg: ${t.toString()}`]})}}}function kr(e,t){return e.alg.isIdentical(t.alg)&&pe(e.issues.warnings,t.issues.warnings)&&pe(e.issues.errors,t.issues.errors)}var Re=class extends P{getDefaultValue(){return{alg:new T,issues:new Y}}canReuseValue(e,t){return kr(e,t)}async derive(e){return typeof e=="string"?Mt(e):{alg:e,issues:new Y}}},Lr=class extends p{derive(e){return e.kpuzzle.algToTransformation(e.setupAlg.alg)}},Ar=class extends p{derive(e){if(e.setupTransformation)return e.setupTransformation;switch(e.setupAnchor){case"start":return e.setupAlgTransformation;case"end":{const r=e.indexer.transformationAtIndex(e.indexer.numAnimatedLeaves()).invert();return e.setupAlgTransformation.applyTransformation(r)}default:throw new Error("Unimplemented!")}}},Dr=class extends h{getDefaultValue(){return null}},Cr=class extends h{getDefaultValue(){return{move:null,amount:0}}canReuseValue(e,t){return e.move===t.move&&e.amount===t.amount}},Er=class extends p{derive(e){return{patternIndex:e.currentMoveInfo.patternIndex,movesFinishing:e.currentMoveInfo.movesFinishing.map(t=>t.move),movesFinished:e.currentMoveInfo.movesFinished.map(t=>t.move)}}canReuseValue(e,t){return e.patternIndex===t.patternIndex&&De(e.movesFinishing,t.movesFinishing,(r,i)=>r.isIdentical(i))&&De(e.movesFinished,t.movesFinished,(r,i)=>r.isIdentical(i))}},Pr=class extends p{derive(e){function t(r){return e.detailedTimelineInfo.atEnd&&e.catchUpMove.move!==null&&r.currentMoves.push({move:e.catchUpMove.move,direction:M.Backwards,fraction:1-e.catchUpMove.amount,startTimestamp:-1,endTimestamp:-1}),r}if(e.indexer.currentMoveInfo)return t(e.indexer.currentMoveInfo(e.detailedTimelineInfo.timestamp));{const r=e.indexer.timestampToIndex(e.detailedTimelineInfo.timestamp),i={patternIndex:r,currentMoves:[],movesFinishing:[],movesFinished:[],movesStarting:[],latestStart:-1/0,earliestEnd:1/0};if(e.indexer.numAnimatedLeaves()>0){const n=e.indexer.getAnimLeaf(r)?.as(k);if(!n)return t(i);const s=e.indexer.indexToMoveStartTimestamp(r),a=e.indexer.moveDuration(r),o=a?(e.detailedTimelineInfo.timestamp-s)/a:0,c=s+a,l={move:n,direction:M.Forwards,fraction:o,startTimestamp:s,endTimestamp:c};o===0?i.movesStarting.push(l):o===1?i.movesFinishing.push(l):(i.currentMoves.push(l),i.latestStart=Math.max(i.latestStart,s),i.earliestEnd=Math.min(i.earliestEnd,c))}return t(i)}}},Nr=class extends p{derive(e){let t=e.indexer.transformationAtIndex(e.currentLeavesSimplified.patternIndex);t=e.anchoredStart.applyTransformation(t);for(const r of e.currentLeavesSimplified.movesFinishing)t=t.applyMove(r);for(const r of e.currentLeavesSimplified.movesFinished)t=t.applyMove(r);return t.toKPattern()}},Oe={u:"y",l:"x",f:"z",r:"x",b:"z",d:"y",m:"x",e:"y",s:"z",x:"x",y:"y",z:"z"};function Rr(e,t){return Oe[e.family[0].toLowerCase()]===Oe[t.family[0].toLowerCase()]}var Or=class extends se{traverseAlg(e){const t=[];for(const r of e.childAlgNodes())t.push(this.traverseAlgNode(r));return Array.prototype.concat(...t)}traverseGroupingOnce(e){if(e.experimentalIsEmpty())return[];const t=[];for(const n of e.childAlgNodes()){if(!(n.is(k)||n.is(jt)||n.is(Vt)))return this.traverseAlg(e);const s=n.as(k);s&&t.push(s)}let r=A(t[0].amount);for(let n=0;n<t.length-1;n++){for(let s=1;s<t.length;s++)if(!Rr(t[n],t[s]))return this.traverseAlg(e);r=Math.max(r,A(t[n].amount))}const i=t.map(n=>({animLeafAlgNode:n,msUntilNext:0,duration:r}));return i[i.length-1].msUntilNext=r,i}traverseGrouping(e){const t=[],r=e.amount>0?e.alg:e.alg.invert();for(let i=0;i<Math.abs(e.amount);i++)t.push(this.traverseGroupingOnce(r));return Array.prototype.concat(...t)}traverseMove(e){const t=A(e.amount);return[{animLeafAlgNode:e,msUntilNext:t,duration:t}]}traverseCommutator(e){const t=[],r=[e.A,e.B,e.A.invert(),e.B.invert()];for(const i of r)t.push(this.traverseGroupingOnce(i));return Array.prototype.concat(...t)}traverseConjugate(e){const t=[],r=[e.A,e.B,e.A.invert()];for(const i of r)t.push(this.traverseGroupingOnce(i));return Array.prototype.concat(...t)}traversePause(e){if(e.experimentalNISSGrouping)return[];const t=A(1);return[{animLeafAlgNode:e,msUntilNext:t,duration:t}]}traverseNewline(e){return[]}traverseLineComment(e){return[]}},Fr=ae(Or);function jr(e){let t=0;return Fr(e).map(i=>{const n={animLeaf:i.animLeafAlgNode,start:t,end:t+i.duration};return t+=i.msUntilNext,n})}var ce=class{animLeaves;kpuzzle;constructor(e,t,r){this.kpuzzle=e,this.animLeaves=r?.animationTimelineLeaves??jr(t)}getAnimLeaf(e){return this.animLeaves[Math.min(e,this.animLeaves.length-1)]?.animLeaf??null}getAnimationTimelineLeaf(e){return this.animLeaves[Math.min(e,this.animLeaves.length-1)]}indexToMoveStartTimestamp(e){let t=0;return this.animLeaves.length>0&&(t=this.animLeaves[Math.min(e,this.animLeaves.length-1)].start),t}timestampToIndex(e){let t=0;for(t=0;t<this.animLeaves.length;t++)if(this.animLeaves[t].start>=e)return Math.max(0,t-1);return Math.max(0,t-1)}timestampToPosition(e,t){const r=this.currentMoveInfo(e);let i=t??this.kpuzzle.identityTransformation().toKPattern();for(const n of this.animLeaves.slice(0,r.patternIndex)){const s=n.animLeaf.as(k);s!==null&&(i=i.applyMove(s))}return{pattern:i,movesInProgress:r.currentMoves}}currentMoveInfo(e){let t=1/0;for(const l of this.animLeaves)if(l.start<=e&&l.end>=e)t=Math.min(t,l.start);else if(l.start>e)break;const r=[],i=[],n=[],s=[];let a=-1/0,o=1/0,c=0;for(const l of this.animLeaves)if(l.end<=t){if(!isFinite(t)&&l.start>e)break;c++}else{if(l.start>e)break;{const m=l.animLeaf.as(k);if(m!==null){let d=(e-l.start)/(l.end-l.start),v=!1;d>1&&(d=1,v=!0);const g={move:m,direction:M.Forwards,fraction:d,startTimestamp:l.start,endTimestamp:l.end};switch(d){case 0:{i.push(g);break}case 1:{v?s.push(g):n.push(g);break}default:r.push(g),a=Math.max(a,l.start),o=Math.min(o,l.end)}}}}return{patternIndex:c,currentMoves:r,latestStart:a,earliestEnd:o,movesStarting:i,movesFinishing:n,movesFinished:s}}patternAtIndex(e,t){let r=t??this.kpuzzle.defaultPattern();for(let i=0;i<this.animLeaves.length&&i<e;i++){const s=this.animLeaves[i].animLeaf.as(k);s!==null&&(r=r.applyMove(s))}return r}transformationAtIndex(e){let t=this.kpuzzle.identityTransformation();for(const r of this.animLeaves.slice(0,e)){const i=r.animLeaf.as(k);i!==null&&(t=t.applyMove(i))}return t}algDuration(){let e=0;for(const t of this.animLeaves)e=Math.max(e,t.end);return e}numAnimatedLeaves(){return this.animLeaves.length}moveDuration(e){const t=this.getAnimationTimelineLeaf(e);return t.end-t.start}},Vr=1024,Br=class extends p{derive(e){switch(e.indexerConstructorRequest){case"auto":return e.animationTimelineLeaves!==null||Ut(e.alg.alg)<=Vr&&e.puzzle==="3x3x3"&&e.visualizationStrategy==="Cube3D"?ce:me;case"tree":return me;case"simple":return rt;case"simultaneous":return ce;default:throw new Error("Invalid indexer request!")}}},Ur=class extends h{getDefaultValue(){return"auto"}},qr=class extends p{derive(e){return new e.indexerConstructor(e.kpuzzle,e.algWithIssues.alg,{animationTimelineLeaves:e.animationTimelineLeaves})}},Wr=class extends p{derive(e){return{pattern:e.currentPattern,movesInProgress:e.currentMoveInfo.currentMoves}}},Hr=!0,Fe=class extends p{async derive(e){try{return Hr&&e.kpuzzle.algToTransformation(e.algWithIssues.alg),e.algWithIssues}catch(t){return{alg:new T,issues:new Y({errors:[`Invalid alg for puzzle: ${t.toString()}`]})}}}},Qr=class extends h{getDefaultValue(){return"start"}},Yr=class extends h{getDefaultValue(){return null}},_r=class extends p{async derive(e){return e.puzzleLoader.kpuzzle()}},Gr=class extends h{getDefaultValue(){return B}},Xr=class extends p{async derive(e){return e.puzzleLoader.id}},Zr=class extends h{getDefaultValue(){return B}},$r=class extends p{derive(e){if(e.puzzleIDRequest&&e.puzzleIDRequest!==B){const t=Ge[e.puzzleIDRequest];return t||this.userVisibleErrorTracker.set({errors:[`Invalid puzzle ID: ${e.puzzleIDRequest}`]}),t}return e.puzzleDescriptionRequest&&e.puzzleDescriptionRequest!==B?Pt(e.puzzleDescriptionRequest):Nt}},Jr=class extends p{derive(e){return{playing:e.playingInfo.playing,atStart:e.detailedTimelineInfo.atStart,atEnd:e.detailedTimelineInfo.atEnd}}canReuseValue(e,t){return e.playing===t.playing&&e.atStart===t.atStart&&e.atEnd===t.atEnd}},Kr=class extends p{derive(e){let t=this.#e(e),r=!1,i=!1;return t>=e.timeRange.end&&(i=!0,t=Math.min(e.timeRange.end,t)),t<=e.timeRange.start&&(r=!0,t=Math.max(e.timeRange.start,t)),{timestamp:t,timeRange:e.timeRange,atStart:r,atEnd:i}}#e(e){switch(e.timestampRequest){case"auto":return e.setupAnchor==="start"&&e.setupAlg.alg.experimentalIsEmpty()?e.timeRange.end:e.timeRange.start;case"start":return e.timeRange.start;case"end":return e.timeRange.end;case"anchor":return e.setupAnchor==="start"?e.timeRange.start:e.timeRange.end;case"opposite-anchor":return e.setupAnchor==="start"?e.timeRange.end:e.timeRange.start;default:return e.timestampRequest}}canReuseValue(e,t){return e.timestamp===t.timestamp&&e.timeRange.start===t.timeRange.start&&e.timeRange.end===t.timeRange.end&&e.atStart===t.atStart&&e.atEnd===t.atEnd}},ei=class extends P{async getDefaultValue(){return{direction:M.Forwards,playing:!1,untilBoundary:D.EntireTimeline,loop:!1}}async derive(e,t){const r=await t,i=Object.assign({},r);return Object.assign(i,e),i}canReuseValue(e,t){return e.direction===t.direction&&e.playing===t.playing&&e.untilBoundary===t.untilBoundary&&e.loop===t.loop}},ti=class extends P{getDefaultValue(){return 1}derive(e){return e<0?1:e}},ri={auto:!0,start:!0,end:!0,anchor:!0,"opposite-anchor":!0},ii=class extends h{getDefaultValue(){return"auto"}set(e){const t=this.get();super.set((async()=>this.validInput(await e)?e:t)())}validInput(e){return!!(typeof e=="number"||ri[e])}},ni=class extends p{derive(e){return{start:0,end:e.indexer.algDuration()}}},si=class extends h{getDefaultValue(){return"auto"}},ai=class extends h{getDefaultValue(){return"auto"}},oi=class extends p{derive(e){switch(e.puzzleID){case"clock":case"square1":case"redi_cube":case"melindas2x2x2x2":case"tri_quad":case"loopover":return"2D";case"3x3x3":switch(e.visualizationRequest){case"auto":case"3D":return"Cube3D";default:return e.visualizationRequest}default:switch(e.visualizationRequest){case"auto":case"3D":return"PG3D";case"experimental-2D-LL":case"experimental-2D-LL-face":return["2x2x2","4x4x4","megaminx"].includes(e.puzzleID)?"experimental-2D-LL":"2D";default:return e.visualizationRequest}}}},li=class extends h{getDefaultValue(){return"auto"}},ci=class extends h{getDefaultValue(){return"auto"}},di=class extends h{getDefaultValue(){return"auto"}},ui=class extends h{getDefaultValue(){return"auto"}},hi=null;async function mi(){return hi??=new(await b).ThreeTextureLoader}var je=class extends p{async derive(e){const{spriteURL:t}=e;return t===null?null:new Promise(async(r,i)=>{const n=()=>{console.warn("Could not load sprite:",t.toString()),r(null)};try{(await mi()).load(t.toString(),r,n,n)}catch{n()}})}},pi={facelets:["regular","regular","regular","regular","regular"]};async function gi(e){const{definition:t}=await e.kpuzzle(),r={orbits:{}};for(const i of t.orbits)r.orbits[i.orbitName]={pieces:new Array(i.numPieces).fill(pi)};return r}var fi=class extends p{getDefaultValue(){return{orbits:{}}}async derive(e){return e.stickeringMaskRequest?e.stickeringMaskRequest:e.stickeringRequest==="picture"?{specialBehaviour:"picture",orbits:{}}:e.puzzleLoader.stickeringMask?.(e.stickeringRequest??"full")??gi(e.puzzleLoader)}},vi={"-":I.Regular,D:I.Dim,I:I.Ignored,X:I.Invisible,O:I.IgnoreNonPrimary,P:I.PermuteNonPrimary,o:I.Ignoriented,"?":I.OrientationWithoutPermutation,M:I.Mystery,"@":I.Regular};function wi(e){const t={orbits:{}},r=e.split(",");for(const i of r){const[n,s,...a]=i.split(":");if(a.length>0)throw new Error(`Invalid serialized orbit stickering mask (too many colons): \`${i}\``);const o=[];t.orbits[n]={pieces:o};for(const c of s){const l=vi[c];o.push(Ft(l))}}return t}var yi=class extends P{getDefaultValue(){return null}derive(e){return e===null?null:typeof e=="string"?wi(e):e}},Mi=class extends h{getDefaultValue(){return null}},xi=class extends h{getDefaultValue(){return"auto"}},Ti=class extends h{getDefaultValue(){return{}}},Si=class extends h{getDefaultValue(){return"auto"}},zi=class extends h{getDefaultValue(){return"auto"}},bi=class extends p{derive(e){return e.colorSchemeRequest==="dark"?"dark":"light"}},Ii=class extends h{getDefaultValue(){return"auto"}},ki=class extends h{getDefaultValue(){return null}},Li=35,Ai=class extends h{getDefaultValue(){return Li}};function xt(e,t){return e.latitude===t.latitude&&e.longitude===t.longitude&&e.distance===t.distance}var Di=class extends P{getDefaultValue(){return"auto"}canReuseValue(e,t){return e===t||xt(e,t)}async derive(e,t){if(e==="auto")return"auto";let r=await t;r==="auto"&&(r={});const i=Object.assign({},r);return Object.assign(i,e),typeof i.latitude<"u"&&(i.latitude=Math.min(Math.max(i.latitude,-90),90)),typeof i.longitude<"u"&&(i.longitude=ge(i.longitude,180,-180)),i}},Ci=class extends p{canReuseValue(e,t){return xt(e,t)}async derive(e){if(e.orbitCoordinatesRequest==="auto")return Be(e.puzzleID,e.strategy);const t=Object.assign(Object.assign({},Be(e.puzzleID,e.strategy),e.orbitCoordinatesRequest));if(Math.abs(t.latitude)<=e.latitudeLimit)return t;{const{latitude:r,longitude:i,distance:n}=t;return{latitude:e.latitudeLimit*Math.sign(r),longitude:i,distance:n}}}},Ei={latitude:31.717474411461005,longitude:0,distance:5.877852522924731},Pi={latitude:35,longitude:30,distance:6},Ve={latitude:35,longitude:30,distance:6.25},Ni={latitude:Math.atan(1/2)*Q,longitude:0,distance:6.7},Ri={latitude:26.56505117707799,longitude:0,distance:6};function Be(e,t){if(e[1]==="x")return t==="Cube3D"?Pi:Ve;switch(e){case"megaminx":case"gigaminx":return Ni;case"pyraminx":case"master_tetraminx":return Ri;case"skewb":return Ve;default:return Ei}}var Oi=class{background=new zi;colorSchemeRequest=new Ii;dragInput=new xi;foundationDisplay=new ci;foundationStickerSpriteURL=new ve;fullscreenElement=new ki;hintFacelet=new Gt;hintStickerSpriteURL=new ve;initialHintFaceletsAnimation=new ui;hintFaceletsElevation=new di;latitudeLimit=new Ai;movePressInput=new Si;movePressCancelOptions=new Ti;orbitCoordinatesRequest=new Di;stickeringMaskRequest=new yi;stickeringRequest=new Mi;faceletScale=new li;colorScheme=new bi({colorSchemeRequest:this.colorSchemeRequest});foundationStickerSprite=new je({spriteURL:this.foundationStickerSpriteURL});hintStickerSprite=new je({spriteURL:this.hintStickerSpriteURL});orbitCoordinates;stickeringMask;twistyPlayerModel;constructor(e){this.twistyPlayerModel=e,this.orbitCoordinates=new Ci({orbitCoordinatesRequest:this.orbitCoordinatesRequest,latitudeLimit:this.latitudeLimit,puzzleID:e.puzzleID,strategy:e.visualizationStrategy}),this.stickeringMask=new fi({stickeringMaskRequest:this.stickeringMaskRequest,stickeringRequest:this.stickeringRequest,puzzleLoader:e.puzzleLoader})}},Fi={errors:[]},ji=class extends h{getDefaultValue(){return Fi}reset(){this.set(this.getDefaultValue())}canReuseValue(e,t){return pe(e.errors,t.errors)}},Vi=class{userVisibleErrorTracker=new ji;alg=new Re;backView=new hr;controlPanel=new yr;catchUpMove=new Cr;indexerConstructorRequest=new Ur;playingInfo=new ei;puzzleDescriptionRequest=new Gr;puzzleIDRequest=new Zr;setupAnchor=new Qr;setupAlg=new Re;setupTransformation=new Yr;tempoScale=new ti;timestampRequest=new ii;viewerLink=new si;visualizationFormat=new ai;title=new Ne;videoURL=new ve;competitionID=new Ne;animationTimelineLeavesRequest=new Dr;puzzleLoader=new $r({puzzleIDRequest:this.puzzleIDRequest,puzzleDescriptionRequest:this.puzzleDescriptionRequest},this.userVisibleErrorTracker);kpuzzle=new _r({puzzleLoader:this.puzzleLoader});puzzleID=new Xr({puzzleLoader:this.puzzleLoader});puzzleAlg=new Fe({algWithIssues:this.alg,kpuzzle:this.kpuzzle});puzzleSetupAlg=new Fe({algWithIssues:this.setupAlg,kpuzzle:this.kpuzzle});visualizationStrategy=new oi({visualizationRequest:this.visualizationFormat,puzzleID:this.puzzleID});indexerConstructor=new Br({alg:this.alg,puzzle:this.puzzleID,visualizationStrategy:this.visualizationStrategy,indexerConstructorRequest:this.indexerConstructorRequest,animationTimelineLeaves:this.animationTimelineLeavesRequest});setupAlgTransformation=new Lr({setupAlg:this.puzzleSetupAlg,kpuzzle:this.kpuzzle});indexer=new qr({indexerConstructor:this.indexerConstructor,algWithIssues:this.puzzleAlg,kpuzzle:this.kpuzzle,animationTimelineLeaves:this.animationTimelineLeavesRequest});anchorTransformation=new Ar({setupTransformation:this.setupTransformation,setupAnchor:this.setupAnchor,setupAlgTransformation:this.setupAlgTransformation,indexer:this.indexer});timeRange=new ni({indexer:this.indexer});detailedTimelineInfo=new Kr({timestampRequest:this.timestampRequest,timeRange:this.timeRange,setupAnchor:this.setupAnchor,setupAlg:this.setupAlg});coarseTimelineInfo=new Jr({detailedTimelineInfo:this.detailedTimelineInfo,playingInfo:this.playingInfo});currentMoveInfo=new Pr({indexer:this.indexer,detailedTimelineInfo:this.detailedTimelineInfo,catchUpMove:this.catchUpMove});buttonAppearance=new br({coarseTimelineInfo:this.coarseTimelineInfo,viewerLink:this.viewerLink});currentLeavesSimplified=new Er({currentMoveInfo:this.currentMoveInfo});currentPattern=new Nr({anchoredStart:this.anchorTransformation,currentLeavesSimplified:this.currentLeavesSimplified,indexer:this.indexer});legacyPosition=new Wr({currentMoveInfo:this.currentMoveInfo,currentPattern:this.currentPattern});twistySceneModel=new Oi(this);async twizzleLink(){const[e,t,r,i,n,s,a,o]=await Promise.all([this.viewerLink.get(),this.puzzleID.get(),this.puzzleDescriptionRequest.get(),this.alg.get(),this.setupAlg.get(),this.setupAnchor.get(),this.twistySceneModel.stickeringRequest.get(),this.twistySceneModel.twistyPlayerModel.title.get()]),c=e==="experimental-twizzle-explorer",l=new URL(`https://alpha.twizzle.net/${c?"explore":"edit"}/`);return i.alg.experimentalIsEmpty()||l.searchParams.set("alg",i.alg.toString()),n.alg.experimentalIsEmpty()||l.searchParams.set("setup-alg",n.alg.toString()),s!=="start"&&l.searchParams.set("setup-anchor",s),a!=="full"&&a!==null&&l.searchParams.set("experimental-stickering",a),c&&r!==B?l.searchParams.set("puzzle-description",r):t!=="3x3x3"&&l.searchParams.set("puzzle",t),o&&l.searchParams.set("title",o),l.toString()}experimentalAddAlgLeaf(e,t){const r=e.as(k);r?this.experimentalAddMove(r,t):this.alg.set((async()=>{const n=(await this.alg.get()).alg.concat(new T([e]));return this.timestampRequest.set("end"),n})())}experimentalAddMove(e,t){const r=typeof e=="string"?new k(e):e;this.alg.set((async()=>{const[{alg:i},n]=await Promise.all([this.alg.get(),this.puzzleLoader.get()]),s=Ct(i,r,{...t,...await Et(n)});return this.timestampRequest.set("end"),this.catchUpMove.set({move:r,amount:0}),s})())}experimentalRemoveFinalChild(){this.alg.set((async()=>{const e=(await this.alg.get()).alg,t=Array.from(e.childAlgNodes()),[r]=t.splice(-1);if(!r)return e;this.timestampRequest.set("end");const i=r.as(k);return i&&this.catchUpMove.set({move:i.invert(),amount:0}),new T(t)})())}};function u(e){return new Error(`Cannot get \`.${e}\` directly from a \`TwistyPlayer\`.`)}var Bi=class extends S{experimentalModel=new Vi;set alg(e){this.experimentalModel.alg.set(e)}get alg(){throw u("alg")}set experimentalSetupAlg(e){this.experimentalModel.setupAlg.set(e)}get experimentalSetupAlg(){throw u("setup")}set experimentalSetupAnchor(e){this.experimentalModel.setupAnchor.set(e)}get experimentalSetupAnchor(){throw u("anchor")}set puzzle(e){this.experimentalModel.puzzleIDRequest.set(e)}get puzzle(){throw u("puzzle")}set experimentalPuzzleDescription(e){this.experimentalModel.puzzleDescriptionRequest.set(e)}get experimentalPuzzleDescription(){throw u("experimentalPuzzleDescription")}set timestamp(e){this.experimentalModel.timestampRequest.set(e)}get timestamp(){throw u("timestamp")}set hintFacelets(e){this.experimentalModel.twistySceneModel.hintFacelet.set(e)}get hintFacelets(){throw u("hintFacelets")}set experimentalStickering(e){this.experimentalModel.twistySceneModel.stickeringRequest.set(e)}get experimentalStickering(){throw u("experimentalStickering")}set experimentalStickeringMaskOrbits(e){this.experimentalModel.twistySceneModel.stickeringMaskRequest.set(e)}get experimentalStickeringMaskOrbits(){throw u("experimentalStickeringMaskOrbits")}set experimentalFaceletScale(e){this.experimentalModel.twistySceneModel.faceletScale.set(e)}get experimentalFaceletScale(){throw u("experimentalFaceletScale")}set backView(e){this.experimentalModel.backView.set(e)}get backView(){throw u("backView")}set background(e){this.experimentalModel.twistySceneModel.background.set(e)}get background(){throw u("background")}set colorScheme(e){this.experimentalModel.twistySceneModel.colorSchemeRequest.set(e)}get colorScheme(){throw u("colorScheme")}set controlPanel(e){this.experimentalModel.controlPanel.set(e)}get controlPanel(){throw u("controlPanel")}set visualization(e){this.experimentalModel.visualizationFormat.set(e)}get visualization(){throw u("visualization")}set experimentalTitle(e){this.experimentalModel.title.set(e)}get experimentalTitle(){throw u("experimentalTitle")}set experimentalVideoURL(e){this.experimentalModel.videoURL.set(e)}get experimentalVideoURL(){throw u("experimentalVideoURL")}set experimentalCompetitionID(e){this.experimentalModel.competitionID.set(e)}get experimentalCompetitionID(){throw u("experimentalCompetitionID")}set viewerLink(e){this.experimentalModel.viewerLink.set(e)}get viewerLink(){throw u("viewerLink")}set experimentalMovePressInput(e){this.experimentalModel.twistySceneModel.movePressInput.set(e)}get experimentalMovePressInput(){throw u("experimentalMovePressInput")}set experimentalMovePressCancelOptions(e){this.experimentalModel.twistySceneModel.movePressCancelOptions.set(e)}get experimentalMovePressCancelOptions(){throw u("experimentalMovePressCancelOptions")}set cameraLatitude(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({latitude:e})}get cameraLatitude(){throw u("cameraLatitude")}set cameraLongitude(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({longitude:e})}get cameraLongitude(){throw u("cameraLongitude")}set cameraDistance(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({distance:e})}get cameraDistance(){throw u("cameraDistance")}set cameraLatitudeLimit(e){this.experimentalModel.twistySceneModel.latitudeLimit.set(e)}get cameraLatitudeLimit(){throw u("cameraLatitudeLimit")}set indexer(e){this.experimentalModel.indexerConstructorRequest.set(e)}get indexer(){throw u("indexer")}set tempoScale(e){this.experimentalModel.tempoScale.set(e)}get tempoScale(){throw u("tempoScale")}set experimentalSprite(e){this.experimentalModel.twistySceneModel.foundationStickerSpriteURL.set(e)}get experimentalSprite(){throw u("experimentalSprite")}set experimentalHintSprite(e){this.experimentalModel.twistySceneModel.hintStickerSpriteURL.set(e)}get experimentalHintSprite(){throw u("experimentalHintSprite")}set fullscreenElement(e){this.experimentalModel.twistySceneModel.fullscreenElement.set(e)}get fullscreenElement(){throw u("fullscreenElement")}set experimentalInitialHintFaceletsAnimation(e){this.experimentalModel.twistySceneModel.initialHintFaceletsAnimation.set(e)}get experimentalInitialHintFaceletsAnimation(){throw u("experimentalInitialHintFaceletsAnimation")}set experimentalHintFaceletsElevation(e){this.experimentalModel.twistySceneModel.hintFaceletsElevation.set(e)}get experimentalHintFaceletsElevation(){throw u("experimentalHintFaceletsElevation")}set experimentalDragInput(e){this.experimentalModel.twistySceneModel.dragInput.set(e)}get experimentalDragInput(){throw u("experimentalDragInput")}experimentalGet=new Ui(this.experimentalModel)},Ui=class{model;constructor(e){this.model=e}async alg(){return(await this.model.alg.get()).alg}async setupAlg(){return(await this.model.setupAlg.get()).alg}puzzleID(){return this.model.puzzleID.get()}async timestamp(){return(await this.model.detailedTimelineInfo.get()).timestamp}},de="data-",ne={alg:"alg","experimental-setup-alg":"experimentalSetupAlg","experimental-setup-anchor":"experimentalSetupAnchor",puzzle:"puzzle","experimental-puzzle-description":"experimentalPuzzleDescription",visualization:"visualization","hint-facelets":"hintFacelets","experimental-stickering":"experimentalStickering","experimental-stickering-mask-orbits":"experimentalStickeringMaskOrbits",background:"background","color-scheme":"colorScheme","control-panel":"controlPanel","back-view":"backView","experimental-facelet-scale":"experimentalFaceletScale","experimental-initial-hint-facelets-animation":"experimentalInitialHintFaceletsAnimation","experimental-hint-facelets-elevation":"experimentalHintFaceletsElevation","viewer-link":"viewerLink","experimental-move-press-input":"experimentalMovePressInput","experimental-drag-input":"experimentalDragInput","experimental-title":"experimentalTitle","experimental-video-url":"experimentalVideoURL","experimental-competition-id":"experimentalCompetitionID","camera-latitude":"cameraLatitude","camera-longitude":"cameraLongitude","camera-distance":"cameraDistance","camera-latitude-limit":"cameraLatitudeLimit","tempo-scale":"tempoScale","experimental-sprite":"experimentalSprite","experimental-hint-sprite":"experimentalHintSprite"},qi=Object.fromEntries(Object.values(ne).map(e=>[e,!0])),Wi={experimentalMovePressCancelOptions:!0},Ue,Tt=Symbol("intersectedCallback");function Hi(e){Ue??=new IntersectionObserver((t,r)=>{for(const i of t)i.isIntersecting&&i.intersectionRect.height>0&&(i.target[Tt](),r.unobserve(i.target))}),Ue.observe(e)}var X=class extends Bi{controller=new vr(this.experimentalModel,this);buttons;experimentalCanvasClickCallback=()=>{};constructor(e={}){super();for(const[t,r]of Object.entries(e)){if(!(qi[t]||Wi[t])){console.warn(`Invalid config passed to TwistyPlayer: ${t}`);break}this[t]=r}}#e=new G(this,"controls-",["auto"].concat(Object.keys(wr)));#t=document.createElement("div");#r=document.createElement("div");#i=!1;connectedCallback(){this.addCSS(wt),Hi(this)}async[Tt](){if(this.#i)return;this.#i=!0,this.addElement(this.#t).classList.add("visualization-wrapper"),this.addElement(this.#r).classList.add("error-elem"),this.#r.textContent="Error",this.experimentalModel.userVisibleErrorTracker.addFreshListener(t=>{const r=t.errors[0]??null;this.contentWrapper.classList.toggle("error",!!r),r&&(this.#r.textContent=r)});const e=new gt(this.experimentalModel,this.controller);this.contentWrapper.appendChild(e),this.buttons=new ut(this.experimentalModel,this.controller,this),this.contentWrapper.appendChild(this.buttons),this.experimentalModel.twistySceneModel.background.addFreshListener(t=>{this.contentWrapper.classList.toggle("checkered",["auto","checkered"].includes(t)),this.contentWrapper.classList.toggle("checkered-transparent",t==="checkered-transparent")}),this.experimentalModel.twistySceneModel.colorScheme.addFreshListener(t=>{this.contentWrapper.classList.toggle("dark-mode",["dark"].includes(t))}),this.experimentalModel.controlPanel.addFreshListener(t=>{this.#e.setValue(t)}),this.experimentalModel.visualizationStrategy.addFreshListener(this.#l.bind(this)),this.experimentalModel.puzzleID.addFreshListener(this.flash.bind(this))}#s="auto";experimentalSetFlashLevel(e){this.#s=e}flash(){this.#s==="auto"&&this.#n?.animate([{opacity:.25},{opacity:1}],{duration:250,easing:"ease-out"})}#n=null;#a=new ot;#o=null;#l(e){if(e!==this.#o){this.#n?.remove(),this.#n?.disconnect();let t;switch(e){case"2D":case"experimental-2D-LL":case"experimental-2D-LL-face":{t=new at(this.experimentalModel.twistySceneModel,e);break}case"Cube3D":case"PG3D":{t=new fe(this.experimentalModel),this.#a.handleNewValue(t);break}default:throw new Error("Invalid visualization")}this.#t.appendChild(t),this.#n=t,this.#o=e}}async experimentalCurrentVantages(){this.connectedCallback();const e=this.#n;return e instanceof fe?e.experimentalVantages():[]}async experimentalCurrentCanvases(){const e=await this.experimentalCurrentVantages(),t=[];for(const r of e)t.push((await r.canvasInfo()).canvas);return t}async experimentalCurrentThreeJSPuzzleObject(e){this.connectedCallback();const r=await(await this.#a.promise).experimentalTwisty3DPuzzleWrapper(),i=r.twisty3DPuzzle(),n=(async()=>{await i,await new Promise(s=>setTimeout(s,0))})();if(e){const s=new U(async()=>{});r.addEventListener("render-scheduled",async()=>{s.requestIsPending()||(s.requestAnimFrame(),await n,e())})}return i}jumpToStart(e){this.controller.jumpToStart(e)}jumpToEnd(e){this.controller.jumpToEnd(e)}play(){this.controller.togglePlay(!0)}pause(){this.controller.togglePlay(!1)}togglePlay(e){this.controller.togglePlay(e)}experimentalAddMove(e,t){this.experimentalModel.experimentalAddMove(e,t)}experimentalAddAlgLeaf(e,t){this.experimentalModel.experimentalAddAlgLeaf(e,t)}static get observedAttributes(){const e=[];for(const t of Object.keys(ne))e.push(t,de+t);return e}experimentalRemoveFinalChild(){this.experimentalModel.experimentalRemoveFinalChild()}attributeChangedCallback(e,t,r){e.startsWith(de)&&(e=e.slice(de.length));const i=ne[e];i&&(this[i]=r)}async experimentalScreenshot(e){return(await Pe(this.experimentalModel,e)).dataURL}async experimentalDownloadScreenshot(e){if(["2D","experimental-2D-LL","experimental-2D-LL-face"].includes(await this.experimentalModel.visualizationStrategy.get())){const r=await this.#n.currentTwisty2DPuzzleWrapper().twisty2DPuzzle(),i=new XMLSerializer().serializeToString(r.svgWrapper.svgElement),n=URL.createObjectURL(new Blob([i]));vt(n,e??await ft(this.experimentalModel),"svg")}else await(await Pe(this.experimentalModel)).download(e)}};y.define("twisty-player",X);var Qi=class extends we{traverseAlg(e,t){const r=[];let i=0;for(const n of e.childAlgNodes()){const s=this.traverseAlgNode(n,{numMovesSoFar:t.numMovesSoFar+i});r.push(s.tokens),i+=s.numLeavesInside}return{tokens:Array.prototype.concat(...r),numLeavesInside:i}}traverseGrouping(e,t){const r=this.traverseAlg(e.alg,t);return{tokens:r.tokens,numLeavesInside:r.numLeavesInside*e.amount}}traverseMove(e,t){return{tokens:[{leaf:e,idx:t.numMovesSoFar}],numLeavesInside:1}}traverseCommutator(e,t){const r=this.traverseAlg(e.A,t),i=this.traverseAlg(e.B,{numMovesSoFar:t.numMovesSoFar+r.numLeavesInside});return{tokens:r.tokens.concat(i.tokens),numLeavesInside:r.numLeavesInside*2+i.numLeavesInside}}traverseConjugate(e,t){const r=this.traverseAlg(e.A,t),i=this.traverseAlg(e.B,{numMovesSoFar:t.numMovesSoFar+r.numLeavesInside});return{tokens:r.tokens.concat(i.tokens),numLeavesInside:r.numLeavesInside*2+i.numLeavesInside*2}}traversePause(e,t){return{tokens:[{leaf:e,idx:t.numMovesSoFar}],numLeavesInside:1}}traverseNewline(e,t){return{tokens:[],numLeavesInside:0}}traverseLineComment(e,t){return{tokens:[],numLeavesInside:0}}},Yi=ae(Qi),_i=class extends h{getDefaultValue(){return""}},Gi=class extends p{derive(e){return Mt(e.value)}},Xi=class extends P{getDefaultValue(){return{selectionStart:0,selectionEnd:0,endChangedMostRecently:!1}}async derive(e,t){const{selectionStart:r,selectionEnd:i}=e,n=await t,s=e.selectionStart===n.selectionStart&&e.selectionEnd!==(await t).selectionEnd;return{selectionStart:r,selectionEnd:i,endChangedMostRecently:s}}},Zi=class extends p{derive(e){return e.selectionInfo.endChangedMostRecently?e.selectionInfo.selectionEnd:e.selectionInfo.selectionStart}},$i=class extends p{derive(e){return Yi(e.algWithIssues.alg,{numMovesSoFar:0}).tokens}},Ji=class extends p{derive(e){function t(i){if(i===null)return null;let n;return e.targetChar<i.leaf[R]?n="before":e.targetChar===i.leaf[R]?n="start":e.targetChar<i.leaf[q]?n="inside":e.targetChar===i.leaf[q]?n="end":n="after",{leafInfo:i,where:n}}let r=null;for(const i of e.leafTokens){if(e.targetChar<i.leaf[R]&&r!==null)return t(r);if(e.targetChar<=i.leaf[q])return t(i);r=i}return t(r)}},Ki=class{valueProp=new _i;selectionProp=new Xi;targetCharProp=new Zi({selectionInfo:this.selectionProp});algEditorAlgWithIssues=new Gi({value:this.valueProp});leafTokensProp=new $i({algWithIssues:this.algEditorAlgWithIssues});leafToHighlight=new Ji({leafTokens:this.leafTokensProp,targetChar:this.targetCharProp})},en="//";function tn(e){try{return T.fromString(e)}catch{return null}}function St(e,t){const r=e.indexOf(t);return r===-1?[e,""]:[e.slice(0,r),e.slice(r)]}function qe(e){const t=[];for(const r of e.split(`
`)){let[i,n]=St(r,en);i=i.replaceAll("’","'"),t.push(i+n)}return t.join(`
`)}function rn(e,t){const{value:r}=e,{selectionStart:i,selectionEnd:n}=e,s=r.slice(0,i),a=r.slice(n);t=t.replaceAll(`\r
`,`
`);const o=s.match(/\/\/[^\n]*$/),c=r[i-1]==="/"&&t[0]==="/",l=o||c,m=t.match(/\/\/[^\n]*$/);let d=t;if(l){const[L,O]=St(t,`
`);d=L+qe(O)}else d=qe(t);const v=!l&&i!==0&&![`
`," "].includes(d[0])&&![`
`," "].includes(r[i-1]),g=!m&&n!==r.length&&![`
`," "].includes(d.at(-1))&&![`
`," "].includes(r[n]);function z(L,O){const $=L+d+O,F=!!tn(s+$+a);return F&&(d=$),F}v&&g&&z(" "," ")||v&&z(" ","")||g&&z(""," "),E?.execCommand("insertText",!1,d)||e.setRangeText(d,i,n,"end")}var zt=new x;zt.replaceSync(`
:host {
  width: 384px;
  display: grid;
}

.wrapper {
  /*overflow: hidden;
  resize: horizontal;*/

  background: var(--background, none);
  display: grid;
}

textarea, .carbon-copy {
  grid-area: 1 / 1 / 2 / 2;

  width: 100%;
  font-family: sans-serif;
  line-height: 1.2em;

  font-size: var(--font-size, inherit);
  font-family: var(--font-family, sans-serif);

  box-sizing: border-box;

  padding: var(--padding, 0.5em);
  /* Prevent horizontal growth. */
  overflow-x: hidden;
}

textarea {
  resize: none;
  background: none;
  z-index: 2;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.25));
  overflow: hidden;
}

.carbon-copy {
  white-space: pre-wrap;
  word-wrap: break-word;
  color: transparent;
  user-select: none;
  pointer-events: none;

  z-index: 1;
}

.carbon-copy .highlight {
  background: var(--highlight-color, rgba(255, 128, 0, 0.5));
  padding: 0.1em 0.2em;
  margin: -0.1em -0.2em;
  border-radius: 0.2em;
}

.wrapper.issue-warning textarea,
.wrapper.valid-for-puzzle-warning textarea {
  outline: none;
  border: 1px solid rgba(200, 200, 0, 0.5);
  background: rgba(255, 255, 0, 0.1);
}

.wrapper.issue-error textarea,
.wrapper.valid-for-puzzle-error textarea {
  outline: none;
  border: 1px solid red;
  background: rgba(255, 0, 0, 0.1);
}
`);var K="for-twisty-player",We="placeholder",He="twisty-player-prop",bt=class extends S{model=new Ki;#e=document.createElement("textarea");#t=document.createElement("div");#r=document.createElement("span");#i=document.createElement("span");#s=document.createElement("span");#n=new G(this,"valid-for-puzzle-",["none","warning","error"]);#a=null;#o;get#l(){return this.#a===null?null:this.#a.experimentalModel[this.#o]}debugNeverRequestTimestamp=!1;constructor(e){super(),this.#t.classList.add("carbon-copy"),this.addElement(this.#t),this.#e.rows=1,this.addElement(this.#e),this.#r.classList.add("prefix"),this.#t.appendChild(this.#r),this.#i.classList.add("highlight"),this.#t.appendChild(this.#i),this.#s.classList.add("suffix"),this.#t.appendChild(this.#s),this.#e.placeholder="Alg",this.#e.setAttribute("spellcheck","false"),this.addCSS(zt),this.#e.addEventListener("input",()=>{this.#d=!0,this.onInput()}),this.#e.addEventListener("blur",()=>this.onBlur()),document.addEventListener("selectionchange",()=>this.onSelectionChange()),e?.twistyPlayer&&(this.twistyPlayer=e.twistyPlayer),this.#o=e?.twistyPlayerProp??"alg",e?.twistyPlayerProp==="alg"&&this.model.leafToHighlight.addFreshListener(t=>{t&&this.highlightLeaf(t.leafInfo.leaf)})}connectedCallback(){this.#e.addEventListener("paste",e=>{const t=e.clipboardData?.getData("text");t&&(rn(this.#e,t),e.preventDefault(),this.onInput())})}set algString(e){this.#e.value=e,this.onInput()}get algString(){return this.#e.value}set placeholder(e){this.#e.placeholder=e}#d=!1;onInput(){this.#i.hidden=!0,this.highlightLeaf(null);const e=this.#e.value.trimEnd();this.model.valueProp.set(e),this.#l?.set(e)}async onSelectionChange(){if(document.activeElement!==this||this.shadow.activeElement!==this.#e||this.#o!=="alg")return;const{selectionStart:e,selectionEnd:t}=this.#e;this.model.selectionProp.set({selectionStart:e,selectionEnd:t})}async onBlur(){}setAlgIssueClassForPuzzle(e){this.#n.setValue(e)}#u(e){return e.endsWith(`
`)?`${e} `:e}#c=null;highlightLeaf(e){if(e===null){this.#r.textContent="",this.#i.textContent="",this.#s.textContent=this.#u(this.#e.value);return}e!==this.#c&&(this.#c=e,this.#r.textContent=this.#e.value.slice(0,e[R]),this.#i.textContent=this.#e.value.slice(e[R],e[q]),this.#s.textContent=this.#u(this.#e.value.slice(e[q])),this.#i.hidden=!1)}get twistyPlayer(){return this.#a}set twistyPlayer(e){if(this.#a){console.warn("twisty-player reassignment/clearing is not supported");return}this.#a=e,e&&((async()=>this.algString=this.#l?(await this.#l.get()).alg.toString():"")(),this.#o==="alg"&&(this.#a?.experimentalModel.puzzleAlg.addFreshListener(t=>{if(t.issues.errors.length===0){this.setAlgIssueClassForPuzzle(t.issues.warnings.length===0?"none":"warning");const r=t.alg,i=T.fromString(this.algString);r.isIdentical(i)||(this.algString=r.toString(),this.onInput())}else this.setAlgIssueClassForPuzzle("error")}),this.model.leafToHighlight.addFreshListener(async t=>{if(t===null)return;const[r,i]=await Promise.all([await e.experimentalModel.indexer.get(),await e.experimentalModel.timestampRequest.get()]);if(i==="auto"&&!this.#d)return;const n=r.indexToMoveStartTimestamp(t.leafInfo.idx),s=r.moveDuration(t.leafInfo.idx);let a;switch(t.where){case"before":{a=n;break}case"start":case"inside":{a=n+s/4;break}case"end":case"after":{a=n+s;break}default:throw console.log("invalid where"),new Error("Invalid where!")}this.debugNeverRequestTimestamp||e.experimentalModel.timestampRequest.set(a)}),e.experimentalModel.currentLeavesSimplified.addFreshListener(async t=>{const i=(await e.experimentalModel.indexer.get()).getAnimLeaf(t.patternIndex);this.highlightLeaf(i)})))}attributeChangedCallback(e,t,r){switch(e){case K:{const i=document.getElementById(r);if(!i){console.warn(`${K}= elem does not exist`);return}if(!(i instanceof X)){console.warn(`${K}=is not a twisty-player`);return}this.twistyPlayer=i;return}case We:{this.placeholder=r;return}case He:{if(this.#a)throw console.log("cannot set prop"),new Error("cannot set prop after twisty player");this.#o=r;return}}}static get observedAttributes(){return[K,We,He]}};y.define("twisty-alg-editor",bt);async function nn(e){return new Promise((t,r)=>{try{const i=document.getElementById(e);i&&t(i);const n=new MutationObserver(s=>{for(const a of s)a.attributeName==="id"&&a.target instanceof Element&&a.target.getAttribute("id")===e&&(t(a.target),n.disconnect())});n.observe(document.body,{attributeFilter:["id"],subtree:!0})}catch(i){r(i)}})}var It=new x;It.replaceSync(`
:host {
  display: inline;
  --comment-opacity: 0.4;
  --active-background-shade: rgba(66, 133, 244);
}

.wrapper {
  display: inline;
  --current-color: currentColor
}

a {
  color: currentColor;

  &:not(:hover) {
    text-decoration: none;
  }

  &:hover {
    background: color-mix(in oklab, currentColor 20%, transparent);
  }

  &:active {
    color: currentColor;
    animation: 1s linear flash;
  }
}

@keyframes flash {
  from { opacity: 0.5; }
  to { opacity: 1; }
}

twisty-alg-leaf-elem.twisty-alg-line-comment {
  opacity: var(--comment-opacity);
}

.current-move {
  background: color-mix(in oklab, var(--active-background-shade) 30%, transparent);
  margin-left: -0.1em;
  margin-right: -0.1em;
  padding-left: 0.1em;
  padding-right: 0.1em;
  border-radius: 0.1em;
}
`);var sn=.25,j=class extends H{algOrAlgNode;constructor(e,t,r,i,n,s){if(super(),this.algOrAlgNode=i,this.classList.add(e),s){const a=this.appendChild(document.createElement("a"));a.href="#",a.textContent=t,a.addEventListener("click",o=>{o.preventDefault(),r.twistyAlgViewer.jumpToIndex(r.earliestMoveIndex,n)})}else this.appendChild(document.createElement("span")).textContent=t}pathToIndex(e){return[]}setCurrentMove(e){this.classList.toggle("current-move",e)}};y.define("twisty-alg-leaf-elem",j);var V=class extends H{queue=[];algOrAlgNode;constructor(e,t){super(),this.algOrAlgNode=t,this.classList.add(e)}addString(e){const t=document.createElement("span");t.textContent=e,this.queue.push(t)}addElem(e){return this.queue.push(e.element),e.moveCount}flushQueue(e=C.Forwards){for(const t of kt(this.queue,e))this.append(t);this.queue=[]}pathToIndex(e){return[]}};y.define("twisty-alg-wrapper-elem",V);function an(e){return e===C.Forwards?C.Backwards:C.Forwards}function on(e,t){return t<0?an(e):e}function kt(e,t){if(t===C.Forwards)return e;const r=Array.from(e);return r.reverse(),r}var ln=class extends we{traverseAlg(e,t){let r=0;const i=new V("twisty-alg-alg",e);let n=!0;for(const s of Bt(e.childAlgNodes(),t.direction))n||i.addString(" "),n=!1,s.as(ze)?.experimentalNISSGrouping&&i.addString("^("),s.as(ie)?.experimentalNISSPlaceholder||(r+=i.addElem(this.traverseAlgNode(s,{earliestMoveIndex:t.earliestMoveIndex+r,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction}))),s.as(ze)?.experimentalNISSGrouping&&i.addString(")");return i.flushQueue(t.direction),{moveCount:r,element:i}}traverseGrouping(e,t){const r=e.experimentalAsSquare1Tuple(),i=on(t.direction,e.amount);let n=0;const s=new V("twisty-alg-grouping",e);return s.addString("("),r?(n+=s.addElem({moveCount:1,element:new j("twisty-alg-move",r[0].amount.toString(),t,r[0],!0,!0)}),s.addString(", "),n+=s.addElem({moveCount:1,element:new j("twisty-alg-move",r[1].amount.toString(),t,r[1],!0,!0)})):n+=s.addElem(this.traverseAlg(e.alg,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:i})),s.addString(`)${e.experimentalRepetitionSuffix}`),s.flushQueue(),{moveCount:n*Math.abs(e.amount),element:s}}traverseMove(e,t){const r=new j("twisty-alg-move",e.toString(),t,e,!0,!0);return t.twistyAlgViewer.highlighter.addMove(e[R],r),{moveCount:1,element:r}}traverseCommutator(e,t){let r=0;const i=new V("twisty-alg-commutator",e);i.addString("["),i.flushQueue();const[n,s]=kt([e.A,e.B],t.direction);return r+=i.addElem(this.traverseAlg(n,{earliestMoveIndex:t.earliestMoveIndex+r,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),i.addString(", "),r+=i.addElem(this.traverseAlg(s,{earliestMoveIndex:t.earliestMoveIndex+r,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),i.flushQueue(t.direction),i.addString("]"),i.flushQueue(),{moveCount:r*2,element:i}}traverseConjugate(e,t){let r=0;const i=new V("twisty-alg-conjugate",e);i.addString("[");const n=i.addElem(this.traverseAlg(e.A,{earliestMoveIndex:t.earliestMoveIndex+r,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction}));return r+=n,i.addString(": "),r+=i.addElem(this.traverseAlg(e.B,{earliestMoveIndex:t.earliestMoveIndex+r,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),i.addString("]"),i.flushQueue(),{moveCount:r+n,element:i}}traversePause(e,t){return e.experimentalNISSGrouping?this.traverseAlg(e.experimentalNISSGrouping.alg,t):{moveCount:1,element:new j("twisty-alg-pause",".",t,e,!0,!0)}}traverseNewline(e,t){const r=new V("twisty-alg-newline",e);return r.append(document.createElement("br")),{moveCount:0,element:r}}traverseLineComment(e,t){return{moveCount:0,element:new j("twisty-alg-line-comment",`//${e.text}`,t,e,!1,!1)}}},cn=ae(ln),dn=class{moveCharIndexMap=new Map;currentElem=null;addMove(e,t){this.moveCharIndexMap.set(e,t)}set(e){const t=e?this.moveCharIndexMap.get(e[R])??null:null;this.currentElem!==t&&(this.currentElem?.setCurrentMove(!1),t?.setCurrentMove(!0),this.currentElem=t)}},xe=class extends S{highlighter=new dn;#e;#t;#r=null;lastClickTimestamp=null;constructor(e){super({mode:"open"}),this.addCSS(It),e?.twistyPlayer&&(this.twistyPlayer=e?.twistyPlayer)}connectedCallback(){}setAlg(e){this.#t?.isIdentical(e)||(this.#e=cn(e,{earliestMoveIndex:0,twistyAlgViewer:this,direction:C.Forwards}).element,this.#t=e,this.contentWrapper.textContent="",this.contentWrapper.appendChild(this.#e))}get twistyPlayer(){return this.#r}set twistyPlayer(e){this.#i(e)}async#i(e){if(this.#r){console.warn("twisty-player reassignment is not supported");return}if(e===null)throw new Error("clearing twistyPlayer is not supported");this.#r=e,this.#r.experimentalModel.alg.addFreshListener(t=>{this.setAlg(t.alg)}),e.experimentalModel.currentMoveInfo.addFreshListener(t=>{let r=t.currentMoves[0];if(r??=t.movesStarting[0],r??=t.movesFinishing[0],!r)this.highlighter.set(null);else{const i=r.move;this.highlighter.set(i)}}),e.experimentalModel.detailedTimelineInfo.addFreshListener(t=>{t.timestamp!==this.lastClickTimestamp&&(this.lastClickTimestamp=null)})}async jumpToIndex(e,t){const r=this.#r;if(r){r.pause();const i=(async()=>{const n=await r.experimentalModel.indexer.get(),s=t?n.moveDuration(e)*sn:0;return n.indexToMoveStartTimestamp(e)+n.moveDuration(e)-s})();r.experimentalModel.timestampRequest.set(await i),this.lastClickTimestamp===await i?(r.play(),this.lastClickTimestamp=null):this.lastClickTimestamp=await i}}async attributeChangedCallback(e,t,r){if(e==="for"){let i=document.getElementById(r);if(i||console.info("for= elem does not exist, waiting for one"),await customElements.whenDefined("twisty-player"),i=await nn(r),!(i instanceof X)){console.warn("for= elem is not a twisty-player");return}this.twistyPlayer=i}}static get observedAttributes(){return["for"]}};y.define("twisty-alg-viewer",xe);var re=new x;re.replaceSync(`
.wrapper {
  background: rgb(255, 245, 235);
  border: 1px solid rgba(0, 0, 0, 0.25);

  /* Workaround from https://stackoverflow.com/questions/40010597/how-do-i-apply-opacity-to-a-css-color-variable */
  --text-color: 0, 0, 0;
  --heading-background: 255, 230, 210;

  color: rgb(var(--text-color));
}

.setup-alg, twisty-alg-viewer {
  padding: 0.5em 1em;
}

.heading {
  background: rgba(var(--heading-background), 1);
  color: rgba(var(--text-color), 1);
  font-weight: bold;
  padding: 0.25em 0.5em;
  display: grid;
  grid-template-columns: auto 1fr;

  /* For the move count hover elems. */
  position: sticky;
}

.heading.title {
  background: rgb(255, 245, 235);
  font-size: 150%;
  white-space: pre-wrap;
}

.heading .move-count {
  font-weight: initial;
  text-align: right;
  color: rgba(var(--text-color), 0.4);
}

.wrapper.dark-mode .heading .move-count {
  color: rgba(var(--text-color), 0.7);
}

.heading a {
  text-decoration: none;
  color: inherit;
}

twisty-player {
  width: 100%;
  min-height: 128px;
  height: 288px;
  resize: vertical;
  overflow-y: hidden;
}

twisty-player + .heading {
  padding-top: 0.5em;
}

twisty-alg-viewer {
  display: inline-block;
}

.wrapper {
  container-type: inline-size;
}

.scrollable-region {
  border-top: 1px solid rgba(0, 0, 0, 0.25);
}

.scrollable-region {
  max-height: 18em;
  overflow-y: auto;
}

@container (min-width: 512px) {
  .responsive-wrapper {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  twisty-player {
    height: 320px
  }
  .scrollable-region {
    border-top: none;
    border-left: 1px solid rgba(0, 0, 0, 0.25);
    contain: strict;
    max-height: 100cqh;
  }
}

.wrapper:fullscreen,
.wrapper:fullscreen .responsive-wrapper {
  width: 100%;
  height: 100%;
}

.wrapper:fullscreen twisty-player,
.wrapper:fullscreen .scrollable-region {
  height: 50%;
}

@container (min-width: 512px) {
  .wrapper:fullscreen twisty-player,
  .wrapper:fullscreen .scrollable-region {
    height: 100%;
  }
}

/* TODO: dedup with Twizzle Editor */
.move-count > span:hover:before {
  background-color: rgba(var(--heading-background), 1);
  color: rgba(var(--text-color), 1);
  backdrop-filter: blur(4px);
  z-index: 100;
  position: absolute;
  padding: 0.5em;
  top: 1.5em;
  right: 0;
  content: attr(data-before);
  white-space: pre-wrap;
  text-align: left;
}

.move-count > span:hover {
  color: rgba(var(--text-color), 1);
  cursor: help;
}
`);var Lt=new x;Lt.replaceSync(`
.wrapper {
  background: white;
  --heading-background: 232, 239, 253
}

.wrapper.dark-mode {
  --text-color: 236, 236, 236;
  --heading-background: 29, 29, 29;
}

.scrollable-region {
  overflow-y: auto;
}

.wrapper.dark-mode {
  background: #262626;
  --text-color: 142, 142, 142;
  border-color: #FFFFFF44;
}

.wrapper.dark-mode .heading:not(.title) {
  background: #1d1d1d;
}

.heading.title {
  background: none;
}
`);function un(e="",t=location.href){const r={alg:"alg","setup-alg":"experimental-setup-alg","setup-anchor":"experimental-setup-anchor",puzzle:"puzzle",stickering:"experimental-stickering","puzzle-description":"experimental-puzzle-description",title:"experimental-title","video-url":"experimental-video-url",competition:"experimental-competition-id"},i=new URL(t).searchParams,n={};for(const[s,a]of Object.entries(r)){const o=i.get(e+s);if(o!==null){const c=ne[a];n[c]=o}}return n}var ee="outer block moves (e.g. R, Rw, or 4r)",te="inner block moves (e.g. M or 2-5r)",Qe={[w.OuterBlockTurnMetric]:`HTM = OBTM ("Outer Block Turn Metric"):
• ${te} count as 2 turns
• ${ee} count as 1 turn
• rotations (e.g. x) count as 0 turns`,[w.OuterBlockQuantumTurnMetric]:`QTM = OBQTM ("Outer Block Quantum Turn Metric"):
• ${te} count as 2 turns per quantum (e.g. M2 counts as 4)
• ${ee} count as 1 turn per quantum (e.g. R2 counts as 2)
• rotations (e.g. x) count as 0 turns`,[w.RangeBlockTurnMetric]:`STM = RBTM ("Range Block Turn Metric"):
• ${te} count as 1 turn
• ${ee} count as 1 turn
• rotations (e.g. x) count as 0 turns`,[w.RangeBlockQuantumTurnMetric]:`SQTM = RBQTM ("Range Block Quantum Turn Metric"):
• ${te} count as 1 turn per quantum (e.g. M2 counts as 2)
• ${ee} count as 1 turn per quantum (e.g. R2 counts as 2)
• rotations (e.g. x) count as 0 turns`,[w.ExecutionTurnMetric]:`ETM ("Execution Turn Metric"):
• all moves (including rotations) count as 1 turn`},hn={[w.OuterBlockTurnMetric]:"OB",[w.OuterBlockQuantumTurnMetric]:"OBQ",[w.RangeBlockTurnMetric]:"RB",[w.RangeBlockQuantumTurnMetric]:"RBQ",[w.ExecutionTurnMetric]:"E"},At=class extends S{twistyPlayer=null;a=null;options;constructor(e){super({mode:"open"}),this.options=e}#e(){if(this.contentWrapper.textContent="",this.a){const t=this.contentWrapper.appendChild(document.createElement("span"));t.textContent="❗️",t.title="Could not show a player for link",this.addElement(this.a)}this.removeCSS(re);const e=this.shadow.adoptedStyleSheets.indexOf(re);typeof e<"u"&&this.shadow.adoptedStyleSheets.splice(e,e+1),this.#t?.remove()}#t;#r;#i;#s;async connectedCallback(){if(this.#i=this.addElement(document.createElement("div")),this.#i.classList.add("responsive-wrapper"),this.options?.colorScheme==="dark"&&this.contentWrapper.classList.add("dark-mode"),this.addCSS(re),this.options?.cdnForumTweaks&&this.addCSS(Lt),this.a=this.querySelector("a"),!this.a)return;const e=un("",this.a.href),t=this.a?.href,{hostname:r,pathname:i}=new URL(t);if(r!=="alpha.twizzle.net"){this.#e();return}if(["/edit/","/explore/"].includes(i)){const n=i==="/explore/";if(e.puzzle&&!(e.puzzle in Ge)){const o=(await Ye(async()=>{const{getPuzzleDescriptionString:c}=await import("./puzzle-geometry-CvMQjZCz.js");return{getPuzzleDescriptionString:c}},[])).getPuzzleDescriptionString(e.puzzle);delete e.puzzle,e.experimentalPuzzleDescription=o}if(this.twistyPlayer=this.#i.appendChild(new X({background:this.options?.cdnForumTweaks?"checkered-transparent":"checkered",colorScheme:this.options?.colorScheme==="dark"?"dark":"light",...e,viewerLink:n?"experimental-twizzle-explorer":"auto"})),this.twistyPlayer.fullscreenElement=this.contentWrapper,e.experimentalTitle&&(this.twistyPlayer.experimentalTitle=e.experimentalTitle),this.#r=this.#i.appendChild(document.createElement("div")),this.#r.classList.add("scrollable-region"),e.experimentalTitle&&this.#n(e.experimentalTitle).classList.add("title"),e.experimentalSetupAlg){this.#n("Setup",async()=>(await this.twistyPlayer?.experimentalModel.setupAlg.get())?.alg.toString()??null);const o=this.#r.appendChild(document.createElement("div"));o.classList.add("setup-alg"),o.textContent=new T(e.experimentalSetupAlg).toString()}const s=this.#n("Moves",async()=>(await this.twistyPlayer?.experimentalModel.alg.get())?.alg.toString()??null);this.#s=s.appendChild(mn(this.twistyPlayer.experimentalModel)),this.#s.classList.add("move-count"),this.#r.appendChild(new xe({twistyPlayer:this.twistyPlayer})).part.add("twisty-alg-viewer")}else this.#e()}#n(e,t){const r=this.#r.appendChild(document.createElement("div"));r.classList.add("heading");const i=r.appendChild(document.createElement("span"));if(i.textContent=e,t){i.textContent+=" ";const n=i.appendChild(document.createElement("a"));n.textContent="📋",n.href="#",n.title="Copy to clipboard";async function s(a){n.textContent=a,await new Promise(o=>setTimeout(o,2e3)),n.textContent===a&&(n.textContent="📋")}n.addEventListener("click",async a=>{a.preventDefault(),n.textContent="📋…";const o=await t();if(o)try{await navigator.clipboard.writeText(o),s("📋✅")}catch(c){throw s("📋❌"),c}else s("📋❌")})}return r}};y.define("twizzle-link",At);function mn(e,t=document.createElement("span")){async function r(){const[i,n]=await Promise.all([e.puzzleAlg.get(),e.puzzleLoader.get()]);if(i.issues.errors.length!==0){t.textContent="";return}let s=!0;function a(o){s?s=!1:t.append(")(");const c=t.appendChild(document.createElement("span")),l=Wt(n,o,i.alg);c.append(`${hn[o]}: `);const m=c.appendChild(document.createElement("span"));m.textContent=l.toString(),m.classList.add("move-number"),c.setAttribute("data-before",Qe[o]??""),c.setAttribute("title",Qe[o]??"")}t.textContent="(",n.id==="3x3x3"?(a(w.OuterBlockTurnMetric),a(w.OuterBlockQuantumTurnMetric),a(w.RangeBlockTurnMetric)):n.pg&&(a(w.RangeBlockTurnMetric),a(w.RangeBlockQuantumTurnMetric)),a(w.ExecutionTurnMetric),t.append(")")}return e.puzzleAlg.addFreshListener(r),e.puzzleID.addFreshListener(r),t}const wn=Object.freeze(Object.defineProperty({__proto__:null,EXPERIMENTAL_PROP_NO_VALUE:B,ExperimentalSVGAnimator:it,SimpleAlgIndexer:rt,TreeAlgIndexer:me,TwistyAlgEditor:bt,TwistyAlgViewer:xe,TwistyPlayer:X,TwizzleLink:At},Symbol.toStringTag,{value:"Module"}));export{Xt as T,_t as a,b,vn as h,wn as i};
