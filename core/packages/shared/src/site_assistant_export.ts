import { assistantAlgorithmsText, isAssistantSourceHref, SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH, type AssistantAnswer, type AssistantArtifact } from './site_assistant';
import { formatWcaResult } from './wca_format_result';

function assistantArtifactText(a: AssistantArtifact, origin: string, context = false): string {
  if (a.kind === 'algorithms') return context ? assistantAlgorithmsText(a) : [a.title, ...a.cards.map(c=>a.display==='image' ? c.name : `${c.name}\n${c.alg}`)].join('\n\n');
  if (a.kind === 'table') return [a.title,
    ...(context ? ['[UI row is the 1-based position in this displayed table, not a performance rank. An unqualified ordinal such as "the second person" refers to this table order, unless the user explicitly refers to a ranking in the prose.]'] : []),
    [...(context ? ['UI row'] : []), ...a.columns].join('\t'), ...a.rows.map((row, index) => {
    const cells = row.map((cell, column) => {
      const href = a.cellLinks?.[index]?.[column] ?? (column === 0 ? a.links?.[index] : undefined);
      return context && href && isAssistantSourceHref(href) ? `${cell} (${href})` : cell;
    });
    return [...(context ? [String(index + 1)] : []), ...cells].join('\t');
  })].join('\n');
  if (a.kind === 'cube-photo') return [a.title, a.status === 'partial' ? 'The complete state is ambiguous; displayed algorithms work for every compatible state.' : a.status === 'corners-only' ? 'Only last-layer corners are known; edges and the M slice are not reconstructed.' : 'Assumes solved F2L and standard colors. Each algorithm is independent and includes AUF.',
    ...(a.recognition?.status === 'ok' || a.recognition?.status === 'corners-only' ? [(['U','F','R'] as const).map(face => `${face}: ${(a.recognition!.candidates[0] ?? a.recognition!.cornerCandidates![0]).frame[face]}`).join(' · ')] : [a.status]),
    ...a.results.map(r => r.match ? `${r.set.toUpperCase()} · [${r.match.name}](${new URL(r.match.href, origin).href})\n${r.match.alg}` : `${r.set.toUpperCase()}: ${r.status}`)].join('\n');
  return [a.title, ...a.points.map(p => [p.date, formatWcaResult(p.value, a.event, a.metric), ...(context ? [p.person, p.label] : [])].join('\t'))].join('\n');
}

/** Export a single answer, including its citations and structured results. */
export function assistantAnswerText(result: AssistantAnswer, origin: string) {
  const text = result.answer.replace(/\[\[([^\]\n]+)\]\]/g, (_marker, id: string) => {
    const source = result.sources.find(s => s.id === id && isAssistantSourceHref(s.href));
    return source ? `[${source.title}](${new URL(source.href, origin).href})` : '';
  });
  const tables = (result.artifacts ?? []).map(a => assistantArtifactText(a, origin));
  return [text, ...tables].join('\n\n');
}

/** Preserve what the visitor actually saw so "the second person" has a subject. */
export function assistantAnswerHistory(result: AssistantAnswer, origin: string): string {
  const omitted = '\n[Earlier answer context truncated; omitted rows are unavailable.]';
  const bounded = (text: string, limit: number) => text.length <= limit ? text : text.slice(0, limit - omitted.length) + omitted;
  const destinations = [...new Map([...result.sources, ...(result.actions ?? [])]
    .filter(source => isAssistantSourceHref(source.href))
    .map(source => [source.href, `${source.title} (${source.href})`])).values()];
  const hasContext = !!result.artifacts?.length || destinations.length > 0;
  const text = assistantAnswerText({...result, artifacts: []}, origin);
  if (!hasContext) return bounded(text, SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH);
  const header = '[Previous displayed answer and results, for conversation context only; reverify facts with tools.]';
  const context = [
    destinations.length ? 'Referenced destinations:\n' + bounded(destinations.join('\n'), 2000) : '',
    ...(result.artifacts ?? []).map(a => assistantArtifactText(a, origin, true)),
  ].filter(Boolean).join('\n\n');
  // Preserve full prose whenever it fits. Only share the budget when tables or
  // charts would otherwise disappear behind a maximum-length earlier answer.
  const textBudget = Math.max(4000, SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH - header.length - context.length - 4);
  return bounded([
    header, bounded(text, textBudget), context,
  ].filter(Boolean).join('\n\n'), SITE_ASSISTANT_HISTORY_MESSAGE_MAX_LENGTH);
}

export function assistantSpokenText(text: string) {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>|]/g, '').trim();
}
