import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluateSponsorClaim, type SponsorClaimProfile } from '../src/utils/sponsor_claim.js';

const completeProfile: SponsorClaimProfile = {
  wca_id: '2017YANR02',
  birth_date: '1990-01-02',
  gender: 'undisclosed',
  country_iso2: 'CN',
};

describe('sponsor claim eligibility', () => {
  it('auto-approves only an exact WCA identity match', () => {
    expect(evaluateSponsorClaim('2017yanr02', {
      wca_id: '2017YANR02', birth_date: null, gender: null, country_iso2: null,
    }, null)).toEqual({ autoApproved: true });
    expect(evaluateSponsorClaim('2017OTHR01', completeProfile, 'paid in May')).toEqual({ autoApproved: false });
    expect(evaluateSponsorClaim(null, completeProfile, 'paid in May')).toEqual({ autoApproved: false });
  });

  it.each(['birth_date', 'gender', 'country_iso2'] as const)(
    'requires %s for a manual claim',
    (field) => {
      expect(evaluateSponsorClaim(null, { ...completeProfile, [field]: null }, 'payment clue'))
        .toEqual({ error: 'profile_incomplete' });
    },
  );

  it('requires a useful but bounded-by-the-route payment clue for manual review', () => {
    expect(evaluateSponsorClaim(null, completeProfile, null)).toEqual({ error: 'proof_required' });
    expect(evaluateSponsorClaim(null, completeProfile, ' 123 ')).toEqual({ error: 'proof_required' });
    expect(evaluateSponsorClaim(null, completeProfile, ' 1234 ')).toEqual({ autoApproved: false });
  });
});

describe('sponsor claim persistence and privacy contract', () => {
  const migration = readFileSync(new URL('../migrations/0188_sponsor_claims.sql', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../src/db/schema.pg.sql', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../src/routes/sponsors.ts', import.meta.url), 'utf8');
  const deletion = readFileSync(new URL('../src/utils/account_delete.ts', import.meta.url), 'utf8');

  it('keeps one active claim per supporter and preserves review history', () => {
    for (const source of [migration, schema]) {
      expect(source).toContain('CREATE TABLE sponsor_claims');
      expect(source).toContain("status IN ('pending', 'approved')");
      expect(source).toMatch(/profile_snapshot\s+JSONB/);
      expect(source).toMatch(/cancelled_at\s+TIMESTAMPTZ/);
      expect(source).toMatch(/revoked_by_user_id\s+BIGINT/);
      expect(source).toMatch(/revocation_note\s+VARCHAR\(500\)/);
    }
    expect(migration).toContain('CREATE UNIQUE INDEX uq_sponsor_claims_active_sponsor');
    expect(migration).toContain('ON DELETE CASCADE');
  });

  it('never publishes the claimant account id and minimizes the review snapshot', () => {
    const serializer = route.slice(route.indexOf('function rowToJson'), route.indexOf('interface SponsorInput'));
    expect(serializer).toContain('claimed: r.claimed_by_user_id != null');
    expect(serializer).not.toContain('claimedBy');

    const snapshot = route.slice(route.indexOf('const snapshot ='), route.indexOf('const status:', route.indexOf('const snapshot =')));
    expect(snapshot).toContain('displayName: user.display_name');
    expect(snapshot).toContain('wcaId: user.wca_id');
    expect(snapshot).toContain('countryIso2: user.country_iso2');
    expect(snapshot).not.toContain('birthDate');
    expect(snapshot).not.toContain('gender:');
  });

  it('records applicant cancellation and admin revocation without rewriting review history', () => {
    const cancelRoute = route.slice(
      route.indexOf("sponsorsRoutes.delete('/sponsor-claims/:id'"),
      route.indexOf("sponsorsRoutes.get('/sponsor-claims'"),
    );
    expect(cancelRoute).toContain("status = 'cancelled', cancelled_at = NOW()");
    expect(cancelRoute).not.toContain('review_note');
    expect(cancelRoute).not.toContain('reviewed_at');

    const unclaimRoute = route.slice(route.indexOf("sponsorsRoutes.post('/sponsors/:id/unclaim'"));
    expect(unclaimRoute).toContain("status = 'revoked', revoked_by_user_id = ${revokerId}");
    expect(unclaimRoute).toContain('revocation_note = ${note.value}, revoked_at = NOW()');
    expect(unclaimRoute).not.toContain('review_note =');
    expect(unclaimRoute).not.toContain('reviewed_at =');
  });

  it('unlinks the public supporter record when an account is deleted', () => {
    expect(deletion).toMatch(/UPDATE sponsors\s+SET claimed_by_user_id = NULL, claimed_at = NULL/);
    expect(deletion).toContain("sponsor_claims: '申请随认领账号级联删除,审核与解除账号删除只置空'");
  });
});
