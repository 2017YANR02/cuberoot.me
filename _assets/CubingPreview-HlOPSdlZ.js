import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./jsx-runtime-DhG3BTtD.js";import{t as r}from"./chunk-O6HEZXGY-B-1K6yK6.js";import{n as i}from"./chunk-FLK6AZKB-DNFWphWY.js";import{o as a}from"./twisty-SZfUqzuz.js";import{a as o,t as s}from"./sq1_svg-B9fPlKZU.js";import{n as c,t as l}from"./mega_svg-BMP0Wr-3.js";var u=`
:host {
  width: 384px;
  height: 256px;
  display: grid;
}

.wrapper {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  place-content: center;
  overflow: hidden;
}

.wrapper > * {
  width: inherit;
  height: inherit;
  overflow: hidden;
}

twisty-player {
  width: 100%;
  height: 100%;
}
`,d=`333`,f=class extends HTMLElement{#e;#t=document.createElement(`div`);#n={eventID:null,scramble:new r,visualization:null,checkered:!1};#r=new a({controlPanel:`none`,hintFacelets:`none`,visualization:`2D`,background:`none`});get player(){return this.#r}constructor(){super(),this.#e=this.attachShadow({mode:`closed`}),this.#t.classList.add(`wrapper`),this.#e.appendChild(this.#t);let e=document.createElement(`style`);e.textContent=u,this.#e.appendChild(e)}connectedCallback(){this.#t.appendChild(this.#r)}set event(e){let t=i(e??d);this.#r.puzzle=t?.puzzleID??`3x3x3`,this.#n.eventID=e}get event(){return this.#n.eventID}set scramble(e){let t=new r(e??``);this.#r.alg=t,this.#n.scramble=t,this.#t.setAttribute(`title`,t.toString())}get scramble(){return this.#n.scramble}set visualization(e){this.#r.visualization=e??`2D`,this.#n.visualization=e}get visualization(){return this.#n.visualization}set checkered(e){let t=!!e;this.#r.background=t?`checkered`:`none`,this.#n.checkered=t}get checkered(){return this.#n.checkered}attributeChangedCallback(e,t,n){switch(e){case`event`:this.event=n;break;case`scramble`:this.scramble=n;break;case`visualization`:this.visualization=n;break;case`checkered`:this.checkered=n!==null;break}}static get observedAttributes(){return[`event`,`scramble`,`visualization`,`checkered`]}};customElements.define(`scramble-display`,f);var p=e(t(),1),m=n();function h(e){switch(e){case`222`:case`333`:case`444`:case`555`:case`666`:case`777`:return e;case`333oh`:case`333fm`:case`333mr`:case`333ni`:return`333oh`;case`333bld`:case`333bf`:return`333bf`;case`444bld`:case`444bf`:return`444bf`;case`555bld`:case`555bf`:return`555bf`;case`333mbld`:case`333mbf`:return`333mbf`;case`mega`:case`minx`:return`minx`;case`pyra`:case`pyram`:return`pyram`;case`skewb`:return`skewb`;case`sq1`:return`sq1`;case`clock`:return`clock`;case`fto`:return`fto`;case`kilominx`:return`kilominx`;case`r3`:case`r4`:case`r5`:case`custom`:return`333`;default:return null}}function g(e,t){switch(e){case`222`:return{w:t*8,h:t*6};case`333`:case`333oh`:case`333bf`:case`333mbf`:return{w:t*12,h:t*9};case`444`:case`444bf`:return{w:t*16,h:t*12};case`555`:case`555bf`:return{w:t*20,h:t*15};case`666`:return{w:t*24,h:t*18};case`777`:return{w:t*28,h:t*21};case`minx`:return{w:t*17,h:t*8};case`pyram`:return{w:t*12,h:t*10};case`skewb`:return{w:t*12,h:t*9};case`sq1`:return{w:t*7,h:t*14};case`clock`:return{w:t*14,h:t*7};case`fto`:return{w:t*16,h:t*12};case`kilominx`:return{w:t*18,h:t*14};default:return{w:t*12,h:t*9}}}function _(e){let{event:t,scramble:n,className:r}=e,i=e.size??14,a=e.visualization??`2D`,u=(0,p.useRef)(null),d=h(t),f=(0,p.useMemo)(()=>{try{return d===`sq1`?o(n??``,s):d===`minx`?c(n??``,l):null}catch(e){return console.warn(`[CubingPreview] ${d} render failed`,e),null}},[d,n]);if((0,p.useEffect)(()=>{if(d===`sq1`||d===`minx`)return;let e=u.current;if(!e||!d)return;let t=document.createElement(`scramble-display`);return t.setAttribute(`event`,d),t.setAttribute(`scramble`,n),t.setAttribute(`visualization`,a),t.style.width=`100%`,t.style.height=`100%`,t.style.display=`block`,e.appendChild(t),()=>{t.parentNode&&t.parentNode.removeChild(t)}},[d,n,a]),!d)return(0,m.jsx)(`div`,{className:r,style:{display:`none`},"aria-hidden":!0});let{w:_,h:v}=g(d,i);return f?(0,m.jsx)(`div`,{className:r,style:{width:_,height:v,display:`block`},role:`img`,"aria-label":`${t} scramble preview`,dangerouslySetInnerHTML:{__html:f}}):(0,m.jsx)(`div`,{ref:u,className:r,style:{width:_,height:v,display:`block`},role:`img`,"aria-label":`${t} scramble preview`})}export{_ as t};