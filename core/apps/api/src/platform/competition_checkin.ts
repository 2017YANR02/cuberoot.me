import { COMPETITION_CHECK_IN_LEAD_MS } from '@cuberoot/shared/timer';

export function competitionCheckInWindow(alias: string) {
  return `(${alias}.starts_at - ${COMPETITION_CHECK_IN_LEAD_MS} * INTERVAL '1 millisecond' <= clock_timestamp()
    AND clock_timestamp() < ${alias}.ends_at)`;
}

// These predicates assume the competition table has alias c.
export const NO_PENDING_COMPETITION_REGISTRATIONS = `NOT EXISTS (
  SELECT 1 FROM platform_event_registrations hold WHERE hold.event_id=c.event_id
    AND hold.status='reserved' AND hold.reservation_expires_at>clock_timestamp()
)`;
export const COMPETITION_REGISTRATION_CLOSED =
  `(c.registration_closes_at<=clock_timestamp() AND ${NO_PENDING_COMPETITION_REGISTRATIONS})`;
