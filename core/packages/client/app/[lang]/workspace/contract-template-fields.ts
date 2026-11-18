import type { JSONContent } from '@tiptap/react';
import { isValidIsoDate } from '@cuberoot/shared/iso-date';

export type InternshipFields = {
  employeeName: string; identity: string; school: string; major: string; year: string; studentId: string;
  phone: string; email: string; emergencyContact: string;
  role: string; duties: string; start: string; end: string; schedule: string; location: string;
  allowance: string; paymentTime: string; mentor: string; mentorRole: string;
  bank: string; accountName: string; accountNumber: string;
};

type FieldKey = keyof InternshipFields;
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
  [/^3\.1\s+.*?标准为：(.*?)，于(.*?)前支付至乙方银行账户：$/d, 'allowance', 'paymentTime'],
  [/^4\.1\s+.*?（指导老师：(.*?)，职位：(.*?)）负责.*$/d, 'mentor', 'mentorRole'],
  [/^开户行：(.*)$/d, 'bank'],
  [/^户名：(.*)$/d, 'accountName'],
  [/^账号：(.*)$/d, 'accountNumber'],
] as const satisfies readonly (readonly [RegExp, ...FieldKey[]])[];
const locationHeading = '实习地点与方式：';
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
  values.duties = (duties.content ?? []).map(itemText).join('\n');
  values.schedule = itemText(scheduleItems[0]);
  values.location = location ? itemText(location).slice(locationHeading.length).trim() : '';
  return {values: values as InternshipFields, slots, dutiesIndex, scheduleIndex};
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
const listItem = (text: string): JSONContent => ({type:'listItem', content:[{type:'paragraph', content:[{type:'text', text}]}]});

export function fillInternshipTemplate(document: JSONContent, values: InternshipFields): JSONContent {
  const template = readInternshipTemplate(document);
  if (!template) return document;
  const children = [...document.content!];
  for (const {index, from, to, key, current} of template.slots.toReversed()) {
    if (values[key] === (key === 'start' || key === 'end' ? toIso(current) : current)) continue;
    const text = key === 'start' || key === 'end' ? dateForAgreement(values[key]) : values[key].trim();
    // Leave space between adjacent profile labels even when the old value was blank.
    const line = inlineText(children[index]);
    const separator = ['school','year','phone'].includes(key) ? ' ' : '';
    const nameSpace = key === 'employeeName' && line.slice(to).startsWith('（') ? ' ' : '';
    children[index] = replaceInline(children[index], from, to, text + separator + nameSpace);
  }
  const {dutiesIndex, scheduleIndex} = template;
  if (values.duties !== template.values.duties) {
    children[dutiesIndex] = {...children[dutiesIndex], content: values.duties.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(listItem)};
  }
  if (values.schedule !== template.values.schedule || values.location !== template.values.location) {
    const items = children[scheduleIndex].content!;
    const lead = values.schedule === template.values.schedule ? items[0] : listItem(values.schedule);
    children[scheduleIndex] = {...children[scheduleIndex], content: [lead,
      ...(values.location ? [listItem(locationHeading + values.location)] : []),
      ...items.slice(1).filter(item => !itemText(item).startsWith(locationHeading)),
    ]};
  }
  return {...document, content: children};
}

export function prepareInternshipDraft(document: JSONContent, employeeName: string) {
  const template = readInternshipTemplate(document);
  if (!template) return document;
  return fillInternshipTemplate(document, {...template.values,
    employeeName, identity:'', school:'', major:'', year:'', studentId:'', phone:'', email:'', emergencyContact:'',
    start:'', end:'', allowance:'', bank:'', accountName:'', accountNumber:'',
  });
}

export function completeInternshipFields(values: InternshipFields) {
  return Boolean(values.employeeName.trim() && values.role.trim() && values.duties.trim() && values.allowance.trim() && values.schedule.trim())
    && validInternshipPeriod(values.start, values.end);
}
