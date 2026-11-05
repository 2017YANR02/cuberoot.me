import { forwardRef, useId } from 'react';
import type { SVGProps } from 'react';
import { STACKMAT_G5_HAND, STACKMAT_RESET } from './stackmat-artwork-parts';
import { STACKMAT_G5_PARTS } from './StackmatIcon';
import StackmatWordmark from './StackmatWordmark';
import StackmatLcdDigits from './StackmatLcdDigits';
import type { StackmatG5Skin } from './stackmat-catalog';

// Same approved contours as the homepage icon, with product-specific material colors.
// Reference: https://www.speedstacks.com/store/_img/_hd/03017__800.png
const contours = Object.fromEntries(STACKMAT_G5_PARTS.map(([, attributes]) => [attributes.key, attributes.d as string]));
// Traced from the original 1920px G5 Blackout product photograph, thumb-pad detail.
// https://www.speedstacks.com/store/_img/_hd/03020.png
// Open ridges, short branches and rounded ends are intentional, not concentric rings.
const FINGERPRINT = [
  'M606 53C716 119 787 260 717 404',
  'M424 63C550 59 650 120 675 238C705 357 639 444 566 492',
  'M192 151Q263 83 360 73',
  'M162 192C204 238 243 202 294 163C379 96 477 102 545 158C620 220 634 290 612 356',
  'M172 271C207 309 249 275 306 235C382 179 423 161 477 187C553 220 579 282 553 342C531 390 484 398 446 429C401 465 390 503 401 544',
  'M179 514C221 522 207 487 214 445C230 359 291 300 370 258C435 223 479 239 495 279C512 321 483 340 449 350C355 382 314 455 338 544',
  'M301 382C347 331 391 306 435 292',
  'M276 429C265 468 264 504 269 534',
  'M104 224C83 297 136 307 165 333C185 350 166 378 149 414C132 449 126 468 131 492',
  'M66 317C83 340 93 377 87 425',
  'M579 402C550 432 521 447 490 468C459 490 454 512 465 536',
];

type Props = SVGProps<SVGSVGElement> & { size?: number; displayValue?: string; digitColor?: string; skin?: StackmatG5Skin; padMode?: '2-pad' | '4-pad'; indicator?: 'idle' | 'holding' | 'ready' };

/** Editable, transparent G5 illustration. No embedded images or external fonts. */
const StackmatG5Artwork = forwardRef<SVGSVGElement, Props>(function StackmatG5Artwork({ size = 280, displayValue = '0.000', digitColor = '#4d594c', skin = 'classic', padMode = '4-pad', indicator = 'idle', ...props }, ref) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  const part = (key: string) => contours[key];
  const classic = skin === 'classic';
  const mist = skin === 'black-mist';
  const phantom = skin === 'phantom';
  const symbol = mist ? '#929594' : '#e2df00';
  const indicatorColor = indicator === 'ready' ? '#28df61' : indicator === 'holding' ? '#e82a37' : padMode === '2-pad' ? '#e5c52b' : mist ? '#73b3c1' : '#0059d9';
  return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="-8 8 816 280"
    width={size * 816 / 280} height={size} fill="none" {...props}>
    <defs>
      <linearGradient id={`${id}-dark-panel`} x2="0" y2="1"><stop stopColor={mist ? '#383b3c' : '#0a0c0c'}/><stop offset="1" stopColor="#050707"/></linearGradient>
      <linearGradient id={`${id}-dark-pad`} x2=".3" y2="1">
        <stop stopColor={mist ? '#45484a' : '#101213'}/><stop offset=".28" stopColor={phantom ? '#666a6c' : '#202324'}/>
        <stop offset=".48" stopColor="#080a0b"/><stop offset=".72" stopColor={phantom ? '#777a7b' : '#101213'}/><stop offset="1" stopColor="#060809"/>
      </linearGradient>
      <pattern id={`${id}-cubes`} width="24" height="28" patternUnits="userSpaceOnUse" patternTransform="skewY(-10)">
        <path d="M12 0L24 7V21L12 28L0 21V7ZM0 7L12 14L24 7M12 14V28" stroke={mist ? '#16191a' : '#686c6d'} strokeWidth=".6" opacity=".65"/>
      </pattern>
      <linearGradient id={`${id}-shell`} x1="400" y1="25" x2="400" y2="275" gradientUnits="userSpaceOnUse">
        <stop stopColor="#555658"/><stop offset=".18" stopColor="#222426"/><stop offset=".5" stopColor="#121416"/>
        <stop offset=".75" stopColor="#1c1e20"/><stop offset="1" stopColor="#080a0c"/>
      </linearGradient>
      <linearGradient id={`${id}-rim`} x1="280" y1="20" x2="510" y2="250" gradientUnits="userSpaceOnUse">
        <stop stopColor="#858887"/><stop offset=".22" stopColor="#373a3c"/><stop offset=".62" stopColor="#090b0d"/><stop offset="1" stopColor="#575a5b"/>
      </linearGradient>
      <linearGradient id={`${id}-silver`} x1="310" y1="30" x2="520" y2="160" gradientUnits="userSpaceOnUse">
        <stop stopColor="#c7c8c5"/><stop offset=".24" stopColor="#f1f2ed"/><stop offset=".58" stopColor="#c1c3bd"/><stop offset="1" stopColor="#dfdfda"/>
      </linearGradient>
      <linearGradient id={`${id}-blue`} x1="30" y1="45" x2="260" y2="160" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00182e"/><stop offset=".35" stopColor="#007eb5"/><stop offset=".68" stopColor="#00d8f1"/><stop offset="1" stopColor="#006bad"/>
      </linearGradient>
      <linearGradient id={`${id}-thumb`} x1="180" y1="250" x2="310" y2="150" gradientUnits="userSpaceOnUse">
        <stop stopColor="#020c1a"/><stop offset=".45" stopColor="#0056a3"/><stop offset=".75" stopColor="#05dffc"/><stop offset="1" stopColor="#70f1ff"/>
      </linearGradient>
      <radialGradient id={`${id}-front`} cx=".5" cy=".1" r=".85">
        <stop stopColor="#929494"/><stop offset=".24" stopColor="#353839"/><stop offset=".65" stopColor="#111315"/><stop offset="1" stopColor="#404345"/>
      </radialGradient>
      <radialGradient id={`${id}-shoulder`}>
        <stop stopColor="#cbd1d4" stopOpacity=".48"/><stop offset=".28" stopColor="#8c9499" stopOpacity=".23"/><stop offset="1" stopColor="#39424a" stopOpacity="0"/>
      </radialGradient>
      <linearGradient id={`${id}-lcd`} x2="0" y2="1"><stop stopColor="#a3ada0"/><stop offset=".4" stopColor="#c8d2c2"/><stop offset="1" stopColor="#b7c4b2"/></linearGradient>
      <pattern id={`${id}-mesh`} width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(39) skewX(-12) scale(.65)">
        <path d="M0 0H24V24H0Z" stroke="#002441" strokeWidth="1"/>
        <path d="M1 1H12V12H1Z" fill="#02d5ee" opacity=".45"/>
        <path d="M13 13H23V23H13Z" fill="#00174c" opacity=".55"/>
        <path d="M0 12H24M12 0V24" stroke="#40e5fc" strokeWidth=".55" opacity=".5"/>
      </pattern>
      <pattern id={`${id}-brushed`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)">
        <path d="M0 0V5M3 0V5" stroke="#fff" strokeWidth=".3" opacity=".13"/>
      </pattern>
      <clipPath id={`${id}-left-pad`}><path d={part('left-palm-surface')}/></clipPath>
      <clipPath id={`${id}-right-pad`}><path d={part('right-palm-surface')}/></clipPath>
      <clipPath id={`${id}-left-thumb`}><path d={part('left-thumb-recess')}/></clipPath>
      <clipPath id={`${id}-right-thumb`}><path d={part('right-thumb-recess')}/></clipPath>
    </defs>

    <g id={`${id}-housing`}>
      <path d={part('outline-0')} transform="translate(0 8)" fill="#080a0b"/>
      <path d={part('outline-0')} fill={paint('shell')} stroke={paint('rim')} strokeWidth="1.6"/>
      <path d={part('front-shell-seam')} stroke="#6b6d6c" strokeOpacity=".25" strokeWidth="1.2"/>
      <ellipse cx="151" cy="219" rx="33" ry="41" transform="rotate(-32 151 219)" fill={paint('shoulder')}/>
      <ellipse cx="649" cy="219" rx="33" ry="41" transform="rotate(32 649 219)" fill={paint('shoulder')}/>
    </g>

    {(['left', 'right'] as const).map(side => <g key={side} clipPath={paint(`${side}-pad`)}>
      <path d={part(`${side}-palm-surface`)} fill={classic ? paint('blue') : paint('dark-pad')}/>
      <rect x="0" y="30" width="800" height="180" fill={paint(classic ? 'mesh' : 'cubes')}/>
      <g transform={side === 'right' ? 'translate(800 0) scale(-1 1)' : undefined} stroke="#52bfe7" strokeWidth=".7" opacity={classic ? .45 : 0}>
        {Array.from({ length: 15 }, (_, index) => <path key={index}
          d={`M${20 + index * 16} 35Q${-5 + index * 12} 90 ${100 + index * 10} 205`}/>)}
        {Array.from({ length: 10 }, (_, index) => <path key={index}
          d={`M0 ${50 + index * 12}Q120 ${83 + index * 13} 270 ${36 + index * 14}`}/>)}
      </g>
      <g transform={side === 'left' ? 'translate(118 111) rotate(-14)' : 'translate(682 111) rotate(14)'}>
        <ellipse rx="51" ry="35" fill={mist ? 'none' : symbol} stroke={mist ? symbol : phantom ? '#070909' : 'none'} strokeWidth={mist ? 3 : 5}/>
        <path d={STACKMAT_G5_HAND} transform={side === 'left' ? 'rotate(14) scale(.12 .11) translate(-350 -285)' : 'rotate(-14) scale(-.12 .11) translate(-350 -285)'} fill={mist ? symbol : '#070a05'}/>
      </g>
    </g>)}
    <path d={part('left-palm-surface')} stroke="#456775" strokeWidth="1.2"/>
    <path d={part('right-palm-surface')} stroke="#456775" strokeWidth="1.2"/>

    <g id={`${id}-control-panel`}>
      <path d="M208 153L274 43C281 29 292 23 307 27C364 40 433 40 492 27C508 23 519 29 526 43L593 153Q597 159 589 158L452 133Q400 116 348 133L213 158Q204 160 208 153Z"
        fill={classic ? paint('silver') : paint('dark-panel')} stroke="#131617" strokeWidth="5"/>
      <path d="M208 153L274 43C281 29 292 23 307 27C364 40 433 40 492 27C508 23 519 29 526 43L593 153L452 133Q400 116 348 133Z" fill={classic ? paint('brushed') : phantom ? 'none' : paint('cubes')}/>
      <path d="M257 79Q286 78 309 99Q326 115 329 137L215 155Q209 157 213 149Z" fill="#080909"/>
      {/* The 5 sits behind the G, as on the physical G5 badge. */}
      <g transform="translate(228 88) scale(.15 .14)">
        <path d="M300 111H532L511 179H368L355 218C392 202 431 206 461 225C503 250 520 285 507 330C492 381 434 415 373 414C298 413 239 377 231 321L319 310C323 334 341 347 367 347C395 347 416 334 418 309C420 286 401 270 376 269C356 267 341 278 328 293L286 282Z" fill={mist ? '#dfdfdc' : '#e21c30'}/>
        <path d="M350 136H259C258 114 242 104 220 106C178 110 150 155 142 195C137 222 146 239 175 240C201 242 222 231 236 215H196L213 159H344L297 298H233L238 275C204 299 170 305 138 302C68 299 36 268 41 218C49 151 89 90 150 62C199 39 260 37 303 58C337 74 352 101 350 136Z" fill={mist ? '#00a65a' : '#e0e500'}/>
      </g>
      <path d={part('screen-frame')} fill="#060909" stroke="#727873" strokeWidth="1.2"/>
      <path d={part('screen-window')} fill={paint('lcd')} stroke="#37443a" strokeWidth="1.3"/>
      <StackmatLcdDigits value={displayValue} x={345} y={55} width={118} height={22.8} color={digitColor}/>
      <path d={`${padMode === '2-pad' ? 'M409 82Q415 79 415 83L409 87H415' : 'M412 86V82L409 85H415'}M417 84H420M423 87V81H426Q429 81 429 83Q429 85 426 85H423M432 87L435 81L438 87M433 85H437M441 87V81H443Q448 81 448 84Q448 87 443 87Z`} stroke="#626e5e" strokeWidth=".9" strokeLinejoin="round"/>
      <ellipse cx="298" cy="48" rx="10" ry="9" fill="#070b13" stroke="#777d7e" strokeWidth="1"/>
      <ellipse cx="298" cy="48" rx="6.5" ry="5.5" fill={indicatorColor}/>
      <path d="M294 47Q298 42 302 47" stroke="#4899fb" strokeWidth="1.5"/>
      <ellipse cx="499" cy="60" rx="17" ry="15" fill="#080a09" stroke="#8f9390"/>
      <path d="M499 49V59M493 53A9 9 0 1 0 505 53" stroke="#ec1837" strokeWidth="3.2" strokeLinecap="round"/>
      <ellipse cx="490" cy="110" rx="16" ry="14" fill="#070a07" stroke="#92968e"/>
      <path d={STACKMAT_RESET} transform="translate(490 110) scale(.9)" fill="#e5e600"/>
    </g>

    <path d="M348 133Q400 119 452 133L469 151Q459 170 461 186L474 200L452 204Q400 189 348 204L327 200Q344 194 339 175L331 155Z" fill={paint('front')}/>
    {(['left', 'right'] as const).map(side => <g key={side}>
      <path d={part(`${side}-thumb-recess`)} fill="#05090e" stroke="#4a5052" strokeWidth="5"/>
      <g clipPath={paint(`${side}-thumb`)}>
        <path d={part(`${side}-thumb-recess`)} fill={classic ? paint('thumb') : paint('dark-pad')}/>
        <rect x="150" y="140" width="500" height="110" fill={paint(classic ? 'mesh' : 'cubes')}/>
        <g transform={side === 'left' ? 'translate(249 195) rotate(-17)' : 'translate(551 195) rotate(17)'}>
          <ellipse rx="34" ry="38" fill={mist ? 'none' : symbol}/>
          <g transform={side === 'left' ? 'rotate(17) scale(.08 .1) translate(-411 -300)' : 'rotate(-17) scale(-.08 .1) translate(-411 -300)'}
            fill="none" stroke={mist ? symbol : '#161e07'} strokeWidth="21" strokeLinecap="round" strokeLinejoin="round">
            {FINGERPRINT.map(d => <path key={d} d={d}/>)}
          </g>
        </g>
      </g>
      <path d={part(`${side}-thumb-recess`)} stroke="#4b575e" strokeWidth="1.2"/>
    </g>)}
    <g id={`${id}-badge`}>
      <path d={part('center-crescent')} fill="#080b0d" stroke="#24292c"/>
      <ellipse cx="401" cy="125" rx="51" ry="24" fill="#aeb2b1" stroke="#11171b" strokeWidth="2.5"/>
      <ellipse cx="401" cy="125" rx="47" ry="20" fill="#0065a3" stroke="#c5c9bf" strokeWidth="1"/>
      <path d="M365 128Q389 108 427 113M368 135Q402 114 438 122" stroke="#49a6cd" strokeWidth="3"/>
      {/* Outlined brand lettering is supplied below; no SVG text/font dependency. */}
      <StackmatWordmark/>
    </g>
  </svg>;
});

export default StackmatG5Artwork;
