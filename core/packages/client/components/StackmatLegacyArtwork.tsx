import { forwardRef, useId, type SVGProps } from 'react';
import StackmatWordmark from './StackmatWordmark';
import StackmatLcdDigits from './StackmatLcdDigits';
import { STACKMAT_G5_HAND, STACKMAT_RESET, PALM_STRAIGHT, PALM_G4 } from './stackmat-artwork-parts';
import { STACKMAT_LETTERING } from './stackmat-lettering';

function Lettering({ label, x, y, width, height, color = '#15191c' }: {
  label: keyof typeof STACKMAT_LETTERING; x: number; y: number; width: number; height: number; color?: string;
}) {
  const glyph = STACKMAT_LETTERING[label];
  return <path d={glyph.path} fill={color} transform={`translate(${x} ${y}) scale(${width / glyph.width} ${height / glyph.height}) translate(${-glyph.x} ${-glyph.y})`}/>;
}

// Separately drawn housings. Reference photographs and variant notes live in docs/stackmat-artwork.md.
const STRAIGHT_BODY = 'M63 43Q16 43 10 82Q3 126 52 136L225 151Q280 156 307 178Q400 224 493 178Q520 156 575 151L748 136Q797 126 790 82Q784 43 737 43L540 43L525 31H275L260 43Z';
const G4_BODY = 'M60 21Q12 12 7 57Q2 94 39 119L235 200Q255 211 281 215Q400 263 519 215Q545 211 565 200L761 119Q798 94 793 57Q788 12 740 21L552 72Q531 78 513 68Q400 21 287 68Q269 78 248 72Z';

// Rounded annular LCD: both long edges share the same centre (400, 300).
function g4LcdOutline(outer: number, inner: number, halfAngle: number, corner: number) {
  const point = (radius: number, degrees: number) => {
    const angle = degrees * Math.PI / 180;
    return `${400 + radius * Math.sin(angle)} ${300 - radius * Math.cos(angle)}`;
  };
  const insetAngle = corner / outer * 180 / Math.PI;
  const a = halfAngle - insetAngle;
  return `M${point(outer, -a)} A${outer} ${outer} 0 0 1 ${point(outer, a)}
    Q${point(outer, halfAngle)} ${point(outer - corner, halfAngle)}
    L${point(inner + corner, halfAngle)} Q${point(inner, halfAngle)} ${point(inner, a)}
    A${inner} ${inner} 0 0 0 ${point(inner, -a)}
    Q${point(inner, -halfAngle)} ${point(inner + corner, -halfAngle)}
    L${point(outer - corner, -halfAngle)} Q${point(outer, -halfAngle)} ${point(outer, -a)}Z`;
}

type Props = SVGProps<SVGSVGElement> & {
  generation: 1 | 2 | 3 | 4; indicator?: 'idle' | 'holding' | 'ready'; size?: number; displayValue?: string; digitColor?: string;
};
const StackmatLegacyArtwork = forwardRef<SVGSVGElement, Props>(function StackmatLegacyArtwork({
  generation, size = 280, displayValue = '0.000', digitColor = '#414a37', indicator, ...props
}, ref) {
  const id = useId().replace(/:/g, '');
  const paint = (name: string) => `url(#${id}-${name})`;
  const g4 = generation === 4;
  const pro = generation >= 3;
  const body = g4 ? G4_BODY : STRAIGHT_BODY;
  const palm = g4 ? PALM_G4 : PALM_STRAIGHT;
  const panel = g4 ? 'M278 112Q400 0 522 112L546 195Q400 252 254 195Z'
    : 'M282 39H518L542 133Q509 182 400 197Q291 182 258 133Z';
  return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 10 800 260" width={size * 800 / 260} height={size} fill="none" {...props}>
    <defs>
      {g4 && <>
        <linearGradient id={`${id}-sidewall`} x1="0" y1="90" x2="0" y2="260" gradientUnits="userSpaceOnUse">
          <stop stopColor="#292d30"/><stop offset=".7" stopColor="#111517"/><stop offset="1" stopColor="#050708"/>
        </linearGradient>
        <linearGradient id={`${id}-shoulder`} x2="1" y2=".6">
          <stop stopColor="#101315"/><stop offset=".45" stopColor="#424648"/><stop offset="1" stopColor="#131719"/>
        </linearGradient>
        <radialGradient id={`${id}-button`} cx=".4" cy=".3" r=".75">
          <stop stopColor="#363c3d"/><stop offset=".65" stopColor="#14191a"/><stop offset="1" stopColor="#050809"/>
        </radialGradient>
      </>}
      <linearGradient id={`${id}-body`} x1="400" y1="20" x2="400" y2="245" gradientUnits="userSpaceOnUse">
        <stop stopColor={generation === 1 ? '#72979d' : generation === 2 ? '#127ed6' : '#4d5052'}/>
        <stop offset=".22" stopColor={generation === 1 ? '#416c75' : generation === 2 ? '#00a5ed' : '#232526'}/>
        <stop offset=".58" stopColor={generation === 1 ? '#b7d6d3' : generation === 2 ? '#1175be' : '#080a0b'}/>
        <stop offset="1" stopColor={generation === 1 ? '#4c7881' : generation === 2 ? '#063e77' : '#323537'}/>
      </linearGradient>
      <linearGradient id={`${id}-rim`} x2="0" y2="1"><stop stopColor="#c1c5c1"/><stop offset=".48" stopColor="#272e31"/><stop offset="1" stopColor="#717879"/></linearGradient>
      <linearGradient id={`${id}-panel`} x1="300" y1="40" x2="490" y2="220" gradientUnits="userSpaceOnUse">
        <stop stopColor={generation === 3 ? '#2084c9' : '#b8c5c6'}/><stop offset=".4" stopColor={generation === 3 ? '#61b8ec' : '#e7e7dd'}/>
        <stop offset=".65" stopColor={generation === 3 ? '#e0f1f1' : '#aebdbe'}/><stop offset="1" stopColor={generation === 3 ? '#287cc0' : '#d3dcda'}/>
      </linearGradient>
      <linearGradient id={`${id}-pad`} x2=".2" y2="1"><stop stopColor={pro ? '#0e669f' : '#080c12'}/><stop offset=".45" stopColor={g4 ? '#073657' : pro ? '#55bfea' : '#131719'}/><stop offset="1" stopColor={pro ? '#002c67' : '#04070c'}/></linearGradient>
      <linearGradient id={`${id}-lcd`} x2="0" y2="1"><stop stopColor="#7b876f"/><stop offset=".22" stopColor="#b6c1a1"/><stop offset="1" stopColor="#a5b291"/></linearGradient>
      <radialGradient id={`${id}-red`}><stop stopColor="#fc6160"/><stop offset=".4" stopColor="#a82429"/><stop offset="1" stopColor="#291014"/></radialGradient>
      <radialGradient id={`${id}-green`}><stop stopColor="#7fb85c"/><stop offset=".4" stopColor="#357a3c"/><stop offset="1" stopColor="#10201a"/></radialGradient>
      <pattern id={`${id}-texture`} width="18" height="20" patternUnits="userSpaceOnUse">
        <path d="M9 0L18 5V15L9 20L0 15V5ZM0 5L9 10L18 5M9 10V20" stroke="#124f7d" strokeWidth="1"/>
        <path d="M1 6L8 10V18L1 14Z" fill="#b2e8f9" opacity=".2"/>
      </pattern>
      <pattern id={`${id}-g4-grid`} width="25" height="25" patternUnits="userSpaceOnUse" patternTransform="rotate(23)">
        <path d="M0 0H25V25H0ZM0 12H25M12 0V25" stroke="#43caf0" strokeWidth=".6"/>
        <path d="M1 1H11V11H1Z" fill="#07b4e1" opacity=".4"/>
      </pattern>
      <pattern id={`${id}-brushed`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(10)"><path d="M0 0H4" stroke="#fff" opacity=".16" strokeWidth=".5"/></pattern>
      <clipPath id={`${id}-left`}><path d={palm}/></clipPath>
      <clipPath id={`${id}-right`}><path d={palm} transform="translate(800 0) scale(-1 1)"/></clipPath>
    </defs>
    <path d={body} transform={`translate(0 ${g4 ? 16 : 10})`} fill={g4 ? paint('sidewall') : generation === 2 ? '#053966' : '#0a1014'}/>
    <path d={body} fill={paint('body')} stroke={paint('rim')} strokeWidth="2"/>
    <path d={body} transform="translate(8 3) scale(.98 .96)" stroke="#bdc8c9" strokeOpacity=".18" strokeWidth="1"/>
    {g4 && <>
      <path d="M248 72Q269 78 287 68L278 112L254 195L235 200L251 79Z" fill={paint('shoulder')}/>
      <path d="M248 72Q269 78 287 68L278 112L254 195L235 200L251 79Z" transform="translate(800 0) scale(-1 1)" fill={paint('shoulder')}/>
      <path d="M39 128L235 209Q255 220 281 224Q400 272 519 224Q545 220 565 209L761 128" stroke="#51575a" strokeOpacity=".45" strokeWidth="1.5"/>
    </>}
    {(['left', 'right'] as const).map((side, i) => <g key={side} clipPath={paint(side)}>
      <rect width="800" height="230" fill={paint('pad')}/>
      {pro && <rect width="800" height="230" fill={paint(g4 ? 'g4-grid' : 'texture')}/>}
      {g4 && <g opacity=".65" stroke="#79e8ff" strokeWidth=".5">
        {Array.from({ length: 10 }, (_, n) => <path key={n} d={`M${i ? 800 : 0} ${30 + n * 9}Q400 ${280 - n * 5} ${i ? 535 : 265} 60`}/>)}
      </g>}
      <g transform={`translate(${i ? 680 : 120} ${g4 ? 89 : 93}) rotate(${g4 ? i ? -17 : 17 : 0})`}>
        <ellipse rx="43" ry="36" fill="#e3df04"/>
        {/* The printed mark has separate fingers and palm lobes, not a solid hand silhouette. */}
        <g transform={`scale(${i ? -1 : 1} 1)`}>
          <path d={STACKMAT_G5_HAND} transform="translate(-35 -29) scale(.1 .11)" fill="#080d11"/>
        </g>
      </g>
    </g>)}
    <path d={palm} stroke="#0b1014" strokeWidth="2"/>
    <path d={palm} transform="translate(800 0) scale(-1 1)" stroke="#0b1014" strokeWidth="2"/>
    <path d={panel} stroke="#101619" strokeWidth={g4 ? 5 : 9} strokeLinejoin="round"/>
    <path d={panel} fill={paint('panel')} stroke="#a1b5b6" strokeWidth="2"/>
    {g4 && <path d={panel} fill={paint('brushed')}/>}
    {g4 ? <>
      <path d={g4LcdOutline(228, 172, 26, 6)} fill="#080d0c" stroke="#797f72" strokeWidth="1.5"/>
      <path d={g4LcdOutline(223, 177, 24.7, 3)} fill={paint('lcd')} stroke="#3c4638" strokeWidth="1"/>
      <StackmatLcdDigits value={displayValue} x={339} y={90} width={122} height={25} color={digitColor} arcRadius={197.5}/>
    </> : <>
      <path d="M290 63H407V119H286Z" fill="#111711" stroke="#76827e" strokeWidth="2"/>
      <path d="M296 68H401V112H292Z" fill={paint('lcd')}/>
      <StackmatLcdDigits value={displayValue} x={300} y={74} width={97} height={27} color={digitColor}/>
      {generation === 2 && <path d="M304 107h8m5 0h9m5 0h9m5 0h9m6 0h12" stroke="#737f66" strokeWidth="1.2"/>}
    </>}
    <g transform={g4 ? 'translate(300 145)' : 'translate(457 68)'}>
      <circle r="6.5" fill="#202526" stroke="#b4b5a5" strokeWidth="1.5"/><circle r="4.5" fill={paint('red')} opacity={indicator === undefined || indicator === 'holding' || indicator === 'ready' ? 1 : .25}/>
      <circle cy="20" r="6.5" fill="#202526" stroke="#b4b5a5" strokeWidth="1.5"/><circle cy="20" r="4.5" fill={paint('green')} opacity={indicator === undefined || indicator === 'ready' ? 1 : .25}/>
    </g>
    <g transform={g4 ? 'translate(291 187) scale(.72)' : 'translate(428 86) scale(.82)'}>
      <circle r="17" fill={g4 ? paint('button') : '#111718'} stroke="#d2d7ce" strokeWidth="1.5"/>
      {pro ? <path d="M0-11V1M-6-7A10 10 0 1 0 6-7" stroke="#e52631" strokeWidth="3" strokeLinecap="round"/> : <Lettering label="POWER" x={-13} y={-3} width={26} height={6} color="#d6d9cc"/>}
    </g>
    <g transform={g4 ? 'translate(509 187) scale(.72)' : 'translate(490 86) scale(.82)'}>
      <circle r="17" fill={g4 ? paint('button') : '#111718'} stroke="#d2d7ce" strokeWidth="1.5"/>
      {pro ? <path d={STACKMAT_RESET} fill="#e8da00"/> : <Lettering label="RESET" x={-13} y={-3} width={26} height={6} color="#d6d9cc"/>}
    </g>
    {generation !== 1 && <g transform={g4 ? 'translate(492 140) scale(.85)' : 'translate(450 121)'}>
      <circle r="10" fill="#101719" stroke="#bac7c6" strokeWidth=".8"/><path d="M-5-3H5L0 5Z" fill="#e2e4df"/>
      <circle cx={g4 ? 10 : 30} cy={g4 ? 25 : 0} r="10" fill="#101719" stroke="#bac7c6" strokeWidth=".8"/>
      <Lettering label="SAVE" x={g4 ? 3 : 23} y={g4 ? 23 : -2} width={14} height={4} color="#e0e4df"/>
    </g>}
    {g4 ? <g transform="translate(400 190) scale(.85)">
      <ellipse rx="48" ry="29" fill="#d9ddd2" stroke="#11181b" strokeWidth="2"/>
      <ellipse rx="43" ry="25" fill="#0065a3" stroke="#8cb5cd"/>
      <path d="M-37 7Q-10-29 32-16M-34 14Q3-17 40-8" stroke="#47a1c8" strokeWidth="4"/>
      <StackmatWordmark transform="translate(-401 -125)"/>
    </g> : <>
      {generation === 3 ? <>
        <Lettering label="STACK" x={308} y={139} width={85} height={18} color="#167bb9"/>
        <Lettering label="MAT" x={393} y={139} width={53} height={18} color="#d3252b"/>
        <Lettering label="PRO" x={450} y={139} width={47} height={18} color="#f2f5f3"/>
        <Lettering label="SPEED STACKS" x={340} y={165} width={120} height={10}/>
      </> : <>
        <Lettering label="SPEED STACKS" x={337} y={137} width={126} height={9}/>
        <Lettering label="STACKMAT" x={320} y={152} width={160} height={16}/>
      </>}
    </>}
    {!g4 && <path d="M245 158Q400 243 555 158" stroke="#080c0e" strokeWidth="2"/>}
  </svg>;
});
export default StackmatLegacyArtwork;
