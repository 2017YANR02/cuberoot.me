import { IconMarkup } from './IconMarkup';
import { EVENT_SVG_BY_KEY } from './svg-map-event';
import './EventIcon.css';

export interface EventIconProps {
  /** Exact WCA event id, for example `333`, or an `event-333` icon key. */
  event: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function EventIcon({ event, className, title, ariaLabel }: EventIconProps) {
  const icon = event.startsWith('event-') ? event : `event-${event}`;
  return (
    <IconMarkup
      ariaLabel={ariaLabel ?? event.replace(/^event-/, '')}
      className={className}
      icon={icon}
      svg={EVENT_SVG_BY_KEY[icon]}
      title={title}
    />
  );
}
