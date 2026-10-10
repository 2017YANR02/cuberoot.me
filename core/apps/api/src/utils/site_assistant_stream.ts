/** Native tools carry planning separately. Read only the final answer field.
 * Incomplete JSON escapes (including surrogate pairs) wait for the next chunk. */
export function partialAssistantAnswer(json: string): string | undefined {
  const prefix = /^\s*\{\s*"answer"\s*:\s*"/.exec(json);
  if (!prefix) return;
  let value = '';
  for (let i = prefix[0].length; i < json.length; i++) {
    const char = json[i];
    if (char === '"') break;
    if (char !== '\\') { value += char; continue; }
    const escape = json[++i];
    if (!escape) break;
    if (escape === 'u') {
      const hex = json.slice(i + 1, i + 5);
      if (!/^[\da-f]{4}$/i.test(hex)) break;
      value += String.fromCharCode(parseInt(hex, 16)); i += 4;
    } else {
      const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
      if (!(escape in escapes)) break;
      value += escapes[escape];
    }
  }
  return value.replace(/[\uD800-\uDBFF]$/, '');
}
