const beijingDateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function competitionDateTime(value: string) {
  return Number.isFinite(Date.parse(value)) ? beijingDateTime.format(new Date(value)) : '—';
}

export function competitionDateInput(value: string) {
  return value ? competitionDateTime(value).replace(' ', 'T') : '';
}

export function competitionDateIso(input: string) {
  return new Date(input + ':00+08:00').toISOString();
}
