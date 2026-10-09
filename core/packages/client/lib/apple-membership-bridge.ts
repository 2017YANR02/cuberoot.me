/** Compatibility exports for shipped Apple consumers. Both stores share one bridge. */
import type { AppleMembershipRequest, AppleMembershipResult } from '@cuberoot/shared/apple-membership';
import { installedMembershipStore, receiveStoreMembershipResult, requestStoreMembership, setStoreMembershipBridge, useStoreMembershipAvailable } from './store-membership-bridge';
export const isIosMembershipSurface = () => installedMembershipStore() === 'apple';
export const useAppleMembershipAvailable = () => useStoreMembershipAvailable('apple');
export const setAppleMembershipBridge = (available: boolean, post?: (request: AppleMembershipRequest) => void) =>
  setStoreMembershipBridge('apple', available, post ? request => { if (request.type === 'cuberoot:mobile:apple-membership') post(request); } : undefined);
export const receiveAppleMembershipResult = receiveStoreMembershipResult;
export const requestAppleMembership = (action: AppleMembershipRequest['action'], expectedUid: number, productId?: AppleMembershipRequest['productId']) =>
  requestStoreMembership('apple', action, expectedUid, productId) as Promise<AppleMembershipResult>;
