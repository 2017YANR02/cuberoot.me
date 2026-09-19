-- Existing challenges retain their original validity/hash and sent behavior.
-- New email sends explicitly reserve pending; phone/internal challenges remain sent until their own adoption.
ALTER TABLE auth_codes ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE auth_codes ADD CONSTRAINT auth_codes_delivery_status
  CHECK (delivery_status IN ('pending', 'sent', 'failed'));
