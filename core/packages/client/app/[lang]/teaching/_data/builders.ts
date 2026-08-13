import type { Lesson, LessonKind, LocalizedText, MicroLesson } from './types';

interface MicroLessonInput {
  id: string;
  title: LocalizedText;
  outcome: LocalizedText;
  kind?: LessonKind;
  minutes?: number;
  shots?: LocalizedText[];
  script?: LocalizedText[];
  formulas?: Lesson['formulas'];
}

export function l(zh: string, en: string): LocalizedText {
  return { zh, en };
}

const SHOTS: Record<LessonKind, LocalizedText[]> = {
  concept: [l('正面说明本节唯一目标', 'State the single lesson goal to camera'), l('俯拍魔方展示关键位置', 'Show the key pieces from the overhead camera'), l('慢动作复述判断方法', 'Repeat the recognition rule in slow motion')],
  case: [l('定格展示标准起始形状', 'Hold the standard starting case still'), l('慢速完整执行一次', 'Perform the full solution slowly once'), l('正常速度执行并展示结果', 'Repeat at normal speed and show the result')],
  drill: [l('正面说明练习规则', 'Explain the drill rules to camera'), l('俯拍连续示范三次', 'Demonstrate three consecutive attempts overhead'), l('屏幕显示过关次数', 'Show the pass target on screen')],
  example: [l('先展示本次打乱和目标', 'Show the scramble and goal first'), l('俯拍完整示范并保留停顿', 'Keep decision pauses in the full overhead solve'), l('回放关键选择并解释原因', 'Replay the key choice and explain why')],
  resource: [l('展示资料页的使用位置', 'Show where this sheet belongs in the course'), l('放大一组示例说明读法', 'Zoom into one group and explain how to read it'), l('演示一次查找和自测流程', 'Demonstrate one lookup and self-test cycle')],
  milestone: [l('展示本阶段完成状态', 'Show the completed stage'), l('完整演示一次不剪辑流程', 'Demonstrate one uncut full attempt'), l('屏幕显示课后挑战', 'Show the after-class challenge on screen')],
};

function defaultScript(title: LocalizedText, outcome: LocalizedText, kind: LessonKind): LocalizedText[] {
  if (kind === 'case') {
    return [
      l(`这一节只处理“${title.zh}”。今天不用同时记很多情形，我们只把这一种看清楚、做稳定。`, `This lesson covers only “${title.en}.” You do not need to memorize a whole set today; we will make this one case clear and reliable.`),
      l('【把标准起始形状放到画面中央，停两秒】', '[Hold the standard starting case in the center for two seconds.]'),
      l('先别转。请看顶层形状，再看目标块之间是相邻、相对，还是已经连在一起。你可以暂停画面，用手指出判断线索。', 'Do not turn yet. Look at the top shape, then decide whether the target pieces are adjacent, opposite, or already paired. Pause and point to the clue if you need to.'),
      l('我先调整到标准拿法。标准拿法很重要，因为同一个公式从错误方向开始，会把正确的块带到错误的位置。', 'I will rotate to the standard grip first. The grip matters because the same algorithm started from the wrong angle sends the right pieces to the wrong places.'),
      l('【用屏幕箭头标出目标块和目标槽】', '[Mark the target pieces and target slot with on-screen arrows.]'),
      l('现在我慢速做一遍。先不要跟着转，只看目标块每一步去了哪里。动作之间的短暂停顿是故意留下的。', 'Now I will solve it slowly. Do not follow yet; just watch where the target pieces go after each move. The short pauses are intentional.'),
      l('【慢速执行一次；回到起始状态】', '[Perform once slowly, then reset the case.]'),
      l('第二遍请跟着做。每完成一小段就检查：已经完成的部分有没有被破坏，目标块是不是更接近它的家。', 'Follow along on the second attempt. After each short section, check that solved pieces are safe and the target pieces are moving closer to their home.'),
      l('【正常速度执行一次，最后展示六面或目标槽】', '[Repeat at normal speed, then show all relevant faces or the target slot.]'),
      l('如果结果不对，先检查拿法和第一步，不要连续乱补动作。复原起始形状，再慢做一次，通常就能找到错误。', 'If the result is wrong, check the grip and first move instead of adding random turns. Reset the case and repeat slowly; that usually reveals the mistake.'),
      l(`现在轮到你。先说出判断理由，再独立完成。过关标准是：${outcome.zh}。连续成功三次以后再进入下一节。`, `Your turn. Say the recognition clue aloud, then solve independently. Pass target: ${outcome.en}. Get three correct attempts in a row before moving on.`),
    ];
  }

  if (kind === 'drill') {
    return [
      l(`今天不加新知识，我们把“${title.zh}”练到稳定。练习的目标不是一次很快，而是每次都知道自己为什么这样做。`, `We are not adding new information today. We will make “${title.en}” reliable. The goal is not one fast attempt; it is knowing why every attempt works.`),
      l('【屏幕显示练习次数、正确标准和休息时间】', '[Show the repetition target, accuracy target, and break time.]'),
      l('第一轮只做三次慢练。每次开始前说出你要找的东西，做完以后检查结果，不计时间。', 'Round one is three slow repetitions. Before each attempt, say what you are looking for. Check the result afterward and ignore the timer.'),
      l('第二轮做五次连贯练习。速度只提高一点点，眼睛要先看到下一步，手再开始动。', 'Round two is five connected repetitions. Increase speed only a little; let your eyes find the next step before your hands move.'),
      l('【俯拍示范一次正确练习、一次典型错误】', '[Demonstrate one correct repetition and one typical mistake from above.]'),
      l('如果失败，马上停住并保留现场。先问自己：看错了、拿反了，还是动作方向错了？只修这一项，再重新开始。', 'If you fail, stop and keep the cube as it is. Ask whether the error was recognition, grip, or move direction. Fix only that item, then restart.'),
      l('连续练习一分钟以后，把手放下休息十秒。短暂休息能让下一轮更准确，不需要硬撑。', 'After one minute of repetitions, put the cube down for ten seconds. A short break improves the next round; there is no need to force it.'),
      l(`最后做一次不看提示的检查。完成后自己打勾：${outcome.zh}。达到标准再进入下一节。`, `Finish with one attempt without prompts. Check the box when you can do this: ${outcome.en}. Move on only after you meet the target.`),
    ];
  }

  if (kind === 'example') {
    return [
      l(`这节用一个完整例子练“${title.zh}”。重点不是跟上我的速度，而是看懂每一次选择。`, `This lesson uses a full example to practise “${title.en}.” The goal is not to match my speed; it is to understand every decision.`),
      l('【展示起始状态和打乱，给孩子五秒观察】', '[Show the starting state and scramble, then allow five seconds to inspect.]'),
      l('先暂停视频，告诉我你最先会处理什么。没有唯一答案，但你的选择要保护已经完成的部分，并为下一步留下好位置。', 'Pause and tell me what you would solve first. There may be more than one good answer, but your choice should protect solved pieces and leave a useful next step.'),
      l('我开始以后，每完成一个小目标都会停一下，说出下一步要找的块、我看到了什么，以及为什么选这条路线。', 'Once I begin, I will pause after each small goal to name the next pieces, the clue I saw, and why I chose this route.'),
      l('【完成一次保留真实停顿的俯拍示范】', '[Record one overhead solve with the real decision pauses left in.]'),
      l('现在回看最长的停顿。这里变慢通常不是手法问题，而是上一小步结束前没有开始寻找。', 'Now replay the longest pause. This slowdown is usually not an execution problem; it happens because searching did not begin before the previous step ended.'),
      l('【分屏回放关键选择：左侧原速度，右侧慢放并标目标块】', '[Replay the key choice in split screen: normal speed on the left, slow motion with target markers on the right.]'),
      l('请用同一个起始状态跟做一次，再换一个新的打乱独立做。新打乱不必和我走同一路线，只要能解释自己的选择。', 'Follow once from the same starting state, then try a fresh scramble independently. You do not need to copy my route on the new scramble; explain your own choice.'),
      l(`这节的过关标准是：${outcome.zh}。把最犹豫的一处记下来，它就是下一次专项练习的题目。`, `Pass target: ${outcome.en}. Write down the moment where you hesitated most; that becomes your next focused drill.`),
    ];
  }

  if (kind === 'resource') {
    return [
      l(`这一页不是让你一次背完，而是教你怎样使用“${title.zh}”。资料表是地图，不是一次完成的作业。`, `This sheet is not something to memorize in one sitting. It teaches you how to use “${title.en}.” Treat the sheet as a map, not one giant assignment.`),
      l('【展示资料的分组、编号、公式和查找入口】', '[Show the groups, numbers, algorithms, and lookup entry.]'),
      l('每次只选当前正在练的一小组。第一遍只看图认形，第二遍看公式，第三遍盖住答案自己说出第一步。', 'Choose only the small group you are currently learning. First identify the picture, then study the algorithm, then cover the answer and recall the first move.'),
      l('公式旁边要记录三件事：标准拿法、最容易错的手法连接，以及最近一次成功日期。', 'Record three things beside each algorithm: standard grip, the fingertrick transition most likely to fail, and the latest successful review date.'),
      l('【演示一次从课程编号找到资料案例，再返回视频练习的流程】', '[Demonstrate finding a sheet case from its lesson number, then returning to the video drill.]'),
      l('遇到不稳定的情形就做标记，下次从标记处开始。已经稳定的案例按间隔复习，不必每天从第一页重来。', 'Mark unstable cases and resume from those marks next time. Review stable cases at spaced intervals instead of restarting from page one every day.'),
      l(`今天的完成标准是：${outcome.zh}。做完一次遮挡答案自测，这张资料才真正开始属于你。`, `Today’s pass target is: ${outcome.en}. The sheet becomes useful only after one closed-answer self-test.`),
    ];
  }

  if (kind === 'milestone') {
    return [
      l(`来到“${title.zh}”，我们先不追求快，只检查前面的步骤能不能连起来。`, `You have reached “${title.en}.” Speed is not the goal yet; we are checking whether the earlier steps connect into one reliable process.`),
      l('【展示完整目标，并说明哪些位置允许暂停】', '[Show the complete goal and explain where pauses are allowed.]'),
      l('开始前先说出路线。你要知道第一步做什么、每个小阶段何时结束，以及最后怎样检查结果。', 'Say the route before starting. Know the first action, how each small stage ends, and how you will check the final result.'),
      l('过程中卡住可以停，但不要跳过判断，也不要为了继续而乱转。找到目标块以后再恢复动作。', 'You may pause when stuck, but do not skip the decision or turn randomly just to keep moving. Find the target before continuing.'),
      l('【完整完成一次，不剪掉停顿和修正】', '[Record one complete attempt without cutting pauses or corrections.]'),
      l('完成以后先检查结果，再回看最慢的一段。只选一个问题作为下一轮目标，避免同时改很多事情。', 'Check the result first, then replay the slowest section. Choose one problem for the next round instead of trying to fix everything at once.'),
      l('【展示复盘清单：正确、独立、连续三次、需要复习的位置】', '[Show the review checklist: correct, independent, three in a row, and areas to revisit.]'),
      l(`这一关的标准是：${outcome.zh}。做到以后，你就可以进入下一阶段。`, `Pass target: ${outcome.en}. Once you meet it, you are ready for the next stage.`),
    ];
  }

  return [
    l(`这节微课只解决一个问题：“${title.zh}”。学完马上练，不需要一次记很多内容。`, `This micro-lesson solves one problem: “${title.en}.” You will practise immediately, so there is no need to remember too much at once.`),
    l('【正面说完目标，切到俯拍画面】', '[State the goal to camera, then switch to the overhead view.]'),
    l('先把魔方放稳，保持我们约定的正面和顶面。拿法固定以后，判断才不会跟着魔方一起变。', 'Set the cube down in the agreed front-and-top orientation. A consistent grip keeps the recognition rule from changing as the cube moves.'),
    l('请先观察我指到的位置。我们只找一个最明显的线索，再用这个线索决定下一步，不靠猜。', 'Watch the location I point to. We will use one clear clue to decide the next step instead of guessing.'),
    l('【放大关键块，用箭头标出颜色和目标位置】', '[Zoom in on the key pieces and mark their colors and destinations.]'),
    l('我先慢速示范。动作做慢一点没关系，方向正确最重要。每做完一小段，我都会停下来检查。', 'I will demonstrate slowly first. Correct direction matters more than speed. I will pause after each short section to check the result.'),
    l('【慢速示范一次，让关键位置停留两秒】', '[Demonstrate once slowly and hold the key position for two seconds.]'),
    l('第二遍请你跟着做。转动前先说出这一层的名字；转完以后确认目标块是否去了预期位置。', 'Follow along on the second attempt. Name the face before turning, then check whether the target piece reached the expected position.'),
    l('如果做错，回到上一个看得懂的位置重新开始。我们要练的是发现错误和修正错误，不是把错误藏起来。', 'If something goes wrong, return to the last position you understood. We are practising how to notice and correct errors, not how to hide them.'),
    l(`现在请暂停视频独立试一次。过关标准是：${outcome.zh}。成功以后，用自己的话把判断方法讲给我听。`, `Pause and try once independently. Pass target: ${outcome.en}. After a successful attempt, explain the recognition rule in your own words.`),
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
  title: LocalizedText;
  count: number;
  minutes?: number;
  outcome?: (caseNumber: number) => LocalizedText;
}): MicroLesson[] {
  return Array.from({ length: count }, (_, index) => {
    const caseNumber = index + 1;
    return microLesson({
      id: `${prefix}-${caseNumber}`,
      title: l(`${title.zh} ${caseNumber}`, `${title.en} ${caseNumber}`),
      minutes,
      kind: 'case',
      outcome: outcome?.(caseNumber) ?? l(`能从标准角度识别并独立完成${title.zh} ${caseNumber}`, `Recognize and solve ${title.en} ${caseNumber} independently from the standard angle`),
    });
  });
}
