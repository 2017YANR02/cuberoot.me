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
        summary: ['从“看见颜色”进阶到“读懂位置、方向和关系”', 'Move from seeing colours to reading position, orientation and relationships'],
        paragraphs: [
          [
            '刚接触魔方时，孩子往往只看到一团颜色；真正开始学习后，他会逐渐分辨中心块决定哪一面、棱块连接哪两个面、角块属于哪三个方向。这个过程要求眼睛不只停留在“红色在哪里”，还要继续追问“它现在朝向哪里、和谁相邻、下一次转动会把它带到哪里”。观察因此从被动观看，变成带着问题寻找证据。',
            'At first a learner sees a blur of colour. With practice, they distinguish fixed centres, two-colour edges and three-colour corners. The eye stops merely asking where red is and begins asking which way a piece faces, what it touches and where a turn will carry it. Observation becomes an active search for evidence.',
          ],
          [
            '一轮完整还原里，同一种图案会以不同角度、不同位置反复出现。孩子要排除相似但不相同的情况，捕捉关键特征，再把眼前状态对应到已经学过的方法。随着熟练度提高，他还会学会先扫视全局，再把注意力落到真正影响下一步的少数线索上。这种“先整体、后重点”的视觉策略，比漫无目的地盯着看更高效，也更容易迁移到图表阅读、几何图形、实验观察和日常整理中。',
            'During a solve, the same pattern returns in different locations and orientations. Learners separate look-alike cases, identify defining features and connect the current state to a known response. Later they scan broadly before focusing on the few clues that matter. This whole-to-detail strategy is useful well beyond cubing, from diagrams and geometry to experiments and everyday organisation.',
          ],
          [
            '向家长介绍时，可以把它说成一种可见、可反复练习的观察任务，而不是笼统宣称“提升智力”。家长很容易亲眼看到变化：孩子从需要别人指着目标块，到能自己找到它；从漏看反面和底层，到会主动转动视角核对；从做错后不知道原因，到能指出自己刚才看漏了哪一条信息。每一次发现都能立即用下一步动作验证，观察是否准确不靠主观感觉，而有清楚的反馈。',
            'For parents, this is best described as visible, repeatable observation practice rather than a vague promise of higher intelligence. Progress is easy to witness: a child moves from needing a piece pointed out to finding it independently, from ignoring hidden faces to checking them, and from being confused by an error to naming the missed clue. Each observation is tested immediately by the next move.',
          ],
        ],
      },
      {
        id: 'spatial-imagination',
        tone: 'success',
        title: ['空间想象', 'Spatial imagination'],
        summary: ['在动手之前，先在脑中预演物体怎样转动', 'Mentally preview how an object will move before touching it'],
        paragraphs: [
          [
            '魔方是一个可以拿在手里的三维空间模型。转动一层时，眼前不只是几个颜色换了位置，而是整圈零件沿着一个轴发生旋转。孩子需要理解正面、背面、上层、下层之间的对应关系，也要接受“从另一个角度看，同一个位置会呈现不同方向”。这让抽象的空间关系变成能摸、能转、能立刻检验的体验，对刚开始接触立体几何的孩子尤其直观。',
            'A cube is a three-dimensional model held in the hands. Turning a layer is not simply swapping colours; an entire ring of pieces rotates around an axis. Learners connect front and back, top and bottom, and discover that the same location looks different from another viewpoint. Abstract spatial relationships become tangible, movable and immediately testable.',
          ],
          [
            '当孩子不再只照着老师一步一步模仿，就会开始在落手前预想结果：这一转会把目标块带到上层还是侧面？为了不破坏已经完成的部分，应该从哪条路径绕过去？做观察训练时，还可以只展示一个状态，让孩子闭眼描述某层转动后的变化，再打开模拟器核对。这样的预演并不要求天生有“立体感”，而是通过许多短小、可纠正的尝试，逐渐建立稳定的内部空间模型。',
            'Once learners move beyond imitation, they begin predicting outcomes before acting: will this turn send the target upward or sideways, and which route preserves finished work? A teacher can pause on a state, ask the learner to imagine one turn, then verify it in the simulator. Spatial imagery is treated as a trainable internal model built through many short, correctable attempts, not an inborn gift.',
          ],
          [
            '这项价值适合用具体场景来表达：孩子在拼装、画立体图、读地图或理解物体朝向时，需要的正是把不同视角联系起来的能力。魔方不能替代数学课程，也不能保证所有学科成绩都会提高，但它提供了高频、低成本的空间练习。每转一次，预测就接受一次现实检验；猜错了可以马上回看，猜对了又会强化方向感。对课程推广而言，这比空泛的“开发右脑”更可信，也更容易向家长展示。',
            'This value is easy to explain through real situations: assembly, solid drawing, map reading and understanding orientation all require connecting viewpoints. Cubing cannot replace mathematics or guarantee higher grades, but it offers frequent, inexpensive spatial practice. Every prediction meets reality within seconds, making the benefit more credible and demonstrable than vague claims about developing one side of the brain.',
          ],
        ],
      },
      {
        id: 'pattern-recognition',
        tone: 'accent',
        title: ['模式识别', 'Pattern recognition'],
        summary: ['在大量变化中，抓住真正决定方法的共同结构', 'Find the structure that determines a method amid many variations'],
        paragraphs: [
          [
            '魔方看起来有无数种混乱状态，但学习者并不需要为每一种状态发明新办法。入门法会把局面归纳成十字、角块、棱块和顶层图案；进阶后，又会把表面不同的情况按结构分成若干类型。孩子慢慢发现，颜色可以换、视角可以转、目标块可以出现在不同位置，但某些关系保持不变。识别这些不变量，就是从“记住一张图”走向“看懂一类问题”。',
            'A cube appears to offer endless disorder, yet learners do not invent a method for every state. Beginner methods organise situations into crosses, corners, edges and last-layer patterns; advanced methods group superficially different cases by structure. Colours and viewpoints may change while key relationships stay constant. Recognising those invariants is the move from memorising one picture to understanding a class of problems.',
          ],
          [
            '模式识别的训练发生在每一次“这和我学过的哪个情况相似”中。孩子需要先找特征，再做分类，还要留意最容易混淆的差别。例如两个图案轮廓相近，却可能因为一个角块方向不同而需要完全不同的处理。好的教学不会让孩子死背几十张孤立图片，而会带他比较、归组、说出判断依据。能够用自己的话解释“为什么它属于这一类”，往往比单纯做对更能说明理解已经形成。',
            'Pattern recognition is exercised whenever a learner asks which known case resembles the current one. They identify features, classify the state and notice distinctions between near matches. Good teaching does not present dozens of isolated pictures; it helps learners compare, group and state the reason for a choice. Explaining why a case belongs to a family often demonstrates deeper understanding than a correct move alone.',
          ],
          [
            '对家长而言，这项能力的可见证据是孩子越来越少依赖完整提示。最初他可能需要老师告诉“现在用哪一个公式”，后来只需提醒观察某个方向，再后来能够独立命名或描述情况。这个过程也适合形成学习档案：保存早期判断记录、分类练习正确率和复盘笔记，就能展示孩子如何从零散记忆建立出有组织的知识网络。宣传时应强调这种分析过程，而不是把任何一次识别成功夸张成普遍的天赋提升。',
            'Parents can see this growth in the learner’s declining need for prompts: first the teacher names the algorithm, then merely points to a feature, and eventually the learner identifies and describes the case independently. Early classification records, accuracy and reflection notes can form a portfolio showing how scattered memories became an organised knowledge network. The honest selling point is that visible analytical process, not a claim of universal talent gains.',
          ],
        ],
      },
      {
        id: 'hand-eye-coordination',
        tone: 'warning',
        title: ['手眼协调', 'Hand-eye coordination'],
        summary: ['让视线、双手与动作节奏配合成一套连续流程', 'Coordinate vision, both hands and rhythm into one continuous flow'],
        paragraphs: [
          [
            '还原魔方时，眼睛在寻找下一组目标，双手要保持握持、拨动不同层面，还要随时调整视角。初学者常常出现“看见了但手跟不上”“右手会做，换到左侧就混乱”或“转得太急导致层没有对齐”等情况。通过慢速、准确的练习，孩子会逐渐建立动作与视觉线索之间的对应：看到某种位置，就知道哪只手、哪根手指更方便完成下一步。',
            'While solving, the eyes search for the next target as both hands hold, turn and reorient the puzzle. Beginners often see the right move before their hands can perform it, lose fluency on the opposite side, or rush before layers align. Slow, accurate practice builds a connection between visual cues and action: a position begins to suggest which hand and finger can execute efficiently.',
          ],
          [
            '手眼协调并不等于一味追求手速。有效训练通常先要求动作完整、层面到位、左右手分工清楚，再逐步减少停顿。教师可以把一段动作拆成两三拍，让孩子边说节奏边做，也可以用 `/sim` 放慢演示，观察每一步之后零件落在何处。随着动作熟练，眼睛不必一直盯着正在转的那一层，而能提前寻找下一个目标，双手则在稳定节奏中完成当前任务。',
            'Coordination is not the same as chasing raw speed. Effective practice first demands complete turns, aligned layers and clear roles for each hand, then gradually removes pauses. A teacher can divide a sequence into beats or slow the shared `/sim` demonstration so learners see where pieces land. With fluency, the eyes can search ahead while the hands finish the current action in a stable rhythm.',
          ],
          [
            '家长往往能从很小的变化看到进步：握得不再僵硬，掉落次数减少，动作从“大幅甩手”变成更经济的手指拨动，长串步骤也能保持整齐。它是一种精细动作和双侧配合的练习，但不应被包装成医疗训练或治疗方案。更合适的表达是：魔方提供了明确目标、即时反馈和大量重复机会，让孩子愿意主动练习手部控制，并在可量化的完成时间和错误率中看见自己的提升。',
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
        summary: ['根据当前条件排除错误选项，找到有依据的下一步', 'Use current conditions to eliminate wrong choices and justify the next move'],
        paragraphs: [
          [
            '魔方的每一步都有前提：目标块在哪里、方向是否正确、已经完成的部分能不能暂时移动、做完以后怎样恢复。孩子不能只凭“看起来差不多”随便转，而要把观察到的条件和学过的规则对应起来。即使使用入门法，他也在不断经历一个简化的推理链：如果出现这种位置，就先把目标移开；因为要保留底层，所以从另一侧插入；完成后再检查结果是否符合预期。',
            'Every move has conditions: where the target sits, how it is oriented, whether solved work may move temporarily and how it will be restored. A learner cannot rely on “looks close enough”; observations must connect to rules. Even beginner methods contain compact reasoning chains: if the piece appears here, move it aside; because the lower layer must be preserved, insert from the other side; then verify the result.',
          ],
          [
            '好的魔方课会追问“你为什么选这一步”，而不只是看最后有没有还原。孩子说出理由时，教师才能发现他是真的理解，还是碰巧背对了动作。遇到错误，也可以沿着推理链倒查：是条件看错、规则记错，还是执行时转错方向。这样一来，错误不再只是“失败”，而是指出哪一环需要修正的诊断信息。长期练习会让孩子更习惯先讲依据，再行动，再核对。',
            'Good instruction asks why a move was chosen, not merely whether the cube was solved. Explanation reveals understanding versus lucky recall. Errors can be traced along the same chain: was the condition misread, the rule misremembered or the direction executed incorrectly? Failure becomes diagnostic information, and the habit becomes justify, act and verify.',
          ],
          [
            '向家长推介时，可以展示一段真实对话：老师不直接给答案，而是用几个问题引导孩子自己排除选项；孩子最终说出判断依据并完成步骤。这比承诺“逻辑能力全面提升”更有说服力，因为家长能看到推理过程确实发生。魔方也不会自动把逻辑迁移到所有学科，迁移需要教师有意识地让孩子表达、比较和复盘；课程真正能提供的，是一个反馈快速、难度可调的推理练习场。',
            'A persuasive demonstration is a real dialogue: the teacher does not reveal the answer but asks questions that help the learner eliminate options, explain the choice and complete the step. That visible reasoning is stronger than a sweeping promise of general improvement. Transfer is not automatic; it grows when instruction deliberately includes explanation, comparison and reflection. The cube supplies a fast-feedback practice ground with adjustable difficulty.',
          ],
        ],
      },
      {
        id: 'task-decomposition',
        tone: 'success',
        title: ['任务拆解', 'Task decomposition'],
        summary: ['把“还原整个魔方”拆成清楚、可检查的小目标', 'Turn “solve the whole cube” into clear, checkable sub-goals'],
        paragraphs: [
          [
            '一个彻底打乱的魔方很容易让初学者产生无从下手的感觉。入门方法最重要的价值之一，就是把庞大目标拆成十字、第一层、第二层和最后一层等阶段，每个阶段再拆成寻找目标块、调整方向、放入位置和检查结果。孩子第一次体验到：看似复杂的问题不必一次解决，只要先定义一个足够小、能够完成的下一步，混乱就会逐渐减少。',
            'A fully scrambled cube can feel impossible. A beginner method transforms it into stages such as a cross, first layer, middle layer and last layer, then into finding a piece, orienting it, inserting it and checking the result. Learners experience a powerful idea: a complex problem need not be solved all at once. Define a small achievable next step and the disorder begins to shrink.',
          ],
          [
            '拆解还要求理解阶段之间的依赖。底层没有完成，就不急着处理顶层；某个小目标会破坏已经完成的结构，就先创造条件再回来。教师可以让孩子每完成一个阶段就停下来描述“现在完成了什么、还差什么、下一步为什么是它”，也可以把一次练习记录成阶段用时。这样，孩子学到的不是机械照单执行，而是用里程碑管理一个持续十几分钟甚至更久的任务。',
            'Decomposition also means understanding dependencies. Do not rush to the last layer before the foundation is ready; if a sub-goal would destroy completed work, first create the right conditions. Learners can pause at each milestone to state what is done, what remains and why the next step follows, or record stage times. The lesson is not blind compliance but milestone-based management of a sustained task.',
          ],
          [
            '这项能力特别适合转化为课程卖点，因为进步非常容易展示。第一节课，孩子面对整体目标可能只会说“我不会”；几节课后，他能明确说“十字已经完成，现在在找这一层的角块”。这种语言变化意味着他开始拥有问题地图。家长也能把同一方法用于作业、收纳或项目：不催促“快点全部做完”，而是和孩子确认下一个小目标。魔方提供的是练习拆解的载体，不是包办其他任务的魔法。',
            'This benefit is easy to make visible. In lesson one a child may only say, “I can’t do it.” After several lessons they can say, “The cross is complete; I’m looking for this layer’s corner.” That language shows a mental map of the problem. Families can reuse the approach in homework or projects by agreeing on the next small goal. The cube is a vehicle for practising decomposition, not magic that completes other tasks.',
          ],
        ],
      },
      {
        id: 'planning',
        tone: 'info',
        title: ['规划与路线选择', 'Planning and route selection'],
        summary: ['比较不止一种走法，兼顾眼前目标与后续成本', 'Compare routes and balance the immediate goal with later cost'],
        paragraphs: [
          [
            '当孩子只会一种固定方法时，重点是把流程走通；熟练以后，同一个目标往往可以从不同方向、用不同顺序完成。此时问题从“会不会做”变成“哪条路线更合适”：哪一种更顺手，哪一种移动更少，哪一种能保留更多已经整理好的部分，哪一种做完后更容易看到下一组目标。规划意味着不被第一个可行答案绑住，而是开始比较方案。',
            'At first, one reliable method is enough. With fluency, the same goal can often be reached from different directions and in different orders. The question shifts from whether a move works to which route fits best: fewer turns, better hand position, more preserved work or a clearer view of what follows. Planning begins when the learner compares alternatives instead of accepting the first workable answer.',
          ],
          [
            '这种比较可以从很小的选择开始。教师展示两个目标块，让孩子决定先处理哪一个，并说明理由；或者让他分别尝试两条路线，记录动作数、停顿和出错点。孩子会发现，局部最快不一定让整体最快，有时多做一个准备动作，反而能让后面更连续。这样的体验把“计划”从纸面概念变成身体能够感受到的差异：路线是否顺畅，会直接反映在停顿、回退和完成质量上。',
            'Comparison can begin with tiny choices: select which of two targets to solve first and explain why, or test two routes while recording moves, pauses and errors. Learners discover that the fastest local choice is not always the fastest overall; one setup move may make everything after it flow. Planning becomes physically perceptible through pauses, reversals and quality rather than remaining an abstract slogan.',
          ],
          [
            '对外介绍时，可以把规划能力描述为“在明确规则下练习做选择”，避免声称孩子因此会自动变成生活规划高手。课程能够承诺的是提供越来越开放的决策空间：从跟随步骤，到两个方案中选择，再到独立设计一段路线，并在复盘时解释取舍。家长可以通过训练记录看到孩子是否减少无效转动、是否会提前准备、是否能说出方案优缺点。这样的证据具体、可观察，也更符合长期学习的真实节奏。',
            'A careful promise is “practice making choices under clear rules,” not that cubing automatically creates a master life planner. A course can progressively open the decision space: follow a route, choose between two, then design and defend one. Records can show fewer wasted turns, better preparation and clearer explanation of trade-offs. These are concrete, observable signs of developing planning habits.',
          ],
        ],
      },
      {
        id: 'algorithmic-thinking',
        tone: 'warning',
        title: ['算法思维', 'Algorithmic thinking'],
        summary: ['理解一串规则如何稳定地把输入状态变成目标状态', 'Understand how a repeatable rule transforms a starting state into a target state'],
        paragraphs: [
          [
            '魔方公式本质上是一段明确、有限、顺序敏感的操作。某一步少做、多做或方向相反，结果就会改变；同一段动作在满足相同条件时，又能稳定地产生相同效果。孩子因此直观接触到算法的几个核心特点：输入状态、操作顺序、可重复性、局部目标和结果验证。即使不写一行代码，他也在用手执行一段“程序”，并观察它怎样改变系统。',
            'A cube algorithm is an explicit, finite and order-sensitive sequence. Omit, repeat or reverse a step and the outcome changes; apply it under the same conditions and it produces a stable effect. Learners encounter input state, sequence, repeatability, local goals and verification. Without writing code, they execute a small program by hand and observe how it transforms a system.',
          ],
          [
            '更深入的学习不会停留在背字母。教师可以让孩子观察一段公式主要移动哪些零件、哪些位置最终恢复、为什么公式必须从特定角度开始；也可以故意删掉一步，让他找出“程序”在哪里失效。孩子还会接触重复结构、逆操作、交换顺序带来的差异，以及把长流程封装成一个可调用的小模块。熟练者看到公式名，就像看到一个有明确作用的工具，而不是一串没有意义的口令。',
            'Deeper study goes beyond letters. Learners can inspect which pieces an algorithm moves, which positions return, why a starting angle matters, or debug a sequence with one missing step. They meet repetition, inverse operations, non-commuting order and the idea of packaging a long process as a reusable module. An algorithm name becomes a tool with a purpose, not a meaningless chant.',
          ],
          [
            '在课程推广中，这是一条连接魔方、数学和编程兴趣的自然桥梁，但不宜直接承诺“学魔方等于学会编程”。更准确的说法是，它让孩子用非常具体的对象体验规则、状态和调试：结果不对，就检查输入、顺序和执行；想提高效率，就比较两套步骤的长度与适用范围。对还没有接触正式编程的孩子，这种看得见、摸得着的算法体验能降低抽象门槛，也为以后理解流程图、循环与函数留下熟悉感。',
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
        summary: ['用理解、分组和线索组织记忆，而不是只靠机械重复', 'Organise memory through meaning, grouping and cues instead of repetition alone'],
        paragraphs: [
          [
            '学习魔方确实需要记忆，但高效记忆并不是把所有动作一股脑塞进脑子。孩子会学着把长公式切成两到四步的小节，按手部节奏形成组块，把图案与动作效果联系起来，再用起手姿势或关键词作为提取线索。原本十几个分散的符号，经过分组后变成几个有意义的动作单元，记忆负担明显降低。这正是策略性记忆与单纯多背几遍的区别。',
            'Cubing requires memory, but efficient memory is not indiscriminate repetition. Learners split a long sequence into short phrases, group moves by hand rhythm, connect appearance to effect and use a starting grip or keyword as a retrieval cue. A dozen isolated symbols become a few meaningful action units, illustrating the difference between strategic memory and simply repeating more.',
          ],
          [
            '课程还可以帮助孩子认识不同内容需要不同记法：位置关系适合画图或指着实物说，动作顺序适合分节和节拍，容易混淆的公式适合放在一起比较，长期不使用的内容则需要间隔复习。孩子若能说出“我为什么总在第三段忘记”“我准备怎样改记法”，就已经开始管理自己的学习。记住公式不是终点，找到适合自己的编码、提取和复习方式才是更有价值的收获。',
            'Different material calls for different methods: diagrams for position, phrasing for sequence, side-by-side comparison for confusable algorithms and spaced review for content not used often. When learners can say where recall fails and how they will change the cue, they begin managing their own learning. The deeper gain is not the formula itself but discovering ways to encode, retrieve and revisit knowledge.',
          ],
          [
            '向家长说明时，应避免把它宣传成“提高全部记忆力”或引用没有依据的百分比。更可信的证据是孩子在真实任务中使用了记忆策略：能把新公式拆组，能隔几天再次提取，忘记后会从动作逻辑重新建构，而不是立刻索要答案。教师可以保留首次学习、次日复习和一周后复习的记录，让家长看见记忆从不稳定到稳定的过程。这样的长期曲线，比课堂上一次背对更能体现课程价值。',
            'Avoid claims that cubing improves every kind of memory or unsupported percentages. Better evidence is the learner’s actual use of strategies: chunking a new sequence, retrieving it days later and reconstructing logic after forgetting instead of immediately asking for the answer. Records from first learning, next-day review and one-week review show memory becoming stable, a stronger story than one correct classroom performance.',
          ],
        ],
      },
      {
        id: 'lookahead',
        tone: 'info',
        title: ['预判与前瞻', 'Prediction and lookahead'],
        summary: ['完成当前动作的同时，开始寻找下一组目标', 'Search for the next target while finishing the current action'],
        paragraphs: [
          [
            '初学者常采用“做完、停下、再找”的节奏：完成一小段动作后，才重新观察整个魔方。随着熟练，他会开始在当前步骤尚未结束时追踪别的零件，预测它们最终落点，并提前决定下一步从哪里开始。这种前瞻要求大脑同时保持当前任务和未来线索，但又不能因为想得太远而把眼前动作做错。它是一种在准确基础上逐步扩大的注意范围。',
            'Beginners often finish, stop and search again. With fluency, they track another piece before the current action ends, predict its landing point and prepare the next start. Lookahead means holding current execution and a future cue together without letting anticipation corrupt accuracy. It is an expanding attentional window built on a reliable present step.',
          ],
          [
            '前瞻训练通常不是要求孩子突然转得更快，而是故意放慢手速、减少无目的的停顿。教师可以设定“这一组动作中只追踪一个目标”，或者在 `/sim` 动画暂停前让孩子指出目标将出现的位置。眼睛先学会连续移动，双手再逐渐跟上。孩子会体会到，真正流畅并非每一下都极快，而是少停、少找、少回头；这与阅读、球类和演奏中的连续信息处理有相似之处。',
            'Lookahead training often slows the hands to remove aimless pauses. A learner may track just one target during a sequence or predict where it will appear before a `/sim` animation stops. The eyes learn continuity before the hands accelerate. Fluency comes less from frantic movement than from fewer searches and reversals, a pattern with parallels in reading, sport and music.',
          ],
          [
            '这项能力的展示非常直观：比较同一位孩子早期和后期的还原录像，即使总手速变化不大，后期也会因为停顿减少而显得更从容。课程可以把“最长停顿”“无目标转动次数”或连续完成的组数作为观察指标，而不必只盯最终秒数。推广时强调“学会为下一步做准备”既真实又有生活感；同时也要说明，前瞻建立在正确率之上，过早催快只会让孩子形成慌乱和猜测。',
            'The change is easy to show in before-and-after video. Even if raw turning speed barely changes, reduced pauses make later solves calmer and faster. A course can observe longest pause, purposeless turns or uninterrupted sequences rather than only final time. “Learning to prepare for what comes next” is a credible message, with the important caveat that lookahead rests on accuracy; rushing too early teaches panic and guessing.',
          ],
        ],
      },
      {
        id: 'decision-speed',
        tone: 'accent',
        title: ['判断速度', 'Decision speed'],
        summary: ['把熟悉局面的识别与选择练到快速、可靠', 'Make recognition and choice fast and reliable in familiar situations'],
        paragraphs: [
          [
            '计时还原里的“快”并不全来自手。很多时间花在看见局面、辨认类别、从记忆中提取方法和决定起手方向上。孩子通过反复接触典型情况，会逐渐把原本需要逐条思考的判断压缩成快速识别：看到关键特征，就能从少数候选中选出合适方法。这不是盲目反应，而是大量正确分类之后形成的熟练化，让有限注意力可以留给更难的新问题。',
            'Speed does not come only from hands. Much time is spent perceiving the state, classifying it, retrieving a method and choosing orientation. Repeated exposure turns a deliberate checklist into rapid recognition: defining features narrow the choice to a suitable response. This is not blind reflex but fluency built on many correct classifications, freeing attention for harder problems.',
          ],
          [
            '训练判断速度时，必须把“快”和“准”一起记录。教师可以短暂展示一个局面，让孩子先口头说类别，再决定动作；也可以使用成组练习，统计在限定时间内识别多少个，同时标记误判。若只追数量，孩子很容易学会猜；若永远不计时，又难以发现提取是否真正熟练。合适的节奏是先不限时讲清依据，正确率稳定后再逐步缩短反应时间，并对最常混淆的情况单独比较。',
            'Training must record both speed and accuracy. A teacher can briefly show a state, ask the learner to name it before moving, or run grouped recognition drills with errors marked. Counting only volume rewards guessing; never timing hides weak retrieval. A sound progression begins with unlimited explanation, then shortens response time after accuracy stabilises while isolating commonly confused cases.',
          ],
          [
            '对家长来说，这能呈现一个清晰的学习曲线：不是突然“脑子变快”，而是孩子对已经理解的知识提取得更快、更稳。课程展示可以放出识别正确率、平均反应时间和典型错误的变化，说明教学怎样从理解走向熟练。宣传时也应限定范围：这里练的是魔方情境中的视觉判断和选择，不能直接等同于所有场景的反应力；但孩子确实能体验到，系统练习可以把迟疑变成从容。',
            'For parents, the curve is clear: the brain has not suddenly become universally faster; retrieval of understood cube knowledge has become quicker and more reliable. Accuracy, average response time and recurring errors can show the transition from understanding to fluency. The claim remains specific to cube decisions, yet the learner gains a genuine experience of systematic practice turning hesitation into composure.',
          ],
        ],
      },
      {
        id: 'rhythm',
        tone: 'warning',
        title: ['节奏与稳定执行', 'Rhythm and reliable execution'],
        summary: ['在连续动作中控制速度、力度和准确率', 'Control pace, force and accuracy through continuous action'],
        paragraphs: [
          [
            '稳定的还原不是全程用最大速度猛转，而是根据任务调节节奏。需要观察时放慢，需要执行熟悉公式时连贯，需要调整握姿时宁可短暂停顿，也不要带着错位继续。孩子会逐渐分辨“我是真的熟练”与“我只是急”，理解速度、准确和流畅之间的取舍。一次看似不够快但零失误的完成，往往比不断卡顿、返工的高速尝试更接近真正进步。',
            'A stable solve is not maximum speed from start to finish. Learners slow for observation, flow through familiar sequences and pause briefly to adjust grip rather than continue misaligned. They learn to distinguish fluency from hurry and to balance speed, accuracy and continuity. A clean attempt that looks modest can represent more progress than a frantic run full of stops and repairs.',
          ],
          [
            '节奏可以被听见也可以被看见。教师让孩子用均匀节拍完成一段动作，注意每层是否到位，再逐渐提高节拍；也可以录像回放，标出哪些地方因为犹豫、握姿或识别导致节奏断裂。孩子学会把复杂表现拆成可以调整的变量：手指力度、转动幅度、呼吸、视线和动作间隔。这样，训练从“再来一遍”变成有目标的刻意练习。',
            'Rhythm can be heard and seen. A teacher may use an even beat while checking layer alignment, then increase it gradually, or review video to locate breaks caused by hesitation, grip or recognition. The learner separates performance into adjustable variables such as force, turning distance, breathing, gaze and interval. Practice becomes purposeful rather than merely another repetition.',
          ],
          [
            '课程推广可以把这项能力落在“稳定输出”上。家长不只看孩子偶尔刷出一个最好成绩，还能关注连续五次是否都能完成、成绩波动是否缩小、紧张时能否回到自己的节奏。这样的指标更接近比赛和真实任务中的可靠性，也能避免孩子为了一个漂亮数字不断冒险。魔方提供即时、精确的计时反馈，但教师要把数字用于理解过程，而不是让排名和速度成为唯一价值。',
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
        summary: ['把注意力放在当前目标，并在走神后主动拉回来', 'Hold attention on the current goal and deliberately return after distraction'],
        paragraphs: [
          [
            '完成一次还原需要在几分钟内持续追踪阶段、目标块和动作顺序。环境里有声音、同伴或计时压力时，孩子很容易忘记自己做到哪里。魔方给专注提供了一个边界清楚的任务：当前只需找到一个目标、完成一段动作并检查结果。注意力不是始终绷紧，而是在不断选择“此刻最重要的信息是什么”，屏蔽无关刺激，再在短暂走神后重新定位。',
            'A solve requires tracking stage, target and sequence over several minutes. Noise, peers or a timer can make a learner lose their place. The cube offers a bounded attentional task: find one target, complete one sequence and verify it. Focus is not permanent tension; it is repeatedly selecting what matters, ignoring irrelevant stimulation and relocating after a brief lapse.',
          ],
          [
            '教师可以让孩子在开始前说出本轮唯一目标，例如“这次只保证每一步方向准确”，结束后再回顾注意力在哪个位置断开。短时高质量练习与明确休息交替，通常比长时间机械转动更有效。随着能力提升，目标可以从一个步骤扩大到一个阶段，再到完整还原。孩子也会学会利用摆正魔方、深呼吸、复述目标等小仪式，把注意力从外界重新带回任务。',
            'A teacher can set one intention before an attempt, such as accurate direction, then review where attention broke. Short high-quality practice alternating with clear rest is often better than long mechanical turning. Scope can grow from a step to a stage to a full solve. Small routines such as aligning the puzzle, breathing and restating the goal help bring attention back.',
          ],
          [
            '这里适合宣传的是“练习管理专注”，而不是声称魔方能治疗注意力问题。家长可观察的变化包括：孩子能否独立完成更长的流程、被打断后能否找回阶段、出错时是否停下来检查而不是连续乱转。课程也可以用训练日志记录专注目标和自我评价，让孩子看到自己并非只有“专心”或“不专心”两种状态，而是掌握了一些可以主动调整的方法。这种自我认识本身就很有价值。',
            'The honest claim is practice in managing attention, not treatment for attention disorders. Parents can observe whether the learner sustains a longer process, finds their place after interruption and pauses to check instead of turning randomly. A log of attention goals and self-ratings helps children see that focus is not a fixed yes-or-no trait but something they can influence with strategies.',
          ],
        ],
      },
      {
        id: 'patience',
        tone: 'warning',
        title: ['耐心与延迟满足', 'Patience and delayed gratification'],
        summary: ['接受暂时看不见成果，仍愿意按顺序完成过程', 'Continue through a process even when the reward is not immediate'],
        paragraphs: [
          [
            '学习魔方不会每一分钟都有惊喜。一个公式可能练很多遍仍会忘，一次还原可能做到最后才发现前面有错，成绩也可能连续几周没有明显下降。孩子需要接受“现在还不会”和“今天没有更快”并不等于没有进步。按照正确步骤积累、等待动作和识别逐渐稳定，是一种很具体的延迟满足：先投入注意和练习，成果在之后才慢慢出现。',
            'Cubing does not reward every minute. An algorithm may remain fragile after many repetitions, an early mistake may appear only near the end, and times may plateau for weeks. Learners practise accepting that “not yet” and “not faster today” do not mean no progress. Correct repetition accumulates before fluency appears, creating a concrete experience of effort now and reward later.',
          ],
          [
            '耐心并不是让孩子无休止忍受挫败。好的教学会把难度降到可以成功的范围，用更短公式、局部练习或提示帮助他获得阶段性反馈，再逐步减少支持。孩子也要学会判断何时继续尝试、何时休息、何时寻求帮助。真正可持续的坚持包含节奏和方法，而不是硬撑。每一次从“完全不会”到“偶尔做对”，再到“稳定完成”，都会让等待与积累有清楚的意义。',
            'Patience is not endless suffering. Good instruction reduces difficulty into a success zone through shorter sequences, partial practice or prompts, then withdraws support. Learners also decide when to continue, rest or ask for help. Sustainable persistence includes pacing and method, not brute endurance. Each transition from impossible to occasional to reliable gives waiting a visible purpose.',
          ],
          [
            '推介时，可以用阶段性成长代替“一节课学会”的冲动承诺：今天能独立完成十字，下周能完成两层，再后来完成整颗魔方。家长看到的是孩子如何等待结果、调整方法并积累成功，而不只是最终那一次还原。课程若能记录小里程碑、允许合理反复，并把错误视为学习材料，就更容易保护兴趣。魔方的优势在于最终目标清楚、过程可拆分，让耐心有方向，而不是漫无目的地熬时间。',
            'Marketing can replace the promise of instant mastery with staged growth: an independent cross today, two layers next week and a full solve later. Parents see how the learner waits, adjusts and accumulates success, not only the final solve. Recording small milestones and treating errors as material protects interest. The cube gives patience a direction because the destination is clear and the route can be divided.',
          ],
        ],
      },
      {
        id: 'error-diagnosis',
        tone: 'accent',
        title: ['错误诊断', 'Error diagnosis'],
        summary: ['不把“错了”当终点，而是定位错误发生在哪一环', 'Treat an error as a location to investigate, not the end of the attempt'],
        paragraphs: [
          [
            '魔方给错误留下了痕迹。方向转反、漏掉一步、从错误角度起手，最终都会呈现不同的异常状态。孩子最初可能只会说“全乱了”，但在引导下可以逐步缩小范围：前一个阶段是否正确？错误从哪段动作以后出现？目标块是位置不对还是方向不对？把模糊的失败感转换成具体问题，是诊断能力的第一步，也能减少一出错就全部推倒重来的冲动。',
            'A cube preserves traces of mistakes. A reversed turn, omitted move or wrong starting angle produces different symptoms. A beginner may say only that everything is ruined, but guided questions narrow the issue: was the previous stage correct, after which sequence did the state change, and is the piece misplaced or misoriented? Turning a vague sense of failure into a specific question is the start of diagnosis.',
          ],
          [
            '教师可以采用“停、看、说、修”的流程：先停止继续乱转，观察哪些部分仍然正确，用语言复述刚才的操作，再决定回退、重做局部还是从检查点重新开始。录像和 `/sim` 的逐步演示也能帮助对比预期与实际。随着经验增加，孩子会建立常见错误库，一看到某种结果就想到可能原因。重要的是让他参与查找，而不是老师每次迅速替他修好，否则机会只变成了外部救援。',
            'A useful routine is stop, inspect, explain and repair: stop random turns, note what remains correct, restate the recent action, then choose whether to reverse, redo locally or restart from a checkpoint. Video and stepwise `/sim` playback help compare expected and actual states. Over time learners build a catalogue of common symptoms, provided the teacher lets them investigate instead of instantly rescuing the solve.',
          ],
          [
            '这项能力很适合成为课堂展示：同样面对错误，孩子从沮丧地求助，变成主动说“我先检查上一阶段”，再尝试恢复。家长能清楚看到问题处理方式的变化。推广时不必声称孩子从此不会犯错，反而可以强调课程教他怎样和错误相处：保留正确部分、寻找证据、提出假设、做最小修正并再次验证。这样的过程既诚实，也比“保证零失误”更接近真实学习和未来工作。',
            'This makes a strong classroom demonstration: faced with the same error, the learner moves from frustrated rescue-seeking to saying, “I’ll check the previous stage first,” and attempting recovery. The promise is not fewer human mistakes forever but a better relationship with them: preserve what is correct, gather evidence, form a hypothesis, make the smallest repair and verify again. That is both honest and relevant to real learning.',
          ],
        ],
      },
      {
        id: 'reflection',
        tone: 'info',
        title: ['复盘与自我纠正', 'Reflection and self-correction'],
        summary: ['完成以后回看过程，找到下一轮最值得改变的一件事', 'Review the process and choose one useful change for the next attempt'],
        paragraphs: [
          [
            '计时器给出一个结果，但数字本身不会告诉孩子怎样进步。复盘要把“这次用了 90 秒”拆开：时间花在寻找、回忆还是执行？哪一阶段最顺，哪一处停顿最长？错误是偶然失手还是反复出现？孩子若只盯着最终成绩，很容易把好坏归因于运气；学会回看过程，才能找到可以控制的变量，把下一次练习变成有方向的实验。',
            'A timer gives a result but not an improvement plan. Reflection unpacks a 90-second solve: was time spent searching, recalling or executing; which stage flowed and where was the longest pause; was an error accidental or recurring? Looking only at the final number encourages luck-based explanations. Reviewing process identifies controllable variables and turns the next attempt into a purposeful experiment.',
          ],
          [
            '有效复盘不需要写很长。每轮结束后回答三个问题就够：哪里做得好、哪里卡住、下轮只改什么。教师帮助孩子把模糊评价变得具体，例如把“我太慢了”改成“第二层找棱块时停了三次”，再选择一个可执行目标。录像、阶段计时和错误记录都可以提供证据，但工具越多不一定越好；关键是让孩子亲自做出判断，并在下一轮验证调整是否有效。',
            'Reflection need not be long. Three questions are enough: what worked, where did I stall and what single thing will I change next time? A teacher turns “I’m slow” into “I paused three times searching for middle-layer edges,” then helps select an actionable goal. Video, splits and error logs provide evidence, but the learner must make the judgement and test the adjustment.',
          ],
          [
            '对家长和学校而言，持续复盘记录是非常有价值的成长材料。它展示的不只是最好成绩，而是孩子如何设问、尝试、失败、修改和再次验证。课程可以定期输出简短学习报告，引用孩子自己的观察，并用前后录像或数据支持结论。需要注意的是，复盘不应变成每次都挑毛病；同样要记录已经形成的优势和具体进步。这样孩子会把自我评价理解为帮助自己前进的工具，而不是外界审判。',
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
        summary: ['把愿望变成有期限、有步骤、能复核的训练计划', 'Turn a wish into a timed, staged and reviewable practice plan'],
        paragraphs: [
          [
            '“我想变快”只是愿望，还不是目标。魔方训练能帮助孩子把愿望具体化：本月先稳定独立还原，下个月减少某阶段停顿，比赛前练习完整模拟。大目标再拆成每周频率、单次练习重点和可以记录的指标。因为成绩、错误和阶段表现都容易留下数据，孩子很快能看到计划有没有执行、方法有没有效果，也能及时把不现实的目标调整到合适难度。',
            '“I want to be faster” is a wish, not yet a goal. Cubing helps make it concrete: stabilise independent solves this month, reduce pauses in one stage next month, then rehearse full competition attempts. Large aims become weekly frequency, session focus and observable measures. Times and errors leave clear data, so learners can see whether a plan happened, whether it worked and when an unrealistic target needs adjustment.',
          ],
          [
            '目标管理还包括优先级。孩子可能同时想学新公式、提高手速、参加比赛和尝试新项目，但时间有限。教师可以帮助他选择当前最重要的一件事，并说明暂缓其他目标不是放弃。定期回顾时，不只问是否达到数字，也检查兴趣、压力和练习质量。如果计划让孩子持续焦虑或挤占必要休息，就应该调整。真正成熟的目标服务于成长，而不是让孩子被排行榜牵着走。',
            'Goal management also means priorities. A learner may want new algorithms, faster hands, competition and another event at once, but time is finite. Choosing one current priority does not abandon the rest. Reviews should examine enjoyment, pressure and practice quality as well as numbers. If a plan creates persistent anxiety or removes needed rest, it should change. Healthy goals serve growth rather than enslave a child to rankings.',
          ],
          [
            '这项内容能为家长提供比“保证多少秒”更可靠的服务价值：课程帮助孩子制定目标、保留记录、阶段复盘并共同调整。即使最终没有达到原定秒数，孩子也能解释做了什么、发现什么、下一步怎样改变，这仍然是完整的学习成果。宣传材料可以展示匿名化的目标卡、周记录和反思示例，让家长看到教学不仅发生在课堂动作里，也发生在计划与自我管理中，同时明确成绩受练习时间和个体差异影响。',
            'For parents, this offers more reliable value than guaranteeing a particular time. A course can help set goals, retain records, review stages and adjust collaboratively. Even when the original number is missed, explaining what was tried, learned and changed remains a complete learning outcome. Anonymised goal cards, weekly logs and reflections show that instruction includes planning and self-management while acknowledging differences in practice time and individual progress.',
          ],
        ],
      },
      {
        id: 'resilience',
        tone: 'warning',
        title: ['抗挫与韧性', 'Resilience'],
        summary: ['在失败可承受、原因可查找的环境里练习重新开始', 'Practise restarting in an environment where failure is manageable and explainable'],
        paragraphs: [
          [
            '魔方会制造很多小挫折：公式忘了一半、最好成绩差一点没刷新、比赛紧张失误、练了很久仍停在平台期。它们足够真实，能让孩子体验失望，却通常不会造成严重后果；魔方可以重新打乱，下一轮很快又能开始。这种低风险、可重复的环境，为孩子练习情绪恢复提供了机会：先承认难受，再判断原因，最后选择继续、休息或换一种方法。',
            'Cubing creates many small setbacks: a sequence forgotten halfway, a missed personal best, nerves in competition or a stubborn plateau. They feel real without carrying severe consequences; the puzzle can be scrambled and another attempt begins soon. This low-risk, repeatable environment lets learners acknowledge disappointment, examine causes and choose whether to continue, rest or change method.',
          ],
          [
            '韧性不是要求孩子永远积极，也不是用“坚持就一定成功”否定真实感受。教师应帮助他区分可控制与不可控制：可以改的是准备、策略和练习，不能保证的是当天状态、对手表现和某一次运气。一次失败后先恢复节奏，再设一个比“必须刷新纪录”更可控的目标，例如完整做对或减少停顿。孩子经历多次这样的循环后，会发现挫折可以被处理，而不必把一次表现等同于自己的能力。',
            'Resilience does not require permanent positivity or the slogan that persistence guarantees success. A teacher separates controllable preparation, strategy and practice from uncontrollable daily form, opponents and luck. After a setback, the next goal can be a clean solve or fewer pauses rather than a compulsory record. Repeated cycles teach that disappointment can be handled and one performance does not define ability.',
          ],
          [
            '推广这项价值时要避免把“坚毅”包装成魔方已经科学证明的普遍人格提升。更诚实的说法是，课程设计了许多适度挑战，并教孩子在挑战后怎样恢复。家长可以观察他是否更愿意分析失败、是否能在提示后重新尝试、是否知道何时休息。教师也应保护孩子拒绝过度竞争的权利。被尊重的选择、恰当的难度和真实的小成功结合起来，才更可能形成长期兴趣与韧性。',
            'Avoid presenting resilience as a scientifically proven universal personality gain from cubing. The honest claim is that the course provides manageable challenges and teaches recovery. Families can observe whether the learner analyses failure, retries with a prompt and knows when to rest. Respect for opting out of excessive competition, appropriate difficulty and genuine small successes are what make long-term interest and resilience more likely.',
          ],
        ],
      },
      {
        id: 'communication',
        tone: 'info',
        title: ['表达与教学', 'Explanation and teaching'],
        summary: ['把自己会做的事，转换成别人能听懂、能跟上的语言', 'Turn personal skill into language another person can understand and follow'],
        paragraphs: [
          [
            '自己会还原和教会别人，是两种不同层次的掌握。孩子要向同伴解释时，不能只说“这里这样转”，而要先判断对方卡在哪里，选择合适词语，把动作拆小，示范后再让对方独立尝试。他还需要观察听者的表情和结果，发现说明是否清楚。教学迫使隐性的手感变成明确语言，也让孩子重新检查自己究竟理解了多少。',
            'Solving and teaching are different levels of mastery. To help a peer, a learner must diagnose the difficulty, choose suitable words, divide the action, demonstrate and then let the other person try. They watch expression and outcome to learn whether the explanation worked. Teaching turns implicit feel into explicit language and reveals the depth of the learner’s own understanding.',
          ],
          [
            '课堂可以安排两人互教、步骤讲解、小型展示或录制一分钟教程。重点不是口才表演，而是信息是否准确、结构是否清楚、能否根据反馈调整。一个孩子可能第一次讲得很乱，但在老师帮助下学会先说目标、再示范、最后提醒常见错误。对于不喜欢当众讲话的孩子，也可以从给一个同伴演示、写图文步骤或录制不露脸的手部视频开始，逐步建立安全感。',
            'Lessons can include peer teaching, step explanations, short demonstrations or one-minute tutorials. The criterion is not showmanship but accuracy, structure and adaptation to feedback. A learner can progress from a tangled explanation to naming the goal, demonstrating and warning about common errors. Quieter children can begin with one peer, illustrated steps or a hands-only video and build safety gradually.',
          ],
          [
            '这项成果特别适合用于社团、学校展示和个人成长材料，因为它同时呈现知识、沟通与责任感。家长看到的不只是孩子能拧多快，还能看到他耐心等待别人、用不同方式解释、为同伴的成功感到高兴。课程推广可以展示孩子创作的教程、讲解片段和同伴反馈，但应先取得授权并保护隐私。真正有价值的不是把孩子塑造成销售员，而是让他发现自己的知识能够帮助别人。',
            'This outcome suits clubs, school showcases and learning portfolios because it combines knowledge, communication and responsibility. Parents see patience, alternative explanations and delight in a peer’s success, not only speed. With permission and privacy protection, a course may show learner-created guides, short explanations and peer feedback. The point is not to make children salespeople but to help them discover that their knowledge can serve another person.',
          ],
        ],
      },
      {
        id: 'confidence-connection',
        tone: 'success',
        title: ['自信与社交连接', 'Confidence and social connection'],
        summary: ['用一项真实掌握的技能获得成就感，也找到共同语言', 'Gain confidence from genuine mastery and find a shared language with others'],
        paragraphs: [
          [
            '第一次独立还原通常是一个强烈而具体的成就：几分钟前还像无解的混乱，现在确实由自己一步步完成。这样的自信不是别人空口夸出来的，而有一个能拿在手里的结果作证。之后，孩子还能通过学习新方法、刷新个人纪录或帮助同伴不断获得新的掌握体验。关键是把自信建立在准备、练习和理解上，而不是只建立在比别人快或赢得名次上。',
            'A first independent solve is a concrete achievement: what looked impossible has been completed through the learner’s own steps. The confidence is backed by something held in the hands, not empty praise. New methods, personal records and helping peers create further mastery experiences. Healthy confidence rests on preparation, practice and understanding rather than being faster than others or winning a rank.',
          ],
          [
            '魔方也天然提供共同话题。不同年龄、语言和水平的人可以交换打乱、比较方法、一起计时或在比赛中互相鼓励。对有些孩子来说，直接进入陌生社交很难，但手里有一个共同任务，开口会容易得多。课程和社团若强调合作、尊重不同速度并设置轮流分享的机会，就能让新手也有参与感；如果只崇拜最快的人，则可能适得其反，让较慢的孩子感到被排除。',
            'Cubing also supplies a shared language. People of different ages, languages and levels can exchange scrambles, compare methods, time together and encourage one another. A common task can make conversation easier for a shy learner. Classes and clubs create belonging when they value cooperation, respect different paces and rotate opportunities to share; worshipping only the fastest can instead exclude beginners.',
          ],
          [
            '向家长推介时，可以把这份价值描述为“有根基的自信和可进入的社群”。真实案例包括孩子愿意在家人面前展示、第一次主动帮助同学、参加一场友好活动，或面对陌生选手敢于交流。比赛不是必选终点，内向也不需要被改造成外向；重要的是孩子拥有一项自己认可的能力，并能按照舒适节奏与他人建立连接。这样的自信更温和、更持久，也为长期兴趣留下空间。',
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
