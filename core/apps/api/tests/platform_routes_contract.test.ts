import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptPlatformPrivateData, encryptPlatformPrivateData } from '../src/platform/data_encryption.js';
import { PlatformApiError } from '../src/platform/errors.js';
import { createPlatformMediaToken, verifyPlatformMediaToken } from '../src/platform/media_access.js';
import {
  normalizePlatformQuizAnswer,
  normalizePlatformQuizChoices,
  platformQuizAnswersEqual,
} from '../src/platform/quiz_answers.js';

const commerceSource = readFileSync(new URL('../src/routes/platform_commerce.ts', import.meta.url), 'utf8');
const catalogSource = readFileSync(new URL('../src/routes/platform_catalog.ts', import.meta.url), 'utf8');
const learningSource = readFileSync(new URL('../src/routes/platform_learning.ts', import.meta.url), 'utf8');
const physicalBundleSource = readFileSync(new URL('../src/platform/physical_bundle.ts', import.meta.url), 'utf8');
const qrSource = readFileSync(new URL('../src/routes/platform_qr.ts', import.meta.url), 'utf8');
const envExampleSource = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const deploySecretSyncSource = readFileSync(new URL('../scripts/sync-platform-private-secrets.sh', import.meta.url), 'utf8');

const originalEncryptionKey = process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1;
const originalMediaSecret = process.env.PLATFORM_MEDIA_SIGNING_SECRET;

afterEach(() => {
  if (originalEncryptionKey == null) delete process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1;
  else process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1 = originalEncryptionKey;
  if (originalMediaSecret == null) delete process.env.PLATFORM_MEDIA_SIGNING_SECRET;
  else process.env.PLATFORM_MEDIA_SIGNING_SECRET = originalMediaSecret;
});

function routePaths(source: string, router: string): Set<string> {
  return new Set(Array.from(
    source.matchAll(new RegExp(`${router}\\.(?:get|post|put|patch|delete)\\('([^']+)'`, 'g')),
    (match) => match[1]!,
  ));
}

function routeBlock(source: string, router: string, method: string, path: string): string {
  const marker = `${router}.${method}('${path}'`;
  const start = source.indexOf(marker);
  expect(start, `${method.toUpperCase()} ${path} must exist`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf(`\n${router}.`, start + marker.length);
  return source.slice(start, next < 0 ? undefined : next);
}

describe('Platform typed quiz contract', () => {
  it('normalizes each supported answer type consistently for authoring and submission', () => {
    expect(normalizePlatformQuizChoices('single_choice', [' Red ', 'Blue'])).toEqual(['Red', 'Blue']);
    expect(normalizePlatformQuizAnswer({
      questionType: 'single_choice', raw: '1', choiceCount: 2, source: 'submission',
    })).toBe(1);
    expect(normalizePlatformQuizAnswer({
      questionType: 'multiple_choice', raw: '2,0', choiceCount: 3, source: 'submission',
    })).toEqual([0, 2]);
    expect(normalizePlatformQuizAnswer({
      questionType: 'boolean', raw: 'true', choiceCount: 0, source: 'submission',
    })).toBe(true);
    expect(normalizePlatformQuizAnswer({
      questionType: 'text', raw: '  Case Sensitive  ', choiceCount: 0, source: 'submission',
    })).toBe('Case Sensitive');
    expect(platformQuizAnswersEqual([0, 2], [0, 2])).toBe(true);
    expect(platformQuizAnswersEqual('Case Sensitive', 'case sensitive')).toBe(false);
  });

  it('rejects duplicate choices, out-of-range indexes, duplicate answers, and wrong types', () => {
    expect(() => normalizePlatformQuizChoices('single_choice', ['same', 'same'])).toThrow(PlatformApiError);
    expect(() => normalizePlatformQuizChoices('boolean', ['true', 'false'])).toThrow(PlatformApiError);
    expect(() => normalizePlatformQuizAnswer({
      questionType: 'single_choice', raw: 2, choiceCount: 2, source: 'authoring',
    })).toThrow(PlatformApiError);
    expect(() => normalizePlatformQuizAnswer({
      questionType: 'multiple_choice', raw: [0, 0], choiceCount: 2, source: 'submission',
    })).toThrow(PlatformApiError);
    expect(() => normalizePlatformQuizAnswer({
      questionType: 'boolean', raw: 1, choiceCount: 0, source: 'submission',
    })).toThrow(PlatformApiError);
    expect(() => normalizePlatformQuizAnswer({
      questionType: 'text', raw: '', choiceCount: 0, source: 'submission',
    })).toThrow(PlatformApiError);
  });
});

describe('Platform private data and media tokens', () => {
  it('documents and deploys both required production secrets', () => {
    for (const name of ['PLATFORM_DATA_ENCRYPTION_KEY_V1', 'PLATFORM_MEDIA_SIGNING_SECRET']) {
      expect(envExampleSource).toContain(`${name}=`);
      expect(deploySecretSyncSource).toContain(`${name}`);
    }
    expect(deploySecretSyncSource).toContain('Existing PLATFORM_DATA_ENCRYPTION_KEY_V1 does not match the immutable v1 deploy secret');
    expect(deploySecretSyncSource).toContain('DATA_KEY_TO_WRITE="${EXISTING_DATA_KEY:-$DATA_KEY}"');
    expect(deploySecretSyncSource).toContain('PLATFORM_DATA_ENCRYPTION_KEY_V1=');
    expect(deploySecretSyncSource).toContain('PLATFORM_MEDIA_SIGNING_SECRET=');
    expect(deploySecretSyncSource.match(/mv "\$TMP_FILE" "\$ENV_FILE"/g)).toHaveLength(1);
  });

  it('round-trips encrypted quiz answers and rejects tamper, wrong version, and missing key', () => {
    process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1 = Buffer.alloc(32, 7).toString('base64');
    const encrypted = encryptPlatformPrivateData({ answers: [1, [0, 2], true, 'private text'] });
    expect(decryptPlatformPrivateData(encrypted.payload, encrypted.keyVersion)).toEqual({
      answers: [1, [0, 2], true, 'private text'],
    });
    const tampered = Buffer.from(encrypted.payload);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptPlatformPrivateData(tampered, encrypted.keyVersion)).toThrow(PlatformApiError);
    expect(() => decryptPlatformPrivateData(encrypted.payload, encrypted.keyVersion + 1)).toThrow(PlatformApiError);
    delete process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1;
    expect(() => encryptPlatformPrivateData({ answers: [] })).toThrow(PlatformApiError);
  });

  it('binds short-lived media tokens to the exact asset and lesson revision', () => {
    process.env.PLATFORM_MEDIA_SIGNING_SECRET = 'platform-media-test-secret-32-bytes-minimum';
    const signed = createPlatformMediaToken({ mediaId: 'media-1', binding: 'lesson:lesson-1:3', nowSeconds: 1_800_000_000 });
    expect(verifyPlatformMediaToken({
      token: signed.token, mediaId: 'media-1', binding: 'lesson:lesson-1:3', nowSeconds: 1_800_000_299,
    })).toBe(true);
    expect(verifyPlatformMediaToken({
      token: signed.token, mediaId: 'media-2', binding: 'lesson:lesson-1:3', nowSeconds: 1_800_000_299,
    })).toBe(false);
    expect(verifyPlatformMediaToken({
      token: signed.token, mediaId: 'media-1', binding: 'lesson:lesson-1:4', nowSeconds: 1_800_000_299,
    })).toBe(false);
    expect(verifyPlatformMediaToken({
      token: signed.token, mediaId: 'media-1', binding: 'lesson:lesson-1:3', nowSeconds: 1_800_000_301,
    })).toBe(false);
  });
});

describe('Platform route and security contract', () => {
  it('keeps commerce, learning, privacy, media, certificate, and QR operations reachable', () => {
    const commerce = routePaths(commerceSource, 'platformCommerceRoutes');
    const learning = routePaths(learningSource, 'platformLearningRoutes');
    const qr = routePaths(qrSource, 'platformQrRoutes');
    for (const path of [
      '/membership-plans', '/me/memberships', '/orders', '/admin/orders/:id/refund', '/instructor/payout-profile',
      '/admin/orders/:orderId/items/:itemId/ship',
      '/admin/orders/:orderId/items/:itemId/deliver',
      '/admin/orders/:orderId/items/:itemId/return',
      '/admin/orders/expire-reservations',
      '/admin/instructor-payouts/generate', '/admin/instructor-payouts/:id/approve',
      '/admin/instructor-payouts/:id/paid',
      '/admin/instructor-payouts/:id/reconcile-processing-refund',
    ]) expect(commerce.has(path), path).toBe(true);
    for (const path of [
      '/learning/lessons/:lessonId/quiz', '/lessons/:lessonId/media',
      '/certificates/:code', '/certificates/:code/image', '/me/privacy/consents',
      '/analytics', '/admin/retention-jobs', '/admin/invites/batch',
      '/admin/invites/:id/order-reference', '/admin/invites/:id/revoke',
    ]) expect(learning.has(path), path).toBe(true);
    for (const path of [
      '/qr/:code', '/qr/:code/card', '/admin/qr', '/admin/qr/:id/card',
      '/admin/qr/:id/duplicate', '/admin/qr/:id/disabled',
      '/admin/qr/:id', '/admin/qr/:collection{prompts|cards}/:id/restore',
      '/admin/qr/card-jobs', '/admin/qr/card-jobs/:id',
    ]) expect(qr.has(path), path).toBe(true);
  });

  it('requires actor/admin auth and idempotency on critical state-changing routes', () => {
    const quiz = routeBlock(learningSource, 'platformLearningRoutes', 'post', '/learning/lessons/:lessonId/quiz');
    expect(quiz).toContain('requirePlatformActor(c)');
    expect(quiz).toContain('withIdempotency(c, actor');
    const refund = routeBlock(commerceSource, 'platformCommerceRoutes', 'post', '/admin/orders/:id/refund');
    expect(refund).toContain('requirePlatformAdmin(c)');
    expect(refund).toContain('withIdempotency(c, actor');
    const qrArchive = routeBlock(qrSource, 'platformQrRoutes', 'delete', '/admin/qr/:id');
    expect(qrArchive).toContain('requirePlatformAdmin(c)');
    expect(qrArchive).toContain('withIdempotency(c, actor');
    const inviteBatch = routeBlock(learningSource, 'platformLearningRoutes', 'post', '/admin/invites/batch');
    expect(inviteBatch).toContain('requirePlatformAdmin(c)');
    expect(inviteBatch).toContain('withIdempotency(c, actor');
    expect(inviteBatch).toContain("'physical_bundle'");
    expect(inviteBatch).toContain('max_redemptions');
    const inviteRevoke = routeBlock(learningSource, 'platformLearningRoutes', 'post', '/admin/invites/:id/revoke');
    expect(inviteRevoke).toContain('requirePlatformAdmin(c)');
    expect(inviteRevoke).toContain('withIdempotency(c, actor');
    expect(inviteRevoke).toContain('revokePhysicalBundleInvite(');
    expect(physicalBundleSource).toContain('reversal_of_ledger_id');
    expect(physicalBundleSource).toContain("status = 'revoked'");
  });

  it('preserves quiz privacy, media entitlement, analytics consent, and certificate image safety', () => {
    expect(learningSource).toContain('answers_snapshot_encrypted');
    expect(learningSource).not.toContain('answers_snapshot,');
    expect(routeBlock(learningSource, 'platformLearningRoutes', 'get', '/lessons/:lessonId/media'))
      .toContain('requireLessonAccess(actor, lessonId, db)');
    expect(routeBlock(learningSource, 'platformLearningRoutes', 'post', '/analytics'))
      .toContain("consents[0]?.status !== 'granted'");
    expect(routeBlock(learningSource, 'platformLearningRoutes', 'get', '/certificates/:code/image'))
      .toContain("media.mime_type LIKE 'image/%'");
  });

  it('normalizes quiz authoring and stored revisions through the shared typed contract', () => {
    expect(catalogSource).toContain('normalizePlatformQuizChoices(');
    expect(catalogSource).toContain('normalizePlatformQuizAnswer({');
    expect(catalogSource).toContain("source: 'authoring'");
    expect(catalogSource).toContain("source: 'stored'");
    expect(catalogSource).toContain('choiceCount: choices.length');
  });

  it('expires abandoned reservations and preserves every late payment fact for reconciliation', () => {
    const expire = routeBlock(commerceSource, 'platformCommerceRoutes', 'post', '/admin/orders/expire-reservations');
    expect(expire).toContain('requirePlatformAdmin(c)');
    expect(expire).toContain('withIdempotency(c, actor');
    expect(expire).toContain('FOR UPDATE SKIP LOCKED');
    expect(expire).toContain('releaseOrder(db, order.id, actor.userId)');
    expect(expire).toContain("failure_code = 'reservation_expired'");
    const createAttempt = routeBlock(commerceSource, 'platformCommerceRoutes', 'post', '/orders/:id/payment-attempts');
    expect(createAttempt).toContain("status IN ('initiated','pending')");
    expect(createAttempt).toContain('reservation_expires_at');
    const notify = routeBlock(commerceSource, 'platformCommerceRoutes', 'post', '/payments/:provider/notify');
    expect(notify).toContain("failure_code = 'provider_not_succeeded'");
    expect(notify).toContain("rejection_code = 'additional_provider_transaction'");
    expect(notify).toContain("failure_code = 'order_cancelled'");
    expect(notify).toContain('duplicate_payment_requires_reconciliation');
  });

  it('keeps refunds and payouts signed, reversible, and explicitly reconcilable', () => {
    const refund = routeBlock(commerceSource, 'platformCommerceRoutes', 'post', '/admin/orders/:id/refund');
    expect(refund).toContain("['paid', 'partially_fulfilled', 'fulfilled']");
    expect(refund).toContain("source.entry_type = 'grant'");
    expect(refund).toContain('reversal.reversal_of_ledger_id = source.id');
    expect(refund).toContain("'commerce.refund.physical_return_required'");
    expect(refund).toContain("'shipped_inventory_not_restocked'");
    expect(refund).toContain('unshippedQuantity');
    expect(refund).toContain("SET status = 'cancelled'");
    expect(refund).toContain('SET released_at = NOW()');
    expect(refund).toContain("SET status = 'failed', failure_code = 'refund_after_processing'");
    expect(refund).toContain('ORDER BY source.created_at DESC, source.id DESC FOR UPDATE OF source');
    expect(refund).toContain('cancelled_at = NOW()');
    expect(refund).toContain('const evidenceReferenceHash = hashReference(evidenceReference)');
    expect(refund).toContain('const evidenceReason = `evidence_sha256:${evidenceReferenceHash}`');
    expect(refund).not.toContain('JSON.stringify({ evidenceReference })');
    expect(refund).not.toContain('JSON.stringify({ refundId, evidenceReference,');
    const generate = routeBlock(commerceSource, 'platformCommerceRoutes', 'post', '/admin/instructor-payouts/generate');
    expect(generate).toContain('item.released_at IS NULL');
    expect(generate).not.toContain('Math.abs');
    expect(generate).toContain("sum + safeSignedMoney(entry.delta_amount_minor");
    const reconcile = routeBlock(commerceSource, 'platformCommerceRoutes', 'post', '/admin/instructor-payouts/:id/reconcile-processing-refund');
    expect(reconcile).toContain("SET status = 'paid'");
    expect(reconcile).toContain('SET released_at = NOW()');
    expect(reconcile).toContain('providerReference is required');
    expect(reconcile).toContain('JSON.stringify({ outcome, evidenceReferenceHash, providerReferenceHash })');
  });

  it('publishes only active membership plans with public cache and order-compatible pricing fields', () => {
    const plans = routeBlock(commerceSource, 'platformCommerceRoutes', 'get', '/membership-plans');
    expect(plans).toContain("WHERE status = 'active'");
    expect(plans).toContain('id::text, slug');
    expect(plans).toContain('name_zh AS "nameZh"');
    expect(plans).toContain('descriptionZh');
    expect(plans).toContain('period_unit AS "periodUnit"');
    expect(plans).toContain('amount_minor AS "amountMinor"');
    expect(plans).toContain('safeMoney(row.amountMinor)');
    expect(plans).toContain('publicCache(c, items.length > 0)');
  });

  it('returns only the signed-in owner memberships with effective activity and private caching', () => {
    const memberships = routeBlock(commerceSource, 'platformCommerceRoutes', 'get', '/me/memberships');
    expect(memberships).toContain('requirePlatformActor(c)');
    expect(memberships).toContain('membership.plan_id::text AS "planId"');
    expect(memberships).toContain('plan.slug AS "planSlug"');
    expect(memberships).toContain('plan.name_zh AS "planNameZh"');
    expect(memberships).toContain("membership.status = 'active'");
    expect(memberships).toContain('membership.valid_from <= NOW()');
    expect(memberships).toContain('membership.user_id = $1');
    expect(memberships).toContain('[actor.userId]');
    expect(memberships).toContain('privateNoStore(c)');
  });

  it('keeps shipment fulfillment manual, append-only, authorized, and quantity bounded', () => {
    expect(commerceSource).toContain("if (item.fulfillment_type !== 'shipment')");
    expect(commerceSource).toContain('async function refreshOrderFulfillmentStatus(');
    expect(commerceSource).toContain("THEN delivered_quantity >= quantity");
    const handlerStart = commerceSource.indexOf('async function recordShipmentEvent(');
    const handlerEnd = commerceSource.indexOf("platformCommerceRoutes.post('/admin/orders/:orderId/items/:itemId/ship'", handlerStart);
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const handler = commerceSource.slice(handlerStart, handlerEnd);
    expect(handler).toContain('requirePlatformAdmin(c)');
    expect(handler).toContain('withIdempotency(');
    expect(handler).toContain('externalReference was already recorded');
    expect(handler).toContain("item.fulfillment_type !== 'shipment'");
    expect(handler).toContain('quantity > availableQuantity');
    expect(handler).toContain("entry_type, delta_quantity, external_reference, refund_id, metadata, actor_user_id");
    expect(handler).toContain('encryptPlatformPrivateData({ carrier, trackingNumber, note })');
    expect(handler).toContain("entryType === 'return'");
    expect(handler).toContain("platform_inventory_ledger");
    expect(handler).toContain('actor_user_id, actor_key');
    expect(handler).toContain("status = 'succeeded'");
    expect(handler).toContain('returnRefundId');
    expect(handler).toContain('const referenceHash = hashReference(externalReference)');
    expect(handler).toContain('`return_reference_sha256:${referenceHash}`');
    expect(handler).toContain('platform_audit_events');
    expect(handler).toContain('enqueuePlatformEvent');
    expect(handler).not.toContain('JSON.stringify({ orderId, ledgerId, quantity, externalReference, carrier');
    expect(commerceSource).toContain("source.entry_type IN ('ship', 'deliver', 'return')");
    expect(commerceSource).toContain("returnedQuantity: quantityFor('return')");
    expect(commerceSource).toContain("decryptPlatformPrivateData(Buffer.from(encryptedPayload, 'base64'), keyVersion)");
  });

  it('encrypts shipping snapshots and retains renewal and non-LIFO refund guards', () => {
    expect(commerceSource).toContain('shipping_snapshot_encrypted');
    expect(commerceSource).toContain('encryptPlatformPrivateData({ ...snapshot, sourceAddressId: shippingAddressId })');
    expect(commerceSource).toContain("existingMembership[0] ? 'renewal' : 'purchase', base.toISOString(), validUntil, item.id");
    expect(commerceSource).toContain('Membership renewals must be refunded newest first');
  });

  it('keeps QR disable/archive/template-restore semantics and validates generated image assets', () => {
    expect(routeBlock(qrSource, 'platformQrRoutes', 'patch', '/admin/qr/:id/disabled'))
      .toContain("disabled ? 'disabled' : 'active'");
    expect(routeBlock(qrSource, 'platformQrRoutes', 'delete', '/admin/qr/:id'))
      .toContain("status = 'archived'");
    expect(routeBlock(qrSource, 'platformQrRoutes', 'post', '/admin/qr/:collection{prompts|cards}/:id/restore'))
      .toContain("status = 'active', archived_at = NULL");
    expect(routeBlock(qrSource, 'platformQrRoutes', 'patch', '/admin/qr/card-jobs/:id'))
      .toContain("mime_type LIKE 'image/%'");
  });

  it('persists strict versioned QR card designs and serves deterministic physical SVG downloads', () => {
    const publicCard = routeBlock(qrSource, 'platformQrRoutes', 'get', '/qr/:code/card');
    expect(publicCard).toContain("findQr(resourceId(c.req.param('code'), 'code'), true)");
    expect(publicCard).toContain('parseQrCardRenderOptions(');
    expect(publicCard).toContain('renderQrCardSvg(');
    expect(publicCard).toContain("c.header('Content-Disposition'");
    expect(publicCard).toContain("options.download ? 'attachment' : 'inline'");

    const readCard = routeBlock(qrSource, 'platformQrRoutes', 'get', '/admin/qr/:id/card');
    expect(readCard).toContain('requirePlatformAdmin(c)');
    expect(readCard).toContain('findLatestQrCard(');
    expect(readCard).toContain('{ id: qr.id, code: qr.code, card:');
    expect(readCard).toContain('privateNoStore(c)');

    const updateCard = routeBlock(qrSource, 'platformQrRoutes', 'patch', '/admin/qr/:id/card');
    expect(updateCard).toContain('requirePlatformAdmin(c)');
    expect(updateCard).toContain('parseQrCardDesign(');
    expect(updateCard).toContain('resolveQrRef(db, id, true)');
    expect(updateCard).toContain('MAX(version)');
    expect(updateCard).toContain('INSERT INTO platform_qr_card_designs');
    expect(updateCard).toContain('withIdempotency(c, actor');
    const qrSvg = routeBlock(qrSource, 'platformQrRoutes', 'get', '/qr/:code/svg');
    expect(qrSvg).toContain("margin: 4, errorCorrectionLevel: 'H'");
  });
});
