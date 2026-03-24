const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/puzzle-geometry-5-u4PKMG.js","assets/chunk-EF6G34T7-B9bwRkPI.js"])))=>i.map(i=>d[i]);
import{t as e}from"./preload-helper-DNPLdxEY.js";import{a as t,c as n,d as r,f as i,i as a,l as o,m as s,n as c,o as l,p as u,r as d,t as f,u as p}from"./chunk-EF6G34T7-B9bwRkPI.js";import{B as m,C as ee,S as te,U as ne,V as re,W as ie,_ as h,a as ae,c as g,d as oe,g as _,h as v,i as y,l as b,m as se,n as ce,o as le,p as x,r as ue,s as S,t as de,u as C,v as w,w as fe,x as pe}from"./chunk-YOMULQ2R-D0gSFPha.js";function me(e){return e.endsWith(`v`)||[`x`,`y`,`z`].includes(e)?`Rotation`:e.startsWith(`2`)||[`M`,`E`,`S`].includes(e)?`Inner`:`Outer`}var T;function he(){if(T)return T;T={};let e=[...Object.keys(m.moves),...Object.keys(m.derivedMoves)];for(let t of e)T[t]=me(t);return T}var ge={OBTM:{Rotation:{constantFactor:0,amountFactor:0},Outer:{constantFactor:1,amountFactor:0},Inner:{constantFactor:2,amountFactor:0}},RBTM:{Rotation:{constantFactor:0,amountFactor:0},Outer:{constantFactor:1,amountFactor:0},Inner:{constantFactor:1,amountFactor:0}},OBQTM:{Rotation:{constantFactor:0,amountFactor:0},Outer:{constantFactor:0,amountFactor:1},Inner:{constantFactor:0,amountFactor:2}},RBQTM:{Rotation:{constantFactor:0,amountFactor:0},Outer:{constantFactor:0,amountFactor:1},Inner:{constantFactor:0,amountFactor:1}},ETM:{Rotation:{constantFactor:1,amountFactor:0},Outer:{constantFactor:1,amountFactor:0},Inner:{constantFactor:1,amountFactor:0}}};function _e(e,t){let n=ge[e];if(!n)throw Error(`Invalid metric for 3x3x3: ${e}`);let r=he(),i=t.quantum.toString();if(!(i in r))throw Error(`Invalid move for 3x3x3 ${e}: ${i}`);let{constantFactor:a,amountFactor:o}=n[r[i]];return a+o*Math.abs(t.amount)}var E=class extends o{constructor(e){super(),this.metric=e}traverseAlg(e){let t=0;for(let n of e.childAlgNodes())t+=this.traverseAlgNode(n);return t}traverseGrouping(e){let t=e.alg;return this.traverseAlg(t)*Math.abs(e.amount)}traverseMove(e){return this.metric(e)}traverseCommutator(e){return 2*(this.traverseAlg(e.A)+this.traverseAlg(e.B))}traverseConjugate(e){return 2*this.traverseAlg(e.A)+this.traverseAlg(e.B)}traversePause(e){return 0}traverseNewline(e){return 0}traverseLineComment(e){return 0}},ve=class extends o{traverseAlg(e){let t=0;for(let n of e.childAlgNodes())t+=this.traverseAlgNode(n);return t}traverseGrouping(e){let t=e.alg;return this.traverseAlg(t)*Math.abs(e.amount)}traverseMove(e){return 1}traverseCommutator(e){return 2*(this.traverseAlg(e.A)+this.traverseAlg(e.B))}traverseConjugate(e){return 2*this.traverseAlg(e.A)+this.traverseAlg(e.B)}traversePause(e){return 1}traverseNewline(e){return 1}traverseLineComment(e){return 1}};function ye(e){return`A`<=e&&e<=`Z`}function be(e){let t=e.family;return ye(t[0])&&t[t.length-1]===`v`||t===`x`||t===`y`||t===`z`||t===`T`?0:1}function xe(e){return 1}function Se(e){let t=e.family;return ye(t[0])&&t[t.length-1]===`v`||t===`x`||t===`y`||t===`z`||t===`T`?0:1}function Ce(e){return Math.abs(e.amount)*Se(e)}u(E,[be]);var we=u(E,[xe]),Te=u(E,[Ce]),Ee=u(E,[Se]),De=u(ve,[be]);function Oe(e,t,n){if(e.id===`3x3x3`){if(t in ge)return u(E,[e=>_e(t,e)])(n)}else switch(t){case`ETM`:return we(n);case`RBTM`:if(e.pg)return Ee(n);break;case`RBQTM`:if(e.pg)return Te(n);break}throw Error(`Unsupported puzzle or metric.`)}var ke=u(class extends o{traverseAlg(e){let t=0;for(let n of e.childAlgNodes())t+=this.traverseAlgNode(n);return t}traverseGrouping(e){return this.traverseAlg(e.alg)*Math.abs(e.amount)}traverseMove(e){return 1}traverseCommutator(e){return 2*(this.traverseAlg(e.A)+this.traverseAlg(e.B))}traverseConjugate(e){return 2*this.traverseAlg(e.A)+this.traverseAlg(e.B)}traversePause(e){return 1}traverseNewline(e){return 0}traverseLineComment(e){return 0}});function Ae(e){return e}function D(e,t){if(e===t)return!0;if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}function je(e,t,n){if(e===t)return!0;if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(!n(e[r],t[r]))return!1;return!0}function O(e,t,n){return s(e,n-t,t)}var Me=class{constructor(e){this.model=e,e.tempoScale.addFreshListener(e=>{this.tempoScale=e})}catchingUp=!1;pendingFrame=!1;tempoScale;scheduler=new b(this.animFrame.bind(this));start(){this.catchingUp||(this.lastTimestamp=performance.now()),this.catchingUp=!0,this.pendingFrame=!0,this.scheduler.requestAnimFrame()}stop(){this.catchingUp=!1,this.scheduler.cancelAnimFrame()}catchUpMs=500;lastTimestamp=0;animFrame(e){this.scheduler.requestAnimFrame();let t=this.tempoScale*(e-this.lastTimestamp)/this.catchUpMs;this.lastTimestamp=e,this.model.catchUpMove.set((async()=>{let e=await this.model.catchUpMove.get();if(e.move===null)return e;let n=e.amount+t;return n>=1?(this.pendingFrame=!0,this.stop(),this.model.timestampRequest.set(`end`),{move:null,amount:0}):(this.pendingFrame=!1,{move:e.move,amount:n})})())}},Ne=class{constructor(e,t){this.delegate=t,this.model=e,this.lastTimestampPromise=this.#e(),this.model.playingInfo.addFreshListener(this.onPlayingProp.bind(this)),this.catchUpHelper=new Me(this.model),this.model.catchUpMove.addFreshListener(this.onCatchUpMoveProp.bind(this))}playing=!1;direction=1;catchUpHelper;model;lastDatestamp=0;lastTimestampPromise;scheduler=new b(this.animFrame.bind(this));async onPlayingProp(e){e.playing!==this.playing&&(e.playing?this.play(e):this.pause())}async onCatchUpMoveProp(e){let t=e.move!==null;t!==this.catchUpHelper.catchingUp&&(t?this.catchUpHelper.start():this.catchUpHelper.stop()),this.scheduler.requestAnimFrame()}async#e(){return(await this.model.detailedTimelineInfo.get()).timestamp}jumpToStart(e){this.model.timestampRequest.set(`start`),this.pause(),e?.flash&&this.delegate.flash()}jumpToEnd(e){this.model.timestampRequest.set(`end`),this.pause(),e?.flash&&this.delegate.flash()}playPause(){this.playing?this.pause():this.play()}async play(e){let t=e?.direction??1,n=await this.model.coarseTimelineInfo.get();(e?.autoSkipToOtherEndIfStartingAtBoundary??!0)&&(t===1&&n.atEnd&&(this.model.timestampRequest.set(`start`),this.delegate.flash()),t===-1&&n.atStart&&(this.model.timestampRequest.set(`end`),this.delegate.flash())),this.model.playingInfo.set({playing:!0,direction:t,untilBoundary:e?.untilBoundary??`entire-timeline`,loop:e?.loop??!1}),this.playing=!0,this.lastDatestamp=performance.now(),this.lastTimestampPromise=this.#e(),this.scheduler.requestAnimFrame()}pause(){this.playing=!1,this.scheduler.cancelAnimFrame(),this.model.playingInfo.set({playing:!1,untilBoundary:`entire-timeline`})}#t=new oe;async animFrame(e){this.playing&&this.scheduler.requestAnimFrame();let t=this.lastDatestamp,[n,r,i,a,o]=await this.#t.queue(Promise.all([this.model.playingInfo.get(),this.lastTimestampPromise,this.model.timeRange.get(),this.model.tempoScale.get(),this.model.currentMoveInfo.get()]));if(!n.playing){this.playing=!1;return}let s=o.earliestEnd;(o.currentMoves.length===0||n.untilBoundary===`entire-timeline`)&&(s=i.end);let c=o.latestStart;(o.currentMoves.length===0||n.untilBoundary===`entire-timeline`)&&(c=i.start);let l=(e-t)*Ae(this.direction)*a;l=Math.max(l,1),l*=n.direction;let u=r+l,d=null;u>=s?n.loop?u=O(u,i.start,i.end):(u===i.end?d=`end`:u=s,this.playing=!1,this.model.playingInfo.set({playing:!1})):u<=c&&(n.loop?u=O(u,i.start,i.end):(u===i.start?d=`start`:u=c,this.playing=!1,this.model.playingInfo.set({playing:!1}))),this.lastDatestamp=e,this.lastTimestampPromise=Promise.resolve(u),this.model.timestampRequest.set(d??u)}},Pe=class{constructor(e,t){this.model=e,this.animationController=new Ne(e,t)}animationController;jumpToStart(e){this.animationController.jumpToStart(e)}jumpToEnd(e){this.animationController.jumpToEnd(e)}togglePlay(e){e===void 0&&this.animationController.playPause(),e?this.animationController.play():this.animationController.pause()}async visitTwizzleLink(){let e=document.createElement(`a`);e.href=await this.model.twizzleLink(),e.target=`_blank`,e.click()}},Fe={"bottom-row":!0,none:!0},Ie=class extends C{getDefaultValue(){return`auto`}},k=new h;k.replaceSync(`
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
`);var A=`http://www.w3.org/2000/svg`,Le=`data-copy-id`,Re=0;function ze(){return Re+=1,`svg${Re.toString()}`}var Be={dim:{white:`#dddddd`,orange:`#884400`,limegreen:`#008800`,red:`#660000`,"rgb(34, 102, 255)":`#000088`,yellow:`#888800`,"rgb(102, 0, 153)":`rgb(50, 0, 76)`,purple:`#3f003f`},oriented:`#44ddcc`,ignored:`#555555`,invisible:`#00000000`},Ve=class{constructor(e,t,n,r=!1){if(this.kpuzzle=e,this.showUnknownOrientations=r,!t)throw Error(`No SVG definition for puzzle type: ${e.name()}`);this.svgID=ze(),this.wrapperElement=document.createElement(`div`),this.wrapperElement.classList.add(`svg-wrapper`),this.wrapperElement.innerHTML=t;let i=this.wrapperElement.querySelector(`svg`);if(!i)throw Error(`Could not get SVG element`);if(this.svgElement=i,A!==i.namespaceURI)throw Error(`Unexpected XML namespace`);i.style.maxWidth=`100%`,i.style.maxHeight=`100%`,this.gradientDefs=document.createElementNS(A,`defs`),i.insertBefore(this.gradientDefs,i.firstChild);for(let t of e.definition.orbits)for(let e=0;e<t.numPieces;e++)for(let r=0;r<t.numOrientations;r++){let i=this.elementID(t.orbitName,e,r),a=this.elementByID(i),o=a?.style.fill;n?(()=>{let i=n.orbits;if(!i)return;let a=i[t.orbitName];if(!a)return;let s=a.pieces[e];if(!s)return;let c=s.facelets[r];if(!c)return;let l=Be[typeof c==`string`?c:c?.mask];typeof l==`string`?o=l:l&&(o=l[o])})():o=a?.style.fill,this.originalColors[i]=o,this.gradients[i]=this.newGradient(i,o),this.gradientDefs.appendChild(this.gradients[i]),a?.setAttribute(`style`,`fill: url(#grad-${this.svgID}-${i})`)}for(let e of Array.from(i.querySelectorAll(`[${Le}]`))){let t=e.getAttribute(Le);e.setAttribute(`style`,`fill: url(#grad-${this.svgID}-${t})`)}this.showUnknownOrientations&&this.drawPattern(this.kpuzzle.defaultPattern())}wrapperElement;svgElement;gradientDefs;originalColors={};gradients={};svgID;drawPattern(e,t,n){this.draw(e,t,n)}draw(e,t,n){let r=t?.experimentalToTransformation();if(!e)throw Error(`Distinguishable pieces are not handled for SVG yet!`);for(let t of e.kpuzzle.definition.orbits){let i=e.patternData[t.orbitName],a=r?r.transformationData[t.orbitName]:null;for(let e=0;e<t.numPieces;e++)for(let r=0;r<t.numOrientations;r++){let o=this.elementID(t.orbitName,e,r),s=this.elementID(t.orbitName,i.pieces[e],(t.numOrientations-i.orientation[e]+r)%t.numOrientations),c=!1;if(a){let i=this.elementID(t.orbitName,a.permutation[e],(t.numOrientations-a.orientationDelta[e]+r)%t.numOrientations);s===i&&(c=!0),n||=0;let l=100*(1-n*n*(2-n*n));this.gradients[o].children[0].setAttribute(`stop-color`,this.originalColors[s]),this.gradients[o].children[0].setAttribute(`offset`,`${Math.max(l-5,0)}%`),this.gradients[o].children[1].setAttribute(`offset`,`${Math.max(l-5,0)}%`),this.gradients[o].children[2].setAttribute(`offset`,`${l}%`),this.gradients[o].children[3].setAttribute(`offset`,`${l}%`),this.gradients[o].children[3].setAttribute(`stop-color`,this.originalColors[i])}else c=!0;c&&(this.showUnknownOrientations&&i.orientationMod?.[e]===1?(this.gradients[o].children[0].setAttribute(`stop-color`,`#000`),this.gradients[o].children[0].setAttribute(`offset`,`5%`),this.gradients[o].children[1].setAttribute(`offset`,`5%`),this.gradients[o].children[2].setAttribute(`offset`,`20%`),this.gradients[o].children[3].setAttribute(`offset`,`20%`),this.gradients[o].children[3].setAttribute(`stop-color`,this.originalColors[s])):(this.gradients[o].children[0].setAttribute(`stop-color`,this.originalColors[s]),this.gradients[o].children[0].setAttribute(`offset`,`100%`),this.gradients[o].children[1].setAttribute(`offset`,`100%`),this.gradients[o].children[2].setAttribute(`offset`,`100%`),this.gradients[o].children[3].setAttribute(`offset`,`100%`)))}}}newGradient(e,t){let n=document.createElementNS(A,`radialGradient`);n.setAttribute(`id`,`grad-${this.svgID}-${e}`),n.setAttribute(`r`,`70.7107%`);let r=[{offset:0,color:t},{offset:0,color:`black`},{offset:0,color:`black`},{offset:0,color:t}];for(let e of r){let t=document.createElementNS(A,`stop`);t.setAttribute(`offset`,`${e.offset}%`),t.setAttribute(`stop-color`,e.color),t.setAttribute(`stop-opacity`,`1`),n.appendChild(t)}return n}elementID(e,t,n){return`${e}-l${t}-o${n}`}elementByID(e){return this.wrapperElement.querySelector(`#${e}`)}},He=new h;He.replaceSync(`
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
`);var Ue=class extends S{constructor(e,t,n,r,i){super(),this.model=e,this.kpuzzle=t,this.svgSource=n,this.options=r,this.puzzleLoader=i,this.addCSS(He),this.resetSVG(),this.#t.addListener(this.model.puzzleID,e=>{i?.id!==e&&this.disconnect()}),this.#t.addListener(this.model.legacyPosition,this.onPositionChange.bind(this)),this.options?.experimentalStickeringMask&&this.experimentalSetStickeringMask(this.options.experimentalStickeringMask)}svgWrapper;scheduler=new b(this.render.bind(this));#e=null;#t=new y;disconnect(){this.#t.disconnect()}onPositionChange(e){try{if(e.movesInProgress.length>0){let t=e.movesInProgress[0].move,n=t;e.movesInProgress[0].direction===-1&&(n=t.invert());let r=e.pattern.applyMove(n);this.svgWrapper.draw(e.pattern,r,e.movesInProgress[0].fraction)}else this.svgWrapper.draw(e.pattern),this.#e=e}catch(e){console.warn(`Bad position (this doesn't necessarily mean something is wrong). Pre-emptively disconnecting:`,this.puzzleLoader?.id,e),this.disconnect()}}scheduleRender(){this.scheduler.requestAnimFrame()}experimentalSetStickeringMask(e){this.resetSVG(e)}resetSVG(e){this.svgWrapper&&this.removeElement(this.svgWrapper.wrapperElement),this.kpuzzle&&(this.svgWrapper=new Ve(this.kpuzzle,this.svgSource,e),this.addElement(this.svgWrapper.wrapperElement),this.#e&&this.onPositionChange(this.#e))}render(){}};w.define(`twisty-2d-puzzle`,Ue);var We=class{constructor(e,t,n,r){this.model=e,this.schedulable=t,this.puzzleLoader=n,this.effectiveVisualization=r,this.twisty2DPuzzle(),this.#e.addListener(this.model.twistySceneModel.stickeringMask,async e=>{(await this.twisty2DPuzzle()).experimentalSetStickeringMask(e)})}#e=new y;disconnect(){this.#e.disconnect()}scheduleRender(){}#t=null;async twisty2DPuzzle(){return this.#t??=(async()=>{let e=this.effectiveVisualization===`experimental-2D-LL-face`?this.puzzleLoader.llFaceSVG():this.effectiveVisualization===`experimental-2D-LL`?this.puzzleLoader.llSVG():this.puzzleLoader.svg();return new Ue(this.model,await this.puzzleLoader.kpuzzle(),await e,{},this.puzzleLoader)})()}},Ge=class extends S{constructor(e,t){super(),this.model=e,this.effectiveVisualization=t}#e=new y;disconnect(){this.#e.disconnect()}async connectedCallback(){this.addCSS(k),this.model&&this.#e.addListener(this.model.twistyPlayerModel.puzzleLoader,this.onPuzzleLoader.bind(this))}#t;async scene(){return this.#t??=(async()=>new(await x).Scene)()}scheduleRender(){this.#n?.scheduleRender()}#n=null;currentTwisty2DPuzzleWrapper(){return this.#n}async setCurrentTwisty2DPuzzleWrapper(e){let t=this.#n;this.#n=e,t?.disconnect();let n=e.twisty2DPuzzle();this.contentWrapper.textContent=``,this.addElement(await n)}async onPuzzleLoader(e){this.#n?.disconnect();let t=new We(this.model.twistyPlayerModel,this,e,this.effectiveVisualization);this.setCurrentTwisty2DPuzzleWrapper(t)}};w.define(`twisty-2d-scene-wrapper`,Ge);var j=class{constructor(e,t,n){this.elem=e,this.prefix=t,this.validSuffixes=n}#e=null;clearValue(){this.#e&&this.elem.contentWrapper.classList.remove(this.#e),this.#e=null}setValue(e){if(!this.validSuffixes.includes(e))throw Error(`Invalid suffix: ${e}`);let t=`${this.prefix}${e}`,n=this.#e!==t;return n&&(this.clearValue(),this.elem.contentWrapper.classList.add(t),this.#e=t),n}},Ke=class{#e;reject;promise=new Promise((e,t)=>{this.#e=e,this.reject=t});handleNewValue(e){this.#e(e)}},qe=class extends EventTarget{constructor(e,t,n,r){super(),this.model=e,this.schedulable=t,this.puzzleLoader=n,this.visualizationStrategy=r,this.twisty3DPuzzle(),this.#e.addListener(this.model.puzzleLoader,e=>{this.puzzleLoader.id!==e.id&&this.disconnect()}),this.#e.addListener(this.model.legacyPosition,async e=>{try{(await this.twisty3DPuzzle()).onPositionChange(e),this.scheduleRender()}catch{this.disconnect()}}),this.#e.addListener(this.model.twistySceneModel.hintFacelet,async e=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({hintFacelets:e===`auto`?`floating`:e}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.foundationDisplay,async e=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({showFoundation:e!==`none`}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.stickeringMask,async e=>{(await this.twisty3DPuzzle()).setStickeringMask(e),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.faceletScale,async e=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({faceletScale:e}),this.scheduleRender()}),this.#e.addMultiListener3([this.model.twistySceneModel.stickeringMask,this.model.twistySceneModel.foundationStickerSprite,this.model.twistySceneModel.hintStickerSprite],async e=>{`experimentalUpdateTexture`in await this.twisty3DPuzzle()&&((await this.twisty3DPuzzle()).experimentalUpdateTexture(e[0].specialBehaviour===`picture`,e[1],e[2]),this.scheduleRender())})}#e=new y;disconnect(){this.#e.disconnect()}scheduleRender(){this.schedulable.scheduleRender(),this.dispatchEvent(new CustomEvent(`render-scheduled`))}#t=null;async twisty3DPuzzle(){return this.#t??=(async()=>{let e=pe();if(this.puzzleLoader.id===`3x3x3`&&this.visualizationStrategy===`Cube3D`){let[t,n,r,i]=await Promise.all([this.model.twistySceneModel.foundationStickerSprite.get(),this.model.twistySceneModel.hintStickerSprite.get(),this.model.twistySceneModel.stickeringMask.get(),this.model.twistySceneModel.initialHintFaceletsAnimation.get()]);return(await e).cube3DShim(()=>this.schedulable.scheduleRender(),{foundationSprite:t,hintSprite:n,experimentalStickeringMask:r,initialHintFaceletsAnimation:i})}else{let[t,n,r,i]=await Promise.all([this.model.twistySceneModel.hintFacelet.get(),this.model.twistySceneModel.foundationStickerSprite.get(),this.model.twistySceneModel.hintStickerSprite.get(),this.model.twistySceneModel.faceletScale.get()]),a=(await e).pg3dShim(()=>this.schedulable.scheduleRender(),this.puzzleLoader,t===`auto`?`floating`:t,i,this.puzzleLoader.id===`kilominx`);return a.then(e=>e.experimentalUpdateTexture(!0,n??void 0,r??void 0)),a}})()}async raycastMove(e,t){let n=await this.twisty3DPuzzle();if(!(`experimentalGetControlTargets`in n)){console.info(`not PG3D! skipping raycast`);return}let r=n.experimentalGetControlTargets(),[i,a]=await Promise.all([e,this.model.twistySceneModel.movePressCancelOptions.get()]),o=i.intersectObjects(r);if(o.length>0){let e=n.getClosestMoveToAxis(o[0].point,t);e?this.model.experimentalAddMove(e.move,{cancel:a}):console.info(`Skipping move!`)}}},M=class extends S{constructor(e){super(),this.model=e}#e=new j(this,`back-view-`,[`auto`,`none`,`side-by-side`,`top-right`]);#t=new y;disconnect(){this.#t.disconnect()}async connectedCallback(){this.addCSS(k);let e=new se(this.model,this);this.addVantage(e),this.model&&(this.#t.addMultiListener([this.model.puzzleLoader,this.model.visualizationStrategy],this.onPuzzle.bind(this)),this.#t.addListener(this.model.backView,this.onBackView.bind(this))),this.scheduleRender()}#n=null;setBackView(e){let t=[`side-by-side`,`top-right`].includes(e),n=this.#n!==null;this.#e.setValue(e),t?n||(this.#n=new se(this.model,this,{backView:!0}),this.addVantage(this.#n),this.scheduleRender()):this.#n&&=(this.removeVantage(this.#n),null)}onBackView(e){this.setBackView(e)}async onPress(e){let t=this.#a;if(!t){console.info(`no wrapper; skipping scene wrapper press!`);return}let n=(async()=>{let[t,n]=await Promise.all([e.detail.cameraPromise,x]),r=new n.Raycaster,i=new(await x).Vector2(e.detail.pressInfo.normalizedX,e.detail.pressInfo.normalizedY);return r.setFromCamera(i,t),r})();t.raycastMove(n,{invert:!e.detail.pressInfo.rightClick,depth:e.detail.pressInfo.keys.ctrlOrMetaKey?`rotation`:e.detail.pressInfo.keys.shiftKey?`secondSlice`:`none`})}#r;async scene(){return this.#r??=(async()=>new(await x).Scene)()}#i=new Set;addVantage(e){e.addEventListener(`press`,this.onPress.bind(this)),this.#i.add(e),this.contentWrapper.appendChild(e)}removeVantage(e){this.#i.delete(e),e.remove(),e.disconnect(),this.#a?.disconnect()}experimentalVantages(){return this.#i.values()}scheduleRender(){for(let e of this.#i)e.scheduleRender()}#a=null;async setCurrentTwisty3DPuzzleWrapper(e,t){let n=this.#a;try{this.#a=t,n?.disconnect(),e.add(await t.twisty3DPuzzle())}finally{n&&e.remove(await n.twisty3DPuzzle())}this.#o.handleNewValue(t)}#o=new Ke;async experimentalTwisty3DPuzzleWrapper(){return this.#a||this.#o.promise}#s=new oe;async onPuzzle(e){if(e[1]===`2D`)return;this.#a?.disconnect();let[t,n]=await this.#s.queue(Promise.all([this.scene(),new qe(this.model,this,e[0],e[1])]));this.setCurrentTwisty3DPuzzleWrapper(t,n)}};w.define(`twisty-3d-scene-wrapper`,M);var Je=new h;Je.replaceSync(`
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
`);var Ye=new h;Ye.replaceSync(`
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
`);var N=typeof document>`u`?null:document,Xe=N?.fullscreenEnabled||!!N?.webkitFullscreenEnabled;function Ze(){return document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen()}function Qe(){return document.fullscreenElement?document.fullscreenElement:document.webkitFullscreenElement??null}function $e(e){return e.requestFullscreen?e.requestFullscreen():e.webkitRequestFullscreen()}var et=[`skip-to-start`,`skip-to-end`,`step-forward`,`step-backward`,`pause`,`play`,`enter-fullscreen`,`exit-fullscreen`,`twizzle-tw`],tt=class extends v{derive(e){return{fullscreen:{enabled:Xe,icon:document.fullscreenElement===null?`enter-fullscreen`:`exit-fullscreen`,title:`Enter fullscreen`},"jump-to-start":{enabled:!e.coarseTimelineInfo.atStart,icon:`skip-to-start`,title:`Restart`},"play-step-backwards":{enabled:!e.coarseTimelineInfo.atStart,icon:`step-backward`,title:`Step backward`},"play-pause":{enabled:!(e.coarseTimelineInfo.atStart&&e.coarseTimelineInfo.atEnd),icon:e.coarseTimelineInfo.playing?`pause`:`play`,title:e.coarseTimelineInfo.playing?`Pause`:`Play`},"play-step":{enabled:!e.coarseTimelineInfo.atEnd,icon:`step-forward`,title:`Step forward`},"jump-to-end":{enabled:!e.coarseTimelineInfo.atEnd,icon:`skip-to-end`,title:`Skip to End`},"twizzle-link":{enabled:!0,icon:`twizzle-tw`,title:`View at Twizzle`,hidden:e.viewerLink===`none`}}}},nt={fullscreen:!0,"jump-to-start":!0,"play-step-backwards":!0,"play-pause":!0,"play-step":!0,"jump-to-end":!0,"twizzle-link":!0},rt=class extends S{constructor(e,t,n){super(),this.model=e,this.controller=t,this.defaultFullscreenElement=n}buttons=null;connectedCallback(){this.addCSS(Je);let e={};for(let t in nt){let n=new it;e[t]=n,n.htmlButton.addEventListener(`click`,()=>this.#e(t)),this.addElement(n)}this.buttons=e,this.model?.buttonAppearance.addFreshListener(this.update.bind(this)),this.model?.twistySceneModel.colorScheme.addFreshListener(this.updateColorScheme.bind(this))}#e(e){switch(e){case`fullscreen`:this.onFullscreenButton();break;case`jump-to-start`:this.controller?.jumpToStart({flash:!0});break;case`play-step-backwards`:this.controller?.animationController.play({direction:-1,untilBoundary:`move`});break;case`play-pause`:this.controller?.togglePlay();break;case`play-step`:this.controller?.animationController.play({direction:1,untilBoundary:`move`});break;case`jump-to-end`:this.controller?.jumpToEnd({flash:!0});break;case`twizzle-link`:this.controller?.visitTwizzleLink();break;default:throw Error(`Missing command`)}}async onFullscreenButton(){if(!this.defaultFullscreenElement)throw Error(`Attempted to go fullscreen without an element.`);if(Qe()===this.defaultFullscreenElement)Ze();else{this.buttons?.fullscreen.setIcon(`exit-fullscreen`),$e(await this.model?.twistySceneModel.fullscreenElement.get()??this.defaultFullscreenElement);let e=()=>{Qe()!==this.defaultFullscreenElement&&(this.buttons?.fullscreen.setIcon(`enter-fullscreen`),window.removeEventListener(`fullscreenchange`,e))};window.addEventListener(`fullscreenchange`,e)}}async update(e){for(let t in nt){let n=this.buttons[t],r=e[t];n.htmlButton.disabled=!r.enabled,n.htmlButton.title=r.title,n.setIcon(r.icon),n.hidden=!!r.hidden}}updateColorScheme(e){for(let t of Object.values(this.buttons??{}))t.updateColorScheme(e)}};w.define(`twisty-buttons`,rt);var it=class extends S{htmlButton=document.createElement(`button`);updateColorScheme(e){this.contentWrapper.classList.toggle(`dark-mode`,e===`dark`)}connectedCallback(){this.addCSS(Ye),this.addElement(this.htmlButton)}#e=new j(this,`svg-`,et);setIcon(e){this.#e.setValue(e)}};w.define(`twisty-button`,it);var at=new h;at.replaceSync(`
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
`);var ot=!1,P=!1;N?.addEventListener(`mousedown`,e=>{e.which&&(P=!0)},!0),N?.addEventListener(`mouseup`,e=>{e.which&&(P=!1)},!0);var F=0,I=0;N?.addEventListener(`mousedown`,()=>{I++},!1),N?.addEventListener(`mousemove`,st,!1),N?.addEventListener(`mouseenter`,st,!1);function st(e){F=e.pageY}var ct=0,lt=0,L=!1,R=0,ut=class extends S{constructor(e,t){super(),this.model=e,this.controller=t}async onDetailedTimelineInfo(e){let t=await this.inputElem();t.min=e.timeRange.start.toString(),t.max=e.timeRange.end.toString(),t.disabled=t.min===t.max,t.value=e.timestamp.toString()}async connectedCallback(){this.addCSS(at),this.addElement(await this.inputElem()),this.model?.twistySceneModel.colorScheme.addFreshListener(this.updateColorScheme.bind(this))}updateColorScheme(e){this.contentWrapper.classList.toggle(`dark-mode`,e===`dark`)}#e=null;async inputElem(){return this.#e??=(async()=>{let e=document.createElement(`input`);return e.type=`range`,e.disabled=!0,this.model?.detailedTimelineInfo.addFreshListener(this.onDetailedTimelineInfo.bind(this)),e.addEventListener(`input`,this.onInput.bind(this)),e.addEventListener(`keydown`,this.onKeypress.bind(this)),e})()}async onInput(e){if(L)return;let t=await this.inputElem();await this.slowDown(e,t);let n=parseInt(t.value);this.model?.playingInfo.set({playing:!1}),this.model?.timestampRequest.set(n)}onKeypress(e){switch(e.key){case`ArrowLeft`:case`ArrowRight`:this.controller?.animationController.play({direction:e.key===`ArrowLeft`?-1:1,untilBoundary:`move`}),e.preventDefault();break;case` `:this.controller?.togglePlay(),e.preventDefault();break}}async slowDown(e,t){if(ot&&P){let n=t.getBoundingClientRect(),r=n.top+n.height/2;console.log(r,e,F,P);let i=Math.abs(r-F),a=1;i>64&&(a=Math.max(2**(-(i-64)/64),1/32));let o=parseInt(t.value);if(console.log(`cl`,R,I,o),R===I){let e=(o-lt)*a;console.log(`delta`,e,i),L=!0;let n=o;n=ct+e*a+(o-ct)*Math.min(1,(1/2)**(i*i/64)),t.value=n.toString(),console.log(a),L=!1,this.contentWrapper.style.opacity=a.toString()}else R=I;lt=o}}};w.define(`twisty-scrubber`,ut);var dt=null;async function ft(e,t){let[{PerspectiveCamera:n,Scene:r},i,a,o,s,c,l]=await Promise.all([x,await e.puzzleLoader.get(),await e.visualizationStrategy.get(),await e.twistySceneModel.stickeringRequest.get(),await e.twistySceneModel.stickeringMaskRequest.get(),await e.legacyPosition.get(),await e.twistySceneModel.orbitCoordinates.get()]),u=t?.width??2048,d=t?.height??2048,f=u/d,p=dt??=await(async()=>new n(20,f,.1,20))(),m=new r,ne=new qe(e,{scheduleRender:()=>{}},i,a);m.add(await ne.twisty3DPuzzle()),await ee(p,l);let re=(await te(u,d,m,p)).toDataURL(),ie=await pt(e);return{dataURL:re,download:async e=>{mt(re,e??ie)}}}async function pt(e){let[t,n]=await Promise.all([e.puzzleID.get(),e.alg.get()]);return`[${t}]${n.alg.experimentalNumChildAlgNodes()===0?``:` ${n.alg.toString()}`}`}function mt(e,t,n=`png`){let r=document.createElement(`a`);r.href=e,r.download=`${t}.${n}`,r.click()}var ht=new h;ht.replaceSync(`
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
`);var gt=class extends C{getDefaultValue(){return null}},z=class extends _{getDefaultValue(){return null}derive(e){return typeof e==`string`?new URL(e,location.href):e}},B=class e{warnings;errors;constructor(e){this.warnings=Object.freeze(e?.warnings??[]),this.errors=Object.freeze(e?.errors??[]),Object.freeze(this)}add(t){return new e({warnings:this.warnings.concat(t?.warnings??[]),errors:this.errors.concat(t?.errors??[])})}log(){this.errors.length>0?console.error(`\u{1F6A8} ${this.errors[0]}`):this.warnings.length>0?console.warn(`\u26A0\uFE0F ${this.warnings[0]}`):console.info(`😎 No issues!`)}};function _t(e){try{let t=f.fromString(e),n=[];return t.toString()!==e&&n.push(`Alg is non-canonical!`),{alg:t,issues:new B({warnings:n})}}catch(e){return{alg:new f,issues:new B({errors:[`Malformed alg: ${e.toString()}`]})}}}function vt(e,t){return e.alg.isIdentical(t.alg)&&D(e.issues.warnings,t.issues.warnings)&&D(e.issues.errors,t.issues.errors)}var yt=class extends _{getDefaultValue(){return{alg:new f,issues:new B}}canReuseValue(e,t){return vt(e,t)}async derive(e){return typeof e==`string`?_t(e):{alg:e,issues:new B}}},bt=class extends v{derive(e){return e.kpuzzle.algToTransformation(e.setupAlg.alg)}},xt=class extends v{derive(e){if(e.setupTransformation)return e.setupTransformation;switch(e.setupAnchor){case`start`:return e.setupAlgTransformation;case`end`:{let t=e.indexer.transformationAtIndex(e.indexer.numAnimatedLeaves()).invert();return e.setupAlgTransformation.applyTransformation(t)}default:throw Error(`Unimplemented!`)}}},St=class extends C{getDefaultValue(){return{move:null,amount:0}}canReuseValue(e,t){return e.move===t.move&&e.amount===t.amount}},Ct=class extends v{derive(e){return{patternIndex:e.currentMoveInfo.patternIndex,movesFinishing:e.currentMoveInfo.movesFinishing.map(e=>e.move),movesFinished:e.currentMoveInfo.movesFinished.map(e=>e.move)}}canReuseValue(e,t){return e.patternIndex===t.patternIndex&&je(e.movesFinishing,t.movesFinishing,(e,t)=>e.isIdentical(t))&&je(e.movesFinished,t.movesFinished,(e,t)=>e.isIdentical(t))}},wt=class extends v{derive(e){function n(t){return e.detailedTimelineInfo.atEnd&&e.catchUpMove.move!==null&&t.currentMoves.push({move:e.catchUpMove.move,direction:-1,fraction:1-e.catchUpMove.amount,startTimestamp:-1,endTimestamp:-1}),t}if(e.indexer.currentMoveInfo)return n(e.indexer.currentMoveInfo(e.detailedTimelineInfo.timestamp));{let r=e.indexer.timestampToIndex(e.detailedTimelineInfo.timestamp),i={patternIndex:r,currentMoves:[],movesFinishing:[],movesFinished:[],movesStarting:[],latestStart:-1/0,earliestEnd:1/0};if(e.indexer.numAnimatedLeaves()>0){let a=e.indexer.getAnimLeaf(r)?.as(t);if(!a)return n(i);let o=e.indexer.indexToMoveStartTimestamp(r),s=e.indexer.moveDuration(r),c=s?(e.detailedTimelineInfo.timestamp-o)/s:0,l=o+s,u={move:a,direction:1,fraction:c,startTimestamp:o,endTimestamp:l};c===0?i.movesStarting.push(u):c===1?i.movesFinishing.push(u):(i.currentMoves.push(u),i.latestStart=Math.max(i.latestStart,o),i.earliestEnd=Math.min(i.earliestEnd,l))}return n(i)}}},Tt=class extends v{derive(e){let t=e.indexer.transformationAtIndex(e.currentLeavesSimplified.patternIndex);t=e.anchoredStart.applyTransformation(t);for(let n of e.currentLeavesSimplified.movesFinishing)t=t.applyMove(n);for(let n of e.currentLeavesSimplified.movesFinished)t=t.applyMove(n);return t.toKPattern()}};function V(e){switch(Math.abs(e)){case 0:return 0;case 1:return 1e3;case 2:return 1500;default:return 2e3}}var Et=class extends o{constructor(e=V){super(),this.durationForAmount=e}traverseAlg(e){let t=0;for(let n of e.childAlgNodes())t+=this.traverseAlgNode(n);return t}traverseGrouping(e){return e.amount*this.traverseAlg(e.alg)}traverseMove(e){return this.durationForAmount(e.amount)}traverseCommutator(e){return 2*(this.traverseAlg(e.A)+this.traverseAlg(e.B))}traverseConjugate(e){return 2*this.traverseAlg(e.A)+this.traverseAlg(e.B)}traversePause(e){return this.durationForAmount(1)}traverseNewline(e){return this.durationForAmount(1)}traverseLineComment(e){return this.durationForAmount(0)}},Dt=class{constructor(e,t){this.kpuzzle=e,this.moves=new f(t.experimentalExpand())}moves;durationFn=new Et(V);getAnimLeaf(e){return Array.from(this.moves.childAlgNodes())[e]}indexToMoveStartTimestamp(e){let t=new f(Array.from(this.moves.childAlgNodes()).slice(0,e));return this.durationFn.traverseAlg(t)}timestampToIndex(e){let t=0,n;for(n=0;n<this.numAnimatedLeaves();n++)if(t+=this.durationFn.traverseMove(this.getAnimLeaf(n)),t>=e)return n;return n}patternAtIndex(e){return this.kpuzzle.defaultPattern().applyTransformation(this.transformationAtIndex(e))}transformationAtIndex(e){let t=this.kpuzzle.identityTransformation();for(let n of Array.from(this.moves.childAlgNodes()).slice(0,e))t=t.applyMove(n);return t}algDuration(){return this.durationFn.traverseAlg(this.moves)}numAnimatedLeaves(){return ke(this.moves)}moveDuration(e){return this.durationFn.traverseMove(this.getAnimLeaf(e))}},Ot={u:`y`,l:`x`,f:`z`,r:`x`,b:`z`,d:`y`,m:`x`,e:`y`,s:`z`,x:`x`,y:`y`,z:`z`};function kt(e,t){return Ot[e.family[0].toLowerCase()]===Ot[t.family[0].toLowerCase()]}var At=u(class extends o{traverseAlg(e){let t=[];for(let n of e.childAlgNodes())t.push(this.traverseAlgNode(n));return Array.prototype.concat(...t)}traverseGroupingOnce(e){if(e.experimentalIsEmpty())return[];for(let n of e.childAlgNodes())if(!n.is(t))return this.traverseAlg(e);let n=Array.from(e.childAlgNodes()),r=V(n[0].amount);for(let t=0;t<n.length-1;t++){for(let r=1;r<n.length;r++)if(!kt(n[t],n[r]))return this.traverseAlg(e);r=Math.max(r,V(n[t].amount))}let i=n.map(e=>({animLeafAlgNode:e,msUntilNext:0,duration:r}));return i[i.length-1].msUntilNext=r,i}traverseGrouping(e){let t=[],n=e.amount>0?e.alg:e.alg.invert();for(let r=0;r<Math.abs(e.amount);r++)t.push(this.traverseGroupingOnce(n));return Array.prototype.concat(...t)}traverseMove(e){let t=V(e.amount);return[{animLeafAlgNode:e,msUntilNext:t,duration:t}]}traverseCommutator(e){let t=[],n=[e.A,e.B,e.A.invert(),e.B.invert()];for(let e of n)t.push(this.traverseGroupingOnce(e));return Array.prototype.concat(...t)}traverseConjugate(e){let t=[],n=[e.A,e.B,e.A.invert()];for(let e of n)t.push(this.traverseGroupingOnce(e));return Array.prototype.concat(...t)}traversePause(e){if(e.experimentalNISSGrouping)return[];let t=V(1);return[{animLeafAlgNode:e,msUntilNext:t,duration:t}]}traverseNewline(e){return[]}traverseLineComment(e){return[]}});function jt(e){let t=0;return At(e).map(e=>{let n={animLeaf:e.animLeafAlgNode,start:t,end:t+e.duration};return t+=e.msUntilNext,n})}var Mt={"y' y' U' E D R2 r2 F2 B2 U E D' R2 L2' z2 S2 U U D D S2 F2' B2":[{animLeaf:new t(`y`,-1),start:0,end:1e3},{animLeaf:new t(`y`,-1),start:1e3,end:2e3},{animLeaf:new t(`U`,-1),start:1e3,end:1600},{animLeaf:new t(`E`,1),start:1200,end:1800},{animLeaf:new t(`D`),start:1400,end:2e3},{animLeaf:new t(`R`,2),start:2e3,end:3500},{animLeaf:new t(`r`,2),start:2e3,end:3500},{animLeaf:new t(`F`,2),start:3500,end:4200},{animLeaf:new t(`B`,2),start:3800,end:4500},{animLeaf:new t(`U`,1),start:4500,end:5500},{animLeaf:new t(`E`,1),start:4500,end:5500},{animLeaf:new t(`D`,-1),start:4500,end:5500},{animLeaf:new t(`R`,2),start:5500,end:6500},{animLeaf:new t(`L`,-2),start:5500,end:6500},{animLeaf:new t(`z`,2),start:5500,end:6500},{animLeaf:new t(`S`,2),start:6500,end:7500},{animLeaf:new t(`U`),start:7500,end:8e3},{animLeaf:new t(`D`),start:7750,end:8250},{animLeaf:new t(`U`),start:8e3,end:8500},{animLeaf:new t(`D`),start:8250,end:8750},{animLeaf:new t(`S`,2),start:8750,end:9250},{animLeaf:new t(`F`,-2),start:8750,end:1e4},{animLeaf:new t(`B`,2),start:8750,end:1e4}],"M' R' U' D' M R":[{animLeaf:new t(`M`,-1),start:0,end:1e3},{animLeaf:new t(`R`,-1),start:0,end:1e3},{animLeaf:new t(`U`,-1),start:1e3,end:2e3},{animLeaf:new t(`D`,-1),start:1e3,end:2e3},{animLeaf:new t(`M`),start:2e3,end:3e3},{animLeaf:new t(`R`),start:2e3,end:3e3}],"U' E' r E r2' E r U E":[{animLeaf:new t(`U`,-1),start:0,end:1e3},{animLeaf:new t(`E`,-1),start:0,end:1e3},{animLeaf:new t(`r`),start:1e3,end:2500},{animLeaf:new t(`E`),start:2500,end:3500},{animLeaf:new t(`r`,-2),start:3500,end:5e3},{animLeaf:new t(`E`),start:5e3,end:6e3},{animLeaf:new t(`r`),start:6e3,end:7e3},{animLeaf:new t(`U`),start:7e3,end:8e3},{animLeaf:new t(`E`),start:7e3,end:8e3}]},Nt=class{constructor(e,t){this.kpuzzle=e,this.animLeaves=Mt[t.toString()]??jt(t)}animLeaves;getAnimLeaf(e){return this.animLeaves[Math.min(e,this.animLeaves.length-1)]?.animLeaf??null}getAnimLeafWithRange(e){return this.animLeaves[Math.min(e,this.animLeaves.length-1)]}indexToMoveStartTimestamp(e){let t=0;return this.animLeaves.length>0&&(t=this.animLeaves[Math.min(e,this.animLeaves.length-1)].start),t}timestampToIndex(e){let t=0;for(t=0;t<this.animLeaves.length;t++)if(this.animLeaves[t].start>=e)return Math.max(0,t-1);return Math.max(0,t-1)}timestampToPosition(e,n){let r=this.currentMoveInfo(e),i=n??this.kpuzzle.identityTransformation().toKPattern();for(let e of this.animLeaves.slice(0,r.patternIndex)){let n=e.animLeaf.as(t);n!==null&&(i=i.applyMove(n))}return{pattern:i,movesInProgress:r.currentMoves}}currentMoveInfo(e){let n=1/0;for(let t of this.animLeaves)if(t.start<=e&&t.end>=e)n=Math.min(n,t.start);else if(t.start>e)break;let r=[],i=[],a=[],o=[],s=-1/0,c=1/0,l=0;for(let u of this.animLeaves)if(u.end<=n)l++;else if(u.start>e)break;else{let n=u.animLeaf.as(t);if(n!==null){let t=(e-u.start)/(u.end-u.start),l=!1;t>1&&(t=1,l=!0);let d={move:n,direction:1,fraction:t,startTimestamp:u.start,endTimestamp:u.end};switch(t){case 0:i.push(d);break;case 1:l?o.push(d):a.push(d);break;default:r.push(d),s=Math.max(s,u.start),c=Math.min(c,u.end)}}}return{patternIndex:l,currentMoves:r,latestStart:s,earliestEnd:c,movesStarting:i,movesFinishing:a,movesFinished:o}}patternAtIndex(e,n){let r=n??this.kpuzzle.defaultPattern();for(let n=0;n<this.animLeaves.length&&n<e;n++){let e=this.animLeaves[n].animLeaf.as(t);e!==null&&(r=r.applyMove(e))}return r}transformationAtIndex(e){let n=this.kpuzzle.identityTransformation();for(let r of this.animLeaves.slice(0,e)){let e=r.animLeaf.as(t);e!==null&&(n=n.applyMove(e))}return n}algDuration(){let e=0;for(let t of this.animLeaves)e=Math.max(e,t.end);return e}numAnimatedLeaves(){return this.animLeaves.length}moveDuration(e){let t=this.getAnimLeafWithRange(e);return t.end-t.start}},H=class{constructor(e,t,n,r,i=[]){this.moveCount=e,this.duration=t,this.forward=n,this.backward=r,this.children=i}},Pt=class extends o{constructor(e){super(),this.kpuzzle=e,this.identity=e.identityTransformation(),this.dummyLeaf=new H(0,0,this.identity,this.identity,[])}identity;dummyLeaf;durationFn=new Et(V);cache={};traverseAlg(e){let t=0,n=0,r=this.identity,i=[];for(let a of e.childAlgNodes()){let e=this.traverseAlgNode(a);t+=e.moveCount,n+=e.duration,r=r===this.identity?e.forward:r.applyTransformation(e.forward),i.push(e)}return new H(t,n,r,r.invert(),i)}traverseGrouping(e){let t=this.traverseAlg(e.alg);return this.mult(t,e.amount,[t])}traverseMove(e){let t=e.toString(),n=this.cache[t];if(n)return n;let r=this.kpuzzle.moveToTransformation(e);return n=new H(1,this.durationFn.traverseAlgNode(e),r,r.invert()),this.cache[t]=n,n}traverseCommutator(e){let t=this.traverseAlg(e.A),n=this.traverseAlg(e.B),r=t.forward.applyTransformation(n.forward),i=t.backward.applyTransformation(n.backward),a=r.applyTransformation(i),o=new H(2*(t.moveCount+n.moveCount),2*(t.duration+n.duration),a,a.invert(),[t,n]);return this.mult(o,1,[o,t,n])}traverseConjugate(e){let t=this.traverseAlg(e.A),n=this.traverseAlg(e.B),r=t.forward.applyTransformation(n.forward).applyTransformation(t.backward),i=new H(2*t.moveCount+n.moveCount,2*t.duration+n.duration,r,r.invert(),[t,n]);return this.mult(i,1,[i,t,n])}traversePause(e){return e.experimentalNISSGrouping?this.dummyLeaf:new H(1,this.durationFn.traverseAlgNode(e),this.identity,this.identity)}traverseNewline(e){return this.dummyLeaf}traverseLineComment(e){return this.dummyLeaf}mult(e,t,n){let r=Math.abs(t),i=e.forward.selfMultiply(t);return new H(e.moveCount*r,e.duration*r,i,i.invert(),n)}},U=class{constructor(e,t){this.apd=e,this.back=t}},Ft=class extends n{constructor(e,t,n){super(),this.kpuzzle=e,this.algOrAlgNode=t,this.apd=n,this.i=-1,this.dur=-1,this.goali=-1,this.goaldur=-1,this.move=void 0,this.back=!1,this.moveDuration=0,this.st=this.kpuzzle.identityTransformation(),this.root=new U(this.apd,!1)}move;moveDuration;back;st;root;i;dur;goali;goaldur;moveByIndex(e){return this.i>=0&&this.i===e?this.move!==void 0:this.dosearch(e,1/0)}moveByDuration(e){return this.dur>=0&&this.dur<e&&this.dur+this.moveDuration>=e?this.move!==void 0:this.dosearch(1/0,e)}dosearch(e,t){return this.goali=e,this.goaldur=t,this.i=0,this.dur=0,this.move=void 0,this.moveDuration=0,this.back=!1,this.st=this.kpuzzle.identityTransformation(),this.algOrAlgNode.is(f)?this.traverseAlg(this.algOrAlgNode,this.root):this.traverseAlgNode(this.algOrAlgNode,this.root)}traverseAlg(e,t){if(!this.firstcheck(t))return!1;let n=t.back?e.experimentalNumChildAlgNodes()-1:0;for(let i of r(e.childAlgNodes(),t.back?-1:1)){if(this.traverseAlgNode(i,new U(t.apd.children[n],t.back)))return!0;n+=t.back?-1:1}return!1}traverseGrouping(e,t){if(!this.firstcheck(t))return!1;let n=this.domult(t,e.amount);return this.traverseAlg(e.alg,new U(t.apd.children[0],n))}traverseMove(e,t){return this.firstcheck(t)?(this.move=e,this.moveDuration=t.apd.duration,this.back=t.back,!0):!1}traverseCommutator(e,t){if(!this.firstcheck(t))return!1;let n=this.domult(t,1);return n?this.traverseAlg(e.B,new U(t.apd.children[2],!n))||this.traverseAlg(e.A,new U(t.apd.children[1],!n))||this.traverseAlg(e.B,new U(t.apd.children[2],n))||this.traverseAlg(e.A,new U(t.apd.children[1],n)):this.traverseAlg(e.A,new U(t.apd.children[1],n))||this.traverseAlg(e.B,new U(t.apd.children[2],n))||this.traverseAlg(e.A,new U(t.apd.children[1],!n))||this.traverseAlg(e.B,new U(t.apd.children[2],!n))}traverseConjugate(e,t){if(!this.firstcheck(t))return!1;let n=this.domult(t,1);return n?this.traverseAlg(e.A,new U(t.apd.children[1],!n))||this.traverseAlg(e.B,new U(t.apd.children[2],n))||this.traverseAlg(e.A,new U(t.apd.children[1],n)):this.traverseAlg(e.A,new U(t.apd.children[1],n))||this.traverseAlg(e.B,new U(t.apd.children[2],n))||this.traverseAlg(e.A,new U(t.apd.children[1],!n))}traversePause(e,t){return this.firstcheck(t)?(this.move=e,this.moveDuration=t.apd.duration,this.back=t.back,!0):!1}traverseNewline(e,t){return!1}traverseLineComment(e,t){return!1}firstcheck(e){return e.apd.moveCount+this.i<=this.goali&&e.apd.duration+this.dur<this.goaldur?this.keepgoing(e):!0}domult(e,t){let n=e.back;if(t===0)return n;t<0&&(n=!n,t=-t);let r=e.apd.children[0],i=Math.min(Math.floor((this.goali-this.i)/r.moveCount),Math.ceil((this.goaldur-this.dur)/r.duration-1));return i>0&&this.keepgoing(new U(r,n),i),n}keepgoing(e,t=1){return this.i+=t*e.apd.moveCount,this.dur+=t*e.apd.duration,t===1?e.back?this.st=this.st.applyTransformation(e.apd.backward):this.st=this.st.applyTransformation(e.apd.forward):e.back?this.st=this.st.applyTransformation(e.apd.backward.selfMultiply(t)):this.st=this.st.applyTransformation(e.apd.forward.selfMultiply(t)),!1}},It=16;function Lt(e,t){let n=new c,r=new c;for(let i of e.childAlgNodes())r.push(i),r.experimentalNumAlgNodes()>=t&&(n.push(new a(r.toAlg())),r.reset());return n.push(new a(r.toAlg())),n.toAlg()}var Rt=u(class extends o{traverseAlg(e){let t=e.experimentalNumChildAlgNodes();return t<It?e:Lt(e,Math.ceil(Math.sqrt(t)))}traverseGrouping(e){return new a(this.traverseAlg(e.alg),e.amount)}traverseMove(e){return e}traverseCommutator(e){return new d(this.traverseAlg(e.A),this.traverseAlg(e.B))}traverseConjugate(e){return new d(this.traverseAlg(e.A),this.traverseAlg(e.B))}traversePause(e){return e}traverseNewline(e){return e}traverseLineComment(e){return e}}),W=class{constructor(e,t){this.kpuzzle=e;let n=new Pt(this.kpuzzle),r=Rt(t);this.decoration=n.traverseAlg(r),this.walker=new Ft(this.kpuzzle,r,this.decoration)}decoration;walker;getAnimLeaf(e){if(this.walker.moveByIndex(e)){if(!this.walker.move)throw Error("`this.walker.mv` missing");let e=this.walker.move;return this.walker.back?e.invert():e}return null}indexToMoveStartTimestamp(e){if(this.walker.moveByIndex(e)||this.walker.i===e)return this.walker.dur;throw Error(`Out of algorithm: index ${e}`)}indexToMovesInProgress(e){if(this.walker.moveByIndex(e)||this.walker.i===e)return this.walker.dur;throw Error(`Out of algorithm: index ${e}`)}patternAtIndex(e,t){return this.walker.moveByIndex(e),(t??this.kpuzzle.defaultPattern()).applyTransformation(this.walker.st)}transformationAtIndex(e){return this.walker.moveByIndex(e),this.walker.st}numAnimatedLeaves(){return this.decoration.moveCount}timestampToIndex(e){return this.walker.moveByDuration(e),this.walker.i}algDuration(){return this.decoration.duration}moveDuration(e){return this.walker.moveByIndex(e),this.walker.moveDuration}},zt=1024,Bt=class extends v{derive(e){switch(e.indexerConstructorRequest){case`auto`:return De(e.alg.alg)<=zt&&e.puzzle===`3x3x3`&&e.visualizationStrategy===`Cube3D`?Nt:W;case`tree`:return W;case`simple`:return Dt;case`simultaneous`:return Nt;default:throw Error(`Invalid indexer request!`)}}},Vt=class extends C{getDefaultValue(){return`auto`}},Ht=class extends v{derive(e){return new e.indexerConstructor(e.kpuzzle,e.algWithIssues.alg)}},Ut=class extends v{derive(e){return{pattern:e.currentPattern,movesInProgress:e.currentMoveInfo.currentMoves}}},Wt=!0,Gt=class extends v{async derive(e){try{return Wt&&e.kpuzzle.algToTransformation(e.algWithIssues.alg),e.algWithIssues}catch(e){return{alg:new f,issues:new B({errors:[`Invalid alg for puzzle: ${e.toString()}`]})}}}},Kt=class extends C{getDefaultValue(){return`start`}},qt=class extends C{getDefaultValue(){return null}},Jt=class extends v{async derive(e){return e.puzzleLoader.kpuzzle()}},Yt=class extends C{getDefaultValue(){return g}},Xt=class extends v{async derive(e){return e.puzzleLoader.id}},Zt=class extends C{getDefaultValue(){return g}},Qt=class extends v{derive(e){if(e.puzzleIDRequest&&e.puzzleIDRequest!==g){let t=ce[e.puzzleIDRequest];return t||this.userVisibleErrorTracker.set({errors:[`Invalid puzzle ID: ${e.puzzleIDRequest}`]}),t}return e.puzzleDescriptionRequest&&e.puzzleDescriptionRequest!==g?re(e.puzzleDescriptionRequest):de}},$t=class extends v{derive(e){return{playing:e.playingInfo.playing,atStart:e.detailedTimelineInfo.atStart,atEnd:e.detailedTimelineInfo.atEnd}}canReuseValue(e,t){return e.playing===t.playing&&e.atStart===t.atStart&&e.atEnd===t.atEnd}},en=class extends v{derive(e){let t=this.#e(e),n=!1,r=!1;return t>=e.timeRange.end&&(r=!0,t=Math.min(e.timeRange.end,t)),t<=e.timeRange.start&&(n=!0,t=Math.max(e.timeRange.start,t)),{timestamp:t,timeRange:e.timeRange,atStart:n,atEnd:r}}#e(e){switch(e.timestampRequest){case`auto`:return e.setupAnchor===`start`&&e.setupAlg.alg.experimentalIsEmpty()?e.timeRange.end:e.timeRange.start;case`start`:return e.timeRange.start;case`end`:return e.timeRange.end;case`anchor`:return e.setupAnchor===`start`?e.timeRange.start:e.timeRange.end;case`opposite-anchor`:return e.setupAnchor===`start`?e.timeRange.end:e.timeRange.start;default:return e.timestampRequest}}canReuseValue(e,t){return e.timestamp===t.timestamp&&e.timeRange.start===t.timeRange.start&&e.timeRange.end===t.timeRange.end&&e.atStart===t.atStart&&e.atEnd===t.atEnd}},tn=class extends _{async getDefaultValue(){return{direction:1,playing:!1,untilBoundary:`entire-timeline`,loop:!1}}async derive(e,t){let n=await t,r=Object.assign({},n);return Object.assign(r,e),r}canReuseValue(e,t){return e.direction===t.direction&&e.playing===t.playing&&e.untilBoundary===t.untilBoundary&&e.loop===t.loop}},nn=class extends _{getDefaultValue(){return 1}derive(e){return e<0?1:e}},rn={auto:!0,start:!0,end:!0,anchor:!0,"opposite-anchor":!0},an=class extends C{getDefaultValue(){return`auto`}set(e){let t=this.get();super.set((async()=>this.validInput(await e)?e:t)())}validInput(e){return!!(typeof e==`number`||rn[e])}},on={none:!0,"side-by-side":!0,"top-right":!0},sn=class extends C{getDefaultValue(){return`auto`}},cn=class extends v{derive(e){return{start:0,end:e.indexer.algDuration()}}},ln=class extends C{getDefaultValue(){return`auto`}},un=class extends C{getDefaultValue(){return`auto`}},dn=class extends v{derive(e){switch(e.puzzleID){case`clock`:case`square1`:case`redi_cube`:case`melindas2x2x2x2`:case`tri_quad`:case`loopover`:return`2D`;case`3x3x3`:switch(e.visualizationRequest){case`auto`:case`3D`:return`Cube3D`;default:return e.visualizationRequest}default:switch(e.visualizationRequest){case`auto`:case`3D`:return`PG3D`;case`experimental-2D-LL`:case`experimental-2D-LL-face`:return[`2x2x2`,`4x4x4`,`megaminx`].includes(e.puzzleID)?`experimental-2D-LL`:`2D`;default:return e.visualizationRequest}}}},fn=class extends C{getDefaultValue(){return`auto`}},pn=class extends C{getDefaultValue(){return`auto`}},mn=class extends C{getDefaultValue(){return`auto`}},hn=null;async function gn(){return hn??=new(await x).TextureLoader}var _n=class extends v{async derive(e){let{spriteURL:t}=e;return t===null?null:new Promise(async(e,n)=>{let r=()=>{console.warn(`Could not load sprite:`,t.toString()),e(null)};try{(await gn()).load(t.toString(),e,r,r)}catch{r()}})}},vn={facelets:[`regular`,`regular`,`regular`,`regular`,`regular`]};async function yn(e){let{definition:t}=await e.kpuzzle(),n={orbits:{}};for(let e of t.orbits)n.orbits[e.orbitName]={pieces:Array(e.numPieces).fill(vn)};return n}var bn=class extends v{getDefaultValue(){return{orbits:{}}}async derive(e){return e.stickeringMaskRequest?e.stickeringMaskRequest:e.stickeringRequest===`picture`?{specialBehaviour:`picture`,orbits:{}}:e.puzzleLoader.stickeringMask?.(e.stickeringRequest??`full`)??yn(e.puzzleLoader)}},xn={"-":`Regular`,D:`Dim`,I:`Ignored`,X:`Invisible`,O:`IgnoreNonPrimary`,P:`PermuteNonPrimary`,o:`Ignoriented`,"?":`OrientationWithoutPermutation`,"@":`Regular`};function Sn(e){let t={orbits:{}},n=e.split(`,`);for(let e of n){let[n,r,...i]=e.split(`:`);if(i.length>0)throw Error(`Invalid serialized orbit stickering mask (too many colons): \`${e}\``);let a=[];t.orbits[n]={pieces:a};for(let e of r){let t=xn[e];a.push(ie(t))}}return t}var Cn=class extends _{getDefaultValue(){return null}derive(e){return e===null?null:typeof e==`string`?Sn(e):e}},wn=class extends C{getDefaultValue(){return null}},Tn=class extends C{getDefaultValue(){return`auto`}},En=class extends C{getDefaultValue(){return{}}},Dn=class extends C{getDefaultValue(){return`auto`}},On=class extends C{getDefaultValue(){return`auto`}},kn=class extends v{derive(e){return e.colorSchemeRequest===`dark`?`dark`:`light`}},An=class extends C{getDefaultValue(){return`auto`}},jn=class extends C{getDefaultValue(){return null}},Mn=35,Nn=class extends C{getDefaultValue(){return Mn}};function Pn(e,t){return e.latitude===t.latitude&&e.longitude===t.longitude&&e.distance===t.distance}var Fn=class extends _{getDefaultValue(){return`auto`}canReuseValue(e,t){return e===t||Pn(e,t)}async derive(e,t){if(e===`auto`)return`auto`;let n=await t;n===`auto`&&(n={});let r=Object.assign({},n);return Object.assign(r,e),r.latitude!==void 0&&(r.latitude=Math.min(Math.max(r.latitude,-90),90)),r.longitude!==void 0&&(r.longitude=O(r.longitude,180,-180)),r}},In=class extends v{canReuseValue(e,t){return Pn(e,t)}async derive(e){if(e.orbitCoordinatesRequest===`auto`)return Hn(e.puzzleID,e.strategy);let t=Object.assign(Object.assign({},Hn(e.puzzleID,e.strategy),e.orbitCoordinatesRequest));if(Math.abs(t.latitude)<=e.latitudeLimit)return t;{let{latitude:n,longitude:r,distance:i}=t;return{latitude:e.latitudeLimit*Math.sign(n),longitude:r,distance:i}}}},Ln={latitude:31.717474411461005,longitude:0,distance:5.877852522924731},Rn={latitude:35,longitude:30,distance:6},zn={latitude:35,longitude:30,distance:6.25},Bn={latitude:Math.atan(1/2)*ue,longitude:0,distance:6.7},Vn={latitude:26.56505117707799,longitude:0,distance:6};function Hn(e,t){if(e[1]===`x`)return t===`Cube3D`?Rn:zn;switch(e){case`megaminx`:case`gigaminx`:return Bn;case`pyraminx`:case`master_tetraminx`:return Vn;case`skewb`:return zn;default:return Ln}}var Un=class{constructor(e){this.twistyPlayerModel=e,this.orbitCoordinates=new In({orbitCoordinatesRequest:this.orbitCoordinatesRequest,latitudeLimit:this.latitudeLimit,puzzleID:e.puzzleID,strategy:e.visualizationStrategy}),this.stickeringMask=new bn({stickeringMaskRequest:this.stickeringMaskRequest,stickeringRequest:this.stickeringRequest,puzzleLoader:e.puzzleLoader})}background=new On;colorSchemeRequest=new An;dragInput=new Tn;foundationDisplay=new pn;foundationStickerSpriteURL=new z;fullscreenElement=new jn;hintFacelet=new le;hintStickerSpriteURL=new z;initialHintFaceletsAnimation=new mn;latitudeLimit=new Nn;movePressInput=new Dn;movePressCancelOptions=new En;orbitCoordinatesRequest=new Fn;stickeringMaskRequest=new Cn;stickeringRequest=new wn;faceletScale=new fn;colorScheme=new kn({colorSchemeRequest:this.colorSchemeRequest});foundationStickerSprite=new _n({spriteURL:this.foundationStickerSpriteURL});hintStickerSprite=new _n({spriteURL:this.hintStickerSpriteURL});orbitCoordinates;stickeringMask},Wn={errors:[]},Gn=class extends C{getDefaultValue(){return Wn}reset(){this.set(this.getDefaultValue())}canReuseValue(e,t){return D(e.errors,t.errors)}},Kn=class{userVisibleErrorTracker=new Gn;alg=new yt;backView=new sn;controlPanel=new Ie;catchUpMove=new St;indexerConstructorRequest=new Vt;playingInfo=new tn;puzzleDescriptionRequest=new Yt;puzzleIDRequest=new Zt;setupAnchor=new Kt;setupAlg=new yt;setupTransformation=new qt;tempoScale=new nn;timestampRequest=new an;viewerLink=new ln;visualizationFormat=new un;title=new gt;videoURL=new z;competitionID=new gt;puzzleLoader=new Qt({puzzleIDRequest:this.puzzleIDRequest,puzzleDescriptionRequest:this.puzzleDescriptionRequest},this.userVisibleErrorTracker);kpuzzle=new Jt({puzzleLoader:this.puzzleLoader});puzzleID=new Xt({puzzleLoader:this.puzzleLoader});puzzleAlg=new Gt({algWithIssues:this.alg,kpuzzle:this.kpuzzle});puzzleSetupAlg=new Gt({algWithIssues:this.setupAlg,kpuzzle:this.kpuzzle});visualizationStrategy=new dn({visualizationRequest:this.visualizationFormat,puzzleID:this.puzzleID});indexerConstructor=new Bt({alg:this.alg,puzzle:this.puzzleID,visualizationStrategy:this.visualizationStrategy,indexerConstructorRequest:this.indexerConstructorRequest});setupAlgTransformation=new bt({setupAlg:this.puzzleSetupAlg,kpuzzle:this.kpuzzle});indexer=new Ht({indexerConstructor:this.indexerConstructor,algWithIssues:this.puzzleAlg,kpuzzle:this.kpuzzle});anchorTransformation=new xt({setupTransformation:this.setupTransformation,setupAnchor:this.setupAnchor,setupAlgTransformation:this.setupAlgTransformation,indexer:this.indexer});timeRange=new cn({indexer:this.indexer});detailedTimelineInfo=new en({timestampRequest:this.timestampRequest,timeRange:this.timeRange,setupAnchor:this.setupAnchor,setupAlg:this.setupAlg});coarseTimelineInfo=new $t({detailedTimelineInfo:this.detailedTimelineInfo,playingInfo:this.playingInfo});currentMoveInfo=new wt({indexer:this.indexer,detailedTimelineInfo:this.detailedTimelineInfo,catchUpMove:this.catchUpMove});buttonAppearance=new tt({coarseTimelineInfo:this.coarseTimelineInfo,viewerLink:this.viewerLink});currentLeavesSimplified=new Ct({currentMoveInfo:this.currentMoveInfo});currentPattern=new Tt({anchoredStart:this.anchorTransformation,currentLeavesSimplified:this.currentLeavesSimplified,indexer:this.indexer});legacyPosition=new Ut({currentMoveInfo:this.currentMoveInfo,currentPattern:this.currentPattern});twistySceneModel=new Un(this);async twizzleLink(){let[e,t,n,r,i,a,o,s]=await Promise.all([this.viewerLink.get(),this.puzzleID.get(),this.puzzleDescriptionRequest.get(),this.alg.get(),this.setupAlg.get(),this.setupAnchor.get(),this.twistySceneModel.stickeringRequest.get(),this.twistySceneModel.twistyPlayerModel.title.get()]),c=e===`experimental-twizzle-explorer`,l=new URL(`https://alpha.twizzle.net/${c?`explore`:`edit`}/`);return r.alg.experimentalIsEmpty()||l.searchParams.set(`alg`,r.alg.toString()),i.alg.experimentalIsEmpty()||l.searchParams.set(`setup-alg`,i.alg.toString()),a!==`start`&&l.searchParams.set(`setup-anchor`,a),o!==`full`&&o!==null&&l.searchParams.set(`experimental-stickering`,o),c&&n!==g?l.searchParams.set(`puzzle-description`,n):t!==`3x3x3`&&l.searchParams.set(`puzzle`,t),s&&l.searchParams.set(`title`,s),l.toString()}experimentalAddAlgLeaf(e,n){let r=e.as(t);r?this.experimentalAddMove(r,n):this.alg.set((async()=>{let t=(await this.alg.get()).alg.concat(new f([e]));return this.timestampRequest.set(`end`),t})())}experimentalAddMove(e,n){let r=typeof e==`string`?new t(e):e;this.alg.set((async()=>{let[{alg:e},t]=await Promise.all([this.alg.get(),this.puzzleLoader.get()]),a=i(e,r,{...n,...await ne(t)});return this.timestampRequest.set(`end`),this.catchUpMove.set({move:r,amount:0}),a})())}experimentalRemoveFinalChild(){this.alg.set((async()=>{let e=(await this.alg.get()).alg,n=Array.from(e.childAlgNodes()),[r]=n.splice(-1);if(!r)return e;this.timestampRequest.set(`end`);let i=r.as(t);return i&&this.catchUpMove.set({move:i.invert(),amount:0}),new f(n)})())}};function G(e){return Error(`Cannot get \`.${e}\` directly from a \`TwistyPlayer\`.`)}var qn=class extends S{experimentalModel=new Kn;set alg(e){this.experimentalModel.alg.set(e)}get alg(){throw G(`alg`)}set experimentalSetupAlg(e){this.experimentalModel.setupAlg.set(e)}get experimentalSetupAlg(){throw G(`setup`)}set experimentalSetupAnchor(e){this.experimentalModel.setupAnchor.set(e)}get experimentalSetupAnchor(){throw G(`anchor`)}set puzzle(e){this.experimentalModel.puzzleIDRequest.set(e)}get puzzle(){throw G(`puzzle`)}set experimentalPuzzleDescription(e){this.experimentalModel.puzzleDescriptionRequest.set(e)}get experimentalPuzzleDescription(){throw G(`experimentalPuzzleDescription`)}set timestamp(e){this.experimentalModel.timestampRequest.set(e)}get timestamp(){throw G(`timestamp`)}set hintFacelets(e){this.experimentalModel.twistySceneModel.hintFacelet.set(e)}get hintFacelets(){throw G(`hintFacelets`)}set experimentalStickering(e){this.experimentalModel.twistySceneModel.stickeringRequest.set(e)}get experimentalStickering(){throw G(`experimentalStickering`)}set experimentalStickeringMaskOrbits(e){this.experimentalModel.twistySceneModel.stickeringMaskRequest.set(e)}get experimentalStickeringMaskOrbits(){throw G(`experimentalStickeringMaskOrbits`)}set experimentalFaceletScale(e){this.experimentalModel.twistySceneModel.faceletScale.set(e)}get experimentalFaceletScale(){throw G(`experimentalFaceletScale`)}set backView(e){this.experimentalModel.backView.set(e)}get backView(){throw G(`backView`)}set background(e){this.experimentalModel.twistySceneModel.background.set(e)}get background(){throw G(`background`)}set colorScheme(e){this.experimentalModel.twistySceneModel.colorSchemeRequest.set(e)}get colorScheme(){throw G(`colorScheme`)}set controlPanel(e){this.experimentalModel.controlPanel.set(e)}get controlPanel(){throw G(`controlPanel`)}set visualization(e){this.experimentalModel.visualizationFormat.set(e)}get visualization(){throw G(`visualization`)}set experimentalTitle(e){this.experimentalModel.title.set(e)}get experimentalTitle(){throw G(`experimentalTitle`)}set experimentalVideoURL(e){this.experimentalModel.videoURL.set(e)}get experimentalVideoURL(){throw G(`experimentalVideoURL`)}set experimentalCompetitionID(e){this.experimentalModel.competitionID.set(e)}get experimentalCompetitionID(){throw G(`experimentalCompetitionID`)}set viewerLink(e){this.experimentalModel.viewerLink.set(e)}get viewerLink(){throw G(`viewerLink`)}set experimentalMovePressInput(e){this.experimentalModel.twistySceneModel.movePressInput.set(e)}get experimentalMovePressInput(){throw G(`experimentalMovePressInput`)}set experimentalMovePressCancelOptions(e){this.experimentalModel.twistySceneModel.movePressCancelOptions.set(e)}get experimentalMovePressCancelOptions(){throw G(`experimentalMovePressCancelOptions`)}set cameraLatitude(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({latitude:e})}get cameraLatitude(){throw G(`cameraLatitude`)}set cameraLongitude(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({longitude:e})}get cameraLongitude(){throw G(`cameraLongitude`)}set cameraDistance(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({distance:e})}get cameraDistance(){throw G(`cameraDistance`)}set cameraLatitudeLimit(e){this.experimentalModel.twistySceneModel.latitudeLimit.set(e)}get cameraLatitudeLimit(){throw G(`cameraLatitudeLimit`)}set indexer(e){this.experimentalModel.indexerConstructorRequest.set(e)}get indexer(){throw G(`indexer`)}set tempoScale(e){this.experimentalModel.tempoScale.set(e)}get tempoScale(){throw G(`tempoScale`)}set experimentalSprite(e){this.experimentalModel.twistySceneModel.foundationStickerSpriteURL.set(e)}get experimentalSprite(){throw G(`experimentalSprite`)}set experimentalHintSprite(e){this.experimentalModel.twistySceneModel.hintStickerSpriteURL.set(e)}get experimentalHintSprite(){throw G(`experimentalHintSprite`)}set fullscreenElement(e){this.experimentalModel.twistySceneModel.fullscreenElement.set(e)}get fullscreenElement(){throw G(`fullscreenElement`)}set experimentalInitialHintFaceletsAnimation(e){this.experimentalModel.twistySceneModel.initialHintFaceletsAnimation.set(e)}get experimentalInitialHintFaceletsAnimation(){throw G(`experimentalInitialHintFaceletsAnimation`)}set experimentalDragInput(e){this.experimentalModel.twistySceneModel.dragInput.set(e)}get experimentalDragInput(){throw G(`experimentalDragInput`)}experimentalGet=new Jn(this.experimentalModel)},Jn=class{constructor(e){this.model=e}async alg(){return(await this.model.alg.get()).alg}async setupAlg(){return(await this.model.setupAlg.get()).alg}puzzleID(){return this.model.puzzleID.get()}async timestamp(){return(await this.model.detailedTimelineInfo.get()).timestamp}},Yn=`data-`,K={alg:`alg`,"experimental-setup-alg":`experimentalSetupAlg`,"experimental-setup-anchor":`experimentalSetupAnchor`,puzzle:`puzzle`,"experimental-puzzle-description":`experimentalPuzzleDescription`,visualization:`visualization`,"hint-facelets":`hintFacelets`,"experimental-stickering":`experimentalStickering`,"experimental-stickering-mask-orbits":`experimentalStickeringMaskOrbits`,background:`background`,"color-scheme":`colorScheme`,"control-panel":`controlPanel`,"back-view":`backView`,"experimental-initial-hint-facelets-animation":`experimentalInitialHintFaceletsAnimation`,"viewer-link":`viewerLink`,"experimental-move-press-input":`experimentalMovePressInput`,"experimental-drag-input":`experimentalDragInput`,"experimental-title":`experimentalTitle`,"experimental-video-url":`experimentalVideoURL`,"experimental-competition-id":`experimentalCompetitionID`,"camera-latitude":`cameraLatitude`,"camera-longitude":`cameraLongitude`,"camera-distance":`cameraDistance`,"camera-latitude-limit":`cameraLatitudeLimit`,"tempo-scale":`tempoScale`,"experimental-sprite":`experimentalSprite`,"experimental-hint-sprite":`experimentalHintSprite`},Xn=Object.fromEntries(Object.values(K).map(e=>[e,!0])),Zn={experimentalMovePressCancelOptions:!0},q=class extends qn{controller=new Pe(this.experimentalModel,this);buttons;experimentalCanvasClickCallback=()=>{};constructor(e={}){super();for(let[t,n]of Object.entries(e)){if(!(Xn[t]||Zn[t])){console.warn(`Invalid config passed to TwistyPlayer: ${t}`);break}this[t]=n}}#e=new j(this,`controls-`,[`auto`].concat(Object.keys(Fe)));#t=document.createElement(`div`);#n=document.createElement(`div`);#r=!1;async connectedCallback(){if(this.#r)return;this.#r=!0,this.addCSS(ht),this.addElement(this.#t).classList.add(`visualization-wrapper`),this.addElement(this.#n).classList.add(`error-elem`),this.#n.textContent=`Error`,this.experimentalModel.userVisibleErrorTracker.addFreshListener(e=>{let t=e.errors[0]??null;this.contentWrapper.classList.toggle(`error`,!!t),t&&(this.#n.textContent=t)});let e=new ut(this.experimentalModel,this.controller);this.contentWrapper.appendChild(e),this.buttons=new rt(this.experimentalModel,this.controller,this),this.contentWrapper.appendChild(this.buttons),this.experimentalModel.twistySceneModel.background.addFreshListener(e=>{this.contentWrapper.classList.toggle(`checkered`,[`auto`,`checkered`].includes(e)),this.contentWrapper.classList.toggle(`checkered-transparent`,e===`checkered-transparent`)}),this.experimentalModel.twistySceneModel.colorScheme.addFreshListener(e=>{this.contentWrapper.classList.toggle(`dark-mode`,[`dark`].includes(e))}),this.experimentalModel.controlPanel.addFreshListener(e=>{this.#e.setValue(e)}),this.experimentalModel.visualizationStrategy.addFreshListener(this.#c.bind(this)),this.experimentalModel.puzzleID.addFreshListener(this.flash.bind(this))}#i=`auto`;experimentalSetFlashLevel(e){this.#i=e}flash(){this.#i===`auto`&&this.#a?.animate([{opacity:.25},{opacity:1}],{duration:250,easing:`ease-out`})}#a=null;#o=new Ke;#s=null;#c(e){if(e!==this.#s){this.#a?.remove(),this.#a?.disconnect();let t;switch(e){case`2D`:case`experimental-2D-LL`:case`experimental-2D-LL-face`:t=new Ge(this.experimentalModel.twistySceneModel,e);break;case`Cube3D`:case`PG3D`:t=new M(this.experimentalModel),this.#o.handleNewValue(t);break;default:throw Error(`Invalid visualization`)}this.#t.appendChild(t),this.#a=t,this.#s=e}}async experimentalCurrentVantages(){this.connectedCallback();let e=this.#a;return e instanceof M?e.experimentalVantages():[]}async experimentalCurrentCanvases(){let e=await this.experimentalCurrentVantages(),t=[];for(let n of e)t.push((await n.canvasInfo()).canvas);return t}async experimentalCurrentThreeJSPuzzleObject(e){this.connectedCallback();let t=await(await this.#o.promise).experimentalTwisty3DPuzzleWrapper(),n=t.twisty3DPuzzle(),r=(async()=>{await n,await new Promise(e=>setTimeout(e,0))})();if(e){let n=new b(async()=>{});t.addEventListener(`render-scheduled`,async()=>{n.requestIsPending()||(n.requestAnimFrame(),await r,e())})}return n}jumpToStart(e){this.controller.jumpToStart(e)}jumpToEnd(e){this.controller.jumpToEnd(e)}play(){this.controller.togglePlay(!0)}pause(){this.controller.togglePlay(!1)}togglePlay(e){this.controller.togglePlay(e)}experimentalAddMove(e,t){this.experimentalModel.experimentalAddMove(e,t)}experimentalAddAlgLeaf(e,t){this.experimentalModel.experimentalAddAlgLeaf(e,t)}static get observedAttributes(){let e=[];for(let t of Object.keys(K))e.push(t,Yn+t);return e}experimentalRemoveFinalChild(){this.experimentalModel.experimentalRemoveFinalChild()}attributeChangedCallback(e,t,n){e.startsWith(Yn)&&(e=e.slice(Yn.length));let r=K[e];r&&(this[r]=n)}async experimentalScreenshot(e){return(await ft(this.experimentalModel,e)).dataURL}async experimentalDownloadScreenshot(e){if([`2D`,`experimental-2D-LL`,`experimental-2D-LL-face`].includes(await this.experimentalModel.visualizationStrategy.get())){let t=await this.#a.currentTwisty2DPuzzleWrapper().twisty2DPuzzle(),n=new XMLSerializer().serializeToString(t.svgWrapper.svgElement);mt(URL.createObjectURL(new Blob([n])),e??await pt(this.experimentalModel),`svg`)}else await(await ft(this.experimentalModel)).download(e)}};w.define(`twisty-player`,q);var Qn=new h;Qn.replaceSync(`
:host {
  display: inline;
}

.wrapper {
  display: inline;
}

a:not(:hover) {
  color: inherit;
  text-decoration: none;
}

twisty-alg-leaf-elem.twisty-alg-comment {
  color: rgba(0, 0, 0, 0.4);
}

.wrapper.current-move {
  background: rgba(66, 133, 244, 0.3);
  margin-left: -0.1em;
  margin-right: -0.1em;
  padding-left: 0.1em;
  padding-right: 0.1em;
  border-radius: 0.1em;
}
`);async function $n(e){return new Promise((t,n)=>{let r=document.getElementById(e);r&&t(r);let i=new MutationObserver(n=>{for(let r of n)r.attributeName===`id`&&r.target instanceof Element&&r.target.getAttribute(`id`)===e&&(t(r.target),i.disconnect())});i.observe(document.body,{attributeFilter:[`id`],subtree:!0})})}var er=250,J=class extends S{constructor(e,t,n,r,i,a){if(super({mode:`open`}),this.algOrAlgNode=r,this.classList.add(e),this.addCSS(Qn),a){let e=this.contentWrapper.appendChild(document.createElement(`a`));e.href=`#`,e.textContent=t,e.addEventListener(`click`,e=>{e.preventDefault(),n.twistyAlgViewer.jumpToIndex(n.earliestMoveIndex,i)})}else this.contentWrapper.appendChild(document.createElement(`span`)).textContent=t}pathToIndex(e){return[]}setCurrentMove(e){this.contentWrapper.classList.toggle(`current-move`,e)}};w.define(`twisty-alg-leaf-elem`,J);var Y=class extends ae{constructor(e,t){super(),this.algOrAlgNode=t,this.classList.add(e)}queue=[];addString(e){this.queue.push(document.createTextNode(e))}addElem(e){return this.queue.push(e.element),e.moveCount}flushQueue(e=1){for(let t of rr(this.queue,e))this.append(t);this.queue=[]}pathToIndex(e){return[]}};w.define(`twisty-alg-wrapper-elem`,Y);function tr(e){return e===1?-1:1}function nr(e,t){return t<0?tr(e):e}function rr(e,t){if(t===1)return e;let n=Array.from(e);return n.reverse(),n}var ir=u(class extends n{traverseAlg(e,t){let n=0,r=new Y(`twisty-alg-alg`,e),i=!0;for(let o of p(e.childAlgNodes(),t.direction))i||r.addString(` `),i=!1,o.as(l)?.experimentalNISSGrouping&&r.addString(`^(`),o.as(a)?.experimentalNISSPlaceholder||(n+=r.addElem(this.traverseAlgNode(o,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction}))),o.as(l)?.experimentalNISSGrouping&&r.addString(`)`);return r.flushQueue(t.direction),{moveCount:n,element:r}}traverseGrouping(e,t){let n=e.experimentalAsSquare1Tuple(),r=nr(t.direction,e.amount),i=0,a=new Y(`twisty-alg-grouping`,e);return a.addString(`(`),n?(i+=a.addElem({moveCount:1,element:new J(`twisty-alg-move`,n[0].amount.toString(),t,n[0],!0,!0)}),a.addString(`, `),i+=a.addElem({moveCount:1,element:new J(`twisty-alg-move`,n[1].amount.toString(),t,n[1],!0,!0)})):i+=a.addElem(this.traverseAlg(e.alg,{earliestMoveIndex:t.earliestMoveIndex+i,twistyAlgViewer:t.twistyAlgViewer,direction:r})),a.addString(`)${e.experimentalRepetitionSuffix}`),a.flushQueue(),{moveCount:i*Math.abs(e.amount),element:a}}traverseMove(e,t){let n=new J(`twisty-alg-move`,e.toString(),t,e,!0,!0);return t.twistyAlgViewer.highlighter.addMove(e.startCharIndex,n),{moveCount:1,element:n}}traverseCommutator(e,t){let n=0,r=new Y(`twisty-alg-commutator`,e);r.addString(`[`),r.flushQueue();let[i,a]=rr([e.A,e.B],t.direction);return n+=r.addElem(this.traverseAlg(i,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),r.addString(`, `),n+=r.addElem(this.traverseAlg(a,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),r.flushQueue(t.direction),r.addString(`]`),r.flushQueue(),{moveCount:n*2,element:r}}traverseConjugate(e,t){let n=0,r=new Y(`twisty-alg-conjugate`,e);r.addString(`[`);let i=r.addElem(this.traverseAlg(e.A,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction}));return n+=i,r.addString(`: `),n+=r.addElem(this.traverseAlg(e.B,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),r.addString(`]`),r.flushQueue(),{moveCount:n+i,element:r}}traversePause(e,t){return e.experimentalNISSGrouping?this.traverseAlg(e.experimentalNISSGrouping.alg,t):{moveCount:1,element:new J(`twisty-alg-pause`,`.`,t,e,!0,!0)}}traverseNewline(e,t){let n=new Y(`twisty-alg-newline`,e);return n.append(document.createElement(`br`)),{moveCount:0,element:n}}traverseLineComment(e,t){return{moveCount:0,element:new J(`twisty-alg-line-comment`,`//${e.text}`,t,e,!1,!1)}}}),ar=class{moveCharIndexMap=new Map;currentElem=null;addMove(e,t){this.moveCharIndexMap.set(e,t)}set(e){let t=e?this.moveCharIndexMap.get(e.startCharIndex)??null:null;this.currentElem!==t&&(this.currentElem?.classList.remove(`twisty-alg-current-move`),this.currentElem?.setCurrentMove(!1),t?.classList.add(`twisty-alg-current-move`),t?.setCurrentMove(!0),this.currentElem=t)}},or=class extends ae{highlighter=new ar;#e;#t=null;lastClickTimestamp=null;constructor(e){super(),e?.twistyPlayer&&(this.twistyPlayer=e?.twistyPlayer)}connectedCallback(){}setAlg(e){this.#e=ir(e,{earliestMoveIndex:0,twistyAlgViewer:this,direction:1}).element,this.textContent=``,this.appendChild(this.#e)}get twistyPlayer(){return this.#t}set twistyPlayer(e){this.#n(e)}async#n(e){if(this.#t){console.warn(`twisty-player reassignment is not supported`);return}if(e===null)throw Error(`clearing twistyPlayer is not supported`);this.#t=e,this.#t.experimentalModel.alg.addFreshListener(e=>{this.setAlg(e.alg)});let t=(await this.#t.experimentalModel.alg.get()).alg,n=`startCharIndex`in t?t:f.fromString(t.toString());this.setAlg(n),e.experimentalModel.currentMoveInfo.addFreshListener(e=>{let t=e.currentMoves[0];if(t??=e.movesStarting[0],t??=e.movesFinishing[0],!t)this.highlighter.set(null);else{let e=t.move;this.highlighter.set(e)}}),e.experimentalModel.detailedTimelineInfo.addFreshListener(e=>{e.timestamp!==this.lastClickTimestamp&&(this.lastClickTimestamp=null)})}async jumpToIndex(e,t){let n=this.#t;if(n){n.pause();let r=(async()=>{let r=await n.experimentalModel.indexer.get(),i=t?er:0;return r.indexToMoveStartTimestamp(e)+r.moveDuration(e)-i})();n.experimentalModel.timestampRequest.set(await r),this.lastClickTimestamp===await r?(n.play(),this.lastClickTimestamp=null):this.lastClickTimestamp=await r}}async attributeChangedCallback(e,t,n){if(e===`for`){let e=document.getElementById(n);if(e||console.info(`for= elem does not exist, waiting for one`),await customElements.whenDefined(`twisty-player`),e=await $n(n),!(e instanceof q)){console.warn(`for= elem is not a twisty-player`);return}this.twistyPlayer=e}}static get observedAttributes(){return[`for`]}};w.define(`twisty-alg-viewer`,or);var sr=u(class extends n{traverseAlg(e,t){let n=[],r=0;for(let i of e.childAlgNodes()){let e=this.traverseAlgNode(i,{numMovesSofar:t.numMovesSofar+r});n.push(e.tokens),r+=e.numLeavesInside}return{tokens:Array.prototype.concat(...n),numLeavesInside:r}}traverseGrouping(e,t){let n=this.traverseAlg(e.alg,t);return{tokens:n.tokens,numLeavesInside:n.numLeavesInside*e.amount}}traverseMove(e,t){return{tokens:[{leaf:e,idx:t.numMovesSofar}],numLeavesInside:1}}traverseCommutator(e,t){let n=this.traverseAlg(e.A,t),r=this.traverseAlg(e.B,{numMovesSofar:t.numMovesSofar+n.numLeavesInside});return{tokens:n.tokens.concat(r.tokens),numLeavesInside:n.numLeavesInside*2+r.numLeavesInside}}traverseConjugate(e,t){let n=this.traverseAlg(e.A,t),r=this.traverseAlg(e.B,{numMovesSofar:t.numMovesSofar+n.numLeavesInside});return{tokens:n.tokens.concat(r.tokens),numLeavesInside:n.numLeavesInside*2+r.numLeavesInside*2}}traversePause(e,t){return{tokens:[{leaf:e,idx:t.numMovesSofar}],numLeavesInside:1}}traverseNewline(e,t){return{tokens:[],numLeavesInside:0}}traverseLineComment(e,t){return{tokens:[],numLeavesInside:0}}}),cr=class extends C{getDefaultValue(){return``}},lr=class extends v{derive(e){return _t(e.value)}},ur=class extends _{getDefaultValue(){return{selectionStart:0,selectionEnd:0,endChangedMostRecently:!1}}async derive(e,t){let{selectionStart:n,selectionEnd:r}=e,i=await t;return{selectionStart:n,selectionEnd:r,endChangedMostRecently:e.selectionStart===i.selectionStart&&e.selectionEnd!==(await t).selectionEnd}}},dr=class extends v{derive(e){return e.selectionInfo.endChangedMostRecently?e.selectionInfo.selectionEnd:e.selectionInfo.selectionStart}},fr=class extends v{derive(e){return sr(e.algWithIssues.alg,{numMovesSofar:0}).tokens}},pr=class extends v{derive(e){function t(t){if(t===null)return null;let n;return n=e.targetChar<t.leaf.startCharIndex?`before`:e.targetChar===t.leaf.startCharIndex?`start`:e.targetChar<t.leaf.endCharIndex?`inside`:e.targetChar===t.leaf.endCharIndex?`end`:`after`,{leafInfo:t,where:n}}let n=null;for(let r of e.leafTokens){if(e.targetChar<r.leaf.startCharIndex&&n!==null)return t(n);if(e.targetChar<=r.leaf.endCharIndex)return t(r);n=r}return t(n)}},mr=class{valueProp=new cr;selectionProp=new ur;targetCharProp=new dr({selectionInfo:this.selectionProp});algEditorAlgWithIssues=new lr({value:this.valueProp});leafTokensProp=new fr({algWithIssues:this.algEditorAlgWithIssues});leafToHighlight=new pr({leafTokens:this.leafTokensProp,targetChar:this.targetCharProp})},hr=`//`;function gr(e){try{return f.fromString(e)}catch{return null}}function _r(e,t){let n=e.indexOf(t);return n===-1?[e,``]:[e.slice(0,n),e.slice(n)]}function vr(e){let t=[];for(let n of e.split(`
`)){let[e,r]=_r(n,hr);e=e.replaceAll(`’`,`'`),t.push(e+r)}return t.join(`
`)}function yr(e,t){let{value:n}=e,{selectionStart:r,selectionEnd:i}=e,a=n.slice(0,r),o=n.slice(i);t=t.replaceAll(`\r
`,`
`);let s=a.match(/\/\/[^\n]*$/),c=n[r-1]===`/`&&t[0]===`/`,l=s||c,u=t.match(/\/\/[^\n]*$/),d=t;if(l){let[e,n]=_r(t,`
`);d=e+vr(n)}else d=vr(t);let f=!l&&r!==0&&![`
`,` `].includes(d[0])&&![`
`,` `].includes(n[r-1]),p=!u&&i!==n.length&&![`
`,` `].includes(d.at(-1))&&![`
`,` `].includes(n[i]);function m(e,t){let n=e+d+t,r=!!gr(a+n+o);return r&&(d=n),r}f&&p&&m(` `,` `)||f&&m(` `,``)||p&&m(``,` `),N?.execCommand(`insertText`,!1,d)||e.setRangeText(d,r,i,`end`)}var br=new h;br.replaceSync(`
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
`);var X=`for-twisty-player`,xr=`placeholder`,Sr=`twisty-player-prop`,Cr=class extends S{model=new mr;#e=document.createElement(`textarea`);#t=document.createElement(`div`);#n=document.createElement(`span`);#r=document.createElement(`span`);#i=document.createElement(`span`);#a=new j(this,`valid-for-puzzle-`,[`none`,`warning`,`error`]);#o=null;#s;get#c(){return this.#o===null?null:this.#o.experimentalModel[this.#s]}debugNeverRequestTimestamp=!1;constructor(e){super(),this.#t.classList.add(`carbon-copy`),this.addElement(this.#t),this.#e.rows=1,this.addElement(this.#e),this.#n.classList.add(`prefix`),this.#t.appendChild(this.#n),this.#r.classList.add(`highlight`),this.#t.appendChild(this.#r),this.#i.classList.add(`suffix`),this.#t.appendChild(this.#i),this.#e.placeholder=`Alg`,this.#e.setAttribute(`spellcheck`,`false`),this.addCSS(br),this.#e.addEventListener(`input`,()=>{this.#l=!0,this.onInput()}),this.#e.addEventListener(`blur`,()=>this.onBlur()),document.addEventListener(`selectionchange`,()=>this.onSelectionChange()),e?.twistyPlayer&&(this.twistyPlayer=e.twistyPlayer),this.#s=e?.twistyPlayerProp??`alg`,e?.twistyPlayerProp===`alg`&&this.model.leafToHighlight.addFreshListener(e=>{e&&this.highlightLeaf(e.leafInfo.leaf)})}connectedCallback(){this.#e.addEventListener(`paste`,e=>{let t=e.clipboardData?.getData(`text`);t&&(yr(this.#e,t),e.preventDefault(),this.onInput())})}set algString(e){this.#e.value=e,this.onInput()}get algString(){return this.#e.value}set placeholder(e){this.#e.placeholder=e}#l=!1;onInput(){this.#r.hidden=!0,this.highlightLeaf(null);let e=this.#e.value.trimEnd();this.model.valueProp.set(e),this.#c?.set(e)}async onSelectionChange(){if(document.activeElement!==this||this.shadow.activeElement!==this.#e||this.#s!==`alg`)return;let{selectionStart:e,selectionEnd:t}=this.#e;this.model.selectionProp.set({selectionStart:e,selectionEnd:t})}async onBlur(){}setAlgIssueClassForPuzzle(e){this.#a.setValue(e)}#u(e){return e.endsWith(`
`)?`${e} `:e}#d=null;highlightLeaf(e){if(this.#s===`alg`){if(e===null){this.#n.textContent=``,this.#r.textContent=``,this.#i.textContent=this.#u(this.#e.value);return}e!==this.#d&&(this.#d=e,this.#n.textContent=this.#e.value.slice(0,e.startCharIndex),this.#r.textContent=this.#e.value.slice(e.startCharIndex,e.endCharIndex),this.#i.textContent=this.#u(this.#e.value.slice(e.endCharIndex)),this.#r.hidden=!1)}}get twistyPlayer(){return this.#o}set twistyPlayer(e){if(this.#o){console.warn(`twisty-player reassignment/clearing is not supported`);return}this.#o=e,e&&((async()=>{this.algString=this.#c?(await this.#c.get()).alg.toString():``})(),this.#s===`alg`&&(this.#o?.experimentalModel.puzzleAlg.addFreshListener(e=>{if(e.issues.errors.length===0){this.setAlgIssueClassForPuzzle(e.issues.warnings.length===0?`none`:`warning`);let t=e.alg,n=f.fromString(this.algString);t.isIdentical(n)||(this.algString=t.toString(),this.onInput())}else this.setAlgIssueClassForPuzzle(`error`)}),this.model.leafToHighlight.addFreshListener(async t=>{if(t===null)return;let[n,r]=await Promise.all([await e.experimentalModel.indexer.get(),await e.experimentalModel.timestampRequest.get()]);if(r===`auto`&&!this.#l)return;let i=n.indexToMoveStartTimestamp(t.leafInfo.idx),a=n.moveDuration(t.leafInfo.idx),o;switch(t.where){case`before`:o=i;break;case`start`:case`inside`:o=i+a/4;break;case`end`:case`after`:o=i+a;break;default:throw console.log(`invalid where`),Error(`Invalid where!`)}this.debugNeverRequestTimestamp||e.experimentalModel.timestampRequest.set(o)}),e.experimentalModel.currentLeavesSimplified.addFreshListener(async t=>{let n=(await e.experimentalModel.indexer.get()).getAnimLeaf(t.patternIndex);this.highlightLeaf(n)})))}attributeChangedCallback(e,t,n){switch(e){case X:{let e=document.getElementById(n);if(!e){console.warn(`${X}= elem does not exist`);return}if(!(e instanceof q)){console.warn(`${X}=is not a twisty-player`);return}this.twistyPlayer=e;return}case xr:this.placeholder=n;return;case Sr:if(this.#o)throw console.log(`cannot set prop`),Error(`cannot set prop after twisty player`);this.#s=n;return}}static get observedAttributes(){return[X,xr,Sr]}};w.define(`twisty-alg-editor`,Cr);var Z=new h;Z.replaceSync(`
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
`);var wr=new h;wr.replaceSync(`
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
  color-scheme: dark;
}

.wrapper.dark-mode .heading:not(.title) {
  background: #1d1d1d;
}

.heading.title {
  background: none;
}
`);function Tr(e=``,t=location.href){let n={alg:`alg`,"setup-alg":`experimental-setup-alg`,"setup-anchor":`experimental-setup-anchor`,puzzle:`puzzle`,stickering:`experimental-stickering`,"puzzle-description":`experimental-puzzle-description`,title:`experimental-title`,"video-url":`experimental-video-url`,competition:`experimental-competition-id`},r=new URL(t).searchParams,i={};for(let[t,a]of Object.entries(n)){let n=r.get(e+t);if(n!==null){let e=K[a];i[e]=n}}return i}var Q=`outer block moves (e.g. R, Rw, or 4r)`,$=`inner block moves (e.g. M or 2-5r)`,Er={OBTM:`HTM = OBTM ("Outer Block Turn Metric"):
\u2022 ${$} count as 2 turns
\u2022 ${Q} count as 1 turn
\u2022 rotations (e.g. x) count as 0 turns`,OBQTM:`QTM = OBQTM ("Outer Block Quantum Turn Metric"):
\u2022 ${$} count as 2 turns per quantum (e.g. M2 counts as 4)
\u2022 ${Q} count as 1 turn per quantum (e.g. R2 counts as 2)
\u2022 rotations (e.g. x) count as 0 turns`,RBTM:`STM = RBTM ("Range Block Turn Metric"):
\u2022 ${$} count as 1 turn
\u2022 ${Q} count as 1 turn
\u2022 rotations (e.g. x) count as 0 turns`,RBQTM:`SQTM = RBQTM ("Range Block Quantum Turn Metric"):
\u2022 ${$} count as 1 turn per quantum (e.g. M2 counts as 2)
\u2022 ${Q} count as 1 turn per quantum (e.g. R2 counts as 2)
\u2022 rotations (e.g. x) count as 0 turns`,ETM:`ETM ("Execution Turn Metric"):
• all moves (including rotations) count as 1 turn`},Dr={OBTM:`OB`,OBQTM:`OBQ`,RBTM:`RB`,RBQTM:`RBQ`,ETM:`E`},Or=class extends S{constructor(e){super({mode:`open`}),this.options=e}twistyPlayer=null;a=null;#e(){if(this.contentWrapper.textContent=``,this.a){let e=this.contentWrapper.appendChild(document.createElement(`span`));e.textContent=`❗️`,e.title=`Could not show a player for link`,this.addElement(this.a)}this.removeCSS(Z);let e=this.shadow.adoptedStyleSheets.indexOf(Z);e!==void 0&&this.shadow.adoptedStyleSheets.splice(e,e+1),this.#t?.remove()}#t;#n;#r;#i;async connectedCallback(){if(this.#r=this.addElement(document.createElement(`div`)),this.#r.classList.add(`responsive-wrapper`),this.options?.colorScheme===`dark`&&this.contentWrapper.classList.add(`dark-mode`),this.addCSS(Z),this.options?.cdnForumTweaks&&this.addCSS(wr),this.a=this.querySelector(`a`),!this.a)return;let t=Tr(``,this.a.href),n=this.a?.href,{hostname:r,pathname:i}=new URL(n);if(r!==`alpha.twizzle.net`){this.#e();return}if([`/edit/`,`/explore/`].includes(i)){let n=i===`/explore/`;if(t.puzzle&&!(t.puzzle in ce)){let n=(await e(async()=>{let{getPuzzleDescriptionString:e}=await import(`./puzzle-geometry-5-u4PKMG.js`);return{getPuzzleDescriptionString:e}},__vite__mapDeps([0,1]))).getPuzzleDescriptionString(t.puzzle);delete t.puzzle,t.experimentalPuzzleDescription=n}if(this.twistyPlayer=this.#r.appendChild(new q({background:this.options?.cdnForumTweaks?`checkered-transparent`:`checkered`,colorScheme:this.options?.colorScheme===`dark`?`dark`:`light`,...t,viewerLink:n?`experimental-twizzle-explorer`:`auto`})),this.twistyPlayer.fullscreenElement=this.contentWrapper,t.experimentalTitle&&(this.twistyPlayer.experimentalTitle=t.experimentalTitle),this.#n=this.#r.appendChild(document.createElement(`div`)),this.#n.classList.add(`scrollable-region`),t.experimentalTitle&&this.#a(t.experimentalTitle).classList.add(`title`),t.experimentalSetupAlg){this.#a(`Setup`,async()=>(await this.twistyPlayer?.experimentalModel.setupAlg.get())?.alg.toString()??null);let e=this.#n.appendChild(document.createElement(`div`));e.classList.add(`setup-alg`),e.textContent=new f(t.experimentalSetupAlg).toString()}this.#i=this.#a(`Moves`,async()=>(await this.twistyPlayer?.experimentalModel.alg.get())?.alg.toString()??null).appendChild(kr(this.twistyPlayer.experimentalModel)),this.#i.classList.add(`move-count`),this.#n.appendChild(new or({twistyPlayer:this.twistyPlayer})).part.add(`twisty-alg-viewer`)}else this.#e()}#a(e,t){let n=this.#n.appendChild(document.createElement(`div`));n.classList.add(`heading`);let r=n.appendChild(document.createElement(`span`));if(r.textContent=e,t){r.textContent+=` `;let e=r.appendChild(document.createElement(`a`));e.textContent=`📋`,e.href=`#`,e.title=`Copy to clipboard`;async function n(t){e.textContent=t,await new Promise(e=>setTimeout(e,2e3)),e.textContent===t&&(e.textContent=`📋`)}e.addEventListener(`click`,async r=>{r.preventDefault(),e.textContent=`📋…`;let i=await t();if(i)try{await navigator.clipboard.writeText(i),n(`📋✅`)}catch(e){throw n(`📋❌`),e}else n(`📋❌`)})}return n}};w.define(`twizzle-link`,Or);function kr(e,t=document.createElement(`span`)){async function n(){let[n,r]=await Promise.all([e.puzzleAlg.get(),e.puzzleLoader.get()]);if(n.issues.errors.length!==0){t.textContent=``;return}let i=!0;function a(e){i?i=!1:t.append(`)(`);let a=t.appendChild(document.createElement(`span`)),o=Oe(r,e,n.alg);a.append(`${Dr[e]}: `);let s=a.appendChild(document.createElement(`span`));s.textContent=o.toString(),s.classList.add(`move-number`),a.setAttribute(`data-before`,Er[e]??``),a.setAttribute(`title`,Er[e]??``)}t.textContent=`(`,r.id===`3x3x3`?(a(`OBTM`),a(`OBQTM`),a(`RBTM`)):r.pg&&(a(`RBTM`),a(`RBQTM`)),a(`ETM`),t.append(`)`)}return e.puzzleAlg.addFreshListener(n),e.puzzleID.addFreshListener(n),t}export{g as EXPERIMENTAL_PROP_NO_VALUE,Ve as ExperimentalSVGAnimator,Dt as SimpleAlgIndexer,W as TreeAlgIndexer,Cr as TwistyAlgEditor,or as TwistyAlgViewer,q as TwistyPlayer,Or as TwizzleLink,on as backViewLayouts,fe as setTwistyDebug};