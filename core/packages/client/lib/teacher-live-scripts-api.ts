import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import type { DirectoryEntryKind } from './teacher-directory-api';

export type LiveScriptCueKind = 'action' | 'interaction' | 'transition' | 'optional';
export interface LocalizedScriptText { zh: string; en: string }
export type LiveScriptBeat =
  | { kind: 'say'; text: LocalizedScriptText }
  | { kind: 'cue'; cue: LiveScriptCueKind; text: LocalizedScriptText };
export interface LiveScriptSection {
  id: string;
  title: LocalizedScriptText;
  duration: LocalizedScriptText;
  goal: LocalizedScriptText;
  beats: LiveScriptBeat[];
}
export interface LiveScriptLink { href: string; label: LocalizedScriptText }
export interface LiveScriptContent {
  preparation: LocalizedScriptText[];
  sections: LiveScriptSection[];
  notes: LocalizedScriptText[];
  referenceLinks: LiveScriptLink[];
}
export interface LiveScriptAuthor {
  id: number;
  kind: DirectoryEntryKind;
  nameZh: string;
  nameEn: string;
  isVisible: boolean;
}
export interface TeacherLiveScript {
  id: number;
  teacherEntryId: number;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  durationMinutes: number;
  content: LiveScriptContent;
  isVisible: boolean;
  teacher: LiveScriptAuthor;
  ownerKey?: string;
  createdAt: string;
  updatedAt: string;
}
export interface TeacherLiveScriptDraft {
  teacherEntryId: number;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  durationMinutes: number;
  content: LiveScriptContent;
  isVisible: boolean;
}

const CUE_KINDS = new Set<LiveScriptCueKind>(['action', 'interaction', 'transition', 'optional']);
const text = (value: unknown): LocalizedScriptText => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { zh: typeof source.zh === 'string' ? source.zh : '', en: typeof source.en === 'string' ? source.en : '' };
};

export function normalizeLiveScriptContent(value: unknown): LiveScriptContent {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const preparation = Array.isArray(source.preparation) ? source.preparation.map(text) : [];
  const notes = Array.isArray(source.notes) ? source.notes.map(text) : [];
  const referenceLinks = Array.isArray(source.referenceLinks) ? source.referenceLinks.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const link = item as Record<string, unknown>;
    return typeof link.href === 'string' ? [{ href: link.href, label: text(link.label) }] : [];
  }) : [];
  const sections = Array.isArray(source.sections) ? source.sections.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const section = item as Record<string, unknown>;
    const beats: LiveScriptBeat[] = [];
    if (Array.isArray(section.beats)) {
      for (const beatItem of section.beats) {
        if (!beatItem || typeof beatItem !== 'object') continue;
        const beat = beatItem as Record<string, unknown>;
        const beatText = text(beat.text);
        if (beat.kind === 'cue') {
          const cue = CUE_KINDS.has(beat.cue as LiveScriptCueKind) ? beat.cue as LiveScriptCueKind : 'action';
          beats.push({ kind: 'cue', cue, text: beatText });
        } else {
          beats.push({ kind: 'say', text: beatText });
        }
      }
    }
    return [{
      id: typeof section.id === 'string' && section.id ? section.id : `section-${index + 1}`,
      title: text(section.title),
      duration: text(section.duration),
      goal: text(section.goal),
      beats,
    }];
  }) : [];
  return { preparation, sections, notes, referenceLinks };
}

type LiveScriptWire = Omit<TeacherLiveScript, 'content'> & { content?: unknown };
function normalizeLiveScript(script: LiveScriptWire): TeacherLiveScript {
  return { ...script, content: normalizeLiveScriptContent(script.content) };
}

export async function fetchTeacherLiveScripts(): Promise<TeacherLiveScript[]> {
  const data = await handleApi<{ scripts: LiveScriptWire[] }>(await fetch(apiUrl('/v1/teachers/scripts?v=1')));
  return data.scripts.map(normalizeLiveScript);
}

export async function fetchMyTeacherLiveScripts(): Promise<TeacherLiveScript[]> {
  const data = await handleApi<{ scripts: LiveScriptWire[] }>(await fetch(apiUrl('/v1/teachers/scripts/mine'), { headers: authHeaders(false) }));
  return data.scripts.map(normalizeLiveScript);
}

export async function fetchTeacherLiveScript(id: number): Promise<TeacherLiveScript> {
  try {
    const data = await handleApi<{ script: LiveScriptWire }>(await fetch(apiUrl(`/v1/teachers/scripts/${id}?v=1`)));
    return normalizeLiveScript(data.script);
  } catch (publicError) {
    try {
      const data = await handleApi<{ script: LiveScriptWire }>(await fetch(apiUrl(`/v1/teachers/scripts/owned/${id}`), { headers: authHeaders(false) }));
      return normalizeLiveScript(data.script);
    } catch {
      throw publicError;
    }
  }
}

export async function createTeacherLiveScript(draft: TeacherLiveScriptDraft): Promise<TeacherLiveScript> {
  const data = await handleApi<{ script: LiveScriptWire }>(await fetch(apiUrl('/v1/teachers/scripts'), {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(draft),
  }));
  return normalizeLiveScript(data.script);
}

export async function updateTeacherLiveScript(id: number, draft: TeacherLiveScriptDraft): Promise<TeacherLiveScript> {
  const data = await handleApi<{ script: LiveScriptWire }>(await fetch(apiUrl(`/v1/teachers/scripts/${id}`), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(draft),
  }));
  return normalizeLiveScript(data.script);
}

export async function deleteTeacherLiveScript(id: number): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/teachers/scripts/${id}`), { method: 'DELETE', headers: authHeaders(false) }));
}
