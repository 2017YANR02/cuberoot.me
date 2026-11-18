'use client';

import { useState } from 'react';
import { Field, Form, value } from '@app-foundation/workspace-ui';
import { DateRangeInput } from '@/components/DateRangeInput';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { WorkspaceButton as Button } from './WorkspaceControls';
import { validInternshipPeriod, type InternshipFields } from './contract-template-fields';

export default function InternshipFieldForm({initial, onApply, onCancel}: {
  initial: InternshipFields;
  onApply: (fields: InternshipFields) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [period, setPeriod] = useState({from: initial.start, to: initial.end});
  const field = (key: keyof InternshipFields, label: string, required = false) => (
    <Field label={label} width="medium">
      <input name={key} defaultValue={initial[key]} required={required} maxLength={220} />
    </Field>
  );
  return <Form submit={async data => {
    if ((period.from || period.to) && !validInternshipPeriod(period.from, period.to)) {
      throw new Error(t('请填写完整的实习起止日期，结束日期不能早于开始日期。', 'Enter a complete internship period with the end date on or after the start date.'));
    }
    const fields = {...initial, start: period.from, end: period.to};
    for (const key of Object.keys(initial) as (keyof InternshipFields)[]) {
      if (data.has(key)) fields[key] = value(data,key).trim();
    }
    onApply(fields);
  }}>
    <h2>{t('合同填写项', 'Contract fields')}</h2>
    <div className="staff-form-row staff-actions">
      {field('employeeName', t('乙方姓名', 'Employee name'), true)}
      {field('role', t('实习岗位', 'Internship role'), true)}
    </div>
    <DateRangeInput from={period.from} to={period.to} onChange={(from,to) => setPeriod({from,to})} ariaLabel={t('实习期限', 'Internship period')} fromLabel={t('实习开始日期', 'Internship start date')} toLabel={t('实习结束日期', 'Internship end date')} />
    <Field label={t('工作内容（每行一项）', 'Duties (one per line)')} width="wide">
      <textarea name="duties" defaultValue={initial.duties} rows={5} maxLength={3500} required />
    </Field>
    <div className="staff-form-row staff-actions">
      {field('location', t('实习地点与方式', 'Work location and arrangement'))}
      {field('schedule', t('每周实习安排', 'Weekly schedule'), true)}
      {field('mentor', t('指导老师', 'Mentor'))}
      {field('mentorRole', t('指导老师职位', 'Mentor’s role'))}
      {field('allowance', t('津贴标准（金额和计费单位）', 'Allowance (amount and unit)'))}
      {field('paymentTime', t('支付时间', 'Payment schedule'))}
    </div>
    <details>
      <MoreToggle as="summary">{t('学籍、联系方式与收款资料', 'Education, contact and payment details')}</MoreToggle>
      <div className="staff-form-row staff-actions">
        {field('school', t('学校及院系', 'School and department'))}
        {field('major', t('专业', 'Major'))}
        {field('year', t('年级和学制', 'Year and program length'))}
        {field('studentId', t('学号', 'Student number'))}
        {field('identity', t('身份证号码', 'Identity number'))}
        {field('phone', t('联系电话', 'Phone'))}
        {field('email', t('电子邮箱', 'Email'))}
        {field('emergencyContact', t('紧急联系人及电话', 'Emergency contact and phone'))}
        {field('bank', t('开户行', 'Bank'))}
        {field('accountName', t('收款户名', 'Account holder'))}
        {field('accountNumber', t('收款账号', 'Account number'))}
      </div>
    </details>
    <div className="staff-actions">
      <Button type="submit">{t('填入正文', 'Fill contract body')}</Button>
      <Button variant="secondary" onClick={onCancel}>{t('返回正文', 'Back to contract body')}</Button>
    </div>
  </Form>;
}
