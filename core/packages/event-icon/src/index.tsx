/** Inline SVG renderer for cubing/icons and CubeRoot structural puzzle artwork. */
import { IconMarkup } from './IconMarkup';
import { EVENT_SVG_BY_KEY } from './svg-map-event';
import { UNOFFICIAL_SVG_BY_KEY } from './svg-map-unofficial';
import { PUZZLE_SVG_BY_KEY } from './svg-map-puzzle';
import './EventIcon.css';

export interface CubingIconProps {
  /** cubing/icons key, for example `event-333` or `unofficial-fto`. */
  icon: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function CubingIcon({ icon, className, title, ariaLabel }: CubingIconProps) {
  const svg = EVENT_SVG_BY_KEY[icon] ?? UNOFFICIAL_SVG_BY_KEY[icon] ?? PUZZLE_SVG_BY_KEY[icon];
  return <IconMarkup ariaLabel={ariaLabel ?? icon} className={className} icon={icon} svg={svg} title={title} />;
}
