'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_MEMBERSHIP_BENEFITS, type MembershipBenefits } from '@cuberoot/shared/membership-benefits';
import { listMembershipBenefits } from '@/lib/membership-perks';

/** Membership and BP consume the same published benefit copy. */
export function useMembershipBenefits() {
  const [content, setContent] = useState<MembershipBenefits>({ revision: 0, items: DEFAULT_MEMBERSHIP_BENEFITS });
  useEffect(() => {
    const controller = new AbortController();
    listMembershipBenefits(controller.signal).then(result => {
      setContent(current => result.revision >= current.revision ? result : current);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  return { content, setContent };
}
