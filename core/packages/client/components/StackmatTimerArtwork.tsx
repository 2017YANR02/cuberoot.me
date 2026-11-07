import { forwardRef, type SVGProps } from 'react';
import StackmatG5Artwork from './StackmatG5Artwork';
import StackmatLegacyArtwork from './StackmatLegacyArtwork';
import type { StackmatGeneration, StackmatG5Skin } from './stackmat-catalog';

type Props = SVGProps<SVGSVGElement> & {
  generation: StackmatGeneration; skin?: StackmatG5Skin; size?: number; displayValue?: string;
  digitColor?: string; padMode?: '2-pad' | '4-pad'; indicator?: 'idle' | 'holding' | 'ready';
};
const StackmatTimerArtwork = forwardRef<SVGSVGElement, Props>(function StackmatTimerArtwork({
  generation, skin, padMode, indicator, ...props
}, ref) {
  return generation === 5
    ? <StackmatG5Artwork ref={ref} skin={skin} padMode={padMode} indicator={indicator} {...props}/>
    : <StackmatLegacyArtwork ref={ref} generation={generation} indicator={indicator} {...props}/>;
});
export default StackmatTimerArtwork;
