/** Parse a decimal major-unit amount without floating-point rounding. */
export function platformMajorToMinor(value: string): number | null {
  const text=value.trim();
  if(!text)return null;
  if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error('Enter a non-negative amount with at most two decimal places.');
  const [whole,fraction='']=text.split('.');
  const minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(minor))throw new Error('Amount exceeds the supported range.');
  return minor;
}
export function platformMinorToMajor(value: unknown): string {
  if(value==null||value==='')return '';
  const number=Number(value);
  return Number.isSafeInteger(number)?(number/100).toFixed(2):'';
}
export function platformLocalDateTime(value: unknown): string {
  if(!value)return '';
  const date=new Date(String(value));
  if(!Number.isFinite(date.getTime()))return '';
  const pad=(part:number)=>String(part).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
