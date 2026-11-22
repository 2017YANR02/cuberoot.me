import type { JSONContent } from '@tiptap/react';
import { isValidIsoDate } from '@cuberoot/shared/iso-date';
import { PROJECT_MAX_CENTS } from '@cuberoot/shared/workspace-planning';
import { parseCnyCents } from './workspace-money';

export type InternshipFields = {
  employeeName: string; identity: string; school: string; major: string; year: string; studentId: string;
  phone: string; email: string; emergencyContact: string;
  role: string; duties: string; start: string; end: string; schedule: string; location: string;
  allowance: string; paymentTime: string; settlement: InternshipSettlement; mentor: string; mentorRole: string;
  bank: string; accountName: string; accountNumber: string;
};

export type InternshipSettlement = 'project' | 'daily' | 'scheduled';
type FieldKey = Exclude<keyof InternshipFields, 'settlement'>;
type Slot = {index: number; from: number; to: number; key: FieldKey; current: string};

// Recognize the imported Chinese internship agreement by its numbered clauses and
// labels. Other collaborative documents continue to open in the full-text editor.
const clauses = [
  [/^乙方（实习生）：(.*?)(?:（以下简称.*)?$/d, 'employeeName'],
  [/^身份证号码：(.*)$/d, 'identity'],
  [/^所在学校及院系：(.*?)专业：(.*)$/d, 'school', 'major'],
  [/^年级\/学制：(.*?)学号：(.*)$/d, 'year', 'studentId'],
  [/^联系电话：(.*?)电子邮箱：(.*)$/d, 'phone', 'email'],
  [/^紧急联系人及电话：(.*)$/d, 'emergencyContact'],
  [/^2\.1\s+实习岗位：(.*)$/d, 'role'],
  [/^2\.3\s+实习期限：自(.*?)起，至(.*?)止。$/d, 'start', 'end'],
  [/^3\.1\s+.*?标准为：(.*?)，于(.*?)支付至乙方银行账户：$/d, 'allowance', 'paymentTime'],
  [/^4\.1\s+.*?（指导老师：(.*?)，职位：(.*?)）负责.*$/d, 'mentor', 'mentorRole'],
  [/^开户行：(.*)$/d, 'bank'],
  [/^户名：(.*)$/d, 'accountName'],
  [/^账号：(.*)$/d, 'accountNumber'],
] as const satisfies readonly (readonly [RegExp, ...FieldKey[]])[];
const locationHeading = '实习地点与方式：';
export const MONTHLY_PAYMENT_TIME = '次月15日';
const dailyPrefix = '3.1 甲方按日薪计算乙方实习津贴，标准为：';
const projectPrefix = '3.1 甲方按项目计算乙方实习津贴，标准为：';
const projectRate = '以双方事先确认的各项目任务卡所列金额为准';
const projectTermsText = '双方在开工前通过项目任务卡确认项目金额、预计交付日期、验收标准和验收奖金。项目通过验收后，项目金额及已确认的验收奖金计入验收通过当月的报酬，次月15日支付。交付日期如需调整，由双方确认，延期不自动扣减报酬。';
const legacyProjectTermsText = '另行约定的项目金额、预计交付日期、验收标准和验收奖金，以双方确认的项目任务卡为准。另行约定的项目金额及验收通过后确认的奖金，按本条约定的支付周期结算。交付日期如需调整，由双方确认，延期不自动扣减报酬。';
const dailyTermsText = '当月实习津贴按确认的实际出勤计算。工作一天按一日津贴计，工作半天按一半日津贴计，次月15日统一支付。';
const paymentTimeValue = (text: string) => text.replace(/前$/, '');
const listKinds = new Set(['bulletList', 'orderedList']);
const inlineText = (node: JSONContent) => (node.content ?? []).map(child => child.text ?? '').join('');
const itemText = (item: JSONContent) => (item.content ?? []).map(inlineText).join('\n');

function toIso(date: string) {
  const parts = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日$/.exec(date);
  return parts ? `${parts[1]}-${parts[2].padStart(2,'0')}-${parts[3].padStart(2,'0')}` : date;
}
function dateForAgreement(date: string) {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}
export function validInternshipPeriod(start: string, end: string) {
  return isValidIsoDate(start) && isValidIsoDate(end) && start <= end;
}

export function internshipDailyRateCents(rate: string) {
  const price = /^(?:人民币\s*)?(\d+(?:\.\d{1,2})?)(?:\s*元\s*[/／]\s*日)?$/.exec(rate.trim());
  if (!price) return null;
  const cents = parseCnyCents(price[1]);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= PROJECT_MAX_CENTS ? cents : null;
}

export function readInternshipTemplate(document: JSONContent) {
  const paragraphs = document.content ?? [];
  const text = paragraphs.map(block => block.type === 'paragraph' ? inlineText(block) : '');
  const dutiesIndex = text.findIndex(line => /^2\.2\s+实习内容/.test(line)) + 1;
  const scheduleIndex = text.findIndex(line => /^2\.4\s+实习方式与时间/.test(line)) + 1;
  const duties = paragraphs[dutiesIndex];
  const schedule = paragraphs[scheduleIndex];
  if (!dutiesIndex || !scheduleIndex || !duties?.type || !schedule?.type ||
      !listKinds.has(duties.type) || !listKinds.has(schedule.type) || !schedule.content?.length) return null;
  const slots: Slot[] = [];
  const values: Partial<InternshipFields> = {};
  for (const [pattern, ...keys] of clauses) {
    const matches = text.flatMap((line, index) => {
      const match = pattern.exec(line);
      return match ? [{match, index}] : [];
    });
    if (matches.length !== 1) return null;
    const [{match, index}] = matches;
    for (const [position, key] of keys.entries()) {
      const [from, to] = match.indices![position + 1]!;
      const current = match[position + 1].trim();
      slots.push({index, from, to, key, current});
      values[key] = current;
    }
  }
  // The optional confidentiality receipt repeats the identity number.
  for (const [index, line] of text.entries()) {
    const match = /^身份证号：(.*)$/d.exec(line);
    if (match) {
      const [from, to] = match.indices![1]!;
      slots.push({index, from, to, key:'identity', current:match[1].trim()});
    }
  }
  if (slots.some(slot => paragraphs[slot.index].content?.some(node => node.type !== 'text'))) return null;
  const scheduleItems = schedule.content;
  const location = scheduleItems.find(item => itemText(item).startsWith(locationHeading));
  values.start = toIso(values.start!);
  values.end = toIso(values.end!);
  values.paymentTime = paymentTimeValue(values.paymentTime!);
  const compensation = text[slots.find(slot => slot.key === 'allowance')!.index];
  values.settlement = values.allowance === projectRate ? 'project'
    : compensation.startsWith(dailyPrefix) ? 'daily' : 'scheduled';
  if (values.settlement === 'project') values.allowance = '';
  values.duties = (duties.content ?? []).map(itemText).join('\n');
  values.schedule = itemText(scheduleItems[0]);
  values.location = location ? itemText(location).slice(locationHeading.length).trim() : '';
  const paymentTermsIndex = text.findIndex(line => [projectTermsText, legacyProjectTermsText, dailyTermsText].includes(line));
  return {values: values as InternshipFields, slots, dutiesIndex, scheduleIndex, paymentTermsIndex};
}

export function defaultInternshipSettlement(fields: InternshipFields, title: string): Exclude<InternshipSettlement, 'scheduled'> {
  if (fields.settlement !== 'scheduled') return fields.settlement;
  for (const description of [fields.location, title]) {
    if (/远程|线上|\b(?:remote|online)\b/i.test(description)) return 'project';
    if (/线下|现场|\bon[- ]?site\b/i.test(description)) return 'daily';
  }
  return 'daily';
}

function replaceInline(block: JSONContent, from: number, to: number, text: string): JSONContent {
  const runs = block.content ?? [];
  let offset = 0;
  const spans = runs.map(run => {
    const start = offset;
    offset += run.text?.length ?? 0;
    return {run, start, end: offset};
  });
  const before = spans.flatMap(({run, start, end}) => {
    if (end <= from) return [run];
    return start < from ? [{...run, text: run.text!.slice(0, from - start)}] : [];
  });
  const after = spans.flatMap(({run, start, end}) => {
    if (start >= to) return [run];
    return end > to ? [{...run, text: run.text!.slice(to - start)}] : [];
  });
  const inserted = text ? [{ type: 'text', text, marks: spans.find(span => span.end > from)?.run.marks }] : [];
  return {...block, content: [...before, ...inserted, ...after]};
}
const listItem = (text: string): JSONContent => ({
  type:'listItem', content:[{type:'paragraph', content: text ? [{type:'text', text}] : []}],
});

export function fillInternshipTemplate(document: JSONContent, values: InternshipFields): JSONContent {
  const template = readInternshipTemplate(document);
  if (!template) return document;
  const children = [...document.content!];
  const project = values.settlement === 'project';
  const daily = values.settlement === 'daily';
  for (const {index, from, to, key, current} of template.slots.toReversed()) {
    const value = key === 'allowance' && project ? projectRate
      : key === 'paymentTime' && (project || daily) ? MONTHLY_PAYMENT_TIME : values[key].trim();
    const previous = key === 'start' || key === 'end' ? toIso(current)
      : key === 'paymentTime' && !project && !daily ? paymentTimeValue(current) : current;
    if (value === previous) continue;
    const text = key === 'start' || key === 'end' ? dateForAgreement(value)
      : key === 'paymentTime' && value && !project && !daily ? value + '前' : value;
    // Leave space between adjacent profile labels even when the old value was blank.
    const line = inlineText(children[index]);
    const separator = ['school','year','phone'].includes(key) ? ' ' : '';
    const nameSpace = key === 'employeeName' && line.slice(to).startsWith('（') ? ' ' : '';
    children[index] = replaceInline(children[index], from, to, text + separator + nameSpace);
  }
  const {dutiesIndex, scheduleIndex} = template;
  if (values.duties !== template.values.duties) {
    const duties = values.duties.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    children[dutiesIndex] = {...children[dutiesIndex], content: (duties.length ? duties : ['']).map(listItem)};
  }
  if (values.schedule !== template.values.schedule || values.location !== template.values.location) {
    const items = children[scheduleIndex].content!;
    const lead = values.schedule === template.values.schedule ? items[0] : listItem(values.schedule);
    children[scheduleIndex] = {...children[scheduleIndex], content: [lead,
      ...(values.location ? [listItem(locationHeading + values.location)] : []),
      ...items.slice(1).filter(item => !itemText(item).startsWith(locationHeading)),
    ]};
  }
  if (project || daily) {
    const {index, from} = template.slots.find(slot => slot.key === 'allowance')!;
    const prefix = project ? projectPrefix : dailyPrefix;
    if (!inlineText(children[index]).startsWith(prefix)) {
      children[index] = replaceInline(children[index], 0, from, prefix);
    }
    const termsIndex = template.paymentTermsIndex;
    const terms = project ? projectTermsText : dailyTermsText;
    const paragraph = {type:'paragraph', content:[{type:'text', text:terms}]};
    const bankAccount = template.slots.find(slot => slot.key === 'accountNumber')!;
    if (termsIndex < 0) children.splice(bankAccount.index + 1, 0, paragraph);
    else if (inlineText(children[termsIndex]) !== terms) children[termsIndex] = paragraph;
  }
  return {...document, content: children};
}

export function prepareInternshipDraft(document: JSONContent, employeeName: string, title: string) {
  const template = readInternshipTemplate(document);
  if (!template) return document;
  return fillInternshipTemplate(document, {...template.values,
    employeeName, identity:'', school:'', major:'', year:'', studentId:'', phone:'', email:'', emergencyContact:'',
    start:'', end:'', allowance:'', bank:'', accountName:'', accountNumber:'',
    settlement: defaultInternshipSettlement(template.values, title),
  });
}

export function completeInternshipFields(values: InternshipFields) {
  return Boolean(values.employeeName.trim() && values.role.trim() && values.duties.trim() &&
    (values.settlement === 'project' || (values.settlement === 'daily' && internshipDailyRateCents(values.allowance))) &&
    values.paymentTime === MONTHLY_PAYMENT_TIME && values.schedule.trim())
    && validInternshipPeriod(values.start, values.end);
}
