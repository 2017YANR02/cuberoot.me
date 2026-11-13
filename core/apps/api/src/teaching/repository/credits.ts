import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requirePermission, accessForWrite, requireWritable } from '../access/organization.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { type MutationResult } from '../types.js';
import { TeachingApiException, uniqueConflict, crmConflict, ConcealedTeachingPermissionDeniedException } from '../errors.js';
import { studentPackageToJson, creditLedgerEntryToJson, creditAdjustmentToJson } from '../serialization/credits.js';
import { lockStudentPackageForCreditMutation, studentPackageCreditBalance, refundLedgerIdempotencyKey, reversalLedgerIdempotencyKey } from '../credits/ledger.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const creditsRepository: Pick<TeachingSaasRepository,
  'listPackageProducts' | 'createPackageProduct' | 'listStudentPackages' | 'createStudentPackage' | 'listStudentPackageLedger' | 'listCreditAdjustments' | 'refundStudentPackageCredits' | 'reverseStudentPackageLedgerEntry'> = {
  async listPackageProducts(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'package_product.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM lesson_package_products WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT id, code, name, status, credit_unit, credit_type, total_credits,
                  validity_days, price_amount_minor, currency, created_at, updated_at
           FROM lesson_package_products
           WHERE organization_id = ?
           ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, name, id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          id: String(row.id), code: String(row.code), name: String(row.name), status: String(row.status),
          creditUnit: String(row.credit_unit), creditType: String(row.credit_type),
          totalCredits: Number(row.total_credits),
          validityDays: row.validity_days == null ? null : Number(row.validity_days),
          priceAmountMinor: Number(row.price_amount_minor), currency: String(row.currency),
          createdAt: new Date(String(row.created_at)).toISOString(),
          updatedAt: new Date(String(row.updated_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createPackageProduct(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'package_product.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'package_product.create', 60, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'package:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'package_product.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO lesson_package_products (
              organization_id, code, name, credit_unit, credit_type, total_credits,
              validity_days, price_amount_minor, currency, created_by_user_id
            ) VALUES (
              ${access.id}, ${input.code}, ${input.name}, ${input.creditUnit}, ${input.creditType},
              ${input.totalCredits}, ${input.validityDays}, ${input.priceAmountMinor}, ${input.currency}, ${actor.userId}
            )
            RETURNING id, code, name, status, credit_unit, credit_type, total_credits,
                      validity_days, price_amount_minor, currency, created_at, updated_at`;
          const row = rows[0] as Record<string, unknown>;
          const productId = String(row.id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'package_product.create', 'lesson_package_product', ${productId}, ${requestId},
              ${sql.json({ code: input.code, totalCredits: input.totalCredits })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: { packageProduct: {
              id: productId, code: String(row.code), name: String(row.name), status: String(row.status),
              creditUnit: String(row.credit_unit), creditType: String(row.credit_type),
              totalCredits: Number(row.total_credits),
              validityDays: row.validity_days == null ? null : Number(row.validity_days),
              priceAmountMinor: Number(row.price_amount_minor), currency: String(row.currency),
              createdAt: new Date(String(row.created_at)).toISOString(),
              updatedAt: new Date(String(row.updated_at)).toISOString(),
            } },
          };
          await completeIdempotency(tx, idem.id, result, 'lesson_package_product', productId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Package product code already exists in this organization');
      }
    });
  },

  async listStudentPackages(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const students = await query<Record<string, unknown>>(
        'SELECT id FROM student_profiles WHERE organization_id = ? AND id = ?',
        [access.id, studentId],
      );
      if (!students.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM student_packages WHERE organization_id = ? AND student_id = ?',
          [access.id, studentId],
        ),
        query<Record<string, unknown>>(
          `SELECT p.*,
                  COALESCE((SELECT SUM(l.delta) FROM lesson_credit_ledger l
                            WHERE l.organization_id = p.organization_id AND l.student_package_id = p.id), 0)::int
                    AS remaining_credits
           FROM student_packages p
           WHERE p.organization_id = ? AND p.student_id = ?
           ORDER BY p.created_at DESC, p.id
           LIMIT ? OFFSET ?`,
          [access.id, studentId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => studentPackageToJson(row, Number(row.remaining_credits))),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createStudentPackage(actor, slug, studentId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student_package.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'package:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'student_package.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const students = await tx`
            SELECT id FROM student_profiles WHERE organization_id = ${access.id} AND id = ${studentId}`;
          if (!students.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          const products = await tx`
            SELECT id, code, name, credit_unit, credit_type, total_credits, validity_days,
                   price_amount_minor, currency
            FROM lesson_package_products
            WHERE organization_id = ${access.id} AND id = ${input.productId} AND status = 'active'`;
          if (!products.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Active package product not found');
          const product = products[0] as Record<string, unknown>;
          const packages = await tx`
            INSERT INTO student_packages (
              organization_id, student_id, product_id, product_code_snapshot, product_name_snapshot,
              credit_unit, credit_type, entitled_credits, validity_days_snapshot, price_amount_minor,
              currency, acquisition_type, valid_from, valid_until, source_system, source_ref,
              source_line_ref, created_by_user_id
            ) VALUES (
              ${access.id}, ${studentId}, ${input.productId}, ${String(product.code)}, ${String(product.name)},
              ${String(product.credit_unit)}, ${String(product.credit_type)}, ${Number(product.total_credits)},
              ${product.validity_days == null ? null : Number(product.validity_days)}, ${Number(product.price_amount_minor)},
              ${String(product.currency)}, ${input.acquisitionType}, ${input.validFrom},
              CASE WHEN ${product.validity_days == null ? null : Number(product.validity_days)}::int IS NULL THEN NULL
                   ELSE ${input.validFrom}::timestamptz + (${product.validity_days == null ? null : Number(product.validity_days)}::int * INTERVAL '1 day') END,
              ${input.sourceSystem}, ${input.sourceRef}, ${input.sourceLineRef}, ${actor.userId}
            )
            RETURNING *`;
          const studentPackage = packages[0] as Record<string, unknown>;
          const studentPackageId = String(studentPackage.id);
          await tx`
            SELECT id FROM student_packages
            WHERE organization_id = ${access.id} AND id = ${studentPackageId}
            FOR UPDATE`;
          const entryType = input.acquisitionType === 'migration' ? 'adjustment' : input.acquisitionType;
          await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta, idempotency_key,
              source_system, source_ref, source_line_ref, reason, actor_user_id, actor_role,
              actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${studentPackageId}, ${studentId}, ${entryType}, ${Number(product.total_credits)},
              ${idempotencyKey}, ${input.sourceSystem}, ${input.sourceRef},
              ${input.sourceLineRef}, 'Initial entitlement', ${actor.userId}, ${access.role},
              ${actor.displayName}, ${sql.json({ productId: input.productId })}
            )`;
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student_package.create', 'student_package', ${studentPackageId}, ${requestId},
              ${sql.json({ studentId, productId: input.productId, acquisitionType: input.acquisitionType })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: {
              studentPackage: studentPackageToJson(
                studentPackage,
                Number(studentPackage.entitled_credits),
              ),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'student_package', studentPackageId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Student package source reference already exists');
      }
    });
  },

  async listStudentPackageLedger(actor, slug, studentPackageId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.ledger', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const packages = await query<Record<string, unknown>>(
        'SELECT id FROM student_packages WHERE organization_id = ? AND id = ?',
        [access.id, studentPackageId],
      );
      if (!packages.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM lesson_credit_ledger WHERE organization_id = ? AND student_package_id = ?',
          [access.id, studentPackageId],
        ),
        query<Record<string, unknown>>(
          `SELECT ledger.id, ledger.student_id, ledger.entry_type, ledger.delta,
                  ledger.attendance_id, ledger.session_id, ledger.source_system,
                  ledger.source_ref, ledger.source_line_ref, ledger.reversal_of_ledger_id,
                  reversed.id AS reversed_by_ledger_id, ledger.reason, ledger.actor_role,
                  ledger.actor_display_name, ledger.metadata, ledger.created_at
           FROM lesson_credit_ledger ledger
           LEFT JOIN lesson_credit_ledger reversed
             ON reversed.organization_id = ledger.organization_id
            AND reversed.reversal_of_ledger_id = ledger.id
           WHERE ledger.organization_id = ? AND ledger.student_package_id = ?
           ORDER BY ledger.created_at DESC, ledger.id DESC LIMIT ? OFFSET ?`,
          [access.id, studentPackageId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(creditLedgerEntryToJson),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async listCreditAdjustments(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'credit_adjustment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'finance:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count
           FROM lesson_credit_ledger
           WHERE organization_id = ?
             AND entry_type IN ('adjustment', 'refund', 'reversal', 'expiration')`,
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT ledger.id, ledger.student_package_id, ledger.student_id,
                  ledger.entry_type, ledger.delta, ledger.attendance_id, ledger.session_id,
                  ledger.source_system, ledger.source_ref, ledger.source_line_ref,
                  ledger.reversal_of_ledger_id, reversed.id AS reversed_by_ledger_id,
                  ledger.reason, ledger.actor_role, ledger.actor_display_name,
                  ledger.metadata, ledger.created_at,
                  student.display_name AS student_display_name,
                  package.product_code_snapshot, package.product_name_snapshot,
                  package.credit_unit, package.credit_type
           FROM lesson_credit_ledger ledger
           JOIN student_profiles student
             ON student.organization_id = ledger.organization_id
            AND student.id = ledger.student_id
           JOIN student_packages package
             ON package.organization_id = ledger.organization_id
            AND package.id = ledger.student_package_id
            AND package.student_id = ledger.student_id
           LEFT JOIN lesson_credit_ledger reversed
             ON reversed.organization_id = ledger.organization_id
            AND reversed.reversal_of_ledger_id = ledger.id
           WHERE ledger.organization_id = ?
             AND ledger.entry_type IN ('adjustment', 'refund', 'reversal', 'expiration')
           ORDER BY ledger.created_at DESC, ledger.id DESC
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(creditAdjustmentToJson),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async refundStudentPackageCredits(
    actor, slug, studentPackageId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'student_package.refund', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student_package.refund', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'finance:manage');
          const studentPackage = await lockStudentPackageForCreditMutation(
            tx, access.id, studentPackageId,
          );
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `student_package.refund:${studentPackageId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;

          const balance = await studentPackageCreditBalance(tx, access.id, studentPackageId);
          if (balance < input.credits) {
            throw new TeachingApiException('CONFLICT', 409, 'Refund would make the package credit balance negative');
          }
          const inserted = await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta,
              idempotency_key, source_system, source_ref, source_line_ref, reason,
              actor_user_id, actor_role, actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${studentPackageId}, ${String(studentPackage.student_id)},
              'refund', ${-input.credits}, ${refundLedgerIdempotencyKey(idempotencyKey)},
              ${input.sourceSystem}, ${input.sourceRef}, ${input.sourceLineRef}, ${input.reason},
              ${actor.userId}, ${access.role}, ${actor.displayName},
              ${sql.json({ credits: input.credits })}
            )
            RETURNING *`;
          const ledgerEntry = inserted[0] as Record<string, unknown>;
          const ledgerId = String(ledgerEntry.id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student_package.refund', 'lesson_credit_ledger', ${ledgerId}, ${requestId},
              ${sql.json({
                studentPackageId,
                credits: input.credits,
                sourceSystem: input.sourceSystem,
                sourceRef: input.sourceRef,
                sourceLineRef: input.sourceLineRef,
              })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: {
              ledgerEntry: creditLedgerEntryToJson(ledgerEntry),
              studentPackage: studentPackageToJson(studentPackage, balance - input.credits),
            },
          };
          await completeIdempotency(tx, idem.id, result, 'lesson_credit_ledger', ledgerId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Credit refund conflicts with the current package ledger');
      }
    });
  },

  async reverseStudentPackageLedgerEntry(
    actor, slug, studentPackageId, ledgerId, input, idempotencyKey, requestHash, requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'student_package.ledger.reversal', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student_package.ledger.reversal', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'finance:manage');
          const studentPackage = await lockStudentPackageForCreditMutation(
            tx, access.id, studentPackageId,
          );
          const targets = await tx`
            SELECT target.*, reversed.id AS reversed_by_ledger_id
            FROM lesson_credit_ledger target
            LEFT JOIN lesson_credit_ledger reversed
              ON reversed.organization_id = target.organization_id
             AND reversed.reversal_of_ledger_id = target.id
            WHERE target.organization_id = ${access.id}
              AND target.student_package_id = ${studentPackageId}
              AND target.id = ${ledgerId}`;
          if (!targets.length) {
            const existing = await tx`
              SELECT organization_id, student_package_id
              FROM lesson_credit_ledger
              WHERE id = ${ledgerId}`;
            if (existing.length && String(existing[0].organization_id) !== access.id) {
              throw new ConcealedTeachingPermissionDeniedException('Credit ledger entry not found');
            }
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Credit ledger entry not found');
          }
          const target = targets[0] as Record<string, unknown>;
          if (target.entry_type === 'reversal') {
            throw new TeachingApiException('CONFLICT', 409, 'A reversal entry cannot be reversed');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `student_package.ledger.reversal:${studentPackageId}:${ledgerId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (target.reversed_by_ledger_id != null) {
            throw new TeachingApiException('CONFLICT', 409, 'Credit ledger entry was already reversed');
          }

          const balance = await studentPackageCreditBalance(tx, access.id, studentPackageId);
          const delta = -Number(target.delta);
          if (balance + delta < 0) {
            throw new TeachingApiException('CONFLICT', 409, 'Reversal would make the package credit balance negative');
          }
          const inserted = await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta,
              idempotency_key, reversal_of_ledger_id, reason,
              actor_user_id, actor_role, actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${studentPackageId}, ${String(studentPackage.student_id)},
              'reversal', ${delta}, ${reversalLedgerIdempotencyKey(ledgerId, idempotencyKey)},
              ${ledgerId}, ${input.reason}, ${actor.userId}, ${access.role},
              ${actor.displayName}, ${sql.json({ reversedLedgerId: ledgerId })}
            )
            RETURNING *`;
          const ledgerEntry = inserted[0] as Record<string, unknown>;
          const reversalLedgerId = String(ledgerEntry.id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student_package.ledger.reversal', 'lesson_credit_ledger',
              ${reversalLedgerId}, ${requestId},
              ${sql.json({ studentPackageId, reversedLedgerId: ledgerId, delta })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: {
              ledgerEntry: creditLedgerEntryToJson(ledgerEntry),
              studentPackage: studentPackageToJson(studentPackage, balance + delta),
            },
          };
          await completeIdempotency(
            tx, idem.id, result, 'lesson_credit_ledger', reversalLedgerId,
          );
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Credit reversal conflicts with the current package ledger');
      }
    });
  },
};
