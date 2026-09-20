export type AbilityTone = 'accent' | 'info' | 'success' | 'warning';

export type AbilityDetail = {
  id: string;
  tone: AbilityTone;
  title: readonly [zh: string, en: string];
  summary: readonly [zh: string, en: string];
  paragraphs: readonly (readonly [zh: string, en: string])[];
};

export type AbilityGroup = {
  id: string;
  image: string;
  imageAlt: readonly [zh: string, en: string];
  eyebrow: readonly [zh: string, en: string];
  title: readonly [zh: string, en: string];
  intro: readonly [zh: string, en: string];
  abilities: readonly AbilityDetail[];
};

export const ABILITY_GROUPS: readonly AbilityGroup[] = [
  {
    id: 'perception',
    image: '/why-cube/observation.webp',
    imageAlt: ['眼睛与流动轨迹组成的观察力主题插画', 'Editorial illustration of an eye and flowing paths representing perception'],
    eyebrow: ['第一组：看见', 'Group one: Perceive'],
    title: ['先看懂眼前发生了什么', 'Learn to see what is really happening'],
    intro: [
      '魔方的第一课不是转得快，而是看得准。孩子需要辨认颜色、位置、方向与变化，把纷杂的信息整理成可以行动的线索。',
      'The first lesson is not speed but accurate perception: noticing colour, position, orientation and change, then turning visual noise into useful clues.',
    ],
    abilities: [
      {
        id: 'observation',
        tone: 'info',
        title: ['观察与识别', 'Observation and recognition'],
        summary: ['不再总说“我没看见”，学会看清条件再动手', 'Move from seeing colours to reading position, orientation and relationships'],
        paragraphs: [
          [
            '作业里漏看一个条件、读题读到一半就动笔、东西明明在眼前却总说“没找到”，很多家长真正着急的不是孩子不会，而是他还没有养成看完整、看准确的习惯。魔方恰好把这个问题放大：只看见颜色远远不够，还要看它在哪一层、朝哪个方向、旁边是谁。漏掉一条信息，下一步马上就会走错，孩子不容易再用“我都会，就是粗心”一带而过。',
            'At first a learner sees a blur of colour. With practice, they distinguish fixed centres, two-colour edges and three-colour corners. The eye stops merely asking where red is and begins asking which way a piece faces, what it touches and where a turn will carry it. Observation becomes an active search for evidence.',
          ],
          [
            '课堂不会替孩子把目标块指出来，而是带他形成一套顺序：先扫一圈，再确认中心色；先看正面，再检查侧面和底层；找到以后还要说出位置与方向。老师会故意放入几个很像的情况，让孩子比较“到底差在哪”，答错时也不急着公布答案，而是请他重新核对遗漏的线索。看、说、再转，每一步都有结果可以马上验证，观察不再是一句空泛要求，而是一套能反复练的动作。',
            'During a solve, the same pattern returns in different locations and orientations. Learners separate look-alike cases, identify defining features and connect the current state to a known response. Later they scan broadly before focusing on the few clues that matter. This whole-to-detail strategy is useful well beyond cubing, from diagrams and geometry to experiments and everyday organisation.',
          ],
          [
            '您会看到的变化很具体：起初老师要说“再看看另一面”，后来孩子会自己转动视角核对；起初出错只会说“不知道”，后来能指出“我刚才漏看了这个棱块的方向”。课程记录的也不是一句“观察力变好了”，而是提示次数是否减少、独立找块是否更快、能否说出判断依据。我们不把魔方说成提高智商的捷径，但会让孩子在一次次看清再行动中，真正积累对抗粗心的经验。',
            'For parents, this is best described as visible, repeatable observation practice rather than a vague promise of higher intelligence. Progress is easy to witness: a child moves from needing a piece pointed out to finding it independently, from ignoring hidden faces to checking them, and from being confused by an error to naming the missed clue. Each observation is tested immediately by the next move.',
          ],
        ],
      },
      {
        id: 'spatial-imagination',
        tone: 'success',
        title: ['空间想象', 'Spatial imagination'],
        summary: ['遇到立体图形不再只靠猜，先在脑中转一遍', 'Mentally preview how an object will move before touching it'],
        paragraphs: [
          [
            '有些孩子一碰到立体图、展开图、左右前后换视角就容易乱：图一转方向，刚才会的题好像又不会了；拼装玩具时反复试错，也说不清零件应该朝哪边。家长往往以为这是“没有空间天赋”，其实孩子更缺的是把脑中的猜想拿出来验证的机会。魔方能握在手里、能从六个面观察，同一个块换一个角度就呈现不同位置，正好把抽象的方向关系变成看得见的变化。',
            'A cube is a three-dimensional model held in the hands. Turning a layer is not simply swapping colours; an entire ring of pieces rotates around an axis. Learners connect front and back, top and bottom, and discover that the same location looks different from another viewpoint. Abstract spatial relationships become tangible, movable and immediately testable.',
          ],
          [
            '课堂会先让孩子少转、慢想。老师指着一个目标块问：“这一层转过去，它会到上面还是侧面？”孩子先说预测，再用页面里的模拟魔方转一步核对；熟练后，难度会从预想一步增加到两三步，还会加入“怎样绕过去又不破坏已经完成的部分”。答错并不丢分，反而会把预测与真实结果放在一起比较。这样练的不是死背某个角度，而是在脑中逐渐搭出一个可以旋转的立体模型。',
            'Once learners move beyond imitation, they begin predicting outcomes before acting: will this turn send the target upward or sideways, and which route preserves finished work? A teacher can pause on a state, ask the learner to imagine one turn, then verify it in the simulator. Spatial imagery is treated as a trainable internal model built through many short, correctable attempts, not an inborn gift.',
          ],
          [
            '您最先看到的，通常不是数学分数突然变化，而是孩子开始愿意先想一下：拿起魔方不再毫无目的地乱转，换个方向也能认出同一个结构，做错后知道回到哪一步重新判断。课堂可以保留他从“必须跟着老师转”到“能先口述再验证”的过程，让进步有迹可循。魔方不能代替几何课，也不承诺所谓“开发右脑”，但它提供了高频、低压力的空间练习，让原本容易发怵的孩子有一个能摸、能试、能成功的入口。',
            'This value is easy to explain through real situations: assembly, solid drawing, map reading and understanding orientation all require connecting viewpoints. Cubing cannot replace mathematics or guarantee higher grades, but it offers frequent, inexpensive spatial practice. Every prediction meets reality within seconds, making the benefit more credible and demonstrable than vague claims about developing one side of the brain.',
          ],
        ],
      },
      {
        id: 'pattern-recognition',
        tone: 'accent',
        title: ['模式识别', 'Pattern recognition'],
        summary: ['不再换个样子就不会，学会看出同一类问题', 'Find the structure that determines a method amid many variations'],
        paragraphs: [
          [
            '不少家长都见过这样的情况：例题会做，数字一换、图形一转、题目换一种说法，孩子就又问“这道怎么做”。这往往不是记性差，而是他记住了答案长什么样，却没有抓住决定方法的特征。魔方每天呈现的颜色和位置都不同，如果只背一张图根本走不下去。孩子必须慢慢发现：外表虽然变了，但某些块之间的关系没有变，这些共同点才决定接下来用哪种方法。',
            'A cube appears to offer endless disorder, yet learners do not invent a method for every state. Beginner methods organise situations into crosses, corners, edges and last-layer patterns; advanced methods group superficially different cases by structure. Colours and viewpoints may change while key relationships stay constant. Recognising those invariants is the move from memorising one picture to understanding a class of problems.',
          ],
          [
            '老师不会把几十种情况一股脑塞给孩子背，而会把相似局面放在一起，让他自己找“相同”和“不同”。为什么这两个都属于同一类？哪个角块方向一变，方法就要跟着变？孩子先圈出关键特征，再用自己的话说明分类依据，最后才选择公式。遇到认错的情况，重点也不是多抄几遍，而是找出刚才被什么表面现象误导。反复比较之后，他会从“这张图我见过”走向“我知道它为什么属于这一类”。',
            'Pattern recognition is exercised whenever a learner asks which known case resembles the current one. They identify features, classify the state and notice distinctions between near matches. Good teaching does not present dozens of isolated pictures; it helps learners compare, group and state the reason for a choice. Explaining why a case belongs to a family often demonstrates deeper understanding than a correct move alone.',
          ],
          [
            '变化会体现在孩子越来越少等答案。刚开始，他需要老师直接说“用这个公式”；过一段时间，只要提醒“看看角块朝向”；再后来，他能独立判断，还能解释为什么不是另一个相似情况。课程可用分类练习、提示次数和孩子自己的讲解留下过程记录，家长看到的是知识如何从零散的一张张图，变成有联系的一组方法。我们不会把一次认对夸成天赋飞跃，但会让您看见孩子正在摆脱“题型一变就不会”的被动。',
            'Parents can see this growth in the learner’s declining need for prompts: first the teacher names the algorithm, then merely points to a feature, and eventually the learner identifies and describes the case independently. Early classification records, accuracy and reflection notes can form a portfolio showing how scattered memories became an organised knowledge network. The honest selling point is that visible analytical process, not a claim of universal talent gains.',
          ],
        ],
      },
      {
        id: 'hand-eye-coordination',
        tone: 'warning',
        title: ['手眼协调', 'Hand-eye coordination'],
        summary: ['告别手忙脚乱，让眼睛看到的能被双手稳稳做出来', 'Coordinate vision, both hands and rhythm into one continuous flow'],
        paragraphs: [
          [
            '有的孩子脑子明白，手上却总是慢半拍：写字容易碰倒东西，做精细动作很着急，玩魔方时更是看见了目标却转错层，越想快越容易卡住。家长提醒“慢一点”常常只管几秒，因为孩子并不知道该慢在哪里、哪只手该做什么。魔方把视线、双手和节奏同时放进一个明确任务里，任何没对齐、拿反或抢快都会立刻出现在结果上，比单纯要求“手巧一点”更容易找到具体问题。',
            'While solving, the eyes search for the next target as both hands hold, turn and reorient the puzzle. Beginners often see the right move before their hands can perform it, lose fluency on the opposite side, or rush before layers align. Slow, accurate practice builds a connection between visual cues and action: a position begins to suggest which hand and finger can execute efficiently.',
          ],
          [
            '课堂先练“稳”，不会一上来催速度。老师把一段动作拆成两三拍，明确哪只手握住、哪根手指拨动、转完怎样归位；孩子跟着节奏慢做，再对照页面里的模拟魔方查看每一步。等到动作完整、层面到位，才逐渐减少停顿。左右手不平衡时，会单独安排短练习，而不是让强势手一直代替。真正顺畅以后，眼睛可以提前寻找下一组目标，双手则不用慌张地追着视线跑。',
            'Coordination is not the same as chasing raw speed. Effective practice first demands complete turns, aligned layers and clear roles for each hand, then gradually removes pauses. A teacher can divide a sequence into beats or slow the shared `/sim` demonstration so learners see where pieces land. With fluency, the eyes can search ahead while the hands finish the current action in a stable rhythm.',
          ],
          [
            '您会先从小地方看出变化：握魔方不再僵硬，掉落和卡层变少，原来靠整个手臂甩动，后来能用更轻、更短的手指动作完成；一长串步骤做下来，也不容易做到一半散掉。课堂会关注完整动作、错误次数和连续完成情况，而不只盯最快时间。它不是医疗训练，也不能替代专业干预，但对于需要更多精细动作和双手配合机会的孩子，这是一件目标明确、反馈及时、而且他愿意主动拿起来反复练的工具。',
            'Parents notice small but meaningful changes: a relaxed grip, fewer drops, economical finger turns instead of large arm motions, and cleaner execution over longer sequences. This is practice in fine movement and bilateral coordination, not a medical therapy. Its strength is a clear goal, immediate feedback and abundant repetition that children often choose voluntarily, with progress visible in completion time and error rate.',
          ],
        ],
      },
    ],
  },
  {
    id: 'reasoning',
    image: '/why-cube/spatial-planning.webp',
    imageAlt: ['透明路径与方向弧线组成的规划主题插画', 'Editorial illustration of translucent paths and directional arcs representing planning'],
    eyebrow: ['第二组：想清楚', 'Group two: Reason'],
    title: ['把大问题拆成可以完成的下一步', 'Break a large problem into a workable next step'],
    intro: [
      '还原不是一次猜中答案，而是理解条件、选择目标、安排顺序，再用规则把局面逐步推进。',
      'A solve is not one lucky answer. It is a sequence of reading conditions, choosing goals, ordering work and applying rules.',
    ],
    abilities: [
      {
        id: 'logical-reasoning',
        tone: 'accent',
        title: ['逻辑推理', 'Logical reasoning'],
        summary: ['少一点蒙和猜，学会说清楚“我为什么这样做”', 'Use current conditions to eliminate wrong choices and justify the next move'],
        paragraphs: [
          [
            '孩子一遇到不会的题就等答案，或者凭感觉选一个，问他“为什么”只说“老师就是这么讲的”，这是很多家长比做错本身更担心的地方。魔方没有靠运气蒙过去的空间：目标块在哪里、方向对不对、已经完成的部分能不能动，每一步都有前提。看错条件或理由不成立，几秒后就会在结果上暴露出来。它让孩子明白，做出选择之前要有依据，做完以后还要检查依据是否经得起结果验证。',
            'Every move has conditions: where the target sits, how it is oriented, whether solved work may move temporarily and how it will be restored. A learner cannot rely on “looks close enough”; observations must connect to rules. Even beginner methods contain compact reasoning chains: if the piece appears here, move it aside; because the lower layer must be preserved, insert from the other side; then verify the result.',
          ],
          [
            '课堂上，老师不会只看孩子最后有没有还原，而会在关键处追问：“你看到了什么？为什么选这一步？如果从另一边做会怎样？”孩子先把理由说出来，再动手验证。遇到错误时，也沿着这条链往回查：是条件看错了、规则记混了，还是手上转反了。老师用问题把答案一点点问出来，而不是抢在孩子前面修好。久而久之，他练熟的是“观察条件、排除选项、说明理由、核对结果”这一整套过程。',
            'Good instruction asks why a move was chosen, not merely whether the cube was solved. Explanation reveals understanding versus lucky recall. Errors can be traced along the same chain: was the condition misread, the rule misremembered or the direction executed incorrectly? Failure becomes diagnostic information, and the habit becomes justify, act and verify.',
          ],
          [
            '您会听见孩子的回答发生变化：从“我不知道，反正就这么转”，到“因为这个棱块在右边，所以要先移开，再从另一侧放进去”。即使最后做错，他也能说清楚自己在哪个判断上出了问题。这样的进步比一张满分练习更能说明他是否真的理解。我们不会承诺学会魔方就能自动解决所有学科难题，但会持续让孩子把想法说出来、用结果验证，再把这种有依据的思考习惯带回日常学习。',
            'A persuasive demonstration is a real dialogue: the teacher does not reveal the answer but asks questions that help the learner eliminate options, explain the choice and complete the step. That visible reasoning is stronger than a sweeping promise of general improvement. Transfer is not automatic; it grows when instruction deliberately includes explanation, comparison and reflection. The cube supplies a fast-feedback practice ground with adjustable difficulty.',
          ],
        ],
      },
      {
        id: 'task-decomposition',
        tone: 'success',
        title: ['任务拆解', 'Task decomposition'],
        summary: ['面对一大堆任务不再先说“我不会”，知道从哪一步开始', 'Turn “solve the whole cube” into clear, checkable sub-goals'],
        paragraphs: [
          [
            '作业一多就拖着不开始、房间一乱就说“收不完”、碰到综合题还没看清就先喊难，背后常常不是懒，而是孩子只看见一个巨大的终点，找不到第一步。彻底打乱的魔方也会带来同样的压迫感：六个面全是乱的，初学者很容易觉得根本不可能。好处是，它能把“无从下手”变成一个可以现场解决的问题，让孩子亲手体会：大任务并不需要一口气完成，先把下一小步定义清楚，混乱就会开始减少。',
            'A fully scrambled cube can feel impossible. A beginner method transforms it into stages such as a cross, first layer, middle layer and last layer, then into finding a piece, orienting it, inserting it and checking the result. Learners experience a powerful idea: a complex problem need not be solved all at once. Define a small achievable next step and the disorder begins to shrink.',
          ],
          [
            '课堂会把还原拆成十字、第一层、第二层和最后一层，再把每一层拆成找块、对色、放入、检查。孩子每完成一个小阶段就停一下，自己说“我已经完成什么、现在缺什么、下一步只做哪件事”。老师还会故意把目标说得过大，请他重新拆小，直到这一步能在几分钟内开始和检查。随着熟练度提高，提示会慢慢撤掉，由孩子自己画出任务路线，而不是永远照着老师的清单机械执行。',
            'Decomposition also means understanding dependencies. Do not rush to the last layer before the foundation is ready; if a sub-goal would destroy completed work, first create the right conditions. Learners can pause at each milestone to state what is done, what remains and why the next step follows, or record stage times. The lesson is not blind compliance but milestone-based management of a sustained task.',
          ],
          [
            '最明显的变化，是孩子面对困难时说的话变了。第一节课他可能只会把魔方推开说“我不会”；几节课后，他能告诉您：“十字已经好了，我现在只找这一层的角块。”这说明他脑中已经有了问题地图。家长也会拿到清楚的阶段记录，知道孩子卡在理解、寻找还是执行，而不是只看最终有没有完成。魔方不会替他自动写完作业，但“先别急着全部做完，告诉我下一小步是什么”会成为全家都能使用的一种方法。',
            'This benefit is easy to make visible. In lesson one a child may only say, “I can’t do it.” After several lessons they can say, “The cross is complete; I’m looking for this layer’s corner.” That language shows a mental map of the problem. Families can reuse the approach in homework or projects by agreeing on the next small goal. The cube is a vehicle for practising decomposition, not magic that completes other tasks.',
          ],
        ],
      },
      {
        id: 'planning',
        tone: 'info',
        title: ['规划与路线选择', 'Planning and route selection'],
        summary: ['改掉想到哪做到哪，开始顾到眼前一步和后面几步', 'Compare routes and balance the immediate goal with later cost'],
        paragraphs: [
          [
            '有些孩子不是不会，而是一想到什么就马上做什么：作业先挑顺眼的，做到一半才发现材料没准备；魔方看见一个块就急着放，结果把刚完成的一面又打乱。家长反复提醒“先想清楚”却很难落到动作上。魔方里的每一个选择都有代价，同一个目标可以从左边走，也可以从右边走；眼前看似最快的办法，可能让后面多出很多步骤。孩子需要第一次真正停下来，比较路线，而不是抓住第一个答案就冲。',
            'At first, one reliable method is enough. With fluency, the same goal can often be reached from different directions and in different orders. The question shifts from whether a move works to which route fits best: fewer turns, better hand position, more preserved work or a clearer view of what follows. Planning begins when the learner compares alternatives instead of accepting the first workable answer.',
          ],
          [
            '训练会从很小的选择开始：两个目标块先做哪一个？同一块从两边都能放进去，哪条路更顺？孩子先选并说理由，再分别尝试，记录动作数、停顿和是否破坏已完成部分。老师不会要求一开始就找到最优解，而是让他看见不同选择带来的后果。有时多做一个准备动作，后面反而更连续；有时少转两步，却因为看不见下一个目标而停得更久。规划因此不再是大道理，而是手上能感到的差别。',
            'Comparison can begin with tiny choices: select which of two targets to solve first and explain why, or test two routes while recording moves, pauses and errors. Learners discover that the fastest local choice is not always the fastest overall; one setup move may make everything after it flow. Planning becomes physically perceptible through pauses, reversals and quality rather than remaining an abstract slogan.',
          ],
          [
            '您会看到孩子从“老师下一步转哪里”逐渐走到“我有两个办法，我选这个，因为不会破坏下面”。训练记录能显示无效转动有没有减少、动手前是否会停一下、能不能说出两个方案的优缺点。更重要的是，他会开始接受“可行”不等于“合适”，也愿意为后面的顺畅多做一点准备。我们不把它夸成一门课就能变成生活规划高手，但会给孩子大量安全的小选择，让先想后做真正成为一种体验。',
            'A careful promise is “practice making choices under clear rules,” not that cubing automatically creates a master life planner. A course can progressively open the decision space: follow a route, choose between two, then design and defend one. Records can show fewer wasted turns, better preparation and clearer explanation of trade-offs. These are concrete, observable signs of developing planning habits.',
          ],
        ],
      },
      {
        id: 'algorithmic-thinking',
        tone: 'warning',
        title: ['算法思维', 'Algorithmic thinking'],
        summary: ['不再只背口令，能看懂步骤为何有效、错了该查哪里', 'Understand how a repeatable rule transforms a starting state into a target state'],
        paragraphs: [
          [
            '孩子背课文、背公式时似乎很快，真正使用却经常漏一步、换个条件就不会，家长最怕的是“背了很多，脑子里没有关系”。魔方公式也有字母和顺序，但它不会纵容含糊：少一步、多一步、方向反了，结果都会不同；起始状态相同、步骤正确，结果又能稳定重现。孩子能亲手看到，一串规则不是口令，而是把当前状态一步步变成目标状态的工具，顺序和条件都有明确作用。',
            'A cube algorithm is an explicit, finite and order-sensitive sequence. Omit, repeat or reverse a step and the outcome changes; apply it under the same conditions and it produces a stable effect. Learners encounter input state, sequence, repeatability, local goals and verification. Without writing code, they execute a small program by hand and observe how it transforms a system.',
          ],
          [
            '课堂当然会记公式，但不会停在重复念字母。老师会问：这段动作主要移动哪些块？哪些位置最后会回来？为什么必须从这个角度开始？还会故意漏掉一步或调换顺序，请孩子像找程序错误一样定位问题。长公式会先按节奏分组，再给每一组标出作用；熟练以后，孩子看到公式名就知道它解决什么，而不是只记得一串发音。这样既保留记忆训练，也把条件、流程、重复和检查串成一套可以理解的结构。',
            'Deeper study goes beyond letters. Learners can inspect which pieces an algorithm moves, which positions return, why a starting angle matters, or debug a sequence with one missing step. They meet repetition, inverse operations, non-commuting order and the idea of packaging a long process as a reusable module. An algorithm name becomes a tool with a purpose, not a meaningless chant.',
          ],
          [
            '您会发现，孩子出错后不再立刻把整套公式重背一遍，而是会问：“起始位置对吗？我漏了哪一组？方向是不是反了？”他也能把一段复杂动作拆开讲给您听，说明每部分在做什么。这种表现和编程里的状态、顺序、重复、调试很接近，是进入抽象思维的一个好入口。它不等于学会编程，更不保证将来一定擅长数学，但能让孩子先用手摸到规则如何运作，降低他面对流程图和代码时的陌生感。',
            'This is a natural bridge toward mathematics and programming, but not a claim that cubing equals coding. It gives children a concrete experience of rules, state and debugging: inspect inputs, order and execution when the result is wrong; compare length and scope when seeking efficiency. For learners new to programming, that tangible experience can make later ideas such as flow, repetition and functions feel less foreign.',
          ],
        ],
      },
    ],
  },
  {
    id: 'execution',
    image: '/why-cube/memory-execution.webp',
    imageAlt: ['发光节点、节奏线与双手组成的记忆执行主题插画', 'Editorial illustration of glowing nodes, rhythm lines and hands representing memory and execution'],
    eyebrow: ['第三组：做得稳', 'Group three: Execute'],
    title: ['把知道的方法，变成稳定的表现', 'Turn knowledge into reliable performance'],
    intro: [
      '知道答案只是开始。还原要求记住当前目标、提前寻找下一步，并在压力下保持准确和节奏。',
      'Knowing the method is only the beginning. Solving means holding a goal in mind, looking ahead and staying accurate under pressure.',
    ],
    abilities: [
      {
        id: 'memory-strategy',
        tone: 'success',
        title: ['记忆策略', 'Memory strategies'],
        summary: ['解决“课堂会、回家忘”，让孩子找到适合自己的记法', 'Organise memory through meaning, grouping and cues instead of repetition alone'],
        paragraphs: [
          [
            '“上课明明会了，第二天怎么又忘了？”这是家长最容易怀疑孩子不认真、甚至怀疑课程有没有效果的时刻。很多时候，孩子只是靠短时间重复把动作塞进了脑子，没有建立能把它再找出来的线索。魔方公式一长，十几个字母挤在一起，硬背很容易漏；越被催着多背几遍，越可能只记住当下的手感，回家换个环境、隔一天，就不知道从哪里开始。',
            'Cubing requires memory, but efficient memory is not indiscriminate repetition. Learners split a long sequence into short phrases, group moves by hand rhythm, connect appearance to effect and use a starting grip or keyword as a retrieval cue. A dozen isolated symbols become a few meaningful action units, illustrating the difference between strategic memory and simply repeating more.',
          ],
          [
            '课堂会把长公式切成两三步的小节，用手部节奏形成组块，再把图案、动作效果和起手姿势连起来。容易混淆的两套公式并排比较，隔一天、隔一周再安排提取，而不是只在同一节课里做到十遍。忘记时，老师也不立刻完整示范，而是先给一个关键词、一张图或第一个动作，让孩子自己把后面找回来。慢慢地，他会知道自己总忘在哪一段，也会主动选择分组、节拍、画图或间隔复习。',
            'Different material calls for different methods: diagrams for position, phrasing for sequence, side-by-side comparison for confusable algorithms and spaced review for content not used often. When learners can say where recall fails and how they will change the cue, they begin managing their own learning. The deeper gain is not the formula itself but discovering ways to encode, retrieve and revisit knowledge.',
          ],
          [
            '您看到的不会只是“今天课堂背对了”，而是首次学习、次日复习和一周后还能否独立完成的记录。孩子从一忘就等答案，变成会说“我先想起第一组”“这一段和另一套正好相反”，才是真正学会了记忆。课程也会让家长知道哪些内容已经稳定、哪些需要回顾，减少在家盲目加量。我们不承诺魔方能提高所有记忆力，但会教孩子亲自试出一套可复用的记忆方法，让“多背几遍”变成“怎样才记得住”。',
            'Avoid claims that cubing improves every kind of memory or unsupported percentages. Better evidence is the learner’s actual use of strategies: chunking a new sequence, retrieving it days later and reconstructing logic after forgetting instead of immediately asking for the answer. Records from first learning, next-day review and one-week review show memory becoming stable, a stronger story than one correct classroom performance.',
          ],
        ],
      },
      {
        id: 'lookahead',
        tone: 'info',
        title: ['预判与前瞻', 'Prediction and lookahead'],
        summary: ['少一点做完再发呆，学会边完成、边准备下一步', 'Search for the next target while finishing the current action'],
        paragraphs: [
          [
            '很多孩子做事情总像“一格一格”地走：写完一道题就停下来等提醒，收好一件东西又忘了下一件，魔方里则是做完一段公式便整个人停住，重新从六个面开始找。家长看着会着急，忍不住一路报下一步，结果孩子更习惯等指令。前瞻不是要求他同时想很多，而是在当前动作已经熟悉的前提下，留出一点注意力去找接下来要用的线索，让任务之间不再每次都断开。',
            'Beginners often finish, stop and search again. With fluency, they track another piece before the current action ends, predict its landing point and prepare the next start. Lookahead means holding current execution and a future cue together without letting anticipation corrupt accuracy. It is an expanding attentional window built on a reliable present step.',
          ],
          [
            '训练时反而会先把手速放慢。老师只给一个简单任务：“做这组动作时，眼睛一直跟着这个棱块”；或者在页面里的模拟魔方停下前，让孩子指出它最终会出现在哪里。当前动作还不稳，就只练当前，不强塞下一步；熟练以后，再从追踪一个目标增加到提前选择起手方向。孩子逐渐发现，流畅不是每一下都拼命快，而是眼睛没有丢目标，手上做完这一组时，脑中已经知道下一组从哪里开始。',
            'Lookahead training often slows the hands to remove aimless pauses. A learner may track just one target during a sequence or predict where it will appear before a `/sim` animation stops. The eyes learn continuity before the hands accelerate. Fluency comes less from frantic movement than from fewer searches and reversals, a pattern with parallels in reading, sport and music.',
          ],
          [
            '前后录像会比单个成绩更说明问题：早期孩子每做完一步都停下来四处翻找，后来即使手速没有快很多，整次还原也明显更连贯、更从容。课堂可以记录最长停顿、无目标转动和连续完成的组数，让您看见“会为下一步做准备”正在形成。我们不会为了漂亮秒数过早催快，因为前瞻必须建立在当前动作准确的基础上；对容易慌的孩子来说，先把停顿变少，比把手转得更快更重要。',
            'The change is easy to show in before-and-after video. Even if raw turning speed barely changes, reduced pauses make later solves calmer and faster. A course can observe longest pause, purposeless turns or uninterrupted sequences rather than only final time. “Learning to prepare for what comes next” is a credible message, with the important caveat that lookahead rests on accuracy; rushing too early teaches panic and guessing.',
          ],
        ],
      },
      {
        id: 'decision-speed',
        tone: 'accent',
        title: ['判断速度', 'Decision speed'],
        summary: ['减少会做却迟迟不敢下手，在熟悉问题前更果断', 'Make recognition and choice fast and reliable in familiar situations'],
        paragraphs: [
          [
            '有些孩子并不是不会，而是每次都要确认很多遍才敢开始：选择题在两个答案间来回改，老师一走近就怀疑自己，魔方里明明见过的情况也盯很久。家长催“快一点、果断一点”往往只会增加压力。真正的判断速度不是性格变急，也不是靠猜，而是把熟悉问题的关键特征看清之后，能从少数方法里迅速选出合适的一种，把注意力留给真正陌生和困难的部分。',
            'Speed does not come only from hands. Much time is spent perceiving the state, classifying it, retrieving a method and choosing orientation. Repeated exposure turns a deliberate checklist into rapid recognition: defining features narrow the choice to a suitable response. This is not blind reflex but fluency built on many correct classifications, freeing attention for harder problems.',
          ],
          [
            '课堂把“快”和“准”放在一起练。新情况先不限时间，让孩子把判断依据讲清楚；正确率稳定以后，才短暂展示图案，要求先说类别再动手。成组练习会同时记录反应时间和误判，最容易混淆的两类则单独拿出来比较。只追数量会把孩子练成猜答案，永远不计时又看不出知识是否真正熟练，所以老师会根据每个人的准确率逐步缩短时间，让果断来自理解和重复，而不是来自催促。',
            'Training must record both speed and accuracy. A teacher can briefly show a state, ask the learner to name it before moving, or run grouped recognition drills with errors marked. Counting only volume rewards guessing; never timing hides weak retrieval. A sound progression begins with unlimited explanation, then shortens response time after accuracy stabilises while isolating commonly confused cases.',
          ],
          [
            '您会拿到一条很清楚的曲线：最初平均要想多久、正确率多少、最常把哪两类弄混，之后是在保证准确的情况下变快，还是只是更敢猜。孩子也会亲自感受到，原来迟疑不是改不了的标签，理解以后再经过有方法的练习，选择可以越来越从容。这里练的是魔方情境中的识别与决策，我们不会把它说成所有场景的反应力都被提高；但这种“我可以把不熟练练成熟练”的体验，本身就很有价值。',
            'For parents, the curve is clear: the brain has not suddenly become universally faster; retrieval of understood cube knowledge has become quicker and more reliable. Accuracy, average response time and recurring errors can show the transition from understanding to fluency. The claim remains specific to cube decisions, yet the learner gains a genuine experience of systematic practice turning hesitation into composure.',
          ],
        ],
      },
      {
        id: 'rhythm',
        tone: 'warning',
        title: ['节奏与稳定执行', 'Rhythm and reliable execution'],
        summary: ['不再一着急就乱，找到又快、又稳、还能坚持的节奏', 'Control pace, force and accuracy through continuous action'],
        paragraphs: [
          [
            '家长常说孩子“平时都会，一计时就乱”：开头冲得很快，中间卡住便更急，层没对齐也继续硬转，最后一次失误把前面全抵消。类似的问题也会出现在考试、演奏或比赛中，不是知识突然消失，而是孩子还不会在有压力时调节自己的节奏。魔方的计时很诚实，它让孩子看见，最快的几下不等于完整表现；一次不慌、不返工的稳定完成，往往比冒险冲出的偶然好成绩更接近真实水平。',
            'A stable solve is not maximum speed from start to finish. Learners slow for observation, flow through familiar sequences and pause briefly to adjust grip rather than continue misaligned. They learn to distinguish fluency from hurry and to balance speed, accuracy and continuity. A clean attempt that looks modest can represent more progress than a frantic run full of stops and repairs.',
          ],
          [
            '老师会让孩子先用均匀节拍做一段动作，听每一下是否完整、看每层是否到位，再一点点加速。录像回放时，不笼统说“你太慢”，而是找出节奏断在哪里：是看图案犹豫、换手姿卡住，还是因为前面抢快导致错位。孩子还会练习在失误后先停、对齐、呼吸，再回到自己的速度。这样，“再来一遍”不再是碰运气，而是每一轮只调整一个变量，慢慢建立可重复的稳定表现。',
            'Rhythm can be heard and seen. A teacher may use an even beat while checking layer alignment, then increase it gradually, or review video to locate breaks caused by hesitation, grip or recognition. The learner separates performance into adjustable variables such as force, turning distance, breathing, gaze and interval. Practice becomes purposeful rather than merely another repetition.',
          ],
          [
            '您看到的成绩不只会有一个最好秒数，还会有连续五次的完成率、波动大小和失误后的恢复情况。孩子如果能在紧张时主动放稳、连续几轮都完成，而不是一味追求偶然的纪录，就说明他开始懂得管理表现。课程会庆祝速度，也会同样肯定准确和稳定，避免孩子把“比别人快”当成唯一价值。我们希望他带走的不是对计时器的焦虑，而是知道自己什么时候该快、什么时候该稳，并且有办法把状态找回来。',
            'The useful selling point is reliable output. Instead of one lucky personal best, families can look at five consecutive completions, narrowing variation and the ability to recover a familiar rhythm under nerves. Those measures resemble reliability in competition and real tasks while discouraging reckless attempts for a single number. Timing is precise feedback, but good teaching uses it to understand process rather than make speed the only value.',
          ],
        ],
      },
    ],
  },
  {
    id: 'growth',
    image: '/why-cube/growth-resilience.webp',
    imageAlt: ['学习者沿发光台阶走向山峰的成长主题插画', 'Editorial illustration of a learner climbing luminous steps toward a mountain'],
    eyebrow: ['第四组：长大一点', 'Group four: Grow'],
    title: ['在一次次卡住和突破之间建立韧性', 'Build resilience between setbacks and breakthroughs'],
    intro: [
      '最有价值的时刻常常不是刷新纪录，而是孩子在出错、忘记或停滞以后，仍然知道怎样继续。',
      'The most valuable moment is often not a record, but knowing how to continue after an error, forgotten step or plateau.',
    ],
    abilities: [
      {
        id: 'focus',
        tone: 'success',
        title: ['专注管理', 'Attention management'],
        summary: ['坐不住、容易走神，不妨先让孩子体验一次“我能把自己拉回来”', 'Hold attention on the current goal and deliberately return after distraction'],
        paragraphs: [
          [
            '不少家长最头疼的，不是孩子听不懂，而是刚坐下就摸橡皮、看窗外，一道会做的题也拖很久。反复提醒“专心一点”通常只会让双方更烦，因为孩子听见了要求，却不知道注意力跑掉以后怎么回来。魔方把任务缩到手掌大小：这一刻只看一个目标块，只完成一小段动作，做完马上能看到结果。孩子第一次感受到的不是被催，而是“原来我真的可以把一件事接着做下去”。',
            'A solve requires tracking stage, target and sequence over several minutes. Noise, peers or a timer can make a learner lose their place. The cube offers a bounded attentional task: find one target, complete one sequence and verify it. Focus is not permanent tension; it is repeatedly selecting what matters, ignoring irrelevant stimulation and relocating after a brief lapse.',
          ],
          [
            '课堂不会让孩子硬坐四十分钟。老师会先约定一个很小的目标，例如这一轮只找白色棱块，或者只把一段公式做准；完成后短暂停一下，再增加一点长度。孩子走神时，不贴“注意力差”的标签，而是让他把魔方摆正，说出自己做到哪一步，再从最近的检查点接上。经过几次练习，他会慢慢拥有自己的重启动作：停手、看一眼、说目标、再继续，这比大人不断在旁边提醒更有用。',
            'A teacher can set one intention before an attempt, such as accurate direction, then review where attention broke. Short high-quality practice alternating with clear rest is often better than long mechanical turning. Scope can grow from a step to a stage to a full solve. Small routines such as aligning the puzzle, breathing and restating the goal help bring attention back.',
          ],
          [
            '回到家，您可以观察几个很具体的变化：他能不能少催一次就开始，能不能连续完成一段流程，被打断后能不能自己找到刚才的位置，出错时会不会先检查而不是越急越乱。我们不会把魔方说成解决所有注意力问题的办法，也不会用一次课堂表现给孩子下结论。它更像一个安全、可重复的练习场，让孩子逐渐知道专注不是天生的“有或没有”，而是一套自己能够使用、也能带到作业和生活里的方法。',
            'The honest claim is practice in managing attention, not treatment for attention disorders. Parents can observe whether the learner sustains a longer process, finds their place after interruption and pauses to check instead of turning randomly. A log of attention goals and self-ratings helps children see that focus is not a fixed yes-or-no trait but something they can influence with strategies.',
          ],
        ],
      },
      {
        id: 'patience',
        tone: 'warning',
        title: ['耐心与延迟满足', 'Patience and delayed gratification'],
        summary: ['一遇到不会就想放弃，让孩子学会把“还没成功”留一会儿', 'Continue through a process even when the reward is not immediate'],
        paragraphs: [
          [
            '有些孩子习惯了点一下就有反馈，碰到需要反复练习的事情，很快就说“我不会”“没意思”。家长越劝坚持，他越觉得自己又要被逼着吃苦。魔方不会每分钟都给惊喜：一段公式可能今天记住、明天又忘，最后一步也可能暴露前面的疏忽。但它有一个好处，孩子能清楚看到自己离完成还差多少。“现在没做好”不再等于“我做不到”，只是这一步还需要再熟一点。',
            'Cubing does not reward every minute. An algorithm may remain fragile after many repetitions, an early mistake may appear only near the end, and times may plateau for weeks. Learners practise accepting that “not yet” and “not faster today” do not mean no progress. Correct repetition accumulates before fluency appears, creating a concrete experience of effort now and reward later.',
          ],
          [
            '课堂不会拿“坚持就是胜利”让孩子硬撑。老师会把难点拆短，先练两三个动作，成功后再接下一段；卡得太久就换角度讲、给一次提示，或者休息后再回来。孩子也要学会分辨：这是再试一次就能过，还是该开口求助？从完全不会，到偶尔做对，再到不用提醒也能完成，每一级都有看得见的小成果。耐心因此不是咬牙忍受，而是知道自己下一步能做什么，也愿意给进步一点时间。',
            'Patience is not endless suffering. Good instruction reduces difficulty into a success zone through shorter sequences, partial practice or prompts, then withdraws support. Learners also decide when to continue, rest or ask for help. Sustainable persistence includes pacing and method, not brute endurance. Each transition from impossible to occasional to reliable gives waiting a visible purpose.',
          ],
          [
            '您看到的不只是最后有没有还原，而是孩子面对卡点时的反应在变化：以前立刻把魔方塞给大人，现在愿意先看提示再试；以前错一次就推倒重来，现在能保留已经做对的部分；以前只问“什么时候能学会”，现在会说“我今天先把十字练稳”。我们会记录这些小里程碑，不用“一节课速成”制造焦虑。真正值得带回家的，是孩子发现困难可以分段处理，等待并不是白等，每一次认真尝试都在为下一次成功铺路。',
            'Marketing can replace the promise of instant mastery with staged growth: an independent cross today, two layers next week and a full solve later. Parents see how the learner waits, adjusts and accumulates success, not only the final solve. Recording small milestones and treating errors as material protects interest. The cube gives patience a direction because the destination is clear and the route can be divided.',
          ],
        ],
      },
      {
        id: 'error-diagnosis',
        tone: 'accent',
        title: ['错误诊断', 'Error diagnosis'],
        summary: ['一错就说“全毁了”，练的是先找原因，再决定怎么补救', 'Treat an error as a location to investigate, not the end of the attempt'],
        paragraphs: [
          [
            '孩子写错题、拼坏模型或做不出题时，常会把一句“我错了”说成“我什么都不行”。接下来要么全部擦掉，要么怪题太难，要么等大人直接给答案。魔方很适合把这种模糊的挫败拆开，因为不同错误会留下不同痕迹：方向转反、漏了一步、拿错了朝向，看到的结果都不一样。孩子可以从“全乱了”往回问：上一阶段还对不对？从哪一步开始变化？到底是位置错了，还是方向错了？',
            'A cube preserves traces of mistakes. A reversed turn, omitted move or wrong starting angle produces different symptoms. A beginner may say only that everything is ruined, but guided questions narrow the issue: was the previous stage correct, after which sequence did the state change, and is the piece misplaced or misoriented? Turning a vague sense of failure into a specific question is the start of diagnosis.',
          ],
          [
            '老师会带孩子练“停、看、说、修”：先把手停下来，找出哪些部分仍然正确；再说一遍刚才做了什么，对照 `/sim` 的逐步演示找差异；最后才决定回退一步、只修局部，还是回到检查点。老师不会每次抢过魔方三下修好，因为那只能换来短暂轻松，孩子仍不知道下次怎么办。随着常见错误积累，他会学会根据现象猜原因，再用一次小调整验证自己的判断。',
            'A useful routine is stop, inspect, explain and repair: stop random turns, note what remains correct, restate the recent action, then choose whether to reverse, redo locally or restart from a checkpoint. Video and stepwise `/sim` playback help compare expected and actual states. Over time learners build a catalogue of common symptoms, provided the teacher lets them investigate instead of instantly rescuing the solve.',
          ],
          [
            '家长真正能感受到的变化，不是孩子从此零失误，而是他出错以后不再立刻崩掉。您会听见他开始说“我先检查上一层”“可能是这一步转反了”，也会看到他愿意保留正确部分，只改最可疑的一处。这样的习惯对作业同样有启发：错题不必等于整页失败，先找证据、缩小范围、做一次修正，再看结果有没有改善。我们更看重孩子逐渐会处理错误，而不是替他制造一条看上去永远正确的路。',
            'This makes a strong classroom demonstration: faced with the same error, the learner moves from frustrated rescue-seeking to saying, “I’ll check the previous stage first,” and attempting recovery. The promise is not fewer human mistakes forever but a better relationship with them: preserve what is correct, gather evidence, form a hypothesis, make the smallest repair and verify again. That is both honest and relevant to real learning.',
          ],
        ],
      },
      {
        id: 'reflection',
        tone: 'info',
        title: ['复盘与自我纠正', 'Reflection and self-correction'],
        summary: ['做完就翻篇、同一个坑反复踩，孩子需要学会从过程里找下一步', 'Review the process and choose one useful change for the next attempt'],
        paragraphs: [
          [
            '不少孩子做完练习只看一个结果：对了就赶紧翻篇，错了就说“粗心”，下一次仍在同一个地方摔跤。家长问“为什么错”，得到的常常也是“不知道”。魔方的计时和状态把过程留了下来：九十秒究竟花在找块、想公式，还是手上执行？哪一段很顺，哪一处停了很久？把一次表现拆开以后，孩子会发现成绩不是运气给的，里面有些环节是自己下一轮就能改变的。',
            'A timer gives a result but not an improvement plan. Reflection unpacks a 90-second solve: was time spent searching, recalling or executing; which stage flowed and where was the longest pause; was an error accidental or recurring? Looking only at the final number encourages luck-based explanations. Reviewing process identifies controllable variables and turns the next attempt into a purposeful experiment.',
          ],
          [
            '复盘不会写成长篇检讨，每轮只回答三个问题：哪里做得不错，哪里最卡，下轮只改哪一件事。老师会把“我就是太慢”改成“第二层找棱块时停了三次”，再和孩子商量一个够得着的目标，例如先减少一次停顿。需要时看短录像或阶段计时，但答案不能全由老师给。孩子要亲自判断、亲自尝试，再用下一轮的结果确认这个办法有没有用，复盘才不会变成新的作业负担。',
            'Reflection need not be long. Three questions are enough: what worked, where did I stall and what single thing will I change next time? A teacher turns “I’m slow” into “I paused three times searching for middle-layer edges,” then helps select an actionable goal. Video, splits and error logs provide evidence, but the learner must make the judgement and test the adjustment.',
          ],
          [
            '您收到的反馈也不该只有“今天表现很好”这种空话。更有用的是：孩子这周发现了什么，试过哪种调整，哪一项已经更稳定，下一步准备练什么。前后记录放在一起，能看见他的判断越来越具体，也能避免家长只盯最好成绩。复盘同样要记住做得好的地方，不能每次都变成挑毛病。我们希望孩子学会的是诚实地看自己：不因为一次慢就全盘否定，也不因为一次快就停止思考。',
            'For families and schools, a sustained reflection record is valuable evidence of growth. It shows how a learner questions, tests, fails, revises and verifies, not merely a best time. Brief reports can quote the learner’s own observations and support them with before-and-after video or data. Reflection should also name strengths and progress so that self-evaluation feels like a tool for moving forward rather than external judgement.',
          ],
        ],
      },
    ],
  },
  {
    id: 'connection',
    image: '/why-cube/communication.webp',
    imageAlt: ['学习者围绕发光中心交流的沟通连接主题插画', 'Editorial illustration of learners exchanging ideas around a luminous centre'],
    eyebrow: ['第五组：走出去', 'Group five: Connect'],
    title: ['让个人兴趣成为可以分享的成长故事', 'Turn a personal interest into a story worth sharing'],
    intro: [
      '当孩子开始设目标、帮助同伴、参加活动或讲述自己的方法，魔方就从个人技巧变成了表达、关系与自信的载体。',
      'When learners set goals, help peers, join events and explain their methods, cubing becomes a vehicle for expression, relationships and confidence.',
    ],
    abilities: [
      {
        id: 'goal-management',
        tone: 'accent',
        title: ['目标管理', 'Goal management'],
        summary: ['总说“我想更快”却三天热度，把愿望变成今天真能做的一步', 'Turn a wish into a timed, staged and reviewable practice plan'],
        paragraphs: [
          [
            '孩子说“我要进步”“我要进前三”时往往很认真，可过两天就不知道该练什么。家长安排得太细，孩子觉得是被管；完全交给他，又容易只挑会的玩，遇到难点便绕开。魔方能把愿望变得很具体：“更快”可以先改成稳定独立还原，再改成减少某一阶段的停顿。目标有了期限和证据，孩子才看得见今天这十分钟与远处的愿望有什么关系，而不是只靠一时兴奋。',
            '“I want to be faster” is a wish, not yet a goal. Cubing helps make it concrete: stabilise independent solves this month, reduce pauses in one stage next month, then rehearse full competition attempts. Large aims become weekly frequency, session focus and observable measures. Times and errors leave clear data, so learners can see whether a plan happened, whether it worked and when an unrealistic target needs adjustment.',
          ],
          [
            '课堂里，老师会让孩子自己选一个阶段目标，再一起拆成每周能完成的小任务：练几次、每次关注什么、怎样算完成。想同时学公式、练手速、参加比赛时，还要选出当前最重要的一项，其他愿望先放进“以后再做”的清单。每隔一段时间检查的也不只是秒数，还包括练习有没有发生、难度是否合适、兴趣和压力有没有变化。计划不合适就调整，不把改计划当成失败。',
            'Goal management also means priorities. A learner may want new algorithms, faster hands, competition and another event at once, but time is finite. Choosing one current priority does not abandon the rest. Reviews should examine enjoyment, pressure and practice quality as well as numbers. If a plan creates persistent anxiety or removes needed rest, it should change. Healthy goals serve growth rather than enslave a child to rankings.',
          ],
          [
            '您可以从目标卡和周记录里看到，孩子是不是从“我就想快一点”，变成能说出“这周先把前两层做顺，每次练十五分钟”。即使原定秒数没有达到，他也能解释自己做了什么、哪里估计错了、下一步怎样调整，这仍然是很扎实的成长。我们不会替孩子许诺一个统一成绩，因为练习时间和个体节奏都不同；能把目标定得合适、把行动真正做完，并依据结果修改计划，比一张漂亮但不可执行的表更重要。',
            'For parents, this offers more reliable value than guaranteeing a particular time. A course can help set goals, retain records, review stages and adjust collaboratively. Even when the original number is missed, explaining what was tried, learned and changed remains a complete learning outcome. Anonymised goal cards, weekly logs and reflections show that instruction includes planning and self-management while acknowledging differences in practice time and individual progress.',
          ],
        ],
      },
      {
        id: 'resilience',
        tone: 'warning',
        title: ['抗挫与韧性', 'Resilience'],
        summary: ['一次失误就否定自己，让孩子知道难受过后仍有下一轮', 'Practise restarting in an environment where failure is manageable and explainable'],
        paragraphs: [
          [
            '有的孩子一道题不会就说自己笨，一次比赛失误便再也不想参加；表面像脾气大，背后常是他把一次结果当成了对自己的判决。魔方会带来很多真实的小挫折：公式做到一半忘了、差一点刷新纪录、紧张时转错一步、练了一阵又停在平台期。好在魔方可以重新打乱，下一轮很快就来。孩子能在后果可承受的环境里，反复体验“这次不理想，但事情还没有结束”。',
            'Cubing creates many small setbacks: a sequence forgotten halfway, a missed personal best, nerves in competition or a stubborn plateau. They feel real without carrying severe consequences; the puzzle can be scrambled and another attempt begins soon. This low-risk, repeatable environment lets learners acknowledge disappointment, examine causes and choose whether to continue, rest or change method.',
          ],
          [
            '老师不会在孩子难受时马上说“没关系”“再坚持就好了”。先允许他失望，再一起分清哪些能控制：准备、方法和练习可以改，当天状态、对手表现和一次偶然却不能保证。恢复以后，下一轮不急着要求刷新纪录，可以只求完整做对，或者少一次停顿。孩子经历几次这样的循环，才会慢慢明白，韧性不是没有情绪，也不是必须硬撑，而是情绪过去以后仍知道从哪里重新开始。',
            'Resilience does not require permanent positivity or the slogan that persistence guarantees success. A teacher separates controllable preparation, strategy and practice from uncontrollable daily form, opponents and luck. After a setback, the next goal can be a clean solve or fewer pauses rather than a compulsory record. Repeated cycles teach that disappointment can be handled and one performance does not define ability.',
          ],
          [
            '您可以观察的，不是孩子从此遇事都不哭，而是他恢复得更有办法：愿意说出自己在意什么，能在提示后再试一次，也知道太累时先休息。比赛和排名可以是选择，但不是每个孩子都必须走的终点；内心敏感也不是需要被纠正的缺点。我们会给适度挑战，也保留退一步的空间，让孩子在被尊重的前提下积累真实的小成功。这样的韧性比一句“不能放弃”更温和，也更可能留得久。',
            'Avoid presenting resilience as a scientifically proven universal personality gain from cubing. The honest claim is that the course provides manageable challenges and teaches recovery. Families can observe whether the learner analyses failure, retries with a prompt and knows when to rest. Respect for opting out of excessive competition, appropriate difficulty and genuine small successes are what make long-term interest and resilience more likely.',
          ],
        ],
      },
      {
        id: 'communication',
        tone: 'info',
        title: ['表达与教学', 'Explanation and teaching'],
        summary: ['自己会做却讲不明白，练习站到别人角度把事情说清楚', 'Turn personal skill into language another person can understand and follow'],
        paragraphs: [
          [
            '有些孩子答案做得出来，一让他讲就只会说“反正就是这样”；和同伴合作时，也容易因为对方跟不上而着急。家长担心的往往不是口才，而是孩子能不能把脑子里的东西有条理地交给别人。教魔方正好暴露这个差距：自己会转，不代表别人听得懂。孩子必须先看对方卡在哪里，再把动作拆小，选对方听得懂的词，示范以后还要把魔方还回去，让对方亲手完成。',
            'Solving and teaching are different levels of mastery. To help a peer, a learner must diagnose the difficulty, choose suitable words, divide the action, demonstrate and then let the other person try. They watch expression and outcome to learn whether the explanation worked. Teaching turns implicit feel into explicit language and reveals the depth of the learner’s own understanding.',
          ],
          [
            '课堂会安排两人互教、短步骤讲解或一分钟手部演示。评价的不是声音够不够响，而是目标有没有先说清、动作顺序是否准确、发现对方疑惑后会不会换一种讲法。第一次讲得乱很正常，老师会提醒他先说“我们现在要完成什么”，再示范，最后提示最容易错的地方。不喜欢当众讲话的孩子可以先教一个同伴、画图写步骤，或者录一段不露脸的视频，不必被迫变成活跃的表演者。',
            'Lessons can include peer teaching, step explanations, short demonstrations or one-minute tutorials. The criterion is not showmanship but accuracy, structure and adaptation to feedback. A learner can progress from a tangled explanation to naming the goal, demonstrating and warning about common errors. Quieter children can begin with one peer, illustrated steps or a hands-only video and build safety gradually.',
          ],
          [
            '您会看到一种和秒数不同的进步：孩子愿意等别人操作，不再一着急就抢过魔方；一句没听懂时，他会换例子、换方向，直到对方真的会做。孩子创作的步骤卡、讲解片段和同伴反馈，也能成为很自然的成长记录，公开使用前当然需要家长授权并保护隐私。最重要的不是培养一个会表演的小老师，而是让孩子发现，自己学会的知识可以耐心、准确地帮助别人，这份责任感很难靠背台词得到。',
            'This outcome suits clubs, school showcases and learning portfolios because it combines knowledge, communication and responsibility. Parents see patience, alternative explanations and delight in a peer’s success, not only speed. With permission and privacy protection, a course may show learner-created guides, short explanations and peer feedback. The point is not to make children salespeople but to help them discover that their knowledge can serve another person.',
          ],
        ],
      },
      {
        id: 'confidence-connection',
        tone: 'success',
        title: ['自信与社交连接', 'Confidence and social connection'],
        summary: ['不敢展示、难找共同话题，让一项真本事成为开口的底气', 'Gain confidence from genuine mastery and find a shared language with others'],
        paragraphs: [
          [
            '有些孩子在熟人面前很放松，一到集体里就不敢举手，也不知道怎样加入话题。大人说“你要自信一点”往往没有落脚点，因为孩子需要的不是一句鼓励，而是一件自己确实做得到的事。第一次独立还原很具体：刚才还像无解的混乱，现在是他一步一步完成的。这份成就能拿在手里，也说得出过程，不需要靠别人夸。以后每学会一种方法，都是一次新的“我能做到”。',
            'A first independent solve is a concrete achievement: what looked impossible has been completed through the learner’s own steps. The confidence is backed by something held in the hands, not empty praise. New methods, personal records and helping peers create further mastery experiences. Healthy confidence rests on preparation, practice and understanding rather than being faster than others or winning a rank.',
          ],
          [
            '魔方也给社交一个不尴尬的入口。孩子不必凭空找话题，可以问对方用什么方法、交换一个打乱、一起计时，或者帮新同学完成第一层。课堂会安排轮流分享和合作挑战，让速度不同的孩子都有能贡献的部分，而不是只让最快的人一直站在中间。对于慢热的孩子，从和一个同伴一起完成任务开始就够了；有了共同关注的东西，开口和继续聊下去都会自然很多。',
            'Cubing also supplies a shared language. People of different ages, languages and levels can exchange scrambles, compare methods, time together and encourage one another. A common task can make conversation easier for a shy learner. Classes and clubs create belonging when they value cooperation, respect different paces and rotate opportunities to share; worshipping only the fastest can instead exclude beginners.',
          ],
          [
            '您可能先看到一些很小却真实的变化：孩子愿意在家人面前完整展示一次，主动把魔方带去和同学交流，或者在活动中第一次开口请教陌生伙伴。我们不把比赛当成必选终点，也不要求内向的孩子变成外向；速度更不会成为衡量价值的唯一标准。真正稳的自信，来自他知道自己为什么会、遇到不会还能继续学，并能按照舒服的节奏与别人建立联系。这样的底气不喧闹，却比临时的表扬更站得住。',
            'For parents, the promise is grounded confidence and an accessible community. Evidence may be a home demonstration, first offer to help a classmate, a friendly event or conversation with a new competitor. Competition is optional, and introversion need not be transformed into extroversion. The learner owns a valued skill and can connect at a comfortable pace, supporting a gentler and more durable confidence.',
          ],
        ],
      },
    ],
  },
] as const;

export const ABILITY_COUNT = ABILITY_GROUPS.reduce(
  (total, group) => total + group.abilities.length,
  0,
);
