import { sessionFetch } from '@/lib/session-fetch';
import type { MembershipBenefits } from '@cuberoot/shared/membership-benefits';
import { apiUrl } from './api-base';
import { authHeaders, handleApi } from './admin-api';
import { tr } from '@/i18n/tr';

export async function listMembershipBenefits(signal?: AbortSignal): Promise<MembershipBenefits> {
  return handleApi(await sessionFetch(apiUrl('/v1/membership/benefits?v=1'), { cache: 'no-store', signal }));
}

export async function saveMembershipBenefits(content: MembershipBenefits): Promise<MembershipBenefits> {
  const response = await sessionFetch(apiUrl('/v1/membership/admin/benefits'), {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(content), cache: 'no-store',
  });
  if (response.status === 409) throw new Error(tr({ zh: '权益已在其他窗口更新。请先保留当前修改，取消后重新打开编辑器。', en: 'Benefits changed in another window. Keep a copy of your edits, cancel, then reopen the editor.' }));
  return handleApi(response);
}
