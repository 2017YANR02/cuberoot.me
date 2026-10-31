/** Group in the viewer's local calendar, matching the displayed dates. */
export function startsChatTimeGroup(current: string, previous?: string): boolean {
  if (!previous) return true;
  const now = new Date(current);
  const before = new Date(previous);
  return now.getTime() - before.getTime() >= 5 * 60 * 1000
    || now.getFullYear() !== before.getFullYear()
    || now.getMonth() !== before.getMonth()
    || now.getDate() !== before.getDate();
}
