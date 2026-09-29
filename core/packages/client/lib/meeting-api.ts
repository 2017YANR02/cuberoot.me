import type { MeetingDraft, MeetingPlan } from '@cuberoot/shared/meeting';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';

export async function fetchMeetingPlans(): Promise<MeetingPlan[]> {
  const response = await fetch(apiUrl('/v1/video/meet/plans'), { headers: authHeaders(false), cache: 'no-store' });
  return (await handleApi<{ meetings: MeetingPlan[] }>(response)).meetings;
}
export async function saveMeetingPlan(draft: MeetingDraft, id?: string): Promise<MeetingPlan> {
  const response = await fetch(apiUrl(`/v1/video/meet/plans${id ? `/${id}` : ''}`), {
    method: id ? 'PATCH' : 'POST', headers: authHeaders(), body: JSON.stringify(draft),
  });
  return (await handleApi<{ meeting: MeetingPlan }>(response)).meeting;
}
export async function cancelMeetingPlan(id: string): Promise<void> {
  await handleApi(await fetch(apiUrl(`/v1/video/meet/plans/${id}`), {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ cancelled: true }),
  }));
}
