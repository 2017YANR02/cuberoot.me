const answerPrefix = /^\s*\{\s*(?:"answerKind"\s*:\s*"(?:general|site_content|grounded|image)"\s*,\s*)?"answer"\s*:\s*"/;
const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };

/** One append-only provider response per reader. Never expose fields after answer. */
export function createPartialAnswerReader() {
  let offset = 0;
  let value = '';
  let ended = false;
  return (json: string): string | undefined => {
    if (!offset) {
      const match = answerPrefix.exec(json);
      if (!match) return;
      offset = match[0].length;
    }
    while (!ended && offset < json.length) {
      const char = json[offset];
      if (char === '"') { ended = true; break; }
      if (char !== '\\') { value += char; offset++; continue; }
      const escape = json[offset + 1];
      if (escape === 'u') {
        const hex = json.slice(offset + 2, offset + 6);
        if (!/^[\da-f]{4}$/i.test(hex)) break;
        value += String.fromCharCode(parseInt(hex, 16));
        offset += 6;
      } else {
        if (!escape || !(escape in escapes)) break;
        value += escapes[escape];
        offset += 2;
      }
    }
    const last = value.charCodeAt(value.length - 1);
    return last >= 0xd800 && last <= 0xdbff ? value.slice(0, -1) : value;
  };
}

export function partialAssistantAnswer(json: string) {
  return createPartialAnswerReader()(json);
}

/** Metadata precedes prose so an ungrounded site draft is held before display. */
export function partialAssistantAnswerKind(json: string): 'general'|'site_content'|'grounded'|'image'|undefined {
  const match=/^\s*\{\s*"answerKind"\s*:\s*"(general|site_content|grounded|image)"\s*[,}]/.exec(json);
  return match?.[1] as ReturnType<typeof partialAssistantAnswerKind>;
}
