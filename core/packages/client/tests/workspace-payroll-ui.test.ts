// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { WorkspaceProvider, workspaceText, type WorkspaceHost } from '@app-foundation/workspace-ui';
import type { PayrollEmployee } from '@cuberoot/shared/workspace-planning';
import Payroll from '@/app/[lang]/workspace/Payroll';
import { WorkspaceButton, WorkspaceDialog } from '@/app/[lang]/workspace/WorkspaceControls';

vi.mock('@/hooks/useT', () => {
  const t = (_zh: string, en: string) => en;
  return { useT: () => t };
});

it('uses the monthly statement to approve exact attendance entries and record the updated payment', async () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const rootNode = document.createElement('div');
  document.body.append(rootNode);
  const root = createRoot(rootNode);
  const calls: { action: string; body: unknown }[] = [];
  let employee: PayrollEmployee = {
    userId: 12, name: 'Employee', dailyRateCents: 30000, canReport: true,
    attendance: [
      { date:'2026-10-10', halfDays:1, version:4, approved:false, dailyRateCents:30000, amountCents:15000 },
      { date:'2026-10-11', halfDays:2, version:2, approved:false, dailyRateCents:30000, amountCents:30000 },
    ],
    projects: [{ id:'project-id', title:'Release', acceptedDate:'2026-10-20', amountCents:100000, bonusCents:15000 }],
    onsiteCents:0, projectCents:100000, bonusCents:15000, totalCents:115000, paidAt:null,
  };
  const api: WorkspaceHost['api'] = async <T>(action: string, body?: unknown): Promise<T> => {
    if (body !== undefined) {
      calls.push({action, body});
      if (action === 'payroll-attendance-approve') {
        employee = { ...employee, attendance:employee.attendance.map(row => ({ ...row, approved:true })), onsiteCents:45000, totalCents:160000 };
      }
      if (action === 'payroll-paid') employee = { ...employee, paidAt:'2026-11-15T05:00:00Z' };
      return {} as T;
    }
    return { month:'2026-10', payDate:'2026-11-15', closed:true, canManage:true, rows:[employee] } as T;
  };
  const host: WorkspaceHost = {
    api, navigate:vi.fn(), t: text => workspaceText('en', text),
    Link: props => h('a', props), Button:WorkspaceButton, Dialog:WorkspaceDialog,
  };
  const button = (label: string) => [...rootNode.querySelectorAll('button')].find(node => node.textContent === label);
  const click = async (label: string) => {
    const target = button(label);
    expect(target, label).toBeDefined();
    await act(async () => target!.click());
  };
  try {
    await act(async () => root.render(h(WorkspaceProvider, {host, children:h(Payroll)})));
    expect(rootNode.textContent).toMatch(/Pay date 2026-11-15/);
    expect(rootNode.textContent).toMatch(/Amount due .*1,150/);
    expect(rootNode.textContent).toMatch(/Half day.*150/);
    expect(button('Record payment')).toBeUndefined();
    await click('Approve all pending attendance');
    expect(calls[0]).toEqual({
      action:'payroll-attendance-approve',
      body:{ userId:12, month:'2026-10', entries:[{date:'2026-10-10', version:4}, {date:'2026-10-11', version:2}] },
    });
    expect(rootNode.textContent).toMatch(/Amount due .*1,600/);
    await click('Record payment');
    await click('Confirm payment made');
    expect(calls[1]).toEqual({ action:'payroll-paid', body:{userId:12, month:'2026-10', expectedTotalCents:160000} });
    expect(rootNode.textContent).toContain('Payment recorded');
    expect(button('Record payment')).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
    rootNode.remove();
  }
});
