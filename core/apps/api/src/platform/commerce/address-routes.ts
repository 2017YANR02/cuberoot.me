import { requirePlatformActor } from '../auth.js';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../data_encryption.js';
import { type PlatformDb, platformQuery, platformDb, withIdempotency, sendMutation } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { privateNoStore } from '../http.js';
import { objectField, stringField, readJsonObject, resourceId } from '../validation.js';
import { type Hono } from 'hono';

interface ShippingAddressPayload extends Record<string, unknown> {
  recipientName: string;
  phone: string;
  countryCode: string;
  region: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
}

function shippingAddressPayload(body: Record<string, unknown>, current?: Record<string, unknown>): ShippingAddressPayload {
  const input = objectField(body, 'address') ?? body;
  const merged = { ...(current ?? {}), ...input };
  const recipientName = stringField(merged, 'recipientName', { required: true, max: 160 })!;
  const phone = stringField(merged, 'phone', { required: true, max: 40 })!;
  const countryCode = stringField(merged, 'countryCode', { required: true, max: 2, pattern: /^[A-Za-z]{2}$/ })!.toUpperCase();
  const region = stringField(merged, 'region', { max: 160 }) ?? '';
  const city = stringField(merged, 'city', { required: true, max: 160 })!;
  const postalCode = stringField(merged, 'postalCode', { max: 40 }) ?? '';
  const addressLine1 = stringField(merged, 'addressLine1', { required: true, max: 500 })!;
  const addressLine2 = stringField(merged, 'addressLine2', { max: 500 }) ?? '';
  if (!/[0-9]{4}/.test(phone.replace(/\D/g, ''))) badRequest('phone must contain at least four digits');
  return { recipientName, phone, countryCode, region, city, postalCode, addressLine1, addressLine2 };
}

function publicShippingAddress(row: {
  id: string; label: string; is_default: boolean; encrypted_payload: Buffer | Uint8Array; key_version: number;
  created_at: string; updated_at: string;
}): Record<string, unknown> {
  return {
    id: row.id,
    label: row.label,
    isDefault: row.is_default,
    ...decryptPlatformPrivateData(Buffer.from(row.encrypted_payload), row.key_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function lockShippingAddresses(db: PlatformDb, userId: number | null): Promise<void> {
  // Lock before individual addresses so concurrent default changes share one order.
  // NO KEY UPDATE remains compatible with idempotency's foreign-key KEY SHARE lock.
  const rows = await platformQuery(db, 'SELECT id FROM app_users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
  if (!rows[0]) notFound('Account');
}

export function registerAddressRoutes(platformCommerceRoutes: Hono): void {
  platformCommerceRoutes.get('/me/shipping-addresses', async (c) => {
    const actor = await requirePlatformActor(c);
    const rows = await platformQuery<{
      id: string; label: string; is_default: boolean; encrypted_payload: Buffer; key_version: number;
      created_at: string; updated_at: string;
    }>(platformDb(), `
      SELECT id::text, label, is_default, encrypted_payload, key_version, created_at, updated_at
      FROM platform_shipping_addresses
      WHERE user_id = $1 AND archived_at IS NULL
      ORDER BY is_default DESC, updated_at DESC, id
    `, [actor.userId]);
    privateNoStore(c);
    return c.json({ items: rows.map(publicShippingAddress) });
  });

  platformCommerceRoutes.post('/me/shipping-addresses', async (c) => {
    const actor = await requirePlatformActor(c);
    const body = await readJsonObject(c);
    const label = stringField(body, 'label', { max: 80 }) ?? '';
    const isDefault = body.isDefault === undefined ? false : body.isDefault === true;
    if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') badRequest('isDefault must be a boolean');
    const address = shippingAddressPayload(body);
    const encrypted = encryptPlatformPrivateData(address);
    const digits = address.phone.replace(/\D/g, '');
    const result = await withIdempotency(c, actor, 'commerce.shipping-address.create', body, async (db) => {
      await lockShippingAddresses(db, actor.userId);
      if (isDefault) await platformQuery(db, `UPDATE platform_shipping_addresses SET is_default = FALSE WHERE user_id = $1 AND archived_at IS NULL`, [actor.userId]);
      const rows = await platformQuery<{ id: string }>(db, `
        INSERT INTO platform_shipping_addresses (
          user_id, label, recipient_hint, phone_last4, country_code,
          encrypted_payload, key_version, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::text
      `, [actor.userId, label, address.recipientName.slice(0, 1), digits.slice(-4), address.countryCode,
        encrypted.payload, encrypted.keyVersion, isDefault]);
      return { status: 201, body: { id: rows[0].id, label, isDefault, ...address }, resourceType: 'platform_shipping_address', resourceId: rows[0].id };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.patch('/me/shipping-addresses/:id', async (c) => {
    const actor = await requirePlatformActor(c);
    const id = resourceId(c.req.param('id'));
    const body = await readJsonObject(c);
    const result = await withIdempotency(c, actor, `commerce.shipping-address.update:${id}`, body, async (db) => {
      await lockShippingAddresses(db, actor.userId);
      const rows = await platformQuery<{
        id: string; label: string; is_default: boolean; encrypted_payload: Buffer; key_version: number;
      }>(db, `
        SELECT id::text, label, is_default, encrypted_payload, key_version
        FROM platform_shipping_addresses
        WHERE id = $1::uuid AND user_id = $2 AND archived_at IS NULL FOR UPDATE
      `, [id, actor.userId]);
      const current = rows[0];
      if (!current) notFound('Shipping address');
      const decrypted = decryptPlatformPrivateData(Buffer.from(current.encrypted_payload), current.key_version);
      const address = shippingAddressPayload(body, decrypted);
      const encrypted = encryptPlatformPrivateData(address);
      const label = stringField(body, 'label', { max: 80 }) ?? current.label;
      const isDefault = body.isDefault === undefined ? current.is_default : body.isDefault === true;
      if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') badRequest('isDefault must be a boolean');
      if (isDefault) await platformQuery(db, `UPDATE platform_shipping_addresses SET is_default = FALSE WHERE user_id = $1 AND id <> $2::uuid AND archived_at IS NULL`, [actor.userId, id]);
      const digits = address.phone.replace(/\D/g, '');
      await platformQuery(db, `
        UPDATE platform_shipping_addresses SET label = $3, recipient_hint = $4, phone_last4 = $5,
          country_code = $6, encrypted_payload = $7, key_version = $8, is_default = $9
        WHERE id = $1::uuid AND user_id = $2
      `, [id, actor.userId, label, address.recipientName.slice(0, 1), digits.slice(-4), address.countryCode,
        encrypted.payload, encrypted.keyVersion, isDefault]);
      return { status: 200, body: { id, label, isDefault, ...address }, resourceType: 'platform_shipping_address', resourceId: id };
    });
    return sendMutation(c, result);
  });

  platformCommerceRoutes.delete('/me/shipping-addresses/:id', async (c) => {
    const actor = await requirePlatformActor(c);
    const id = resourceId(c.req.param('id'));
    const result = await withIdempotency(c, actor, `commerce.shipping-address.archive:${id}`, {}, async (db) => {
      await lockShippingAddresses(db, actor.userId);
      const rows = await platformQuery(db, `
        UPDATE platform_shipping_addresses SET archived_at = NOW(), is_default = FALSE
        WHERE id = $1::uuid AND user_id = $2 AND archived_at IS NULL RETURNING id::text
      `, [id, actor.userId]);
      if (!rows[0]) notFound('Shipping address');
      return { status: 200, body: { id, archived: true }, resourceType: 'platform_shipping_address', resourceId: id };
    });
    return sendMutation(c, result);
  });
}
