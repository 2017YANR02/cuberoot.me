/** Linear trailing delimiter removal, including arbitrarily long delimiter runs. */
export function trimTrailingCharacter(value: string, character: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === character) end--;
  return value.slice(0, end);
}
