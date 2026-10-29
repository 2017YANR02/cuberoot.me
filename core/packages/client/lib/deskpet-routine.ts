/** Browser-local calendar only. Never infer a visitor's zone from the server. */
export function deskPetLocalPeriod(now: Date) {
  const hour = now.getHours();
  const instant = hour >= 23 || hour < 7;
  const eligible = hour >= 21 || hour < 7 || (hour >= 12 && hour < 14);
  if (!eligible) return { eligible: false, instant: false, key: null as string | null };
  // Before 07:00 belongs to the same local night that started the previous day.
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (hour < 7 ? 1 : 0));
  const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}:${hour >= 12 && hour < 14 ? 'noon' : 'night'}`;
  return { eligible, instant, key };
}

/** One mounted component session, retained across route/effect changes, never persisted. */
export function createDeskPetRoutineSession() {
  let initialized = false, pendingInitial = false;
  const attempted = new Set<string>(), dismissed = new Set<string>();
  return {
    get initialized() { return initialized; },
    get pendingInitial() { return pendingInitial; },
    initialize(now: Date) {
      if (initialized) return;
      initialized = true; pendingInitial = deskPetLocalPeriod(now).instant;
    },
    cancelInitial() { pendingInitial = false; },
    awake(now: Date) {
      pendingInitial = false;
      const key = deskPetLocalPeriod(now).key;
      if (key) dismissed.add(key);
    },
    started(now: Date) {
      pendingInitial = false;
      const key = deskPetLocalPeriod(now).key;
      if (key) attempted.add(key);
    },
    decide(now: Date, mode: string, automatic: boolean, idle: boolean) {
      const period = deskPetLocalPeriod(now);
      if (automatic && (mode === 'drowsy' || mode === 'falling') && !period.eligible) return 'wake' as const;
      if (mode !== 'off' || !idle) return null;
      if (pendingInitial) return 'asleep' as const;
      if (period.key && !attempted.has(period.key) && !dismissed.has(period.key)) return 'drowsy' as const;
      return null;
    },
  };
}
