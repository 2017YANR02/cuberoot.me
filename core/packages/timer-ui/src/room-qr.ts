import { renderSVG } from 'uqr';

export function timerRoomQrSvg(url: string): string {
  return renderSVG(url, { border: 2, ecc: 'M', blackColor: '#111', whiteColor: '#fff' });
}
