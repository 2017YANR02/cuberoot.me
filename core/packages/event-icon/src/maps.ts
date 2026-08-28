import { EVENT_SVG_BY_KEY } from './svg-map-event';
import { UNOFFICIAL_SVG_BY_KEY } from './svg-map-unofficial';

export const SVG_BY_KEY: Record<string, string> = {
  ...EVENT_SVG_BY_KEY,
  ...UNOFFICIAL_SVG_BY_KEY,
};
export { PENALTY_SVG_BY_KEY } from './svg-map-penalty';
