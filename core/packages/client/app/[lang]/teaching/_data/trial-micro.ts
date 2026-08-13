import { l, microLesson } from './builders';
import type { MicroCourse } from './types';

export const TRIAL_MICRO_COURSE: MicroCourse = {
  id: 'trial',
  label: l('试听课', 'Trial course'),
  title: l('五次小成功，完成第一次挑战', 'Five small wins and a first real challenge'),
  summary: l('不急着讲完整复原。五节课先消除畏难，让学员认识目标块、做出白色小花，并清楚看到后续学习路线。', 'These five lessons remove the fear of the cube, teach the first target pieces, build a white daisy, and show the path ahead.'),
  audience: l('第一次接触三阶魔方的学员和正在选课的家长', 'Learners meeting the 3×3 for the first time and parents choosing a course'),
  stages: [
    {
      id: 'trial-start',
      title: l('第一次上手', 'First contact'),
      summary: l('每节只完成一个看得见的小目标，试听结束时留下明确的下一步。', 'Each lesson ends with one visible result and the trial ends with a clear next step.'),
      modules: [
        {
          id: 'trial-success',
          title: l('先体验“我做得到”', 'Start with “I can do this”'),
          summary: l('从认识魔方到做出白色小花，不塞入需要背诵的公式。', 'Move from meeting the cube to making a white daisy without memorising algorithms.'),
          lessons: [
            microLesson({
              id: 'trial-01',
              title: l('魔方不是靠运气', 'The cube is not luck'),
              minutes: 2,
              outcome: l('能说出复原靠的是可重复路线，而不是碰运气', 'Explain that solving follows a repeatable route rather than luck'),
              script: [
                l('你好，欢迎来到魔方课。先看同一个魔方：它可以乱成这样，也可以一步一步回到六面整齐。', 'Hello and welcome. The same cube can look completely scrambled, then return to six neat faces one step at a time.'),
                l('【展示打乱状态，再快速切到复原状态】', '[Show the scrambled cube, then cut to the solved cube.]'),
                l('会复原的人不是每次都猜对，而是知道一条可以重复走通的路线。接下来每一节，我们只走路线中的一小步。', 'Solvers do not guess correctly every time. They know a route that works again and again. Each lesson will cover one small step on that route.'),
                l('做错不代表失败，只说明我们找到了一个需要再看一次的位置。慢一点、看清楚，你一样可以做到。', 'A mistake is not failure. It simply shows us the place to inspect again. Slow down, look carefully, and you can do it too.'),
                l('请把魔方拿起来，随便转两下，再停住。无论它看起来多乱，中心、棱和角仍然遵守固定规则。', 'Pick up the cube, make two random turns, and stop. No matter how mixed it looks, its centers, edges, and corners still follow fixed rules.'),
                l('【让学员暂停，自己打乱两步再复原两步】', '[Invite the learner to pause, make two turns, then undo both turns.]'),
                l('你刚刚已经验证了一件事：动作可以记录，也可以倒着走回来。后面的复原，就是把很多个可理解的小动作排好顺序。', 'You have already proved something important: moves can be recorded and reversed. A full solve is simply many understandable actions placed in the right order.'),
                l('今天先记住一句话：魔方不是靠运气。下一节，我们认识负责带路的中心块。', 'Remember one sentence today: the cube is not luck. Next, we will meet the center pieces that guide every face.'),
              ],
            }),
            microLesson({
              id: 'trial-02',
              title: l('找到不会换位置的中心块', 'Find the centers that never trade places'),
              minutes: 3,
              outcome: l('能找到六个中心块，并用中心颜色判断每一面的归属', 'Find all six centers and use them to identify each face'),
            }),
            microLesson({
              id: 'trial-03',
              title: l('找到一块白色棱块', 'Find one white edge'),
              minutes: 3,
              outcome: l('能区分中心、棱和角，并准确指出一块白色棱块', 'Tell centers, edges, and corners apart and point to a white edge'),
            }),
            microLesson({
              id: 'trial-04',
              title: l('把第一片花瓣送到黄色中心旁', 'Move the first petal beside the yellow center'),
              minutes: 4,
              outcome: l('能独立把任意一块白色棱块送到黄色中心旁', 'Move any white edge beside the yellow center independently'),
              kind: 'case',
            }),
            microLesson({
              id: 'trial-05',
              title: l('四片花瓣与完整路线预告', 'Four petals and the full-course preview'),
              minutes: 4,
              outcome: l('能做出白色小花，并说出完整课程的三个阶段', 'Make a white daisy and name the three parts of the full learning path'),
              kind: 'milestone',
              script: [
                l('把刚才的方法重复四次，四块白色棱块就会围在黄色中心旁边，像一朵白色小花。', 'Repeat the same idea four times. The four white edges will surround the yellow center like a white daisy.'),
                l('【俯拍完成第四片花瓣，停留三秒】', '[Complete the fourth petal overhead and hold for three seconds.]'),
                l('先检查四片花瓣都是棱块，不是白色角块。再转动顶层，确认每片花瓣都能跟着黄色中心一起移动。', 'Check that all four petals are edges, not white corners. Turn the top layer and confirm that every petal travels around the yellow center.'),
                l('你已经不是只会乱转魔方了。你刚刚完成了复原路线中的第一个真实目标。', 'You are no longer just turning randomly. You have completed the first real goal on the solving route.'),
                l('【把试听五节的成果依次显示在屏幕上】', '[Show the result from each of the five trial lessons on screen.]'),
                l('完整课程会先带你独立复原，再学更顺手的 CFOP，最后练观察和提速。每一步仍然会像今天一样，拆成很短的小挑战。', 'The full course first teaches an independent solve, then smoother CFOP, then observation and speed. Every step remains a short challenge like today.'),
                l('如果今天有一步不稳定，不用重看全部内容。回到对应编号，只练那一个小目标，成功三次再继续。', 'If one step feels uncertain, do not replay everything. Return to that numbered lesson, practise only its small goal, and continue after three successes.'),
                l('课后挑战：打乱白色棱块，再独立做出两次白色小花。家长可以拍下结果，领取下一阶段练习清单。', 'After-class challenge: scramble the white edges and make the daisy twice independently. A parent can save a photo and collect the next-stage practice sheet.'),
              ],
            }),
          ],
        },
      ],
    },
  ],
};
