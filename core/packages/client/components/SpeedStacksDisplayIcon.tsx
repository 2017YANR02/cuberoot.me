import { forwardRef, useId } from 'react';
import { DIGITS, SEGMENTS } from './seven-segment-paths';
import type { LucideProps } from '@app-foundation/icons/lucide';

// Homepage artwork value; deliberately independent of live WCA data.
// Change this string when the displayed result should be updated.
export const RESULTS_DISPLAY_TIME = '2.516';

// Outlined lettering: approximate the italic wordmark in the supplied photo.
// No external font or raster dependency.
const WORDMARK = 'M1.66-11.37L11.77-12Q12.09-9.54 13.10-8.25Q14.74-6.16 17.79-6.16Q20.06-6.16 21.29-7.23Q22.52-8.30 22.52-9.70Q22.52-11.04 21.35-12.09Q20.18-13.15 15.91-14.09Q8.93-15.66 5.95-18.26Q2.95-20.86 2.95-24.89Q2.95-27.54 4.49-29.89Q6.02-32.25 9.11-33.60Q12.19-34.95 17.55-34.95Q24.14-34.95 27.60-32.50Q31.05-30.05 31.71-24.70L21.70-24.12Q21.30-26.44 20.03-27.49Q18.75-28.55 16.50-28.55Q14.65-28.55 13.71-27.76Q12.77-26.98 12.77-25.85Q12.77-25.03 13.55-24.37Q14.30-23.70 17.11-23.11Q24.07-21.61 27.08-20.07Q30.09-18.54 31.46-16.27Q32.84-13.99 32.84-11.18Q32.84-7.87 31.01-5.09Q29.18-2.30 25.90-0.86Q22.62 0.59 17.63 0.59Q8.86 0.59 5.48-2.79Q2.11-6.16 1.66-11.37M38.13 0L38.13-34.36L55.78-34.36Q61.55-34.36 64.42-31.62Q67.29-28.87 67.29-23.81Q67.29-18.61 64.16-15.68Q61.03-12.75 54.61-12.75L48.80-12.75L48.80 0L38.13 0M48.80-27.37L48.80-19.71L51.40-19.71Q54.47-19.71 55.71-20.78Q56.95-21.84 56.95-23.51Q56.95-25.12 55.88-26.25Q54.80-27.37 51.82-27.37L48.80-27.37M72.82 0L72.82-34.36L101.27-34.36L101.27-27.02L83.46-27.02L83.46-21.56L99.98-21.56L99.98-14.55L83.46-14.55L83.46-7.78L101.79-7.78L101.79 0L72.82 0M107.48 0L107.48-34.36L135.94-34.36L135.94-27.02L118.13-27.02L118.13-21.56L134.65-21.56L134.65-14.55L118.13-14.55L118.13-7.78L136.45-7.78L136.45 0L107.48 0M142.31 0L142.31-34.36L158.09-34.36Q162.75-34.36 165.62-33.09Q168.49-31.83 170.37-29.46Q172.24-27.09 173.09-23.95Q173.93-20.81 173.93-17.30Q173.93-11.79 172.68-8.75Q171.42-5.72 169.20-3.67Q166.97-1.62 164.41-0.94Q160.92 0 158.09 0L142.31 0M155.58-26.58L152.93-26.58L152.93-7.80L155.53-7.80Q158.86-7.80 160.27-8.54Q161.67-9.28 162.47-11.12Q163.27-12.96 163.27-17.09Q163.27-22.55 161.48-24.56Q159.70-26.58 155.58-26.58M193.66-11.37L203.77-12Q204.09-9.54 205.10-8.25Q206.74-6.16 209.79-6.16Q212.06-6.16 213.29-7.23Q214.52-8.30 214.52-9.70Q214.52-11.04 213.35-12.09Q212.18-13.15 207.91-14.09Q200.93-15.66 197.95-18.26Q194.95-20.86 194.95-24.89Q194.95-27.54 196.49-29.89Q198.02-32.25 201.11-33.60Q204.19-34.95 209.55-34.95Q216.14-34.95 219.60-32.50Q223.05-30.05 223.71-24.70L213.70-24.12Q213.30-26.44 212.03-27.49Q210.75-28.55 208.50-28.55Q206.65-28.55 205.71-27.76Q204.77-26.98 204.77-25.85Q204.77-25.03 205.55-24.37Q206.30-23.70 209.11-23.11Q216.07-21.61 219.08-20.07Q222.09-18.54 223.46-16.27Q224.84-13.99 224.84-11.18Q224.84-7.87 223.01-5.09Q221.18-2.30 217.90-0.86Q214.62 0.59 209.63 0.59Q200.86 0.59 197.48-2.79Q194.11-6.16 193.66-11.37M227.77-25.87L227.77-34.36L260.04-34.36L260.04-25.87L249.21-25.87L249.21 0L238.59 0L238.59-25.87L227.77-25.87M287.67 0L285.98-5.67L273.89-5.67L272.23 0L261.38 0L274.29-34.36L285.87-34.36L298.78 0L287.67 0M276.19-13.10L283.76-13.10L279.96-25.45L276.19-13.10M325.05-14.04L334.36-11.23Q333.42-7.31 331.41-4.69Q329.39-2.06 326.40-0.73Q323.41 0.61 318.80 0.61Q313.20 0.61 309.64-1.02Q306.09-2.65 303.52-6.75Q300.94-10.85 300.94-17.25Q300.94-25.78 305.47-30.36Q310.01-34.95 318.30-34.95Q324.80-34.95 328.51-32.32Q332.23-29.70 334.03-24.26L324.66-22.17Q324.16-23.74 323.63-24.47Q322.73-25.69 321.45-26.34Q320.16-27 318.56-27Q314.95-27 313.03-24.09Q311.58-21.94 311.58-17.32Q311.58-11.60 313.31-9.48Q315.05-7.36 318.19-7.36Q321.23-7.36 322.79-9.07Q324.35-10.78 325.05-14.04M339.56 0L339.56-34.36L350.18-34.36L350.18-21.37L361.31-34.36L375.42-34.36L362.91-21.40L375.98 0L362.91 0L355.66-14.13L350.18-8.39L350.18 0L339.56 0M377.65-11.37L387.75-12Q388.08-9.54 389.09-8.25Q390.73-6.16 393.77-6.16Q396.05-6.16 397.28-7.23Q398.51-8.30 398.51-9.70Q398.51-11.04 397.34-12.09Q396.16-13.15 391.90-14.09Q384.91-15.66 381.94-18.26Q378.94-20.86 378.94-24.89Q378.94-27.54 380.47-29.89Q382.01-32.25 385.09-33.60Q388.17-34.95 393.54-34.95Q400.13-34.95 403.58-32.50Q407.04-30.05 407.70-24.70L397.69-24.12Q397.29-26.44 396.01-27.49Q394.73-28.55 392.48-28.55Q390.63-28.55 389.70-27.76Q388.76-26.98 388.76-25.85Q388.76-25.03 389.53-24.37Q390.28-23.70 393.09-23.11Q400.05-21.61 403.07-20.07Q406.08-18.54 407.45-16.27Q408.82-13.99 408.82-11.18Q408.82-7.87 406.99-5.09Q405.16-2.30 401.88-0.86Q398.60 0.59 393.61 0.59Q384.84 0.59 381.47-2.79Q378.09-6.16 377.65-11.37';

const OUTER_SHELL = 'M400 4C617 4 794 69 794 166C794 266 622 346 402 346C183 346 7 277 6 179C5 81 179 4 400 4Z';

const DISPLAY_FACE = 'M394 38C602 38 774 97 774 182C774 267 608 334 398 334C190 334 24 268 24 183C24 100 187 38 394 38Z';

type Props = LucideProps & { displayValue?: string; variant?: 'color' | 'outline'; digitColor?: string };

/** Frontal vector redraw of the blue-rimmed Speed Stacks tournament display. */
const SpeedStacksDisplayIcon = forwardRef<SVGSVGElement, Props>(function SpeedStacksDisplayIcon({
  size = 30, displayValue = RESULTS_DISPLAY_TIME, variant = 'color', strokeWidth = 1.5, digitColor,
  absoluteStrokeWidth: _absoluteStrokeWidth, ...props
}, ref) {
  const id = useId().replace(/:/g, '');
  const outline = variant === 'outline';
  const paint = (name: string) => `url(#${id}-${name})`;
  const characters = Array.from(displayValue);
  const advance = (character: string) => character === '.' || character === ':' ? 18 : 86;
  const totalWidth = characters.reduce((width, character) => width + advance(character), 0);
  const scale = Math.min(1, 474 / totalWidth);
  let cursor = 0;
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={outline ? '-14 -14 828 378' : '0 0 800 350'}
      width={typeof size === 'number' ? size * 800 / 350 : size} height={size}
      fill="none" aria-hidden="true" {...props}>
      {!outline && <defs>
        {/* Product/material colors stay faithful to the reference in either site theme. */}
        <linearGradient id={id + '-metal'} x1="400" y1="4" x2="400" y2="346" gradientUnits="userSpaceOnUse">
          <stop stopColor="#91b1cb"/><stop offset=".035" stopColor="#d4e2e8"/>
          <stop offset=".08" stopColor="#7693b0"/><stop offset=".19" stopColor="#3f597b"/>
          <stop offset=".5" stopColor="#182c48"/><stop offset="1" stopColor="#071122"/>
        </linearGradient>
        <radialGradient id={id + '-metal-light'} cx="470" cy="9" r="280"
          gradientUnits="userSpaceOnUse" gradientTransform="translate(0 3) scale(1 .65)">
          <stop stopColor="#f2faff"/><stop offset=".12" stopColor="#e4f4ff" stopOpacity=".95"/>
          <stop offset=".45" stopColor="#c0dfef" stopOpacity=".55"/>
          <stop offset="1" stopColor="#a7c6df" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={id + '-blue'} x1="200" y1="25" x2="570" y2="336" gradientUnits="userSpaceOnUse">
          <stop stopColor="#244d91"/><stop offset=".16" stopColor="#3769af"/>
          <stop offset=".35" stopColor="#193c7b"/><stop offset=".62" stopColor="#0c214a"/>
          <stop offset=".86" stopColor="#183b78"/><stop offset="1" stopColor="#254b87"/>
        </linearGradient>
        <radialGradient id={id + '-bevel'} cx="400" cy="183" r="386"
          gradientUnits="userSpaceOnUse" gradientTransform="translate(0 109.8) scale(1 .4)">
          <stop offset=".91" stopColor="#050d20" stopOpacity=".85"/>
          <stop offset=".95" stopColor="#0b234c" stopOpacity=".45"/>
          <stop offset=".98" stopColor="#547fbc" stopOpacity=".3"/>
          <stop offset="1" stopColor="#07172f" stopOpacity=".75"/>
        </radialGradient>
        <linearGradient id={id + '-recess'} x1="400" y1="34" x2="400" y2="336" gradientUnits="userSpaceOnUse">
          <stop stopColor="#020409"/><stop offset=".5" stopColor="#080d17"/>
          <stop offset="1" stopColor="#344054"/>
        </linearGradient>
        <linearGradient id={id + '-face'} x1="210" y1="35" x2="540" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="#101015"/><stop offset=".48" stopColor="#090a0e"/><stop offset="1" stopColor="#15171b"/>
        </linearGradient>
        <linearGradient id={id + '-silver'} x1="400" y1="266" x2="400" y2="295" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c6c8c9"/><stop offset="1" stopColor="#8e9195"/>
        </linearGradient>
        <filter id={id + '-glow'} x="-15%" y="-30%" width="130%" height="160%">
          <feGaussianBlur stdDeviation="2.2"/>
        </filter>
      </defs>}
      {outline ? <g data-part="housing" stroke="currentColor" strokeWidth={Number(strokeWidth) * 350 / 48} strokeLinejoin="round">
        <path d={OUTER_SHELL}/>
        <path d={DISPLAY_FACE}/>
      </g> : <g data-part="housing">
        <path d={OUTER_SHELL} fill={paint('metal')}/>
        <path d={OUTER_SHELL} fill={paint('metal-light')}/>
        {/* Offset front and rear contours expose the upper sidewall, rather than flat concentric rings. */}
        <path d="M393 23C606 23 788 87 788 181C788 275 615 346 398 346C181 346 9 277 9 182C9 89 181 23 393 23Z" fill={paint('blue')}/>
        <path d="M393 23C606 23 788 87 788 181C788 275 615 346 398 346C181 346 9 277 9 182C9 89 181 23 393 23Z" fill={paint('bevel')}/>
        <path d="M394 33C604 33 777 94 777 181C777 267 609 336 398 336C189 336 21 269 21 182C21 97 185 33 394 33Z" fill={paint('recess')}/>
        <path d={DISPLAY_FACE} fill={paint('face')}/>
      </g>}
      <g data-part="digits" transform={`translate(${704 - totalWidth * scale} 122) scale(${scale} 1) skewX(-8)`} fill={digitColor ?? (outline ? 'currentColor' : '#ff172b')}>
        {characters.map((character, index) => {
          const x = cursor;
          cursor += advance(character);
          const d = Array.from(DIGITS[character] ?? '').map((segment) => SEGMENTS[segment]).join(' ');
          return <g key={index} transform={`translate(${x} 0)`}>
            {character === '.' ? <circle cx="3" cy="109" r="4"/> : character === ':' ? <><circle cx="3" cy="35" r="4"/><circle cx="3" cy="80" r="4"/></> : character === '+' ? <path d="M27 30H39V51H60V63H39V84H27V63H6V51H27Z"/> : character === '-' ? <path d={SEGMENTS.g}/> : <>
              {!outline && <path d={d} filter={paint('glow')} opacity=".6"/>}
              <path d={d}/>
            </>}
          </g>;
        })}
      </g>
      <g data-part="wordmark">
        <path d="M172 268H207L204 273H169ZM166 277H202L199 282H163ZM160 286H197L194 291H157Z" fill={outline ? 'currentColor' : '#948d40'}/>
        <path d={WORDMARK} transform="translate(202 292) scale(1.0659 0.7875) skewX(-15)" fill={outline ? 'currentColor' : paint('silver')}/>
        <circle cx="650" cy="274" r="4" stroke={outline ? 'currentColor' : '#979a9d'} strokeWidth="1"/>
        <path d="M648.5 276V272H650Q652 272 651 274H648.5M650 274 651.5 276" stroke={outline ? 'currentColor' : '#979a9d'} strokeWidth=".7"/>
      </g>
    </svg>
  );
});

export default SpeedStacksDisplayIcon;

/** Homepage variant shares the same editable digits and artwork with the color version. */
export const SpeedStacksOutlineIcon = forwardRef<SVGSVGElement, LucideProps>(function SpeedStacksOutlineIcon(props, ref) {
  return <SpeedStacksDisplayIcon {...props} ref={ref} variant="outline"/>;
});
