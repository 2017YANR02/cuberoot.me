/** Report completed work units, without repeating small or unchanged percentages. */
export function taskProgress(task: string, total: number): (completed: number) => void {
  let last = -1;
  return completed => {
    const percent = total > 0 ? Math.min(100, Math.floor(100 * completed / total)) : 100;
    if (percent <= last || (percent < 100 && last >= 0 && percent - last < 10)) return;
    last = percent;
    console.log(`[进度] ${task} ${percent}% (${completed}/${total})`);
  };
}
