import { FM_REGULAR, stickeringMaskFn, type StickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';

/** Keep all six centers at full color in this chapter's teaching diagrams. */
export function withBrightCenters(mask: StickeringMaskFn | null): StickeringMaskFn {
  return (piece, face) => engineHomeSid(piece, face, 3).slice(1) === '4'
    ? FM_REGULAR : mask?.(piece, face) ?? FM_REGULAR;
}

export const crossMask = withBrightCenters(stickeringMaskFn(3, 'Cross'));
export const crossStickering = () => crossMask;
const daisyMask = withBrightCenters(stickeringMaskFn(3, 'Daisy'));
export const crossDaisyStickering = () => daisyMask;
