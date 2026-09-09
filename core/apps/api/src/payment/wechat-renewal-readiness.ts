/** Local diagnostics only: syntax/schema checks cannot certify merchant authorization or launch readiness. */
export interface ReadinessCheck {
  name: string;
  status: 'present' | 'missing' | 'invalid' | 'verified' | 'mismatch' | 'skipped' | 'unavailable' | 'not_implemented' | 'not_verified';
}

type Environment = Readonly<Record<string, string | undefined>>;

export function checkRenewalEnvironment(env: Environment): ReadinessCheck[] {
  // Match the existing APIv2 papay transport. Native APIv3 credentials are not a substitute.
  return ([
    ['WECHAT_PAPAY_APPID', /^wx[a-zA-Z0-9]{16}$/],
    ['WECHAT_PAPAY_MCHID', /^\d+$/],
    ['WECHAT_PAPAY_API_V2_KEY', /^[a-zA-Z0-9]{32}$/],
  ] as const).map(([name, pattern]) => {
    const value = env[name];
    return { name, status: !value ? 'missing' : pattern.test(value) ? 'present' : 'invalid' };
  });
}

/** Require explicit local connection settings, never inherit remote hosts or guess a database. */
export function checkLocalDatabaseEnvironment(env: Environment): ReadinessCheck[] {
  return ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'].map((name) => {
    const value = env[name];
    if (!value) return { name, status: 'missing' };
    const valid = name === 'DB_HOST' ? ['127.0.0.1', '::1'].includes(value)
      : name === 'DB_PORT' ? /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 65535
        : value.trim().length > 0;
    return { name, status: valid ? 'present' : 'invalid' };
  });
}

// Field contract owned by 0222_membership_contracts.sql; no customer rows are inspected.
export const RENEWAL_MIGRATION = '0222_membership_contracts.sql';
export const RENEWAL_COLUMNS: Readonly<Record<string, readonly [string, 'YES' | 'NO']>> = {
  id: ['uuid', 'NO'], wca_id: ['text', 'NO'], plan_slug: ['text', 'NO'],
  appid: ['text', 'NO'], mch_id: ['text', 'NO'], plan_id: ['text', 'NO'],
  contract_code: ['text', 'NO'], contract_id: ['text', 'YES'], price_cents: ['integer', 'NO'],
  currency: ['text', 'NO'], period: ['text', 'NO'], period_count: ['integer', 'NO'],
  terms_version: ['text', 'NO'], state: ['text', 'NO'],
  cancellation_requested_at: ['timestamp with time zone', 'YES'], verified_at: ['timestamp with time zone', 'YES'],
  last_sync_attempt_at: ['timestamp with time zone', 'YES'],
  created_at: ['timestamp with time zone', 'NO'], updated_at: ['timestamp with time zone', 'NO'],
};
export interface RenewalColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}
export function checkRenewalSchema(columns: readonly RenewalColumn[], migration: 'missing' | 'verified' | 'mismatch'): ReadinessCheck[] {
  return [
    { name: RENEWAL_MIGRATION, status: migration },
    ...Object.entries(RENEWAL_COLUMNS).map(([name, [type, nullable]]): ReadinessCheck => {
      const column = columns.find((item) => item.column_name === name);
      return { name: `membership_contracts.${name}`, status: !column ? 'missing'
        : column.data_type === type && column.is_nullable === nullable ? 'verified' : 'mismatch' };
    }),
  ];
}

export function renewalReadinessReport(checks: readonly ReadinessCheck[]) {
  return {
    scope: 'local_read_only_precheck',
    readyForProduction: false as const,
    checks,
    blockers: [
      { name: 'enrollment_and_verified_contract_persistence', status: 'not_implemented' },
      { name: 'renewal_debit_and_fulfillment_pipeline', status: 'not_implemented' },
      { name: 'merchant_approval_and_template_binding', status: 'not_verified' },
      { name: 'real_merchant_end_to_end_acceptance', status: 'not_verified' },
    ] as const,
  };
}
