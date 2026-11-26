import { contradictsMechanicsProof } from './site_assistant_mechanics.js';
import { scenarioRequestedParts } from './site_assistant_policy.js';

// A checklist is request-local. Quoted examples and previous questions are not tasks.
export function assistantAnswerRequirements(question: string): string[] {
  // Numbered reproduction steps and observed behaviour describe the incident.
  // Keep the title, expected outcome and any subsequent request sections.
  let incidentContext = false;
  const text = question.split(/\r?\n/).filter(line => {
    const heading = /^#{1,6}\s+(.+)$/.exec(line.trim());
    if (heading) {
      incidentContext = /^(?:steps to reproduce(?: the issue)?|observed behavio[u]?r|actual \(problem\) behavio[u]?r)$/i.test(heading[1].trim());
      return !incidentContext;
    }
    return !incidentContext || /[?？]|^\s*(?:\d+[.)]\s*)?(?:(?:please|also|can you|could you|explain|compare|identify|list|provide|tell me|give me)\b|请|另外)/i.test(line);
  }).join('\n')
    .replace(/```[\s\S]*?```|`[^`\n]*`|“[^”]*”|「[^」]*」|"[^"\n]*"/gu, '…');
  const markers = [...text.matchAll(/(?:^|[\s。！？?!；;：:])[(（]?(\d{1,2})[)）、]|(?:^|\n)\s*(\d{1,2})\.\s+/gu)];
  if (markers.length >= 2 && markers.every((m, i) => Number(m[1] ?? m[2]) === i + 1)) {
    const items = markers.map((m, i) => text.slice(m.index + m[0].length, markers[i + 1]?.index).trim());
    if (items.every(Boolean) && items.length <= 12) return items;
  }
  const parts = text.split(/(?<=[?？!！。；;])\s*|(?<=\.)\s+(?=[A-Z])|\n+/u).flatMap(sentence => {
    if (/^(?:请)?(?:用|以|按照|按).{0,20}(?:格式|输出|回答|列出)|^(?:please )?(?:cite|format|respond|answer in|use (?:a table|json))\b/i.test(sentence.trim())) return [];
    // Background prose can contain "I can" or "when I look" without
    // assigning another task. Keep direct questions and explicit requests.
    if (/^(?:I |my |the |we )/i.test(sentence.trim()) && /\.\s*$/.test(sentence)
      && !/\b(?:please|tell|give|explain|compare|include|list|show|suggest|describe|provide|say|need|want|wonder|question|ask|expect|require|must|should|shall|would like|can you|could you)\b/i.test(sentence)) return [];
    // A dotted abbreviation inside parentheses is not a sentence break.
    const requestWords = sentence.replace(/,?\s+which must(?: not)?\b(?:(?!\band (?:you|I|please)\b)[^,.;?!])*/gi, '');
    const clause = sentence.replace(/\((?:i\.e\.|e\.g\.)\s*([^()?]+)\)/gi, '($1)');
    if (/^(?:sometimes\b|what I mean by (?:that|this)|no matter which|I(?:'ve| have) (?:recently |just )?(?:bought|turned))/i.test(clause.trim())
      && !/[?？]|\b(?:please|tell me|can you|could you|I want to know)\b/i.test(clause)) return [];
    // Community posts mix a title, the actual ask and explanatory prose.
    // Keep imperatives and indirect requests, but a declarative example
    // containing "when"/"can"/"would" creates no additional obligation.
    if (/^[\s\d"'(]*[a-z]/i.test(clause) && !/[?？]/.test(clause) && !/[\p{Script=Han}]/u.test(clause)
      && !/^\s*(?:what|how|why|which|where|when (?:is|are|does|do|will)|can (?:you|I)|is (?:it|there))\b/i.test(clause)
      && !/\b(?:please|I (?:also )?(?:want|need|ask|wonder)|I(?:'m| am) (?:asking|wondering|looking for)|(?:would|I'd) (?:particularly )?like|must|make sure|be sure|include|provide|explain|give me|tell me)\b/i.test(requestWords)
      && !/(?:^|[:;]\s*|\band (?:then |also )?)(?:\s*(?:also|then|please)\s+)?\s*(?:find|show|describe|compare|calculate|derive|prove|define|demonstrate|construct|list|give|suggest|identify|check|determine|use|write|address|assess|evaluate|return|report|recommend|state|summarize|verify)\b/i.test(clause)) return [];
    const questions = scenarioRequestedParts(clause);
    // In "given X can ..., we would ..., but what about Y?" the first
    // two clauses are premises of one question, not separately owed answers.
    if (/^(?:assuming|considering|given)\b/i.test(sentence.trim()) && questions.length > 1
      && questions.slice(0,-1).every(part => /^(?:assuming|considering|given|we|I|it|the)\b/i.test(part)
        && !/\b(?:what|why|how|which|when|where|explain|compare|calculate|list|show|give|tell)\b/i.test(part))) {
      return [sentence.trim()];
    }
    if (questions.length) return questions;
    return /^(?:另外|同时|再|请|给出|列出|解释|比较|说明|计算|(?:also |then |please )?(?:give|list|explain|compare|calculate|suggest|include|describe)\b)/i.test(sentence.trim()) ? [sentence.trim()] : [];
  });
  return parts.length >= 2 && parts.length <= 12 ? parts : [];
}

const marker = /\[\[([^\]\n]+)\]\]/g;
const clean = (s: string) => s.replace(marker, '').replace(/[\s\p{P}*]+/gu, '').toLowerCase();

// Accept ordered answer sections or private verbatim excerpts when the visitor
// asks for prose/table formatting. Never accept a repeated quote or an echoed ask.
export function missingAssistantRequirements(items: string[], answer: string, excerpts?: string[]) {
  if (!items.length) return [];
  const headings = [...answer.matchAll(/(?:^|\n)\s*(?:\*\*)?[(（]?(\d{1,2})[.、)）]\s*/gu)];
  const numbered = headings.length > 0 && headings.every((m,i) =>
    Number(m[1]) >= 1 && Number(m[1]) <= items.length && (!i || Number(m[1]) > Number(headings[i-1][1])));
  const seen = new Set<string>();
  // An ordinary sentence can already supply an identifiable answer, including
  // a scoped gap. Require a distinct subject shared with this request only.
  const words = (s: string): string[] => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const stop = /^(?:the|and|from|that|are|there|were|was|when|what|does|how|many|which|would|could|why|for|with|into|this|their|should|give|please|also|explain|example|say)$/;
  const subjects = items.map(item => words(item).filter(w => !stop.test(w)));
  const sentences = answer.split(/(?<=[。！？!?；;])|(?<=\.)\s+|\n+/u).map(s => s.trim()).filter(Boolean);
  return items.flatMap((item, i) => {
    const position = numbered ? headings.findIndex(m => Number(m[1]) === i + 1) : -1;
    const excerpt = position >= 0
      ? answer.slice(headings[position].index + headings[position][0].length, headings[position+1]?.index).trim()
      : excerpts?.[i]?.trim() ?? (!numbered ? sentences.find(s => !seen.has(clean(s))
        && (!/how many|how much/i.test(item) || /\d|unknown|unverified|not verified/i.test(s))
        && subjects[i].some(word => !subjects.some((list,j) => i!==j && list.includes(word)) && words(s).includes(word))) : undefined);
    const value = clean(excerpt ?? '');
    if (!excerpt || !answer.includes(excerpt) || !value || clean(item) === value || seen.has(value)) return [i + 1];
    seen.add(value);
    return [];
  });
}

/** The compact coaching prompt requests one answer line per item. Derive the
 * private coverage excerpts from those exact lines, without generating a copy
 * of every sentence. Malformed or ambiguous layouts use normal verification. */
export function coachingAnswerSections(answer:string,items:string[]):string[]|undefined {
  const lines=answer.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!items.length || lines.length!==items.length)return;
  const sections:string[]=[];
  for(const [index,line] of lines.entries()) {
    const heading=/^(\d{1,2})(?:[)）、]|\.\s+)\s*/u.exec(line);
    if(heading && Number(heading[1])!==index+1)return;
    const body=line.slice(heading?.[0].length ?? 0).trim();
    if(!body || body.length>300)return;
    sections.push(body);
  }
  if(!missingAssistantRequirements(items,sections.join('\n'),sections).length)return sections;
}

/** A succeeding numbered heading closes the previous item. Keep the current
 * item private until its boundary arrives or the complete answer passes review. */
export function createRequirementPreview(items: string[]) {
  let inspectedBoundary = -1;
  let accepted: string | undefined;
  return (draft: string) => {
    // Scan only the unfinished suffix. One provider delta can span several
    // lines or split the marker itself. A decimal on its own line is not a heading.
    const markers = /\n[ \t]*(?:\*\*)?[(（]?(\d{1,2})(?:\.(?=\s)|[、)）])/gu;
    markers.lastIndex = inspectedBoundary + 1;
    let heading: RegExpExecArray | null;
    let next: RegExpExecArray | undefined;
    while ((heading = markers.exec(draft))) next = heading;
    if (!next) return accepted;
    const count = Number(next[1]) - 1;
    const boundary = next.index;
    inspectedBoundary = boundary;
    if (count < 1 || count >= items.length) return accepted;
    const prefix = draft.slice(0, boundary).trimEnd();
    if (/(?:\[|\]\]|https?:\/\/|```)/iu.test(prefix)) return accepted;
    const headings = [...prefix.matchAll(/(?:^|\n)[ \t]*(?:\*\*)?[(（]?(\d{1,2})(?:\.(?=\s)|[、)）])/gu)];
    if (headings.length !== count || headings[0].index !== 0 || headings.some((h,i) => Number(h[1]) !== i + 1)) return accepted;
    if (!missingAssistantRequirements(items.slice(0,count),prefix).length) accepted = prefix;
    return accepted;
  };
}

type Evidence = { data: unknown };
type Readable = { read?: boolean };
type Passages = Map<string, string[]> & { glossaryTitles?: Map<string, Set<string>> };

// Bind only retained text fields with an explicit source identity. The first
// source of a tool result does not own every other row in that result.
export function assistantClaimPassages(evidence: Evidence[], sources: Map<string, Readable>): Passages {
  const passages: Passages = new Map();
  passages.glossaryTitles = new Map();
  for (const {data} of evidence) {
    if (!data || typeof data !== 'object' || ('notEvidence' in data && data.notEvidence)) continue;
    const record = data as Record<string, unknown>;
    for (const key of ['entries','pages','originals','rows','results','articles']) {
      const rows = record[key];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const id = row.sourceId ?? row.id;
        if (!sources.get(id)?.read) continue;
        if (key === 'entries' && typeof id === 'string' && id.startsWith('wiki:')) {
          const titles = [row.head, row.headZh, row.headEn].filter((s): s is string => typeof s === 'string' && !!s.trim());
          passages.glossaryTitles.set(id, new Set([...(passages.glossaryTitles.get(id) ?? []), ...titles]));
        }
        const values = [row.head, row.headZh, row.headEn, row.body, row.bodyZh, row.bodyEn, row.content, row.excerpt, row.passage, row.text]
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
        if (values.length) passages.set(id, [...(passages.get(id) ?? []), ...values]);
      }
    }
  }
  return passages;
}

export function assistantClaimIssue(answer: string, selected: string[], passages: Passages): string | undefined {
  if (!passages.size || !answer.includes('[[') && selected.length < 2) return;
  const inline = new Set([...answer.matchAll(marker)].map(m => m[1]));
  const used = new Set([...selected,...inline].filter(id => passages.has(id)));
  if (used.size > 1 && [...used].some(id => !inline.has(id))) return 'claim_missing_inline_source';
  // Each citation group belongs to the immediately preceding claim. A verbatim
  // quotation present only in another passage is positive evidence of a mix-up.
  for (const rawLine of answer.split('\n')) {
    // A pair of named entries can introduce a former/latter comparison. Verify
    // the titles against the two ensuing citations before checking their claims.
    const line = rawLine.replace(/(词条(?:有|包括|为))“([^”\n]+)”([（(][^()（）\n]{1,40}[）)])?(和|与)“([^”\n]+)”(?=[：:]前者)/gu,
      (list, intro, first, gloss, join, second, offset) => {
        const rest = rawLine.slice(offset + list.length);
        const pair = rest.match(/^[：:]前者[^\[\n]*\[\[([^\]\n]+)\]\][，,；;\s]*后者[^\[\n]*\[\[([^\]\n]+)\]\]/u);
        if (!pair || pair[1] === pair[2] || !passages.glossaryTitles?.get(pair[1])?.has(first)
          || !passages.glossaryTitles.get(pair[2])?.has(second)) return list;
        return intro + (gloss ?? '') + join;
      });
    let start = 0;
    for (const group of line.matchAll(/(?:\[\[[^\]\n]+\]\][ \t]*)+/g)) {
      const claim = line.slice(start, group.index).trim();
      start = group.index + group[0].length;
      const ids = [...group[0].matchAll(marker)].map(m => m[1]);
      if (!ids.every(id => passages.has(id))) continue;
      const cited = ids.flatMap(id => passages.get(id)!);
      const literals = [...claim.matchAll(/“([^”]{3,})”|"([^"\n]{3,})"|「([^」]{3,})」/gu)].map(m => m[1] ?? m[2] ?? m[3]);
      // Unquoted full terms and unit-bearing measurements can also distinguish
      // a source. A value absent everywhere is left to the semantic review.
      for (const fields of passages.values()) for (const field of fields) {
        if (field.length >= 8 && field.length <= 180 && claim.includes(field)) literals.push(field);
      }
      const measurements = /(?<![\d.])\d+(?:\.\d+)?\s*(?:%|秒|分钟|milliseconds?\b|seconds?\b)/giu;
      for (const value of claim.match(measurements) ?? []) {
        const containsValue = (field:string) => (field.match(measurements) ?? []).some(token =>
          token.toLowerCase().replace(/\s/g,'') === value.toLowerCase().replace(/\s/g,''));
        if (!cited.some(containsValue) && [...passages.values()].some(fields=>fields.some(containsValue))) return 'claim_wrong_source';
      }
      for (const literal of literals) {
        if (!cited.some(s => s.includes(literal)) && [...passages.values()].some(fields => fields.some(s => s.includes(literal)))) return 'claim_wrong_source';
      }
      if (ids.length > 1 && used.size > 1) {
        if (!claim) return 'claim_missing_inline_source';
        const parts = claim.split(/(?<=[。！？!?；;])|(?<=\.)\s+/u).filter(s => clean(s));
        // Joint evidence for one comparison is valid. Separate sentences with
        // different uniquely attributable facts need separate markers.
        const owners = new Set<string>();
        for (const part of parts) {
          const matches = ids.filter(id => passages.get(id)!.some(field =>
            field.length >= 8 && part.includes(field)));
          if (matches.length === 1) owners.add(matches[0]);
        }
        if (owners.size > 1) return 'claim_missing_inline_source';
      }
    }
  }
}

/** Build once per answer, then reuse for each repair of the same draft. */
export function createAssistantCoverageCheck(
  question: string, requirements: string[], passages: Passages, verifiedOpening: string | undefined,
) {
  const mixedMechanics = requirements.length > 1 && !requirements.every(item =>
    /(?:determin|reconstruct|deduc)/i.test(item) && /three (?:adjacent )?(?:sides|faces)/i.test(item));
  return (value: { answer: string; sourceIds: string[]; requirementChecks?: string[] }, items: string[]) => {
    const claimIssue = assistantClaimIssue(value.answer, value.sourceIds, passages);
    if (claimIssue) return claimIssue;
    if (verifiedOpening && mixedMechanics && contradictsMechanicsProof(question, value.answer)) return 'mechanics_proof_conflict';
    const missing = missingAssistantRequirements(items, value.answer, value.requirementChecks);
    if (missing.length) return 'request_items_missing:' + missing.join(',');
  };
}

// A later repair may fail. A complete, verbatim read passage for the first
// item can be published on its own without exposing the rest of the draft.
export function checkedPassageOpening(answer:string, firstItem:string, passages:Passages) {
  const line=answer.trimStart().split('\n',1)[0].trim();
  const match=/^(?:1[.)、]\s*)?(.{12,700}?)\s*\[\[([^\]\n]+)\]\]$/.exec(line);
  if (!match || !passages.get(match[2])?.some(text=>text.trim()===match[1].trim())) return;
  const words=firstItem.toLowerCase().match(/[a-z]{4,}|[\p{Script=Han}]{2}/gu) ?? [];
  if (!words.some(w=>!/^(?:what|when|where|which|first|does|have|about|please|如何|什么|请问)$/.test(w) && match[1].toLowerCase().includes(w))) return;
  return {answer:line,id:match[2]};
}
