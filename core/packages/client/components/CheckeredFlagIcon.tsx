import { createLucideIcon } from 'lucide-react';

/** Classic checkered flag, matching the approved A preview. */
const CheckeredFlagIcon = createLucideIcon('CheckeredFlag', [
  ['path', { d: 'M5 22V3M5 4h15v12H5', key: 'outline' }],
  ['path', {
    d: 'M5 4h5v4H5zm10 0h5v4h-5zm-5 4h5v4h-5zm-5 4h5v4H5zm10 0h5v4h-5z',
    fill: 'currentColor',
    stroke: 'none',
    key: 'checks',
  }],
]);

export default CheckeredFlagIcon;
