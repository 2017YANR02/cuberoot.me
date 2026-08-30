export interface SponsorClaimProfile {
  wca_id: string | null;
  birth_date: string | null;
  gender: string | null;
  country_iso2: string | null;
}

export type SponsorClaimEligibility =
  | { autoApproved: true }
  | { autoApproved: false }
  | { error: 'profile_incomplete' | 'proof_required' };

/** Only an exact WCA identity match bypasses manual review. */
export function evaluateSponsorClaim(
  sponsorWcaId: string | null,
  profile: SponsorClaimProfile,
  note: string | null,
): SponsorClaimEligibility {
  if (sponsorWcaId && profile.wca_id
    && sponsorWcaId.toUpperCase() === profile.wca_id.toUpperCase()) {
    return { autoApproved: true };
  }
  if (!profile.birth_date || !profile.gender || !profile.country_iso2) {
    return { error: 'profile_incomplete' };
  }
  if (!note || note.trim().length < 4) return { error: 'proof_required' };
  return { autoApproved: false };
}
