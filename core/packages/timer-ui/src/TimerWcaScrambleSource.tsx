'use client';

import { EventIcon } from '@cuberoot/event-icon/event';
import { timerWcaScrambleSourceLine } from '@cuberoot/shared/timer';
import type { MouseEvent, ReactNode } from 'react';
import { Flag } from './CountryFlag';

export interface TimerWcaScrambleSourceProps {
  children?: ReactNode;
  competitionName: string;
  country?: string;
  eventLabel: string;
  eventId: string;
  groupId: string;
  href: string;
  isExtra?: boolean;
  onNavigate?: () => void;
  roundTypeId: string;
  scrambleNumber: number;
  title: string;
}

/** Canonical WCA provenance row shared by Web and every installed client. */
export function TimerWcaScrambleSource({
  children,
  competitionName,
  country,
  eventLabel,
  eventId,
  groupId,
  href,
  isExtra = false,
  onNavigate,
  roundTypeId,
  scrambleNumber,
  title,
}: TimerWcaScrambleSourceProps) {
  const sourceLine = timerWcaScrambleSourceLine(
    roundTypeId,
    groupId,
    scrambleNumber,
    isExtra,
  );
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate();
  };

  return (
    <div
      className="scramble-src-row"
      data-no-timer
      onClick={(event) => event.stopPropagation()}
    >
      <a
        aria-label={`${title}: ${competitionName}, ${eventLabel}, ${sourceLine}`}
        className="scramble-src timer-scramble-source-meta"
        data-no-timer
        href={href}
        onClick={navigate}
        title={title}
      >
        {country && (
          <span aria-hidden="true" className="scramble-src-flag">
            <Flag
              imgClassName="country-flag-ct"
              iso2={country}
              spanClassName="country-flag"
            />
          </span>
        )}
        <span className="scramble-src-name">{competitionName}</span>
        <span aria-hidden="true" className="scramble-src-event">
          <EventIcon
            className="scramble-src-evt"
            event={eventId}
          />
        </span>
        <span className="scramble-src-meta">
          {sourceLine}
        </span>
      </a>
      {children}
    </div>
  );
}
