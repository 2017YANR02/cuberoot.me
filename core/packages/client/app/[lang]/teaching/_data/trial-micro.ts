import { microLesson } from './builders';
import type { MicroCourse } from './types';

export const TRIAL_MICRO_COURSE: MicroCourse = {
  id: 'trial',
  label: '试听课',
  title: '五次小成功，完成第一次挑战',
  summary: '不急着讲完整复原。五节微课先消除畏难，让孩子认识目标块、做出白色小花，并清楚看到后续学习路线。',
  audience: '第一次接触三阶魔方的孩子和正在选课的家长',
  stages: [
    {
      id: 'trial-start',
      title: '第一次上手',
      summary: '每节只完成一个看得见的小目标，试听结束时留下明确的下一步。',
      modules: [
        {
          id: 'trial-success',
          title: '先体验“我做得到”',
          summary: '从认识魔方到做出白色小花，不塞入需要背诵的公式。',
          lessons: [
            microLesson({
              id: 'trial-01',
              title: '魔方不是靠运气',
              minutes: 2,
              outcome: '能说出复原靠的是可重复路线，而不是碰运气',
              script: [
                '你好，欢迎来到魔方微课。先看同一个魔方：它可以乱成这样，也可以一步一步回到六面整齐。',
                '【展示打乱状态，再快速切到复原状态】',
                '会复原的人不是每次都猜对，而是知道一条可以重复走通的路线。接下来每一节，我们只走路线中的一小步。',
                '做错不代表失败，只说明我们找到了一个需要再看一次的位置。慢一点、看清楚，你一样可以做到。',
                '今天先记住一句话：魔方不是靠运气。下一节，我们认识负责带路的中心块。',
              ],
            }),
            microLesson({
              id: 'trial-02',
              title: '找到不会换位置的中心块',
              minutes: 3,
              outcome: '能找到六个中心块，并用中心颜色判断每一面的归属',
            }),
            microLesson({
              id: 'trial-03',
              title: '找到一块白色棱块',
              minutes: 3,
              outcome: '能区分中心、棱和角，并准确指出一块白色棱块',
            }),
            microLesson({
              id: 'trial-04',
              title: '把第一片花瓣送到黄色中心旁',
              minutes: 4,
              outcome: '能独立把任意一块白色棱块送到黄色中心旁',
              kind: 'case',
            }),
            microLesson({
              id: 'trial-05',
              title: '四片花瓣与完整路线预告',
              minutes: 4,
              outcome: '能做出白色小花，并说出完整课程的三个阶段',
              kind: 'milestone',
              script: [
                '把刚才的方法重复四次，四块白色棱块就会围在黄色中心旁边，像一朵白色小花。',
                '【俯拍完成第四片花瓣，停留三秒】',
                '你已经不是只会乱转魔方了。你刚刚完成了复原路线中的第一个真实目标。',
                '完整课程会先带你独立复原，再学更顺手的 CFOP，最后练观察和提速。每一步仍然会像今天一样，拆成很短的小挑战。',
                '课后挑战：打乱白色棱块，再独立做出两次白色小花。家长可以拍下结果，领取下一阶段练习清单。',
              ],
            }),
          ],
        },
      ],
    },
  ],
};
