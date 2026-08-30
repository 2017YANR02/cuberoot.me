ALTER TABLE platform_invite_codes
  DROP CONSTRAINT platform_invite_codes_status_check,
  ADD COLUMN distribution_type VARCHAR(24) NOT NULL DEFAULT 'invitation',
  ADD COLUMN batch_reference VARCHAR(160),
  ADD COLUMN external_order_reference VARCHAR(240),
  ADD COLUMN revoked_at TIMESTAMPTZ,
  ADD COLUMN revoked_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN revoked_by_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN revoked_by_actor_key VARCHAR(160),
  ADD CONSTRAINT platform_invite_codes_status_check
    CHECK (status IN ('active', 'paused', 'expired', 'archived', 'revoked')),
  ADD CONSTRAINT platform_invite_codes_distribution_type_check
    CHECK (distribution_type IN ('invitation', 'physical_bundle')),
  ADD CONSTRAINT platform_invite_codes_batch_reference_check
    CHECK (batch_reference IS NULL OR (batch_reference = BTRIM(batch_reference) AND batch_reference <> '')),
  ADD CONSTRAINT platform_invite_codes_external_order_reference_check
    CHECK (external_order_reference IS NULL OR (external_order_reference = BTRIM(external_order_reference) AND external_order_reference <> '')),
  ADD CONSTRAINT platform_invite_codes_physical_bundle_single_use_check
    CHECK (distribution_type <> 'physical_bundle' OR max_redemptions = 1),
  ADD CONSTRAINT platform_invite_codes_revocation_check
    CHECK (
      (status = 'revoked' AND revoked_at IS NOT NULL AND BTRIM(revoked_reason) <> '' AND revoked_by_actor_key IS NOT NULL)
      OR (status <> 'revoked' AND revoked_at IS NULL AND revoked_reason = '' AND revoked_by_user_id IS NULL AND revoked_by_actor_key IS NULL)
    ),
  ADD CONSTRAINT platform_invite_codes_revoked_by_actor_key_check
    CHECK (revoked_by_actor_key IS NULL OR (revoked_by_actor_key = BTRIM(revoked_by_actor_key) AND revoked_by_actor_key <> ''));

CREATE INDEX idx_platform_invite_codes_distribution_batch
  ON platform_invite_codes(distribution_type, batch_reference, created_at DESC, id);
CREATE INDEX idx_platform_invite_codes_external_order_reference
  ON platform_invite_codes(external_order_reference)
  WHERE external_order_reference IS NOT NULL;

ALTER TABLE platform_invite_redemptions
  ADD COLUMN entitlement_grant_ledger_id UUID UNIQUE
    REFERENCES platform_entitlement_ledger(id) ON DELETE RESTRICT;
