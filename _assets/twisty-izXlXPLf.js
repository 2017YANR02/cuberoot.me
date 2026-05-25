import{t as e}from"./preload-helper-pMktvWfG.js";import{_ as t,a as n,c as r,d as i,f as a,g as o,h as s,i as c,l,m as u,n as d,o as f,p,s as m,t as h,v as g,y as _}from"./chunk-O6HEZXGY-P6HAzZyM.js";import{c as ee,d as te,f as ne,o as re,r as ie}from"./chunk-FLK6AZKB-w3d0brl3.js";import{n as ae,r as oe,t as se}from"./chunk-ZU7PSGX4-Ut7ayJ0W.js";import{a as v,b as ce,c as y,d as le,f as b,g as x,h as S,i as ue,l as de,m as C,n as w,o as T,p as E,r as fe,s as D,t as pe,v as me,y as he}from"./chunk-DQGYYYHZ-CPrD2cDO.js";function O(e){switch(Math.abs(e)){case 0:return 0;case 1:return 1e3;case 2:return 1500;default:return 2e3}}var ge=class extends a{constructor(e=O){super(),this.durationForAmount=e}traverseAlg(e){let t=0;for(let n of e.childAlgNodes())t+=this.traverseAlgNode(n);return t}traverseGrouping(e){return e.amount*this.traverseAlg(e.alg)}traverseMove(e){return this.durationForAmount(e.amount)}traverseCommutator(e){return 2*(this.traverseAlg(e.A)+this.traverseAlg(e.B))}traverseConjugate(e){return 2*this.traverseAlg(e.A)+this.traverseAlg(e.B)}traversePause(e){return this.durationForAmount(1)}traverseNewline(e){return this.durationForAmount(1)}traverseLineComment(e){return this.durationForAmount(0)}},_e=class{constructor(e,t){this.kpuzzle=e,this.moves=new h(t.experimentalExpand())}moves;durationFn=new ge(O);getAnimLeaf(e){return Array.from(this.moves.childAlgNodes())[e]}indexToMoveStartTimestamp(e){let t=new h(Array.from(this.moves.childAlgNodes()).slice(0,e));return this.durationFn.traverseAlg(t)}timestampToIndex(e){let t=0,n;for(n=0;n<this.numAnimatedLeaves();n++)if(t+=this.durationFn.traverseMove(this.getAnimLeaf(n)),t>=e)return n;return n}patternAtIndex(e){return this.kpuzzle.defaultPattern().applyTransformation(this.transformationAtIndex(e))}transformationAtIndex(e){let t=this.kpuzzle.identityTransformation();for(let n of Array.from(this.moves.childAlgNodes()).slice(0,e))t=t.applyMove(n);return t}algDuration(){return this.durationFn.traverseAlg(this.moves)}numAnimatedLeaves(){return se(this.moves)}moveDuration(e){return this.durationFn.traverseMove(this.getAnimLeaf(e))}},k=class{constructor(e,t,n,r,i=[]){this.moveCount=e,this.duration=t,this.forward=n,this.backward=r,this.children=i}},ve=class extends a{constructor(e){super(),this.kpuzzle=e,this.identity=e.identityTransformation(),this.dummyLeaf=new k(0,0,this.identity,this.identity,[])}identity;dummyLeaf;durationFn=new ge(O);cache={};traverseAlg(e){let t=0,n=0,r=this.identity,i=[];for(let a of e.childAlgNodes()){let e=this.traverseAlgNode(a);t+=e.moveCount,n+=e.duration,r=r===this.identity?e.forward:r.applyTransformation(e.forward),i.push(e)}return new k(t,n,r,r.invert(),i)}traverseGrouping(e){let t=this.traverseAlg(e.alg);return this.mult(t,e.amount,[t])}traverseMove(e){let t=e.toString(),n=this.cache[t];if(n)return n;let r=this.kpuzzle.moveToTransformation(e);return n=new k(1,this.durationFn.traverseAlgNode(e),r,r.invert()),this.cache[t]=n,n}traverseCommutator(e){let t=this.traverseAlg(e.A),n=this.traverseAlg(e.B),r=t.forward.applyTransformation(n.forward),i=t.backward.applyTransformation(n.backward),a=r.applyTransformation(i),o=new k(2*(t.moveCount+n.moveCount),2*(t.duration+n.duration),a,a.invert(),[t,n]);return this.mult(o,1,[o,t,n])}traverseConjugate(e){let t=this.traverseAlg(e.A),n=this.traverseAlg(e.B),r=t.forward.applyTransformation(n.forward).applyTransformation(t.backward),i=new k(2*t.moveCount+n.moveCount,2*t.duration+n.duration,r,r.invert(),[t,n]);return this.mult(i,1,[i,t,n])}traversePause(e){return e.experimentalNISSGrouping?this.dummyLeaf:new k(1,this.durationFn.traverseAlgNode(e),this.identity,this.identity)}traverseNewline(e){return this.dummyLeaf}traverseLineComment(e){return this.dummyLeaf}mult(e,t,n){let r=Math.abs(t),i=e.forward.selfMultiply(t);return new k(e.moveCount*r,e.duration*r,i,i.invert(),n)}},A=class{constructor(e,t){this.apd=e,this.back=t}},ye=class extends i{constructor(e,t,n){super(),this.kpuzzle=e,this.algOrAlgNode=t,this.apd=n,this.i=-1,this.dur=-1,this.goalIndex=-1,this.goalDuration=-1,this.move=void 0,this.back=!1,this.moveDuration=0,this.st=this.kpuzzle.identityTransformation(),this.root=new A(this.apd,!1)}move;moveDuration;back;st;root;i;dur;goalIndex;goalDuration;moveByIndex(e){return this.i>=0&&this.i===e?this.move!==void 0:this.dosearch(e,1/0)}moveByDuration(e){return this.dur>=0&&this.dur<e&&this.dur+this.moveDuration>=e?this.move!==void 0:this.dosearch(1/0,e)}dosearch(e,t){return this.goalIndex=e,this.goalDuration=t,this.i=0,this.dur=0,this.move=void 0,this.moveDuration=0,this.back=!1,this.st=this.kpuzzle.identityTransformation(),this.algOrAlgNode.is(h)?this.traverseAlg(this.algOrAlgNode,this.root):this.traverseAlgNode(this.algOrAlgNode,this.root)}traverseAlg(e,t){if(!this.firstcheck(t))return!1;let n=t.back?e.experimentalNumChildAlgNodes()-1:0;for(let r of u(e.childAlgNodes(),t.back?-1:1)){if(this.traverseAlgNode(r,new A(t.apd.children[n],t.back)))return!0;n+=t.back?-1:1}return!1}traverseGrouping(e,t){if(!this.firstcheck(t))return!1;let n=this.domult(t,e.amount);return this.traverseAlg(e.alg,new A(t.apd.children[0],n))}traverseMove(e,t){return this.firstcheck(t)?(this.move=e,this.moveDuration=t.apd.duration,this.back=t.back,!0):!1}traverseCommutator(e,t){if(!this.firstcheck(t))return!1;let n=this.domult(t,1);return n?this.traverseAlg(e.B,new A(t.apd.children[2],!n))||this.traverseAlg(e.A,new A(t.apd.children[1],!n))||this.traverseAlg(e.B,new A(t.apd.children[2],n))||this.traverseAlg(e.A,new A(t.apd.children[1],n)):this.traverseAlg(e.A,new A(t.apd.children[1],n))||this.traverseAlg(e.B,new A(t.apd.children[2],n))||this.traverseAlg(e.A,new A(t.apd.children[1],!n))||this.traverseAlg(e.B,new A(t.apd.children[2],!n))}traverseConjugate(e,t){if(!this.firstcheck(t))return!1;let n=this.domult(t,1);return n?this.traverseAlg(e.A,new A(t.apd.children[1],!n))||this.traverseAlg(e.B,new A(t.apd.children[2],n))||this.traverseAlg(e.A,new A(t.apd.children[1],n)):this.traverseAlg(e.A,new A(t.apd.children[1],n))||this.traverseAlg(e.B,new A(t.apd.children[2],n))||this.traverseAlg(e.A,new A(t.apd.children[1],!n))}traversePause(e,t){return this.firstcheck(t)?(this.move=e,this.moveDuration=t.apd.duration,this.back=t.back,!0):!1}traverseNewline(e,t){return!1}traverseLineComment(e,t){return!1}firstcheck(e){return e.apd.moveCount+this.i<=this.goalIndex&&e.apd.duration+this.dur<this.goalDuration?this.keepgoing(e):!0}domult(e,t){let n=e.back;if(t===0)return n;t<0&&(n=!n,t=-t);let r=e.apd.children[0],i=Math.min(Math.floor((this.goalIndex-this.i)/r.moveCount),Math.ceil((this.goalDuration-this.dur)/r.duration-1));return i>0&&this.keepgoing(new A(r,n),i),n}keepgoing(e,t=1){return this.i+=t*e.apd.moveCount,this.dur+=t*e.apd.duration,t===1?e.back?this.st=this.st.applyTransformation(e.apd.backward):this.st=this.st.applyTransformation(e.apd.forward):e.back?this.st=this.st.applyTransformation(e.apd.backward.selfMultiply(t)):this.st=this.st.applyTransformation(e.apd.forward.selfMultiply(t)),!1}},be=16;function xe(e,t){let r=new d,i=new d;for(let a of e.childAlgNodes())i.push(a),i.experimentalNumAlgNodes()>=t&&(r.push(new n(i.toAlg())),i.reset());return r.push(new n(i.toAlg())),r.toAlg()}var Se=t(class extends a{traverseAlg(e){let t=e.experimentalNumChildAlgNodes();return t<be?e:xe(e,Math.ceil(Math.sqrt(t)))}traverseGrouping(e){return new n(this.traverseAlg(e.alg),e.amount)}traverseMove(e){return e}traverseCommutator(e){return new c(this.traverseAlg(e.A),this.traverseAlg(e.B))}traverseConjugate(e){return new c(this.traverseAlg(e.A),this.traverseAlg(e.B))}traversePause(e){return e}traverseNewline(e){return e}traverseLineComment(e){return e}}),Ce=class{constructor(e,t){this.kpuzzle=e;let n=new ve(this.kpuzzle),r=Se(t);this.decoration=n.traverseAlg(r),this.walker=new ye(this.kpuzzle,r,this.decoration)}decoration;walker;getAnimLeaf(e){if(this.walker.moveByIndex(e)){if(!this.walker.move)throw Error("`this.walker.mv` missing");let e=this.walker.move;return this.walker.back?e.invert():e}return null}indexToMoveStartTimestamp(e){if(this.walker.moveByIndex(e)||this.walker.i===e)return this.walker.dur;throw Error(`Out of algorithm: index ${e}`)}indexToMovesInProgress(e){if(this.walker.moveByIndex(e)||this.walker.i===e)return this.walker.dur;throw Error(`Out of algorithm: index ${e}`)}patternAtIndex(e,t){return this.walker.moveByIndex(e),(t??this.kpuzzle.defaultPattern()).applyTransformation(this.walker.st)}transformationAtIndex(e){return this.walker.moveByIndex(e),this.walker.st}numAnimatedLeaves(){return this.decoration.moveCount}timestampToIndex(e){return this.walker.moveByDuration(e),this.walker.i}algDuration(){return this.decoration.duration}moveDuration(e){return this.walker.moveByIndex(e),this.walker.moveDuration}},we={none:!0,"side-by-side":!0,"top-right":!0},Te=class extends y{getDefaultValue(){return`auto`}},j=`http://www.w3.org/2000/svg`,Ee=`data-copy-id`,De=0;function Oe(){return De+=1,`svg${De.toString()}`}var ke={dim:{white:`#dddddd`,orange:`#884400`,limegreen:`#008800`,red:`#660000`,"rgb(34, 102, 255)":`#000088`,yellow:`#888800`,"rgb(102, 0, 153)":`rgb(50, 0, 76)`,purple:`#3f003f`},oriented:`#44ddcc`,ignored:`#555555`,invisible:`#00000000`},Ae=class{constructor(e,t,n,r=!1){if(this.kpuzzle=e,this.showUnknownOrientations=r,!t)throw Error(`No SVG definition for puzzle type: ${e.name()}`);this.svgID=Oe(),this.wrapperElement=document.createElement(`div`),this.wrapperElement.classList.add(`svg-wrapper`),this.wrapperElement.innerHTML=t;let i=this.wrapperElement.querySelector(`svg`);if(!i)throw Error(`Could not get SVG element`);if(this.svgElement=i,j!==i.namespaceURI)throw Error(`Unexpected XML namespace`);i.style.maxWidth=`100%`,i.style.maxHeight=`100%`,this.gradientDefs=document.createElementNS(j,`defs`),i.insertBefore(this.gradientDefs,i.firstChild);for(let t of e.definition.orbits)for(let e=0;e<t.numPieces;e++)for(let r=0;r<t.numOrientations;r++){let i=this.elementID(t.orbitName,e,r),a=this.elementByID(i),o=a?.style.fill;n?(()=>{let i=n.orbits;if(!i)return;let a=i[t.orbitName];if(!a)return;let s=a.pieces[e];if(!s)return;let c=s.facelets[r];if(!c)return;let l=ke[typeof c==`string`?c:c?.mask];typeof l==`string`?o=l:l&&(o=l[o])})():o=a?.style.fill,this.originalColors[i]=o,this.gradients[i]=this.newGradient(i,o),this.gradientDefs.appendChild(this.gradients[i]),a?.setAttribute(`style`,`fill: url(#grad-${this.svgID}-${i})`)}for(let e of Array.from(i.querySelectorAll(`[${Ee}]`))){let t=e.getAttribute(Ee);e.setAttribute(`style`,`fill: url(#grad-${this.svgID}-${t})`)}this.showUnknownOrientations&&this.drawPattern(this.kpuzzle.defaultPattern())}wrapperElement;svgElement;gradientDefs;originalColors={};gradients={};svgID;drawPattern(e,t,n){this.draw(e,t,n)}draw(e,t,n){let r=t?.experimentalToTransformation();if(!e)throw Error(`Distinguishable pieces are not handled for SVG yet!`);for(let t of e.kpuzzle.definition.orbits){let i=e.patternData[t.orbitName],a=r?r.transformationData[t.orbitName]:null;for(let e=0;e<t.numPieces;e++)for(let r=0;r<t.numOrientations;r++){let o=this.elementID(t.orbitName,e,r),s=this.elementID(t.orbitName,i.pieces[e],(t.numOrientations-i.orientation[e]+r)%t.numOrientations),c=!1;if(a){let i=this.elementID(t.orbitName,a.permutation[e],(t.numOrientations-a.orientationDelta[e]+r)%t.numOrientations);s===i&&(c=!0),n||=0;let l=100*(1-n*n*(2-n*n));this.gradients[o].children[0].setAttribute(`stop-color`,this.originalColors[s]),this.gradients[o].children[0].setAttribute(`offset`,`${Math.max(l-5,0)}%`),this.gradients[o].children[1].setAttribute(`offset`,`${Math.max(l-5,0)}%`),this.gradients[o].children[2].setAttribute(`offset`,`${l}%`),this.gradients[o].children[3].setAttribute(`offset`,`${l}%`),this.gradients[o].children[3].setAttribute(`stop-color`,this.originalColors[i])}else c=!0;c&&(this.showUnknownOrientations&&i.orientationMod?.[e]===1?(this.gradients[o].children[0].setAttribute(`stop-color`,`#000`),this.gradients[o].children[0].setAttribute(`offset`,`5%`),this.gradients[o].children[1].setAttribute(`offset`,`5%`),this.gradients[o].children[2].setAttribute(`offset`,`20%`),this.gradients[o].children[3].setAttribute(`offset`,`20%`),this.gradients[o].children[3].setAttribute(`stop-color`,this.originalColors[s])):(this.gradients[o].children[0].setAttribute(`stop-color`,this.originalColors[s]),this.gradients[o].children[0].setAttribute(`offset`,`100%`),this.gradients[o].children[1].setAttribute(`offset`,`100%`),this.gradients[o].children[2].setAttribute(`offset`,`100%`),this.gradients[o].children[3].setAttribute(`offset`,`100%`)))}}}newGradient(e,t){let n=document.createElementNS(j,`radialGradient`);n.setAttribute(`id`,`grad-${this.svgID}-${e}`),n.setAttribute(`r`,`70.7107%`);let r=[{offset:0,color:t},{offset:0,color:`black`},{offset:0,color:`black`},{offset:0,color:t}];for(let e of r){let t=document.createElementNS(j,`stop`);t.setAttribute(`offset`,`${e.offset}%`),t.setAttribute(`stop-color`,e.color),t.setAttribute(`stop-opacity`,`1`),n.appendChild(t)}return n}elementID(e,t,n){return`${e}-l${t}-o${n}`}elementByID(e){return this.wrapperElement.querySelector(`#${e}`)}},M=class{constructor(e,t,n){this.elem=e,this.prefix=t,this.validSuffixes=n}#e=null;clearValue(){this.#e&&this.elem.contentWrapper.classList.remove(this.#e),this.#e=null}setValue(e){if(!this.validSuffixes.includes(e))throw Error(`Invalid suffix: ${e}`);let t=`${this.prefix}${e}`,n=this.#e!==t;return n&&(this.clearValue(),this.elem.contentWrapper.classList.add(t),this.#e=t),n}};function N(e,t){if(e===t)return!0;if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0}function je(e,t,n){if(e===t)return!0;if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(!n(e[r],t[r]))return!1;return!0}function P(e,t,n){return g(e,n-t,t)}function Me(e){return e}var Ne=class{constructor(e){this.model=e,e.tempoScale.addFreshListener(e=>{this.tempoScale=e})}catchingUp=!1;pendingFrame=!1;tempoScale=1;scheduler=new D(this.animFrame.bind(this));start(){this.catchingUp||(this.lastTimestamp=performance.now()),this.catchingUp=!0,this.pendingFrame=!0,this.scheduler.requestAnimFrame()}stop(){this.catchingUp=!1,this.scheduler.cancelAnimFrame()}catchUpMs=500;lastTimestamp=0;animFrame(e){this.scheduler.requestAnimFrame();let t=this.tempoScale*(e-this.lastTimestamp)/this.catchUpMs;this.lastTimestamp=e,this.model.catchUpMove.set((async()=>{let e=await this.model.catchUpMove.get();if(e.move===null)return e;let n=e.amount+t;return n>=1?(this.pendingFrame=!0,this.stop(),this.model.timestampRequest.set(`end`),{move:null,amount:0}):(this.pendingFrame=!1,{move:e.move,amount:n})})())}},Pe=class{constructor(e,t){this.delegate=t,this.model=e,this.lastTimestampPromise=this.#e(),this.model.playingInfo.addFreshListener(this.onPlayingProp.bind(this)),this.catchUpHelper=new Ne(this.model),this.model.catchUpMove.addFreshListener(this.onCatchUpMoveProp.bind(this))}playing=!1;direction=1;catchUpHelper;model;lastDatestamp=0;lastTimestampPromise;scheduler=new D(this.animFrame.bind(this));async onPlayingProp(e){e.playing!==this.playing&&(e.playing?this.play(e):this.pause())}async onCatchUpMoveProp(e){let t=e.move!==null;t!==this.catchUpHelper.catchingUp&&(t?this.catchUpHelper.start():this.catchUpHelper.stop()),this.scheduler.requestAnimFrame()}async#e(){return(await this.model.detailedTimelineInfo.get()).timestamp}jumpToStart(e){this.model.timestampRequest.set(`start`),this.pause(),e?.flash&&this.delegate.flash()}jumpToEnd(e){this.model.timestampRequest.set(`end`),this.pause(),e?.flash&&this.delegate.flash()}playPause(){this.playing?this.pause():this.play()}play(e){(async()=>{let t=e?.direction??1,n=await this.model.coarseTimelineInfo.get();(e?.autoSkipToOtherEndIfStartingAtBoundary??!0)&&(t===1&&n.atEnd&&(this.model.timestampRequest.set(`start`),this.delegate.flash()),t===-1&&n.atStart&&(this.model.timestampRequest.set(`end`),this.delegate.flash())),this.model.playingInfo.set({playing:!0,direction:t,untilBoundary:e?.untilBoundary??`entire-timeline`,loop:e?.loop??!1}),this.playing=!0,this.lastDatestamp=performance.now(),this.lastTimestampPromise=this.#e(),this.scheduler.requestAnimFrame()})()}pause(){this.playing=!1,this.scheduler.cancelAnimFrame(),this.model.playingInfo.set({playing:!1,untilBoundary:`entire-timeline`})}#t=new de;async animFrame(e){this.playing&&this.scheduler.requestAnimFrame();let t=this.lastDatestamp,[n,r,i,a,o]=await this.#t.queue(Promise.all([this.model.playingInfo.get(),this.lastTimestampPromise,this.model.timeRange.get(),this.model.tempoScale.get(),this.model.currentMoveInfo.get()]));if(!n.playing){this.playing=!1;return}let s=o.earliestEnd;(o.currentMoves.length===0||n.untilBoundary===`entire-timeline`)&&(s=i.end);let c=o.latestStart;(o.currentMoves.length===0||n.untilBoundary===`entire-timeline`)&&(c=i.start);let l=(e-t)*Me(this.direction)*a;l=Math.max(l,1),l*=n.direction;let u=r+l,d=null;u>=s?n.loop?u=P(u,i.start,i.end):(u===i.end?d=`end`:u=s,this.playing=!1,this.model.playingInfo.set({playing:!1})):u<=c&&(n.loop?u=P(u,i.start,i.end):(u===i.start?d=`start`:u=c,this.playing=!1,this.model.playingInfo.set({playing:!1}))),this.lastDatestamp=e,this.lastTimestampPromise=Promise.resolve(u),this.model.timestampRequest.set(d??u)}},Fe=class{constructor(e,t){this.model=e,this.animationController=new Pe(e,t)}animationController;jumpToStart(e){this.animationController.jumpToStart(e)}jumpToEnd(e){this.animationController.jumpToEnd(e)}togglePlay(e){e===void 0&&this.animationController.playPause(),e?this.animationController.play():this.animationController.pause()}async visitTwizzleLink(){let e=document.createElement(`a`);e.href=await this.model.twizzleLink(),e.target=`_blank`,e.click()}},Ie={"bottom-row":!0,none:!0},Le=class extends y{getDefaultValue(){return`auto`}},F=new S;F.replaceSync(`
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
`);var Re=new S;Re.replaceSync(`
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
`);var ze=class extends v{constructor(e,t,n,r,i){super(),this.model=e,this.kpuzzle=t,this.svgSource=n,this.options=r,this.puzzleLoader=i,this.addCSS(Re),this.resetSVG(),this.#t.addListener(this.model.puzzleID,e=>{i?.id!==e&&this.disconnect()}),this.#t.addListener(this.model.twistySceneModel.hintFacelet,e=>{this.setHintFacelet(e)}),this.#t.addListener(this.model.legacyPosition,this.onPositionChange.bind(this)),this.options?.experimentalStickeringMask&&this.experimentalSetStickeringMask(this.options.experimentalStickeringMask)}svgWrapper;scheduler=new D(this.render.bind(this));#e=null;#t=new w;disconnect(){this.#t.disconnect()}onPositionChange(e){try{if(e.movesInProgress.length>0){let t=e.movesInProgress[0].move,n=t;e.movesInProgress[0].direction===-1&&(n=t.invert());let r=e.pattern.applyMove(n);this.svgWrapper?.draw(e.pattern,r,e.movesInProgress[0].fraction)}else this.svgWrapper?.draw(e.pattern),this.#e=e}catch(e){console.warn(`Bad position (this doesn't necessarily mean something is wrong). Pre-emptively disconnecting:`,this.puzzleLoader?.id,e),this.disconnect()}}scheduleRender(){this.scheduler.requestAnimFrame()}experimentalSetStickeringMask(e){this.resetSVG(e)}resetSVG(e){this.svgWrapper&&this.removeElement(this.svgWrapper.wrapperElement),this.kpuzzle&&(this.svgWrapper=new Ae(this.kpuzzle,this.svgSource,e),this.addElement(this.svgWrapper.wrapperElement),this.#e&&this.onPositionChange(this.#e))}hintFaceletsClassListManager=new M(this,`hint-facelets-`,Object.keys(me));setHintFacelet(e){this.hintFaceletsClassListManager.setValue(e===`auto`?`floating`:e)}render(){}};x.define(`twisty-2d-puzzle`,ze);var Be=class{constructor(e,t,n,r){this.model=e,this.schedulable=t,this.puzzleLoader=n,this.effectiveVisualization=r,this.twisty2DPuzzle(),this.#e.addListener(this.model.twistySceneModel.stickeringMask,async e=>{(await this.twisty2DPuzzle()).experimentalSetStickeringMask(e)})}#e=new w;disconnect(){this.#e.disconnect()}scheduleRender(){}#t=null;async twisty2DPuzzle(){return this.#t??=(async()=>{let e=this.effectiveVisualization===`experimental-2D-LL-face`?this.puzzleLoader.llFaceSVG():this.effectiveVisualization===`experimental-2D-LL`?this.puzzleLoader.llSVG():this.puzzleLoader.svg();return new ze(this.model,await this.puzzleLoader.kpuzzle(),await e,{},this.puzzleLoader)})()}},Ve=class extends v{constructor(e,t){super(),this.model=e,this.effectiveVisualization=t}#e=new w;disconnect(){this.#e.disconnect()}async connectedCallback(){this.addCSS(F),this.model&&this.#e.addListener(this.model.twistyPlayerModel.puzzleLoader,this.onPuzzleLoader.bind(this))}#t;async scene(){return this.#t??=(async()=>new(await(C())).ThreeScene)()}scheduleRender(){this.#n?.scheduleRender()}#n;currentTwisty2DPuzzleWrapper(){return this.#n}async setCurrentTwisty2DPuzzleWrapper(e){let t=this.#n;this.#n=e,t?.disconnect();let n=e.twisty2DPuzzle();this.contentWrapper.textContent=``,this.addElement(await n)}async onPuzzleLoader(e){this.#n?.disconnect();let t=new Be(this.model.twistyPlayerModel,this,e,this.effectiveVisualization);this.setCurrentTwisty2DPuzzleWrapper(t)}};x.define(`twisty-2d-scene-wrapper`,Ve);var He=class{#e;reject;promise;constructor(){this.promise=new Promise((e,t)=>{this.#e=e,this.reject=t})}handleNewValue(e){this.#e(e)}},Ue=class extends EventTarget{constructor(e,t,n,r){super(),this.model=e,this.schedulable=t,this.puzzleLoader=n,this.visualizationStrategy=r,this.twisty3DPuzzle(),this.#e.addListener(this.model.puzzleLoader,e=>{this.puzzleLoader.id!==e.id&&this.disconnect()}),this.#e.addListener(this.model.legacyPosition,async e=>{try{(await this.twisty3DPuzzle()).onPositionChange(e),this.scheduleRender()}catch{this.disconnect()}}),this.#e.addListener(this.model.twistySceneModel.hintFacelet,async e=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({hintFacelets:e===`auto`?`floating`:e}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.foundationDisplay,async e=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({showFoundation:e!==`none`}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.stickeringMask,async e=>{(await this.twisty3DPuzzle()).setStickeringMask(e),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.faceletScale,async e=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({faceletScale:e}),this.scheduleRender()}),this.#e.addListener(this.model.twistySceneModel.hintFaceletsElevation,async e=>{(await this.twisty3DPuzzle()).experimentalUpdateOptions({hintFaceletsElevation:e}),this.scheduleRender()}),this.#e.addMultiListener3([this.model.twistySceneModel.stickeringMask,this.model.twistySceneModel.foundationStickerSprite,this.model.twistySceneModel.hintStickerSprite],async e=>{`experimentalUpdateTexture`in await this.twisty3DPuzzle()&&((await this.twisty3DPuzzle()).experimentalUpdateTexture(e[0].specialBehaviour===`picture`,e[1],e[2]),this.scheduleRender())})}#e=new w;disconnect(){this.#e.disconnect()}scheduleRender(){this.schedulable.scheduleRender(),this.dispatchEvent(new CustomEvent(`render-scheduled`))}#t=null;async twisty3DPuzzle(){return this.#t??=(async()=>{let e=C();if(this.puzzleLoader.id===`3x3x3`&&this.visualizationStrategy===`Cube3D`){let[t,n,r,i,a,o]=await Promise.all([this.model.twistySceneModel.foundationStickerSprite.get(),this.model.twistySceneModel.hintStickerSprite.get(),this.model.twistySceneModel.stickeringMask.get(),this.model.twistySceneModel.initialHintFaceletsAnimation.get(),this.model.twistySceneModel.faceletScale.get(),this.model.twistySceneModel.hintFaceletsElevation.get()]);return(await e).cube3DShim(()=>this.schedulable.scheduleRender(),{foundationSprite:t,hintSprite:n,experimentalStickeringMask:r,initialHintFaceletsAnimation:i,faceletScale:a,hintFaceletsElevation:o})}else{let[t,n,r,i]=await Promise.all([this.model.twistySceneModel.hintFacelet.get(),this.model.twistySceneModel.foundationStickerSprite.get(),this.model.twistySceneModel.hintStickerSprite.get(),this.model.twistySceneModel.faceletScale.get()]),a=(await e).pg3dShim(()=>this.schedulable.scheduleRender(),this.puzzleLoader,t===`auto`?`floating`:t,i,this.puzzleLoader.id===`kilominx`);return a.then(e=>e.experimentalUpdateTexture(!0,n??void 0,r??void 0)),a}})()}async raycastMove(e,t){let n=await this.twisty3DPuzzle();if(!(`experimentalGetControlTargets`in n)){console.info(`not PG3D! skipping raycast`);return}let r=n.experimentalGetControlTargets(),[i,a]=await Promise.all([e,this.model.twistySceneModel.movePressCancelOptions.get()]),o=i.intersectObjects(r);if(o.length>0){let e=n.getClosestMoveToAxis(o[0].point,t);e?this.model.experimentalAddMove(e.move,{cancel:a}):console.info(`Skipping move!`)}}},I=class extends v{constructor(e){super(),this.model=e}#e=new M(this,`back-view-`,[`auto`,`none`,`side-by-side`,`top-right`]);#t=new w;disconnect(){this.#t.disconnect()}async connectedCallback(){this.addCSS(F);let e=new le(this.model,this);this.addVantage(e),this.model&&(this.#t.addMultiListener([this.model.puzzleLoader,this.model.visualizationStrategy],this.onPuzzle.bind(this)),this.#t.addListener(this.model.backView,this.setBackView.bind(this))),this.scheduleRender()}#n=null;setBackView(e){let t=[`side-by-side`,`top-right`].includes(e),n=this.#n!==null;this.#e.setValue(e),t?n||(this.#n=new le(this.model,this,{backView:!0}),this.addVantage(this.#n),this.scheduleRender()):this.#n&&=(this.removeVantage(this.#n),null)}async onPress(e){let t=this.#a;if(!t){console.info(`no wrapper; skipping scene wrapper press!`);return}let n=(async()=>{let[t,{ThreeRaycaster:n,ThreeVector2:r}]=await Promise.all([e.detail.cameraPromise,(async()=>{let{ThreeRaycaster:e,ThreeVector2:t}=await C();return{ThreeRaycaster:e,ThreeVector2:t}})()]),i=new n,a=new r(e.detail.pressInfo.normalizedX,e.detail.pressInfo.normalizedY);return i.setFromCamera(a,t),i})();t.raycastMove(n,{invert:!e.detail.pressInfo.rightClick,depth:e.detail.pressInfo.keys.ctrlOrMetaKey?`rotation`:e.detail.pressInfo.keys.shiftKey?`secondSlice`:`none`})}#r;async scene(){return this.#r??=(async()=>new(await(C())).ThreeScene)()}#i=new Set;addVantage(e){e.addEventListener(`press`,this.onPress.bind(this)),this.#i.add(e),this.contentWrapper.appendChild(e)}removeVantage(e){this.#i.delete(e),e.remove(),e.disconnect(),this.#a?.disconnect()}experimentalVantages(){return this.#i.values()}scheduleRender(){for(let e of this.#i)e.scheduleRender()}#a=null;async setCurrentTwisty3DPuzzleWrapper(e,t){let n=this.#a;try{this.#a=t,n?.disconnect(),e.add(await t.twisty3DPuzzle())}finally{n&&e.remove(await n.twisty3DPuzzle())}this.#o.handleNewValue(t)}#o=new He;async experimentalTwisty3DPuzzleWrapper(){return this.#a||this.#o.promise}#s=new de;async onPuzzle(e){if(e[1]===`2D`)return;this.#a?.disconnect();let[t,n]=await this.#s.queue(Promise.all([this.scene(),new Ue(this.model,this,e[0],e[1])]));this.setCurrentTwisty3DPuzzleWrapper(t,n)}};x.define(`twisty-3d-scene-wrapper`,I);var L=typeof document>`u`?null:document,We=L?.fullscreenEnabled||!!L?.webkitFullscreenEnabled;function Ge(){return document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen()}function Ke(){return document.fullscreenElement?document.fullscreenElement:document.webkitFullscreenElement??null}function qe(e){return e.requestFullscreen?e.requestFullscreen():e.webkitRequestFullscreen()}var Je=[`skip-to-start`,`skip-to-end`,`step-forward`,`step-backward`,`pause`,`play`,`enter-fullscreen`,`exit-fullscreen`,`twizzle-tw`],Ye=class extends b{derive(e){return{fullscreen:{enabled:We,icon:document.fullscreenElement===null?`enter-fullscreen`:`exit-fullscreen`,title:`Enter fullscreen`},"jump-to-start":{enabled:!e.coarseTimelineInfo.atStart,icon:`skip-to-start`,title:`Restart`},"play-step-backwards":{enabled:!e.coarseTimelineInfo.atStart,icon:`step-backward`,title:`Step backward`},"play-pause":{enabled:!(e.coarseTimelineInfo.atStart&&e.coarseTimelineInfo.atEnd),icon:e.coarseTimelineInfo.playing?`pause`:`play`,title:e.coarseTimelineInfo.playing?`Pause`:`Play`},"play-step":{enabled:!e.coarseTimelineInfo.atEnd,icon:`step-forward`,title:`Step forward`},"jump-to-end":{enabled:!e.coarseTimelineInfo.atEnd,icon:`skip-to-end`,title:`Skip to End`},"twizzle-link":{enabled:!0,icon:`twizzle-tw`,title:`View at Twizzle`,hidden:e.viewerLink===`none`}}}},Xe=new S;Xe.replaceSync(`
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
`);var Ze=new S;Ze.replaceSync(`
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
`);var Qe={fullscreen:!0,"jump-to-start":!0,"play-step-backwards":!0,"play-pause":!0,"play-step":!0,"jump-to-end":!0,"twizzle-link":!0},$e=class extends v{constructor(e,t,n){super(),this.model=e,this.controller=t,this.defaultFullscreenElement=n}buttons=null;connectedCallback(){this.addCSS(Xe);let e={};for(let t in Qe){let n=new et;e[t]=n,n.htmlButton.addEventListener(`click`,()=>this.#e(t)),this.addElement(n)}this.buttons=e,this.model?.buttonAppearance.addFreshListener(this.update.bind(this)),this.model?.twistySceneModel.colorScheme.addFreshListener(this.updateColorScheme.bind(this))}#e(e){switch(e){case`fullscreen`:this.onFullscreenButton();break;case`jump-to-start`:this.controller?.jumpToStart({flash:!0});break;case`play-step-backwards`:this.controller?.animationController.play({direction:-1,untilBoundary:`move`});break;case`play-pause`:this.controller?.togglePlay();break;case`play-step`:this.controller?.animationController.play({direction:1,untilBoundary:`move`});break;case`jump-to-end`:this.controller?.jumpToEnd({flash:!0});break;case`twizzle-link`:this.controller?.visitTwizzleLink();break;default:throw Error(`Missing command`)}}async onFullscreenButton(){if(!this.defaultFullscreenElement)throw Error(`Attempted to go fullscreen without an element.`);if(Ke()===this.defaultFullscreenElement)Ge();else{this.buttons?.fullscreen.setIcon(`exit-fullscreen`),qe(await this.model?.twistySceneModel.fullscreenElement.get()??this.defaultFullscreenElement);let e=()=>{Ke()!==this.defaultFullscreenElement&&(this.buttons?.fullscreen.setIcon(`enter-fullscreen`),globalThis.removeEventListener(`fullscreenchange`,e))};globalThis.addEventListener(`fullscreenchange`,e)}}async update(e){for(let t in Qe){let n=this.buttons[t],r=e[t];n.htmlButton.disabled=!r.enabled,n.htmlButton.title=r.title,n.setIcon(r.icon),n.hidden=!!r.hidden}}updateColorScheme(e){for(let t of Object.values(this.buttons??{}))t.updateColorScheme(e)}};x.define(`twisty-buttons`,$e);var et=class extends v{htmlButton=document.createElement(`button`);updateColorScheme(e){this.contentWrapper.classList.toggle(`dark-mode`,e===`dark`)}connectedCallback(){this.addCSS(Ze),this.addElement(this.htmlButton)}#e=new M(this,`svg-`,Je);setIcon(e){this.#e.setValue(e)}};x.define(`twisty-button`,et);var tt=new S;tt.replaceSync(`
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
`);var nt=!1,R=!1;L?.addEventListener(`mousedown`,e=>{e.which&&(R=!0)},!0),L?.addEventListener(`mouseup`,e=>{e.which&&(R=!1)},!0);var z=0,B=0;L?.addEventListener(`mousedown`,()=>{B++},!1),L?.addEventListener(`mousemove`,rt,!1),L?.addEventListener(`mouseenter`,rt,!1);function rt(e){z=e.pageY}var it=0,at=0,V=!1,H=0,ot=class extends v{constructor(e,t){super(),this.model=e,this.controller=t}async onDetailedTimelineInfo(e){let t=await this.inputElem();t.min=e.timeRange.start.toString(),t.max=e.timeRange.end.toString(),t.disabled=t.min===t.max,t.value=e.timestamp.toString()}async connectedCallback(){this.addCSS(tt),this.addElement(await this.inputElem()),this.model?.twistySceneModel.colorScheme.addFreshListener(this.updateColorScheme.bind(this))}updateColorScheme(e){this.contentWrapper.classList.toggle(`dark-mode`,e===`dark`)}#e=null;async inputElem(){return this.#e??=(async()=>{let e=document.createElement(`input`);return e.type=`range`,e.disabled=!0,this.model?.detailedTimelineInfo.addFreshListener(this.onDetailedTimelineInfo.bind(this)),e.addEventListener(`input`,this.onInput.bind(this)),e.addEventListener(`keydown`,this.onKeypress.bind(this)),e})()}async onInput(e){if(V)return;let t=await this.inputElem();await this.slowDown(e,t);let n=parseInt(t.value,10);this.model?.playingInfo.set({playing:!1}),this.model?.timestampRequest.set(n)}onKeypress(e){switch(e.key){case`ArrowLeft`:case`ArrowRight`:this.controller?.animationController.play({direction:e.key===`ArrowLeft`?-1:1,untilBoundary:`move`}),e.preventDefault();break;case` `:this.controller?.togglePlay(),e.preventDefault();break}}async slowDown(e,t){if(nt&&R){let n=t.getBoundingClientRect(),r=n.top+n.height/2;console.log(r,e,z,R);let i=Math.abs(r-z),a=1;i>64&&(a=Math.max(2**(-(i-64)/64),1/32));let o=parseInt(t.value,10);if(console.log(`cl`,H,B,o),H===B){let e=(o-at)*a;console.log(`delta`,e,i),V=!0;let n=o;n=it+e*a+(o-it)*Math.min(1,(1/2)**(i*i/64)),t.value=n.toString(),console.log(a),V=!1,this.contentWrapper.style.opacity=a.toString()}else H=B;at=o}}};x.define(`twisty-scrubber`,ot);var st=null;async function ct(e,t){let[{ThreePerspectiveCamera:n,ThreeScene:r},i,a,o,s,c,l]=await Promise.all([(async()=>{let{ThreePerspectiveCamera:e,ThreeScene:t}=await C();return{ThreePerspectiveCamera:e,ThreeScene:t}})(),await e.puzzleLoader.get(),await e.visualizationStrategy.get(),await e.twistySceneModel.stickeringRequest.get(),await e.twistySceneModel.stickeringMaskRequest.get(),await e.legacyPosition.get(),await e.twistySceneModel.orbitCoordinates.get()]),u=t?.width??2048,d=t?.height??2048,f=u/d,p=st??=await(async()=>new n(20,f,.1,20))(),m=new r,h=new Ue(e,{scheduleRender:()=>{}},i,a);m.add(await h.twisty3DPuzzle()),await ce(p,l);let g=(await he(u,d,m,p)).toDataURL(),_=await lt(e);return{dataURL:g,download:async e=>{ut(g,e??_)}}}async function lt(e){let[t,n]=await Promise.all([e.puzzleID.get(),e.alg.get()]);return`[${t}]${n.alg.experimentalNumChildAlgNodes()===0?``:` ${n.alg.toString()}`}`}function ut(e,t,n=`png`){let r=document.createElement(`a`);r.href=e,r.download=`${t}.${n}`,r.click()}var dt=new S;dt.replaceSync(`
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
`);var ft=class extends y{getDefaultValue(){return null}},U=class extends E{getDefaultValue(){return null}derive(e){return typeof e==`string`?new URL(e,location.href):e}},W=class e{warnings;errors;constructor(e){this.warnings=Object.freeze(e?.warnings??[]),this.errors=Object.freeze(e?.errors??[]),Object.freeze(this)}add(t){return new e({warnings:this.warnings.concat(t?.warnings??[]),errors:this.errors.concat(t?.errors??[])})}log(){this.errors.length>0?console.error(`\u{1F6A8} ${this.errors[0]}`):this.warnings.length>0?console.warn(`\u26A0\uFE0F ${this.warnings[0]}`):console.info(`😎 No issues!`)}};function pt(e){try{let t=h.fromString(e),n=[];return t.toString()!==e&&n.push(`Alg is non-canonical!`),{alg:t,issues:new W({warnings:n})}}catch(e){return{alg:new h,issues:new W({errors:[`Malformed alg: ${e.toString()}`]})}}}function mt(e,t){return e.alg.isIdentical(t.alg)&&N(e.issues.warnings,t.issues.warnings)&&N(e.issues.errors,t.issues.errors)}var ht=class extends E{getDefaultValue(){return{alg:new h,issues:new W}}canReuseValue(e,t){return mt(e,t)}async derive(e){return typeof e==`string`?pt(e):{alg:e,issues:new W}}},gt=class extends b{derive(e){return e.kpuzzle.algToTransformation(e.setupAlg.alg)}},_t=class extends b{derive(e){if(e.setupTransformation)return e.setupTransformation;switch(e.setupAnchor){case`start`:return e.setupAlgTransformation;case`end`:{let t=e.indexer.transformationAtIndex(e.indexer.numAnimatedLeaves()).invert();return e.setupAlgTransformation.applyTransformation(t)}default:throw Error(`Unimplemented!`)}}},vt=class extends y{getDefaultValue(){return null}},yt=class extends y{getDefaultValue(){return{move:null,amount:0}}canReuseValue(e,t){return e.move===t.move&&e.amount===t.amount}},bt=class extends b{derive(e){return{patternIndex:e.currentMoveInfo.patternIndex,movesFinishing:e.currentMoveInfo.movesFinishing.map(e=>e.move),movesFinished:e.currentMoveInfo.movesFinished.map(e=>e.move)}}canReuseValue(e,t){return e.patternIndex===t.patternIndex&&je(e.movesFinishing,t.movesFinishing,(e,t)=>e.isIdentical(t))&&je(e.movesFinished,t.movesFinished,(e,t)=>e.isIdentical(t))}},xt=class extends b{derive(e){function t(t){return e.detailedTimelineInfo.atEnd&&e.catchUpMove.move!==null&&t.currentMoves.push({move:e.catchUpMove.move,direction:-1,fraction:1-e.catchUpMove.amount,startTimestamp:-1,endTimestamp:-1}),t}if(e.indexer.currentMoveInfo)return t(e.indexer.currentMoveInfo(e.detailedTimelineInfo.timestamp));{let n=e.indexer.timestampToIndex(e.detailedTimelineInfo.timestamp),r={patternIndex:n,currentMoves:[],movesFinishing:[],movesFinished:[],movesStarting:[],latestStart:-1/0,earliestEnd:1/0};if(e.indexer.numAnimatedLeaves()>0){let i=e.indexer.getAnimLeaf(n)?.as(m);if(!i)return t(r);let a=e.indexer.indexToMoveStartTimestamp(n),o=e.indexer.moveDuration(n),s=o?(e.detailedTimelineInfo.timestamp-a)/o:0,c=a+o,l={move:i,direction:1,fraction:s,startTimestamp:a,endTimestamp:c};s===0?r.movesStarting.push(l):s===1?r.movesFinishing.push(l):(r.currentMoves.push(l),r.latestStart=Math.max(r.latestStart,a),r.earliestEnd=Math.min(r.earliestEnd,c))}return t(r)}}},St=class extends b{derive(e){let t=e.indexer.transformationAtIndex(e.currentLeavesSimplified.patternIndex);t=e.anchoredStart.applyTransformation(t);for(let n of e.currentLeavesSimplified.movesFinishing)t=t.applyMove(n);for(let n of e.currentLeavesSimplified.movesFinished)t=t.applyMove(n);return t.toKPattern()}},Ct={u:`y`,l:`x`,f:`z`,r:`x`,b:`z`,d:`y`,m:`x`,e:`y`,s:`z`,x:`x`,y:`y`,z:`z`};function wt(e,t){return Ct[e.family[0].toLowerCase()]===Ct[t.family[0].toLowerCase()]}var Tt=t(class extends a{traverseAlg(e){let t=[];for(let n of e.childAlgNodes())t.push(this.traverseAlgNode(n));return Array.prototype.concat(...t)}traverseGroupingOnce(e){if(e.experimentalIsEmpty())return[];let t=[];for(let n of e.childAlgNodes()){if(!(n.is(m)||n.is(f)||n.is(r)))return this.traverseAlg(e);let i=n.as(m);i&&t.push(i)}let n=O(t[0].amount);for(let r=0;r<t.length-1;r++){for(let n=1;n<t.length;n++)if(!wt(t[r],t[n]))return this.traverseAlg(e);n=Math.max(n,O(t[r].amount))}let i=t.map(e=>({animLeafAlgNode:e,msUntilNext:0,duration:n}));return i[i.length-1].msUntilNext=n,i}traverseGrouping(e){let t=[],n=e.amount>0?e.alg:e.alg.invert();for(let r=0;r<Math.abs(e.amount);r++)t.push(this.traverseGroupingOnce(n));return Array.prototype.concat(...t)}traverseMove(e){let t=O(e.amount);return[{animLeafAlgNode:e,msUntilNext:t,duration:t}]}traverseCommutator(e){let t=[],n=[e.A,e.B,e.A.invert(),e.B.invert()];for(let e of n)t.push(this.traverseGroupingOnce(e));return Array.prototype.concat(...t)}traverseConjugate(e){let t=[],n=[e.A,e.B,e.A.invert()];for(let e of n)t.push(this.traverseGroupingOnce(e));return Array.prototype.concat(...t)}traversePause(e){if(e.experimentalNISSGrouping)return[];let t=O(1);return[{animLeafAlgNode:e,msUntilNext:t,duration:t}]}traverseNewline(e){return[]}traverseLineComment(e){return[]}});function Et(e){let t=0;return Tt(e).map(e=>{let n={animLeaf:e.animLeafAlgNode,start:t,end:t+e.duration};return t+=e.msUntilNext,n})}var Dt=class{constructor(e,t,n){this.kpuzzle=e,this.animLeaves=n?.animationTimelineLeaves??Et(t)}animLeaves;getAnimLeaf(e){return this.animLeaves[Math.min(e,this.animLeaves.length-1)]?.animLeaf??null}getAnimationTimelineLeaf(e){return this.animLeaves[Math.min(e,this.animLeaves.length-1)]}indexToMoveStartTimestamp(e){let t=0;return this.animLeaves.length>0&&(t=this.animLeaves[Math.min(e,this.animLeaves.length-1)].start),t}timestampToIndex(e){let t=0;for(t=0;t<this.animLeaves.length;t++)if(this.animLeaves[t].start>=e)return Math.max(0,t-1);return Math.max(0,t-1)}timestampToPosition(e,t){let n=this.currentMoveInfo(e),r=t??this.kpuzzle.identityTransformation().toKPattern();for(let e of this.animLeaves.slice(0,n.patternIndex)){let t=e.animLeaf.as(m);t!==null&&(r=r.applyMove(t))}return{pattern:r,movesInProgress:n.currentMoves}}currentMoveInfo(e){let t=1/0;for(let n of this.animLeaves)if(n.start<=e&&n.end>=e)t=Math.min(t,n.start);else if(n.start>e)break;let n=[],r=[],i=[],a=[],o=-1/0,s=1/0,c=0;for(let l of this.animLeaves)if(l.end<=t){if(!isFinite(t)&&l.start>e)break;c++}else if(l.start>e)break;else{let t=l.animLeaf.as(m);if(t!==null){let c=(e-l.start)/(l.end-l.start),u=!1;c>1&&(c=1,u=!0);let d={move:t,direction:1,fraction:c,startTimestamp:l.start,endTimestamp:l.end};switch(c){case 0:r.push(d);break;case 1:u?a.push(d):i.push(d);break;default:n.push(d),o=Math.max(o,l.start),s=Math.min(s,l.end)}}}return{patternIndex:c,currentMoves:n,latestStart:o,earliestEnd:s,movesStarting:r,movesFinishing:i,movesFinished:a}}patternAtIndex(e,t){let n=t??this.kpuzzle.defaultPattern();for(let t=0;t<this.animLeaves.length&&t<e;t++){let e=this.animLeaves[t].animLeaf.as(m);e!==null&&(n=n.applyMove(e))}return n}transformationAtIndex(e){let t=this.kpuzzle.identityTransformation();for(let n of this.animLeaves.slice(0,e)){let e=n.animLeaf.as(m);e!==null&&(t=t.applyMove(e))}return t}algDuration(){let e=0;for(let t of this.animLeaves)e=Math.max(e,t.end);return e}numAnimatedLeaves(){return this.animLeaves.length}moveDuration(e){let t=this.getAnimationTimelineLeaf(e);return t.end-t.start}},Ot=1024,kt=class extends b{derive(e){switch(e.indexerConstructorRequest){case`auto`:return e.animationTimelineLeaves!==null||ae(e.alg.alg)<=Ot&&e.puzzle===`3x3x3`&&e.visualizationStrategy===`Cube3D`?Dt:Ce;case`tree`:return Ce;case`simple`:return _e;case`simultaneous`:return Dt;default:throw Error(`Invalid indexer request!`)}}},At=class extends y{getDefaultValue(){return`auto`}},jt=class extends b{derive(e){return new e.indexerConstructor(e.kpuzzle,e.algWithIssues.alg,{animationTimelineLeaves:e.animationTimelineLeaves})}},Mt=class extends b{derive(e){return{pattern:e.currentPattern,movesInProgress:e.currentMoveInfo.currentMoves}}},Nt=!0,Pt=class extends b{async derive(e){try{return Nt&&e.kpuzzle.algToTransformation(e.algWithIssues.alg),e.algWithIssues}catch(e){return{alg:new h,issues:new W({errors:[`Invalid alg for puzzle: ${e.toString()}`]})}}}},Ft=class extends y{getDefaultValue(){return`start`}},It=class extends y{getDefaultValue(){return null}},Lt=class extends b{async derive(e){return e.puzzleLoader.kpuzzle()}},Rt=class extends y{getDefaultValue(){return T}},zt=class extends b{async derive(e){return e.puzzleLoader.id}},Bt=class extends y{getDefaultValue(){return T}},Vt=class extends b{derive(e){if(e.puzzleIDRequest&&e.puzzleIDRequest!==T){let t=ie[e.puzzleIDRequest];return t||this.userVisibleErrorTracker.set({errors:[`Invalid puzzle ID: ${e.puzzleIDRequest}`]}),t}return e.puzzleDescriptionRequest&&e.puzzleDescriptionRequest!==T?ee(e.puzzleDescriptionRequest):re}},Ht=class extends b{derive(e){return{playing:e.playingInfo.playing,atStart:e.detailedTimelineInfo.atStart,atEnd:e.detailedTimelineInfo.atEnd}}canReuseValue(e,t){return e.playing===t.playing&&e.atStart===t.atStart&&e.atEnd===t.atEnd}},Ut=class extends b{derive(e){let t=this.#e(e),n=!1,r=!1;return t>=e.timeRange.end&&(r=!0,t=Math.min(e.timeRange.end,t)),t<=e.timeRange.start&&(n=!0,t=Math.max(e.timeRange.start,t)),{timestamp:t,timeRange:e.timeRange,atStart:n,atEnd:r}}#e(e){switch(e.timestampRequest){case`auto`:return e.setupAnchor===`start`&&e.setupAlg.alg.experimentalIsEmpty()?e.timeRange.end:e.timeRange.start;case`start`:return e.timeRange.start;case`end`:return e.timeRange.end;case`anchor`:return e.setupAnchor===`start`?e.timeRange.start:e.timeRange.end;case`opposite-anchor`:return e.setupAnchor===`start`?e.timeRange.end:e.timeRange.start;default:return e.timestampRequest}}canReuseValue(e,t){return e.timestamp===t.timestamp&&e.timeRange.start===t.timeRange.start&&e.timeRange.end===t.timeRange.end&&e.atStart===t.atStart&&e.atEnd===t.atEnd}},Wt=class extends E{async getDefaultValue(){return{direction:1,playing:!1,untilBoundary:`entire-timeline`,loop:!1}}async derive(e,t){let n=await t,r=Object.assign({},n);return Object.assign(r,e),r}canReuseValue(e,t){return e.direction===t.direction&&e.playing===t.playing&&e.untilBoundary===t.untilBoundary&&e.loop===t.loop}},Gt=class extends E{getDefaultValue(){return 1}derive(e){return e<0?1:e}},Kt={auto:!0,start:!0,end:!0,anchor:!0,"opposite-anchor":!0},qt=class extends y{getDefaultValue(){return`auto`}set(e){let t=this.get();super.set((async()=>this.validInput(await e)?e:t)())}validInput(e){return!!(typeof e==`number`||Kt[e])}},Jt=class extends b{derive(e){return{start:0,end:e.indexer.algDuration()}}},Yt=class extends y{getDefaultValue(){return`auto`}},Xt=class extends y{getDefaultValue(){return`auto`}},Zt=class extends b{derive(e){switch(e.puzzleID){case`clock`:case`square1`:case`redi_cube`:case`melindas2x2x2x2`:case`tri_quad`:case`loopover`:return`2D`;case`3x3x3`:switch(e.visualizationRequest){case`auto`:case`3D`:return`Cube3D`;default:return e.visualizationRequest}default:switch(e.visualizationRequest){case`auto`:case`3D`:return`PG3D`;case`experimental-2D-LL`:case`experimental-2D-LL-face`:return[`2x2x2`,`4x4x4`,`megaminx`].includes(e.puzzleID)?`experimental-2D-LL`:`2D`;default:return e.visualizationRequest}}}},Qt=class extends y{getDefaultValue(){return`auto`}},$t=class extends y{getDefaultValue(){return`auto`}},en=class extends y{getDefaultValue(){return`auto`}},tn=class extends y{getDefaultValue(){return`auto`}},nn=null;async function rn(){return nn??=new(await(C())).ThreeTextureLoader}var an=class extends b{async derive(e){let{spriteURL:t}=e;return t===null?null:new Promise(async(e,n)=>{let r=()=>{console.warn(`Could not load sprite:`,t.toString()),e(null)};try{(await rn()).load(t.toString(),e,r,r)}catch{r()}})}},on={facelets:[`regular`,`regular`,`regular`,`regular`,`regular`]};async function sn(e){let{definition:t}=await e.kpuzzle(),n={orbits:{}};for(let e of t.orbits)n.orbits[e.orbitName]={pieces:Array(e.numPieces).fill(on)};return n}var cn=class extends b{getDefaultValue(){return{orbits:{}}}async derive(e){return e.stickeringMaskRequest?e.stickeringMaskRequest:e.stickeringRequest===`picture`?{specialBehaviour:`picture`,orbits:{}}:e.puzzleLoader.stickeringMask?.(e.stickeringRequest??`full`)??sn(e.puzzleLoader)}},ln={"-":`Regular`,D:`Dim`,I:`Ignored`,X:`Invisible`,O:`IgnoreNonPrimary`,P:`PermuteNonPrimary`,o:`Ignoriented`,"?":`OrientationWithoutPermutation`,M:`Mystery`,"@":`Regular`};function un(e){let t={orbits:{}},n=e.split(`,`);for(let e of n){let[n,r,...i]=e.split(`:`);if(i.length>0)throw Error(`Invalid serialized orbit stickering mask (too many colons): \`${e}\``);let a=[];t.orbits[n]={pieces:a};for(let e of r){let t=ln[e];a.push(ne(t))}}return t}var dn=class extends E{getDefaultValue(){return null}derive(e){return e===null?null:typeof e==`string`?un(e):e}},fn=class extends y{getDefaultValue(){return null}},pn=class extends y{getDefaultValue(){return`auto`}},mn=class extends y{getDefaultValue(){return{}}},hn=class extends y{getDefaultValue(){return`auto`}},gn=class extends y{getDefaultValue(){return`auto`}},_n=class extends b{derive(e){return e.colorSchemeRequest===`dark`?`dark`:`light`}},vn=class extends y{getDefaultValue(){return`auto`}},yn=class extends y{getDefaultValue(){return null}},bn=35,xn=class extends y{getDefaultValue(){return bn}};function Sn(e,t){return e.latitude===t.latitude&&e.longitude===t.longitude&&e.distance===t.distance}var Cn=class extends E{getDefaultValue(){return`auto`}canReuseValue(e,t){return e===t||Sn(e,t)}async derive(e,t){if(e===`auto`)return`auto`;let n=await t;n===`auto`&&(n={});let r=Object.assign({},n);return Object.assign(r,e),r.latitude!==void 0&&(r.latitude=Math.min(Math.max(r.latitude,-90),90)),r.longitude!==void 0&&(r.longitude=P(r.longitude,180,-180)),r}},wn=class extends b{canReuseValue(e,t){return Sn(e,t)}async derive(e){if(e.orbitCoordinatesRequest===`auto`)return An(e.puzzleID,e.strategy);let t=Object.assign(Object.assign({},An(e.puzzleID,e.strategy),e.orbitCoordinatesRequest));if(Math.abs(t.latitude)<=e.latitudeLimit)return t;{let{latitude:n,longitude:r,distance:i}=t;return{latitude:e.latitudeLimit*Math.sign(n),longitude:r,distance:i}}}},Tn={latitude:31.717474411461005,longitude:0,distance:5.877852522924731},En={latitude:35,longitude:30,distance:6},Dn={latitude:35,longitude:30,distance:6.25},On={latitude:Math.atan(1/2)*pe,longitude:0,distance:6.7},kn={latitude:26.56505117707799,longitude:0,distance:6};function An(e,t){if(e[1]===`x`)return t===`Cube3D`?En:Dn;switch(e){case`megaminx`:case`gigaminx`:return On;case`pyraminx`:case`master_tetraminx`:return kn;case`skewb`:return Dn;default:return Tn}}var jn=class{constructor(e){this.twistyPlayerModel=e,this.orbitCoordinates=new wn({orbitCoordinatesRequest:this.orbitCoordinatesRequest,latitudeLimit:this.latitudeLimit,puzzleID:e.puzzleID,strategy:e.visualizationStrategy}),this.stickeringMask=new cn({stickeringMaskRequest:this.stickeringMaskRequest,stickeringRequest:this.stickeringRequest,puzzleLoader:e.puzzleLoader})}background=new gn;colorSchemeRequest=new vn;dragInput=new pn;foundationDisplay=new $t;foundationStickerSpriteURL=new U;fullscreenElement=new yn;hintFacelet=new ue;hintStickerSpriteURL=new U;initialHintFaceletsAnimation=new tn;hintFaceletsElevation=new en;latitudeLimit=new xn;movePressInput=new hn;movePressCancelOptions=new mn;orbitCoordinatesRequest=new Cn;stickeringMaskRequest=new dn;stickeringRequest=new fn;faceletScale=new Qt;colorScheme=new _n({colorSchemeRequest:this.colorSchemeRequest});foundationStickerSprite=new an({spriteURL:this.foundationStickerSpriteURL});hintStickerSprite=new an({spriteURL:this.hintStickerSpriteURL});orbitCoordinates;stickeringMask},Mn={errors:[]},Nn=class extends y{getDefaultValue(){return Mn}reset(){this.set(this.getDefaultValue())}canReuseValue(e,t){return N(e.errors,t.errors)}},Pn=class{userVisibleErrorTracker=new Nn;alg=new ht;backView=new Te;controlPanel=new Le;catchUpMove=new yt;indexerConstructorRequest=new At;playingInfo=new Wt;puzzleDescriptionRequest=new Rt;puzzleIDRequest=new Bt;setupAnchor=new Ft;setupAlg=new ht;setupTransformation=new It;tempoScale=new Gt;timestampRequest=new qt;viewerLink=new Yt;visualizationFormat=new Xt;title=new ft;videoURL=new U;competitionID=new ft;animationTimelineLeavesRequest=new vt;puzzleLoader=new Vt({puzzleIDRequest:this.puzzleIDRequest,puzzleDescriptionRequest:this.puzzleDescriptionRequest},this.userVisibleErrorTracker);kpuzzle=new Lt({puzzleLoader:this.puzzleLoader});puzzleID=new zt({puzzleLoader:this.puzzleLoader});puzzleAlg=new Pt({algWithIssues:this.alg,kpuzzle:this.kpuzzle});puzzleSetupAlg=new Pt({algWithIssues:this.setupAlg,kpuzzle:this.kpuzzle});visualizationStrategy=new Zt({visualizationRequest:this.visualizationFormat,puzzleID:this.puzzleID});indexerConstructor=new kt({alg:this.alg,puzzle:this.puzzleID,visualizationStrategy:this.visualizationStrategy,indexerConstructorRequest:this.indexerConstructorRequest,animationTimelineLeaves:this.animationTimelineLeavesRequest});setupAlgTransformation=new gt({setupAlg:this.puzzleSetupAlg,kpuzzle:this.kpuzzle});indexer=new jt({indexerConstructor:this.indexerConstructor,algWithIssues:this.puzzleAlg,kpuzzle:this.kpuzzle,animationTimelineLeaves:this.animationTimelineLeavesRequest});anchorTransformation=new _t({setupTransformation:this.setupTransformation,setupAnchor:this.setupAnchor,setupAlgTransformation:this.setupAlgTransformation,indexer:this.indexer});timeRange=new Jt({indexer:this.indexer});detailedTimelineInfo=new Ut({timestampRequest:this.timestampRequest,timeRange:this.timeRange,setupAnchor:this.setupAnchor,setupAlg:this.setupAlg});coarseTimelineInfo=new Ht({detailedTimelineInfo:this.detailedTimelineInfo,playingInfo:this.playingInfo});currentMoveInfo=new xt({indexer:this.indexer,detailedTimelineInfo:this.detailedTimelineInfo,catchUpMove:this.catchUpMove});buttonAppearance=new Ye({coarseTimelineInfo:this.coarseTimelineInfo,viewerLink:this.viewerLink});currentLeavesSimplified=new bt({currentMoveInfo:this.currentMoveInfo});currentPattern=new St({anchoredStart:this.anchorTransformation,currentLeavesSimplified:this.currentLeavesSimplified,indexer:this.indexer});legacyPosition=new Mt({currentMoveInfo:this.currentMoveInfo,currentPattern:this.currentPattern});twistySceneModel=new jn(this);async twizzleLink(){let[e,t,n,r,i,a,o,s]=await Promise.all([this.viewerLink.get(),this.puzzleID.get(),this.puzzleDescriptionRequest.get(),this.alg.get(),this.setupAlg.get(),this.setupAnchor.get(),this.twistySceneModel.stickeringRequest.get(),this.twistySceneModel.twistyPlayerModel.title.get()]),c=e===`experimental-twizzle-explorer`,l=new URL(`https://alpha.twizzle.net/${c?`explore`:`edit`}/`);return r.alg.experimentalIsEmpty()||l.searchParams.set(`alg`,r.alg.toString()),i.alg.experimentalIsEmpty()||l.searchParams.set(`setup-alg`,i.alg.toString()),a!==`start`&&l.searchParams.set(`setup-anchor`,a),o!==`full`&&o!==null&&l.searchParams.set(`experimental-stickering`,o),c&&n!==T?l.searchParams.set(`puzzle-description`,n):t!==`3x3x3`&&l.searchParams.set(`puzzle`,t),s&&l.searchParams.set(`title`,s),l.toString()}experimentalAddAlgLeaf(e,t){let n=e.as(m);n?this.experimentalAddMove(n,t):this.alg.set((async()=>{let t=(await this.alg.get()).alg.concat(new h([e]));return this.timestampRequest.set(`end`),t})())}experimentalAddMove(e,t){let n=typeof e==`string`?new m(e):e;this.alg.set((async()=>{let[{alg:e},r]=await Promise.all([this.alg.get(),this.puzzleLoader.get()]),i=o(e,n,{...t,...await te(r)});return this.timestampRequest.set(`end`),this.catchUpMove.set({move:n,amount:0}),i})())}experimentalRemoveFinalChild(){this.alg.set((async()=>{let e=(await this.alg.get()).alg,t=Array.from(e.childAlgNodes()),[n]=t.splice(-1);if(!n)return e;this.timestampRequest.set(`end`);let r=n.as(m);return r&&this.catchUpMove.set({move:r.invert(),amount:0}),new h(t)})())}};function G(e){return Error(`Cannot get \`.${e}\` directly from a \`TwistyPlayer\`.`)}var Fn=class extends v{experimentalModel=new Pn;set alg(e){this.experimentalModel.alg.set(e)}get alg(){throw G(`alg`)}set experimentalSetupAlg(e){this.experimentalModel.setupAlg.set(e)}get experimentalSetupAlg(){throw G(`setup`)}set experimentalSetupAnchor(e){this.experimentalModel.setupAnchor.set(e)}get experimentalSetupAnchor(){throw G(`anchor`)}set puzzle(e){this.experimentalModel.puzzleIDRequest.set(e)}get puzzle(){throw G(`puzzle`)}set experimentalPuzzleDescription(e){this.experimentalModel.puzzleDescriptionRequest.set(e)}get experimentalPuzzleDescription(){throw G(`experimentalPuzzleDescription`)}set timestamp(e){this.experimentalModel.timestampRequest.set(e)}get timestamp(){throw G(`timestamp`)}set hintFacelets(e){this.experimentalModel.twistySceneModel.hintFacelet.set(e)}get hintFacelets(){throw G(`hintFacelets`)}set experimentalStickering(e){this.experimentalModel.twistySceneModel.stickeringRequest.set(e)}get experimentalStickering(){throw G(`experimentalStickering`)}set experimentalStickeringMaskOrbits(e){this.experimentalModel.twistySceneModel.stickeringMaskRequest.set(e)}get experimentalStickeringMaskOrbits(){throw G(`experimentalStickeringMaskOrbits`)}set experimentalFaceletScale(e){this.experimentalModel.twistySceneModel.faceletScale.set(e)}get experimentalFaceletScale(){throw G(`experimentalFaceletScale`)}set backView(e){this.experimentalModel.backView.set(e)}get backView(){throw G(`backView`)}set background(e){this.experimentalModel.twistySceneModel.background.set(e)}get background(){throw G(`background`)}set colorScheme(e){this.experimentalModel.twistySceneModel.colorSchemeRequest.set(e)}get colorScheme(){throw G(`colorScheme`)}set controlPanel(e){this.experimentalModel.controlPanel.set(e)}get controlPanel(){throw G(`controlPanel`)}set visualization(e){this.experimentalModel.visualizationFormat.set(e)}get visualization(){throw G(`visualization`)}set experimentalTitle(e){this.experimentalModel.title.set(e)}get experimentalTitle(){throw G(`experimentalTitle`)}set experimentalVideoURL(e){this.experimentalModel.videoURL.set(e)}get experimentalVideoURL(){throw G(`experimentalVideoURL`)}set experimentalCompetitionID(e){this.experimentalModel.competitionID.set(e)}get experimentalCompetitionID(){throw G(`experimentalCompetitionID`)}set viewerLink(e){this.experimentalModel.viewerLink.set(e)}get viewerLink(){throw G(`viewerLink`)}set experimentalMovePressInput(e){this.experimentalModel.twistySceneModel.movePressInput.set(e)}get experimentalMovePressInput(){throw G(`experimentalMovePressInput`)}set experimentalMovePressCancelOptions(e){this.experimentalModel.twistySceneModel.movePressCancelOptions.set(e)}get experimentalMovePressCancelOptions(){throw G(`experimentalMovePressCancelOptions`)}set cameraLatitude(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({latitude:e})}get cameraLatitude(){throw G(`cameraLatitude`)}set cameraLongitude(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({longitude:e})}get cameraLongitude(){throw G(`cameraLongitude`)}set cameraDistance(e){this.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set({distance:e})}get cameraDistance(){throw G(`cameraDistance`)}set cameraLatitudeLimit(e){this.experimentalModel.twistySceneModel.latitudeLimit.set(e)}get cameraLatitudeLimit(){throw G(`cameraLatitudeLimit`)}set indexer(e){this.experimentalModel.indexerConstructorRequest.set(e)}get indexer(){throw G(`indexer`)}set tempoScale(e){this.experimentalModel.tempoScale.set(e)}get tempoScale(){throw G(`tempoScale`)}set experimentalSprite(e){this.experimentalModel.twistySceneModel.foundationStickerSpriteURL.set(e)}get experimentalSprite(){throw G(`experimentalSprite`)}set experimentalHintSprite(e){this.experimentalModel.twistySceneModel.hintStickerSpriteURL.set(e)}get experimentalHintSprite(){throw G(`experimentalHintSprite`)}set fullscreenElement(e){this.experimentalModel.twistySceneModel.fullscreenElement.set(e)}get fullscreenElement(){throw G(`fullscreenElement`)}set experimentalInitialHintFaceletsAnimation(e){this.experimentalModel.twistySceneModel.initialHintFaceletsAnimation.set(e)}get experimentalInitialHintFaceletsAnimation(){throw G(`experimentalInitialHintFaceletsAnimation`)}set experimentalHintFaceletsElevation(e){this.experimentalModel.twistySceneModel.hintFaceletsElevation.set(e)}get experimentalHintFaceletsElevation(){throw G(`experimentalHintFaceletsElevation`)}set experimentalDragInput(e){this.experimentalModel.twistySceneModel.dragInput.set(e)}get experimentalDragInput(){throw G(`experimentalDragInput`)}experimentalGet=new In(this.experimentalModel)},In=class{constructor(e){this.model=e}async alg(){return(await this.model.alg.get()).alg}async setupAlg(){return(await this.model.setupAlg.get()).alg}puzzleID(){return this.model.puzzleID.get()}async timestamp(){return(await this.model.detailedTimelineInfo.get()).timestamp}},Ln=`data-`,K={alg:`alg`,"experimental-setup-alg":`experimentalSetupAlg`,"experimental-setup-anchor":`experimentalSetupAnchor`,puzzle:`puzzle`,"experimental-puzzle-description":`experimentalPuzzleDescription`,visualization:`visualization`,"hint-facelets":`hintFacelets`,"experimental-stickering":`experimentalStickering`,"experimental-stickering-mask-orbits":`experimentalStickeringMaskOrbits`,background:`background`,"color-scheme":`colorScheme`,"control-panel":`controlPanel`,"back-view":`backView`,"experimental-facelet-scale":`experimentalFaceletScale`,"experimental-initial-hint-facelets-animation":`experimentalInitialHintFaceletsAnimation`,"experimental-hint-facelets-elevation":`experimentalHintFaceletsElevation`,"viewer-link":`viewerLink`,"experimental-move-press-input":`experimentalMovePressInput`,"experimental-drag-input":`experimentalDragInput`,"experimental-title":`experimentalTitle`,"experimental-video-url":`experimentalVideoURL`,"experimental-competition-id":`experimentalCompetitionID`,"camera-latitude":`cameraLatitude`,"camera-longitude":`cameraLongitude`,"camera-distance":`cameraDistance`,"camera-latitude-limit":`cameraLatitudeLimit`,"tempo-scale":`tempoScale`,"experimental-sprite":`experimentalSprite`,"experimental-hint-sprite":`experimentalHintSprite`},Rn=Object.fromEntries(Object.values(K).map(e=>[e,!0])),zn={experimentalMovePressCancelOptions:!0},Bn,Vn=Symbol(`intersectedCallback`);function Hn(e){Bn??=new IntersectionObserver((e,t)=>{for(let n of e)n.isIntersecting&&n.intersectionRect.height>0&&(n.target[Vn](),t.unobserve(n.target))}),Bn.observe(e)}var q=class extends Fn{controller=new Fe(this.experimentalModel,this);buttons;experimentalCanvasClickCallback=()=>{};constructor(e={}){super();for(let[t,n]of Object.entries(e)){if(!(Rn[t]||zn[t])){console.warn(`Invalid config passed to TwistyPlayer: ${t}`);break}this[t]=n}}#e=new M(this,`controls-`,[`auto`].concat(Object.keys(Ie)));#t=document.createElement(`div`);#n=document.createElement(`div`);#r=!1;connectedCallback(){this.addCSS(dt),Hn(this)}async[Vn](){if(this.#r)return;this.#r=!0,this.addElement(this.#t).classList.add(`visualization-wrapper`),this.addElement(this.#n).classList.add(`error-elem`),this.#n.textContent=`Error`,this.experimentalModel.userVisibleErrorTracker.addFreshListener(e=>{let t=e.errors[0]??null;this.contentWrapper.classList.toggle(`error`,!!t),t&&(this.#n.textContent=t)});let e=new ot(this.experimentalModel,this.controller);this.contentWrapper.appendChild(e),this.buttons=new $e(this.experimentalModel,this.controller,this),this.contentWrapper.appendChild(this.buttons),this.experimentalModel.twistySceneModel.background.addFreshListener(e=>{this.contentWrapper.classList.toggle(`checkered`,[`auto`,`checkered`].includes(e)),this.contentWrapper.classList.toggle(`checkered-transparent`,e===`checkered-transparent`)}),this.experimentalModel.twistySceneModel.colorScheme.addFreshListener(e=>{this.contentWrapper.classList.toggle(`dark-mode`,[`dark`].includes(e))}),this.experimentalModel.controlPanel.addFreshListener(e=>{this.#e.setValue(e)}),this.experimentalModel.visualizationStrategy.addFreshListener(this.#c.bind(this)),this.experimentalModel.puzzleID.addFreshListener(this.flash.bind(this))}#i=`auto`;experimentalSetFlashLevel(e){this.#i=e}flash(){this.#i===`auto`&&this.#a?.animate([{opacity:.25},{opacity:1}],{duration:250,easing:`ease-out`})}#a=null;#o=new He;#s=null;#c(e){if(e!==this.#s){this.#a?.remove(),this.#a?.disconnect();let t;switch(e){case`2D`:case`experimental-2D-LL`:case`experimental-2D-LL-face`:t=new Ve(this.experimentalModel.twistySceneModel,e);break;case`Cube3D`:case`PG3D`:t=new I(this.experimentalModel),this.#o.handleNewValue(t);break;default:throw Error(`Invalid visualization`)}this.#t.appendChild(t),this.#a=t,this.#s=e}}async experimentalCurrentVantages(){this.connectedCallback();let e=this.#a;return e instanceof I?e.experimentalVantages():[]}async experimentalCurrentCanvases(){let e=await this.experimentalCurrentVantages(),t=[];for(let n of e)t.push((await n.canvasInfo()).canvas);return t}async experimentalCurrentThreeJSPuzzleObject(e){this.connectedCallback();let t=await(await this.#o.promise).experimentalTwisty3DPuzzleWrapper(),n=t.twisty3DPuzzle(),r=(async()=>{await n,await new Promise(e=>setTimeout(e,0))})();if(e){let n=new D(async()=>{});t.addEventListener(`render-scheduled`,async()=>{n.requestIsPending()||(n.requestAnimFrame(),await r,e())})}return n}jumpToStart(e){this.controller.jumpToStart(e)}jumpToEnd(e){this.controller.jumpToEnd(e)}play(){this.controller.togglePlay(!0)}pause(){this.controller.togglePlay(!1)}togglePlay(e){this.controller.togglePlay(e)}experimentalAddMove(e,t){this.experimentalModel.experimentalAddMove(e,t)}experimentalAddAlgLeaf(e,t){this.experimentalModel.experimentalAddAlgLeaf(e,t)}static get observedAttributes(){let e=[];for(let t of Object.keys(K))e.push(t,Ln+t);return e}experimentalRemoveFinalChild(){this.experimentalModel.experimentalRemoveFinalChild()}attributeChangedCallback(e,t,n){e.startsWith(Ln)&&(e=e.slice(Ln.length));let r=K[e];r&&(this[r]=n)}async experimentalScreenshot(e){return(await ct(this.experimentalModel,e)).dataURL}async experimentalDownloadScreenshot(e){if([`2D`,`experimental-2D-LL`,`experimental-2D-LL-face`].includes(await this.experimentalModel.visualizationStrategy.get())){let t=await this.#a.currentTwisty2DPuzzleWrapper().twisty2DPuzzle(),n=new XMLSerializer().serializeToString(t.svgWrapper.svgElement);ut(URL.createObjectURL(new Blob([n])),e??await lt(this.experimentalModel),`svg`)}else await(await ct(this.experimentalModel)).download(e)}};x.define(`twisty-player`,q);var Un=t(class extends i{traverseAlg(e,t){let n=[],r=0;for(let i of e.childAlgNodes()){let e=this.traverseAlgNode(i,{numMovesSoFar:t.numMovesSoFar+r});n.push(e.tokens),r+=e.numLeavesInside}return{tokens:Array.prototype.concat(...n),numLeavesInside:r}}traverseGrouping(e,t){let n=this.traverseAlg(e.alg,t);return{tokens:n.tokens,numLeavesInside:n.numLeavesInside*e.amount}}traverseMove(e,t){return{tokens:[{leaf:e,idx:t.numMovesSoFar}],numLeavesInside:1}}traverseCommutator(e,t){let n=this.traverseAlg(e.A,t),r=this.traverseAlg(e.B,{numMovesSoFar:t.numMovesSoFar+n.numLeavesInside});return{tokens:n.tokens.concat(r.tokens),numLeavesInside:n.numLeavesInside*2+r.numLeavesInside}}traverseConjugate(e,t){let n=this.traverseAlg(e.A,t),r=this.traverseAlg(e.B,{numMovesSoFar:t.numMovesSoFar+n.numLeavesInside});return{tokens:n.tokens.concat(r.tokens),numLeavesInside:n.numLeavesInside*2+r.numLeavesInside*2}}traversePause(e,t){return{tokens:[{leaf:e,idx:t.numMovesSoFar}],numLeavesInside:1}}traverseNewline(e,t){return{tokens:[],numLeavesInside:0}}traverseLineComment(e,t){return{tokens:[],numLeavesInside:0}}}),Wn=class extends y{getDefaultValue(){return``}},Gn=class extends b{derive(e){return pt(e.value)}},Kn=class extends E{getDefaultValue(){return{selectionStart:0,selectionEnd:0,endChangedMostRecently:!1}}async derive(e,t){let{selectionStart:n,selectionEnd:r}=e,i=await t;return{selectionStart:n,selectionEnd:r,endChangedMostRecently:e.selectionStart===i.selectionStart&&e.selectionEnd!==(await t).selectionEnd}}},qn=class extends b{derive(e){return e.selectionInfo.endChangedMostRecently?e.selectionInfo.selectionEnd:e.selectionInfo.selectionStart}},Jn=class extends b{derive(e){return Un(e.algWithIssues.alg,{numMovesSoFar:0}).tokens}},Yn=class extends b{derive(e){function t(t){if(t===null)return null;let n;return n=e.targetChar<t.leaf[_]?`before`:e.targetChar===t.leaf[_]?`start`:e.targetChar<t.leaf[s]?`inside`:e.targetChar===t.leaf[s]?`end`:`after`,{leafInfo:t,where:n}}let n=null;for(let r of e.leafTokens){if(e.targetChar<r.leaf[_]&&n!==null)return t(n);if(e.targetChar<=r.leaf[s])return t(r);n=r}return t(n)}},Xn=class{valueProp=new Wn;selectionProp=new Kn;targetCharProp=new qn({selectionInfo:this.selectionProp});algEditorAlgWithIssues=new Gn({value:this.valueProp});leafTokensProp=new Jn({algWithIssues:this.algEditorAlgWithIssues});leafToHighlight=new Yn({leafTokens:this.leafTokensProp,targetChar:this.targetCharProp})},Zn=`//`;function Qn(e){try{return h.fromString(e)}catch{return null}}function $n(e,t){let n=e.indexOf(t);return n===-1?[e,``]:[e.slice(0,n),e.slice(n)]}function er(e){let t=[];for(let n of e.split(`
`)){let[e,r]=$n(n,Zn);e=e.replaceAll(`’`,`'`),t.push(e+r)}return t.join(`
`)}function tr(e,t){let{value:n}=e,{selectionStart:r,selectionEnd:i}=e,a=n.slice(0,r),o=n.slice(i);t=t.replaceAll(`\r
`,`
`);let s=a.match(/\/\/[^\n]*$/),c=n[r-1]===`/`&&t[0]===`/`,l=s||c,u=t.match(/\/\/[^\n]*$/),d=t;if(l){let[e,n]=$n(t,`
`);d=e+er(n)}else d=er(t);let f=!l&&r!==0&&![`
`,` `].includes(d[0])&&![`
`,` `].includes(n[r-1]),p=!u&&i!==n.length&&![`
`,` `].includes(d.at(-1))&&![`
`,` `].includes(n[i]);function m(e,t){let n=e+d+t,r=!!Qn(a+n+o);return r&&(d=n),r}f&&p&&m(` `,` `)||f&&m(` `,``)||p&&m(``,` `),L?.execCommand(`insertText`,!1,d)||e.setRangeText(d,r,i,`end`)}var nr=new S;nr.replaceSync(`
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
`);var J=`for-twisty-player`,rr=`placeholder`,ir=`twisty-player-prop`,ar=class extends v{model=new Xn;#e=document.createElement(`textarea`);#t=document.createElement(`div`);#n=document.createElement(`span`);#r=document.createElement(`span`);#i=document.createElement(`span`);#a=new M(this,`valid-for-puzzle-`,[`none`,`warning`,`error`]);#o=null;#s;get#c(){return this.#o===null?null:this.#o.experimentalModel[this.#s]}debugNeverRequestTimestamp=!1;constructor(e){super(),this.#t.classList.add(`carbon-copy`),this.addElement(this.#t),this.#e.rows=1,this.addElement(this.#e),this.#n.classList.add(`prefix`),this.#t.appendChild(this.#n),this.#r.classList.add(`highlight`),this.#t.appendChild(this.#r),this.#i.classList.add(`suffix`),this.#t.appendChild(this.#i),this.#e.placeholder=`Alg`,this.#e.setAttribute(`spellcheck`,`false`),this.addCSS(nr),this.#e.addEventListener(`input`,()=>{this.#l=!0,this.onInput()}),this.#e.addEventListener(`blur`,()=>this.onBlur()),document.addEventListener(`selectionchange`,()=>this.onSelectionChange()),e?.twistyPlayer&&(this.twistyPlayer=e.twistyPlayer),this.#s=e?.twistyPlayerProp??`alg`,e?.twistyPlayerProp===`alg`&&this.model.leafToHighlight.addFreshListener(e=>{e&&this.highlightLeaf(e.leafInfo.leaf)})}connectedCallback(){this.#e.addEventListener(`paste`,e=>{let t=e.clipboardData?.getData(`text`);t&&(tr(this.#e,t),e.preventDefault(),this.onInput())})}set algString(e){this.#e.value=e,this.onInput()}get algString(){return this.#e.value}set placeholder(e){this.#e.placeholder=e}#l=!1;onInput(){this.#r.hidden=!0,this.highlightLeaf(null);let e=this.#e.value.trimEnd();this.model.valueProp.set(e),this.#c?.set(e)}async onSelectionChange(){if(document.activeElement!==this||this.shadow.activeElement!==this.#e||this.#s!==`alg`)return;let{selectionStart:e,selectionEnd:t}=this.#e;this.model.selectionProp.set({selectionStart:e,selectionEnd:t})}async onBlur(){}setAlgIssueClassForPuzzle(e){this.#a.setValue(e)}#u(e){return e.endsWith(`
`)?`${e} `:e}#d=null;highlightLeaf(e){if(e===null){this.#n.textContent=``,this.#r.textContent=``,this.#i.textContent=this.#u(this.#e.value);return}e!==this.#d&&(this.#d=e,this.#n.textContent=this.#e.value.slice(0,e[_]),this.#r.textContent=this.#e.value.slice(e[_],e[s]),this.#i.textContent=this.#u(this.#e.value.slice(e[s])),this.#r.hidden=!1)}get twistyPlayer(){return this.#o}set twistyPlayer(e){if(this.#o){console.warn(`twisty-player reassignment/clearing is not supported`);return}this.#o=e,e&&((async()=>{this.algString=this.#c?(await this.#c.get()).alg.toString():``})(),this.#s===`alg`&&(this.#o?.experimentalModel.puzzleAlg.addFreshListener(e=>{if(e.issues.errors.length===0){this.setAlgIssueClassForPuzzle(e.issues.warnings.length===0?`none`:`warning`);let t=e.alg,n=h.fromString(this.algString);t.isIdentical(n)||(this.algString=t.toString(),this.onInput())}else this.setAlgIssueClassForPuzzle(`error`)}),this.model.leafToHighlight.addFreshListener(async t=>{if(t===null)return;let[n,r]=await Promise.all([await e.experimentalModel.indexer.get(),await e.experimentalModel.timestampRequest.get()]);if(r===`auto`&&!this.#l)return;let i=n.indexToMoveStartTimestamp(t.leafInfo.idx),a=n.moveDuration(t.leafInfo.idx),o;switch(t.where){case`before`:o=i;break;case`start`:case`inside`:o=i+a/4;break;case`end`:case`after`:o=i+a;break;default:throw console.log(`invalid where`),Error(`Invalid where!`)}this.debugNeverRequestTimestamp||e.experimentalModel.timestampRequest.set(o)}),e.experimentalModel.currentLeavesSimplified.addFreshListener(async t=>{let n=(await e.experimentalModel.indexer.get()).getAnimLeaf(t.patternIndex);this.highlightLeaf(n)})))}attributeChangedCallback(e,t,n){switch(e){case J:{let e=document.getElementById(n);if(!e){console.warn(`${J}= elem does not exist`);return}if(!(e instanceof q)){console.warn(`${J}=is not a twisty-player`);return}this.twistyPlayer=e;return}case rr:this.placeholder=n;return;case ir:if(this.#o)throw console.log(`cannot set prop`),Error(`cannot set prop after twisty player`);this.#s=n;return}}static get observedAttributes(){return[J,rr,ir]}};x.define(`twisty-alg-editor`,ar);async function or(e){return new Promise((t,n)=>{try{let n=document.getElementById(e);n&&t(n);let r=new MutationObserver(n=>{for(let i of n)i.attributeName===`id`&&i.target instanceof Element&&i.target.getAttribute(`id`)===e&&(t(i.target),r.disconnect())});r.observe(document.body,{attributeFilter:[`id`],subtree:!0})}catch(e){n(e)}})}var sr=new S;sr.replaceSync(`
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
`);var cr=.25,Y=class extends v{constructor(e,t,n,r,i,a){if(super({mode:`open`}),this.algOrAlgNode=r,this.classList.add(e),this.addCSS(sr),a){let e=this.contentWrapper.appendChild(document.createElement(`a`));e.href=`#`,e.textContent=t,e.addEventListener(`click`,e=>{e.preventDefault(),n.twistyAlgViewer.jumpToIndex(n.earliestMoveIndex,i)})}else this.contentWrapper.appendChild(document.createElement(`span`)).textContent=t}pathToIndex(e){return[]}setCurrentMove(e){this.contentWrapper.classList.toggle(`current-move`,e)}};x.define(`twisty-alg-leaf-elem`,Y);var X=class extends fe{constructor(e,t){super(),this.algOrAlgNode=t,this.classList.add(e)}queue=[];addString(e){this.queue.push(document.createTextNode(e))}addElem(e){return this.queue.push(e.element),e.moveCount}flushQueue(e=1){for(let t of dr(this.queue,e))this.append(t);this.queue=[]}pathToIndex(e){return[]}};x.define(`twisty-alg-wrapper-elem`,X);function lr(e){return e===1?-1:1}function ur(e,t){return t<0?lr(e):e}function dr(e,t){if(t===1)return e;let n=Array.from(e);return n.reverse(),n}var fr=t(class extends i{traverseAlg(e,t){let r=0,i=new X(`twisty-alg-alg`,e),a=!0;for(let o of p(e.childAlgNodes(),t.direction))a||i.addString(` `),a=!1,o.as(l)?.experimentalNISSGrouping&&i.addString(`^(`),o.as(n)?.experimentalNISSPlaceholder||(r+=i.addElem(this.traverseAlgNode(o,{earliestMoveIndex:t.earliestMoveIndex+r,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction}))),o.as(l)?.experimentalNISSGrouping&&i.addString(`)`);return i.flushQueue(t.direction),{moveCount:r,element:i}}traverseGrouping(e,t){let n=e.experimentalAsSquare1Tuple(),r=ur(t.direction,e.amount),i=0,a=new X(`twisty-alg-grouping`,e);return a.addString(`(`),n?(i+=a.addElem({moveCount:1,element:new Y(`twisty-alg-move`,n[0].amount.toString(),t,n[0],!0,!0)}),a.addString(`, `),i+=a.addElem({moveCount:1,element:new Y(`twisty-alg-move`,n[1].amount.toString(),t,n[1],!0,!0)})):i+=a.addElem(this.traverseAlg(e.alg,{earliestMoveIndex:t.earliestMoveIndex+i,twistyAlgViewer:t.twistyAlgViewer,direction:r})),a.addString(`)${e.experimentalRepetitionSuffix}`),a.flushQueue(),{moveCount:i*Math.abs(e.amount),element:a}}traverseMove(e,t){let n=new Y(`twisty-alg-move`,e.toString(),t,e,!0,!0);return t.twistyAlgViewer.highlighter.addMove(e[_],n),{moveCount:1,element:n}}traverseCommutator(e,t){let n=0,r=new X(`twisty-alg-commutator`,e);r.addString(`[`),r.flushQueue();let[i,a]=dr([e.A,e.B],t.direction);return n+=r.addElem(this.traverseAlg(i,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),r.addString(`, `),n+=r.addElem(this.traverseAlg(a,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),r.flushQueue(t.direction),r.addString(`]`),r.flushQueue(),{moveCount:n*2,element:r}}traverseConjugate(e,t){let n=0,r=new X(`twisty-alg-conjugate`,e);r.addString(`[`);let i=r.addElem(this.traverseAlg(e.A,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction}));return n+=i,r.addString(`: `),n+=r.addElem(this.traverseAlg(e.B,{earliestMoveIndex:t.earliestMoveIndex+n,twistyAlgViewer:t.twistyAlgViewer,direction:t.direction})),r.addString(`]`),r.flushQueue(),{moveCount:n+i,element:r}}traversePause(e,t){return e.experimentalNISSGrouping?this.traverseAlg(e.experimentalNISSGrouping.alg,t):{moveCount:1,element:new Y(`twisty-alg-pause`,`.`,t,e,!0,!0)}}traverseNewline(e,t){let n=new X(`twisty-alg-newline`,e);return n.append(document.createElement(`br`)),{moveCount:0,element:n}}traverseLineComment(e,t){return{moveCount:0,element:new Y(`twisty-alg-line-comment`,`//${e.text}`,t,e,!1,!1)}}}),pr=class{moveCharIndexMap=new Map;currentElem=null;addMove(e,t){this.moveCharIndexMap.set(e,t)}set(e){let t=e?this.moveCharIndexMap.get(e[_])??null:null;this.currentElem!==t&&(this.currentElem?.classList.remove(`twisty-alg-current-move`),this.currentElem?.setCurrentMove(!1),t?.classList.add(`twisty-alg-current-move`),t?.setCurrentMove(!0),this.currentElem=t)}},mr=class extends fe{highlighter=new pr;#e;#t=null;lastClickTimestamp=null;constructor(e){super(),e?.twistyPlayer&&(this.twistyPlayer=e?.twistyPlayer)}connectedCallback(){}setAlg(e){this.#e=fr(e,{earliestMoveIndex:0,twistyAlgViewer:this,direction:1}).element,this.textContent=``,this.appendChild(this.#e)}get twistyPlayer(){return this.#t}set twistyPlayer(e){this.#n(e)}async#n(e){if(this.#t){console.warn(`twisty-player reassignment is not supported`);return}if(e===null)throw Error(`clearing twistyPlayer is not supported`);this.#t=e,this.#t.experimentalModel.alg.addFreshListener(e=>{this.setAlg(e.alg)});let t=(await this.#t.experimentalModel.alg.get()).alg,n=_ in t?t:h.fromString(t.toString());this.setAlg(n),e.experimentalModel.currentMoveInfo.addFreshListener(e=>{let t=e.currentMoves[0];if(t??=e.movesStarting[0],t??=e.movesFinishing[0],!t)this.highlighter.set(null);else{let e=t.move;this.highlighter.set(e)}}),e.experimentalModel.detailedTimelineInfo.addFreshListener(e=>{e.timestamp!==this.lastClickTimestamp&&(this.lastClickTimestamp=null)})}async jumpToIndex(e,t){let n=this.#t;if(n){n.pause();let r=(async()=>{let r=await n.experimentalModel.indexer.get(),i=t?r.moveDuration(e)*cr:0;return r.indexToMoveStartTimestamp(e)+r.moveDuration(e)-i})();n.experimentalModel.timestampRequest.set(await r),this.lastClickTimestamp===await r?(n.play(),this.lastClickTimestamp=null):this.lastClickTimestamp=await r}}async attributeChangedCallback(e,t,n){if(e===`for`){let e=document.getElementById(n);if(e||console.info(`for= elem does not exist, waiting for one`),await customElements.whenDefined(`twisty-player`),e=await or(n),!(e instanceof q)){console.warn(`for= elem is not a twisty-player`);return}this.twistyPlayer=e}}static get observedAttributes(){return[`for`]}};x.define(`twisty-alg-viewer`,mr);var Z=new S;Z.replaceSync(`
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
`);var hr=new S;hr.replaceSync(`
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
`);function gr(e=``,t=location.href){let n={alg:`alg`,"setup-alg":`experimental-setup-alg`,"setup-anchor":`experimental-setup-anchor`,puzzle:`puzzle`,stickering:`experimental-stickering`,"puzzle-description":`experimental-puzzle-description`,title:`experimental-title`,"video-url":`experimental-video-url`,competition:`experimental-competition-id`},r=new URL(t).searchParams,i={};for(let[t,a]of Object.entries(n)){let n=r.get(e+t);if(n!==null){let e=K[a];i[e]=n}}return i}var Q=`outer block moves (e.g. R, Rw, or 4r)`,$=`inner block moves (e.g. M or 2-5r)`,_r={OBTM:`HTM = OBTM ("Outer Block Turn Metric"):
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
• all moves (including rotations) count as 1 turn`},vr={OBTM:`OB`,OBQTM:`OBQ`,RBTM:`RB`,RBQTM:`RBQ`,ETM:`E`},yr=class extends v{constructor(e){super({mode:`open`}),this.options=e}twistyPlayer=null;a=null;#e(){if(this.contentWrapper.textContent=``,this.a){let e=this.contentWrapper.appendChild(document.createElement(`span`));e.textContent=`❗️`,e.title=`Could not show a player for link`,this.addElement(this.a)}this.removeCSS(Z);let e=this.shadow.adoptedStyleSheets.indexOf(Z);e!==void 0&&this.shadow.adoptedStyleSheets.splice(e,e+1),this.#t?.remove()}#t;#n;#r;#i;async connectedCallback(){if(this.#r=this.addElement(document.createElement(`div`)),this.#r.classList.add(`responsive-wrapper`),this.options?.colorScheme===`dark`&&this.contentWrapper.classList.add(`dark-mode`),this.addCSS(Z),this.options?.cdnForumTweaks&&this.addCSS(hr),this.a=this.querySelector(`a`),!this.a)return;let t=gr(``,this.a.href),n=this.a?.href,{hostname:r,pathname:i}=new URL(n);if(r!==`alpha.twizzle.net`){this.#e();return}if([`/edit/`,`/explore/`].includes(i)){let n=i===`/explore/`;if(t.puzzle&&!(t.puzzle in ie)){let n=(await e(async()=>{let{getPuzzleDescriptionString:e}=await import(`./puzzle-geometry-BNnFjRas.js`);return{getPuzzleDescriptionString:e}},[])).getPuzzleDescriptionString(t.puzzle);delete t.puzzle,t.experimentalPuzzleDescription=n}if(this.twistyPlayer=this.#r.appendChild(new q({background:this.options?.cdnForumTweaks?`checkered-transparent`:`checkered`,colorScheme:this.options?.colorScheme===`dark`?`dark`:`light`,...t,viewerLink:n?`experimental-twizzle-explorer`:`auto`})),this.twistyPlayer.fullscreenElement=this.contentWrapper,t.experimentalTitle&&(this.twistyPlayer.experimentalTitle=t.experimentalTitle),this.#n=this.#r.appendChild(document.createElement(`div`)),this.#n.classList.add(`scrollable-region`),t.experimentalTitle&&this.#a(t.experimentalTitle).classList.add(`title`),t.experimentalSetupAlg){this.#a(`Setup`,async()=>(await this.twistyPlayer?.experimentalModel.setupAlg.get())?.alg.toString()??null);let e=this.#n.appendChild(document.createElement(`div`));e.classList.add(`setup-alg`),e.textContent=new h(t.experimentalSetupAlg).toString()}this.#i=this.#a(`Moves`,async()=>(await this.twistyPlayer?.experimentalModel.alg.get())?.alg.toString()??null).appendChild(br(this.twistyPlayer.experimentalModel)),this.#i.classList.add(`move-count`),this.#n.appendChild(new mr({twistyPlayer:this.twistyPlayer})).part.add(`twisty-alg-viewer`)}else this.#e()}#a(e,t){let n=this.#n.appendChild(document.createElement(`div`));n.classList.add(`heading`);let r=n.appendChild(document.createElement(`span`));if(r.textContent=e,t){r.textContent+=` `;let e=r.appendChild(document.createElement(`a`));e.textContent=`📋`,e.href=`#`,e.title=`Copy to clipboard`;async function n(t){e.textContent=t,await new Promise(e=>setTimeout(e,2e3)),e.textContent===t&&(e.textContent=`📋`)}e.addEventListener(`click`,async r=>{r.preventDefault(),e.textContent=`📋…`;let i=await t();if(i)try{await navigator.clipboard.writeText(i),n(`📋✅`)}catch(e){throw n(`📋❌`),e}else n(`📋❌`)})}return n}};x.define(`twizzle-link`,yr);function br(e,t=document.createElement(`span`)){async function n(){let[n,r]=await Promise.all([e.puzzleAlg.get(),e.puzzleLoader.get()]);if(n.issues.errors.length!==0){t.textContent=``;return}let i=!0;function a(e){i?i=!1:t.append(`)(`);let a=t.appendChild(document.createElement(`span`)),o=oe(r,e,n.alg);a.append(`${vr[e]}: `);let s=a.appendChild(document.createElement(`span`));s.textContent=o.toString(),s.classList.add(`move-number`),a.setAttribute(`data-before`,_r[e]??``),a.setAttribute(`title`,_r[e]??``)}t.textContent=`(`,r.id===`3x3x3`?(a(`OBTM`),a(`OBQTM`),a(`RBTM`)):r.pg&&(a(`RBTM`),a(`RBQTM`)),a(`ETM`),t.append(`)`)}return e.puzzleAlg.addFreshListener(n),e.puzzleID.addFreshListener(n),t}export{Ae as a,we as c,mr as i,Ce as n,q as o,ar as r,yr as s,_e as t};