import { query, sql } from '../../db/connection.js';
import { withDeniedAccessAudit } from '../access/audit.js';
import { accessForRead, requirePermission, accessForWrite, requireWritable } from '../access/organization.js';
import { trainingTemplateToJson, trainingTemplateVersionToJson } from '../serialization/training.js';
import { trainingResourceMissing, insertTrainingAudit } from '../training/assignments.js';
import { type JsonObject, type MutationResult, type PageResult } from '../types.js';
import { consumeMutationAttempt, beginIdempotency, completeIdempotency } from '../transactions.js';
import { TeachingApiException, crmConflict } from '../errors.js';
import type { TeachingSaasRepository } from '../repository-contract.js';

export const trainingTemplatesRepository: Pick<TeachingSaasRepository,
  'listTrainingTemplates' | 'getTrainingTemplate' | 'createTrainingTemplate' | 'listTrainingTemplateVersions' | 'createTrainingTemplateVersion' | 'archiveTrainingTemplate'> = {
  async listTrainingTemplates(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'training:template:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM training_templates WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT template.*,
                  (SELECT MAX(version_number) FROM training_template_versions version
                   WHERE version.organization_id = template.organization_id
                     AND version.template_id = template.id) AS latest_version_number
           FROM training_templates template
           WHERE template.organization_id = ?
           ORDER BY CASE template.status WHEN 'active' THEN 0 ELSE 1 END,
                    template.name, template.id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(trainingTemplateToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getTrainingTemplate(actor, slug, templateId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:template:read');
        const rows = await tx`
          SELECT template.*,
                 (SELECT MAX(version_number) FROM training_template_versions version
                  WHERE version.organization_id = template.organization_id
                    AND version.template_id = template.id) AS latest_version_number
          FROM training_templates template
          WHERE template.organization_id = ${access.id} AND template.id = ${templateId}`;
        if (!rows.length) {
          await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
        }
        return trainingTemplateToJson(rows[0] as Record<string, unknown>);
      }) as JsonObject;
    });
  },

  async createTrainingTemplate(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'training.template.create', 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.create', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'training.template.create', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO training_templates (
              organization_id, name, description, created_by_user_id
            ) VALUES (${access.id}, ${input.name}, ${input.description}, ${actor.userId})
            RETURNING *`;
          const templateId = String(rows[0].id);
          const template = trainingTemplateToJson({ ...rows[0], latest_version_number: null });
          await insertTrainingAudit(
            tx, access, actor, 'training.template.create', 'training_template', templateId,
            requestId, { name: input.name },
          );
          const result: MutationResult = { status: 201, body: { template } };
          await completeIdempotency(tx, idem.id, result, 'training_template', templateId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template could not be created');
      }
    });
  },

  async listTrainingTemplateVersions(actor, slug, templateId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.version.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:template:read');
        const templates = await tx`
          SELECT 1 FROM training_templates
          WHERE organization_id = ${access.id} AND id = ${templateId}`;
        if (!templates.length) {
          await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total FROM training_template_versions
          WHERE organization_id = ${access.id} AND template_id = ${templateId}`;
        const rows = await tx`
          SELECT * FROM training_template_versions
          WHERE organization_id = ${access.id} AND template_id = ${templateId}
          ORDER BY version_number DESC, id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map(trainingTemplateVersionToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createTrainingTemplateVersion(
    actor, slug, templateId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.template.version.create:${templateId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.version.create', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const templates = await tx`
            SELECT * FROM training_templates
            WHERE organization_id = ${access.id} AND id = ${templateId}
            FOR UPDATE`;
          if (!templates.length) {
            await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.template.version.create:${templateId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(templates[0].status) !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Archived training templates cannot receive versions');
          }
          const rows = await tx`
            INSERT INTO training_template_versions (
              organization_id, template_id, version_number, title, instructions,
              source, activity, tool_config, created_by_user_id, published_by_user_id
            ) SELECT ${access.id}, ${templateId},
                     COALESCE(MAX(version_number), 0) + 1,
                     ${input.title}, ${input.instructions}, ${input.source}, ${input.activity},
                     ${sql.json(input.toolConfig)}, ${actor.userId}, ${actor.userId}
              FROM training_template_versions
             WHERE organization_id = ${access.id} AND template_id = ${templateId}
            RETURNING *`;
          const versionId = String(rows[0].id);
          const templateVersion = trainingTemplateVersionToJson(rows[0] as Record<string, unknown>);
          await insertTrainingAudit(
            tx, access, actor, 'training.template.version.create', 'training_template_version',
            versionId, requestId, { templateId, versionNumber: Number(rows[0].version_number) },
          );
          const result: MutationResult = { status: 201, body: { templateVersion } };
          await completeIdempotency(tx, idem.id, result, 'training_template_version', versionId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template version could not be created');
      }
    });
  },

  async archiveTrainingTemplate(actor, slug, templateId, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, `training.template.archive:${templateId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.archive', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const rows = await tx`
            SELECT * FROM training_templates
            WHERE organization_id = ${access.id} AND id = ${templateId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.template.archive:${templateId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Training template is already archived');
          }
          const archived = await tx`
            UPDATE training_templates
            SET status = 'archived', archived_at = clock_timestamp()
            WHERE organization_id = ${access.id} AND id = ${templateId}
            RETURNING *`;
          const versionRows = await tx`
            SELECT MAX(version_number) AS latest_version_number
            FROM training_template_versions
            WHERE organization_id = ${access.id} AND template_id = ${templateId}`;
          const template = trainingTemplateToJson({
            ...archived[0], latest_version_number: versionRows[0]?.latest_version_number,
          });
          await insertTrainingAudit(
            tx, access, actor, 'training.template.archive', 'training_template', templateId,
            requestId, { reason: 'manual_archive' },
          );
          const result: MutationResult = { status: 200, body: { template } };
          await completeIdempotency(tx, idem.id, result, 'training_template', templateId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template could not be archived');
      }
    });
  },
};
