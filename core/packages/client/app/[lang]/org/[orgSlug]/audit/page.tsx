'use client';

import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import {
  TEACHING_AUDIT_OUTCOMES,
  hasTeachingPermission,
  type TeachingAuditEvent,
  type TeachingAuditOutcome,
} from '@cuberoot/shared/teaching';
import SearchInput from '@/components/SearchInput';
import {
  TeachingPagination,
  teachingDateTime,
  teachingRoleLabel,
  useTeachingPage,
} from '@/components/teaching/TeachingUi';
import { useT } from '@/hooks/useT';
import { listTeachingAuditEvents } from '@/lib/teaching-saas-api';
import { cellAddress, type SpreadsheetSheet } from '@/lib/spreadsheet-model';
import { escapeSpreadsheetTextCell, exportSpreadsheetCsv } from '@/lib/spreadsheet-export';
import OrgWorkspace from '../../_components/OrgWorkspace';

const PAGE_SIZE = 30;

function auditOutcomeLabel(outcome: TeachingAuditOutcome, t: ReturnType<typeof useT>): string {
  const labels: Record<TeachingAuditOutcome, [string, string]> = {
    succeeded: ['成功', 'Succeeded'],
    denied: ['已拒绝', 'Denied'],
    failed: ['失败', 'Failed'],
  };
  return t(labels[outcome][0], labels[outcome][1]);
}

function auditEventSheet(events: TeachingAuditEvent[], t: ReturnType<typeof useT>): SpreadsheetSheet {
  const headers = [
    t('时间', 'Time'),
    t('操作人', 'Actor'),
    t('角色', 'Role'),
    t('操作', 'Action'),
    t('对象类型', 'Entity type'),
    t('对象编号', 'Entity ID'),
    t('结果', 'Outcome'),
    t('请求编号', 'Request ID'),
  ];
  const rows = events.map((event) => [
    event.createdAt,
    event.actorDisplayName,
    event.actorRole ? teachingRoleLabel(event.actorRole, t) : t('系统', 'System'),
    event.action,
    event.entityType,
    event.entityId ?? '',
    auditOutcomeLabel(event.outcome, t),
    event.requestId ?? '',
  ]);
  const cells: Record<string, string> = {};
  const styles: SpreadsheetSheet['styles'] = {};
  headers.forEach((value, column) => {
    const address = cellAddress(0, column);
    cells[address] = value;
    styles[address] = { bold: true };
  });
  rows.forEach((row, rowIndex) => row.forEach((value, column) => {
    cells[cellAddress(rowIndex + 1, column)] = escapeSpreadsheetTextCell(value);
  }));
  return {
    id: 'audit-events',
    name: t('当前页', 'Current page'),
    rowCount: rows.length + 1,
    columnCount: headers.length,
    cells,
    styles,
    widths: { A: 23, B: 20, C: 14, D: 28, E: 20, F: 38, G: 14, H: 38 },
    frozenRows: 1,
  };
}

export default function OrganizationAuditPage() {
  const params = useParams<{ orgSlug: string }>();
  const t = useT();
  const [{ q, outcome, page: rawPage }, setQuery] = useQueryStates({
    q: parseAsString.withDefault(''),
    outcome: parseAsStringEnum<TeachingAuditOutcome>([...TEACHING_AUDIT_OUTCOMES]),
    page: parseAsInteger.withDefault(1),
  });
  const page = Math.max(1, rawPage);
  return (
    <OrgWorkspace orgSlug={params.orgSlug}>
      {(organization) => hasTeachingPermission(organization.role, 'audit:read')
        ? (
            <AuditContent
              orgSlug={params.orgSlug}
              page={page}
              q={q}
              outcome={outcome}
              setQuery={setQuery}
            />
          )
        : <p role="alert">{t('你没有查看机构审计日志的权限。', 'You do not have permission to view the organization audit log.')}</p>}
    </OrgWorkspace>
  );
}

function AuditContent({
  orgSlug,
  page,
  q,
  outcome,
  setQuery,
}: {
  orgSlug: string;
  page: number;
  q: string;
  outcome: TeachingAuditOutcome | null;
  setQuery: (values: { q?: string | null; outcome?: TeachingAuditOutcome | null; page?: number | null }) => Promise<URLSearchParams>;
}) {
  const t = useT();
  const [exporting, setExporting] = useState(false);
  const loader = useCallback(
    () => listTeachingAuditEvents(orgSlug, page, PAGE_SIZE, { q: q.trim() || undefined, outcome }),
    [orgSlug, outcome, page, q],
  );
  const auditEvents = useTeachingPage(loader);

  async function exportCurrentPage() {
    if (!auditEvents.result?.items.length) return;
    setExporting(true);
    try {
      const sheet = auditEventSheet(auditEvents.result.items, t);
      await exportSpreadsheetCsv(t('机构审计日志', 'Organization audit log'), sheet);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <h2>{t('审计日志', 'Audit log')}</h2>
      <p className="org-lead">{t('查看机构内的重要读取、写入与拒绝记录。搜索匹配操作人、操作、对象和请求编号。', 'Review important reads, writes, and denied actions in this organization. Search matches actors, actions, entities, and request IDs.')}</p>

      <div className="org-form">
        <label>
          {t('搜索', 'Search')}
          <SearchInput
            value={q}
            onChange={(value) => { void setQuery({ q: value.slice(0, 100) || null, page: 1 }); }}
            placeholder={t('操作人、操作、对象或请求编号', 'Actor, action, entity, or request ID')}
            ariaLabel={t('搜索审计日志', 'Search the audit log')}
            inputClassName="org-form-control"
          />
        </label>
        <label>
          {t('结果', 'Outcome')}
          <select
            className="org-form-control"
            value={outcome ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value as TeachingAuditOutcome | '';
              void setQuery({ outcome: value || null, page: 1 });
            }}
          >
            <option value="">{t('全部结果', 'All outcomes')}</option>
            {TEACHING_AUDIT_OUTCOMES.map((value) => (
              <option value={value} key={value}>{auditOutcomeLabel(value, t)}</option>
            ))}
          </select>
        </label>
        <div className="org-form-actions">
          <button
            className="org-secondary-button"
            type="button"
            disabled={exporting || !auditEvents.result?.items.length}
            onClick={() => { void exportCurrentPage(); }}
          >
            {exporting ? t('正在导出…', 'Exporting…') : t('导出当前页 CSV', 'Export current page CSV')}
          </button>
        </div>
      </div>

      {auditEvents.loading ? <p aria-busy="true">{t('正在加载…', 'Loading…')}</p> : auditEvents.error ? (
        <p role="alert">{auditEvents.error}</p>
      ) : !auditEvents.result?.items.length ? (
        <p className="org-empty">{t('没有符合条件的审计记录。', 'No matching audit events were found.')}</p>
      ) : (
        <div className="org-list">
          {auditEvents.result.items.map((event) => (
            <div className="org-row" key={event.id}>
              <div className="org-row-main">
                <div className="org-row-title">{event.actorDisplayName} {event.actorRole ? teachingRoleLabel(event.actorRole, t) : t('系统', 'System')}</div>
                <div className="org-row-meta">{event.action} / {event.entityType}{event.entityId ? ` / ${event.entityId}` : ''}</div>
                <div className="org-row-meta">{teachingDateTime(event.createdAt)}{event.requestId ? ` / ${t('请求', 'Request')} ${event.requestId}` : ''}</div>
              </div>
              <span className="org-status">{auditOutcomeLabel(event.outcome, t)}</span>
            </div>
          ))}
        </div>
      )}

      {auditEvents.result && (
        <TeachingPagination
          page={auditEvents.result.page}
          pageSize={auditEvents.result.pageSize}
          total={auditEvents.result.total}
          baseHref={`/org/${orgSlug}/audit`}
          query={{ q: q.trim() || null, outcome }}
        />
      )}
    </>
  );
}
