import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{n}from"./index-WCxT5t90.js";import{t as r}from"./chunk-O6HEZXGY-D8M4Drj6.js";import{t as i}from"./chunk-FLK6AZKB-BpzOTXYp.js";import{t as a}from"./twisty-CVwypl0A.js";import{t as o}from"./createLucideIcon-DRiBxdCb.js";var s=o(`download`,[[`path`,{d:`M12 15V3`,key:`m9g1x1`}],[`path`,{d:`M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4`,key:`ih7n3h`}],[`path`,{d:`m7 10 5 5 5-5`,key:`brsn70`}]]),c=o(`rotate-ccw`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}]]),l=o(`settings`,[[`path`,{d:`M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915`,key:`1i5ecw`}],[`circle`,{cx:`12`,cy:`12`,r:`3`,key:`1v7zrd`}]]),u=o(`trash-2`,[[`path`,{d:`M10 11v6`,key:`nco0om`}],[`path`,{d:`M14 11v6`,key:`outv1u`}],[`path`,{d:`M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6`,key:`miytrc`}],[`path`,{d:`M3 6h18`,key:`d0wm0j`}],[`path`,{d:`M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2`,key:`e791ji`}]]),d=`
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
`,f=`333`,p=class extends HTMLElement{#e;#t=document.createElement(`div`);#n={eventID:null,scramble:new r,visualization:null,checkered:!1};#r=new a({controlPanel:`none`,hintFacelets:`none`,visualization:`2D`,background:`none`});get player(){return this.#r}constructor(){super(),this.#e=this.attachShadow({mode:`closed`}),this.#t.classList.add(`wrapper`),this.#e.appendChild(this.#t);let e=document.createElement(`style`);e.textContent=d,this.#e.appendChild(e)}connectedCallback(){this.#t.appendChild(this.#r)}set event(e){let t=i(e??f);this.#r.puzzle=t?.puzzleID??`3x3x3`,this.#n.eventID=e}get event(){return this.#n.eventID}set scramble(e){let t=new r(e??``);this.#r.alg=t,this.#n.scramble=t,this.#t.setAttribute(`title`,t.toString())}get scramble(){return this.#n.scramble}set visualization(e){this.#r.visualization=e??`2D`,this.#n.visualization=e}get visualization(){return this.#n.visualization}set checkered(e){let t=!!e;this.#r.background=t?`checkered`:`none`,this.#n.checkered=t}get checkered(){return this.#n.checkered}attributeChangedCallback(e,t,n){switch(e){case`event`:this.event=n;break;case`scramble`:this.scramble=n;break;case`visualization`:this.visualization=n;break;case`checkered`:this.checkered=n!==null;break}}static get observedAttributes(){return[`event`,`scramble`,`visualization`,`checkered`]}};customElements.define(`scramble-display`,p);var m=e(t(),1),h=n();function g(e){switch(e){case`222`:case`333`:case`444`:case`555`:case`666`:case`777`:return e;case`333oh`:case`333fm`:case`333mr`:case`333ni`:return`333oh`;case`333bld`:case`333bf`:return`333bf`;case`444bld`:case`444bf`:return`444bf`;case`555bld`:case`555bf`:return`555bf`;case`333mbld`:case`333mbf`:return`333mbf`;case`mega`:case`minx`:return`minx`;case`pyra`:case`pyram`:return`pyram`;case`skewb`:return`skewb`;case`sq1`:return`sq1`;case`clock`:return`clock`;case`fto`:return`fto`;case`kilominx`:return`kilominx`;case`r3`:case`r4`:case`r5`:case`custom`:return`333`;default:return null}}function _(e,t){switch(e){case`222`:return{w:t*8,h:t*6};case`333`:case`333oh`:case`333bf`:case`333mbf`:return{w:t*12,h:t*9};case`444`:case`444bf`:return{w:t*16,h:t*12};case`555`:case`555bf`:return{w:t*20,h:t*15};case`666`:return{w:t*24,h:t*18};case`777`:return{w:t*28,h:t*21};case`minx`:return{w:t*18,h:t*14};case`pyram`:return{w:t*12,h:t*10};case`skewb`:return{w:t*12,h:t*9};case`sq1`:return{w:t*14,h:t*8};case`clock`:return{w:t*14,h:t*7};case`fto`:return{w:t*16,h:t*12};case`kilominx`:return{w:t*18,h:t*14};default:return{w:t*12,h:t*9}}}function v(e){let{event:t,scramble:n,className:r}=e,i=e.size??14,a=(0,m.useRef)(null),o=g(t);if((0,m.useEffect)(()=>{let e=a.current;if(!e||!o)return;let t=document.createElement(`scramble-display`);return t.setAttribute(`event`,o),t.setAttribute(`scramble`,n),t.style.width=`100%`,t.style.height=`100%`,t.style.display=`block`,e.appendChild(t),()=>{t.parentNode&&t.parentNode.removeChild(t)}},[o,n]),!o)return(0,h.jsx)(`div`,{className:r,style:{display:`none`},"aria-hidden":!0});let{w:s,h:c}=_(o,i);return(0,h.jsx)(`div`,{ref:a,className:r,style:{width:s,height:c,display:`block`},role:`img`,"aria-label":`${t} scramble preview`})}export{s as a,c as i,u as n,l as r,v as t};