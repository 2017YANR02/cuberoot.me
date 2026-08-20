'use client';

import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  MessageCircleQuestion,
  Mic2,
  MoveRight,
  Radio,
} from 'lucide-react';
import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import './live-script.css';

type Bi = { zh: string; en: string };
type CueKind = 'action' | 'interaction' | 'transition' | 'optional';

type Beat =
  | { kind: 'say'; text: Bi }
  | { kind: 'cue'; cue: CueKind; text: Bi };

interface Segment {
  id: string;
  number: string;
  title: Bi;
  duration: Bi;
  goal: Bi;
  beats: Beat[];
}

const cueLabels: Record<CueKind, Bi> = {
  action: { zh: '动作', en: 'Action' },
  interaction: { zh: '互动', en: 'Audience' },
  transition: { zh: '转场', en: 'Transition' },
  optional: { zh: '可选', en: 'Optional' },
};

const segments: Segment[] = [
  {
    id: 'opening',
    number: '01',
    title: { zh: '开场：先让观众留下来', en: 'Opening: give people a reason to stay' },
    duration: { zh: '3–5 分钟', en: '3–5 min' },
    goal: {
      zh: '确认声音、抛出主题、马上建立互动。',
      en: 'Check the audio, frame the topic, and invite immediate participation.',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '大家好，我是颜瑞民，欢迎来到魔方根 CubeRoot 的直播间。刚进来的朋友可以帮我听一下声音：如果听得清楚，评论区打个“1”。',
          en: 'Hi everyone, I’m Ruimin Yan. Welcome to the CubeRoot livestream. If you can hear me clearly, type “1” in the chat.',
        },
      },
      {
        kind: 'cue',
        cue: 'interaction',
        text: {
          zh: '等 5–10 秒，读两三个昵称。接着问：大家从哪里来？自己在学，还是想带孩子一起学？',
          en: 'Pause for 5–10 seconds and read two or three names. Then ask where people are watching from and whether they are learning for themselves or with a child.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '今天我想认真聊一个问题：魔方除了“拧得快”以外，到底有什么值得学？我会先做一个小演示，再讲魔方背后的数学、它能练到哪些能力，以及不同年龄怎么开始。最后我也会带大家看看 CubeRoot 网站里能直接用的学习工具。',
          en: 'Today I want to answer one question properly: beyond solving fast, why is the cube worth learning? I’ll begin with a short demonstration, then talk about its mathematics, the skills it can exercise, and how different ages can start. I’ll finish with a tour of the learning tools on CubeRoot.',
        },
      },
      {
        kind: 'cue',
        cue: 'action',
        text: {
          zh: '做一次正常速拧。状态好再补一次单手，不追求破纪录；演示结束就停，不连续刷成绩。',
          en: 'Do one normal speedsolve. Add one one-handed solve only if it feels natural. The aim is to demonstrate, not chase a record.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '刚才大家看到的是结果。接下来我从头讲讲，我为什么会从数学一路走到魔方。',
          en: 'What you just saw was the result. Now let me start from the beginning and explain how mathematics led me to the cube.',
        },
      },
    ],
  },
  {
    id: 'intro',
    number: '02',
    title: { zh: '自我介绍：用经历建立信任', en: 'Introduction: establish trust through experience' },
    duration: { zh: '5–7 分钟', en: '5–7 min' },
    goal: {
      zh: '只讲与今天主题有关的经历，不把直播变成履历朗读。',
      en: 'Share only the background that supports the topic rather than reading a full résumé.',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '我叫颜瑞民，是魔方根 CubeRoot 的创始人。我本科在南开大学读物理和数学双学位，后来到美国继续读数学研究生，研究方向是拓扑学。',
          en: 'My name is Ruimin Yan, and I founded CubeRoot. I completed a double degree in physics and mathematics at Nankai University, then continued graduate study in mathematics in the United States, focusing on topology.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '我最早并不是因为玩具认识魔方，而是在抽象代数和群论里不断遇到它。后来我自己查资料、学还原，先练层先法，又学盲拧。第一次盲拧大概用了十五分钟，眼睛上还蒙着一条毛巾，但成功的那一刻特别震撼。',
          en: 'I first encountered the cube not as a toy, but repeatedly in abstract algebra and group theory. I began teaching myself, starting with a layer-by-layer method and then blindfold solving. My first successful blindfold solve took about fifteen minutes, with a towel over my eyes, and that moment stayed with me.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '从 2017 年起，我开始参加 WCA 世界魔方协会认证的正式比赛。对我来说，比赛成绩当然重要，但更重要的是：魔方把抽象的数学、清晰的训练方法和真实的社群连接到了一起。后来我做 CubeRoot，也是想把这条学习路径整理得更清楚。',
          en: 'I began competing in official World Cube Association events in 2017. Results matter, of course, but what matters more to me is how the cube connects abstract mathematics, deliberate practice, and a real community. CubeRoot grew from my wish to make that learning path clearer.',
        },
      },
      {
        kind: 'cue',
        cue: 'optional',
        text: {
          zh: '观众追问成绩时再说：我的正式比赛三阶单次是 6.92 秒，二阶单次 1.95 秒，斜转单次 2.10 秒。说完马上回到主题，不展开排名。',
          en: 'If someone asks about results: “My official singles are 6.92 in 3×3, 1.95 in 2×2, and 2.10 in Skewb.” Then return to the main topic instead of expanding into rankings.',
        },
      },
      {
        kind: 'cue',
        cue: 'transition',
        text: {
          zh: '“数学究竟在魔方的什么地方？我先用三个数字讲清楚。”',
          en: '“Where exactly is the mathematics in a cube? Let me explain with three numbers.”',
        },
      },
    ],
  },
  {
    id: 'math',
    number: '03',
    title: { zh: '数学钩子：三个数字讲明白', en: 'The mathematics hook: explain it with three numbers' },
    duration: { zh: '8–10 分钟', en: '8–10 min' },
    goal: {
      zh: '把抽象概念变成观众能猜、能看、能记住的问题。',
      en: 'Turn abstract ideas into questions the audience can guess, see, and remember.',
    },
    beats: [
      {
        kind: 'cue',
        cue: 'action',
        text: {
          zh: '拿起一个三阶魔方，指给大家看中心块、棱块和角块。',
          en: 'Hold up a 3×3 cube and point out the centres, edges, and corners.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第一个概念叫“位置类型”。中心块始终在中心，棱块始终在棱的位置，角块也只能去角的位置。魔方不是毫无规则地乱动，它是在非常明确的限制里变化。',
          en: 'The first idea is piece type. Centres remain centres, edges occupy edge positions, and corners occupy corner positions. A cube does not move without rules; it changes within very precise constraints.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第二个数字是十二分之一。假设把魔方完全拆开，再随机装回去，能不能正常还原？大家可以先猜。答案是：只有十二分之一的概率。因为角块朝向有三分之一的限制，棱块翻转有二分之一的限制，奇偶性还有二分之一的限制，合起来就是十二分之一。',
          en: 'The second number is one in twelve. If you completely disassemble a cube and put every piece back at random, can it always be solved? Take a guess. Only one in twelve assemblies is solvable: corner orientation contributes a factor of three, edge orientation a factor of two, and permutation parity another factor of two.',
        },
      },
      {
        kind: 'cue',
        cue: 'interaction',
        text: {
          zh: '读一两个答案，再揭晓。若观众感兴趣，只解释“3 × 2 × 2”，不在这里展开证明。',
          en: 'Read one or two guesses before revealing the answer. If people are curious, explain only “3 × 2 × 2” here; save the proof for another session.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第三个数字更大：三阶魔方一共有 43,252,003,274,489,856,000 种合法状态。也就是大约 4325 京种。你随手打乱两次，得到完全相同状态的概率小得难以想象。',
          en: 'The third number is much larger: a 3×3 cube has 43,252,003,274,489,856,000 legal states—about 43 quintillion. The chance that two casual scrambles produce exactly the same state is unimaginably small.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '这也是魔方迷人的地方：规则非常有限，变化却几乎无穷。学魔方不是死记一个答案，而是在庞大的可能性里寻找结构。',
          en: 'That is the cube’s appeal: its rules are limited, yet its variations feel almost endless. Learning it is not memorising one answer; it is finding structure within a huge space of possibilities.',
        },
      },
      {
        kind: 'cue',
        cue: 'transition',
        text: {
          zh: '“这些数学听起来很有意思，但家长更关心的是：孩子真正练到了什么？”',
          en: '“The mathematics is fascinating, but parents usually ask a more practical question: what does a child actually practise?”',
        },
      },
    ],
  },
  {
    id: 'benefits',
    number: '04',
    title: { zh: '核心价值：真正练到的五件事', en: 'Core value: five things the cube can exercise' },
    duration: { zh: '12–15 分钟', en: '12–15 min' },
    goal: {
      zh: '用具体训练过程说明价值，同时明确不承诺“提高智商”。',
      en: 'Explain the value through concrete practice while avoiding claims that it “raises IQ.”',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '第一是空间想象。以三阶速拧的十字为例，你不能只盯着眼前这一块，而要在脑子里判断几块棱的位置、方向和移动后的结果。刚开始是一步一步试，练熟以后会逐渐形成整体图像。',
          en: 'First is spatial reasoning. Consider the cross in a 3×3 speedsolve: you cannot stare at just one piece. You must track several edges, their orientations, and where each move will send them. At first you test one move at a time; with practice, a whole spatial picture begins to form.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第二是有结构的记忆。CFOP 常见的完整案例表里，F2L 41 种、OLL 57 种、PLL 21 种，合起来是 119 种。但真正有效的学习不是把字母硬塞进脑子，而是先看动作结构，再分组、对比和复习。',
          en: 'Second is structured memory. A common complete CFOP case set contains 41 F2L cases, 57 OLL cases, and 21 PLL cases—119 in total. Effective learning is not forcing letters into memory; it is seeing movement patterns, grouping related cases, comparing them, and reviewing them.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '我自己就走过弯路。以前我把 119 个公式整整齐齐抄在本子上，靠死记硬背学完，后来很长时间没练，几乎全忘了。这件事反而让我更确定：理解和合理复习，比一次背得多更重要。',
          en: 'I learned this the hard way. I once copied all 119 algorithms neatly into a notebook and memorised them mechanically. After a long break, I had forgotten almost all of them. That made one lesson very clear: understanding and sensible review matter more than cramming.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第三是拆解问题。完整还原看起来很复杂，但可以拆成十字、F2L、OLL、PLL；每一步又能继续拆成观察、判断和执行。面对一个大问题，先找到结构，再逐段解决，这是一种可以迁移的思考习惯。',
          en: 'Third is problem decomposition. A full solve looks complex, but it can be divided into cross, F2L, OLL, and PLL; every stage can be divided again into observation, decision, and execution. Finding structure and solving a large problem in parts is a transferable habit of thought.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第四是专注和节奏。速拧不是手越快越好。只顾着快，会在每组动作之间停顿；真正的进步来自观察下一步、控制失误、保持连贯。盲拧则更直接地训练持续注意和信息编码。',
          en: 'Fourth is focus and rhythm. Speedsolving is not simply moving your hands faster. Rushing creates pauses between sequences; progress comes from looking ahead, controlling errors, and maintaining continuity. Blindfold solving makes sustained attention and information encoding even more explicit.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第五是成就感和社交。魔方体积小、随时能练，也有清晰可见的进步：从第一次独立还原，到一分钟、三十秒、二十秒，每一步都能被自己看见。参加线下比赛以后，还会认识不同年龄、不同职业但有共同兴趣的人。',
          en: 'Fifth is a sense of progress and community. A cube is portable and easy to practise, and improvement is visible: a first independent solve, then one minute, thirty seconds, twenty seconds. Competitions also connect people of different ages and professions through a shared interest.',
        },
      },
      {
        kind: 'cue',
        cue: 'interaction',
        text: {
          zh: '问观众：这五点里，大家最看重哪一点？空间想象、记忆、专注、解决问题，还是孩子获得成就感？',
          en: 'Ask which matters most to the audience: spatial reasoning, memory, focus, problem-solving, or a child’s sense of achievement.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '这里我也要说得严谨一点：目前没有足够证据证明学魔方会直接提高智商或保证学习成绩。它更像一种具体、可重复的练习。练习确实会调动空间、记忆和专注，但最后能得到多少，取决于练法、频率和每个人的情况。',
          en: 'I also want to be precise: there is not enough evidence to claim that learning the cube directly raises IQ or guarantees better grades. It is a concrete, repeatable form of practice. It engages spatial reasoning, memory, and attention, but outcomes depend on how someone practises, how often, and on the individual.',
        },
      },
    ],
  },
  {
    id: 'learning',
    number: '05',
    title: { zh: '学习路径：几岁开始、怎样开始', en: 'Learning path: when and how to begin' },
    duration: { zh: '7–10 分钟', en: '7–10 min' },
    goal: {
      zh: '给家长可执行的判断标准，不许诺固定进度。',
      en: 'Give parents practical criteria without promising a fixed rate of progress.',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '经常有人问：几岁可以开始？我的建议不是只看身份证上的年龄，而是看三件事：能不能稳定听完一小段指令，能不能分清颜色和方向，遇到失败后愿不愿意再试一次。',
          en: 'People often ask what age is right. My advice is not to look only at a number. Ask three questions: can the learner follow a short instruction, distinguish colours and directions, and try again after a failed attempt?',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '一般来说，五到六岁的孩子可以在家长陪伴下尝试；六岁左右往往更容易跟着录播课独立学习。年龄更小也不是绝对不行，但家长最好先学会，再把每一步拆短，目标先定成认识结构、完成一层，而不是马上追求完整还原。',
          en: 'In general, children around five or six can try with a parent, while those around six often find it easier to follow a recorded course independently. Younger children are not excluded, but a parent should learn first, shorten each step, and begin with understanding the structure or completing one layer rather than demanding a full solve immediately.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '如果是成年人，也完全不晚。入门阶段先追求“能够独立完成”，不要一开始就背很多公式。能稳定还原以后，再根据兴趣选择速拧、盲拧、单手或其他项目。',
          en: 'Adults are never too late to begin. At first, aim for an independent solve rather than memorising many algorithms. Once the solve is reliable, choose speedsolving, blindfold solving, one-handed solving, or another event according to your interests.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '至于多久能到一分钟、三十秒或二十秒，没有统一答案。年龄、练习频率、方法和目标都不一样。比起承诺一个时间，我更愿意帮大家把下一步定清楚：先独立还原，再减少停顿，再学更高效的方法。',
          en: 'There is no universal answer for how long it takes to reach one minute, thirty seconds, or twenty seconds. Age, practice frequency, method, and goals all differ. Instead of promising a timeline, I prefer to make the next step clear: solve independently, reduce pauses, then learn more efficient methods.',
        },
      },
      {
        kind: 'cue',
        cue: 'interaction',
        text: {
          zh: '邀请观众留言“年龄 + 当前最好成绩 + 最大困难”。现场挑 2–3 个回答，每个只给一个下一步建议。',
          en: 'Invite viewers to post “age + personal best + biggest difficulty.” Pick two or three and give each person one next-step suggestion.',
        },
      },
      {
        kind: 'cue',
        cue: 'transition',
        text: {
          zh: '“方法说完了，我直接打开网站，给大家看这些训练怎么落到实际工具里。”',
          en: '“Now that we have the method, let me open the site and show how these ideas become practical tools.”',
        },
      },
    ],
  },
  {
    id: 'site',
    number: '06',
    title: { zh: '网站演示：只走一条使用路径', en: 'Site demo: follow one clear user journey' },
    duration: { zh: '7–10 分钟', en: '7–10 min' },
    goal: {
      zh: '让观众记住域名和三个入口，不在菜单里来回跳。',
      en: 'Help viewers remember the domain and three entry points without wandering through menus.',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '网站叫 CubeRoot，英文就是“立方根”，中文名叫魔方根。域名也很好记：cuberoot.me。它不是只放几篇教程，而是把学习、查询、训练和计时尽量放在同一个地方。',
          en: 'The site is called CubeRoot—the mathematical cube root—and its Chinese name is 魔方根. The address is easy to remember: cuberoot.me. It is more than a few tutorials; it brings learning, reference, practice, and timing together.',
        },
      },
      {
        kind: 'cue',
        cue: 'action',
        text: {
          zh: '屏幕共享后按固定顺序演示：①公式库 ②专项训练 ③计时器与打乱分析。每处只演示一个具体动作。',
          en: 'After sharing the screen, follow a fixed order: 1) algorithm library, 2) targeted trainers, 3) timer and scramble analysis. Demonstrate one concrete action in each place.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '第一，遇到不会的情况，可以到公式库查对应案例、动画和不同手法。第二，知道公式但识别慢，就进入专项训练，不需要每次从头还原整个魔方。第三，开始记录成绩以后，用计时器保存训练过程，再根据打乱分析十字、XCross 等解法参考。',
          en: 'First, when you do not know a case, use the algorithm library to see the case, animation, and alternative finger tricks. Second, if you know an algorithm but recognise it slowly, use a targeted trainer instead of solving the whole cube every time. Third, once you begin recording times, use the timer to track practice and the scramble analysis to study cross, XCross, and related solution ideas.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '如果你想把今天“魔方练什么”这部分发给家长或朋友，网站上还有一篇《玩魔方的好处》，里面把证据边界和具体练习过程写得更完整。',
          en: 'If you want to share today’s “what does the cube exercise?” discussion with a parent or friend, the site also has an article called “Why Learn the Cube,” with fuller explanations and clear evidence boundaries.',
        },
      },
      {
        kind: 'cue',
        cue: 'interaction',
        text: {
          zh: '让观众在浏览器输入 cuberoot.me，确认能打开即可。不要让大家在直播中注册或完成复杂操作。',
          en: 'Ask viewers to enter cuberoot.me and simply confirm that it opens. Do not ask them to register or complete a complicated task during the stream.',
        },
      },
    ],
  },
  {
    id: 'course',
    number: '07',
    title: { zh: '课程与产品：清楚说明，不催促', en: 'Courses and products: explain clearly without pressure' },
    duration: { zh: '5–7 分钟', en: '5–7 min' },
    goal: {
      zh: '回答怎么买、适合谁、什么时候有，所有时效信息以当场填写为准。',
      en: 'Answer who it is for, how to get it, and when it is available using only the current details filled in before the stream.',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '我做录播课程的原因很简单：一对一时间有限，而入门阶段很多关键问题是共通的。录播可以让大家暂停、回看、按自己的节奏练；真正卡住时，再带着具体问题来问，会更有效率。',
          en: 'The reason I make recorded courses is simple: one-to-one time is limited, while many beginner questions are shared. Recorded lessons let learners pause, replay, and move at their own pace. When they do get stuck, they can ask a specific question more efficiently.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '这套课程适合想从零开始、希望按清晰步骤完成第一次独立还原的人。已经能稳定还原、主要目标是进十五秒的朋友，需要的是另一条进阶训练路线，不建议因为正在直播就冲动购买。',
          en: 'This course is for someone starting from zero who wants a clear path to a first independent solve. If you already solve reliably and mainly want to break fifteen seconds, you need a different advanced training path; do not buy impulsively just because you are watching live.',
        },
      },
      {
        kind: 'cue',
        cue: 'action',
        text: {
          zh: '按直播前填写的信息说：课程上线时间是【课程上线时间】；价格或活动是【课程价格或活动】；当前商品与库存是【商品与库存】。没有确认的内容直接说“还没最终确认，确认后会在官方页面公布”。',
          en: 'Use the details filled in before going live: launch time [COURSE LAUNCH], price or offer [PRICE/OFFER], and products or stock [PRODUCT/STOCK]. If anything is uncertain, say: “It is not final yet; I will publish it on the official page once confirmed.”',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '大家先判断课程是否适合自己。有问题可以先问清楚，页面上的内容、价格和适用人群也请以当时显示为准。',
          en: 'First decide whether the course fits your needs. Ask questions before making a decision, and refer to the current page for the content, price, and intended learners.',
        },
      },
      {
        kind: 'cue',
        cue: 'transition',
        text: {
          zh: '“接下来留一段时间集中回答问题。新进来的朋友，我先用二十秒重新介绍一下今天在讲什么。”',
          en: '“I’ll leave some time now for questions. For anyone who just joined, here is a twenty-second summary of today’s topic.”',
        },
      },
    ],
  },
  {
    id: 'qa',
    number: '08',
    title: { zh: '问答：先复述主线，再答具体问题', en: 'Q&A: restate the thread, then answer specifics' },
    duration: { zh: '机动 5–15 分钟', en: 'Flexible 5–15 min' },
    goal: {
      zh: '照顾新观众，也避免被单个问题带离主题。',
      en: 'Welcome newcomers without letting one question pull the stream off course.',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '新进来的朋友大家好，我是颜瑞民，魔方根 CubeRoot 的创始人。我学数学出身，从 2017 年开始参加 WCA 正式比赛。今天主要聊魔方背后的数学、它能练到什么，以及不同年龄怎么开始。网站是 cuberoot.me。',
          en: 'For anyone just joining: I’m Ruimin Yan, founder of CubeRoot. My background is in mathematics, and I have competed in official WCA events since 2017. Today we are talking about the mathematics of the cube, what it can exercise, and how different ages can begin. The site is cuberoot.me.',
        },
      },
      {
        kind: 'cue',
        cue: 'interaction',
        text: {
          zh: '每答完一个问题，用一句话收回主线：“这个问题的下一步就是……”然后再读下一个。相同问题合并回答。',
          en: 'After each answer, return to the thread with: “So the next step for this question is…” Combine repeated questions.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '如果已经十五秒左右：你不需要从入门重学，重点检查观察停顿、十字规划、F2L 效率和专项弱项。先用计时记录找到最常见的损失点，再选一个问题集中练。',
          en: 'If you are already around fifteen seconds, you do not need to restart from beginner lessons. Examine pauses, cross planning, F2L efficiency, and specific weaknesses. Use timing records to find the most common source of lost time, then train one issue at a time.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '如果孩子太小：家长先学，孩子先玩结构和颜色；把任务缩短到一个小目标。能否继续，主要看孩子是否理解指令、手部力量是否够、失败后是否还愿意尝试。',
          en: 'If a child is very young, let the parent learn first and let the child explore structure and colour. Reduce the task to one small goal. Continue according to whether the child understands instructions, has enough hand strength, and remains willing to try after a setback.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '如果问学魔方能不能提高数学成绩：它和数学有很深的结构联系，也能提供空间和逻辑练习，但不能替代数学学习，更不能保证分数。把它当成一个有趣、可持续的思维活动更合适。',
          en: 'If someone asks whether cubing improves mathematics grades: the cube has deep mathematical structure and offers spatial and logical practice, but it cannot replace mathematics study or guarantee scores. It is better understood as an engaging, sustainable thinking activity.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '如果问多久能学会：先定义“学会”。能够看教程完成、能够不看教程独立还原、稳定进一分钟和进入速拧训练，是四个不同目标。目标说清楚以后，建议才有意义。',
          en: 'If someone asks how long it takes to learn, first define “learn.” Following a tutorial, solving independently, consistently breaking one minute, and beginning speed training are four different goals. Advice becomes meaningful only after the goal is clear.',
        },
      },
    ],
  },
  {
    id: 'closing',
    number: '09',
    title: { zh: '收尾：复盘三点，给一个下一步', en: 'Closing: recap three ideas and give one next step' },
    duration: { zh: '2–3 分钟', en: '2–3 min' },
    goal: {
      zh: '不突然下播，让观众知道今天记什么、接下来做什么。',
      en: 'Do not end abruptly; make the takeaway and next action unmistakable.',
    },
    beats: [
      {
        kind: 'say',
        text: {
          zh: '今天最后帮大家总结三点。第一，魔方的规则有限，但状态空间非常大，所以它既是玩具，也是很好的数学对象。第二，学习过程中真正反复练到的是空间观察、结构化记忆、问题拆解、专注和面对失败。第三，学习要从适合自己的下一步开始，不要把别人的时间表变成自己的压力。',
          en: 'Let me finish with three ideas. First, the cube has limited rules but a vast state space, making it both a toy and a rich mathematical object. Second, its practice repeatedly engages spatial observation, structured memory, problem decomposition, focus, and responding to failure. Third, learning should begin with your own next step, not with someone else’s timetable as pressure.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '想继续了解，可以打开 cuberoot.me，先从教程、《玩魔方的好处》或者计时器里选一个入口。课程和商品信息请以官方页面当时显示为准。',
          en: 'To continue, visit cuberoot.me and choose one starting point: a tutorial, the “Why Learn the Cube” article, or the timer. For courses and products, refer to the current information on the official page.',
        },
      },
      {
        kind: 'say',
        text: {
          zh: '感谢大家今天的陪伴。下一次直播是【下次直播时间】，主题是【下次直播主题】。如果不想错过，可以关注魔方根。我们下次见，大家晚安。',
          en: 'Thank you for spending this time with me. The next livestream is [NEXT STREAM TIME], and the topic is [NEXT STREAM TOPIC]. Follow CubeRoot if you would like a reminder. See you next time, and good night.',
        },
      },
      {
        kind: 'cue',
        cue: 'action',
        text: {
          zh: '说完后停 3 秒，确认没有最后一个必须回答的问题，再结束直播。',
          en: 'Pause for three seconds, check for one final essential question, and then end the stream.',
        },
      },
    ],
  },
];

const preparation = [
  { zh: '今天的主题或节日', en: 'Today’s topic or occasion' },
  { zh: '课程上线时间和价格', en: 'Course launch time and price' },
  { zh: '商品与实时库存', en: 'Products and live stock' },
  { zh: '下次直播时间和主题', en: 'Next stream time and topic' },
];

const referenceLinks = [
  { href: '/why-cube', label: { zh: '玩魔方的好处', en: 'Why Learn the Cube' } },
  { href: '/tutorial', label: { zh: '魔方教程', en: 'Cubing Tutorials' } },
  { href: '/alg', label: { zh: '公式库', en: 'Algorithm Library' } },
  { href: '/timer', label: { zh: '计时器', en: 'Timer' } },
];

export default function LiveScriptPage() {
  return (
    <main className="live-script-page">
      <div className="live-script-wrap">
        <header className="live-script-topbar">
          <Link href="/" className="live-script-home" prefetch={false}>
            <ChevronLeft aria-hidden="true" size={15} />
            {tr({ zh: 'CubeRoot 首页', en: 'CubeRoot home' })}
          </Link>
          <span>{tr({ zh: '主播提词稿', en: 'Presenter script' })}</span>
        </header>

        <section className="live-script-hero" aria-labelledby="live-script-title">
          <p className="live-script-kicker">
            <Radio aria-hidden="true" size={16} />
            {tr({ zh: '50–60 分钟主线', en: '50–60 minute core flow' })}
          </p>
          <h1 id="live-script-title">{tr({ zh: '直播话术', en: 'Livestream Script' })}</h1>
          <p className="live-script-lead">
            {tr({
              zh: '从开场破冰到收尾关注，一条线讲清“我是谁、魔方为什么有意思、真正练什么、怎样开始、去哪里继续学”。正文可直接说，带标签的内容只做现场提示。',
              en: 'A single path from the opening to the close: who I am, why the cube is fascinating, what it exercises, how to begin, and where to continue. Read the main text aloud; labelled lines are presenter cues.',
            })}
          </p>
        </section>

        <section className="live-script-prep" aria-labelledby="live-script-prep-title">
          <div className="live-script-prep-heading">
            <CheckCircle2 aria-hidden="true" size={18} />
            <div>
              <h2 id="live-script-prep-title">{tr({ zh: '开播前只补四项', en: 'Fill four items before going live' })}</h2>
              <p>{tr({ zh: '凡是未确认的信息，直播中不要猜。', en: 'Never guess live details that have not been confirmed.' })}</p>
            </div>
          </div>
          <ol>
            {preparation.map((item, index) => (
              <li key={item.en}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {tr(item)}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <nav className="live-script-nav" aria-label={tr({ zh: '直播流程', en: 'Livestream flow' })}>
        <div className="live-script-nav-inner">
          {segments.map((segment) => (
            <a key={segment.id} href={`#${segment.id}`}>
              <span>{segment.number}</span>
              {tr(segment.title).split('：')[0].split(':')[0]}
            </a>
          ))}
        </div>
      </nav>

      <div className="live-script-wrap live-script-flow">
        <div className="live-script-flow-heading">
          <Mic2 aria-hidden="true" size={20} />
          <h2>{tr({ zh: '正式话术', en: 'Full script' })}</h2>
          <p>{tr({ zh: '慢一点说，每个互动都给观众留出回答时间。', en: 'Speak slowly and leave time for responses after every audience prompt.' })}</p>
        </div>

        {segments.map((segment) => (
          <section key={segment.id} id={segment.id} className="live-script-segment">
            <div className="live-script-segment-meta">
              <span className="live-script-number">{segment.number}</span>
              <p className="live-script-duration">
                <Clock3 aria-hidden="true" size={14} />
                {tr(segment.duration)}
              </p>
            </div>
            <div className="live-script-segment-content">
              <header>
                <h2>{tr(segment.title)}</h2>
                <p>{tr(segment.goal)}</p>
              </header>
              <div className="live-script-beats">
                {segment.beats.map((beat, index) =>
                  beat.kind === 'say' ? (
                    <p className="live-script-say" key={`${segment.id}-${index}`}>
                      {tr(beat.text)}
                    </p>
                  ) : (
                    <aside className={`live-script-cue live-script-cue-${beat.cue}`} key={`${segment.id}-${index}`}>
                      <span>{tr(cueLabels[beat.cue])}</span>
                      <p>{tr(beat.text)}</p>
                    </aside>
                  ),
                )}
              </div>
            </div>
          </section>
        ))}

        <section className="live-script-notes" aria-labelledby="live-script-notes-title">
          <div>
            <MessageCircleQuestion aria-hidden="true" size={20} />
            <h2 id="live-script-notes-title">{tr({ zh: '现场不跑题的三条规则', en: 'Three rules for staying on track' })}</h2>
          </div>
          <ol>
            <li>{tr({ zh: '同一个问题最多讲两分钟，结尾一定给出“下一步”。', en: 'Give any one question at most two minutes and always finish with a next step.' })}</li>
            <li>{tr({ zh: '个人故事只在能解释观点时讲；讲完立刻回到当前章节。', en: 'Tell a personal story only when it explains the point, then return to the current section.' })}</li>
            <li>{tr({ zh: '不确定的数据、排名、价格和日期不临场猜，明确说稍后以官方页面为准。', en: 'Do not improvise uncertain data, rankings, prices, or dates; refer viewers to the official page.' })}</li>
          </ol>
        </section>

        <footer className="live-script-footer">
          <p>{tr({ zh: '直播中会用到的站内入口', en: 'CubeRoot pages used in the stream' })}</p>
          <div>
            {referenceLinks.map((item) => (
              <Link key={item.href} href={item.href} prefetch={false}>
                {tr(item.label)}
                <MoveRight aria-hidden="true" size={14} />
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
