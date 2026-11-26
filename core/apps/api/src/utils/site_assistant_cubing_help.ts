import { applyScramble, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { parseHTML } from 'linkedom';
import { assistantDeadline } from './site_assistant_diagnostics.js';
import { publicReadCache } from './site_assistant_public_queries.js';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { GAN_TEAM_FILTER } from '@cuberoot/shared/wca-team-filters';
import type { AssistantAnswer, AssistantMessage } from '@cuberoot/shared/site-assistant';
import { asksToLocatePair, assistantObservationOnlyPlan, assistantPlanPieceFacts, assistantPlanShape, assistantPlanTimeBounds } from './site_assistant_plan.js';

type Lang = 'zh'|'en';

// The LBL page accepts chapter and lesson IDs, which stay stable when the visible chapter order changes.
const beginnerLessons = {
  start: {
    step: 'structure', section: 'overview', title: { zh: '三阶层先法 · 引言', en: '3×3 beginner method · Introduction' },
    hint: { zh: '先找一块带白色、只有两种颜色的块。这是棱块，只有一格颜色的是中心块。',
      en: 'First find a piece with white and one other color. That is an edge. A one-color piece is a center.' },
  },
  daisy: {
    step: 'daisy', section: 'overview', title: { zh: '三阶层先法 · 做小花', en: '3×3 beginner method · Make the daisy' },
    hint: { zh: '把黄心朝上，先找一块白棱，让它的白色格到黄心旁边。黄心四周有四格白色，小花就完成了。',
      en: 'Hold the yellow center on top. Bring one white edge sticker next to it. The daisy is complete when all four edge stickers around the yellow center are white.' },
  },
  cross: {
    step: 'cross', section: 'white-edge', title: { zh: '三阶层先法 · 白棱归位', en: '3×3 beginner method · Solve one white edge' },
    hint: { zh: '先把一片白色花瓣的侧面颜色对准同色中心，再把对齐的那一面转 180°。完成后，这条白棱在底面，侧面颜色也与中心对齐。',
      en: 'Match one petal’s side color to its center, then turn that face 180°. The white sticker should now be on the bottom, with its side color still matching the center.' },
  },
  corners: {
    step: 'corners', section: 'overview', title: { zh: '三阶层先法 · 底层角块', en: '3×3 beginner method · Bottom corners' },
    hint: { zh: '把白面朝下，检查四个侧面最靠白面的一排。每排都和本面中心同色了吗？对不齐的白角，要按它另外两种颜色找位置。',
      en: 'Hold the white face down. Does the bottom row on each side match its center? Use the other two colors on any misplaced white corner to find its slot.' },
  },
  notation: {
    step: 'structure', section: 'notation', title: { zh: '三阶层先法 · 转动记号', en: '3×3 beginner method · Move notation' },
    hint: { zh: '先正对要转的那一面看。单个字母表示顺时针转 90°，带撇号就逆时针转 90°，带 2 就转半圈。',
      en: 'Look straight at the face you are turning. A letter means 90° clockwise, a prime means 90° counterclockwise, and 2 means a half turn.' },
  },
} as const;

const beginnerFaces: Partial<Record<string, { zh: string; en: string }>> = {
  U: { zh: '顶面', en: 'top' }, R: { zh: '右面', en: 'right' }, F: { zh: '前面', en: 'front' },
  D: { zh: '底面', en: 'bottom' }, L: { zh: '左面', en: 'left' }, B: { zh: '后面', en: 'back' },
};

export function asksForBeginnerSolve(question: string) {
  const text = question.normalize('NFKC').trim().replace(/[。.!！？?]+$/, '');
  return /^(?:我(?:想知道|想学|该|应该)?[，,\s]*|请问[，,\s]*)?(?:(?:怎么|如何|怎样)(?:才能)?(?:复原|还原|拼好|拼回去)(?:(?:一|这|那)[颗个只块])?\s*(?:三阶|3\s*[x×]\s*3)(?:魔方)?|(?:三阶|3\s*[x×]\s*3)魔方(?:该|要)?(?:怎么|如何|怎样)(?:才能)?(?:复原|还原|拼好|拼回去))$/i.test(text)
    || /^(?:please\s+)?how (?:do|should|can) I (?:solve|restore) (?:a |my |this |the )?3\s*[x×]\s*3(?: cube)?$/i.test(text)
    || (/(?:三阶|3\s*[x×]\s*3)/i.test(text)
      && /层先法|\blayer[- ]by[- ]layer\b/i.test(text)
      && /从哪.{0,2}开始|分哪几步|分几步|完整.{0,8}(?:流程|步骤)|\b(?:where (?:do|should) I (?:start|begin)|what are the (?:main )?steps|overview)\b/i.test(text));
}

/** Match short beginner questions. Unknown states and compound tasks still go to the planner. */
export function beginnerLessonAnswer(question: string, lang: Lang, linkOnly: boolean): AssistantAnswer | undefined {
  const text = question.normalize('NFKC').trim().replace(/[。.!！?？]+$/, '');
  if (!text || text.length > 130 || /[;；\n]|同时|顺便|另外|分别|以及|对比|比较|写成|不少于|不超过|计时|比赛|复盘|四阶|五阶|二阶|盲拧|(?:不要|不用|不需要)(?:给|讲|附)?(?:教程|链接|步骤)|\b(?:[24]\s*[x×]\s*[24]|CFOP|F2L|OLL|PLL|Roux|compare|also|separately|timer|competition|replay|words|no links)\b/i.test(text)) return;

  let lesson: keyof typeof beginnerLessons | undefined;
  let hint: string | undefined;
  const move = text.match(/^(?:(?:魔方(?:的)?|三阶(?:魔方)?(?:的)?|请问)\s*)?`?([URFDLB])([2'′’]?)`?\s*(?:要)?(?:怎么拧|怎么转|如何转|怎么做|是什么意思|是什么)$/)
    ?? text.match(/^(?:how (?:do I |to )?(?:turn|do|perform)|what does)\s+`?([URFDLB])([2'′’]?)`?(?:\s+mean)?(?:\s+on (?:a |my )?(?:3x3 )?cube)?$/i);
  const face = move && beginnerFaces[move[1]];
  if (asksForBeginnerSolve(text)) {
    lesson = 'start';
    hint = { zh: '三阶可以按层先法来。先做小花和白十字，再拼好白角与中层，最后处理黄面和顶层位置。第一层完成时，四个侧面的底排也要和各自的中心同色。现在把黄色中心朝上，找一块只有两种颜色的白棱，先让白色格贴到黄心旁边。黄心周围凑齐四格白色，小花就做好了。',
      en: 'Solve it layer by layer. Make the daisy and white cross, solve the white corners and middle layer, then finish the yellow face and position its pieces. The first layer is complete when the bottom row of each side also matches its center. Start with the yellow center up. Bring the white sticker on a two-color edge next to it. Four white edge stickers around the yellow center complete the daisy.' }[lang];
  } else if (move && face) {
    lesson = 'notation';
    const suffix = move[2];
    const turn = suffix === '2' ? { zh: '转半圈（180°）', en: '180°' } : suffix
      ? { zh: '逆时针转 90°', en: '90° counterclockwise' } : { zh: '顺时针转 90°', en: '90° clockwise' };
    hint = { zh: `保持魔方朝向，正对${face.zh}看，只把这一层${turn.zh}。另外两层保持原位。`,
      en: `Keep the cube oriented the same way. Looking straight at the ${face.en} face, turn just that layer ${turn.en}. The other two layers stay in place.` }[lang];
  } else if (/^(?:(?:我|魔方|三阶魔方|I)\s*)?(?:刚才|刚刚|不小心|手滑|just |accidentally )?(?:拧错|转错|拧反|转反|made the wrong move|turned the wrong way)(?:了|一步|了一步)?[，, ]*(?:怎么办|怎么(?:退回|撤销|恢复)|what (?:now|should I do)|how (?:do I undo it|to undo it))$/i.test(text)) {
    lesson = 'notation';
    hint = { zh: '先停一下，保持魔方朝向。确定最后转了哪一层、向哪边时，把那一层向反方向转同样的角度。记不清的话，你最后看到哪一层动了？',
      en: 'Pause and keep the cube oriented the same way. If you know the last layer and direction you turned, undo it by turning that layer back by the same amount. If you’re unsure, which layer did you last see move?' }[lang];
  } else if (!/(?:怎么|如何|为什么|哪里|在哪|哪一|哪步|第一步|下一步|接下来|对不上|入口|链接|教程|教我|\b(?:how|where|what|why|tutorial|lesson|link|show|next)\b)/i.test(text)) {
    return;
  } else if (/白(?:色)?(?:的)?(?:那(?:一|个))?面.{0,12}(?:拼满|拼好|齐了|好了)|白色(?:已经|都)?拼满|(?:拼满|拼好)了?白(?:色)?面|(?:white (?:face|side)|[ao]ne white face).{0,18}(?:done|solved|complete|filled)|(?:solved|finished|made) (?:the |a |my )?white (?:face|side)|底层角块|第一层(?:的)?(?:角块|怎么拼|怎么做|教程)|\bbottom corners\b/i.test(text)) {
    lesson = 'corners';
  } else if (/白(?:色)?十字(?:已经)?(?:拼好|做好|完成|好了).{0,12}(?:接下来|下一步|然后)|\b(?:finished|solved|completed) (?:the |my )?white cross\b.{0,16}\bnext\b/i.test(text)) {
    lesson = 'corners';
    hint = { zh: '先核对四条白棱的侧面颜色是否都对准中心。对齐后，找一块带白色的角，按它另外两种颜色确定该放在哪两个侧面之间。',
      en: 'Check that all four white edges match their side centers. Once they do, find a white corner and use its other two colors to identify its slot.' }[lang];
  } else if (/小花(?:已经|都)?(?:好了|做好了?|做完了?|做成了?|完成了?|拼好了?).{0,12}(?:接下来|下一步|然后)|(?:做好|做完|完成|拼好)了?小花.{0,12}(?:接下来|下一步|然后)|白(?:色)?十字|底面十字|白棱归位|\b(?:white cross|bottom cross|solve one white edge)\b|\b(?:made|finished|completed) (?:the |my )?daisy\b.{0,18}\bnext\b|\bnext after (?:making|finishing) the daisy\b/i.test(text)) {
    lesson = 'cross';
    if (/(?:还)?(?:没(?:有)?|未)(?:做好|做完|完成|拼好)了?小花|\b(?:haven't|have not) (?:made|finished) (?:the |my )?daisy\b/i.test(text)) {
      lesson = 'daisy';
    } else if (!/小花|花瓣|daisy|petal|白棱归位|solve one white edge/i.test(text)) {
      hint = { zh: '先看看黄心旁边有没有四片白色花瓣。有的话，试着把其中一片的侧面颜色对准同色中心。白十字完成时，四条白棱的侧色也都要对齐。',
        en: 'Check for four white petals around the yellow center. If you have them, start by lining up the side color of one petal with its center. A finished white cross also has all four side colors aligned.' }[lang];
    }
  } else if (/小花|花瓣|\bdaisy\b/i.test(text)) {
    lesson = 'daisy';
  } else if (/转动记号|转法记号|\b(?:move|cube) notation\b/i.test(text)) {
    lesson = 'notation';
  } else if (/(?:三阶|魔方|3\s*[x×]\s*3|\bcube\b).{0,25}(?:零基础|新手|入门|第一次|从哪.{0,2}开始|第一步|层先法|beginners?|start|first step)|(?:零基础|新手|入门|第一次|第一步|怎么开始|beginner|first step|start).{0,25}(?:三阶|魔方|3\s*[x×]\s*3|\bcube\b)|一个面.{0,8}(?:都不会|也不会).{0,8}第一步/i.test(text)) {
    lesson = 'start';
  }
  if (!lesson) return;

  const { step, section, title, hint: defaultHint } = beginnerLessons[lesson];
  const action = { id: `page:lbl:${step}:${section}`, href: `/tutorial/lbl?step=${step}&section=${section}`, title: title[lang] };
  return { answer: linkOnly ? action.title : hint ?? defaultHint[lang], sources: [{ ...action, read: false }], actions: [action] };
}

/** A stand-alone recognition question about one corner. Extra clauses, including
 * requests for an insertion or a drill, still go to the general assistant. */
export function pairColourMatch(question:string,lang:Lang) {
  if (!/F2L|前两层/i.test(question)) return;
  const corner=/([白黄红橙蓝绿]{3})角(?:块)?/g;
  const corners=[...question.matchAll(corner)];
  if (corners.length!==1) return;
  const colours=[...corners[0][1]];
  if (new Set(colours).size!==3) return;
  const cross=question.match(/([白黄红橙蓝绿])(?:色)?(?:底|十字)/)?.[1] ?? '白';
  if (!colours.includes(cross)) return;
  const sides=colours.filter(c=>c!==cross);
  const edge=sides.join('');
  const distractor=question.match(/排除([白黄红橙蓝绿]{2})棱/)?.[1];
  const wrong=distractor && [...distractor].find(c=>!sides.includes(c));
  if (distractor && !wrong) return;
  const phrases=question.replace(corner,'').replace(/([白黄红橙蓝绿])(?:色)?(?:底|十字)/g,'')
    .replace(/(?:我(?:刚学|在学)|三阶|F2L|前两层|常把棱找错|用|做例子|为例|该找哪条棱|该配哪条棱|它应该对准哪两个中心|对准哪两个中心|如何一眼排除[白黄红橙蓝绿]{2}棱|不要给(?:我)?公式|只讲辨认|请)/gi,'')
    .replace(/[\s\p{P}]/gu,'');
  const complete=!phrases && /哪条棱|哪两个中心/.test(question);
  if (lang==='zh') {
    const reject=wrong?distractor+'棱含'+wrong+'色，缺少'+sides.find(c=>!distractor!.includes(c))+'色，可以直接排除。':'';
    const answer='以'+cross+'色做底层十字，'+corners[0][0]+'去掉'+cross+'色后剩下'+sides.join('和')+'，所以找'+edge+'棱。归位后，'+sides.map(c=>c+'色贴纸对准'+c+'色中心').join('，')+'。'+reject;
    return {answer,complete};
  }
  const names:Record<string,string>={白:'white',黄:'yellow',红:'red',橙:'orange',蓝:'blue',绿:'green'};
  const answer='With a '+names[cross]+' cross, set aside the '+names[cross]+' sticker on the corner. Look for the '+sides.map(c=>names[c]).join('–')+' edge. In its slot, '+sides.map(c=>'the '+names[c]+' sticker faces the '+names[c]+' center').join(' and ')+'.'+(wrong?' Exclude the '+[...distractor!].map(c=>names[c]).join('–')+' edge because it contains '+names[wrong]+'.':'');
  return {answer,complete};
}

export function pairFindingDrill(question: string, history: AssistantMessage[], lang: Lang, sentences?: number): string|undefined {
  const previous = history.filter(m => m.role === 'user').at(-1)?.content ?? '';
  const revised = /第二项|第\s*2\s*项|第二个练习|second (?:exercise|drill|activity)/i.test(question);
  const topic = revised ? previous+'\n'+question : question;
  if (!/F2L|前两层|first two layers/i.test(topic) || !asksToLocatePair(question) ||
      !/练习|训练|只练|\b(?:drills?|exercises?|practi[cs]e)\b/i.test(question)) return;
  const oncePattern = /每(?:一)?项(?:只(?:能|允许|可)?)?(?:尝试|试|做)?[一1]次|(?:each (?:exercise|drill) (?:only )?once|one (?:attempt|try) (?:per|each)|only (?:one|1) (?:attempt|try) each)/i;
  const once = oncePattern.test(topic);
  if (/只(?:能)?看[到见]|被挡|遮住|(?:禁止|不许|不能|不要|不可)转体|每项.{0,6}[一二三四五六七八九十0-9]+次|每组.{0,6}次|(?:白|黄|绿|蓝|红|橙)(?:色)?底|(?:white|yellow|red|orange|blue|green) cross|repetitions per|reps each|\b(?:hidden|occluded|no rotations?|no regrips?)\b|贴纸颜色是|计时器计时|子步骤|表格|每项.{0,5}理由|substeps?|table|paragraph|段落|词数/i.test(topic.replace(oncePattern,'')) ||
      assistantPlanPieceFacts(topic) || assistantObservationOnlyPlan(question, revised ? previous : '')) return;
  const shape = assistantPlanShape(question);
  if (shape?.englishWords || shape?.substepsPerActivity || shape?.activitySecondsMaximum || shape?.stepSecondsMaximum) return;
  const check = once ? (lang==='zh'?'核对两块的配色，本项只试一次，找错或找不到也停。':'Check the colours once, then stop even if you miss.') : {zh:'用两指同时指出角和棱，核对角上除底色外的两色是否与棱的两色完全相同，连续找对两对即停。',en:'Point at both pieces, check that the two non-cross colours on the corner exactly match the edge, and stop after two correct pairs in a row.'}[lang];
  const eyesOpen = /(?:禁止|不许|不能|不要|不)闭眼|眼睛.{0,6}睁开|keep.{0,12}eyes open|without closing/i.test(topic);
  const second = eyesOpen ? {zh:'换一个含底色的角，睁眼慢慢转体，找到与角上另外两色匹配的棱并说出两块的位置。',en:'Choose a new cross-colour corner and rotate the cube with your eyes open until you can point out the matching edge and name both locations.'}[lang] : {zh:'换一个含底色的角，先按另外两色找到配对棱，再闭眼说出两块的位置，睁眼转体复核。',en:'Choose another cross-colour corner, locate its edge by the other two colours, then close your eyes and name both locations before rotating the cube to check.'}[lang];
  if (revised && (!sentences || sentences === 2) && /改|调整|换|revise|change|replace|rewrite/i.test(question)) return second+(lang==='zh'?'':' ')+check;
  if (sentences || (shape?.activities && shape.activities !== 2) || !/无计时器|(?:没(?:有)?|不用|不看)计时器|without (?:a |my )?timer|no timer/i.test(question)) return;
  const seconds = assistantPlanTimeBounds(question).total;
  const budget = seconds && seconds%60 === 0 ? {zh:'总共最多 '+seconds/60+' 分钟，有时间就做下一项，到点随时停；用次数判断是否完成。',en:'Allow at most '+seconds/60+' minutes overall. Use repetitions as the stopping points and stop early if your time is up.'}[lang] : '';
  if (once) {
    const stop = lang==='zh'?'各做一次，核对后即停；找错或找不到也结束该项。':'Try each exercise once. Stop after the check even if you miss or cannot find the piece.';
    const drills=lang==='zh'?[
      '选一个含底色的角，说出另外两色。扫视各层，包括中层已经占用的槽，指出同时带这两色的棱。',
      '反过来，先选一条既不含底色也不含顶色的棱，再找同时带底色和这两色的角。并排指认两块，核对三个颜色。',
    ]:[
      'Choose a cross-colour corner and name its other two colours. Scan every layer, including occupied middle slots, for the edge with exactly those colours.',
      'Start with an edge that has neither the cross nor the opposite colour. Find the corner with the cross colour and both edge colours. Point at both pieces and check the colours.',
    ];
    return [budget,stop,...drills.map((drill,i)=>(i+1)+'. '+drill)].filter(Boolean).join('\n\n');
  }
  const first = {zh:'选定底色，找一个含该色的角。转动整颗魔方看清另外两色，再找恰有这两色的棱；两指同时指对两块算一次，换角成功两次即停。',
    en:'Choose your cross colour and a corner containing it. Rotate the whole cube to see its other two colours, then find the edge with exactly those colours. Point to both pieces and stop after two correct matches using different corners.'}[lang];
  return [budget,'1. '+first,'2. '+second+(lang==='zh'?'':' ')+check].filter(Boolean).join('\n\n');
}

const reductionFacts = {
  en:'For a standard N×N cube with N ≥ 4, solve each (N−2)×(N−2) centre in the correct colour scheme, then group the N−2 edge pieces of each of the 12 edges by colour and wing orbit. Treat each centre and grouped edge as a unit and finish using a 3×3 method. Odd orders have a fixed centre on each face and a middle edge piece on each edge. Wing-pairing cases can still arise, but after full correct pairing the middle edges and corners obey the 3×3 constraints. Even orders have neither reference piece. A fully paired even cube can show one apparently flipped composite edge or an isolated swap of two composite edges; these require a parity correction.',
  zh:'标准 N 阶魔方（N ≥ 4）的降阶法分三步。先按正确配色拼好六个 (N−2)×(N−2) 中心，再按颜色和翼棱轨道，把每条棱上的 N−2 块配成一组。最后把每组棱和每个中心视作一个整体，按三阶解完。奇数阶每面有固定中心，每条棱有一块中棱。配棱过程中仍可能遇到特殊情况，全部正确配好后，中棱和角满足三阶约束。偶数阶没有固定中心和中棱，降阶后可能只见一组棱翻转或两组棱互换，需要对应的奇偶修正。',
};
export function oddCubeCornerExchange(question:string,lang:Lang) {
  if (question.length>650 || !/\b([3579])\s*[×x]\s*\1\b|(?:三|五|七|九)阶/i.test(question)
      || !/(?:two|2|both|两|两个).{0,16}(?:corners?|角).{0,20}(?:swap|exchang|互换|交换)|(?:swap|exchange).{0,16}(?:two|2) corners/i.test(question)
      || !/illegal|disassembl|sticker|otherwise solved|rest (?:is|are) solved|only two|贴纸|拆|其余.*复原/i.test(question)
      || /also|compare|probability|prove|even.order|另[外一]|偶数阶/i.test(question)) return;
  return lang==='en'
    ? 'If just those two corners have exchanged positions and everything else is solved, no legal sequence will fix it. With the fixed centres aligned, the eight corners and twelve middle edge pieces on an odd cube obey the same permutation parity as on a 3×3. A single corner swap changes only one of those parities. Check all twelve middle edges against the centres, then check the three colours and their order on each suspect corner. Re-glued stickers can imitate a swap. Correct the misplaced labels if confirmed; consider physical reassembly only if the pieces themselves were put back incorrectly.'
    : '如果确实只互换了两个角、其余全部复原，合法转动无法单独换回这两个角。以固定中心为参照，奇数阶的八个角与十二个中棱和三阶一样，排列奇偶性必须一致。单换两角只改变其中一方。先对照中心逐个检查十二个中棱，再核对两个可疑角的三种颜色及环绕顺序。贴纸粘错也会呈现类似外观。确认错贴就纠正贴纸，只有确认实体块装错时才考虑重新装配。';
}

export function reductionDefinition(question:string,lang:Lang) {
  const topic=question.trim().replace(/[？?！!.。]+$/,'').replace(/降階/g,'降阶').replace(/高階/g,'高阶');
  if (/^(?:(?:高阶|大)\s*(?:方塊|方块|魔方)\s*)?(?:什么是降阶法|什麼是降阶法|降阶法是(?:什么|什麼))$/.test(topic)
      || /^(?:what is|explain) (?:the )?reduction(?: method)?(?: (?:on|for) (?:a |the )?(?:big|higher.order|[4-9][x×][4-9]) cubes?)?$/i.test(topic)) return reductionFacts[lang];
}

export function reductionParityGuide(question: string, lang: Lang): AssistantAnswer|undefined {
  if (!/(?:四|4)阶|4\s*[×x]\s*4/i.test(question) || !/降阶|配.{0,3}棱|reduction|paired|parity|奇偶/i.test(question) ||
      !/单.{0,3}翻|翻.{0,5}(?:一|1|棱)|两.{0,4}棱.{0,4}(?:换|交换)|OLL\s*parity|PLL\s*parity|flipped edge|edge.{0,12}(?:flipped|swap)/i.test(question)) return;
  // An algorithm opt-out still permits a diagnostic explanation.
  const scope = question.replace(/(?:不要|不用|无需|不需要)(?:给|写|贴)?(?:长)?公式|(?:no|without) (?:long )?algorithms?/gi,'');
  const wantsMoves = /公式|算法|手顺|转法|步骤|怎样拧|怎么拧|如何操作|\b(?:algorithms?|moves?|sequence|notation|how to (?:fix|solve|execute))\b/i.test(scope);
  if (wantsMoves && /OLL\s*parity|单.{0,2}翻|flipped edge/i.test(scope) &&
      !/PLL|互换|交换|尚未配|未配|没(?:有)?配好|概率|推导|最短|其他公式|(?:不要|不用|禁止|不能|不含).{0,4}(?:宽转|转体)|inner.only|rotation.free|swap|unpaired|derive|shortest|without (?:wide|rotations)|no rotations/i.test(scope)) {
    const source={id:'alg:4x4:oll-parity',title:lang==='zh'?'四阶 OLL parity 公式库':'4×4 OLL parity algorithms',href:'/alg/4x4/oll-parity',read:false};
    const alg="Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'";
    const answer=lang==='zh'?[
      '先确认中心已还原、12 组棱已配好。末层朝上，把要翻的组合棱放在上前方（UF）。',
      alg,
      'Rw 是从右面看，将右侧两层一起顺时针转 90°。撇号表示逆时针，2 表示半转。Lw 同理，从左面看；x 是沿 R 的方向转动整个魔方，之后按新朝向继续。完成后重新识别普通三阶末层。',
    ]:[
      'With centres solved and all 12 edges paired, hold the last layer up and the flipped pair at up-front (UF).',
      alg,
      'Rw turns the two right layers together clockwise as seen from the right. A prime reverses the turn and 2 means a half turn. Read Lw from the left. For x rotate the whole cube like R, then continue in the new grip. Recheck the last layer before proceeding as on a 3×3.',
    ];
    return {answer:answer.join('\n\n')+' [['+source.id+']]',sources:[source]};
  }
  if (wantsMoves || /没(?:有)?配好|尚未配|未配|计数|概率|\b(?:algorithm|moves?|unpaired|probability|odds)\b/i.test(scope)) return;
  const source = {id:'guide:4x4-reduction',title:{zh:'J Perm 四阶降阶教程',en:'J Perm’s 4×4 reduction tutorial'}[lang],href:'https://jperm.net/4x4',read:false};
  const answer = {zh:'中心、12 组棱和前两层都已完成时，顶面看起来只有一条组合棱翻转是合理的。\n\n先数四条顶层组合棱：顶色朝上的有 1 或 3 条，就是 OLL 奇偶。若有 0、2 或 4 条，翻棱数为偶数；顶面还花也可能只是普通 OLL。\n\n再查位置：完成顶面定向，把角归位并与侧面中心对齐。如果只剩两组棱互换，就是 PLL 奇偶。两种情况可以同时出现，先查朝向，再查位置。\n\n三阶通过合法转动只能翻转偶数条棱，角、棱排列的奇偶性也必须一致。四阶的一组棱由两个翼棱组成，配对后把它们看成一条，才会出现三阶无法达到的外观。',
    en:'With centres solved, all 12 edges paired and the first two layers complete, one apparently flipped paired edge is possible.\n\nCount the four top edges showing the top colour: one or three means OLL parity. Zero, two or four is even, so an unfinished top can still be ordinary OLL.\n\nAfter orienting the top, solve its corners and align them with the side centres. If exactly two edge pairs still need to exchange places, that is PLL parity. Both can occur in one solve.\n\nLegal 3×3 moves preserve even edge-flip parity and matching corner/edge permutation parity. Each reduced 4×4 edge contains two separate wings. Treating them as one piece can produce a state unreachable on a 3×3.'}[lang];
  return {answer:answer+' [['+source.id+']]',sources:[source]};
}

export const clubDirectoryUrl = 'https://speedcubing.app/clubs/directory';
type Club = {href:string; name:string; aliases:string[]};
const cachedClubs = publicReadCache<Club[]>(300_000);

function listedClubs(html:string):Club[] {
  const {document}=parseHTML(html);
  return [...document.querySelectorAll('a[href^="/clubs/"]')].flatMap(a=>{
    const path=a.getAttribute('href')!;
    const name=a.textContent?.trim().match(/^(.+?) cubing club\b/i)?.[1];
    if(!name || name.length>100 || !/^\/clubs\/[a-z0-9-]+$/.test(path))return [];
    const aliases=name.split(/[()]/).map(s=>s.trim().toLowerCase()).filter(s=>s.length>=2);
    return [{href:new URL(path,clubDirectoryUrl).href,name,aliases}];
  });
}

export async function clubDirectoryAnswer(question: string, lang: Lang, loadHtml:()=>Promise<string>, signal:AbortSignal, shared=false):Promise<AssistantAnswer|undefined> {
  if (!/俱乐部|战队|魔友|魔方社|cubing club|cube club|team directory|teams page/i.test(question) ||
      !/入口|目录|浏览|线下|城市|本地|附近|哪里|\b(?:find|directory|browse|city|local|meet|nearby)\b/i.test(question) ||
      /我(?:的|加入了)|队员名单|胜率|谁|排名|比赛成绩|收费|多少钱|会费|报名|申请|怎么加入|具体地址|营业时间|\b(?:my team|roster|rankings?|won)\b/i.test(question)) return;
  const site = {id:'page:wca-teams',href:'/wca/teams',title:{zh:'CubeRoot 战队目录',en:'CubeRoot team directory'}[lang]};
  const regional = {id:'directory:cubing-clubs',href:'https://speedcubing.app/clubs/directory',title:{zh:'地区俱乐部目录（Speedcubing.app）',en:'Regional club directory (Speedcubing.app)'}[lang]};
  const byCity = /俱乐部|线下|魔友|城市|附近|本地|\b(?:clubs?|city|local|meet|nearby)\b/i.test(question);
  const external = byCity && !/仅限本站|不要外链|只(?:给|要)本站|no external|only (?:this site|cuberoot)/i.test(question);
  let matches:Club[]=[];
  if (external) {
    const load = async()=>{
      const clubs=listedClubs(await loadHtml());
      if (!clubs.length) throw new Error('Club directory contains no entries');
      return clubs;
    };
    try {
      const clubs=await assistantDeadline(()=>shared?cachedClubs(load):load(),signal);
      const q=question.toLowerCase().normalize('NFKC');
      const words=' '+q.replace(/[^\p{L}\p{N} -]/gu,' ')+' ';
      const hits=clubs.flatMap(club=>{
        const positions=club.aliases.map(alias=>/\p{Script=Han}/u.test(alias)?q.indexOf(alias):words.indexOf(' '+alias+' ')).filter(i=>i>=0);
        return positions.length?[{club,at:Math.min(...positions)}]:[];
      }).sort((a,b)=>a.at-b.at);
      matches=[...new Map(hits.map(({club})=>[club.href,club])).values()];
    } catch { signal.throwIfAborted(); }
    signal.throwIfAborted();
  }
  const citySource=(club:Club)=>({...regional,id:'club:'+club.href.split('/').at(-1),href:club.href,title:club.name+' (Speedcubing.app)'});
  if (matches.length>1) {
    const actions=matches.map(citySource);
    return {answer:actions.map((source,i)=>matches[i].name+' [['+source.id+']]').join('\n'),actions,sources:actions.map(source=>({...source,read:false}))};
  }
  const [match]=matches;
  const city = match ? citySource(match) : regional;
  let answer = {zh:'打开「战队」，选择厂商及旗下战队，可按姓名或 WCA ID 查成员。该页没有城市筛选。',en:'Open Teams, choose a brand and its team, or search the members by name or WCA ID. This page has no city filter.'}[lang]+' [['+site.id+']]';
  if (external) answer += ' '+({zh:match?'外部俱乐部目录有 '+match.name+' 条目，可直接打开。':'找当地魔友可打开外部俱乐部目录，按国家或地区浏览，再用页面搜索查城市。',en:match?'Open the '+match.name+' entry in the external club directory.':'For local cubers, browse the external directory by country or region and search the page for your city.'}[lang])+' [['+city.id+']] '+{zh:'条目可用于找同地区玩家，线下聚会时间和地点需另行确认。',en:'A directory entry can help you find local cubers. Confirm a meetup time and place separately.'}[lang];
  const actions = external ? [site,city] : [site];
  return {answer,actions,sources:actions.map(s=>({...s,read:false}))};
}

/** Only unqualified roster questions; rankings, dates and subteams have other scopes. */
export async function brandRosterAnswer(question:string, lang:Lang, read:(url:string)=>Promise<unknown>, signal:AbortSignal):Promise<AssistantAnswer|undefined> {
  const roster = /^(?:请问|请列出|请|目前|现在)?\s*(GAN|魔域|MoYu)\s*(?:旗下|战队|队|目前|现在|的)*\s*(?:队员|选手|成员)?(?:有哪些|有谁|都有谁|都有哪些|有哪些人|名单)(?:队员|选手|成员)?[？?。!\s]*$|^(?:who (?:is|are) (?:on|in)|list (?:the )?members of) (?:team )?(GAN|MoYu)(?:'s)?(?: (?:team|roster))?[?.!\s]*$/i.exec(question.trim());
  if (!roster) return;
  const brand = (roster[1] ?? roster[2]).toLowerCase() === 'gan' ? 'GAN' : 'MoYu';
  const filter = brand === 'GAN' ? GAN_TEAM_FILTER : 'moyu';
  const href = '/wca/teams'+(brand==='GAN'?'?team='+GAN_TEAM_FILTER:'');
  const source = {id:'roster:'+filter,href,title:{zh:brand+' 战队名单',en:brand+' roster'}[lang]};
  try {
    const directory = await read('https://api.cuberoot.me/v1/wca/teams?directory=1&team='+filter+'&page=1&size=50&v=5') as {members?:{name:string}[];total?:number};
    if (!Array.isArray(directory?.members) || !Number.isSafeInteger(directory.total) || !directory.members.every(m=>typeof m?.name==='string')) throw new Error('Incomplete roster');
    const names = directory.members.map(m=>displayCuberName(m.name,lang==='zh')).join(lang==='zh'?'、':', ');
    const answer = {zh:brand+' 厂商旗下已登记 '+directory.total+' 人，本页列出 '+directory.members.length+' 人。',en:brand+' has '+directory.total+' registered members across its teams. This page lists '+directory.members.length+'.'}[lang];
    return {answer:answer+' '+names+' [['+source.id+']]',sources:[{...source,read:true}],actions:[source]};
  } catch {
    signal.throwIfAborted();
    return {answer:{zh:'当前未能读取成员名单。可打开战队目录，展开 '+brand+'，选择旗下战队查看成员。',en:'The roster could not be read. Open Teams, expand '+brand+' and select a team to see its members.'}[lang]+' [['+source.id+']]',sources:[{...source,read:false}],actions:[source]};
  }
}

// A constructive answer proves existence only. Match the entire request so a
// second constraint, a different puzzle, or a request for sources stays with the planner.
export function checkedFaceColourAnswer(question: string, lang: Lang): AssistantAnswer | undefined {
  const text = question.trim();
  const english = /^(?:is it possible to|can (?:you|one)) (?:scramble|arrange) (?:a |the )?(?:3\s*[x×]\s*3\s+|rubik['’]s )?cube (?:so(?: that)?|such that) (?:each|every) face (?:has|shows) (?:no more than|at most) (?:2|two) (?:squares|stickers) (?:of (?:the same|any (?:one|single)) colou?r)[?.!]*$/i;
  const chinese = /^(?:能否|可不可以|可以|能不能)(?:把|将)?(?:一个)?(?:三阶)?魔方(?:打乱|转成|摆成)[，,使让成 ]*每(?:一?面|个面)(?:每种颜色|同色|相同颜色)(?:都)?(?:不超过|至多|最多)(?:两|2)(?:个|格|块){0,2}(?:吗)?[？?。]*$/u;
  if (!english.test(text) && !chinese.test(text)) return;
  const moves = 'R2 L2 U2 D2 F2 B2 L R U D L';
  const faces = toFaceletString(applyScramble(3,moves)).match(/.{9}/g);
  if (faces?.length !== 6) return;
  const maxima = faces.map(face => Math.max(...[...new Set(face)].map(colour => face.split(colour).length - 1)));
  if (maxima.some(max => max > 2)) return;
  return {answer: lang === 'en'
    ? 'Yes. From solved, apply `'+moves+'`. Counting all nine stickers on each face gives these six maximum frequencies: '+maxima.join(', ')+'. This is a reachable example.'
    : '可以。从复原态做 `'+moves+'`。逐面统计九格中出现最多的颜色，六个面的格数依次为 '+maxima.join('、')+'，均满足条件。',sources:[]};
}

// Stable mechanics for explanatory turns. Supply facts to the composer rather
// than classifying a mixed question as fully answered by a single keyword.
export function cubeConceptFacts(question: string): string | undefined {
  const bigCube=/(?:[4-9]\s*[x×]\s*[4-9]|[四五六七八九高大][阶階]|big cubes?|higher.order cubes?)/i.test(question) && /parity|edge|wing|cent[er]{2}|reduc|降[阶階]|配[棱边邊]|奇偶/i.test(question);
  if (!bigCube && !/魔方|三阶|四阶|[2345]\s*[x×]\s*[2345]|\bcub(?:e|es|ing)\b|rubik|speedcub|tetrad twist|\b(?:CFOP|F2L|OLL|PLL)\b/i.test(question)) return;
  const facts: string[] = bigCube ? [reductionFacts.en] : [];
  if (/commutator|交换子|任意阶|n[×*x]n/i.test(question)) facts.push('A commutator can move pieces outside the intersection of its operands’ supports. Test the full permutation on each affected orbit before claiming that it isolates a cycle. For reduction, solve centres and pair each dedge before treating the puzzle as a 3×3; address wing parity where applicable.');
  if (/memori[sz]|memor[yia]|背公式/i.test(question) && /minimum|fewest|least|最少/i.test(question)) facts.push('Distinguish a fixed generating set from memorised algorithms with free setups, inverses or regrips. A cyclic subgroup argument applies to powers of a single fixed element, not all of its conjugates. A construction gives an upper bound unless shorter alternatives are ruled out. Pure three-cycles cannot fix odd permutations alone.');
  if (/打乱|scrambl/i.test(question)) facts.push('A random-state generator samples a legal state and produces moves to reach it. Repeating a fixed sequence from solved always gives the same state. Appearance or a skipped step does not establish randomness.');
  if (/打乱|scrambl/i.test(question) && /random|uniform|perfect|god.s number|随机|均匀|最乱/i.test(question)) {
    facts.push('Uniform randomness describes a sampling distribution, not the appearance of a single state. Drawing a fixed number of face turns, even excluding consecutive turns on one face, weights states by the number of allowed walks ending there. God’s number 20 in the 3x3 face-turn metric bounds shortest solutions, not the mixing time of a random walk. State sampling followed by inverting a solution generates the chosen state.');
  }
  if (/初学|新手|beginner|intuitive/i.test(question) && /\b(?:F2L|OLL|PLL|CFOP)\b|层先|进阶/i.test(question)) {
    facts.push('A practical LBL-to-CFOP path is cross planning and intuitive F2L, two-look OLL and two-look PLL, then full PLL (21 cases) before full OLL (57). New F2L can initially be slower; learn recognition and insertions before memorizing exceptions. Two-look OLL and PLL conventionally use ten and six algorithms respectively, some shared with beginner methods.');
  }
  if (/fingertrick|指法/i.test(question) && /\bM\b|中层/.test(question)) facts.push('M turns like L: the back center moves up. M-prime moves the front center up and the back center down. A right ring finger can flick at the bottom/back; specify the contact location before describing the direction.');
  if (/commutator|交换子/i.test(question)) facts.push('For any piece orbit, permutation sign is multiplicative, so every commutator A B A^-1 B^-1 has positive permutation sign there. Conjugation preserves the sign of its operand. An outer face quarter turn is a four-cycle on corners (negative sign). A single swap cannot be a product of commutators, regardless of what happens to edges. An odd setup can move the residual problem into the even subgroup; do not undo that setup as a conjugation.');
  if (/tetrad twist|四面体.{0,4}扭转/i.test(question)) facts.push('In Thistlethwaite reduction, tetrad twist classifies the relative PERMUTATIONS of the two four-corner tetrads before entering the half-turn subgroup. Corner orientations are already fixed. The three possibilities are not physical corner twists.');
  if (/beginner|入门|初学/i.test(question) && /improve|faster|next method|recommended method|提速|进阶/i.test(question)) facts.push('Intuitive F2L pairs and slow cross planning are useful next steps after LBL. Standard two-look OLL has ten algorithms and two-look PLL six; some may already be familiar.');
  if (/face by face|逐面复原/i.test(question)) facts.push('Solving successive faces as milestones can use temporary disruption and restoration with piece cycles. A face is not a full layer. Once five faces are monochromatic the sixth is already monochromatic by sticker counts; do not assume a last unsolved face after five solved faces.');
  if (/角块|棱块|奇偶|角扭|翻棱|parity|wing|corner|edge flip|reassembl|put back together/i.test(question)) {
    facts.push('On a standard 3x3, corner twists sum to 0 modulo 3, edge flips sum to 0 modulo 2, and corner and edge permutation signs match. U and D preserve corner orientations; side quarter turns twist two corners each way. A 4-cycle has odd sign. On a reduced 4x4 each dedge contains two distinct wings: exchanging its wings looks like one flipped edge; exchanging two whole dedges swaps two pairs of wings. Same-color center pieces can conceal permutations.');
  }
  if (/corner|edge|wrongly assembled|wrong together|角块|棱块|扭角|翻棱|装错/i.test(question)) {
    facts.push('If all other pieces on a standard 3x3 are solved, a single twisted corner, flipped edge or transposition of just two edges cannot be fixed by legal turns. Restore the violated invariant physically: untwist the corner, unflip the edge, or interchange the two pieces respectively. These are distinct repairs. A move sequence quoted as a failed attempt does not specify the starting state. During an unfinished layer solve the unsolved pieces can compensate. On a 2x2 there is no edge parity constraint; isolated corner swaps are possible, but the total corner twist must still be zero.');
    if (/wrong|reassembl|装错|装反/i.test(question)) facts.push('Invariants diagnose the kind of assembly defect, not the identity of the originally mishandled piece after subsequent moves. Distinguish a sufficient repair from a historical identification.');
  }
  if (/void cube|void rubik|空心魔方/i.test(question)) facts.push('On a Void Cube an odd virtual-center permutation can appear as just two edges swapped. One middle-slice quarter turn changes parity; then re-solve the disturbed pieces with the virtual centers in mind. A middle-slice half turn does not toggle parity.');
  if (/reassembl|重新组装/i.test(question) && /(?:three|3) (?:faces|sides)|三(?:面|个面)/i.test(question)) facts.push('For three adjacent visible faces of a standard reassembled 3x3 with intact cubies and fixed centers, a hidden corner can compensate total twist, a hidden edge can compensate total flip, and exchanging two hidden edges can correct permutation sign. The same visible stickers therefore admit a solvable completion. Do not extrapolate to arbitrary recoloring or claim the actual unseen arrangement is solvable.');
  if (/记号|notation|wide turn/i.test(question)) facts.push('In WCA Article 12a outer face R is one layer; Rw or 2Rw turns the outer two together on a 4x4. R\' and R2 mean inverse and half turn. Lowercase r is convention-dependent in unofficial texts and cannot be assumed to mean a WCA inner slice.');
  if (!/(?:[245-9]\s*[x×]\s*[245-9]|[二四五六七八九]阶|pocket cube)/i.test(question) && /局面|状态|\b(?:states?|positions?|configurations?)\b/i.test(question) && /距离|最短|最多.{0,3}步|\b(?:distance|diameter|complexity|arbitrary|god.s number)\b/i.test(question)) {
    facts.push("With a fixed frame and move metric, the distance from reachable A to B equals the distance from identity to the relative group element A inverse times B. The standard 3x3 diameter is 20 face turns (HTM), including between arbitrary endpoints. Going via solved gives a bound, not necessarily a shortest path. Kociemba's RubiksCube-TwophaseSolver documents solveto(cubestring, goalstring, ...); distinguish this local API from a verified public online interface.");
  }
  if (/贴纸|编号|数字|\b(?:stickers?|tiles?|numbered|numbers on)\b/i.test(question)) {
    facts.push('On a standard 3x3 each edge color pair and corner color triple identifies one cubie. A color-solved cube restores every edge/corner sticker to its original square relative to centers. A marked center can rotate in place without changing which square it occupies.');
  }
  if (/相邻|棋盘|adjacent|touching|checkerboard/i.test(question)) {
    facts.push('For edge adjacency, the reachable 3x3 checkerboard can be made by R2 L2 U2 D2 F2 B2 from solved. Its alternating squares on each face and different color pairs on adjacent faces give a counterexample to forced same-color contact. Diagonal contact and counts per face are different constraints; this pattern has only two colors per face.');
  }
  if (/顶层|末层|(?:top|last)[ -]layer/i.test(question) && /打乱|scrambl/i.test(question)) {
    facts.push('For random last-layer practice choose the 3x3 last-layer (LL) subset in a trainer such as csTimer (3x3x3 CFOP → last layer), or invert a complete last-layer solution from solved F2L to set up that case. OLL and PLL subsets train narrower tasks. A lone R U R-prime U-prime trigger does not preserve solved F2L.');
  }
  if (/parity|奇偶|特殊情况/i.test(question) && /记忆|怎么记|如何记|memori[sz]/i.test(question)) {
    facts.push('For big-cube reduction, identify the order, reference orientation and the specific OLL or PLL parity case. Rehearse one algorithm as finger-friendly chunks, chain adjacent chunks, then recall it from its case. Wing and slice notation depends on puzzle size. Square-1 uses a different mechanism and notation.');
  }
  return facts.join(' ') || undefined;
}

// A position and an orientation are different diagnoses. A face quarter-turn
// is odd on both permutations; two flipped edges are not a transposition.
export function lastPairExchange(question:string,lang:Lang) {
  if (question.length>520 || !/(?:last|final)[- ]layer|末层|最后一层/i.test(question)
      || !/everything else (?:is )?solved|(?:cube|puzzle) is solved except|all (?:but|except)|其余.{0,5}复原/i.test(question)
      || !/(?:two|2|两).{0,30}(?:edges?|side pieces|棱)/i.test(question)
      || /corner|角|even.order|[2456789]\s*[×x]|四阶|对比|also|prove|shortest|probability|without|give.{0,12}sequence/i.test(question)) return;
  return lang==='en'
    ? 'First check whether the last two edges are in each other’s slots or merely flipped in their own slots. On a standard 3×3 with everything else solved, a swap alone is impossible. A face quarter-turn makes one four-cycle of edges and one of corners. Each four-cycle is odd (three transpositions), so the two permutation parities always match. Swapping just two edges would break that equality. If both are in their correct slots but flipped, that is a legal two-edge flip and calls for an orientation algorithm. Compare both colours of each edge with the adjacent centres and check all corners before considering misplaced stickers or reassembly. If this is a larger cube, its order and whether the edges have been paired matter.'
    : '先分清两条棱是互占对方的位置，还是位置正确、各自翻向。普通三阶若其余全好，单独换两棱没有合法转法。一次面四分之一转对棱、角各做一个四循环，各等于三次对换，都是奇置换，因而角棱两者的排列奇偶性始终相同。若两棱均在自己的槽位且同时翻向，则是合法的双翻棱，可用定向算法。先把两块棱的两色与相邻中心逐一核对，并确认所有角归位，再判断是否错贴或错装。若是高阶，还需确认阶数和配棱状态。';
}

export function cubieRepresentation(question:string, lang:Lang) {
  if (!/(?:rubik|魔方)/i.test(question) || !/code|software|program|编码|程序|求解器/i.test(question)) return;
  // Match the whole request, including repeated title/body formulations.
  const sentences=question.split(/[?？。!！\n]/).map(s=>s.trim()).filter(Boolean);
  const ask=/^(?:(?:if (?:you|I) (?:were|was) (?:developing|writing) (?:software|a program) to solve a rubik['’]?s cube,\s*))?how (?:would|should|can|do) (?:you|I|we) represent (?:a rubik['’]?s cube|the cube)(?: (?:in (?:code|software|a program)|for a solver))?$/i;
  if (!sentences.length || !sentences.every(s=>ask.test(s) || /^(?:在程序中|用代码)(?:如何|怎么)表示(?:一个)?(?:三阶)?魔方$/.test(s))) return;
  return lang==='en'
    ? 'For a standard 3×3 solver I would store four arrays indexed by slot: corner piece IDs and twists (8 entries each), and edge IDs and flips (12 each). In the solved state the IDs equal the slot indices and every orientation is zero. For each face turn precompute the source slot and orientation change for every destination. Read from the old arrays into new ones, add corner twists modulo 3, and XOR edge flips. This gives reversible move updates without moving individual stickers. Validate input by checking each ID occurs once, the twist sum is 0 mod 3, the flip sum is even, and corner and edge permutation parity agree. Convert to 54 facelets for display or colour entry. There are more than 2^65 legal fixed-centre states, so a lossless single-integer encoding needs at least 66 bits.'
    : '普通三阶求解器可用四个按槽位索引的数组：八个角块的编号和扭向、十二个棱块的编号和翻向。复原时编号等于槽号，朝向全为零。为每种面转预先存好每个目标槽的来源和朝向变化，从旧数组读取、写入新数组。角扭向按模 3 相加，棱翻向用异或。输入时检查每种块只出现一次、角扭向和为 0（模 3）、翻棱数为偶数、角棱排列奇偶相同。显示或录入颜色时再转成 54 个贴面。固定中心的合法状态数超过 2 的 65 次方，无损单整数编码至少需要 66 位。';
}

// Identify the observable defect before suggesting a physical repair: a
// sticker describes a cubie, whereas its current slot changes on every turn.
export function repeatedEdgeColour(question:string,lang:Lang) {
  if (!/stickers?|贴纸/i.test(question) || !/\bedge\b|棱块/i.test(question) ||
      !/same colou?r|both sides?.{0,18}(?:white|yellow|red|green|blue|orange)|两面.{0,6}同色/i.test(question) ||
      /picture cube|shape mod|supercube|blindfold|证明|derive|probability/i.test(question)) return;
  return lang==='en'
    ? 'On a standard six-colour cube each edge carries two different adjacent face colours. Turning the cube cannot change a white-white (or any same-colour) edge into a valid pair. Before removing a sticker, use the fixed centres to list the 12 expected unordered pairs and inventory all 12 actual edges. The missing pairs and the duplicates identify possible donor stickers; a scrambled edge’s current slot alone does not identify its colours. If just two stickers were exchanged, solve as much as possible, align the affected slots with the centres and try the proposed exchange on paper. Check that each edge exists once, the edge flip sum is even and corner and edge permutation parity agree. The two identical stickers can give the same pair inventory but leave different flip states. If several assignments fit, the report cannot identify a unique sticker to lift.'
    : '标准六色魔方每条棱都带相邻两面的两种不同颜色。转动无法修复两面同色的棱。先按固定中心列出应有的 12 组无序色对，再盘点全部棱，找出缺失和重复的色对，缩小可能换错的贴纸范围。打乱时棱所在的槽不能决定它原来的颜色。若确实只换错两张，先尽量复原其余块，对齐中心，在纸上试换，再核对十二种棱各有一块、翻棱数为偶、角棱排列同奇偶。交换两张同色贴纸中的不同一张可能得到相同色对，却留下不同的翻向。若仍有多个候选，只凭这段描述无法唯一指定应揭哪一张。';
}

export function repeatedCornerOrientation(question:string,lang:Lang) {
  if (!/corner|角块/i.test(question) || !/orient|twist|扭向|朝向/i.test(question) ||
      !/\b(?:three|3) (?:times|repeats|repetitions)|(?:repeat|perform)\w*.{0,30}(?:three|3) times|重复三次/i.test(question) ||
      /(?:[RUFLDB]['2]?\s+){2}[RUFLDB]['2]?\b|specific sequence|following algorithm|以下公式|给定转序/i.test(question)) return;
  return lang==='en'
    ? 'Three repetitions do not always restore corner orientation. Hold the cube fixed and use the usual U/D sticker convention. Take R alone: R³ = R′, so four corners still have their U/D stickers off the U/D faces. One application of any fixed sequence sends each corner to a fixed new slot and adds a fixed twist modulo 3 for that step. A corner moving from B to A brings its previous twist with it. On a permutation cycle of length k, one trip of k applications returns that corner to its slot and adds the sum s of the twists along the cycle. Positions and orientations on that cycle both reset after k applications if s = 0 mod 3, otherwise after 3k. A corner fixed in place always loses any added twist after three repetitions; a moving corner need not. On a three-cycle specifically, three repetitions restore those corners’ orientations exactly when the three increments sum to 0 mod 3. The whole cube’s twist sum being zero does not imply that each individual cycle has zero sum.'
    : '重复三次不一定恢复角朝向。固定整块魔方，以顶底色贴纸为参照，仅做 R，三次后 R³ = R′，仍有四个角的顶底色没有朝向顶底面。固定转序把每个角送往确定的新槽位，并在每一步加上确定的扭向增量（模 3）。从 B 到 A 的角携带原有扭向。在长度为 k 的置换循环中，重复 k 次回到原槽，净扭向是沿途增量之和 s。若 s 模 3 为零，该循环的位置和朝向都在 k 次后复原；否则要 3k 次。原位扭角重复三次会抵消。若是三循环，重复三次能否恢复朝向取决于该循环的增量和；所有角的总和为零不能推出每条循环的和都为零。';
}

export function matchScrambledState(question:string,lang:Lang) {
  if (question.length>650 || !/3\s*[×x]\s*3|三阶/i.test(question) || !/scrambl|打乱/i.test(question) ||
      !/same as another|exact(?:ly)? (?:the )?same|和另.{0,8}一样/i.test(question) ||
      /probability|odds|chance|how (?:likely|many)|shortest|最短|概率|几个/i.test(question)) return;
  return lang==='en'
    ? 'Yes. Hold the two ordinary 3×3s with the same centre colours at the top and front. Solved means all six faces match their centres. To make a legal scrambled A look exactly like a legal scrambled B, record a solution for each in that frame. On A, first apply its own solution, then apply the inverse of B’s solution: reverse the order of the moves and invert each turn (half turns stay the same). The first part gets A to solved; the second takes solved to B. You can obtain B’s solution by entering its six faces into a solver or by solving it while recording the moves. If you already know the scramble that created B, use it directly for the second part. This assumes the same colour scheme and legally reachable states.'
    : '可以。把两个普通三阶摆成相同的顶色和前色，六个面的颜色都与各自中心一致时就是复原。要让合法打乱 A 完全匹配合法打乱 B，先在同一参照系分别记下两者的解法。在 A 上执行它自己的解法，再执行 B 解法的逆序列：倒序排列并逐步取逆，半转不变。这样先从 A 到复原，再从复原到 B。可把 B 的六面录入求解器，或实际还原并记录过程。若已有 B 原本的打乱，第二段直接用该打乱即可。前提是两者配色相同、局面合法。';
}
