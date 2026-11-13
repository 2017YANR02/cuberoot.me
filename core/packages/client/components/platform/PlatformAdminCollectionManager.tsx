'use client';

import { useT } from '@/hooks/useT';
import { editableEntity } from './PlatformFormValues';
import { text, ADMIN_FORMS } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';
import { type CommonProps } from './PlatformActionTypes';

export function PlatformAdminCollectionManager({ definition, entities = [], busy, runAction }: CommonProps) {
  const t = useT();
  const base = ADMIN_FORMS[definition.id];
  if (!base || !['admin-paths', 'admin-coupons', 'admin-invites', 'admin-qr-prompts'].includes(definition.id)) return null;
  const qrTemplates = definition.id === 'admin-qr-prompts';
  return (
    <div className="platform-domain-stack">
      <DomainForm definition={definition} busy={busy} runAction={runAction} spec={base} />
      {entities.map((raw) => {
        const entity = editableEntity(raw);
        const archived = entity.status === 'archived';
        return (
          <section className="platform-domain-actions" key={entity.id}>
            <DomainForm definition={definition} entity={entity} resourceId={entity.id} busy={busy} runAction={runAction} spec={{ ...base, title: text(`编辑：${entity.title}`, `Edit: ${entity.title}`) }} />
            <div className="platform-write-actions">
              {archived && qrTemplates ? <ActionButton action="qr-template-restore" resourceId={entity.id} label={text('恢复模板', 'Restore template')} busy={busy} runAction={runAction} /> : (
                <ActionButton action="admin-delete" resourceId={entity.id} label={text('归档', 'Archive')} confirm={text('确定归档这条记录吗？', 'Archive this record?')} busy={busy} runAction={runAction} />
              )}
              {archived && qrTemplates ? <ActionButton action="qr-template-purge" resourceId={entity.id} label={text('永久删除', 'Permanently delete')} confirm={text('这会永久删除模板，确定继续吗？', 'This permanently deletes the template. Continue?')} busy={busy} runAction={runAction} /> : null}
            </div>
          </section>
        );
      })}
      {qrTemplates && entities.length ? (
        <DomainForm definition={definition} busy={busy} runAction={runAction} spec={{
          title: text('保存当前排序', 'Save current order'),
          action: 'qr-template-reorder',
          fields: [],
          payloadBase: { items: entities.map((item, index) => ({ id: item.id, sortOrder: index })) },
        }} />
      ) : null}
      {entities.length === 0 ? <p className="platform-domain-note">{t('创建第一条记录后，可在此逐项编辑和归档。', 'After creating the first record, it can be edited and archived here.')}</p> : null}
    </div>
  );
}
