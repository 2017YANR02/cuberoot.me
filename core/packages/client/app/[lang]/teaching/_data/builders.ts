import type { Lesson, LessonKind, MicroLesson } from './types';

interface MicroLessonInput {
  id: string;
  title: string;
  outcome: string;
  kind?: LessonKind;
  minutes?: number;
  shots?: string[];
  script?: string[];
  formulas?: Lesson['formulas'];
}

const SHOTS: Record<LessonKind, string[]> = {
  concept: ['正面说明本节唯一目标', '俯拍魔方展示关键位置', '慢动作复述判断方法'],
  case: ['定格展示标准起始形状', '慢速完整执行一次', '正常速度执行并展示结果'],
  drill: ['正面说明练习规则', '俯拍连续示范三次', '屏幕显示过关次数'],
  example: ['先展示本次打乱和目标', '俯拍完整示范并保留停顿', '回放关键选择并解释原因'],
  resource: ['展示资料页的使用位置', '放大一组示例说明读法', '演示一次查找和自测流程'],
  milestone: ['展示本阶段完成状态', '完整演示一次不剪辑流程', '屏幕显示课后挑战'],
};

function defaultScript(title: string, outcome: string, kind: LessonKind): string[] {
  if (kind === 'case') {
    return [
      `这一节只处理“${title}”。先看形状，再决定动作，不要一上来就背手法。`,
      '【把标准起始形状放到画面中央，停两秒】',
      '先找最醒目的颜色和块之间的关系。确定拿法以后，我慢速做一遍，你只观察目标块去了哪里。',
      '【慢速执行一次；回到起始状态，再用正常速度执行一次】',
      `现在轮到你：先说出判断理由，再独立完成。过关标准是${outcome}。`,
    ];
  }

  if (kind === 'drill') {
    return [
      `今天不加新知识，我们把“${title}”练到稳定。`,
      '【屏幕显示练习次数和成功标准】',
      '先慢做一次，确认每一步都知道自己在找什么；第二次开始再逐渐提速。',
      '如果失败，停下来找出是哪一个判断出了问题，不要立刻乱转重来。',
      `完成后自己打勾：${outcome}。达到标准再进入下一节。`,
    ];
  }

  if (kind === 'example') {
    return [
      `这节用一个完整例子练“${title}”。重点不是跟上我的速度，而是看懂每次选择。`,
      '【展示起始状态，让孩子先暂停观察】',
      '我每做完一个小目标都会停一下，说出下一步要找的块和选择这个动作的原因。',
      '【完整示范后，回放最容易犹豫的位置】',
      `请换一个新的打乱再做一次。过关标准是${outcome}。`,
    ];
  }

  if (kind === 'resource') {
    return [
      `这一页不是让你一次背完，而是教你怎样使用“${title}”。`,
      '【展示资料的分组、编号和查找入口】',
      '每次只选当前正在练的一小组：先认形，再看公式，最后盖住答案自测。',
      '遇到不稳定的情形就做标记，下次从标记处开始，不必从第一页重来。',
      `今天的完成标准是${outcome}。`,
    ];
  }

  if (kind === 'milestone') {
    return [
      `来到“${title}”，我们先不追求快，只检查前面的步骤能不能连起来。`,
      '【展示完整目标，说明哪些位置允许暂停】',
      '开始前先说出路线；过程中卡住可以停，但不要跳过判断。完成以后再回看最慢的一段。',
      '【完整完成一次，结尾展示复盘清单】',
      `这一关的标准是${outcome}。做到以后，你就可以进入下一阶段。`,
    ];
  }

  return [
    `这节微课只解决一个问题：“${title}”。学完马上练，不需要一次记很多内容。`,
    '【正面说完目标，切到俯拍画面】',
    '先观察我指到的位置，再听判断方法。动作做慢一点没关系，方向正确最重要。',
    '【慢速示范一次，让关键位置停留两秒】',
    `现在请你暂停视频试一次。过关标准是${outcome}。`,
  ];
}

export function microLesson(input: MicroLessonInput): MicroLesson {
  const kind = input.kind ?? 'concept';
  return {
    id: input.id,
    title: input.title,
    minutes: input.minutes ?? 3,
    outcome: input.outcome,
    kind,
    shots: input.shots ?? SHOTS[kind],
    script: input.script ?? defaultScript(input.title, input.outcome, kind),
    formulas: input.formulas,
  };
}

export function numberedCaseLessons({
  prefix,
  title,
  count,
  minutes = 2,
  outcome,
}: {
  prefix: string;
  title: string;
  count: number;
  minutes?: number;
  outcome?: (caseNumber: number) => string;
}): MicroLesson[] {
  return Array.from({ length: count }, (_, index) => {
    const caseNumber = index + 1;
    return microLesson({
      id: `${prefix}-${caseNumber}`,
      title: `${title} ${caseNumber}`,
      minutes,
      kind: 'case',
      outcome: outcome?.(caseNumber) ?? `能从标准角度识别并独立完成${title} ${caseNumber}`,
    });
  });
}
