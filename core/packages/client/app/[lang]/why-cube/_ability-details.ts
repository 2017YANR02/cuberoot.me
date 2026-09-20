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
  {
    id: 'family-life',
    image: '/why-cube/family-life.webp',
    imageAlt: ['孩子在家中向父亲分享学习发现的温暖生活插画', 'Warm editorial illustration of a child sharing a learning discovery with a parent at home'],
    eyebrow: ['第六组：回到生活', 'Group six: Bring it home'],
    title: ['让兴趣进入家庭，而不是只留在课堂', 'Let the interest become part of family life'],
    intro: [
      '有些价值不发生在计时器上，而发生在孩子愿意放下屏幕、主动拿起魔方，以及第一次反过来教会家长的时候。',
      'Some of the most valuable changes happen away from the timer: choosing an offline activity, bringing it into daily routines and even teaching a parent for the first time.',
    ],
    abilities: [
      {
        id: 'screen-free-interest',
        tone: 'success',
        title: ['更容易坚持的非屏幕兴趣', 'A screen-free interest that can last'],
        summary: ['不靠没收手机，也让孩子手边多一件愿意主动做的事', 'Give children something they genuinely choose to do away from a screen'],
        paragraphs: [
          [
            '很多家庭不是不知道屏幕看久了不好，而是关掉以后没有更有吸引力的替代。家长一喊“别玩了”，孩子只觉得喜欢的东西被拿走，接下来仍不知道做什么。魔方的优势不是与手机争夺每一分钟，而是随手可拿、随时可停：等车、课间、作业后的十分钟，都能完成一小段。孩子手边多了一件自己愿意开始的事，减少屏幕才不再完全依靠大人监督和冲突。',
            'Many families know that endless screen time is unhelpful but struggle with what should replace it. When a device is simply removed, a child often experiences only loss and boredom. A cube offers a different kind of option: it can be picked up instantly, paused without penalty and used for a meaningful ten minutes after homework, during a journey or between activities. The goal is not to defeat every screen, but to make offline time genuinely attractive rather than imposed.',
          ],
          [
            '课堂会让练习保持短、清楚、有结束感。孩子可以只完成一个小目标，例如独立做好十字、把一段动作做顺，或者尝试打破自己的连续成功次数。老师也会教他怎样给自己留一道“下次入口”：结束前记下卡点，把魔方摆回约定状态，下次拿起就知道从哪开始。这样，练习不需要先做很大的心理准备，也不会变成又一项必须完成的家庭任务。',
            'Lessons keep practice short, specific and easy to finish. A learner might complete one cross, smooth one short sequence or improve a personal streak rather than face an undefined session. Before stopping, the teacher helps leave a clear entry point for next time by noting the current difficulty or preparing a known state. That small ritual lowers the effort needed to begin again and prevents the hobby from becoming another compulsory assignment managed by adults.',
          ],
          [
            '您可以观察的不是某天少看了多少分钟，而是孩子有没有在没人提醒时主动拿起魔方，能不能玩一会儿后自己停下，以及空闲时除了问“手机在哪”是否有了第二种选择。我们不会把魔方包装成戒除电子产品的工具，线上模拟器和教学视频本身也会合理使用屏幕。真正的变化，是孩子逐渐拥有一种能带在身边、靠双手和思考获得满足的离线兴趣。',
            'The useful evidence is not a dramatic one-day reduction in minutes. Notice whether the child sometimes reaches for the cube without prompting, can stop after a self-chosen session and has a second answer when spare time appears. Cubing is not a cure for device dependence, and good instruction may still use a simulator or a short teaching video. Its value is giving the child a portable offline interest in which satisfaction comes from hands, thought and visible progress.',
          ],
        ],
      },
      {
        id: 'parent-child-interaction',
        tone: 'accent',
        title: ['不围绕作业的亲子互动', 'Parent-child time beyond homework'],
        summary: ['少一点催促和检查，多一个孩子愿意主动分享的话题', 'Create a shared topic where the child can explain instead of being checked'],
        paragraphs: [
          [
            '不少家庭一天里说得最多的是“作业写了吗”“为什么又错了”。家长当然是关心，但孩子听久了，很容易把交流理解成检查和纠正。魔方提供了一个没有学校分数的共同话题：今天遇到什么有趣图案、哪一步终于想通、能不能教爸爸妈妈完成一面。家长不必先会，也不必假装专业；正因为不会，孩子才有机会从一直被指导的人，变成家里真正懂这件事的人。',
            'In many homes, the most frequent conversations are reminders about homework and questions about mistakes. The concern is real, but a child can begin to experience every conversation as inspection. Cubing creates a shared topic without a school mark attached: an interesting pattern, a step finally understood or a challenge to teach a parent one face. The adult does not need prior expertise. Not knowing is precisely what allows the child to become the knowledgeable person in the room for once.',
          ],
          [
            '课堂会帮助孩子把学会的内容整理成能分享的小任务，例如回家只教家长辨认中心块，或者让家长照着自己的口令完成四步。下一次上课再聊：对方哪里没听懂，自己有没有着急抢过来，换了什么说法才成功。家长参与时也不需要陪练和打卡，只要愿意当一次真实的新手，认真听孩子说完，让他感受到自己的知识被需要。',
            'The teacher can turn new knowledge into a small home invitation: explain fixed centres, or guide a parent through four moves using only words. At the next lesson, the child reflects on where the listener became confused, whether impatience led to taking the cube back and which explanation finally worked. Parents do not have to become practice supervisors or maintain another chart. Being a sincere beginner and allowing the child to finish the explanation is enough.',
          ],
          [
            '变化往往出现在很普通的时刻：孩子放学后愿意主动讲一件课堂里的事，吃完饭邀请家长挑战一次，或者在家长失败时不嘲笑，而是耐心再讲一遍。魔方不会自动解决亲子矛盾，但它能创造一些不以批评、成绩和完成任务为中心的相处片段。对忙碌家庭而言，哪怕每周只有十分钟，这种“孩子带着大人一起成功”的体验，也比又一次催促更容易被双方记住。',
            'Progress often appears in ordinary moments: the child volunteers a classroom story, invites a parent to try after dinner or explains again without laughing when the adult fails. A cube cannot resolve every family tension, but it can create encounters that are not organised around criticism, grades or finishing a duty. Even ten minutes a week can matter when the memory is of the child helping an adult succeed, rather than another adult reminding the child what remains unfinished.',
          ],
        ],
      },
      {
        id: 'demonstrable-skill',
        tone: 'info',
        title: ['一项真正拿得出手的本领', 'A skill the child can genuinely demonstrate'],
        summary: ['自信不只靠夸奖，而是“这件事我确实能独立完成”', 'Ground confidence in something the child can complete and explain independently'],
        paragraphs: [
          [
            '孩子听过很多“你很棒”，却未必知道自己究竟棒在哪里。尤其当学校成绩不突出，或擅长的事情还没有被发现时，空泛鼓励很难变成稳定自信。独立还原魔方不一样：开始是人人都看得见的混乱，结束是六面整齐，中间每一步由孩子自己完成。成果可以拿在手里，也经得起当场再做一次，自信因此有了具体证据，而不只依赖别人的评价。',
            'Children often hear that they are wonderful without knowing what the praise refers to. When school results are ordinary or a strength has not yet been discovered, general encouragement rarely becomes durable confidence. An independent solve is concrete: everyone can see the disorder at the start and the six completed faces at the end, with each step performed by the learner. The achievement can be held, repeated and explained, so confidence rests on evidence rather than approval alone.',
          ],
          [
            '课堂会把展示能力也当成需要准备的过程。孩子先练到可以稳定完成，再学会在别人观看、提问或计时时保持自己的节奏；想分享时，可以选择完整还原、演示一个有趣图案，或讲清楚其中一步。老师不会强迫每个人上台，也不把速度当成唯一标准。对不喜欢表演的孩子，录一段手部视频或只给熟悉的人展示，同样是在确认“这是我掌握的本领”。',
            'Lessons treat demonstration as something to prepare rather than a demand for instant performance. The learner first builds a reliable solve, then practises keeping a personal rhythm while another person watches, asks questions or starts a timer. Sharing may mean a full solve, an interesting pattern or one clearly explained step. Nobody has to perform publicly, and speed is not the only standard. A hands-only recording or a demonstration to one trusted person can carry the same sense of genuine mastery.',
          ],
          [
            '您会看到孩子介绍自己时多了一个具体答案，也可能第一次主动说“我来试试”。真正值得肯定的，不只是完成后的掌声，还包括他愿意准备、失误后重新开始，以及能说出自己是怎样学会的。我们不保证每个孩子都会成为舞台中心，更不会用一次展示制造比较。目标是让他拥有一项自己认可、别人也能理解的能力，在需要一点勇气的时刻，手里确实有东西可以支撑自己。',
            'You may notice that the child now has a specific answer when asked about an interest, or volunteers to try something for the first time. The valuable part is not only applause after completion but the willingness to prepare, restart after an error and explain how the skill was learned. Not every child needs to become the centre of a stage. The aim is to own an ability that feels personally real and is understandable to others when a little courage is required.',
          ],
        ],
      },
      {
        id: 'time-awareness',
        tone: 'warning',
        title: ['更具体的时间感', 'A more concrete sense of time'],
        summary: ['把“快一点”和“练一会儿”变成孩子能够理解的具体长度', 'Turn vague phrases such as hurry up and practise a while into visible units'],
        paragraphs: [
          [
            '“快点写”“再练一会儿”“已经很久了”这些话，大人觉得很清楚，孩子听到的却可能只是一种催促。十分钟究竟有多长，一周练三次意味着什么，一次很快和连续稳定有什么区别，他没有足够具体的经验。魔方天然带着可观察的时间单位：一轮还原有开始和结束，一个阶段能单独计时，短短几分钟里发生了什么也容易回想，时间不再只是钟表上的抽象数字。',
            'Phrases such as hurry up, practise for a while and that took too long feel clear to adults but often reach a child only as pressure. Ten minutes, three sessions a week and the difference between one fast attempt and reliable performance can remain abstract. Cubing provides visible units of time: a solve has a definite beginning and end, a stage can be measured separately, and events inside a few minutes are easy to remember. Time becomes an experience rather than only a number on a clock.',
          ],
          [
            '课堂会先让孩子估计一项任务需要多久，再实际计时并比较。练习计划不写“多练”，而写“今天做三轮准确还原”或“用十分钟练第二层，时间到就停”。计时器也不会只用来追最快成绩，还会观察五次结果是否稳定、暂停集中在哪里、为了抢快是否增加了返工。孩子逐渐学会在有限时间里选重点，也知道休息和按时结束是计划的一部分。',
            'In class, learners estimate how long a task will take, measure it and compare the estimate with reality. A plan says three accurate solves or ten minutes on the middle layer, stopping when time is up, rather than simply practise more. The timer is not reserved for personal bests. It also reveals consistency across five attempts, where pauses occur and whether rushing creates rework. Children learn to choose a priority within a limit and to treat rest and a planned finish as part of the plan.',
          ],
          [
            '家长可以留意孩子是否开始更准确地安排自己：知道十分钟能完成多少，开始前能估计，结束时也愿意停；临近活动时，不再把所有希望压在最后一次突击上。秒数下降可能令人开心，但更重要的是他明白时间、质量和精力需要一起分配。魔方不能自动解决拖延，不过它能提供大量小而真实的时间经验，让“管理时间”从大人的命令，慢慢变成孩子自己的判断。',
            'Parents can notice whether planning becomes more realistic: the child knows what fits into ten minutes, makes an estimate before starting and can stop at the chosen end. Preparation for an event may become steadier instead of depending on one last burst. Faster times can be satisfying, but the deeper lesson is that time, quality and energy must be allocated together. Cubing cannot automatically eliminate procrastination, yet it offers many small, truthful experiences from which personal judgement can grow.',
          ],
        ],
      },
      {
        id: 'emotional-transition',
        tone: 'success',
        title: ['一天里的情绪切换', 'A small ritual for changing pace'],
        summary: ['放学后脑子还很乱，先用一段有边界的活动把状态安顿下来', 'Use a bounded hands-on activity to settle between one part of the day and the next'],
        paragraphs: [
          [
            '孩子刚放学、刚结束长时间学习或和同伴闹了不愉快时，马上进入下一项任务并不容易。家长看到的是磨蹭、发脾气，孩子自己也未必说得清为什么静不下来。魔方可以成为一种短暂的过渡：双手有事做，注意力落在眼前的小目标上，几分钟后自然结束。它不是逃避问题，而是在学校、作业、吃饭或睡前之间，给情绪留一个换挡的位置。',
            'After school, a long study period or a disagreement with friends, moving directly into the next demand can be difficult. Adults see delay or irritability while the child may not know how to describe an unsettled state. A cube can provide a brief transition: the hands have a task, attention rests on one visible goal and the activity reaches a natural end after a few minutes. It does not avoid the next responsibility; it creates a gear change between parts of the day.',
          ],
          [
            '课堂会帮助孩子找到适合自己的“安静练法”，例如不开计时，只慢慢完成熟悉步骤；或者给自己三分钟，专注把动作转准，时间到便收好。老师也会提醒他观察身体信号：越转越急、层总对不齐时，可能需要停下来呼吸或休息，而不是继续用力。这样的练习强调可选择、可结束，不能把魔方变成大人要求孩子冷静时必须执行的新命令。',
            'Lessons help each child discover a calmer mode of practice: perhaps completing familiar steps without a timer, or spending three minutes on accurate turns and putting the cube away when time ends. Learners notice bodily signals as well. Increasing force, repeated misalignment and frantic speed may mean it is time to breathe or rest rather than push harder. The routine remains optional and clearly bounded; it should never become another adult command that the child must perform in order to be considered calm.',
          ],
          [
            '您可能看到孩子开始会说“我先转两分钟再写”，并且约定时间后真的能够进入下一件事；也可能在烦躁时主动选择慢一点，而不是把魔方越拧越响。我们不会声称这能治疗焦虑、注意力或情绪问题，专业问题仍需要专业支持。这里更朴素的价值，是孩子手里多了一种了解自己、调整节奏的小办法，而且这个办法不会要求他立刻解释所有感受。',
            'A useful change may be the child saying, let me do two minutes first, and then genuinely moving to the next task at the agreed time. Another is choosing slower turns when frustrated instead of making the puzzle louder and faster. This is not treatment for anxiety, attention or emotional difficulties, which may require professional support. The modest value is an additional way to recognise personal state and adjust pace without having to explain every feeling immediately.',
          ],
        ],
      },
    ],
  },
  {
    id: 'lasting-interest',
    image: '/why-cube/lasting-interest.webp',
    imageAlt: ['不同年龄的人围坐交流兴趣与经验的成长主题插画', 'Editorial illustration of different generations sharing an interest and learning together'],
    eyebrow: ['第七组：走得更远', 'Group seven: Keep growing'],
    title: ['让一颗魔方长成一条自己的兴趣路线', 'Let one cube grow into a personal path of discovery'],
    intro: [
      '入门不必很贵，也没有统一终点。孩子可以选择速度、比赛、教学、收藏或长期休闲，让兴趣按照自己的节奏继续生长。',
      'The entry point is affordable and there is no single finish line. A learner can explore speed, events, teaching, collecting or relaxed lifelong play at a personally sustainable pace.',
    ],
    abilities: [
      {
        id: 'long-term-path',
        tone: 'success',
        title: ['长期可延伸的兴趣', 'An interest with room to grow'],
        summary: ['不是学会一遍就结束，入门之后仍有很多方向可以自己选择', 'Move beyond a first solve into a path shaped by the learner’s own curiosity'],
        paragraphs: [
          [
            '家长给孩子报兴趣课，常担心两件事：太浅，学会一个套路便无事可做；太深，又很快进入昂贵、拥挤的竞赛通道。魔方的好处是入口清楚，后面的路却很多。孩子可以先享受独立还原，再选择练稳定、练速度、研究不同解法、尝试异形魔方，或者把已经会的内容教给别人。每条路都能继续，但没有哪一条必须走，兴趣因此不容易被一个结课证书突然截断。',
            'Parents often worry that an enrichment class will either end after one memorised routine or quickly push the family into an expensive competitive track. Cubing has a clear entry point but many possible continuations. A learner can enjoy a reliable first solve, pursue consistency or speed, compare methods, explore other puzzles or teach what has been learned. Each path remains open, yet none is compulsory, so curiosity does not have to end with one course certificate.',
          ],
          [
            '课堂会在孩子掌握基础以后，安排一次“兴趣路线选择”：回顾他最享受的是解出问题、动作变顺、和同伴交流，还是发现新结构，再据此选择一小段探索。想练速度，就先学会稳定记录；喜欢原理，就拆解公式为什么有效；喜欢分享，就做一张自己的讲解卡。老师提供地图和必要方法，但不会为了续课不断制造“还差一级”的焦虑。阶段结束时，孩子也可以停下来，把魔方保留成偶尔拿起的休闲爱好。',
            'After the foundation is secure, lessons can include a path-selection conversation. Did the learner most enjoy solving a problem, making movement smoother, sharing with peers or discovering structure? A short next exploration follows that answer: reliable records for speed, explanation for theory or a self-made guide for teaching. The teacher supplies a map and useful tools without manufacturing anxiety about an endless ladder. Pausing formal lessons while keeping cubing as an occasional hobby is also a valid outcome.',
          ],
          [
            '您能看到的变化，是孩子开始对自己的兴趣负责：会说清楚下一阶段想试什么，也能承认某条路线暂时不适合。过一段时间，他可能从三阶转向盲拧、趣味花式或比赛，也可能只是周末拿起来放松，这些都不算“半途而废”。长期兴趣的标志不是每天打卡，而是离开老师以后仍知道怎样继续、怎样暂停、怎样重新回来。我们希望留下的是一张能陪他走很久的地图，而不是只能在课程里使用的进度条。',
            'Parents may notice the child taking ownership of interest: naming what to try next, recognising when a route does not fit and returning after a pause without shame. The path might later include blindfold solving, patterns, events or simply a relaxing weekend solve. None of these is an inferior ending. A durable interest is not proved by daily streaks; it is shown when the learner knows how to continue, pause and come back without depending on a teacher to supply the next instruction.',
          ],
        ],
      },
      {
        id: 'healthy-competition',
        tone: 'warning',
        title: ['更健康的竞争观', 'A healthier view of competition'],
        summary: ['看见别人的快，也学会把注意力放回自己的准备和进步', 'Meet comparison without letting one ranking define effort or self-worth'],
        paragraphs: [
          [
            '孩子进入比赛或同伴计时以后，很容易只剩一个问题：“我排第几？”赢了兴奋，输了便觉得之前的练习都没有意义；家长也可能不知不觉把最好成绩当成课程有没有效果的唯一证明。魔方的成绩足够清楚，正适合学习怎样面对比较：同一张排名里，有别人不可控制的发挥，也有自己可以回看的准备、稳定性和临场选择。孩子需要知道，尊重竞争不等于把名次变成对自己的判决。',
            'Once timers and events appear, a child can reduce the whole experience to one question: where did I rank? Winning feels exciting, while losing may seem to erase weeks of practice. Adults can also treat a personal best as the only proof that lessons work. Because cubing results are so visible, they provide a useful setting for learning what comparison can and cannot say. A ranking combines other people’s performance with the learner’s preparation, consistency and decisions; it is information, not a verdict on worth.',
          ],
          [
            '课堂里的友好竞赛会同时设置三种目标：和自己的过去比，完成一项过程任务，再观察同伴值得学习的地方。例如成绩之外，还看能否按流程检查、失误后完成剩余轮次、赛后真诚祝贺对手。复盘时把“他比我快”改成更有用的问题：“他哪一阶段停顿少，我能学什么？”老师也会控制公开排名的频率，不让每次练习都变成淘汰赛，更不会用羞辱或贴标签刺激孩子。',
            'Healthy classroom competition carries several goals at once: improve on one’s own history, complete a process task and notice something useful in a peer. Beyond the time, learners practise checking properly, finishing remaining attempts after an error and congratulating others sincerely. Reflection replaces “they are faster than me” with “where do they pause less, and what can I learn?” Public ranking is used sparingly so that every practice session does not become elimination, and humiliation is never treated as motivation.',
          ],
          [
            '您可以观察孩子在结果出来后的语言：他是否只会说“我不行”，还是能承认失望，同时讲出一件做得不错和一项准备改进的事；看到更快的同伴时，是躲开、贬低，还是愿意请教。我们不会承诺孩子因此一定爱上比赛，选择不参赛同样应被尊重。更重要的是，当生活里出现考试、选拔和输赢，他已经练习过一种较稳的姿态：认真准备、坦然看结果、向优秀的人学习，然后把下一步重新握回自己手里。',
            'Parents can listen to the language after a result. Can the learner acknowledge disappointment while naming one strength and one adjustment, or does the outcome become “I am no good”? When meeting someone faster, can curiosity replace avoidance or contempt? The aim is not to make every child love competition; choosing not to compete deserves respect. The value is rehearsal for tests, selections and other comparisons: prepare seriously, read the result honestly, learn from excellence and regain control of the next step.',
          ],
        ],
      },
      {
        id: 'autonomy',
        tone: 'accent',
        title: ['自主选择与内驱力', 'Choice and internal motivation'],
        summary: ['从“老师让我练”走向“我知道自己为什么想继续”', 'Help the learner choose a direction and understand why the effort matters personally'],
        paragraphs: [
          [
            '很多孩子并不缺课程，缺的是属于自己的选择。时间表被安排得很满，练习也总由大人提醒，久而久之他只在有人检查时行动。魔方有大量可以自己决定的小问题：今天想练准确还是速度，先解决哪个卡点，要不要参加活动，喜欢研究还是展示。选择不是放任，而是让孩子在清楚边界里承担结果。只有当“为什么练”有一部分来自他自己，兴趣才可能离开课堂后继续。',
            'Many children do not lack activities; they lack choices that feel genuinely theirs. Schedules are full and practice begins only when an adult reminds them. Cubing offers many bounded decisions: accuracy or speed today, which difficulty to address first, whether an event is appealing, and whether research or demonstration feels more satisfying. Choice is not the absence of structure. It means taking responsibility inside clear limits, so at least part of the reason for practising belongs to the learner.',
          ],
          [
            '老师会提供少量、真实的选项，而不是问一个看似开放却早有标准答案的问题。孩子可以从两个练习任务里选一个，决定本周记录什么，也能说明今天状态不好，希望把目标调低。选完以后要一起约定时间和完成标准，下次再看这个决定带来了什么。老师会追问理由，但不会用奖励把每个动作都变成交易；外部鼓励可以开始一件事，持续下去仍需要孩子感受到理解、掌握和进步本身的满足。',
            'A teacher offers a small set of real options rather than an apparently open question with a predetermined correct answer. The learner may choose between two tasks, decide what to record this week or lower a target on a difficult day. The decision then receives a time boundary and a completion standard, followed by review of what it produced. Reasons are discussed, but every action is not converted into a reward transaction; lasting effort needs satisfaction from understanding, mastery and progress.',
          ],
          [
            '您可能会发现，提醒次数慢慢减少了，孩子开始自己准备魔方、提出想学的内容，也能在不想练时给出理由并商量替代安排。这不代表他从此永远自律，兴趣有高低起伏很正常。真正的内驱力不是每天都热情，而是在没有奖品和催促时，仍偶尔愿意为了一个自己认同的目标投入；遇到困难时，也知道可以调整方法，而不是只能等别人命令。家长从监督者退到支持者，往往正是孩子开始长出主见的时候。',
            'Parents may see reminders become less frequent as the child prepares the cube independently, requests a topic and can negotiate an alternative when energy is low. This does not mean permanent self-discipline; interest naturally rises and falls. Internal motivation is the occasional willingness to invest without a prize or prompt because a goal feels personally meaningful, along with the ability to adjust a method rather than wait for an order. The adult can gradually move from supervisor to available supporter.',
          ],
        ],
      },
      {
        id: 'universal-language',
        tone: 'info',
        title: ['跨年龄、跨语言的共同话题', 'A shared language across ages and cultures'],
        summary: ['不擅长寒暄也没关系，一颗魔方就能让交流有具体的开始', 'Use a visible shared task to make conversation easier across differences'],
        paragraphs: [
          [
            '有些孩子不是不想交朋友，而是不知道第一句话该说什么；面对年龄不同、语言不同的人，更容易站在一旁。魔方有一个很友好的特点：颜色、动作和完成状态大多看得见，即使词汇有限，也能用示范、手势和一段公式开始交流。一个孩子可以请成年人打乱，也可以向年纪更小的同伴演示；共同注意的对象摆在桌上，彼此不需要先擅长寒暄，关系就有了落脚点。',
            'Some children want connection but do not know how to begin a conversation, especially with people of a different age or language. A cube provides a visible shared object: colours, turns and completed states can be demonstrated even when vocabulary is limited. A child can ask an adult to scramble, show a younger learner a step or compare a short sequence with someone from another country. Attention rests on the task, so social contact does not depend on confident small talk.',
          ],
          [
            '课堂会练习一些真实的交流场景：怎样礼貌借用或归还魔方，怎样用动作配合简短语言提问，怎样在没听懂时请对方再演示一次。孩子也会接触国际通用的基本记号，明白同一个动作可以被不同语言背景的人读懂。老师同时强调边界：先征得同意再碰别人的物品，不评论装备贵不贵，不因为对方慢就替他完成。共同爱好只有建立在尊重上，才会真正缩短距离。',
            'Lessons rehearse practical moments: borrowing and returning a puzzle politely, combining a gesture with a short question, and asking for another demonstration when words are unclear. Learners meet standard notation that can be read across languages, while also practising boundaries: request permission before touching another person’s puzzle, avoid judging equipment by price and do not seize control because someone is slower. A shared interest connects people only when respect travels with it.',
          ],
          [
            '您能看到的可能不是孩子突然变得健谈，而是他在活动里多了一种进入关系的方法：敢把魔方递给第一次见面的人，能向长辈解释一个动作，也愿意耐心看完别人的解法。参加线上或线下交流时，隐私和安全仍需要成年人把关，魔方也不能消除所有社交困难。它提供的是一个低压力的共同话题，让孩子发现自己掌握的知识能够被不同的人理解，而陌生人也可能因为同一种好奇心变成伙伴。',
            'The observable change may not be sudden talkativeness. It may be a new way to enter a relationship: offering the cube to someone new, explaining one move to an older relative or patiently watching another person’s method. Adults must still protect privacy and safety in online or offline communities, and cubing cannot erase every social difficulty. It simply offers a lower-pressure shared topic through which knowledge becomes understandable and unfamiliar people can become partners in curiosity.',
          ],
        ],
      },
      {
        id: 'low-barrier',
        tone: 'success',
        title: ['低门槛、可持续的投入', 'A low-barrier interest families can sustain'],
        summary: ['一颗顺手的魔方就能开始，不必不断升级装备才能继续进步', 'Begin with one usable puzzle and let skill, not constant purchasing, drive progress'],
        paragraphs: [
          [
            '家长选择长期兴趣时，除了孩子喜不喜欢，也会考虑接送、场地、装备和后续花费。有些项目开始不贵，越往后却不断要求升级，家庭很难判断哪些是真需要。魔方相对轻便，一颗转动顺畅、尺寸合适的三阶就能完成长期基础练习，在家、学校或旅行中都能使用。贵的器材可能改善手感，却不会替代观察、方法和练习；孩子不必靠不断购买，才能证明自己认真。',
            'When choosing a lasting activity, families must consider transport, venues, equipment and continuing costs as well as interest. Some hobbies begin cheaply but soon make every stage feel dependent on another upgrade. Cubing is comparatively portable: one comfortable, reliable three-by-three can support a long period of foundational practice at home, school or while travelling. Premium equipment may change feel, but it cannot replace observation, method and practice, nor should purchasing prove commitment.',
          ],
          [
            '课堂会先教孩子照顾现有物品：正确调整、简单清洁、避免暴力拆装，并学会分辨“器材真的妨碍使用”和“我只是想要新的”之间的区别。需要购置时，老师应说明必要条件和预算范围，而不是把指定品牌与学习效果绑定。课程也可以使用共享器材，让孩子在决定参加比赛或尝试其他项目以前先体验。资源有限的家庭不应该因为装备比较，在课堂里被暗示落后。',
            'Instruction can begin with care for what the learner already owns: sensible adjustment, basic cleaning, safe handling and distinguishing a genuine usability problem from the wish for something new. When a purchase is useful, teachers should explain the required features and a budget range rather than bind progress to one brand. Shared equipment can support trial before an event or another puzzle is chosen, and limited family resources should never be treated as evidence of lower commitment.',
          ],
          [
            '您可以把更多注意力放在孩子怎样使用手里的东西，而不是同伴买了什么：他是否能长期保管，是否知道什么时候真的需要更换，也能不能在普通器材上稳定完成。比赛报名、课程和收藏当然仍可能产生费用，但它们都是可选分支，不应被包装成入门后的必然支出。一个可持续的兴趣，应该允许家庭按自己的预算和节奏参与，让成长主要来自孩子积累的能力，而不是购物清单越来越长。',
            'Parents can focus on how the child uses what is already available: caring for it over time, identifying when replacement is genuinely needed and performing reliably without premium gear. Lessons, event entry and collecting may still cost money, but they are optional branches rather than unavoidable consequences of beginning. A sustainable interest leaves room for each family’s budget and pace, so growth is carried mainly by accumulated skill and understanding instead of an expanding shopping list.',
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
