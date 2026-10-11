import type { EnterpriseBankReceipt, EnterpriseBankRecipient, EnterpriseVerificationDraft, EnterpriseVerificationState, EnterpriseVerificationApplication, EnterpriseVerificationReviewDetails, EnterpriseVerificationReview } from '@cuberoot/shared/teaching';
import { apiUrl } from './api-base';
import { sessionFetch } from './session-fetch';
import { authHeaders, handleApi } from './admin-api';

export class EnterpriseVerificationError extends Error {
  constructor(public status: number) { super('Enterprise verification request failed'); }
}
async function request<T>(path: string, method = 'GET', body?: unknown, operationKey?: string): Promise<T> {
  const response = await sessionFetch(apiUrl(`/v1/enterprise-verification${path}`), {
    method, cache: 'no-store', headers: { ...authHeaders(), ...(operationKey ? { 'Idempotency-Key': operationKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new EnterpriseVerificationError(response.status);
  return handleApi<T>(response);
}
const orgPath = (slug: string) => `/organizations/${encodeURIComponent(slug)}`;
export const getEnterpriseVerification = (slug: string) => request<EnterpriseVerificationState>(orgPath(slug));
export const applyEnterpriseVerification = (slug: string, draft: EnterpriseVerificationDraft, key: string) => request<{ application: EnterpriseVerificationApplication }>(orgPath(slug), 'POST', draft, key);
export const submitEnterpriseTransfer = (slug: string, id: string) => request(`${orgPath(slug)}/${encodeURIComponent(id)}/submit`, 'POST', {});
export const getEnterpriseBankSettings = () => request<{ keyReady: boolean; settings: EnterpriseBankRecipient | null }>('/admin/settings');
export const saveEnterpriseBankSettings = (settings: EnterpriseBankRecipient) => request('/admin/settings', 'PUT', settings);
export const listEnterpriseApplications = (offset = 0) => request<{ applications: EnterpriseVerificationApplication[]; hasMore: boolean }>(`/admin/applications?offset=${offset}`);
export const getEnterpriseApplicationMaterials = (id: string) => request<{ application: EnterpriseVerificationApplication; details: EnterpriseVerificationReviewDetails }>(`/admin/applications/${encodeURIComponent(id)}`);
export const reviewEnterpriseApplication = (id: string, review: EnterpriseVerificationReview) => request(`/admin/applications/${encodeURIComponent(id)}/review`, 'POST', review);
export const recordEnterpriseRefund = (id: string, reference: string) => request(`/admin/applications/${encodeURIComponent(id)}/refund`, 'POST', { reference, returnedToOriginalAccount: true });
export const revokeEnterpriseVerification = (id: string, note: string) => request(`/admin/applications/${encodeURIComponent(id)}/revoke`, 'POST', { note });

export const recordEnterpriseReceipt = (id: string, receipt: EnterpriseBankReceipt) => request(`/admin/applications/${encodeURIComponent(id)}/receipt`, 'POST', receipt);
