import { z } from 'zod';

// Plan contracts are independent of conversation-memory storage.
const resourceId = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const planStep = z.object({
  action: z.string().trim().min(1).max(1800),
  reason: z.string().trim().min(1).max(800),
  seconds: z.number().int().positive().max(86400).optional(),
  requires: z.array(resourceId).max(8).default([]),
  produces: z.array(resourceId).max(8).default([]),
}).strict();
/** Private model representation, rendered into the existing public answer string. */
export const assistantStructuredPlanSchema = z.object({
  inputs: z.array(z.object({ id: resourceId, quote: z.string().trim().min(2).max(500) }).strict()).max(12).default([]),
  activities: z.array(z.object({
    title: z.string().trim().min(1).max(180),
    seconds: z.number().int().positive().max(86400).optional(),
    steps: z.array(planStep).min(1).max(12),
  }).strict()).min(1).max(12),
}).strict();
export type AssistantStructuredPlan = z.infer<typeof assistantStructuredPlanSchema>;
export type AssistantPlanOutputConstraints = { activities?:number; substepsPerActivity?:number; timed:boolean };
export function assistantStructuredPlanOutputSchema(constraints:AssistantPlanOutputConstraints) {
  const step=constraints.timed?planStep.extend({seconds:z.number().int().positive().max(86400)}):planStep;
  const steps=constraints.substepsPerActivity?z.array(step).length(constraints.substepsPerActivity):z.array(step).min(1).max(12);
  const activity=assistantStructuredPlanSchema.shape.activities.element.extend({steps,...(constraints.timed?{seconds:z.number().int().positive().max(86400)}:{})});
  return assistantStructuredPlanSchema.extend({activities:constraints.activities?z.array(activity).length(constraints.activities):z.array(activity).min(1).max(12)});
}
export const ASSISTANT_STRUCTURED_PLAN_GUIDE = `For a constrained activity plan, include plan:{inputs:[{id,quote}],activities:[{title,seconds,steps:[{action,reason,seconds,requires:[],produces:[]}]}]} in the final JSON. Keep answer:"" when plan is present: the server renders it. Put timing ONLY in numeric seconds fields, not in titles or action prefixes. Every timed parent and child needs exact integer seconds; parent seconds must equal its children. Titles are short names without numbering, time labels or list markers. Every step has an executable action and its own reason. Inputs quote an exact USER statement supplying that material, never an assistant claim or an invented prerequisite. Otherwise prepare it in an earlier step within the allocated time. When the learner needs NEW cards for a flip, explicitly write the word on the front and its meaning on the back before that practice. Reuse the supplied faces of an existing deck. Writing both somewhere on a card is not a two-sided layout. Use resource IDs only in inputs/requires/produces; visible titles, actions and reasons use natural descriptions, never identifiers such as remaining_gaps. Use the same resource ID for production and later consumption. A spoken sentence does not produce written_sentences; explicitly write before reading/editing. Requires must exist BEFORE the step, not be produced by that same step; preparation may be a separate internal step even when no child count was requested. Match an explicit substep count exactly; otherwise use only as many internal steps as the task needs, which will be rendered inline. Do not put list markers or newlines in fields. Word limits apply to the rendered titles, actions, reasons and time labels, not JSON keys. Include an empty-subset alternative inside the relevant action, not in an extra step. Do not add unrequested activities or content merely to reach a word count.`;

function planTitle(title:string) {
  return title.replace(/^(?:\d+[.)、]\s*|(?:Activity|活动)\s*(?:\d+|[一二三四五六七八九十]+)\s*[:：.、]\s*)/i,'').trim();
}
function titleAllocation(title:string) {
  const colon=title.match(/\s*([：:])\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|分钟|分|seconds?|secs?|秒钟?)\s*$/i);
  const parenthesized=title.match(/\s*[（(](\d+(?:\.\d+)?)\s*(minutes?|mins?|分钟|分|seconds?|secs?|秒钟?)[）)]\s*$/i);
  const field=colon ?? parenthesized;
  if(!field)return;
  const amount=colon?colon[2]:field[1];
  const unit=colon?colon[3]:field[2];
  return {text:field[0],seconds:Number(amount)*(/^(?:min|分)/i.test(unit)?60:1),separator:colon?.[1]};
}

export function renderAssistantPlan(plan: AssistantStructuredPlan, children: boolean, lang: 'zh'|'en', paragraph=false, showTiming=true, headingSeparator?:string): string {
  const duration = (seconds?:number,separator?:string) => {
    if(!showTiming || seconds===undefined)return '';
    const label=`${seconds} ${lang==='zh'?'秒':'seconds'}`;
    if(separator==='：')return `：${label}`;
    return separator?`${separator} ${label}`:` (${label})`;
  };
  return plan.activities.map((activity,index) => {
    const allocation=titleAllocation(activity.title);
    const title=planTitle(activity.title.replace(allocation?.text??/$^/,''));
    const separator=headingSeparator??allocation?.separator;
    const label=title+duration(activity.seconds,separator);
    const heading = `${index+1}. ${label}`;
    const body = (step: AssistantStructuredPlan['activities'][number]['steps'][number]) => `${step.action} ${step.reason}`;
    if(paragraph)return `${label}: `+activity.steps.map((step,i)=>`${children?`${lang==='zh'?'第'+(i+1)+'步':'Step '+(i+1)}${duration(step.seconds)}: `:''}${body(step)}`).join(' ');
    return children ? heading+'\n'+activity.steps.map(step=>`  - ${!showTiming || step.seconds === undefined ? '' : `${step.seconds} ${lang==='zh'?'秒':'seconds'}: `}${body(step)}`).join('\n')
      : heading+(separator && showTiming && activity.seconds!==undefined?'\n':': ')+activity.steps.map(body).join(' ');
  }).join(paragraph?' ':'\n');
}

export function validateAssistantPlan(input: unknown, options: {
  shape?: ReturnType<typeof assistantPlanShape>; maximumMinutes?: number; timed: boolean; withoutTimer?: boolean;
  userTexts: string[]; lang: 'zh'|'en';
}): {answer?: string; error?: string; plan?: AssistantStructuredPlan} {
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return {error:'plan_invalid_structure'};
  const plan=parsed.data, shape=options.shape;
  const privateIds=new Set([...plan.inputs.map(input=>input.id),...plan.activities.flatMap(activity=>activity.steps.flatMap(step=>[...step.requires,...step.produces]))].filter(id=>id.includes('_')));
  for(const activity of plan.activities) {
    const visible=[activity.title,...activity.steps.flatMap(step=>[step.action,step.reason])].join(' ');
    if([...privateIds].some(id=>{
      const token=new RegExp(`(?<![\\p{L}\\p{N}_])${id}(?![\\p{L}\\p{N}_])`,'u');
      return token.test(visible) && !options.userTexts.some(text=>token.test(text));
    }))return {error:'plan_resource_id_in_answer'};
  }
  if(shape?.activities && plan.activities.length!==shape.activities)return {error:'plan_activity_count'};
  const available=new Set<string>();
  for(const resource of plan.inputs) {
    if(available.has(resource.id) || !options.userTexts.some(text=>text.includes(resource.quote)))return {error:'plan_unverified_input'};
    available.add(resource.id);
  }
  let total=0;
  for(const activity of plan.activities) {
    if(shape?.substepsPerActivity && activity.steps.length!==shape.substepsPerActivity)return {error:'plan_substep_count'};
    if(/[\r\n]/.test(activity.title))return {error:'plan_invalid_structure'};
    const allocation=titleAllocation(activity.title);
    if(allocation && allocation.seconds!==activity.seconds)return {error:'plan_duration_mismatch'};
    if(!planTitle(activity.title.replace(allocation?.text??/$^/,'')))return {error:'plan_invalid_structure'};
    let seconds=0;
    for(const step of activity.steps) {
      if(/[\r\n]/.test(step.action+step.reason))return {error:'plan_invalid_structure'};
      if(step.requires.some(id=>!available.has(id)))return {error:'plan_missing_prerequisite'};
      step.produces.forEach(id=>available.add(id));
      if(options.timed && step.seconds===undefined)return {error:'plan_duration_unverifiable'};
      if(shape?.stepSecondsMaximum && (step.seconds??Infinity)>shape.stepSecondsMaximum)return {error:'duration_limit_exceeded'};
      seconds+=step.seconds ?? 0;
    }
    if(options.timed && activity.seconds===undefined)return {error:'plan_duration_unverifiable'};
    if(shape?.activitySecondsMaximum && (activity.seconds??Infinity)>shape.activitySecondsMaximum)return {error:'duration_limit_exceeded'};
    if(activity.seconds!==undefined && activity.steps.some(s=>s.seconds!==undefined)
      && (activity.steps.some(s=>s.seconds===undefined) || activity.seconds!==seconds))return {error:'plan_duration_mismatch'};
    total+=activity.seconds ?? seconds;
  }
  if(options.maximumMinutes!==undefined && total>options.maximumMinutes*60+0.01)return {error:'duration_limit_exceeded'};
  const answer=renderAssistantPlan(plan,!!shape?.substepsPerActivity,options.lang,shape?.paragraph,!options.withoutTimer || options.timed,shape?.headingDurationSeparator);
  if(shape) {const error=assistantPlanShapeViolation(answer,shape);if(error)return {answer,error};}
  return {answer,plan};
}

/** Attributed explicit constraints only. Corrections replace fields, not the user's topic. */
export function resolveAssistantPlanShape(question:string, priorUsers:string[]) {
  const followup=/^(?:请)?(?:改成|改为|换成|(?:把|将)[^，。；;\n]{1,32}(?:改成|改为|换成)|仍然|继续|取消|时长|每项|每个|(?:现在)?(?:允许|可以)(?:慢拧|缓慢转|慢慢转|转)|(?:my timer|instead)\b|(?:change|make|keep|continue|remove|each)\b)/i.test(question.trim());
  const paragraphFollowup=priorUsers.length>0
    && /^(?:please\s+)?(?:put|combine|merge|rewrite|condense|write)\b[^.!?\n]{0,80}\b(?:into|as|in)\s+(?:a single|one) paragraph\b/i.test(question.trim());
  // An activity count in the replaced object is no longer a constraint.
  const currentQuestion=question.replace(/^(?:请)?(?:把|将)[^，。；;\n]{1,32}?(?:改成|改为|换成)(?=\s*(?:\d+|[一二两三四五六七八九十]+)\s*(?:项|个|条))/, '');
  const current=assistantPlanShape(currentQuestion) ?? (paragraphFollowup?assistantPlanShape('Plan activities. '+question):undefined);
  if(!followup && !paragraphFollowup && !assistantAllowsTurning(question))return {shape:current,sources:current?[{turn:priorUsers.length,text:question}]:[]};
  if(/表格|\b(?:table|JSON)\b/i.test(question)) {
    // A format change removes list shape, not the underlying material contract.
    const last=priorUsers.at(-1);
    return {shape:undefined,sources:last && assistantPlanShape(last)?[{turn:priorUsers.length-1,text:last}]:[]};
  }
  let shape:ReturnType<typeof assistantPlanShape>;
  const sources:Array<{turn:number;text:string}>=[];
  for(const [turn,text] of [...priorUsers,question].entries()) {
    const parsed=(turn===priorUsers.length?current:assistantPlanShape(text)) ?? (shape?assistantPlanShape('Plan activities. '+text):undefined);
    if(parsed){shape={...shape,...parsed};sources.push({turn,text});}
    if(shape && (chineseParagraphOutput.test(text) || /段落|\bparagraph\b/i.test(text)))shape.paragraph=true;
    if(shape && /改成列表|改为列表|\b(?:make|change|use)\b.*\b(?:list|bullets)\b/i.test(text))delete shape.paragraph;
    if(shape && /取消.{0,8}(?:字数|词数)|remove.{0,20}word (?:limit|count)/i.test(text))delete shape.englishWords;
    if(shape && /(?:最多|至少|at most|at least|no more than)[^。；;\n]{0,25}(?:项|activities|activity)/i.test(text) && !parsed?.activities)delete shape.activities;
  }
  return {shape:shape && Object.keys(shape).length?shape:undefined,sources};
}
export function assistantPlanExceedsDuration(answer: string, maximumMinutes: number): boolean {
  const headings = [...indentAssistantTimedSubsteps(answer).matchAll(/^([ \t]*)(?:\d+[.)、]|[-*])[ \t]+([^\n]+)/gm)];
  const indent=(line:RegExpMatchArray)=>line[1].replace(/\t/g,'    ').length;
  const topIndent=Math.min(...headings.map(indent));
  const parents=headings.flatMap((line,index)=>indent(line)===topIndent?[index]:[]);
  const seconds=parents.reduce((sum,start,index)=>{
    const allocation=planAllocationSeconds(headings[start][2])??0;
    const nested=headings.slice(start+1,parents[index+1]??headings.length);
    const childIndent=Math.min(...nested.map(indent));
    // A duration inside a drill's instructions can repeat the heading's
    // budget. Only a leading child allocation establishes a separate step.
    const childSeconds=nested.filter(line=>indent(line)===childIndent && /^\**\s*(?:\d|(?:step|第)\s*\d)/i.test(line[2]))
      .reduce((total,line)=>total+(planAllocationSeconds(line[2])??0),0);
    return sum+Math.max(allocation,childSeconds);
  },0);
  return seconds > maximumMinutes * 60 + 0.01;
}

/** A numbered plan can use flush-left dash bullets for its substeps.
 * Restore their indentation only when every numbered activity has children. */
export function indentAssistantTimedSubsteps(answer:string):string {
  const lines=answer.split('\n');
  const activities=lines.flatMap((line,index)=>/^\d+[.)、][ \t]+/.test(line)?[index]:[]);
  if(!activities.length || /^[-*][ \t]+/m.test(lines.slice(0,activities[0]).join('\n')))return answer;
  const groups=activities.map((start,index)=>lines.slice(start+1,activities[index+1]??lines.length));
  if(groups.some(group=>!group.some(line=>/^[-*][ \t]+/.test(line)) || group.some(line=>/^[ \t]+(?:[-*]|\d+[.)、])[ \t]+/.test(line))))return answer;
  return lines.map(line=>/^[-*][ \t]+/.test(line)?'  '+line:line).join('\n');
}

/** Only explicit allocations, not elapsed time inferred from instructions.
 * Ambiguous ranges/alternatives must be rewritten, never rounded or guessed. */
function planAllocationRange(line:string):{start:number;end:number}|undefined {
  const text=line.replace(/\*\*/g,'');
  const clock=text.match(/\b(\d+):([0-5]\d)\s*[-–—]\s*(\d+):([0-5]\d)\b/);
  if(clock && !/[：:。.!?]/.test(text.slice(0,clock.index)))return {start:Number(clock[1])*60+Number(clock[2]),end:Number(clock[3])*60+Number(clock[4])};
  const range=text.match(/\b(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(分钟|秒钟?|minutes?\b|mins?\b|seconds?\b|secs?\b|s\b)/i);
  if(range && !/[：:。.!?]/.test(text.slice(0,range.index))) {
    const scale=/^(?:分|min)/i.test(range[3])?60:1;
    return {start:Number(range[1])*scale,end:Number(range[2])*scale};
  }
}
function planAllocationSeconds(line:string):number|undefined {
  const text=line.replace(/\*\*/g,'');
  const interval=planAllocationRange(text);
  if(interval)return interval.end>interval.start?interval.end-interval.start:undefined;
  // A leading mm:ss allocation followed by an action separator is exact,
  // unlike a clock mentioned in the action or an incomplete time range.
  const clock=text.match(/^(\d+):([0-5]\d)\s+(?:[—–-]|[：:])\s+(?!\d+:)\S/);
  if(clock){const seconds=Number(clock[1])*60+Number(clock[2]);return seconds>0?seconds:undefined;}
  const unit='(?:分钟|分(?!钟)|秒钟|秒|minutes?\\b|mins?\\b|seconds?\\b|secs?\\b|s\\b)';
  const match=text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unit})(?:\\s*(?:and\\s*)?(\\d+(?:\\.\\d+)?)\\s*(秒钟|秒|seconds?\\b|secs?\\b|s\\b))?`,'i'));
  if(!match)return;
  // A label can introduce an exact allocation as its own field. A duration
  // buried in an instruction, such as “观察：每次看30秒”, is not the budget.
  const before=text.slice(0,match.index);
  const rest=text.slice(match.index!+match[0].length);
  if(/[：:。.!?]/.test(before)) {
    const labelled=/^(?=[^：:]*\p{L})[^：:。.!?！？；;，,]+[：:][ \t]*$/u.test(before);
    if(!labelled || /\d:$/.test(before) || !/^[ \t]*(?:$|[：:。.!?！？；;])/u.test(rest)
      || /^[ \t]*[：:。.!?！？；;][ \t]*(?:或|or\b)/i.test(rest))return;
  }
  if(/\d\s*[-–—~至到]\s*$/.test(before) || /(?:约|至少|最多|about|up to|at least)\s*$/i.test(before))return;
  if(/^\s*(?:[-–—~至到]|或|or\b)/i.test(rest) && !/^\s+[-–—]\s+\p{L}/u.test(rest))return;
  const seconds=Number(match[1])*(/^(?:分|min)/i.test(match[2])?60:1)+Number(match[3]??0);
  return seconds>0?seconds:undefined;
}

/** Check direct children against their own parent; never count them twice.
 * When the user asks for timed substeps, require each allocation. */
export function assistantPlanDurationViolation(answer:string, maximumMinutes?:number, shape?:ReturnType<typeof assistantPlanShape>):string|undefined {
  const lines=[...answer.matchAll(/^([ \t]*)(?:\d+[.)、]|[-*])[ \t]+([^\n]+)/gm)];
  const indent=(line:RegExpMatchArray)=>line[1].replace(/\t/g,'    ').length;
  const level=Math.min(...lines.map(indent));
  const top=lines.flatMap((line,index)=>indent(line)===level?[index]:[]);
  if(!top.length)return 'plan_duration_unverifiable';
  let total=0;
  for(let i=0;i<top.length;i++) {
    const parent=planAllocationSeconds(lines[top[i]][2]);
    if(parent===undefined)return 'plan_duration_unverifiable';
    if(shape?.activitySecondsMaximum && parent>shape.activitySecondsMaximum)return 'duration_limit_exceeded';
    const nested=lines.slice(top[i]+1,top[i+1]??lines.length);
    if(shape && !shape.substepsPerActivity && !nested.length){total+=parent;continue;}
    const childLevel=Math.min(...nested.map(indent));
    const childLines=nested.filter(line=>indent(line)===childLevel);
    const children=childLines.map(line=>planAllocationSeconds(line[2]));
    const intervals=childLines.map(line=>planAllocationRange(line[2]));
    if(!children.length || children.some(value=>value===undefined))return 'plan_duration_unverifiable';
    if(shape?.stepSecondsMaximum && children.some(value=>value!>shape.stepSecondsMaximum!))return 'duration_limit_exceeded';
    if(intervals.some(Boolean)) {
      // A numeric range is a timeline only when every child participates in
      // one continuous schedule starting at zero or the prior parents' total.
      // Otherwise it may mean a variable allowance, not exact elapsed time.
      if(intervals.some(value=>!value) || (intervals[0]!.start!==0 && intervals[0]!.start!==total))return 'plan_duration_unverifiable';
      if(intervals.some((value,index)=>index>0 && Math.abs(value!.start-intervals[index-1]!.end)>0.01))return 'plan_duration_mismatch';
    }
    if(Math.abs(children.reduce<number>((sum,value)=>sum+value!,0)-parent)>0.01)return 'plan_duration_mismatch';
    total+=parent;
  }
  if(maximumMinutes!==undefined && total>maximumMinutes*60+0.01)return 'duration_limit_exceeded';
}

/** Unwrap a complete timed outline without changing its actions or budgets. */
export function normalizeAssistantPlanParagraph(answer:string,maximumMinutes:number):string|undefined {
  const lines=indentAssistantTimedSubsteps(answer.trim()).split(/\r?\n/).filter(line=>line.trim());
  const heading=/^1[.)、][ \t]+(\S.*)$/.exec(lines[0]??'');
  const steps=lines.slice(1).map(line=>/^[ \t]+[-*][ \t]+(\S.*)$/.exec(line)?.[1]);
  if(!heading || steps.length<2 || steps.some(step=>!step) || assistantPlanDurationViolation(lines.join('\n'),maximumMinutes))return;
  const sentence=(text:string)=>/[.!?。！？]$/.test(text)?text:text+'.';
  return [sentence(heading[1]),...steps.map(step=>sentence(step!))].join(' ');
}

// A counted recording, stretch of time or section of a solve is not a paragraph request.
const chineseParagraphOutput=/(?:一段(?:话|文字|正文|段落)|(?:写成|改成|合(?:并|成)|浓缩成|整理成|只写|写在|放在)(?:同)?一段(?=$|[里中。？！；，、,\s])|(?:用|以)一段(?:来)?(?:说明|描述|回答|概括|介绍|呈现))/;
const oneParagraphRequested=/\b(?:one|a single) (?:timed |continuous )?paragraph\b/i;

/** A single whole-pass timer can use the visitor's cap without rewriting any
 * actions. Leave per-step times and more complex prose to normal validation. */
export function normalizeAssistantTimedRecallParagraph(answer:string,question:string,maximumSeconds:number):string|undefined {
  if(!oneParagraphRequested.test(question) || !/\b(?:sheet|list)\b/i.test(question))return;
  // A fully specified two-column exercise can be rendered with a shared timer
  // even when the draft wrapped it in commentary or reset the timer mid-pass.
  const translation=/^(?:write|give me) (?:a single|one) (?:timed )?paragraph for my existing ([\p{L}]+)[–—\/-]([\p{L}]+) translation sheet\.\s+within \d+ seconds say the \2 aloud from \1, then say the \1 aloud from \2\.\s+cover only the response column during each attempt;\s*after speaking, uncover and check it\.\s*describe what to show and cover after changing direction\.?$/iu.exec(question.trim());
  if(translation && translation[1].toLowerCase()!==translation[2].toLowerCase()){
    const [, prompt, response]=translation;
    return 'Set one '+maximumSeconds+'-second timer for both directions. In the first half, show the '+prompt+' column and cover only '+response+'; say '+response+' aloud from each '+prompt+' prompt, then uncover and check it before covering it again. At halfway, show '+response+' and cover only '+prompt+'; say '+prompt+' aloud from each '+response+' prompt, then uncover, check and cover it again. Stop when the timer ends.';
  }
  if(!/\b(?:cover|hide)\b/i.test(answer))return;
  const text=answer.trim();
  if(!text || /[\r\n]|^\s*(?:[-*#]|\d+[.)])\s+/.test(text))return;
  const duration=/\b(\d+(?:\.\d+)?)\s*[- ]?\s*(?:seconds?|secs?|minutes?|mins?)\b/gi;
  const found=[...text.matchAll(duration)];
  if(!found.length)return 'Set a timer for '+maximumSeconds+' seconds. '+text;
  if(found.length!==1)return;
  const [match]=found;
  const prefix=text.slice(0,match.index);
  const timer=/\b(?:set (?:a|the)|start (?:a|the))\s*$/i.test(prefix) && /^\s+timer\b/i.test(text.slice(match.index!+match[0].length))
    || /\b(?:set|start) (?:a|the) timer (?:for|to)\s*$/i.test(prefix);
  const seconds=Number(match[1])*(/\bmin/i.test(match[0])?60:1);
  if(seconds<=maximumSeconds)return text;
  if(!timer)return;
  const unit=text[match.index!+match[0].length]===' '?text.slice(match.index!+match[0].length+1):'';
  return prefix+maximumSeconds+(/^timer\b/i.test(unit)?'-second':' seconds')+text.slice(match.index!+match[0].length);
}

/** Normalize a complete legacy hand-practice reply without rewriting actions.
 * Each activity and the independent ending must already occupy its own block. */
export function normalizeAssistantHandPractice(answer:string,shape:NonNullable<ReturnType<typeof assistantPlanShape>>,timed:boolean):string|undefined {
  if(!shape.activities || shape.substepsPerActivity || shape.paragraph)return;
  const blocks=answer.trim().split(/\r?\n[^\S\r\n]*\r?\n/);
  const ending=blocks.pop();
  if(!ending || /[\r\n]/.test(ending))return;
  if(timed && shape.activities===2 && blocks.length===1 && /^(?:live|in-person) (?:check|test|drill)\b/i.test(blocks[0])) {
    const pair=blocks[0].split(/(?<=[.;!?])\s+(?=(?:replay|video|phone) (?:check|test|drill)\b[^\r\n]{0,80}?:\s*\d+\s*(?:seconds?|secs?)\b)/i);
    if(pair.length===2)blocks.splice(0,1,...pair);
  }
  const intro=blocks[0];
  if(blocks.length===shape.activities+1 && /^Here (?:are|is)\b/i.test(intro) && intro.length<=280 && !/[\r\n]/.test(intro))blocks.shift();
  if(blocks.length!==shape.activities)return;
  const result:string[]=[];
  let elapsed=0;
  for(const [index,block] of blocks.entries()) {
    const [line,...lines]=block.split(/\r?\n/);
    const text=line.replaceAll('**','').replace(/^\s*[-*]\s+/,'').trim();
    const range=timed && /^(\d+)\s*[-–—]\s*(\d+)\s*(seconds?|secs?|秒钟?)$/i.exec(text);
    if(range){
      const named=/^(?:trial|drill|exercise|test|activity)\s+(\d+)\s*[:：]\s*(\S.*)$/i.exec(lines[0]?.trim()??'');
      const end=Number(range[2]);
      if(!named || Number(named[1])!==index+1 || Number(range[1])!==elapsed || end<=elapsed)return;
      const title=lines[0].trim().split(/[:：]/)[0];
      const separator=shape.headingDurationSeparator==='：'?'：':': ';
      result.push(`${index+1}. ${title}${separator}${end-elapsed} ${range[3]}\n${[named[2],...lines.slice(1)].join(' ')}`);
      elapsed=end;
      continue;
    }
    const match=timed
      ? /^(?:\d+[.)、]\s+)?(.{1,100}?)(?:[：:]|\s+[—–-])\s*(\d+)\s*(seconds?|secs?|秒钟?)\s*(?:[—–:：.-]\s*(.+))?$/i.exec(text)
      : /^(?:(?:drill|exercise|test|activity)\s+(\d+)[ \t]*[—–:-][ \t]*|(\d+)[.)、]\s+)(\S.*)$/i.exec(text);
    if(!match)return;
    if(!timed && Number(match[1]??match[2])!==index+1)return;
    const body=[...(timed && match[4]?[match[4]]:[]),...lines].map(line=>line.replace(/^\s*[-*]\s+/,'').trim()).filter(Boolean).join(' ');
    if(timed && (!body || Number(match[2])<=0))return;
    if(timed)elapsed+=Number(match[2]);
    const title=timed?match[1].replace(new RegExp(`^(?:trial|drill|exercise|test|activity)\\s+${index+1}\\s*[:：]\\s*(?=\\S)`,'i'),''):match[3];
    const heading=timed?`${title}${shape.headingDurationSeparator==='：'?'：':': '}${match[2]} ${match[3]}`:title;
    result.push(`${index+1}. ${heading}${body?'\n'+body:''}`);
  }
  return result.join('\n')+'\n\n'+ending;
}
const durationNumbers:Record<string,number>={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
const chineseDurationUnits:Record<string,number>={十:10,百:100,千:1000,万:10000};
function durationNumber(text:string):number {
  const numeric=durationNumbers[text.toLowerCase()]??Number(text);
  if(Number.isFinite(numeric))return numeric;
  let total=0,digit:number|undefined;
  for(const char of text){
    const unit=chineseDurationUnits[char];
    if(unit){
      if(unit===10000){total=(total+(digit??0))*unit;digit=undefined;continue;}
      total+=(digit??1)*unit;digit=undefined;
    }else digit=durationNumbers[char];
  }
  return total+(digit??0);
}

/** Give exact legacy slow-turn headings the list markers used by validation. */
export function normalizeAssistantSlowTurnOutline(answer:string,activities:number):string|undefined {
  const headings=/^(?:\d+[.)、]\s+)?(慢(?:拧|转)(?:练习|训练)\s*)(十[一二]?|[一二三四五六七八九]|1[0-2]|[1-9])(?=\s*[（(]\s*\d+\s*秒钟?\s*[）)]\s*[:：])/gm;
  const found=[...answer.matchAll(headings)];
  if(found.length===activities && found.every((heading,index)=>durationNumber(heading[2])===index+1))
    return answer.replace(headings,(_,label:string,ordinal:string)=>durationNumber(ordinal)+'. '+label+ordinal);
  const chinese=/^((?:活动|练习|训练)\s*)(十[一二]?|[一二两三四五六七八九]|1[0-2]|[1-9])(?=\s*[（(]\s*\d+\s*秒钟?\s*[）)]\s*[:：])/gm;
  const labelled=[...answer.matchAll(chinese)];
  if(labelled.length===activities && labelled.every((heading,index)=>durationNumber(heading[2])===index+1))
    return answer.replace(chinese,(_,label:string,ordinal:string)=>durationNumber(ordinal)+'. '+label+ordinal);
  const english=/^((?:Slow[- ]turn(?:ing)? )?(?:Drill|Exercise|Activity) ([1-9]|1[0-2]))(?=\s*[-–—:]\s*\d+\s+(?:seconds?|minutes?)\b)/gim;
  const steps=[...answer.matchAll(english)];
  if(steps.length===activities && steps.every((step,index)=>Number(step[2])===index+1))
    return answer.replace(english,(_,label:string,ordinal:string)=>ordinal+'. '+label);
}

const durationQuantity=String.raw`(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b)`;
const durationExpression=new RegExp(String.raw`(?<![\d零〇一二两三四五六七八九十百千万])(?<amount>${durationQuantity})(?<half>\s+and a half)?\s*(?:(?<minutes>分半钟?|分钟|分(?![钟半])|minutes?\b|mins?\b)(?:\s*(?:and\s+)?(?<extra>${durationQuantity})\s*(?:秒钟?|seconds?\b|secs?\b))?|(?:秒钟?|seconds?\b|secs?\b))`,'giu');

/** Shorten flexible slots above an explicit child cap. Numeric labels are
 * authoritative only when timed actions have no independent minimum or count. */
export function capAssistantPlanSteps(input:unknown,maximumSeconds:number) {
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  let changed=false;
  for(const activity of parsed.data.activities) {
    if(activity.seconds===undefined || activity.steps.some(step=>step.seconds===undefined)
      || activity.steps.reduce((sum,step)=>sum+step.seconds!,0)!==activity.seconds
      || titleAllocation(activity.title))continue;
    for(const step of activity.steps) {
      if(step.seconds!<=maximumSeconds || [...(step.action+' '+step.reason).matchAll(durationExpression)].length
        || /(?:\d+|[一二两三四五六七八九十百]+)\s*(?:次|遍|轮|张|组)|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:times|reps?|rounds?|passes?|cards?|words?)\b/i.test(step.action))continue;
      activity.seconds-=step.seconds!-maximumSeconds;
      step.seconds=maximumSeconds;
      changed=true;
    }
  }
  if(changed)return parsed.data;
}

/** A time budget must belong to a whole plan or an explicitly named unit. */
export function assistantPlanTimeBounds(question:string) {
  const bounds:{total?:number;activity?:number;step?:number}={};
  for(const m of question.matchAll(durationExpression)){
    // Keep compound durations together before determining the scope of the cap.
    const before=question.slice(0,m.index);
    const left=before.split(/[，,；;。！？.!?\n]/).at(-1)??'';
    const right=question.slice(m.index+m[0].length).split(/[，,；;。！？.!?\n]/)[0];
    if(/至少|不少于|at least|minimum/i.test(left.slice(-30)))continue;
    const bound=/最多|至多|不超过|不能超过|不要超过|上限|之内|以内|(?:限(?:时|在)?|少于|不到|小于)\s*$|\b(?:at most|no more than|up to|limited to|within|under|less than|(?:limit|cap) (?:the |this )?(?:whole |entire )?(?:plan|session|exercise) to)\b/i;
    const total=/总计|总共|合计|加起来|总时长|总时间|总用时|全程|全部|\b(?:in all|in total|total|altogether|combined|fit (?:both|all|everything|the (?:whole )?plan) into)\b/i;
    const available=/(?:我|今天|现在)(?:只有|有)|(?:这(?:一)?轮|本轮|这一回)只?有|\bI (?:have|get|only have)\b|timer (?:is )?(?:now )?set to|for the next/i;
    const {amount,half,minutes,extra}=m.groups!;
    const value=durationNumber(amount)+(half||minutes?.startsWith('分半')?0.5:0);
    const duration=value*(minutes?60:1)+(extra?durationNumber(extra):0);
    const strict=/(?<!不)(?:少于|小于)\s*$|不到\s*$|(?<!not )\b(?:under|less than)\s*$/i.test(left);
    const seconds=strict && duration>1?Math.ceil(duration)-1:duration;
    if(!(seconds>0 && seconds<=86400))continue;
    const prefix=left.slice(-80);
    const stepScope=/(?:各(?:个|自)?|每(?:个)?)(?:小步|子步骤|步)|\b(?:each|per) (?:substep|step)\b/i;
    // “各小步给理由和各自秒数，最多三十一秒” keeps the cap on the child.
    const trailingStepCap=/(?:各(?:个|自)?|每(?:个)?)(?:小步|子步骤|步骤)[^，,；;。！？.!?\n]{0,35}(?:秒数|时长)[，,]\s*(?:最多|不超过|上限(?:为)?)\s*$/.test(before);
    const bounded=bound.test(prefix) || bound.test(right);
    if(!total.test(prefix+right) && (stepScope.test(prefix+right) || trailingStepCap)){
      if(bounded)bounds.step=seconds;
    }else if(!total.test(prefix+right) && /每项|每个活动|每次|单次|\b(?:each|per) (?:activity|drill|session)\b/i.test(prefix+right)){
      if(bounded)bounds.activity=seconds;
    }else if(bounded||total.test(prefix+right)||available.test(prefix)||/^[ \t]+available\b/i.test(right) && /\bthere (?:are|is)\s*$/i.test(prefix)){
      bounds.total=seconds;
    }
  }
  return bounds;
}

/** Extract only explicit exact counts; a maximum/minimum is not an exact count. */
export function assistantPlanShape(question:string) {
  const handPractice=assistantHandContactPracticeRequest(question);
  const sheetParagraph=oneParagraphRequested.test(question) && /\b(?:word|translation|vocabulary) sheet\b/i.test(question)
    && /\b(?:cover|hide)\b/i.test(question);
  if(!/安排|计划|练习|训练|活动|\b(?:plan|activities|practice|training|schedule|drills|exercises)\b/i.test(question) && !assistantSlowTurnRequest(question) && !handPractice && !sheetParagraph)return;
  if(/表格|\b(?:table|JSON)\b/i.test(question))return;
  const bounds=assistantPlanTimeBounds(question);
  const countValues='1[0-2]|[1-9]|十二|十一|十|一|二|两|三|四|五|六|七|八|九|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve';
  const count=`(${countValues})`;
  const number=(text:string)=>Number(text)||({一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,十一:11,十二:12,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12} as Record<string,number>)[text.toLowerCase()];
  const exact=(pattern:string)=>{
    const matches=[...question.matchAll(new RegExp(pattern,'gi'))];
    if(matches.some(match=>{const at=match.index!+match[0].lastIndexOf(match[1]);return /最多|至少|不超过|不少于|at most|at least|up to|no more than|或|\bor\b/i.test(question.slice(Math.max(0,at-20),at).split(/[，,。；;.!?\n]/).at(-1)!);}))return;
    const values=[...new Set(matches.map(match=>number(match[1])))];
    return values.length===1?values[0]:undefined;
  };
  const activities=exact(`(?<![a-z0-9一二两三四五六七八九十])${count}\\s*(?:(?:项|条|轮)[^，。；;\\n]{0,18}?(?:练习|活动|训练|慢拧${handPractice?'|检查|测试':''})|种慢(?:拧|转)(?:练习|训练)|个(?:定时|计时|限时|编号|(?:三阶)?慢拧)?(?:练习|活动|训练)(?!器|工具|系统|场地|课程)|项(?=各(?:自|有|分)|分别设|[，。；;\\n]|$)|(?:numbered |separate |independent |timed |untimed |timer-free |short |recall |observation(?:-only)? |F2L |static |vocabulary |revision |spelling |flashcard |card |slow[- ]turn(?:ing)? ${handPractice?'|grip[- ]transfer |contact[- ]check |hands[- ]on |practical ':''})*(?:activities|drills|exercises${handPractice?'|tests|trials|ways to (?:tell|check|observe)':''})\\b)`);
  const englishSteps=String.raw`(?:indented |(?:(?:separately|individually|independently) )?timed )*(?:substeps|sub-steps|steps)\b`;
  const afterEach=exact(`(?:每项|每个活动|各自|各有|各分|各(?=\\s*(?:${countValues})\\s*个?(?:定时|计时|限时)?(?:子步骤|小步|步骤))|分别设|each(?: activity| one)?|under each)[^。；;\\n]{0,100}?${count}\\s*(?:(?:个)?(?:子步骤|小步|步骤|步)(?!骤?数)|个[^。；;\\n]{0,35}?(?:子步骤|子练习)|${englishSteps})`);
  const beforeEach=exact(`${count}\\s+${englishSteps}\\s+(?:(?:and |with )(?:a reason|reasons) )?(?:(?:(?:under|for|in) )?each(?: activity| one)?|per activity|apiece)\\b`);
  const substepsPerActivity=afterEach && beforeEach && afterEach!==beforeEach?undefined:afterEach??beforeEach;
  const wordRange=question.match(/\b(\d{2,4})\s*[-–—]\s*(\d{2,4})(?:\s+|[- ])(?:English\s+)?words?\b/i);
  const englishWords=wordRange && Number(wordRange[1])<=Number(wordRange[2])?{minimum:Number(wordRange[1]),maximum:Number(wordRange[2])}:undefined;
  const headingDurationSeparator=question.match(/(?:标题|小标题)[^。！？\n]{0,20}(?:练习名|活动名|名称)\s*([：:])\s*(?:秒数|时长|时间)|\bheadings?\b[^.!?\n]{0,30}\b(?:name|title)\s*([：:])\s*(?:duration|seconds|time)\b|\b(?:name|title)\s*([：:])\s*(?:duration|seconds|time)\s+headings?\b/i);
  const describedSeparator=/\bheadings?\b[^.!?\n]{0,64}\b(?:name|title) followed by (?:a |the )?colon[^.!?\n]{0,20}\bseconds?\b/i.test(question)?':':undefined;
  const separator=headingDurationSeparator?.[1]??headingDurationSeparator?.[2]??headingDurationSeparator?.[3]??describedSeparator;
  return activities||substepsPerActivity||englishWords||chineseParagraphOutput.test(question)||oneParagraphRequested.test(question)?{...(separator?{headingDurationSeparator:separator}:{}),...(bounds.activity?{activitySecondsMaximum:bounds.activity}:{}),...(bounds.step?{stepSecondsMaximum:bounds.step}:{}),...(activities?{activities}:{}),...(substepsPerActivity?{substepsPerActivity}:{}),...(englishWords?{englishWords}:{}),...((chineseParagraphOutput.test(question) || /段落|\bparagraph\b/i.test(question))?{paragraph:true}:{})}:undefined;
}

const slowTurning=/慢拧|(?:慢|慢慢|缓慢|慢速)转|\bslow[- ](?:turns?|turning)\b|\bturn(?:ing)?(?: (?:the |a )?cube)? slowly\b/i;
const observationOnly=/静态|(?:只|仅)(?:做)?观察|不转动魔方|别转动魔方|不转层|全程不转动|\bobservation[- ]only\b|\b(?:do not|don['’]t) turn (?:the |a )?cube\b|\b(?:no cube turns|without turning the cube)\b/i;
function assistantAllowsTurning(text:string):boolean {
  return /(?<![不未])(?:允许|可以|现在(?:能|可)|这次(?:能|可))(?:慢拧|转层|(?:缓慢|慢慢|慢速|慢)?转(?:动(?:魔方)?)?)|不再(?:只|仅)观察|\b(?:allow(?:ed)? slow (?:turns|turning)|slow (?:turns|turning) (?:are|is) (?:now )?(?:allowed|permitted)|(?:can|may) (?:now )?turn(?: (?:the |a )?cube)? slowly|(?:can|may) (?:now )?turn (?:the |a )?cube|turning is allowed)\b/i.test(text);
}

/** Later user constraints replace earlier ones; another clause can still restrict the same turn. */
export function assistantObservationOnlyPlan(question:string,sourceText=''):boolean {
  for(const turn of (sourceText+'\n'+question).split('\n').reverse()){
    const allowsTurning=assistantAllowsTurning(turn);
    if(observationOnly.test(turn) && (!allowsTurning || /[，,；;。.!?]\s*(?:但|不过|但是|全程|but\b|however\b)/i.test(turn)))return true;
    if(allowsTurning)return false;
  }
  return false;
}

export function assistantSlowTurnRequest(text:string):boolean {
  return slowTurning.test(text);
}

export function assistantSingleInsertionRequested(question:string):boolean {
  return assistantSlowTurnRequest(question)
    && /(?:只|仅)(?:执行|做)?(?:一次[^。；;\n]{0,12}插入|插入一次)|(?:插入|执行已会的插入)(?:仅|只)?一次(?:后|就|即|才|[，。；;]|$)|\b(?:insert|insertion)\b[^.;!?\n]{0,22}\bonce\b|\bone insertion (?:only|and (?:then )?stop)\b/i.test(question);
}

/** Drop an optional repeat aside only when the visitor explicitly wants one insertion. */
export function omitAssistantOptionalInsertionRepeat(text:string,question:string):string {
  if(!assistantSingleInsertionRequested(question))return text;
  return text.replace(/((?:\b(?:insert|insertion)\b[^.!?;\n]{0,24}\bonce|插入一次))\s*\((?:if you (?:repeat it|do it again)|if repeating (?:it|the insertion)),\s*(?:first )?reset and (?:visually )?(?:re-?check|check again)(?: first| before (?:repeating|the repeat))?\s*[.!]?\)/gi,'$1');
}

const cannotSetUpCase=/摆不出|摆不成|没能摆成|无法摆|不能摆|摆位(?:不可能|失败|未成功)|复现不了|找不到熟悉情形|(?:若|如果)(?:核对)?(?:不吻合|不对齐|未对上|不通过)|\b(?:if|when) (?:the )?(?:(?:setup|set[- ]up|(?:visual )?check|verification) (?:fails?|failed|(?:does not|doesn['’]t) (?:work|match|pass))|(?:setup|set[- ]up|(?:familiar )?case) is (?:impossible|not possible|unsuccessful|unavailable|unconfirmed))\b|\b(?:cannot|can't|can’t|unable to|could not)\b[^.!?;\n]{0,35}\b(?:set up|establish|recreate|reach|make)\b|\b(?:cannot|can['’]t|could not) be (?:set up|established|recreated|made)\b/i;
// A failure predicate can describe the inspection itself. Its slot is the
// prerequisite being checked, not another slot check after taking a fallback.
const visualCaseMismatch=/(?:若|如果)(?:(?:摆不出|摆不成|无法摆出|摆位失败)\s*[，,]?\s*或(?:者|是)?\s*)?(?:摆(?:好|成|出)(?:后|时))?\s*(?:亲眼|目视|用眼睛|肉眼)\s*(?:核对|检查|确认|发现)\s*(?:棱|边)块\s*[、，,和与]\s*角块\s*(?:[、，,和与]|以及|及)\s*(?:目标|目的)?槽(?:位|位置)?\s*(?:三处|三者|三项)?\s*(?:未(?:能|全部|都)?|没有(?:全部|都|全)?|不(?:都|全)?)(?:对上|对齐|吻合|匹配|相符|一致)\s*[，,:：]\s*(?:则|就)?/g;
const chineseCaseMatch=/(?:^|[。；;，,：:])\s*(?:若|如果|只有|仅当)?\s*(?:(?:棱|边)块[、，,和与]角块(?:[、，,和与]|以及)目标槽(?:位)?\s*)?(?:三者|三处|各处)(?:全部|都|均|全)?(?:确认)?(?:正确|相符|无误|吻合|一致|对上|对齐|对)(?:[，,]\s*(?=(?:(?:先|再|就|只|仅|慢慢|慢速|慢)\s*)*(?:做|执行|使用|插入))|\s*[，,]?\s*(?:才|后|就|则))/g;

export function assistantRequestsSlowTurnAlternatives(question:string):boolean {
  return assistantSlowTurnRequest(question) && cannotSetUpCase.test(question)
    && /每项|每个|逐项|各(?:改|用|给|换)|两项[^。；]{0,16}分别|(?:两|二|2)项(?:的)?(?:备用(?:动作|练习|练法)?)?分别|都.{0,8}(?:说|写|练)|\b(?:each|both|every)\b/i.test(question)
    && /改练|改做|换做|替代|备选|备用|各(?:改|换)|\b(?:alternative|fallback|backup|instead|substitute)\b|\b(?:another|a different) (?:(?:concrete|specific|actionable|executable) )?(?:exercise|drill|activity)\b/i.test(question);
}

/** Keep the task's most error-prone prerequisites next to the generation rule. */
const chinesePracticeCard=String.raw`词卡|卡片|卡(?=$|[\s，,。；;！!？?]|已|都|一面|正面|背面|的)`;
const chineseTwoSidedCard=String.raw`(?:双面|正反面)[^。！？\n]{0,12}?(?:${chinesePracticeCard})`;
export function assistantCardPracticeRequest(question:string):boolean {
  return /词卡|卡片|空白卡|\b(?:cards?|flashcards?)\b/i.test(question) || new RegExp(chineseTwoSidedCard).test(question);
}
function vocabularyPlan(question:string):boolean {
  return /vocabulary|单词|词汇|错题|词表|词卡|空白卡|背[^。！？]{0,24}卡片|\b(?:(?:word|vocabulary|revision) cards?|flashcards?|spelling mistake)\b|\b(?:revise|revision|review|practise|practice|learn|study|memorise|memorize|spelling)\b[^.!?\n]{0,50}\bwords?\b|\b(?:words?|words? list)\b[^.!?\n]{0,65}\b(?:revision|review|practice|spelling|drills?)\b/i.test(question) || new RegExp(chineseTwoSidedCard).test(question);
}

const cleanCardPass = /(?:若|如|如果|当|只有)(?:首轮|第一[项轮]|第1[项轮]|上一轮|第一次|前一轮)?\s*(?:整套(?:卡)?(?:都)?)?(?:全部(?:答|写|拼)?对|全部(?:都)?正确|全(?:做)?对|没有(?:错卡|错误)|零错)|\b(?:if|when|only if)\b[^.;!?\n]{0,38}(?:\b(?:all|every)\b[^.;!?\n]{0,24}\bcorrect\b|\b(?:no|zero) (?:errors|mistakes|misses)\b|\bno cards (?:were |are )?(?:missed|wrong)\b)/i;
const wholeCardDeck = /整套(?:复位后的)?卡|整叠卡|全套(?:卡|牌)|整副(?:卡|牌)|(?:全部|所有)(?:的|复位后的)?卡(?:片)?|\b(?:whole|full|entire|complete)\s+(?:reset\s+)?(?:deck|stack|set|cards)\b|\ball (?:the )?cards\b/i;
const repeatCardPass = /再(?:做|练|过|来|完整|(?:按同样方式)?逐张)|重(?:做|练|过|复)|第二轮|下一轮|\b(?:repeat|redo|run through|go through|another (?:round|pass)|second (?:round|pass))\b/i;
function requiresCleanCardRepeat(question:string) {
  return assistantCardPracticeRequest(question) && cleanCardPass.test(question) && wholeCardDeck.test(question) && repeatCardPass.test(question);
}

export function assistantCleanCardPassInstruction(question:string):string {
  return requiresCleanCardRepeat(question)
    ? ' Treat a first pass as all correct only after the entire deck was attempted and checked. A timed partial first pass does not qualify. Put the requested full-deck reset and repeat in the next timed activity, conditional on that first pass. Do not restart again inside either activity.'
    : '';
}

/** Preserve a timed partial pass without letting it activate the all-correct branch. */
export function normalizeAssistantCleanCardPass(input:unknown,question:string):AssistantStructuredPlan|undefined {
  if(!requiresCleanCardRepeat(question))return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  let changed=false;
  for(const step of parsed.data.activities[0].steps) {
    const action=step.action.replace(/((?:若|如果)?(?:时间不够|没来得及做完整套)时?[^。；;\n]{0,35}?)[，,]?\s*并(?:且)?(?:记下|记录|判断|看)(?:是否|有没有)(?:全部正确|全对)/g,'$1；只有整套都做完且无错才算全对')
      .replace(/(\bif (?:time runs out|you run out of time)\b[^.!?;\n]{0,105}?)(?:,?\s+and )?(?:record|check|decide) (?:if|whether) (?:all|everything) (?:was |is )?correct/gi,'$1. Count it as all correct only if every card was attempted and checked without errors');
    if(action!==step.action){step.action=action;changed=true;}
  }
  const [first,second]=parsed.data.activities;
  if(parsed.data.activities.length===2 && first.steps.length===1 && second.steps.length===1) {
    const repeat=/[,;]\s*if (?:all cards|every card) (?:is|are) correct after the full deck, reset the whole deck(?: to [a-z]+)? and repeat (?:the same written recall pass|the entire pass) once[.!]?$/i;
    const [initial,followUp]=[first.steps[0],second.steps[0]];
    if(repeat.test(initial.action) && repeat.test(followUp.action)){
      initial.action=initial.action.replace(repeat,'.');
      const action=followUp.action.replace(repeat,'.');
      followUp.action='If every card was checked and correct on the first pass, reset the whole deck to the original prompt face and repeat the entire pass: '+action[0].toLowerCase()+action.slice(1);
      changed=true;
    }
  }
  return changed ? parsed.data : undefined;
}

function cleanCardRepeatMissing(question:string,actions:string[]) {
  if(!requiresCleanCardRepeat(question))return false;
  if(/(?:没有错卡|全对|零错)(?:时|就|则)?\s*(?:本项|第二项|这轮|就)?\s*(?:不必|无需|不用|可以不|可不|跳过)(?:再做|重练|练习|做|第二项)?|\b(?:skip|omit)\b[^.!?;\n]{0,28}\b(?:if|when)\b[^.!?;\n]{0,28}\b(?:no mistakes|no errors|all correct)\b/i.test(actions.join('\n')))return true;
  return !actions.some(action=>{
    const clean=cleanCardPass.exec(action);
    if(!clean)return false;
    const branch=action.slice(clean.index+clean[0].length).split(/(?:若|如果|如)(?:第[一1]项)?有错|否则|\b(?:otherwise|else|if (?:you made|there are) (?:any )?(?:errors|mistakes))\b/i)[0];
    return wholeCardDeck.test(branch) && repeatCardPass.test(branch)
      && /复位|翻回|提示面朝上|\b(?:reset|restore|prompt[- ]side up|cue[- ]side up|return each card)\b/i.test(branch);
  });
}

/** Explicit knowledge overrides the generic familiar-case suggestion. */
function noLearnedInsertion(question:string):boolean {
  for(const text of question.split('\n').reverse()) {
    if(/(?:现在|已经|已)(?:学会|会).{0,20}插入|\bI now know\b[^.!?]{0,25}\binsertion\b/i.test(text))return false;
    if(/不会.{0,20}插入|没(?:有)?学过.{0,20}插入|\b(?:do not|don't) know\b[^.!?]{0,30}\binsertions?\b|\b(?:have not learned|haven[’']t learned|(?:have )?never learned)\b[^.!?]{0,25}\binsertions?\b/i.test(text))return true;
  }
  return false;
}

export function assistantPlanPrerequisites(question:string):string {
  if(vocabularyPlan(question) && /\b(?:flashcards?|cards?)\b|词卡|卡片/i.test(question))return ' Vocabulary card practice: preserve the requested activity/child counts, reasons, language and total time. Every requested activity must include actual recall, not just making or checking reference cards. If cards do not exist, prepare each word on one face and its known meaning on the other inside the FIRST activity, then practise with them in that same activity. Use the available word list; if no words or known meanings are available, stop instead of inventing new fallback cards. Existing supplied card faces must be preserved even when they use pictures or languages other than English. Refer to the actual prompt face and answer face the user supplied. Put an error-free branch inside an allocated activity and within its existing seconds. Reuse as many available cards as time permits, without assuming an unspecified deck size. Do not switch to a table. Choose one clear response mode per activity: oral recall checks the spoken word or meaning; spelling practice requires writing the attempted word BEFORE the flip. Do not append an optional writing instruction after a flip. For EACH attempt, place that card with its prompt face up, attempt the opposite reference without looking, flip once to check it, then immediately return THAT card to the same prompt face. Word-to-meaning starts word-side up; meaning-to-word starts meaning-side up. Keep this full attempt/check/reset cycle in each activity and repeat; shuffling and direction names alone do not reset cards. Reset all cards before an alternative full-deck pass, not just missed cards. If the user says to repeat the prepared deck when there are no errors, do so after resetting the whole deck. Otherwise finish a clean pass without adding extra rounds. Any error-only action must explicitly finish or use the full prepared set when there are zero errors. Give each timed child its own action and reason. Keep preparation, checking and resets inside the time budget. Do not add unrequested learning labels or recap activities.';
  if(vocabularyPlan(question))return ' Vocabulary: give EACH timed child its own concrete action and purpose in that same bullet; a global rationale does not replace child reasons. Make every timed action executable even if there are ZERO mistakes. Use the full existing word list, prioritising weak words; if practising errors only, explicitly use the original list when no errors remain. Do not require a fixed count of weak words. Prefer practising with the supplied word list: keep the prompt column visible, cover only the answer column, recall, uncover to check, and hide that answer column again before the next item. A two-column table is on ONE face: never flip it to an imagined meaning side. When changing recall direction, uncover the new prompt column and cover the new answer column. Mixed practice must expose one chosen prompt BEFORE attempting its answer; never read from two covered columns. Do not rename a list as a deck. If choosing cards, explicitly write BOTH reference faces before any flip; the same applies to NEW fallback slips and paragraph rewrites. Include preparing cards/materials inside the allocated time. A spoken response is not a written record: if a later step reads or edits sentences, write those sentences within the earlier step. Keep one consistent material and practice mode across dependent steps: a copied list must include BOTH words and meanings before a later step covers or checks its meaning column. Card faces are not columns of a list; two sides of one card cannot be laid out separately without preparing separate slips. For each card attempt, start word-side up, recall the meaning and flip to check the meaning; OR start meaning-side up, recall the word and flip to check the word. After checking, reset EVERY card to the chosen prompt side before repeating any card or restarting the whole deck; shuffling alone does not restore faces. Resetting only missed cards does not reset the full deck in the no-errors branch: reset all cards before either branch, or reset the full deck explicitly in that branch. Prefer finishing a clean pass to adding extra rounds. When a repeat is needed, restate its attempt/check/reset cycle; a named recall direction or "the same way" does not reset cards. If answers are spoken, check spoken errors; to check spelling or written mistakes, write the learner’s attempted answer on paper first. Preparing the card’s reference answer does not create the learner’s written attempt. Record the attempted answer BEFORE revealing the reference, then compare. Writing after flipping may copy a correction, but is not an original attempt. Every error-only repeat, including “missed ones” or “those marked”, needs an explicit no-errors alternative in that action. Never offer “write OR say” before comparing written lists: either record every attempt or keep the whole comparison oral. These material requirements also apply to paragraph answers. Explain the concrete benefit; if using learning labels, word-to-meaning is receptive vocabulary and meaning-to-word is productive vocabulary.';
  if(/魔方|三阶|\b(?:cube|F2L|OLL|PLL)\b/i.test(question))return ' Cube: a corner needs all THREE colours to identify its home; an edge needs BOTH. A visible non-cross sticker does NOT exclude a hidden cross-colour sticker: leave identity unknown. Current adjacent centres describe location, never hidden colours. Use suppliedPieceFacts without changing any supplied colour. Reuse observable pieces; do not demand an unseen matching piece. For static practice keep the same state; for slow turns include any setup before repeating a solved pair. For supplied diagrams describe inspections, not invented examples: single corner twist is illegal; opposite corner twists satisfy orientation only; overall legality still needs matching corner/edge permutation parity.';
  return '';
}

export function assistantHandContactPracticeRequest(question:string):boolean {
  return /手指|(?:拇|食|中|小)指|无名指|指法|手法|换手|换握|握姿|\b(?:finger tricks?|fingers?|fingertips?|thumbs?|regrips?|grip changes?|grip transfers?)\b/i.test(question)
    && /观察|检查|核对|发现|留意|看看|(?:什么|何)时候离开|\b(?:see|seeing|observe|observation|observing|check(?:ing)?|detect(?:ing)?|determine|tell whether|notice|noticing|watch|watching)\b/i.test(question)
    && !/插入|\b(?:insertion|F2L|OLL|PLL|CFOP)\b/i.test(question);
}

export function asksToLocatePair(question: string) {
  return /找块|找.{0,8}(?:角.{0,4}棱|一对|下一对)|(?:寻找|追踪|跟踪).{0,6}(?:配对|下一对)|\b(?:find|finding|spot|locate|track|recognize|identify)\b.{0,32}\b(?:pair|corner and (?:its )?edge)\b/i.test(question);
}

/** Choose one compatible practice mode; do not mix hidden-state, pairing and
 * completed-stage assumptions into every cube plan. No state is inferred. */
export function assistantCubePlanGuidance(question:string,sourceText=''):string|undefined {
  const handObservation=assistantHandContactPracticeRequest(question);
  if(!handObservation && !/魔方|三阶|\b(?:cube|F2L|OLL|PLL|CFOP)\b/i.test(question+' '+sourceText) && !assistantSlowTurnRequest(question))return;
  const format='Answer the current request with its exact activity/child counts, times, reasons and language. Keep checks inside the activities. Unless the user requests substeps, use ONE internal step per activity, combining preparation, practice and a brief check in its action, plus one short reason. Split only when a real material dependency requires separate steps. Without a word minimum, do not add repeated observations, recaps or rule explanations. ';
  if(handObservation)return format+'Observe the requested hand movement itself. Each exercise must perform the requested motion and directly observe its contact or pause. For early release, watch during the turn for a real gap between fingertip and sticker, and compare its first appearance with the instant the layer stops. Use different methods, for example frame-by-frame side-view video and a live side-view observer calling out both events. Tape peeling, ink smears, shadows, crossing a mark, and checking only at the end cannot distinguish sliding from early release. For a question about sliding, track the fingertip relative to a mark while contact is maintained. Keep setup, repetitions and checks inside the allotted time. Do not substitute a full solve or another move.';
  if(/diagrams?|图示|示意图/i.test(question))return format+'Use only the supplied diagrams. Apply checks to the full supplied set, never require a nonempty no-cross/error pile in a later timed step; if no error exists, recheck the same diagrams. A last layer has FOUR corners and FOUR edges: label each corner twist 0, 1 or 2 and sum those FOUR VALUES; do NOT use the count of twisted corners modulo 3. Inspect orientations and permutations separately. Three independent necessary conditions: corner twists sum to 0 modulo 3 REGARDLESS of edges; edge flips are even REGARDLESS of corners; corner and edge permutation parities agree. One twisted corner is impossible regardless of edge flips. Two opposite twists cancel and are orientation-compatible. Fully oriented pieces are orientation-compatible, not necessarily a legal permutation or solved cube. Describe checks, not invented example cases or algorithms.';
  if(/只(?:能)?看[见到].{0,12}(?:贴纸|颜色)|(?:其余|另外|其他|两).{0,8}(?:被挡|被遮|遮住)|(?:other|remaining|two|both)[^.!?]{0,30}(?:hidden|occluded|covered)|only one.{0,15}sticker/i.test(question))return format+'The stated piece is incompletely visible. Keep this plan on the SAME visible sticker and its observed location: describe its visible colour/face/position, record the remaining colours as UNKNOWN, then recall and visually recheck those same observations. This is useful F2L observation practice without identifying the whole piece. Do NOT search for a partner, classify F2L membership, assign a home, or use current neighbouring centres to guess candidate colours. Do not require other fully visible pieces: their availability was not supplied. A visible non-cross sticker does not rule out a hidden cross-colour sticker.';
  const facts=assistantPlanPieceFacts(question);
  if(facts?.pieces.length)return format+'Use only the supplied colour identities and suppliedPieceFacts. First compare the complete colour sets to decide which edge matches the corner: both non-cross corner colours must match, and an edge containing the cross colour cannot match. Then recall and recheck those SAME supplied colour sets and the pairing verdict. Their current positions are UNKNOWN. Unless specifically asked for location, do not add home-position or solved-state exercises. If location is requested, each piece belongs at ALL centres matching its own colours, never one centre per piece or the centres currently beside it.';
  if(asksToLocatePair(question) && /F2L|前两层|first two layers/i.test(question+' '+sourceText))
    return format+'Practise locating BOTH a cross-colour corner and its matching edge. Inspect the two non-cross colours, point at both pieces, then compare both colours as the check. Search all allowed layers, including edges in occupied middle slots. Respect any one-attempt limit even if identification fails. Tracking one sticker alone does not identify a pair. Respect restrictions on rotation, layer turns, insertion, timers and full solves. For a revision, change only the requested exercise and use the requested sentence count.';
  if(!assistantObservationOnlyPlan(question,sourceText) && assistantSlowTurnRequest(question+' '+sourceText)){
    if(noLearnedInsertion([sourceText,question].join('\n'))){
      const allowed=[...assistantBasicTurnSet(question+'\n'+sourceText)];
      return format+(allowed.length?`Use only these exact supplied turns: ${allowed.join(', ')}. Do not add inverses or other modifiers unless listed. `:'')+'The learner explicitly knows NO insertion. Every requested activity must actually practise only their already-known basic turns slowly, with pauses to observe the current state. Do not introduce even a conditional insertion, inverse setup, familiar F2L case or solved-slot check. No case preparation or case fallback is needed because neither activity depends on one. Keep both activities executable without learning a move or formula.';
    }
    const setup='Starting positions and learned moves are unspecified: do NOT supply a move sequence or assert it extracts/inserts a pair. Let the learner choose ONE insertion they already know, prepare its familiar case using that insertion’s inverse, and visually verify the case and target slot before turning. If they cannot establish that familiar case, practise their own known turns slowly without claiming F2L completion. After a verified insertion, reset the SAME case with that SAME inverse before repeating; do not require a different pair/slot. Every later activity must branch explicitly: ONLY IF the familiar case was verified, reset it and insert; OTHERWISE use known slow turns for that entire activity. End that fallback branch without a subsequent insertion, inverse setup or solved-slot check. Do not join the branches with an unconditional “then insert”. Never assume a successful first insertion. All setup and checks fit inside the activity time. ';
    if(assistantRequestsSlowTurnAlternatives(question)) {
      const allowed=[...assistantFallbackTurnSet(sourceText+'\n'+question)];
      const assigned=assistantAssignedFallbackTurns(question);
      const insertion=assistantSingleInsertionRequested(question)
        ? 'Only if all three match, perform the familiar insertion exactly once and end that branch. Omit repeats and optional repeat advice.'
        : 'Only if all three match, perform the familiar insertion. If the user requests repeats, reset and check again before each repeat.';
      return format+'Do not ask for clarification in place of the drills. In EACH step.action, try to set up the familiar case using the learner’s known method or the inverse of a known insertion. If setup succeeds, explicitly look at the edge, corner and target slot. Keep this visual check and BOTH outcomes in the action itself. '+insertion+' If setup is impossible or the check fails, give a distinct, concrete known-turn exercise in EACH activity using the current cube. End without insertion, inverse setup or a slot check. In one fallback pause after turning to observe a change; in the other predict a change before turning and then compare. Follow the requested order of the two branches. Do not invent a starting state or insertion algorithm.'+(assigned ? ' Use '+assigned[0]+' in the first fallback and '+assigned[1]+' in the second, in that order.' : allowed.length?` Use only these named turns in the fallbacks: ${allowed.join(', ')}.`:'');
    }
    if(/(?:两|二|2)项.{0,8}慢拧|(?:two|2) (?:slow[- ]turn(?:ing)? )activities/i.test(question))return format+setup+'Both activities must actually turn within the chosen branch: verified case means insertion then reset and repeat; fallback means known slow turns throughout both activities. Respect no timer/no new algorithm limits.';
    return format+setup+'First activity prepares and slowly performs the familiar insertion; second observes and recalls its ACTUAL resulting state, without assuming success or repeating insertion. Respect no timer/no new algorithms.';
  }
  return format+'Use a simple observation/recall drill on ONE corner currently in view. Record only its actually visible sticker colours and CURRENT face/location; any unseen colours stay UNKNOWN. No complete identity, home-slot or pairing inference is needed for this drill, so do not require all three stickers to be visible or substitute another object. First activity records the visible information; later activities recall and visually recheck that SAME information (with three activities, separate recall from recheck). Every child has a concrete action even when just one sticker is visible. The cube stays untouched and its starting arrangement is unspecified. Do not add solved-state, home-mapping or algorithm explanations unless the user explicitly requested those.';
}

function separatePreparationRequested(question:string) {
  return /\b(?:preparation|setup|set-up) activity\b|\b(?:one|first) activity\b[^.!?\n]{0,30}\b(?:prepar\w*|set up)\b|(?:一项|第一项)活动.{0,12}(?:准备|制卡)/i.test(question);
}
const suppliedWordSheet=/直接.{0,9}(?:词表|现有)|(?:已有|我有|我用的是|使用原有|继续用原)[^。！？\n]{0,36}词表|\b(?:existing|original|already (?:have|on)|I have a two[- ]column|supplied)\b[^.!?\n]{0,45}\b(?:list|sheet)\b/i;
export function assistantVocabularyActivityInstruction(question:string,shape:ReturnType<typeof assistantPlanShape>):string {
  if(separatePreparationRequested(question))return 'Preserve the explicitly requested separate preparation activity and its allocation.';
  if(/卡片|词卡|\b(?:cards?|flashcards?)\b/i.test(question))return 'Choose a recall goal for EACH activity before writing steps. If cards must be made, use part of the FIRST activity to write both word and meaning faces, then include an actual recall attempt, check and reset in THAT activity. With two requested children, the first makes cards and the second practises recall; checking whether reference cards are readable is not recall practice. If cards already exist, reuse their supplied layout and practise immediately. Each later activity starts every card on its chosen prompt face, attempts the opposite reference, flips to check and resets that same card before repeating. Keep the exact requested counts and time; never allocate an entire requested practice activity to preparation.';
  if(suppliedWordSheet.test(question))
    return 'Use the learner’s existing word-and-meaning sheet even when they did not transcribe its entries in chat. Do not ask them to copy, replace or supplement it. Keep the sheet on the same face and move only the cover to switch columns. Include an actual attempt, check and reset in every activity, within the requested time and child counts.';
  const first=(shape?.substepsPerActivity??1)>1
    ? 'First activity skeleton: first child prepares the WORD / MEANING list; second child covers the reference, attempts the meaning, checks it and covers it again before the next word. Any remaining children continue practice or feedback within that activity.'
    : 'In the first activity, combine preparing the WORD / MEANING list and an actual covered-reference attempt, check and reset in the same timed step.';
  return `Choose the practice goal of each requested activity BEFORE writing steps. Name the first activity after its practice goal, not preparation. ${first} Preparation uses part of the first activity, never one of the requested practice activity slots. Later activities practise with the same list. Follow the user’s requested goals and exact counts; do not add a preparation activity or merely rename a preparation-only activity.`;
}

export function assistantPlanWordInstruction(shape:ReturnType<typeof assistantPlanShape>,draft?:string,draftPlan?:unknown):string {
  if(!shape?.englishWords)return '';
  const target=draft===undefined?Math.floor(shape.englishWords.minimum+.65*(shape.englishWords.maximum-shape.englishWords.minimum)):Math.floor((shape.englishWords.minimum+shape.englishWords.maximum)/2);
  const children=(shape.activities??1)*(shape.substepsPerActivity??1);
  // The renderer adds headings and timed bullet labels; action AND reason share
  // the remaining budget. The model should include its own subset alternative.
  const perChild=Math.max(1,Math.floor((target-6*(shape.activities??1)-3*children)/children));
  const count=draft?.trim().split(/\s+/).filter(Boolean).length;
  const parsed=assistantStructuredPlanSchema.safeParse(draftPlan);
  if(count!==undefined && parsed.success) {
    const steps=parsed.data.activities.flatMap(activity=>activity.steps);
    const sizes=steps.map(step=>(step.action+' '+step.reason).trim().split(/\s+/).length);
    const overhead=count-sizes.reduce((sum,size)=>sum+size,0);
    const bodyTarget=target-overhead;
    if(count<shape.englishWords.minimum) {
      // Do not redistribute a short plan: shortening a good long action while
      // expanding another block can leave the total unchanged. Add the measured
      // deficit to reasons only, preserving all executable actions and labels.
      const deficit=target-count;
      const budgets=steps.map((step,index)=>{
        const reasonWords=step.reason.trim().split(/\s+/).length;
        const change=Math.floor(deficit/steps.length)+(index<deficit%steps.length?1:0);
        return {step:index+1,currentReasonWords:reasonWords,targetReasonWords:reasonWords+change,change};
      });
      return `Edit the supplied rejectedPlan: it renders to ${count} words, below the ${shape.englishWords.minimum}–${shape.englishWords.maximum} requirement. Target ${target} total. Keep every title, action, seconds, input, requires and produces value EXACTLY unchanged. Expand ONLY the reasons, adding ${deficit} words overall. Measured reason budgets: ${JSON.stringify(budgets)}. Each targetReasonWords is the TOTAL length of that step's new reason, not the number to add. Explain why that existing action helps; give a concrete causal explanation, not additional actions or generic filler. Do not shorten any reason, replace words with synonyms, or merely copy the rejected plan. Return the complete plan with expanded reasons and answer:"". The server counts the rendered text again; unchanged length will fail.`;
    }
    if(count>shape.englishWords.maximum) {
      const reasonWords=steps.map(step=>step.reason.trim().split(/\s+/).length);
      const capacity=reasonWords.reduce((total,words)=>total+Math.max(0,words-5),0);
      const excess=count-shape.englishWords.maximum;
      if(capacity>=excess) {
        let remove=Math.min(capacity,excess+2);
        const budgets=reasonWords.map((words,index)=>{
          const change=Math.min(remove,Math.max(0,words-5));
          remove-=change;
          return {step:index+1,currentReasonWords:words,targetReasonWords:words-change};
        });
        return `The rendered draft has ${count} words; the maximum is ${shape.englishWords.maximum}. Remove at least ${excess} words by shortening ONLY the reasons to these measured limits: ${JSON.stringify(budgets)}. Keep each step's causal purpose. Copy every action, title, timing, input and dependency unchanged. Do not expand any reason or add new content. Return the complete revised plan with answer:"". Count the rendered text, including headings and time labels, before returning it.`;
      }
    }
    const budgets=sizes.map((words,index)=>{
      const targetWords=Math.floor(bodyTarget/steps.length)+(index<bodyTarget%steps.length?1:0);
      return {step:index+1,currentWords:words,targetWords,change:targetWords-words};
    });
    return `The rendered draft has ${count} words; required range ${shape.englishWords.minimum}–${shape.englishWords.maximum}. Repair to ${target} words, keeping the ${overhead} heading/label words and existing step count. Measured action-plus-reason budgets: ${JSON.stringify(budgets)}. For every positive change, ADD that many actual words to that step, explaining its existing action, check or purpose in more detail. For negative changes, shorten that step by that many words without removing prerequisites. Preserve timing, materials, reset instructions and empty-subset alternatives. Keep titles unchanged. Rewrite each action AND reason to its targetWords total; a synonym substitution does not add words. No new activity, recap, filler or invented prerequisite. Count only whitespace-separated rendered words, never JSON keys.`;
  }
  const reasonWords=Math.max(1,Math.round(perChild*.4));
  return `English length is a hard requirement: ${shape.englishWords.minimum}–${shape.englishWords.maximum} whitespace-separated words INCLUDING headings. Target ${target} total; each of the ${children} requested action blocks needs about ${perChild} words across action AND reason combined, with short headings. Allocate about ${perChild-reasonWords} words to the action and ${reasonWords} to its concrete causal reason. These are word budgets, not character counts or extra fields. Before returning JSON, count the rendered titles, time labels, actions and reasons: expand short reasons about their existing action or trim repeated explanations until the total is inside the requested range. Keep actions, prerequisites and timing intact. Include concrete actions, observable checks and purposes, without extra blocks or filler. Include the empty-subset alternative once inside these words when needed; do not leave it for the renderer to append.`+(count!==undefined?` The rejected rendered draft has ${count} words: ${count<target?`ADD about ${target-count} words by expanding the existing actions/reasons`:`REMOVE about ${count-target} words from repeated explanations`}. Edit the supplied rejectedPlan rather than starting over; preserve its valid structure and allocations. Recount the final rendered text, not JSON keys. Changing synonyms without changing length will fail again.`:'');
}

const planWithoutReasons=(plan:AssistantStructuredPlan)=>({...plan,activities:plan.activities.map(activity=>({...activity,steps:activity.steps.map(({reason,...step})=>step)}))});

/** A length-only repair may accidentally recase an already verified quotation.
 * Restore only that metadata, never accept a new quote or changed action under
 * the old input. The normal exact-source and semantic checks still run next. */
export function assistantPlanRestoreInputQuotes(draft:unknown,repaired:unknown,userTexts:string[]):AssistantStructuredPlan|undefined {
  const before=assistantStructuredPlanSchema.safeParse(draft),after=assistantStructuredPlanSchema.safeParse(repaired);
  if(!before.success || !after.success || before.data.inputs.length!==after.data.inputs.length)return;
  if(before.data.inputs.some((input,i)=>input.id!==after.data.inputs[i].id
    || input.quote.toLowerCase()!==after.data.inputs[i].quote.toLowerCase()
    || !userTexts.some(text=>text.includes(input.quote))))return;
  const restored={...after.data,inputs:before.data.inputs};
  if(JSON.stringify(planWithoutReasons(before.data))!==JSON.stringify(planWithoutReasons(restored)))return;
  return restored;
}

/** Recover an over-expanded short-plan repair using complete reason alternatives.
 * Actions and all other fields must be identical. Never truncate prose or pad it;
 * the caller still validates the assembled plan's semantics and rendered length.
 */
export function assistantPlanReasonSelection(draft:unknown,repaired:unknown,range:{minimum:number;maximum:number},timed:boolean,lang:'zh'|'en',layout?:{children:boolean;paragraph?:boolean}):AssistantStructuredPlan|undefined {
  const before=assistantStructuredPlanSchema.safeParse(draft),after=assistantStructuredPlanSchema.safeParse(repaired);
  if(!before.success || !after.success)return;
  if(JSON.stringify(planWithoutReasons(before.data))!==JSON.stringify(planWithoutReasons(after.data)))return;
  const words=(text:string)=>text.trim().split(/\s+/).filter(Boolean).length;
  const originalWords=words(renderAssistantPlan(before.data,layout?.children??timed,lang,layout?.paragraph));
  if(originalWords>=range.minimum || words(renderAssistantPlan(after.data,layout?.children??timed,lang,layout?.paragraph))<=range.maximum)return;
  const original=before.data.activities.flatMap(a=>a.steps),edited=after.data.activities.flatMap(a=>a.steps);
  // At most one candidate per attainable count; bounded by the requested range.
  let candidates=new Map<number,string[]>([[originalWords,[]]]);
  for(let index=0;index<original.length;index++) {
    const next=new Map<number,string[]>();
    for(const [count,reasons] of candidates)for(const reason of [original[index].reason,edited[index].reason]) {
      const total=count+words(reason)-words(original[index].reason);
      if(total<=range.maximum && total>=count && !next.has(total))next.set(total,[...reasons,reason]);
    }
    candidates=next;
  }
  const target=(range.minimum+range.maximum)/2;
  const selected=[...candidates].filter(([count])=>count>=range.minimum).sort(([a],[b])=>Math.abs(a-target)-Math.abs(b-target))[0];
  if(!selected)return;
  let index=0;
  return {...before.data,activities:before.data.activities.map(activity=>({...activity,steps:activity.steps.map(step=>({...step,reason:selected[1][index++]}))}))};
}

/** Remove only optional trailing reason clauses to avoid rewriting valid actions. */
export function shortenAssistantPlanReasons(input:unknown, shape:NonNullable<ReturnType<typeof assistantPlanShape>>, lang:'zh'|'en') {
  const range=shape.englishWords;
  if(!range)return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  const plan=parsed.data;
  const count=(value:AssistantStructuredPlan)=>renderAssistantPlan(value,!!shape.substepsPerActivity,lang,shape.paragraph).trim().split(/\s+/).length;
  const words=count(plan);
  if(words<=range.maximum)return;
  const shorter=structuredClone(plan);
  // Track complete alternatives by words removed. Exact sums avoid cutting off
  // the final reason or falling below the minimum to repair a slight excess.
  type Step=AssistantStructuredPlan['activities'][number]['steps'][number];
  const edits=new Map<number,Array<{step:Step;reason:string}>>([[0,[]]]);
  for(const activity of shorter.activities)for(const step of activity.steps){
    const plain=step.reason.trim();
    const noErrorRecap=/\bif no (?:errors? (?:occurred|remain)|(?:words?|items?) (?:were )?missed),\s*(?:finish|stop|end)\b/i.test(step.action)
      ? plain.match(/(?:;\s*|,?\s+while\s+)(?:the\s+)?(?:no[- ]error|empty[- ]error) branch (?:avoids (?:unnecessary )?repetition|ends practice without a required error pile)[.!?]?$/i)
      : undefined;
    const repeatedOrder=/\bwrite\b[^.!?]{1,140}\bthen uncover\b/i.test(step.action)
      ? plain.match(/,\s+and uncovering only after writing keeps (?:the )?(?:correct spelling|answer|reference) hidden (?:during|until) the attempt[.!?]?$/i):undefined;
    const repeatedFeedback=/\b(?:uncover|reveal)\b[^.!?;]{0,45}\b(?:to check|and check)\b/i.test(step.action)
      ? plain.match(/(?:,\s+and|\s+while)\s+(?:uncovering after each attempt gives immediate correction|checking afterward corrects spelling immediately|the cover prevents copying)[.!?]?$/i)
      : undefined;
    const repeatedCover=assistantColumnOperations(step.action).filter(op=>op.kind==='cover').length>=2
      ? plain.match(/,\s+and re-covering (?:keeps the next attempt honest|resets each attempt)[.!?]?$/i)
      : undefined;
    const end=plain.match(/,\s+(?:and\b|while\b|which\b)[^,;.!?]+[.!?]?$/i)
      ?? plain.match(/\s+and (?:builds|strengthens|reinforces|targets|improves|helps|gives) [^,;.!?]+[.!?]?$/i)
      ?? (/\b(?:each|every|full|whole)\b/i.test(step.action)
        ? plain.match(/\s+and (?:uses|reuses) the (?:whole|full) (?:existing |original )?(?:list|deck|table)[.!?]?$/i) : undefined);
    // Keep timing, ordering, reset and conditional requirements in place even
    // when the model wrote one in a reason rather than in its action.
    const cut=noErrorRecap ?? repeatedOrder ?? repeatedFeedback ?? repeatedCover ?? (end && !/\b(?:before|after|unless|until|without|must|only|never|if|reset|cover|uncover|flip)\b/i.test(end[0])?end:undefined);
    if(cut?.index===undefined)continue;
    const reason=plain.slice(0,cut.index).trim()+'.';
    if(reason.split(/\s+/).length<5)continue;
    const removed=plain.split(/\s+/).length-reason.split(/\s+/).length;
    for(const [total,selections] of [...edits]){
      const next=total+removed;
      if(removed>0 && next<=words-range.minimum && !edits.has(next))edits.set(next,[...selections,{step,reason}]);
    }
  }
  const best=[...edits.keys()].filter(n=>words-n<=range.maximum).sort((a,b)=>a-b)[0];
  if(best===undefined)return;
  for(const {step,reason} of edits.get(best)!)step.reason=reason;
  return shorter;
}

/** Compress repeated sheet wording without removing a cue, attempt, check or reset. */
export function compactAssistantWordSheetActions(input:unknown,shape:NonNullable<ReturnType<typeof assistantPlanShape>>,lang:'zh'|'en') {
  const range=shape.englishWords;
  if(!range || lang!=='en')return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  const plan=parsed.data;
  const words=(text:string)=>text.trim().split(/\s+/).length;
  let total=words(renderAssistantPlan(plan,!!shape.substepsPerActivity,lang,shape.paragraph));
  if(total<=range.maximum)return;
  let changed=false;
  for(const step of plan.activities.flatMap(activity=>activity.steps)){
    const compact=step.action
      .replace(/\bKeep the sheet on (?:its|the same) face with (WORD|MEANING) visible and cover (?:the )?(WORD|MEANING)(?: column)?\b/g,
        'Keep $1 visible and cover $2')
      .replace(/\buncover (WORD|MEANING) to check and re-?cover it before the next (?:word|meaning)\b/gi,
        'uncover $1 to check, then re-cover')
      .replace(/\buncover to check and (?:re-?)?cover the (WORD|MEANING) column(?: again)? before the next (?:word|meaning)\b/gi,
        'uncover $1 to check, then re-cover it')
      .replace(/\bRepeat the full list the same way, (saying meanings aloud|handwriting each [A-Z][a-z]+ word) and uncovering (WORD|MEANING) only after each attempt\b/g,
        'Repeat the same routine, $1, then uncovering $2 to check')
      .replace(/\bRepeat the full list the same way, prioritising\b/gi,'Repeat the routine, prioritising')
      .replace(/\bKeep the sheet on (?:its|the same) face with (the (?:[A-Z][a-z]+ )?(?:WORD|MEANING) column) visible and cover the (WORD|MEANING) column\b/g,
        'On the same face, keep $1 visible and cover $2')
      .replace(/\bPlace the existing [A-Z][a-z]+ word-and-meaning list on the table with (the [A-Z][a-z]+ WORD column) visible and cover the MEANING column\b/g,
        'On the existing list, keep $1 visible and cover MEANING')
      .replace(/\bKeep the (?:sheet|list) on the same face,\s*(?:and\s+)?/i,'On the same face, ')
      .replace(/\bsay aloud the meaning of each visible [A-Z][a-z]+ word\b/g,'say each visible word’s meaning aloud')
      .replace(/\buncover the (WORD|MEANING) column and compare\b/g,'uncover $1 and compare')
      .replace(/\bcover the ((?:[A-Z][a-z]+ )?(?:WORD|MEANING)) column again\b/g,'re-cover $1')
      .replace(/\bCover the ((?:[A-Z][a-z]+ )?(?:WORD|MEANING)) column again\b/g,'Re-cover $1')
      .replace(/\bthe ([A-Z][a-z]+) word for each visible meaning on paper\b/g,'each $1 word on paper from its visible meaning')
      .replace(/\bprioriti[sz]e words missed earlier\b/gi,'prioritise earlier misses')
      .replace(/\bIf no (?:words|meanings) remain, finish\b/g,'Stop when done')
      .replace(/\b(?:simply )?run the (full|complete|whole) list once more\b/gi,'repeat the $1 list once')
      .replace(/\bthe meaning of each word aloud\b/gi,"each word’s meaning aloud");
    const next=total-words(step.action)+words(compact);
    if(next<range.minimum || next>=total)continue;
    step.action=compact;
    total=next;
    changed=true;
    if(total<=range.maximum)break;
  }
  return changed?plan:undefined;
}

/** Restore the face used for the just-completed attempt. Only edit an
 * unambiguous per-card check in a repeat drill, before final validation. */
export function restoreAssistantCardPromptAfterCheck(input:unknown, question:string, lang:'zh'|'en') {
  if(!vocabularyPlan(question)||!assistantCardPracticeRequest(question)
    || /(?:保持|留在).{0,12}(?:背面|答案面)|\b(?:leave|keep)\b[^.!?\n]{0,50}\b(?:back|answer side)\b[^.!?\n]{0,12}\b(?:up|visible)\b/i.test(question))return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  const steps=parsed.data.activities.flatMap(a=>a.steps);
  const previousInActivity=new Map(parsed.data.activities.flatMap(a=>a.steps.slice(1).map((step,i)=>[step,a.steps[i]] as const)));
  const reset=/\b(?:reset(?:ting)?|return(?:ing)?|flip|turn)\b[^.;!?\n]{0,50}\b(?:back (?:over|to)|prompt (?:face|side)|(?:front|(?:word|meaning|English|Chinese|definition|spelling)[- ]side) up)\b|翻回|复位|重置|(?:正|词|释义|题目)面重新朝上|(?:放回|恢复|翻回)[^。；;\n]{0,18}(?:中文|释义|词义|英文|单词)(?:面)?朝上/i;
  const repeat=/\b(?:re-?read|re-?test|replay|repeat|restart)\b|(?:再|重)(?:练|测|做|过|读|翻|回忆|默写|写|背)|(?:默写|重写|重背)[^。；;\n]{0,12}(?:一遍|一次)|(?:错卡|整叠|整副).{0,12}一遍/i;
  const check=/\b(?:flip(?:ping)?(?:\s+(?:it|each card|the card|over))*|turn(?:ing)? (?:it|the card) over)\s+to\s+(?:check|confirm|verify)(?:\s+(?:it|the (?:answer|word|meaning|spelling|translation)))?|翻(?:到(?:卡片)?(?:英文|单词|释义|中文)?(?:正|背)?)?面\s*(?:来|再)?(?:核对|验证|检查)(?:答案|单词|拼写|释义|刚写(?:的|出(?:的)?)[^，,。；;\n]{1,20}(?:[，,](?:逐字|逐项|逐个)比对拼写)?)?/gi;
  let changed=false;
  for(const [index,step] of steps.entries()){
    const later=steps.slice(index+1).map(s=>s.action).join('\n');
    step.action=step.action.replace(check,(match:string,offset:number,action:string)=>{
      const before=action.slice(0,offset).split(/[.!?。；;\n]/).at(-1)??'';
      const previous=previousInActivity.get(step)?.action??'';
      const writtenFromMeaning=lang==='zh' && /(?:看|读|只看|用)(?:中文|词义|释义)|(?:中文|词义|释义)(?:面)?(?:朝上|作提示)|翻到中文(?:背面|一面)/.test(previous)
        && /在纸上[^。；]{0,12}(?:写|默写)|(?:写出|默写)[^。；]{0,14}(?:英文|拼法|拼写)/.test(previous)
        && !/翻[^。；]{0,14}(?:核对|检查)|揭(?:开|晓)|查看答案/.test(previous)
        && /^翻到(?:英文|单词)正面/.test(match);
      const rest=action.slice(offset+match.length);
      // Basic cue and attempt must precede the check in the same action;
      // negation, reference preparation and a batch flip do not qualify.
      if(!writtenFromMeaning && !/\b(?:say(?:ing)?|recall(?:ing)?|guess(?:ing)?|spell(?:ing)?|write|writing|attempt(?:ing)?)\b|回忆|说出|默写|作答|先猜/i.test(before)
        || /\b(?:do not|don't|without)\s*$|不要$|不必$|无需$/i.test(before)
        || !/^\s*(?:$|[,.;!?，。；！？]|\band\b|再|接着|然后)/i.test(rest)
        || /\b(?:leave|keep)\b[^.!?\n]{0,45}\b(?:answer side|back)\b[^.!?\n]{0,12}\b(?:up|visible)\b|留在(?:答案|背)面/i.test(rest))return match;
      const next=rest.split(/[.!?。\n]/)[0];
      if(reset.test(next) || !repeat.test(next+'\n'+later))return match;
      // An explicitly reset next pass is already executable. Do not add
      // another flip, or override an expressed change of directions.
      if(!repeat.test(next) && reset.test(later.split(/[.!?。\n]/)[0]))return match;
      changed=true;
      if(writtenFromMeaning && /(?:两|二|2)张卡/.test(previous))
        return match+'，核对完把这两张卡都翻回中文面朝上';
      if(lang==='zh' && /(?:两|二|2)张卡/.test(before))
        return match+'，随即把这两张卡都翻回本次的题面';
      return match+(/[\p{Script=Han}]/u.test(match)||lang==='zh'?'，随即把这张卡翻回本次的题面':', then return that card to its prompt face');
    });
  }
  return changed?parsed.data:undefined;
}

/** A bounded fallback keeps an error-only drill executable without another model call.
 * Insert into an existing step, never add activities or change time allocations.
 * The caller still validates structure, word limits and time after this edit.
 */
export function assistantPlanSubsetFallback(question:string,answer:string,lang:'zh'|'en',maximumWords?:number):string {
  // Bounded answers belong to the model's measured draft. Appending a fixed
  // paragraph changes both the rejected draft and the repair's word budget.
  // Missing alternatives still fail the semantic check below.
  if(maximumWords!==undefined)return answer;
  // A supplied deck does not imply a separate full word list.
  if(assistantCardPracticeRequest(question) && !/词表|\b(?:word|vocabulary) list\b/i.test(question))return answer;
  if(!vocabularyPlan(question)
    || !/错词|错题|弱词|难词|错的词|说不出的词|记号|红圈|圈出|星号|标记|薄弱|不熟|剩下的词|missed|wrong|incorrect|weak|shaky|marked|circled|ticked|needs work|not yet/i.test(answer)
    || /本计划任一步骤若没有可用错词|In any step, if this subset is empty/i.test(answer)
    || /(?:any|every|each) step[^.!?\n]{0,160}(?:no (?:errors|mistakes)|none|empty|too (?:few|small))[^.!?\n]{0,160}(?:original|full|available) (?:word )?list/i.test(answer)
    || /(?:任一|每一|任何)步骤[^。\n]{0,100}(?:没有|不足|不够)[^。\n]{0,100}(?:原|完整)词表/.test(answer))return answer;
  const lines=answer.split('\n');
  const index=lines.findIndex(line=>/^\s+[-*]\s+/.test(line));
  const target=index>=0?index:lines.findIndex(line=>/^\d+[.)、]\s+.+[:：].+/.test(line));
  if(target<0)return answer;
  // A vocabulary pair can contain both scripts. Its spelling does not set the plan language.
  const outputLanguage=/answer in English|用英文|用英语/i.test(question)?'en':/用中文|answer in Chinese/i.test(question)?'zh':lang;
  lines[target]+={zh:' 本计划任一步骤若没有可用错词或数量不足，就用原词表中的可用词继续；词数不够可重复，均在该步骤原定时长内完成。',en:' In any step, if this subset is empty or too small, use available words from the original list; repeat available words as needed within that step’s allotted time.'}[outputLanguage];
  return lines.join('\n');
}

/** Project only explicit colour identities; current locations never fill hidden stickers. */
export function assistantPlanPieceFacts(question:string) {
  const colour='white|yellow|red|orange|blue|green';
  const cross=question.match(new RegExp(`\\b(?:use|with|choose) (${colour}) as (?:the |your |a )?cross colou?r\\b`,'i'))?.[1].toLowerCase();
  const pieces=[...question.matchAll(new RegExp(`\\b((?:${colour})(?:[-–](?:${colour}))+)[ \\t]+(corner|edge)\\b`,'gi'))].map(match=>{
    const colours=match[1].toLowerCase().split(/[-–]/),kind=match[2].toLowerCase();
    return {description:match[0],kind,colours,completeIdentity:new Set(colours).size===colours.length && colours.length===(kind==='corner'?3:2)};
  });
  if(!pieces.length)return;
  const pairs=cross?pieces.filter(p=>p.kind==='corner'&&p.completeIdentity&&p.colours.includes(cross)).flatMap(corner=>pieces.filter(p=>p.kind==='edge'&&p.completeIdentity).map(edge=>{
    const expectedEdgeColours=corner.colours.filter(c=>c!==cross);
    return {corner:corner.description,edge:edge.description,expectedEdgeColours,matches:expectedEdgeColours.every(c=>edge.colours.includes(c))};
  })):[];
  return {basis:'Explicit user descriptions, not verified observations; no colours inferred from position.',crossColour:cross,pieces,pairs};
}

/** Track explicit card faces only. Unknown orientation stays unknown; writing a
 * front/back label does not itself turn a card. This is not a prose proof engine. */
function assistantCardFlipViolation(answer:string):string|undefined {
  if(!/\bcards?\b|卡片|词卡/i.test(answer))return;
  let face:'word'|'meaning'|'prompt'|'answer'|undefined,startFace:typeof face,partialReset:typeof face,flipped=false,perAttempt=false;
  let sawFlip=false,routineResets=false,lastFlip=-1;
  type CardState={face:typeof face;startFace:typeof face;partialReset:typeof face;flipped:boolean;perAttempt:boolean;routineResets:boolean};
  let branch:CardState|undefined;
  let branchKind:'errors'|'zero'|undefined,lastEvent=0;
  const state=():CardState=>({face,startFace,partialReset,flipped,perAttempt,routineResets});
  const relativeFaces=/\bprompt[- ](?:side|face)\s+(?:up|facing up)|\b(?:reset(?:ting)?|return(?:ing)?)\s+(?:it|that card|each card|both cards|all cards|that same card)(?:\s+(?:back\s+)?to\s+(?:(?:the|its|their|that)\s+)?(?:same\s+)?prompt (?:faces?|sides?)|\s*(?=[,.;!?\n]|$))/i;
  const opposite=(side:typeof face):typeof face=>side==='word'?'meaning':side==='meaning'?'word':side==='prompt'?'answer':side==='answer'?'prompt':undefined;
  const events=/(?:word|English|meaning|Chinese|translation|picture|image|drawing|photo)[- ]side\s+(?:up|facing up)|(?:英文|单词|中文释义|释义|中文|词义|意思|词)(?:面)?朝上|(?:read|look at|show)\s+(?:each |the |a )?(?:card[’']s? )?(?:word|English|meaning|translation)\b|(?:看|读)(?:卡片)?(?:英文|单词|释义|中文|意思)面|\bflip(?:ping)?\b(?:\s+(?:it|them|each card|the cards?|over))*|\bturn\b[^.!?\n]{0,20}\bover\b|翻(?:到背)?面|\b(?:check|verify)\s+(?:the |its |your )?(?:word|English|meaning|translation)\b|(?:核对|检查)(?:其|卡片的)?(?:英文|单词|释义|中文|意思)|\brestart (?:the |this |same )?(?:stack|deck|cards|round)\b|\brepeat (?:the |this |same )?(?:pass|round|deck|cards|them)\b|\b(?:use|review|repeat|redo|rewrite|recall|write|say|test)\b(?=[^.!?;\n]*\b(?:again|once more|another time)\b)(?=[^.!?;\n]*(?:\b(?:cards?|deck|stack)\b|\bfrom (?:the |their )?(?:meaning|word|English|translation)[- ]side\b))|(?:整叠|整副|整轮).{0,6}(?:重来|重做|再来)|(?:重过|再过)一遍/gi;
  // A leading repeat adverb belongs to its action clause too. Normalize only
  // this syntactic position; face-setting events remain in their original order.
  answer=answer.replace(/\b(once more|again|another time),?\s+((?:rewrite|recall|write|say|test|repeat|redo|use|review)\b[^.!?;\n]*)/gi,'$2 $1');
  // A hyphenated name refers to a previously explained routine. Its
  // individual verb labels are not new physical actions.
  answer=answer.replace(/\b(?:attempt|recall|write)[–—-]flip[–—-]check[–—-]reset cycle\b/gi,'recall pass')
    .replace(/\b(?:attempt|recall)[–—-]check[–—-]reset cycle\b/gi,'recall pass');
  const repeats=/\b(?:re-?run|repeat)\b(?=[^.!?;\n]{0,100}\b(?:cards?|deck|stack|set|pass|round|recall|ones)\b)|\b(?:run|do|make|take)\b(?=[^.!?;\n]{0,80}\b(?:pass|round)\b)|\bfor\s+(?:a |one )?(?:second|extra|another)\s+(?:pass|round)\b/;
  const branches=/\bif\b(?=[^.!?;\n]{0,65}\b(?:errors?|wrong|missed|mistakes?|clean|empty)\b)|\b(?:otherwise|else)\b|\bor\b(?=\s+(?:do|run|repeat)\b)/;
  const repeatEvents=new RegExp(branches.source+'|'+repeats.source+'|'+relativeFaces.source+'|'+events.source+'|重洗(?:整叠|整副|全部)[^。；;\\n]{0,15}再练(?:一遍)?','gi');
  for(const event of answer.matchAll(repeatEvents)) {
    if(answer.slice(lastEvent,event.index).includes('\n')){branch=undefined;branchKind=undefined;}
    lastEvent=event.index!;
    if(/do not\s*$|don't\s*$|without\s*$|不要$|不必$|无需$/i.test(answer.slice(Math.max(0,event.index!-12),event.index)))continue;
    const text=event[0];
    if(/^if$/i.test(text)){
      const condition=answer.slice(event.index!+text.length).split(/[,;.!?\n]/)[0];
      const kind=/\b(?:no|none|nothing|zero|clean|empty)\b/i.test(condition)?'zero':'errors';
      if(branch && branchKind!==kind)({face,startFace,partialReset,flipped,perAttempt,routineResets}=branch);
      else branch=state();
      branchKind=kind;continue;
    }
    if(/^(?:otherwise|else|or)$/i.test(text)) {
      if(branch)({face,startFace,partialReset,flipped,perAttempt,routineResets}=branch);
      continue;
    }
    if(/^(?:restart|repeat|re-?run|redo|use|review|rewrite|recall|write|say|test|run|do|make|take|for|整叠|整副|整轮|重过|再过|重洗)/i.test(text)) {
      // Explicitly starting EACH attempt on its prompt face is a reset too.
      const following=answer.slice(event.index!+text.length).split(/[\n.!?。]/)[0];
      if(/^do$/i.test(text) && /^\s+not\b/i.test(following))continue;
      if(!branch && /\b(?:missed|wrong|marked)\b/i.test((text+following).split(/[;；]/)[0])){branch=state();branchKind='errors';}
      const resetAfter=/^(?:[^;；]{0,15})(?:after|先)[^;；]{0,25}(?:reset|return|重置|翻回)|^[^;；]{0,60}\bresetting\b[^;；]{0,35}\bfirst\b/i.test(following);
      const subsetReset=partialReset===startFace && /\b(?:only (?:the )?)?(?:wrong|missed|marked) cards\b|错卡/.test(text+following) && !/whole|full|全部|整叠/.test(text+following);
      if(flipped && face && startFace && face!==startFace && !perAttempt && !resetAfter && !subsetReset)return 'plan_card_reset_missing';
      // Replaying a flip/check routine changes faces even when its verbs are
      // referenced as “the same way”. Do not credit its starting orientation
      // as an end-of-pass reset. Explicit verbs below track their own effect.
      if(sawFlip && startFace && !routineResets && !perAttempt && !resetAfter && !/\bflip(?:ping)?\b|\bturn\b[^;.!?\n]{0,20}\bover\b/i.test(following.split(/[;；]/)[0])) {
        face=opposite(startFace);flipped=true;
      }
      continue;
    }
    if(relativeFaces.test(text)){
      if(/^prompt/i.test(text)) {face='prompt';startFace=face;flipped=false;partialReset=undefined;}
      else if(flipped && startFace) {
        face=startFace;flipped=false;partialReset=undefined;
        if(!/\n/.test(answer.slice(lastFlip,event.index)) && !/\b(?:both|all) cards\b/i.test(text))routineResets=true;
      }
      continue;
    }
    if(/^(?:flip|turn|翻)/i.test(text)){
      // A description of the preceding flip-and-reset cycle does not flip again.
      if(/^flip$/i.test(text) && /\bthe (?:single|same|first)\s*$/i.test(answer.slice(0,event.index))
        && /^\s+(?:plus|and) (?:the )?reset\b/i.test(answer.slice(event.index!+text.length)))continue;
      const resetBack=/^\s+(?:(?:it|them|each card|the card)\s+)?back\b/i.test(answer.slice(event.index!+text.length));
      if(flipped && face && startFace && face!==startFace && !perAttempt && !resetBack)return 'plan_card_reset_missing';
      face=opposite(face);flipped=true;sawFlip=true;routineResets=false;lastFlip=event.index!;continue;
    }
    const side=/^(?:picture|image|drawing|photo)[- ]side/i.test(text)?'prompt':/meaning|Chinese|translation|释义|中文|意思/i.test(text)?'meaning':'word';
    if(/^(?:check|verify|核对|检查)/i.test(text)){if(flipped && (face==='word' || face==='meaning') && face!==side)return 'plan_card_flip_direction';}
    else {
      const prefix=answer.slice(Math.max(0,event.index!-90),event.index).split(/[\n.!?。]/).at(-1)!;
      // A routine name such as “repeat the same meaning-side-up recall” is
      // not a physical reset. A reset/start verb must establish the face.
      if(/\b(?:repeat|re-?run)\b/i.test(prefix) && !/\b(?:reset(?:ting)?|return(?:ing)?|turn(?:ing)?|start(?:ing)?|lay|place|keep)\b/i.test(prefix))continue;
      // “Repeat the cards you missed, resetting each ...” only resets that
      // subset. It cannot establish the whole deck's face for an alternative.
      const subsetEach=/\b(?:repeat|review|practi[sc]e)\b[^;；.!?\n]*\b(?:missed|wrong|marked)\b[^;；.!?\n]*\b(?:reset(?:ting)?|return(?:ing)?|turn(?:ing)?)\s+each(?:\s+(?:one|card))?\s+(?:back\s+)?(?:to\s+)?$/i.test(prefix);
      if(flipped && (subsetEach || /(?:reset|return|turn)[^.;\n]*\b(?:only|wrong|missed|marked)\b[^.;\n]*$|(?:答错|错卡|错误的卡)[^。；\n]*$/i.test(prefix))) {partialReset=side;continue;}
      // Returning "that/the same card" inside the cycle resets each attempted
      // card just as "each card" does. Keep a full-deck setup before a pass
      // separate from an in-cycle reset. Otherwise replaying a reset loop
      // spuriously toggles its faces and makes the next pass look unsafe.
      const sameCardReset=/\b(?:return(?:ing)?|reset(?:ting)?|turn(?:ing)?)\s+(?:(?:that|this|the same|each)\s+card|it)\b|(?:翻回|重置|放回)(?:这|同一)张卡/i.test(prefix);
      if(flipped && side===startFace && lastFlip>=0 && !/\n|\b(?:activity|step)\s+\d/i.test(answer.slice(lastFlip,event.index))
        && (sameCardReset || !/[.!?。;]/.test(answer.slice(lastFlip,event.index)) && /\b(?:each|every|all)\b|每张|全部/i.test(prefix)))routineResets=true;
      face=side;startFace=side;flipped=false;partialReset=undefined;
      perAttempt=/(?:for each (?:card|attempt)|each (?:card|attempt) starts?|every (?:pass|round)|每(?:次|轮|张))[^;；]{0,55}(?:start|begin|从|先|以)/i.test(prefix);
    }
  }
}

type WrittenAction = { index:number; end:number; text:string; attempt:boolean; reference:boolean; optional:boolean };

/** Classify the object of each write, not unrelated card nouns earlier in a clause. */
function assistantWrites(text:string):WrittenAction[] {
  return [...text.matchAll(/\b(?:write|writing|jot|copy|record in writing)\b|\battempt(?:ing)?\b(?=[^,.;!?\n]{0,60}\bon paper\b)|在纸上(?:分别|逐(?:项|张|个)|先)?(?:手写|写)|手写(?!的|体)|默写|写下|写出|抄写|写在/gi)].map(match=>{
    const index=match.index!,tail=text.slice(index);
    const boundary=tail.search(/[,，;；。.!?\n]|\b(?:and|then|before|after)\s+(?:flip|turn|reset|uncover|check|compare|write|say|read)\b|(?:再|然后|接着)(?:翻|核对|检查|写|说)/i);
    const end=index+(boundary<0?tail.length:boundary),object=text.slice(index,end);
    const attempt=/\b(?:attempt(?:ed)?|guess(?:ed)?|answers?|responses?|from memory|matching word|corresponding word)\b|默写|对应.{0,8}(?:单词|英文)|答案|作答/i.test(object);
    const reference=/\b(?:cards?|slips?|fronts?|backs?|reverse|sides?)\b|卡片|词卡|正面|背面|抄.*(?:词表|清单)|copy.*(?:list|meanings)/i.test(object)
      && !attempt && !/\bon (?:a |the |spare )?(?:paper|sheet)\b|在纸上/i.test(object);
    const optional=/\b(?:write|jot)\s+or\s+(?:say|speak)|\b(?:say|speak)\s+or\s+(?:write|jot)|(?:手写|写下|书写|写出).{0,3}或.{0,3}(?:说出|口述)|(?:口述|说出).{0,3}或.{0,3}(?:手写|书写|写下|写出)/i.test(text.slice(Math.max(0,index-20),end))
      || /do not |don't |不要|不必|无需/i.test(text.slice(Math.max(0,index-12),index));
    return {index,end,text:object,attempt,reference,optional};
  });
}

/** A reference card is not an attempted answer; an optional write creates no guarantee. */
function assistantWrittenAnswerMissing(question:string,answer:string):boolean {
  if(/\bwritten (?:answers|responses|guesses|attempts)\b|我.{0,8}(?:写好|写过).{0,8}(?:答案|单词)/i.test(question))return false;
  let written=false;
  for(const clause of answer.split(/[，,。.!?;；\n]/)) {
    const writes=assistantWrites(clause).filter(w=>!w.reference&&!w.optional);
    const reviews=[...clause.matchAll(/比较.{0,8}(?:清单|列表)|\bcompare (?:their |your |the )?lists\b|写错|拼写错误|\b(?:written (?:answers?|guesses|attempts|responses|words?)|misspellings)\b/gi)];
    for(const review of reviews)if(!written && !writes.some(w=>w.index<review.index!))return true;
    if(writes.length)written=true;
  }
  return false;
}

/** Reject explicit reveal-then-attempt sequences, while allowing later corrections.
 * Each structured step is separate; in prose, sentences keep independent drills apart.
 */
function assistantAnswerRevealedFirst(actions:string[]):boolean {
  for(const action of actions)for(const sentence of action.split(/[.!?。\n]|[;；]\s*(?=if\b|when\b|若|如果)/i)) {
    const writes=assistantWrites(sentence).filter(w=>w.attempt&&!w.reference&&!w.optional);
    const reveals=[...sentence.matchAll(/\b(?:flip|flipping|uncover|uncovering|reveal|revealing)\b|翻(?:卡|面|到)|揭开|露出答案/gi)]
      .filter(m=>!/do not |don't |不要|不必|无需/i.test(sentence.slice(Math.max(0,m.index!-12),m.index)))
      .filter(m=>!/\b(?:as (?:the |a )?(?:prompts?|cues?)|as (?:prompts?|cues?)|to read)\b|作为(?:题目|提示)|用作(?:题目|提示)/i.test(sentence.slice(m.index!).split(/[,，;；]/)[0]))
      .filter(m=>!/^(?:flip|flipping|翻)/i.test(m[0]) || /check|spelling|answer|reference|核对|检查|答案/i.test(sentence.slice(m.index!).split(/[,，;；]|\band (?:write|say)\b/)[0]));
    for(const write of writes)for(const reveal of reveals) {
      const ri=reveal.index!,wi=write.index;
      if(ri<wi) {
        // "Before flipping ..., write ..." and "flip AFTER writing ..." put writing first.
        const prefix=sentence.slice(Math.max(0,ri-16),ri),between=sentence.slice(ri,wi);
        if(/\bbefore\s*$|在\s*$/i.test(prefix) && (/\bbefore\s*$/i.test(prefix)||/前/.test(between)))continue;
        if(/\bafter\s*$/i.test(between))continue;
        // A fresh covered-column attempt starts a new retrieval cycle. Earlier
        // reveals in the same paragraph no longer expose that new reference.
        const hidden=[...between.matchAll(/\b(?:cover|hide)\b[^.!?;\n]{0,35}\b(?:word|meaning)\b[^.!?;\n]{0,15}\bcolumn\b|(?:盖住|遮住)(?:单词|释义|含义|英文|中文)列/gi)];
        if(hidden.some(h=>!/do not\s*$|don't\s*$|without\s*$|不要$|不再$/i.test(between.slice(0,h.index))))continue;
        return true;
      }
      // "Write ... after flipping" reverses textual order. "Write ... before flipping" is valid.
      if(wi<ri && /\bafter\s*$|之后.{0,8}$/i.test(sentence.slice(wi,ri)))return true;
    }
  }
  return false;
}

/** Resolve explicit column names and local references once for both state
 * and cycle checks. A shortened "cover MEANING/it" refers to the same column;
 * an unknown pronoun or a negated operation never establishes a state.
 */
function assistantColumnOperations(action:string) {
  let previous:'word'|'meaning'|undefined;
  const operations:Array<{index:number;end:number;column:'word'|'meaning';kind:'cover'|'expose'}>=[];
  for(const match of action.matchAll(/\b((?:re-?)?cover(?:ing)?|hid(?:e|ing)|uncover(?:ing)?|reveal(?:ing)?|expos(?:e|ing))\s+(?:(?:the|same|only|entire)\s+)*(WORD|MEANING|it|that column)\b(?:\s+column)?|\b(cover) again(?=\s*[,;.!?]|\s+before\b|\s*$)/gi)) {
    if(/\b(?:do not|don't|never|without)\s*$/i.test(action.slice(0,match.index)))continue;
    const column=!match[2] || /^(?:it|that column)$/i.test(match[2])?previous:match[2].toLowerCase() as 'word'|'meaning';
    if(!column)continue;
    previous=column;
    operations.push({index:match.index!,end:match.index!+match[0].length,column,kind:/^(?:uncover|reveal|expos)/i.test(match[1]??match[3])?'expose':'cover'});
  }
  return operations;
}

/** State the covered column through the operation itself. A model can turn
 * “say which column is covered” into a contradictory instruction to recite it. */
function normalizeAssistantParagraphColumns(action:string):string {
  return action.replace(/(\b[Cc]over the (?:word|meaning|[A-Z][a-z]+) column),\s*(?:and\s+)?(?:say|state|note) that the (?:word|meaning|[A-Z][a-z]+) column is (?:covered|hidden)(?=[,;.!?]|$)/g,
    '$1, keep the other column visible');
}

/** When switching directions on a sheet, explicitly expose the new cue.
 * Only repair positive, adjacent instructions for opposite columns. */
export function normalizeAssistantWordSheetTransitions(answer:string):string {
  const withRead=answer.replace(/\b(cover the (WORD|MEANING) column)(,\s*(?:then\s+)?)(?=(?:read|look at) (?:each|every|the) (?:[A-Z][a-z]+ )?(WORD|MEANING)\b)/gi,
    (match,cover:string,hidden:string,separator:string,cue:string,offset:number)=>{
      if(hidden.toLowerCase()===cue.toLowerCase() || /\b(?:do not|don’t|don't|never|without)\s*$/i.test(answer.slice(0,offset)))return match;
      return `${cover}, uncover the ${cue} column${separator}`;
    });
  return withRead.replace(/\b((?:word-to-meaning|meaning-to-word) (?:attempt|recall)(?:,\s*|\s+))keep the (WORD|MEANING)(?: column)? visible and the (WORD|MEANING)(?: column)? covered\b/gi,
    (match,direction:string,cue:string,hidden:string)=>{
      const expected=/^word-to-meaning/i.test(direction)?'word':'meaning';
      if(cue.toLowerCase()!==expected || hidden.toLowerCase()===expected)return match;
      return `${direction}uncover the ${cue} column and cover the ${hidden} column`;
    });
}

function oralWordSheet(question:string):boolean {
  return /\b(?:list|sheet)\b/i.test(question)
    && /\b(?:both|two|each) (?:recall )?directions?\b|\bbidirectional\b/i.test(question)
    && /\b(?:say|speak|tell)\b[^.!?;\n]{0,45}\b(?:answer|word|meaning|translation|aloud)\b|\boral(?:ly)?\b|\baloud\b/i.test(question)
    && !/\b(?:write|writing|written|handwrite|handwriting|spell|spelling)\b/i.test(question.replace(/\b(?:write|give) (?:me )?(?:one|a|the) paragraph\b/i,''));
}

/** Prefer the explicit response mode to the usual spelling-practice default. */
export function normalizeAssistantWordSheetOralRecall(text:string,question:string):string {
  if(!oralWordSheet(question))return text;
  return text.replace(/\b(?:handwrite|write(?: down)?|jot down)\s+((?:the |each |your |its )?(?:[A-Z][\p{L}-]*\s+)?(?:words?|answers?|responses?|meanings?|translations?))\b(?:\s+on (?:a piece of )?(?:scrap )?paper)?/giu,
    (match,object:string,at:number)=>/\b(?:never|do not|don't|without)\s*$/i.test(text.slice(Math.max(0,at-24),at))?match:'say '+object+' aloud')
    .replace(/\bwritten (answers?|responses?|attempts?|recall)\b/gi,'spoken $1');
}

const sheetRecallAttempt=/\b(?:say|speak|handwrite|write|rewrite|spell|recall|repeat|retest|retrieve)\b/i;
const sheetReveal=/\b(?:uncover(?:ed|ing)?|reveal(?:ed|ing)?|expos(?:e|ed|ing))\b|\b(?:lift|remove) (?:the )?cover\b/i;
const sheetCheck=/\b(?:check(?:ing)?|verif(?:y|ying)|compar(?:e|ing))\b/i;
function completeAssistantWordSheetChecks(activity:AssistantStructuredPlan['activities'][number],question:string) {
  if(!/\b(?:hide|cover|keep)\b[^.!?;\n]{0,55}\b(?:until after|before (?:each|the|every|trying))\b|\b(?:uncover|reveal)\b[^.!?;\n]{0,55}\b(?:check|verify|compare)\b/i.test(question))return;
  for(const [index,step] of activity.steps.entries()) {
    const action=step.action;
    const attempt=sheetRecallAttempt.exec(action);
    if(!attempt || !/\b(?:cover|re-cover|hide)\b[^.!?\n]{0,45}\b(?:column|answer)\b/i.test(action) || /\b(?:never|do not|don't)\s+(?:uncover|reveal)\b/i.test(action))continue;
    const next=activity.steps[index+1]?.action;
    // A separately timed check can follow a batch of attempts.
    if(next && sheetReveal.test(next) && sheetCheck.test(next) && !sheetRecallAttempt.test(next))continue;
    const after=action.slice(attempt.index+attempt[0].length);
    const reveal=sheetReveal.exec(after);
    if(reveal && (sheetCheck.test(after.slice(reveal.index))
      || /\b(?:check(?:ing)?|compar(?:e|ing))\b[^.!?;\n]{0,70}\b(?:uncovered|revealed)\b[^.!?;\n]{0,40}\bafter (?:writing|speaking|recall|the attempt)\b/i.test(after)))continue;
    const concise=action
      .replace(/[,;]\s*or finish if none are weak\b[.!?]?$/i,'')
      .replace(/[.!?]\s*If (?:there (?:are|were) )?no (?:errors|mistakes|misses),\s*finish after one pass\b[.!?]?$/i,'')
      .replace(/[.!?]$/,'');
    step.action=concise+(reveal?'. Check the answers.':', then uncover and check.');
  }
}

/** Preserve the supplied sheet and complete an explicit two-direction
 * recall/check request within the existing allocations. */
export function normalizeAssistantWordSheetPlan(plan:AssistantStructuredPlan,question:string,userTexts:string[],paragraph:boolean):void {
  const supplied=userTexts.join('\n');
  if(!/词表|对照表|\b(?:(?:word(?:[- ]and[- ]meaning)?|vocabulary)[- ](?:sheet|list)|two[- ]column (?:sheet|list|table))\b/i.test(supplied))return;
  const existingSheet=suppliedWordSheet.test(supplied);
  for(const activity of plan.activities)for(const step of activity.steps){
    step.action=step.action.replace(/(?:把|将)(词表|对照表|单词表)翻(?:到|回)同一面(?=[，,；;。.!?]|$)/g,'保持$1同一面朝上');
    step.action=step.action.replace(/(\buncover (?:the )?(?:WORD|MEANING)(?: column)? to check and )recover it before\b/gi,'$1re-cover it before');
    if(existingSheet)step.action=step.action.replace(/\s*[；;]\s*(?:若|如果)词表(?:尚)?未列出(?:具体词项?)?，先写下[^。；;！？\n]+(?:。|$)/,'。');
    if(paragraph)step.action=normalizeAssistantWordSheetTransitions(normalizeAssistantParagraphColumns(step.action));
    step.action=normalizeAssistantWordSheetOralRecall(step.action,question);
    step.reason=normalizeAssistantWordSheetOralRecall(step.reason,question);
  }
  if(!paragraph && !assistantCardPracticeRequest(question))for(const activity of plan.activities){
    completeAssistantWordSheetChecks(activity,question);
    if(existingSheet && /\b(?:each|every) (?:attempt|answer|word|meaning)\b/i.test(question))for(const step of activity.steps){
      // Complete a local per-item check, with no later action to reinterpret.
      const gap=assistantMissingColumnCycles(step.action).at(-1);
      if(gap?.repairable && /^\s*[.!?]?\s*$/.test(step.action.slice(gap.end)))
        step.action=step.action.slice(0,gap.end)+' and re-cover the '+gap.column+' column'+step.action.slice(gap.end);
    }
  }
  if(!paragraph || plan.activities.length!==2 || plan.activities.some(activity=>activity.steps.length!==1))return;

  const language=/\b([A-Z][a-z]+)\s+(?:word[- ]and[- ]meaning|word) (?:sheet|list)\b/.exec(supplied)?.[1];
  if(language){
    const directions=new RegExp(`\\b${language}[- ]to[- ]([A-Z][a-z]+)\\b|\\b([A-Z][a-z]+)[- ]to[- ]${language}\\b`,'g');
    const aliases=new Set(plan.activities.flatMap(({title})=>[...title.matchAll(directions)].map(m=>m[1]??m[2])));
    for(const alias of aliases){
      const gloss='(?:meanings?|translations?|gloss(?:es)?|definitions?|explanations?)';
      const declared=new RegExp(`\\b${alias}\\s+${gloss}\\b|\\b${gloss} in ${alias}\\b`,'i').test(supplied);
      if(alias===language || declared)continue;
      const replace=(text:string)=>text
        .replace(new RegExp(`\\b${alias} (?=meanings?\\b)`,'gi'),'')
        .replace(new RegExp(`(\\b${language}[- ]to[- ])${alias}\\b`,'gi'),'$1meaning')
        .replace(new RegExp(`\\b${alias}([- ]to[- ]${language}\\b)`,'gi'),'Meaning$1');
      for(const activity of plan.activities){
        activity.title=replace(activity.title);
        activity.steps[0].action=replace(activity.steps[0].action);
        activity.steps[0].reason=replace(activity.steps[0].reason);
      }
    }
  }
  if(!/\b(?:uncover|reveal)\b[^.!?;\n]{0,55}\b(?:check|verify)\b/i.test(question))return;
  const actions=plan.activities.map(activity=>activity.steps[0]);
  if(!actions.every(({action})=>/\bcover (?:the )?[^.!?;\n]{0,35}\bcolumn\b/i.test(action)
    && /\b(?:visible|stays? visible|leave (?:it|them) visible)\b/i.test(action)
    && /\b(?:say|respond|recall|write|answer|spell)\b/i.test(action)))return;
  for(const step of actions){
    const reveals=/\b(?:uncover|reveal)\b/i.test(step.action);
    const checks=/\b(?:check|verify)\b/i.test(step.action);
    if(checks)continue;
    step.action=step.action.replace(/[.!?]?$/,'')+(reveals
      ? '. Check the responses against the uncovered column.'
      : '. After the attempts, uncover the answer column and check the responses.');
  }
}

/** A column revealed after every answer must be hidden again before the next.
 * Batch recall followed by one final check and per-item cover instructions are
 * different valid routines; do not infer a per-item reveal from "each" alone.
 */
function assistantMissingColumnCycles(action:string) {
  const operations=assistantColumnOperations(action);
  const covers=operations.filter(event=>event.kind==='cover');
  const gaps:Array<{end:number;column:'word'|'meaning';repairable:boolean}>=[];
  for(const reveal of action.matchAll(/\b(?:uncover|uncovering|reveal|revealing)\b[^.!?;\n]{0,35}\bcheck(?: (?:each|every) (?:answer|attempt|response|one))?\b/gi)) {
    // A prose paragraph can contain several directions. Bind this reveal to
    // its nearest preceding cover, never the first cover of the paragraph.
    const cover=covers.filter(c=>c.end<=reveal.index!).at(-1);
    if(!cover || /do not\s*$|don't\s*$|without\s*$/i.test(action.slice(0,cover.index)))continue;
    const attempt=action.slice(cover.end,reveal.index);
    const perItem=/\bcheck (?:each|every)\b/i.test(reveal[0]) || /\b(?:read|look at) (?:each|every) (?:word|meaning)\b/i.test(attempt);
    if(!perItem || /\b(?:all|both)\b[^.!?;\n]*\b(?:before|together)\b|\b(?:all|both) (?:answers|attempts)\b/i.test(attempt+reveal[0]))continue;
    const before=action.slice(0,cover.index);
    if(/\bfor (?:each|every)\b[^.!?;\n]{0,45}$/i.test(before))continue;
    const end=reveal.index!+reveal[0].length,next=covers.find(c=>c.index!>=end);
    const between=action.slice(end,next?.index);
    if(next && next.column===cover.column
      && !/do not\s*$|don't\s*$|without\s*$|\b(?:activity|substep)\s+\d|\b(?:uncover|reveal)(?:ing)?\b/i.test(between))continue;
    const exposed=operations.find(event=>event.kind==='expose' && event.index>=reveal.index! && event.index<end);
    gaps.push({end,column:cover.column,repairable:!exposed || exposed.column===cover.column});
  }
  return gaps;
}

/** Track explicit table visibility across step boundaries. A reference table
 * has columns on one face, not card faces. Unknown visibility stays unknown:
 * only an explicit hide-both instruction creates the hidden-cue obligation.
 * Reasons do not perform actions and must never discharge that obligation.
 */
function assistantTableVisibilityViolation(actions:string[]):string|undefined {
  let bothHidden=false;
  for(const action of actions) {
    const flips=/\b(?:flip|turn)(?:ping|ing)?\b[^.!?;\n]{0,35}\b(?:list|table|sheet)\b[^.!?;\n]{0,35}\b(?:side|back|over)\b|(?:词表|对照表|单词表|纸张)[^。；;\n]{0,10}翻(?:到|至|向|过)[^。；;\n]{0,16}(?:侧|面)/gi;
    for(const flip of action.matchAll(flips)) {
      if(!/\b(?:do not|don't|never)\s*$|(?:不要|无需)(?:把|将)?[^。；;，]*$/i.test(action.slice(0,flip.index)))return 'plan_table_material_mismatch';
    }
    // The scanner preserves action order and state between preparation and
    // practice. "Only X visible" is an explicit cue exposure, not a flip.
    const events=/\b(?:cover|hide|conceal)\b[^.!?;,\n]{0,35}\bboth (?:the )?columns\b|\bboth (?:the )?columns (?:are |remain |stay )?(?:covered|hidden)\b|(?:两列|双列|两栏)(?:全|都|均|一起)?(?:部)?(?:遮住|盖住|挡住|遮挡)|(?:遮住|盖住|挡住|遮挡)(?:[^。；;，\n]{0,12})?(?:两列|双列|两栏)|\b(?:uncover|reveal|expose|show|leave|keep)\b[^.!?;,\n]{0,35}\b(?:prompt|cue|word|meaning|left|right)\b(?:[^.!?;,\n]{0,15}\b(?:column|visible)\b)?|(?:揭开|露出|显示|只留|仅留|保持)[^。；;，\n]{0,18}(?:题目|提示|单词|英文|中文|释义|左列|右列)|\b(?:read|look at)\s+(?:(?:each|every|the|a|one)\s+)?(?:word|meaning|prompt|cue)\b|(?:逐个)?(?:看|读)(?:左列|右列)?(?:的)?(?:单词|英文|中文|释义|提示|题目)/gi;
    for(const event of action.matchAll(events)) {
      const prefix=action.slice(0,event.index);
      if(/\b(?:do not|don't|never|without)\s*$|不要$|不必$|无需$|不再$/i.test(prefix))continue;
      if(/^(?:cover|hide|conceal|both)\b|^(?:两列|双列|两栏|遮住|盖住|挡住|遮挡)/i.test(event[0]))bothHidden=true;
      else if(/^(?:uncover|reveal|expose|show|leave|keep)\b|^(?:揭开|露出|显示|只留|仅留|保持)/i.test(event[0])) {
        // Revealing an answer to check is not revealing a prompt to attempt.
        if(!/\b(?:to check|and check)\b|核对|检查/i.test(action.slice(event.index!,event.index!+event[0].length+14)))bothHidden=false;
      } else if(bothHidden)return 'plan_prompt_hidden';
    }
  }
}

/** Check stated column operations against their stated consequence. Keep
 * unknown columns unknown; a visibility assertion is not itself an operation
 * that can silently undo the preceding cover instruction.
 */
function assistantTableColumnContradiction(actions:string[]):boolean {
  const role=(text:string)=>/meaning|释义|词义|含义/i.test(text)?'meaning':'word';
  for(const action of actions) {
    const hidden:Partial<Record<'word'|'meaning',boolean>>={};
    const events=/(?:遮住|盖住|揭开|露出)(?:单词|释义|词义|含义)列|\bso (?:that )?only (?:the )?(?:words?|meanings?)(?: column)? (?:are |is )?(?:visible|show|exposed)\b|因此只(?:能)?(?:看见|看到)(?:单词|释义|词义|含义)|\b(?:read|look at) (?:each |every |the |visible )?(?:WORD|MEANING)\b|(?:看|读)(?:单词|释义|词义|含义)列/gi;
    const ordered=[...action.matchAll(events)].map(event=>({index:event.index!,text:event[0]}));
    ordered.push(...assistantColumnOperations(action).map(event=>({index:event.index,text:`${event.kind} ${event.column}`})));
    for(const event of ordered.sort((a,b)=>a.index-b.index)) {
      if(/\b(?:do not|don't|never|without)\s*$|不要$|无需$/i.test(action.slice(0,event.index)))continue;
      const text=event.text,column=role(text);
      if(/^(?:cover|hide)(?:ing)?\b|^(?:遮住|盖住)/i.test(text))hidden[column]=true;
      else if(/^(?:uncover|reveal|expose)(?:ing)?\b|^(?:揭开|露出)/i.test(text))hidden[column]=false;
      else {
        if(hidden[column]===true)return true;
        if(/^so\b|^因此/i.test(text) && hidden[column==='word'?'meaning':'word']===false)return true;
      }
    }
  }
  return false;
}

const cardFirstFace=String.raw`正面|(?<!另)一面|\b(?:fronts?|one (?:card )?(?:side|face))\b`;
const cardOtherFace=String.raw`背面|反面|另一面|\b(?:backs?|reverse|(?:the )?(?:other|opposite) (?:card )?(?:side|face))\b`;

function assistantEnglishWordFront(action:string):boolean {
  return /正面(?:分别)?写(?:上)?(?:英文|\s*[a-z]+)[^。；;\n]{0,65}背面(?:分别)?写(?:上|对应)?(?:中文|\s*[\p{Script=Han}])/iu.test(action)
    && !/正面(?:分别)?写(?:上)?中文[^。；;\n]{0,50}背面(?:分别)?写(?:上|对应)?英文/.test(action);
}

/** A known Chinese back is the cue in reverse practice. Name the word face
 * for the flip check; preserve preparation, the response and any reset. */
export function normalizeAssistantCardCheckFace(input:unknown,question:string):AssistantStructuredPlan|undefined {
  if(!assistantCardPracticeRequest(question) || !/看中文[^。；;\n]{0,16}(?:手)?写[^。；;\n]{0,12}英文/.test(question))return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  let established=false,changed=false;
  for(const step of parsed.data.activities.flatMap(activity=>activity.steps)){
    if(established){
      const action=step.action.replace(/((?:看中文|中文面朝上)[^。；;\n]{0,45}(?:写(?:出|下)?|口头说出)(?:\s*对应的?)?英文[^。；;\n]{0,20}翻到)(?:卡片)?背面(?=\s*(?:核对|检查))/g,'$1英文面');
      if(action!==step.action){step.action=action;changed=true;}
    }
    established ||= assistantEnglishWordFront(step.action);
  }
  return changed?parsed.data:undefined;
}

function assistantHasExistingCards(question:string):boolean {
  const sentences=question.split(/[.!?。！？\n]/);
  return sentences.some(text=>{
    // Ownership means an existing deck, not a planned material.
    if(new RegExp(`(?:没有|没做|还没|尚未|未制作)[^，,；;]{0,14}(?:${chinesePracticeCard})`).test(text)
      || /只有纸笔|\b(?:no|without|don['’]t have|do not have|haven['’]t (?:made|prepared)|not yet (?:made|prepared)|(?:will|plan to|need to) (?:make|prepare|create))\b[^;，,]{0,42}\b(?:flashcards?|cards?|deck)\b/i.test(text))return false;
    const preparedWithFaces=!/空白卡/.test(text)
      && new RegExp(`(?:${chinesePracticeCard})\\s*(?:已经|已)(?:做|制|制作|准备)(?:好|完)(?:了)?[，,；;]?\\s*[^。！？\\n]{0,50}(?:${cardFirstFace})[^。！？\\n]{1,42}(?:${cardOtherFace})`).test(text);
    return preparedWithFaces || new RegExp(`(?:我有|(?:我)?(?:已经|早就)有|已有|现成(?:的)?|我的|(?:已经|已)(?:做|备|准备|制作|制)(?:好|完)(?:了|的)?).{0,24}${chineseTwoSidedCard}|${chineseTwoSidedCard}[^，,；;]{0,14}(?:已经做好|做完了|已准备好)`).test(text)
      || /\b(?:my|our|I (?:already )?(?:have(?: got)?|use|am using))\s+(?:(?:a (?:set|deck) of|some|existing|ready[- ]made|pre[- ]made|pre[- ]prepared|already prepared)\s+)*(?:double[- ]sided|two[- ]sided)\s+(?:(?:[a-z]+(?: [a-z]+)?\s*(?:[-–—/]|\band\b)\s*[a-z]+(?: [a-z]+)?)\s+)?(?:(?:word|vocabulary|revision)\s+)?(?:flashcards?|cards?)\b/i.test(text)
      || (!/\bblank\b/i.test(text)
        && /\b(?:existing|ready[- ]made|pre[- ]made|prepared)\s+(?:[a-z-]+\s+){0,3}(?:flashcards?|cards?)\b[^.;\n]{0,100}\b(?:front\b[^.;\n]{1,100}\bback|back\b[^.;\n]{1,100}\bfront|on one (?:side|face)\b[^.;\n]{1,100}\bon the other(?: (?:side|face))?)\b/i.test(text)
        && /\b(?:words?|spellings?|pictures?|drawings?|images?|names?|terms?|meanings?|translations?|explanations?|gloss(?:es)?|definitions?|characters?)\b/i.test(text))
      || /\b(?:front|back) of (?:each of )?my (?:revision |study |vocabulary )?cards?\b[^.;\n]{0,100}[;,.]\s*(?:and )?(?:the )?(?:back|front)\b[^.;\n]{1,90}/i.test(text);
  });
}

// Fixed syntax for declared bilingual pairs, e.g. oak=橡树. A mention of
// “front and back” alone does not prove either reference was written there.
function assistantNamedCardLayout(prepared:string,question:string):boolean {
  const pairs=[...question.matchAll(/(?<![\p{L}\p{N}])([\p{Script=Latin}][\p{Script=Latin}'’-]{0,39})\s*[=＝]\s*([\p{Script=Han}]{1,20}?)(?=$|[\s、，,；;。.!?！？]|(?:请|做|安排|给)(?:[一二两三四五六七八九十\d]项|我)|(?:用来|来做|做|来)练习)/gu)];
  if(!pairs.length || pairs.length>12)return false;
  const front=cardFirstFace,back=cardOtherFace;
  prepared=prepared.replace(/\b(one (?:face|side))\b([^.;\n]{0,80}?)\bthe other(?=\s*[,;.!?\n]|$)/gi,'$1$2the other face');
  // "Write on the cards, turn them over and write" establishes opposite
  // faces when the supplied reference words and glosses occur on each side.
  prepared=prepared.replace(/(空白卡(?:上)?\s*)(?=(?:各|分别)?写[^。；;\n]{0,95}翻(?:到)?(?:背面|反面|另一面|面)\s*(?:再|各|分别|各自)?写)/g,'$1一面')
    .replace(/翻(?:到)?(?:背面|反面|另一面|面)(?=\s*(?:再|各|分别|各自)?写)/g,'另一面');
  const label=(text:string)=>String.raw`(?<![\p{L}\p{N}])${text}(?![\p{L}\p{N}])`;
  // The pair syntax above admits only letters and literal apostrophes/hyphens.
  const words=pairs.map(m=>label(m[1])),meanings=pairs.map(m=>m[2]);
  function onFace(ref:string,face:string,otherRefs:string[]){
    const gap=`(?:(?!(?:${front}|${back}|${otherRefs.join('|')}))[^,.!?，。；;\\n]){0,80}?`;
    return new RegExp(`(?:${ref})${gap}(?:${face})|(?:${face})${gap}(?:${ref})`,'iu').test(prepared);
  }
  return (words.every(ref=>onFace(ref,front,meanings))&&meanings.every(ref=>onFace(ref,back,words)))
    || (words.every(ref=>onFace(ref,back,meanings))&&meanings.every(ref=>onFace(ref,front,words)));
}

/** Bind each reference to its own face. A relation cannot cross another
 * reference or face label; opposite-face relations may span separate sentences.
 */
function assistantCardLayoutReady(prepared:string,question=''):boolean {
  const word=String.raw`\b(?:words?|English)\b|单词|英文|词语|词(?!义|汇|表)`;
  const meaning=String.raw`\b(?:meanings?|translations?|definitions?)\b|释义|中文|意思|词义`;
  const front=cardFirstFace;
  const back=cardOtherFace+String.raw`|\bthe other(?!\s+(?:word|card|meaning))\b`;
  const gap=`(?:(?!(?:${word}|${meaning}|${front}|${back}))[^.!?。；;\\n])*?`;
  const relation=(role:string,face:string)=>new RegExp(`(?:${role})${gap}(?:${face})|(?:${face})${gap}(?:${role})`,'i').test(prepared);
  const written=/\b(?:write|copy|prepare|make)\b|写|抄|制作|制卡/i.test(prepared);
  const paired=/\bwords?\b[^.!?。；;\n]*?\bmeanings?\b|\bmeanings?\b[^.!?。；;\n]*?\bwords?\b|(?:单词|英文)[^。；;\n]*?(?:释义|中文)|(?:释义|中文)[^。；;\n]*?(?:单词|英文)/i.test(prepared);
  const opposite=/\b(?:opposite|separate) (?:card )?(?:sides|faces)\b|正反两面|分别.{0,15}两面/i.test(prepared);
  const completePairs=/\bword[- ]meaning pairs?\b[^.!?;\n]*\bboth faces (?:completed|prepared)\b/i.test(prepared);
  // A meaning slip is a valid first face only when its word is on the reverse.
  const meaningSlip=new RegExp(`(?:${meaning})${gap}\\bslips?\\b|(?:${meaning})${gap}(?:纸条|纸片)`,'i').test(prepared);
  return written && (assistantNamedCardLayout(prepared,question) || paired&&opposite || completePairs || relation(word,front)&&relation(meaning,back) || (relation(meaning,front)||meaningSlip)&&relation(word,back));
}

/** A zero-error alternative must select a usable set or finish, not merely
 * contain a repeat verb. An explicit empty-set repeat cannot be rescued by an
 * unrelated global fallback elsewhere in the answer.
 */
function assistantEmptySubsetBranches(answer:string):{available:boolean;invalid:boolean} {
  const conditions=/\b(?:if|when|with)\b[^.!?;\n]*?(?:(?:no|zero|0) (?:errors|mistakes|misses)|(?:none|nothing|no (?:words|cards|items|answers|entries)) (?:were |was |is |are )?(?:missed|marked|wrong|incorrect)\b|(?:pile|subset|set) is empty|(?:all|both)[^.!?;\n]*?correct)|\bif none\b|(?:若无|如无|如果没有|若没有|没有)(?:错词|错题|错卡|错误|写错的(?:词|单词|卡))|(?:若|如果|当)(?:(?:上[一轮次]|第[一1](?:项|轮)|前一轮)轮?|这轮|本轮)?(?:全对|全部(?:答|写|拼)?对)|(?:若|如果)(?:首轮|上一轮|第[一1](?:项|轮))?(?:没有|未曾|不曾|一次都没(?:有)?)写错(?=就|则|时|[，,；;。！!？?]|$)|本计划任一步骤若没有可用错词/gi;
  let available=false,invalid=false;
  for(const condition of answer.matchAll(conditions)) {
    // "If zero errors, use the complete list, otherwise repeat misses": the
    // repeat belongs to the nonempty branch and cannot invalidate the first.
    const branch=answer.slice(condition.index!+condition[0].length).split(/[.!?。；;\n]|\b(?:otherwise|else)\b|否则|不然|[，,]\s*(?=(?:若|如果)(?:有错|上一轮有错|写错|答错)|if (?:you |there )?(?:had |made |are )?(?:errors?|mistakes?))/i)[0];
    const emptyRepeat=/\b(?:repeat|review|practi[sc]e|use|pick|choose|read|redo)\s+(?:only |just )?(?:the |those |your )?(?:missed|wrong|marked|incorrect) (?:words|cards|items|ones)\b|(?:重做|重过|复习|练习|挑选|再过|重复)(?:那些|这些|所有|全部|原来|已标记的|标记的)?(?:错词|错卡|错题|错误项)/i.exec(branch);
    const stop=/\b(?:stop|finish|skip|end)\b|停止|结束|跳过/i.exec(branch);
    const full=/\b(?:whole|full|complete|original|available|same)\s+(?:(?:word|vocabulary) )?(?:list|set|deck|stack|cards|words)\b|\ball\s+(?:available )?(?:cards|words)|(?:整叠|整副|整套卡|全部卡片|全套|原词表|完整词表|全部单词)|(?:重做|重练|再练|用)整套(?=\s*(?:一遍|[，,]|$))/i.exec(branch);
    if(emptyRepeat && !/do not\s*$|don't\s*$|不再$|不要$|无需$/i.test(branch.slice(0,emptyRepeat.index)) && (!full || full.index>emptyRepeat.index) && (!stop || stop.index>emptyRepeat.index))invalid=true;
    if(full || stop)available=true;
  }
  return {available,invalid};
}

/** New meaning slips cannot borrow the reference words from an older deck. */
function assistantSlipReferenceMissing(actions:string[]):boolean {
  let missingWord=false,cardMode=false;
  for(const action of actions)for(const clause of action.split(/[.;；。\n]/)) {
    cardMode ||= /\bcards?\b|\bslips?\b|\bdeck\b|卡片|词卡|纸条/i.test(clause);
    for(const write of assistantWrites(clause)) {
      if(write.optional)continue;
      const fallback=cardMode && /\b(?:if|when)\b[^.!?]*?(?:empty|no cards)|若[^。]*(?:空|没有卡)|如果没有卡/i.test(clause.slice(0,write.index));
      if((/\bslips?\b|纸条|纸片/i.test(write.text) || cardMode && /\bnew\b|新/.test(write.text) || fallback) && /\bmeanings?\b|释义|词义|中文意思/i.test(write.text)) {
        const preparation=clause.slice(write.index).split(/\b(?:flip|turn|check)\b|翻面|核对/i)[0];
        missingWord=!assistantCardLayoutReady(preparation);
      } else if(missingWord && /\bwords?\b|英文|单词/i.test(write.text) && /\b(?:back|reverse)\b|背面|反面/i.test(write.text))missingWord=false;
    }
    if(missingWord && /\b(?:flip(?:ping)?|turn(?:ing)?[^.!?]*?\bover)\b[^.!?]*?\b(?:check|compare)\b|\b(?:continue|run|repeat|attempt)\b[^.!?]*?\bsame (?:way|check|routine)\b|翻(?:面|卡|纸条)[^。]*?(?:核对|检查)|同样方式|同样核对/i.test(clause))return true;
  }
  return false;
}

const basicTurnNotation=/\b[URFDLB](?:2|['’′])?(?![A-Za-z0-9])/g;
const explicitSlowTurnAction=new RegExp(String.raw`慢拧|慢转|轻转|转动|转(?:一|完)(?:步|层|后|都|再)|慢速.{0,8}转|(?:做|执行)(?:一次|一步|一下)?\s*${basicTurnNotation.source}|插入|\b(?:turn|turns|turning|insertion|insert)\b`,'i');
const normalizedTurn=(move:string)=>move.replace(/[’′]/g,"'").toUpperCase();

function isStickerLayerLabel(action:string,index:number,move:string):boolean {
  if(move.length!==1)return false;
  const before=action.slice(0,index).split(/[。；;，,.!?\n]/).at(-1)??'';
  const after=action.slice(index+1);
  return /(?:在|从|沿着|看到|位于|选(?:择|定|取)?|观察|盯住|跟踪|追踪)\s*$/.test(before)
    && /^\s*(?:面|(?:转动)?层)(?=$|[\s的上内中边旁，,。；;]|(?:选|挑|取|找|观察|看|跟踪|追踪))/.test(after);
}

function assistantBasicTurnSet(question:string):Set<string> {
  const declared=question.match(/(?:只会|只练|\b(?:only know|know only))\s*((?:[URFDLB](?:2|['’′])?(?![a-z0-9])\s*(?:[、,，和与]|\band\b)?\s*)+)/i)?.[1];
  return new Set([...(declared?.toUpperCase().matchAll(basicTurnNotation)??[])].map(m=>normalizedTurn(m[0])));
}

/** Keep the supplied turn when a draft offers its unlearned inverse as an
 * optional alternative. Never rewrite an action that depends on that inverse. */
export function retainAssistantKnownTurnOptions(input:unknown,question:string) {
  if(!noLearnedInsertion(question)||!/慢拧|慢转|慢慢转|缓慢转|slow[- ](?:turn|turning)/i.test(question))return;
  const allowed=assistantBasicTurnSet(question);
  if(!allowed.size)return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  let changed=false;
  for(const activity of parsed.data.activities)for(const step of activity.steps){
    step.action=step.action.replace(/\b([URFDLB])(?:\s+or\s+|\s*或(?:者)?\s*)(\1['’′])(?![A-Za-z0-9])/g,(pair,known:string,option:string)=>{
      if(!allowed.has(known)||allowed.has(normalizedTurn(option)))return pair;
      changed=true;
      return known;
    });
  }
  return changed?parsed.data:undefined;
}

/** Remove prohibitions including comma-separated objects, but not a subsequent
 * affirmative "then" action. Negated slot checks are not prerequisites. */
function positiveCubeActions(text:string):string {
  text=text.replace(/\b(?:with\s+)?no\s+(?:insertion|inverse setup|(?:solved[- ])?slot check)(?:\s*(?:,|or|and|\/)\s*(?:insertion|inverse setup|(?:solved[- ])?slot check))*/gi,'');
  // Share the action verbs across negative tenses. “没有使用” and “不使用”
  // impose the same restriction; neither establishes an insertion prerequisite.
  return text.replace(/(?:放弃|跳过)(?:本次|这次)?插入|(?:全程|始终|也)?不(?:再)?插入(?:或(?:再)?(?:核对|检查|查(?:看)?)(?:已解|目标)?槽(?:位|位置)?)?|\bno insertions?\b/gi,'').replace(/(?:(?:不|没有|未)(?:再)?(?:声称完成|接(?:续|着)?(?:做)?插入|试(?:着)?插入|复位|做|用|使用|采用|进行|执行|要求|检查|查(?:看)?(?:已解)?槽|核对|尝试|练习|学习|引入|加入|涉及)|无需|不要|\b(?:do not|don't)\b(?!\s+(?:match|align|line up|fit)\b)|\bwithout\b)[^。.;；\n]*?(?=[。.;；\n]|,\s*(?:then|next)\b|[,，](?:然后|接着|直接|随即|立即|再|改为|改做|改练)|\b(?:but|otherwise)\b|但是|但(?=要|用|做|执行|插入)|否则|$)/gi,'');
}

/** Complete an omitted success path from an explicit request when the draft
 * already contains a setup attempt and an executable, terminal fallback. */
export function completeAssistantSlowTurnSuccess(input:unknown,question:string,lang:'zh'|'en'):AssistantStructuredPlan|undefined {
  if(lang!=='zh' || !assistantRequestsSlowTurnAlternatives(question) || !assistantSingleInsertionRequested(question)
    || !/(?:我知道一种插入|我已(?:会|知)[^。！？]{0,12}插入|我会(?:一种|一个)[^。！？]{0,10}插入)/.test(question)
    || !/(?:亲眼|目视|肉眼)(?:核对|检查|确认)(?:棱|边)块[、，,和与]角块(?:[、，,和与]|以及)目标槽(?:位)?/.test(question)
    || /失败分支.{0,15}(?:前面|先写)|先写.{0,15}(?:失败|备用)/.test(question))return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success)return;
  const allowed=assistantFallbackTurnSet(question);
  const assigned=parsed.data.activities.length===2?assistantAssignedFallbackTurns(question):undefined;
  let changed=false;
  for(const [index,activity] of parsed.data.activities.entries()){
    if(activity.steps.length!==1)continue;
    const step=activity.steps[0];
    const branch=/^((?:先)?(?:用[^。；;，,]{1,32})?(?:尝试|试着)(?:重)?(?:摆出|摆回|摆成|复现)[^。；;，,]{0,16}(?:局面|情形|场景))[；;。]\s*((?:若|如果)(?:摆不出|无法摆出|摆位失败)[，,]?\s*或(?:者|是)?(?:目视)?(?:核对|检查)(?:不通过|失败|不一致)[，,][^。；;]+[。]?)$/.exec(step.action);
    if(!branch || !/(?:停止|即停|就停|结束)/.test(branch[2]) || !hasExecutableSlowTurnAlternative(branch[2],allowed,assigned?.[index]))continue;
    step.action=branch[1]+'。若摆成功，先亲眼核对棱块、角块和目标槽，只有三者都一致才做一次已会的插入并结束；'+branch[2];
    changed=true;
  }
  return changed?parsed.data:undefined;
}

/** Supply different checks only when both fallback branches contain the same
 * generic known-turn exercise. Leave specific alternatives and timing intact. */
export function distinguishAssistantKnownTurnAlternatives(input:unknown,question:string,lang:'zh'|'en'):AssistantStructuredPlan|undefined {
  if(lang!=='zh' || !assistantRequestsSlowTurnAlternatives(question)
    || !/不同|不一样|别重复|各不相同/.test(question) || noLearnedInsertion(question))return;
  const parsed=assistantStructuredPlanSchema.safeParse(input);
  if(!parsed.success || parsed.data.activities.length!==2)return;
  const generic=/^\s*(?:则|就)?(?:只|仅|继续|改为|改用|改做|改练|用|使用|以)*\s*(?:用)?(?:自己)?(?:已知|已会|已经会|学过|熟悉|会)的(?:慢速|缓慢)?转动(?:继续|慢速|缓慢)*练习?(?:到本项结束)?(?=\s*[,，。；;.!？!?]|\s*$)/;
  const fallback=new RegExp('(?:'+cannotSetUpCase.source+')[^，,。；;：:\\n]{0,18}[，,：:]|否则|不然','gi');
  const alternatives=parsed.data.activities.map(activity=>activity.steps.flatMap(step=>
    [...step.action.matchAll(fallback)].flatMap(marker=>{
      const start=marker.index!+marker[0].length;
      const remainder=step.action.slice(start);
      const branch=remainder.split(/[。；;.!?\n]/)[0];
      if(/观察|看(?:哪|看)|核对|比较|对照|预测|猜|记(?:下|录)|口述|停顿|节奏|重复|追踪|换(?:一|个|另)|计数/.test(positiveCubeActions(branch)))return [];
      const match=generic.exec(remainder);
      if(!match)return [];
      const end=start+match[0].length;
      return [{step,end}];
    })));
  if(alternatives.some(matches=>matches.length!==1))return;
  const checks=['每转一步就停一下，观察哪一块移动了','每次先预测哪一块会移动，再转一个已知动作并对照实际变化'];
  alternatives.forEach(([{step,end}],index)=>{
    step.action=step.action.slice(0,end)+'，'+checks[index]+step.action.slice(end);
  });
  return parsed.data;
}

/** An alternative selected earlier stays an alternative in every later action. */
function assistantSlowTurnBranchMissing(actions:string[],everyActivityHasFallback=false):boolean {
  let hasFallback=everyActivityHasFallback;
  for(const original of actions) {
    // A colon-led reference names the previously selected move; the following
    // condition still governs execution. Do not strip an actual reset/insert.
    const action=positiveCubeActions(original)
      .replace(/^\s*(?:沿用|继续使用)(?:上一项|前一项|第一项)(?:选定|选择|使用)的(?:同一|同一个|那个)?插入(?:动作|法)?[：:]\s*(?=只有|仅当|仅在|若|如果)/,'')
      .replace(/^\s*沿用(?:同一|刚才的)(?:熟悉|已会的)?插入法[，,]\s*(?=用(?:其|它的|该插入的)逆(?:操作|动作))/,'');
    if(hasFallback) {
      let verified=false, localCaseCheck=false;
      const events:Array<{at:number;kind:'verified'|'local-check'|'after-check'|'fallback'|'checked-fallback'|'insert'}>=[];
      const checkedFailures=[...action.matchAll(visualCaseMismatch)].map(m=>({start:m.index!,end:m.index!+m[0].length}));
      const insideCheckedFailure=(at:number)=>checkedFailures.some(span=>at>=span.start && at<span.end);
      const localCheckSpans=[...checkedFailures];
      for(const span of checkedFailures){
        events.push({at:span.start,kind:'local-check'},{at:span.end,kind:'checked-fallback'});
      }
      for(const m of action.matchAll(/(?:目视|(?:用)?眼睛|肉眼|亲眼)\s*(?:确认|验证|核对|核准|对照|检查|(?:依次|逐一|逐项|分别)?看(?:清)?(?=\s*[:：]?\s*[棱边角]))|(?:依次|逐一|逐项|分别)看(?:清)?(?=\s*[:：]?\s*[棱边角])|\bvisually (?:verify|check|confirm)\b|\blook at\b|\b(?:check|confirm)\b(?=[^.;,]{0,90}\bvisibly (?:match|align)\b)/gi)) {
        if(insideCheckedFailure(m.index!))continue;
        const before=action.slice(Math.max(0,m.index!-12),m.index);
        const start=m.index!+m[0].length;
        const remainder=action.slice(start);
        const enumeration=/^\s*[:：]?\s*(?:(?:棱|边)块(?:的)?(?:位置(?:与朝向|和朝向)?|朝向)?\s*(?:[、，,]|和|以及|及|与)\s*角块(?:的)?(?:位置(?:与朝向|和朝向)?|朝向)?\s*(?:[、，,]|和|以及|及|与)\s*(?:目标|目的)?槽(?:位置|位)?|(?:that )?(?:the )?edge\s*(?:,\s*| and )(?:the )?corner\s*,?\s*and\s+(?:the )?(?:target|goal|destination) slot\b)/i.exec(remainder);
        const separatorAt=enumeration?.[0].length??0;
        const object=remainder.slice(0,separatorAt)+remainder.slice(separatorAt).split(/[。；;，,：:.!?]|(?:然后|随即|接着|马上|直接|再)(?=插入|做|用|复位)|\b(?:then|and then)\b/i)[0];
        const scene=/^\s*(?:该|这个|熟悉|同一)*\s*(?:局面|情形|场景)|^\s*(?:(?:(?:the|that) )?(?:familiar )?case|that the case)\b/i.exec(object);
        const slot=/(?:目标)?槽(?:位置|位)?|\b(?:(?:target|goal|matching|destination) slot|the slot)\b/i.exec(object);
        const pieces=/(?:配对)?两块(?:拼块)?(?:(?:的|所在|各自的?)?(?:位置|朝向)|(?=与|和|及))|棱角(?:块)?(?:的)?(?:位置|朝向)|(?:(?:棱|边)块.{0,4}角块|角块.{0,4}(?:棱|边)块)|\bpair (?:shape|position|orientation)\b|\bpair(?= and (?:the )?(?:target )?slot\b)|\b(?:both|two) pieces\b/i.exec(object);
        if(!enumeration && (/^(?:依次|逐一|逐项|分别)看/.test(m[0]) || !scene && !(slot && pieces)))continue;
        const objectEnd=Math.max(separatorAt,...[scene,slot,pieces].flatMap(part=>part?[part.index+part[0].length]:[]));
        const after=object.slice(objectEnd);
        if(!/(?:不(?:再|必|曾)?|尚未|并未|没有)\s*$|\b(?:don't|do not)\s*$/i.test(before)
          && !/失败|有误|不(?:准确|正确|一致|相符|通过)|没有摆出|没摆出|未摆出|未对齐|\b(?:failed|unverified|not (?:set up|ready|verified|correct))\b/i.test(object)) {
          events.push({at:m.index!,kind:'local-check'});
          localCheckSpans.push({start:m.index!,end:start+objectEnd});
          const positiveEnding=/^\s*(?:(?:三者|三处|两者|各处)\s*(?:都|均)?)?(?:确实)?(?:无误|相符|一致|正确|准确|吻合|对齐|对上)(?:[，,]?\s*(?:吻合|相符|一致|正确|都无误))?(?:后|才)/.exec(after);
          if(positiveEnding)events.push({at:start+objectEnd+positiveEnding[0].length,kind:'after-check'});
          else if(/(?:确认|验证|核准|confirm|verify)$/i.test(m[0])
            && /^(?:[^。；;，,：:.!?]{0,24})(?:[，,]\s*)?(?:然后|随后|再)(?=慢拧|缓慢|插入|做|用)|^\s*(?:[,;]\s*)?(?:and )?then (?:perform|insert|use)\b/i.test(action.slice(start+objectEnd))) {
            events.push({at:start+objectEnd,kind:'after-check'});
          }
        }
      }
      for(const m of action.matchAll(/(?:^|[。；;，,：:.!?]|\band\b)\s*(?:(?:(?:若|如果|只有)?\s*(?:(?:三者|两者|三处|各处)\s*(?:都|均)?)?(?:吻合|对上|对齐)\s*(?:后|才|就|则)|(?:若|如果)\s*(?:(?:三者|两者|三处|各处)\s*(?:都|均)?)?(?:吻合|对上|对齐)\s*[，,](?=\s*(?:做|执行|使用|插入)))|(?:only )?if (?:they|both|all three|both pieces and (?:the )?(?:target|goal|destination) slot) (?:visibly )?(?:match|align|line up)\b)/gi))
        events.push({at:m.index!+m[0].length,kind:'after-check'});
      for(const m of action.matchAll(/(?:^|[。；;，,：:])\s*(?:三者|三处|各处)(?:都|均)(?:吻合|对上|对齐)\s*[，,]\s*(?=再(?:做|执行|使用|插入))/g))
        events.push({at:m.index!+m[0].length,kind:'after-check'});
      for(const m of action.matchAll(chineseCaseMatch))
        events.push({at:m.index!+m[0].length,kind:'after-check'});
      for(const m of action.matchAll(/\b(?:(?:then|directly) )?(?:insert|perform the insertion) only if (?:they|both|all three) (?:visibly )?(?:match|align|line up)\b/gi))
        events.push({at:m.index!,kind:'after-check'});
      for(const m of action.matchAll(/(?:^|[。；;，,：:])\s*(?:(?:确认[^。；;，,]{0,18}(?:都|均)?对上\s*(?:后|才))|(?:仅在|仅当|只有)?(?:确认后|验证后|核对后|确认与(?:该|同一|熟悉)*(?:情形|局面)一致后|(?:确认|核对)(?:无误|完全准确|准确|正确|相符)\s*(?:后|[，,]?\s*才))|(?:仅在|仅当|只有)\s*(?:完全)?(?:准确|正确|无误)\s*[，,]?\s*才|(?:若|如果|仅当|仅在|只有|only if|if)\s*(?:确认|核对|验证)(?:通过|一致|相符)\s*(?:[，,]?\s*(?:就|则|才))?|(?:确认|核对)(?:准确|一致|相符)\s*(?:就|则)|(?:准确|相符|一致)(?:后|才)(?=慢|缓慢|插入|做|用))|\b(?:once|after) (?:it is )?(?:verified|confirmed|verifying (?:the )?case)\b/gi)) {
        const end=m.index!+m[0].length;
        events.push({at:end,kind:'after-check'});
        localCheckSpans.push({start:m.index!,end});
      }
      for(const m of action.matchAll(/(?:若|如果|仅当|仅在|只有)[^。；;，,]{0,45}(?:已确认|已验证|确认了|验证了|确认过|验证过|成功完成|已目视(?:核对|确认|验证)(?:无误|一致|正确))|\b(?:only if|if)\b[^.;]{0,60}(?:verified|confirmed|successful)/gi)) {
        if(!/(?:尚未|未|没(?:有)?|不能|无法|不曾|并非)(?:被|曾经|已|目视)*(?:确认|核对|验证|成功)|\b(?:not|never|unverified)\b/i.test(m[0]))events.push({at:m.index!,kind:'verified'});
      }
      const priorCheck=/(?:仅当|仅在|只有)(?:上一项|前一项|第一项)已(?:目视)?(?:核对|确认)(?:相符|无误|一致|正确)?并完成插入(?:时|后)[：:]/.exec(action);
      if(priorCheck)localCheckSpans.push({start:priorCheck.index,end:priorCheck.index+priorCheck[0].length});
      const fallbackMarkers=new RegExp(cannotSetUpCase.source+'|否则|不然|\\b(?:otherwise|else)\\b|(?:若|如果|仅在)[^。；;，,]{0,40}(?:备用|不能|无法|未确认|没有确认|摆不出|摆不成|复现不了)|\\bif\\b[^.;,]{0,45}(?:fallback|cannot|unable|unverified)','gi');
      for(const m of action.matchAll(fallbackMarkers)){
        if(!insideCheckedFailure(m.index!))events.push({at:m.index!,kind:'fallback'});
      }
      const firstFallback=events.reduce((at,event)=>event.kind==='fallback'||event.kind==='checked-fallback'?Math.min(at,event.at):at,Infinity);
      for(const m of action.matchAll(/(?:用|做|执行|完成|重复|复位|检查|核对)[^。；;，,]{0,18}(?:插入|槽位|情形)|(?:随后|然后|接着|直接|立即|继续|再)插入|插入(?:一|两|二|[12])次|\b(?:perform|repeat|do|reset|check|use)\b[^.;,]{0,35}\b(?:insertion|inverse|case|slot)\b|\b(?:then|directly) insert\b/gi)) {
        if(localCheckSpans.some(span=>m.index!>=span.start && m.index!<span.end))continue;
        const remainder=action.slice(m.index);
        const clause=remainder.split(/[。；;，,]/)[0];
        const setup=/^用[^。；;，,]{0,28}?(?:摆成|摆回|摆出|复现|重建)(?:这个|那个|熟悉的?|已知的?|会的)*(?:待)?插入(?:局面|情形|场景)/.exec(clause)
          ?? /^(?:用[^。；;，,]{0,24}?)?(?:尝试|试着)把[^。；;，,]{0,26}?(?:摆(?:成|回|到|出)|复现|重建)[^。；;，,]{0,18}/.exec(clause)
          ?? /^(?:用[^。；;，,]{0,24}逆(?:操作|动作|向动作|过程|序)[^。；;，,]{0,22}?(?:(?:摆出|摆成|摆回|复现|建立|重建|准备|复位|重置)(?:(?!再用|随后|然后|接着|立即)[^。；;，,]){0,20}?(?:局面|情形|棱角配对(?:与|和)目标槽)|把[^。；;，,]{0,14}(?:局面|情形)(?:重新)?(?:复位|重置)(?:回来)?)|use\b[^.;,]{0,35}\binverse\b[^.;,]{0,26}\b(?:set up|recreate|prepare) (?:the |that |its )?(?:familiar )?case\b)/i.exec(clause)
          ?? /^用[^。；;，,]{0,24}逆(?:操作|动作)[，,]\s*把[^。；;，,]{0,14}(?:摆出|摆成|摆回)[^。；;，,]{0,22}(?:局面|情形|场景)/.exec(remainder);
        // Setting up the case (even without “try”) does not execute the
        // insertion. Only credit setup that leads to a new visible check in
        // the main path. The later insertion still needs its own condition.
        if(setup && events.some(e=>e.kind==='local-check' && e.at>=m.index!+setup[0].length && e.at<firstFallback)
          && !/(?:再|随后|然后|接着|直接|立即|继续)(?:用|做|执行|复位|插入)|\b(?:and|then)\s+(?:insert|reset)\b/i.test(clause.slice(setup[0].length)))continue;
        events.push({at:m.index!,kind:'insert'});
      }
      events.sort((a,b)=>a.at-b.at);
      for(const event of events) {
        if(event.kind==='verified')verified=true;
        else if(event.kind==='local-check')localCaseCheck=true;
        else if(event.kind==='after-check')verified=localCaseCheck;
        else if(event.kind==='fallback')verified=localCaseCheck=false;
        else if(event.kind==='checked-fallback'){verified=false;localCaseCheck=true;}
        else if(!verified) {
          const prefix=action.slice(Math.max(0,event.at-12),event.at).split(/[。；;，,.!?]/).at(-1)!;
          if(!/不(?:要求|再|做|假设|声称)|[不勿别]$|无需|do not |without |no /i.test(prefix))return true;
        }
      }
    }
    hasFallback ||= cannotSetUpCase.test(action) || /备用|否则|不然|不能|无法|\b(?:fallback|otherwise|cannot|unable)\b/i.test(action);
  }
  return false;
}

/** Look for an executable turn in the fallback itself, not the main branch. */
function assistantFallbackTurnSet(question:string):Set<string> {
  const direct=assistantBasicTurnSet(question);
  const labelled=/\b(?:only )?(?:allowed |known |basic )?(?:moves|turns)\b[^.!?\n]{0,48}\b(?:are|use|only)\b\s*([^.!?;\n]+)|(?:只用|仅用|只允许|已会|也会|会的只有|只练过|各换(?:一种)?(?:不同的)?)\s*([^，,。；;\n]+)/gi;
  for(const match of spokenPrimes(question).matchAll(labelled))for(const move of (match[1]??match[2]).matchAll(basicTurnNotation))direct.add(normalizedTurn(move[0]));
  const fallback=cannotSetUpCase.exec(question);
  if(fallback) {
    const clause=spokenPrimes(question.slice(fallback.index+fallback[0].length).split(/[。；;.!?\n]/,1)[0]);
    if(/\b(?:use|do|execute|perform|substitute)\b[^.!?]{0,80}\b(?:first|second|fallback|(?:drill|activity|exercise) (?:one|two|1|2))\b/i.test(clause)) {
      for(const move of clause.matchAll(basicTurnNotation))direct.add(normalizedTurn(move[0]));
    }
  }
  return direct;
}

const spokenPrimes=(text:string)=>text.replace(/\b([URFDLB])\s+prime\b/g,"$1'");

/** Read only explicit first/second fallback mappings, leaving generic move
 * lists and ambiguous references with the existing allowed-set check. */
function assistantAssignedFallbackTurns(question:string):[string,string]|undefined {
  const start=cannotSetUpCase.exec(question);
  if(!start)return;
  const tail=spokenPrimes(question.slice(start.index+start[0].length));
  const pairs:Array<[number,string]>=[];
  const english=tail.split(/[.!?\n]/,1)[0];
  if(/\b(?:use|do|execute|perform|substitute)\b/i.test(english)){
    for(const m of english.matchAll(/\b([URFDLB](?:2|['’′])?)\s+(?:in|for)\s+(?:the\s+)?(?:first|second|(?:drill|activity|exercise) (?:one|two|1|2))\b/gi))
      pairs.push([/\b(?:first|one|1)$/i.test(m[0])?0:1,normalizedTurn(m[1])]);
  }
  for(const m of tail.matchAll(/第([一二12])(?:项|个|轮)(?:备用(?:动作|练习)?)?\s*(?:改做|改用|换做|只做|就用)\s*(?:(?:(?:自己|我|你)?(?:已会|会|已知|学过))的\s*)?([URFDLB](?:2|['’′])?)(?![A-Za-z0-9])/g))
    pairs.push([/[一1]/.test(m[1])?0:1,normalizedTurn(m[2])]);
  const first=pairs.filter(([index])=>index===0), second=pairs.filter(([index])=>index===1);
  if(first.length===1 && second.length===1)return [first[0][1],second[0][1]];
}

function hasExecutableSlowTurnAlternative(action:string,allowed:ReadonlySet<string>,required?:string):boolean {
  const fallback=new RegExp(visualCaseMismatch.source+'|'+cannotSetUpCase.source+'|否则|不然|\\b(?:otherwise|else|fallback)\\b','gi');
  const turn=/慢拧|慢转|缓慢转|慢速转|慢慢转|转动|(?:再|然后|接着)转(?!述|达)|转(?:一下|一次|一层|一面|一个|一步)|(?:做|执行)(?:一个|一次|一步)(?:已知|已会|学过|会的)(?:转动|动作)|\bturn(?:s|ing)?\b/i;
  const known=/已知|已会|会的|熟悉|学过|掌握|基本|基础|\b(?:known|familiar|basic|already know|already learned)\b/i;
  return [...action.matchAll(fallback)].some(match=>{
    const branch=action.slice(match.index!+match[0].length);
    const nextSuccess=[...branch.matchAll(chineseCaseMatch)].find(m=>/(?:若|如果|只有|仅当)/.test(m[0]));
    const after=spokenPrimes(positiveCubeActions(branch.slice(0,nextSuccess?.index).split(/(?:[。.!?\n]|(?:若|如果|仅当|只有)(?:已|能|可以)|\bonly if\b|\bif (?:you can|verified)\b)/i)[0]));
    const moves=[...after.matchAll(basicTurnNotation)];
    const namedTurn=moves.some(move=>/(?:改做|改用|执行|做|用)(?:一次|一步|一下)?\s*(?:慢速|缓慢)?\s*(?:(?:自己|我|你)?(?:已会|已知|学过|会)的)?\s*$|\b(?:do(?:ing)?|perform(?:ing)?|exec(?:ute|uting)|us(?:e|ing)|mak(?:e|ing)|substitut(?:e|ing))(?:\s+(?:one|a))?(?:\s+slow)?(?:\s+(?:known|familiar))?\s*$/i.test(after.slice(Math.max(0,move.index!-32),move.index)));
    const usesKnownMove=required ? moves.length>0 && moves.every(move=>normalizedTurn(move[0])===required)
      : moves.length && allowed.size ? moves.every(move=>allowed.has(normalizedTurn(move[0]))) : known.test(after);
    return (turn.test(after) || namedTurn) && usesKnownMove
      && !/插入|逆序|逆向|槽位|\b(?:insert(?:ion)?|inverse|slot)\b/i.test(after);
  });
}

/** Narrow checks for observed regressions; not general natural-language entailment. */
export function assistantPlanSemanticViolation(question:string,answer:string,sourceText='',structuredPlan?:unknown):string|undefined {
  const parsedPlan=assistantStructuredPlanSchema.safeParse(structuredPlan);
  const removeActivityHeading=(line:string)=>line.replace(/^\d+[.)、][ \t]+[^:：\n.!?。！？]+[:：][ \t]*/,'');
  const actions=parsedPlan.success?parsedPlan.data.activities.flatMap(a=>a.steps.map(s=>s.action)):answer.split('\n').map(removeActivityHeading);
  const actionText=actions.join('\n');
  if(!assistantObservationOnlyPlan(question,sourceText) && assistantSlowTurnRequest(question+' '+sourceText)) {
    const sections=answer.split(/\n(?=\d+[.)、])/);
    if(sections.length>1 && /^\s*(?:two|three|\d+) (?:independent |separate )?slow[- ]turn(?:ing)? (?:drills|activities|exercises)\s*[,—:]\s*\d+ seconds each \(\d+ seconds total\)[.!]?\s*$/i.test(sections[0]))sections.shift();
    const actions=parsedPlan.success?parsedPlan.data.activities.map(a=>a.steps.map(s=>s.action).join(' ')):sections.map(section=>
      removeActivityHeading(section).replace(/(?:理由|原因)\s*[:：][^。！？\n]*|\b(?:reason|rationale)\s*:[^.!?\n]*/gi,''));
    if(assistantSingleInsertionRequested(question) && actions.some(action=>
      /(?:重复|重新)(?:执行|做)?(?:已知|已会的|熟悉的)?插入|插入(?:两|二|多|[2-9])次|(?:做|执行)(?:两|二|多|[2-9])次(?:已知的?|已会的?|熟悉的?)?插入|插入(?:一次)?(?:(?:后|完)[^。；;\n]{0,25}|[，,；;。]\s*(?:然后|接着)?)再(?:执行|做)?(?:一次)?插入|\b(?:repeat (?:the |this )?(?:familiar |known )?insertion|(?:insert|insertion) (?:twice|again|(?:two|three|[2-9]) times))\b/i
        .test(positiveCubeActions(action))))return 'plan_insertion_repeat';
    if(noLearnedInsertion(sourceText+'\n'+question) && actions.some(a=>/插入|逆序|逆向设置|已解槽|\binsert(?:ion|ing)?\b|\binverse\b|\bsolved[- ]slot\b/i.test(positiveCubeActions(a))))return 'plan_unlearned_insertion';
    if(noLearnedInsertion(sourceText+'\n'+question)){
      const allowed=assistantBasicTurnSet(question+'\n'+sourceText);
      if(allowed.size && actions.some(action=>{
        const positive=positiveCubeActions(action);
        return [...positive.matchAll(basicTurnNotation)].some(match=>{
          if(allowed.has(normalizedTurn(match[0])))return false;
          // A face can be mentioned when selecting or tracking a sticker.
          // "在 B 面上选" does not authorize a clockwise B turn.
          return !isStickerLayerLabel(positive,match.index!,match[0]);
        });
      }))return 'plan_unsupplied_move_sequence';
    }
    const needsAlternatives=assistantRequestsSlowTurnAlternatives(question) && !noLearnedInsertion(sourceText+'\n'+question);
    const explicitSetup=needsAlternatives && /(?:每项|每个(?:活动|练习)|逐项)先(?:尝试|试着|试试)摆位/.test(question);
    if(assistantSlowTurnBranchMissing(actions,explicitSetup))return 'plan_fallback_branch_missing';
    if(needsAlternatives) {
      const allowed=assistantFallbackTurnSet(sourceText+'\n'+question);
      const assigned=actions.length===2?assistantAssignedFallbackTurns(question):undefined;
      if(actions.some((action,index)=>!hasExecutableSlowTurnAlternative(action,allowed,assigned?.[index])))return 'plan_slow_turn_alternative_missing';
      if(explicitSetup && actions.some(action=>{
        const prefix=action.split(/目视|(?:用)?眼睛|肉眼|亲眼|若|如果|否则/,1)[0];
        return !/(?:^|[。；;：:，,])\s*(?:先|再|重新)?\s*(?:(?:用|沿用)[^。；;，,]{0,26}?)?(?:尝试|试着|试图)?(?:把[^。；;，,]{0,26}?)?(?:摆位|(?:摆成|摆回|摆出|复现|重建|准备)[^。；;，,]{0,16}(?:局面|情形|场景|棱角配对(?:与|和)目标槽)|摆到目标槽旁)/.test(prefix);
      }))return 'plan_case_setup_missing';
    }
    // A drill with no supplied case must not invent an applicable algorithm.
    // Explicit user requests for particular notation are outside this narrow guard.
    const moves=/(?:\b[URFDLBMESxyz](?:w|2|['’′])?\s+){2,}[URFDLBMESxyz](?:w|2|['’′])?/g;
    for(const match of answer.matchAll(moves))if(!(question+' '+sourceText).includes(match[0]))return 'plan_unsupplied_move_sequence';
    if(/(?:两|二|2)项.{0,8}慢拧|(?:two|2) slow[- ]turn(?:ing)? activities/i.test(question) && actions.some(action=>!explicitSlowTurnAction.test(positiveCubeActions(action))))return 'plan_slow_turn_activity_missing';
  }
  if(assistantObservationOnlyPlan(question,sourceText) && !/已复原|已还原|已完成|打乱|\b(?:solved|scrambled)\b/i.test(question+' '+sourceText)) {
    for(const line of answer.split('\n'))if(/在(?:已|完全)(?:复原|还原)的魔方上|\bon (?:a |the )?(?:fully )?solved cube\b/i.test(line) && !/若|如果|假如|\bif\b|不要|不假设|do not assume/i.test(line))return 'plan_start_state_assumption';
  }
  if(vocabularyPlan(question)) {
    if(oralWordSheet(question) && /\b(?:handwrite|write(?: down)?|jot down)\s+(?:(?:the|each|your|its)\s+)?[^.!?;,\n]{0,32}\b(?:word|answer|response|meaning|translation)s?\b/i.test(actionText.replace(/\b(?:do not|don't|never)\s+(?:handwrite|write|jot down)\b/gi,'')))return 'plan_oral_response_required';
    if(cleanCardRepeatMissing(question,actions))return 'plan_clean_deck_repeat_missing';
    // Preparation belongs inside a requested practice activity. Respect an
    // explicit request to allocate a separate preparation activity, however.
    const separatePreparation=separatePreparationRequested(question+' '+sourceText);
    if(parsedPlan.success && !separatePreparation && parsedPlan.data.activities.some(a=>
      (/^(?:prepare|preparation|set up|setup|make cards|make and check cards)\b|^(?:准备|制作)(?:词表|单词表|词卡|卡片)/i.test(a.title)
        || a.steps.some(s=>/\b(?:write|copy|make|prepare)\b[^.!?;\n]{0,100}\b(?:front|back|blank card)\b/i.test(s.action)))
      && !a.steps.some(s=>/\b(?:attempt|recall|quiz|test|practi[sc]e|review|retrieve|compose)\b|回忆|默写|尝试|练习|造句/i.test(s.action)
        || /\b(?:write|spell)\b[^.!?;\n]{0,70}\b(?:word|spelling)\b[^.!?;\n]{0,50}\b(?:flip|turn)\b[^.!?;\n]{0,32}\b(?:check|compare)\b/i.test(s.action)
        || /\bsay\b[^.!?\n]*\b(?:words?|meanings?)\b|(?:说出|写出)[^。；;\n]*(?:单词|词义|释义|意思)[^。；;\n]*(?:翻|[；;]\s*(?:再|然后|接着)?翻(?:一次|一面|面|到背面|卡片?|卡)?\s*(?:来)?核对)/i.test(s.action)
        || /(?:看|读)(?:英文|中文)(?:面)?[^。；;\n]{0,20}说出(?:中文|英文)[^。；;\n]{0,20}翻(?:到背面|面|卡)?\s*(?:核对|检查)/.test(s.action)
        || /\b(?:cover(?:ing)?|hid(?:e|ing))\b[^.!?;\n]*\b(?:say(?:ing)?|writ(?:e|ing))\b[^.!?;\n]*\b(?:uncover(?:ing)?|check(?:ing)?)\b/i.test(s.action)
        || /\b(?:say(?:ing)?|writ(?:e|ing))\b[^.!?;\n]*\b(?:word|meaning)\b[^.!?;\n]*\b(?:stays?|remains?|is) (?:covered|hidden)\b[^.!?;\n]*\b(?:uncover(?:ing)?|check(?:ing)?)\b/i.test(s.action))
    ))return 'plan_preparation_only_activity';
    const cardError=assistantCardFlipViolation(actionText);if(cardError)return cardError;
    // A recently prepared card can name its faces by writing or printing.
    // A reverse-direction spelling check must go to the declared word face.
    if(assistantCardPracticeRequest(question)
      && assistantEnglishWordFront(actionText)
      && /翻到(?:卡片)?背面(?:去|再)?(?:核对|检查)[^。；;\n]{0,28}(?:英文|拼法|拼写)|(?:看中文|中文面朝上)[^。；;\n]{0,52}写[^。；;\n]{0,20}(?:英文|拼写)[^。；;\n]{0,14}翻到背面(?:核对|检查)/.test(actionText))return 'plan_card_flip_direction';
    if(/逐卡翻查后[^。；;\n]{0,12}(?:刚检查的卡|同一张卡|该卡)翻回(?:中文|释义|题)面/.test(question)) {
      // The requested reset is part of each check. A batch reset later still
      // leaves cards on their answer faces while the learner works through them.
      const fromMeaning=/(?:逐张|每张|逐卡)[^。；;\n]{0,14}看(?:中文|释义)[^。；;\n]{0,45}翻[^。；;\n]{0,14}(?:核对|检查)/;
      const immediate=/(?:随即|立即|马上|再|就)?(?:把|将)?(?:刚检查的|刚核对的|同一张|这张|该)卡[^。；;\n]{0,10}翻回(?:中文|释义|题)面|(?:每张|每卡|逐卡)[^。；;\n]{0,32}(?:核对|检查)后(?:立即|马上|随即)翻回(?:中文|释义|题)面|(?:核对|检查)后(?:立即|马上|随即)?把卡翻回(?:中文|释义|题)面(?:朝上)?[，,]\s*(?:再|才)(?:处理|练习|拿|做)下一张/;
      const batchReset=/(?:两张|所有卡|整套卡|全部卡)[^。；;，,\n]{0,12}(?:都|全)(?:核对|检查|翻查)(?:完)?后[^。；;，,\n]{0,24}翻回(?:中文|释义|题)面/;
      if(actions.some(action=>fromMeaning.test(action) && (!immediate.test(action) || batchReset.test(action))))return 'plan_card_reset_missing';
    }
    if(assistantWrittenAnswerMissing(question,actionText))return 'plan_missing_written_answer';
    if(assistantAnswerRevealedFirst(actions))return 'plan_answer_revealed_before_attempt';
    if(actions.some(action=>assistantMissingColumnCycles(action).length))return 'plan_column_reset_missing';
    if(assistantTableColumnContradiction(actions))return 'plan_column_visibility_conflict';
    if(assistantSlipReferenceMissing(actions))return 'plan_card_reference_missing';
    // A word and its meaning written somewhere on a card do not establish
    // separate sides. Check the material needed by an actual flip action.
    const flip=[...actionText.matchAll(/\bflip(?:ping)?\b(?!\s+through\s+(?:the |a )?(?:list|pages|book)\b)|(?:看|读)卡片.{0,4}(?:英文|正)面|翻(?:到)?(?:背面|释义面|词面|面)|翻卡(?=\s*(?:后|再|来)?(?:核对|检查))|\bturn(?:ing)?\b[^.!?\n]{0,24}\bover\b/gi)]
      .find(match=>!/do not\s*$|don't\s*$|不要$|不必$|无需$/i.test(actionText.slice(Math.max(0,match.index!-12),match.index))
        && !/^\s*(?:(?:to|and|then)\s+)?(?:write|copy|label|draw|mark)\b|^\s*(?:后|再|然后)?(?:在(?:背面|反面|另一面))?\s*(?:各自|各|分别)?(?:写|抄|标|画)/i.test(actionText.slice(match.index!+match[0].length)))?.index??-1;
    if(flip>=0 && (assistantCardPracticeRequest(question) || /\bcards?\b|\bslips?\b|\b(?:word|meaning)[- ]side\b|卡片|词卡|翻卡|(?:正面|背面|释义面)/i.test(actionText))) {
      const prepared=actionText.slice(0,flip);
      if(!assistantHasExistingCards(question+'\n'+sourceText)&&!assistantCardLayoutReady(prepared,question))return 'plan_card_layout_missing';
    }
    const tableError=assistantTableVisibilityViolation(actions);if(tableError)return tableError;
    // A spoken response cannot be read or edited later. Keep this check narrow:
    // reading the supplied word list is valid and does not require writing it.
    if(!/(?:written|example|supplied) sentences|已有.{0,8}句子|写好的句子/i.test(question)) {
      let written=false;
      for(const line of answer.split(/\n|(?<=[.!?。；;])\s+/)) {
        const write=line.search(/\b(?:write|jot|record in writing|put on paper)\b|写下|写出|记录.{0,8}句子/i);
        const read=line.search(/\b(?:read|reread|re-read|edit|revise)\b[^.!?\n]{0,30}\b(?:sentences?|them back|it back)\b|读回|重读.{0,10}句子|修改.{0,10}句子/i);
        if(read>=0 && !written && (write<0 || write>read))return 'plan_missing_written_material';
        if(write>=0)written=true;
      }
    }
    const errorSubset=/\b(?:review|repeat|practi[sc]e|use|pick|choose|select|read|reshuffle|pass over)\b[^.!?;\n]*?\b(?:(?:missed|wrong|marked|circled|incorrect) (?:words|cards|items|ones)|(?:the |your )?(?:errors|mistakes|misses))\b|(?:重做|重过|复习|练习|挑选|再过)[^。；;\n]*?(?:错词|错卡|错的|错误项|标记的词|做记号的词)/i.test(actionText);
    const emptyBranches=assistantEmptySubsetBranches(answer);
    if(emptyBranches.invalid)return 'plan_subset_availability';
    const subsetAlternative=emptyBranches.available;
    const numbers:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
    const count='(\\d+|一|二|两|三|四|五|六|七|八|九|十|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
    const number=(value:string)=>Number(value)||numbers[value.toLowerCase()]||0;
    const known=question.match(new RegExp(`(?:有\\s*${count}\\s*个?\\s*(?:错词|错题)|have\\s+${count}\\s+(?:missed|wrong|incorrect|weak|shaky)\\s+(?:words|cards|items))`,'i'));
    const available=known?number(known[1]??known[2]):undefined;
    // Bind exclusivity to the practice selection, not an unrelated material
    // prerequisite such as "use only words whose meanings you already know".
    const exclusiveSubset=/\b(?:review|repeat|practi[sc]e|use|pick|choose|select|read|reshuffle)\s+(?:only|just)\s+(?:the |your |those )?(?:missed|wrong|marked|circled|incorrect|errors|mistakes)|\b(?:only|just)\s+(?:review|repeat|practi[sc]e|read)\b|只(?:练|看|复习|重做|针对)|\b(?:missed|wrong|marked|circled|incorrect) ones\b/i.test(actionText);
    if(errorSubset && !subsetAlternative && (available===undefined || available===0) && (exclusiveSubset || assistantPlanShape(question)?.englishWords))return 'plan_subset_availability';
    const fallback=subsetAlternative || /不足|不够|少于|若无|如无|没有(?:错词|错题)|fewer|not enough|subset is empty|too small|if none|if (?:there are|you have) no|top up|otherwise/i.test(answer);
    if(!fallback)for(const line of answer.split('\n')) {
      if(!/错词|错题|标红|红圈|圈出|星号|标记.{0,4}词|薄弱|不熟|missed|wrong|incorrect|weak|shaky|marked|circled|ticked|needs work|not yet/i.test(line))continue;
      // An error-only follow-up can be empty even without a fixed item count.
      if(available===undefined && /(?:只(?:看|针对|练|复习)|\b(?:quiz|review|read|re-show) only\b|\bonly the (?:words|cards|items|ticked|missed|weak)\b)/i.test(line))return 'plan_subset_availability';
      for(const match of line.matchAll(new RegExp(`(?:选|挑|取|用|抽|\\bpick|\\bchoose|\\bselect|\\buse|\\btake)[^。；;.!?\\n]{0,24}?${count}(?![a-z0-9])`,'gi'))) {
        if(/^\s*(?:分钟|分\b|秒|minutes?\b|mins?\b|seconds?\b|secs?\b)/i.test(line.slice(match.index!+match[0].length)))continue;
        // "Use a two-column list" specifies a layout, not two weak words.
        if(/^(?:[-–][a-z]|\s+(?:columns?|sides?)\b)/i.test(line.slice(match.index!+match[0].length)))continue;
        if(available===undefined || number(match[1])>available)return 'plan_subset_availability';
      }
    }
  }
  if(/F2L[- ]solved|已完成\s*F2L|F2L\s*已完成/i.test(question)) {
    // A classification can state the observed defect and reject it in the next
    // sentence of the same step. Do not reject that explanation mid-sentence.
    for(const sentence of answer.split(/\n\s*\n/)) {
      const exactExamples=sentence.replace(/\bat least\s+(?:one|1)\s+/gi,'some ').replace(/至少(?:一个|1个)/g,'多个');
      if(/(?:\b(?:one|single|1)\s+(?:(?:twisted|flipped)(?:\s+(?:corner|edge))?|(?:corner|edge)\s+(?:is\s+)?(?:twisted|flipped))\b)|(?:一个|单个|1个).{0,3}(?:角块扭转|棱块翻转)/i.test(exactExamples)
        && !/impossible|illegal|invalid|cannot|inconsistent|misread|不合法|不可能|无效|不能|错误|误读|不可/i.test(sentence))return 'plan_illegal_orientation_example';
    }
  }
}

export function assistantPlanShapeViolation(answer:string, shape:NonNullable<ReturnType<typeof assistantPlanShape>>):string|undefined {
  if(shape.englishWords) {
    const words=answer.trim().split(/\s+/).filter(Boolean).length;
    if(words<shape.englishWords.minimum || words>shape.englishWords.maximum)return 'plan_word_count';
  }
  // Counts/timing in a paragraph are checked against the structured plan before
  // rendering. The caller must reject unstructured prose for this contract.
  if(shape.paragraph)return /[\r\n]/.test(answer)?'plan_paragraph_layout':undefined;
  const lines=[...answer.matchAll(/^([ \t]*)(?:\d+[.)、]|[-*])[ \t]+[^\n]+/gm)];
  if(!lines.length)return 'plan_structure_missing';
  const indent=(line:RegExpMatchArray)=>line[1].replace(/\t/g,'    ').length;
  const level=Math.min(...lines.map(indent));
  const top=lines.flatMap((line,index)=>indent(line)===level?[index]:[]);
  if(shape.activities && top.length!==shape.activities)return 'plan_activity_count';
  if(shape.substepsPerActivity)for(let i=0;i<top.length;i++) {
    const children=lines.slice(top[i]+1,top[i+1]??lines.length);
    const childLevel=Math.min(...children.map(indent));
    if(children.filter(line=>indent(line)===childLevel).length!==shape.substepsPerActivity)return 'plan_substep_count';
  }
}
