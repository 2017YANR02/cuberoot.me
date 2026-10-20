/** Editable bilingual chapter copy. Keep each question, answer and tips together. */
export type LocalizedText = { zh: string; en: string };
export type ChapterTip = LocalizedText & { href?: string };
type ChapterContent = {
  id: `lesson-${number}`;
  title: LocalizedText;
  question: LocalizedText;
  answer: readonly LocalizedText[];
  tips: readonly ChapterTip[];
};

export const F2L_CHAPTERS = [
  {
    "id": "lesson-1",
    "title": {
      "zh": "初识 F2L",
      "en": "Meet F2L"
    },
    "question": {
      "zh": "我已经学会层先法复原魔方啦，有没有更厉害的解法？我要进步！",
      "en": "I can solve the cube with LBL now. Is there a more advanced method? I want to get better!"
    },
    "answer": [
      {
        "zh": "有的有的！F2L（First Two Layers）可以做到同时复原前2层。",
        "en": "Yes! F2L (First Two Layers) lets you solve the first two layers together."
      }
    ],
    "tips": [
      {
        "zh": "F2L步数通常比层先法少，是更高效的解法。",
        "en": "F2L usually takes fewer moves than the layer-by-layer method, making it more efficient."
      },
      {
        "zh": "层先法中还原中层棱块这一步其实也是F2L众多case的其中一种。",
        "en": "In the layer-by-layer method, inserting a middle-layer edge is actually one of the many F2L cases."
      },
      {
        "zh": "请确保你已经掌握层先法，参见本站层先法教程。",
        "en": "Make sure you can solve the cube using the layer-by-layer method. See the LBL tutorial on this site."
      }
    ]
  },
  {
    "id": "lesson-2",
    "title": {
      "zh": "F2L 的四种三步标态",
      "en": "Four three-move cases"
    },
    "question": {
      "zh": "前2层竟然可以同时复原？！给我看看要怎么做。",
      "en": "The first two layers can be solved together?! Show me how!"
    },
    "answer": [
      {
        "zh": "最简单的情况只需要3步，想不到吧！先对它们有个印象，后面再学。",
        "en": "The simplest cases take just three moves—surprising, right? Get familiar with their patterns for now; we will learn how to solve them later."
      }
    ],
    "tips": [
      {
        "zh": "最简单的3步状态一共有4种，本教程称之为“三步标态”。",
        "en": "There are four simplest cases that take just three moves. This tutorial calls them the “three-move cases”."
      },
      {
        "zh": "观察目标棱块和角块，其中2种状态已经组合好，剩下2种状态则是分开的。",
        "en": "Look at the target edge and corner: they are already paired in two of these cases and separated in the other two."
      },
      {
        "zh": "A+与A-互为镜像，B+与B-互为镜像。",
        "en": "A+ and A− are mirror images, as are B+ and B−."
      }
    ]
  },
  {
    "id": "lesson-3",
    "title": {
      "zh": "顶面调整",
      "en": "Top-layer alignment"
    },
    "question": {
      "zh": "我的魔方和图案有点像，却又不完全一样。",
      "en": "My cube looks similar to the picture, but not quite the same."
    },
    "answer": [
      {
        "zh": "开始复原某对棱角前仅相差 U、U′ 或 U2 属于同一个状态。顶层可随意转动以对应公式。",
        "en": "Before solving a pair, positions differing only by U, U′ or U2 count as the same case. Turn the top layer as needed to match the algorithm."
      }
    ],
    "tips": [
      {
        "zh": "在后续的学习中，也要记得顶层转动对前两层没有影响。",
        "en": "As you continue learning, remember that turning the top layer does not affect the first two layers."
      }
    ]
  },
  {
    "id": "lesson-4",
    "title": {
      "zh": "三步标态教学",
      "en": "Learn the three-move cases"
    },
    "question": {
      "zh": "我已经认得这四种图案了！到底是哪三步？我想看看每一步是怎么把棱角送回槽里的。",
      "en": "I recognize these four pictures now! What are the three moves? I want to see how each one brings the edge and corner into their slot."
    },
    "answer": [
      {
        "zh": "现在逐步学习怎样还原三步标态。先确认朝向，对照动画观察每一步对目标棱角的影响。",
        "en": "Now learn how to solve the three-move cases one move at a time. Check your cube orientation, then follow the animation to see how each move affects the target edge and corner."
      }
    ],
    "tips": [
      {
        "zh": "其他标态通常也会先转化为4种3步标态之一，再3步复原。因此这4种状态一定要深刻理解。",
        "en": "Other standard cases are usually transformed into one of the four three-move cases, then solved in three moves. Make sure you understand these four cases thoroughly."
      },
      {
        "zh": "关注“棱角对”，“槽”，“入槽”这些概念。",
        "en": "Pay attention to the concepts of a “pair”, a “slot”, and “insertion”."
      }
    ]
  },
  {
    "id": "lesson-5",
    "title": {
      "zh": "练习三步标态",
      "en": "Practice three-move cases"
    },
    "question": {
      "zh": "我看懂了！可是真拿起魔方，我能认出来、自己做出来吗？我要试一试！",
      "en": "I understand it now! But with a real cube in my hands, can I recognize the case and solve it myself? I want to try!"
    },
    "answer": [
      {
        "zh": "拿起魔方，按层先法复原前两层，再执行打乱公式，得到只剩最后一组棱角需要还原的练习状态。",
        "en": "Pick up your cube and solve the first two layers using the layer-by-layer method. Then apply the scramble to set up a practice case with only the last pair left to solve."
      }
    ],
    "tips": [
      {
        "zh": "初学者一般先学习在FR槽完成F2L，这样比较顺手。",
        "en": "Beginners usually start by solving F2L pairs in the FR slot, where the moves are more comfortable."
      },
      {
        "zh": "随着学习的深入，你自然会领悟在其他槽完成F2L。",
        "en": "As you learn more, solving F2L pairs in the other slots will become intuitive."
      }
    ]
  },
  {
    "id": "lesson-6",
    "title": {
      "zh": "认识其他标态",
      "en": "Meet the other standard cases"
    },
    "question": {
      "zh": "我会这四种了，可其他情况长什么样呢？",
      "en": "I know these four cases now, but what do the others look like?"
    },
    "answer": [
      {
        "zh": "那可真不少，先来分类看看，不需要立即记忆解法。",
        "en": "There are quite a few! Let us look at them by category first; there is no need to memorize the solutions yet."
      }
    ],
    "tips": [
      {
        "zh": "先观察目标棱、角的位置和朝向，建立印象，不必立即记公式。点击图案可以放大。",
        "en": "First observe the positions and orientations of the target edge and corner. Get familiar with the patterns without memorizing the algorithms yet. Click a picture to enlarge it."
      },
      {
        "zh": "当其余三个槽都已还原，最后一组棱角不可能占据那三个槽，只会在顶层或自己的槽内。",
        "en": "When the other three slots are solved, the last pair cannot occupy those slots. Its pieces can only be on the top layer or in their own slot."
      },
      {
        "zh": "仅差顶层转动的状态视为同一种，尚未完成的状态共有 41 种，称为 F2L 标态。",
        "en": "Treating positions that differ only by a top-layer turn as the same case gives 41 unsolved cases, known as the standard F2L cases."
      },
      {
        "zh": "点击查看本站 F2L 公式库。",
        "en": "Click to view the F2L algorithm library.",
        "href": "/alg/3x3/f2l"
      }
    ]
  },
  {
    "id": "lesson-7",
    "title": {
      "zh": "非标到标态的转化",
      "en": "From non-standard to standard cases"
    },
    "question": {
      "zh": "我现在遇到的情况好像不属于刚刚展示的任何一种，怎么办？",
      "en": "My current case doesn’t seem to match any of the ones just shown. What should I do?"
    },
    "answer": [
      {
        "zh": "整体转动魔方，把卡住目标块的槽转到右前方，做 R U R′。如果另一块反而进入了这个槽，再做一次。",
        "en": "Rotate the whole cube to bring the slot containing the trapped target piece to the front-right, then do R U R′. If the other target piece enters that slot, do it once more."
      }
    ],
    "tips": [
      {
        "zh": "如果目标棱或角跑到了其他槽里，就叫作非标情况。先把它们取到顶层（或目标 FR槽），便能按标态继续学习。",
        "en": "If the target edge or corner is in another slot, this is a non-standard case. Bring the pieces to the top layer or the target FR slot, then continue with a standard case."
      },
      {
        "zh": "此处只练习取出，不接着复原整对。",
        "en": "Here, practice extracting the pieces only; do not continue to solve the pair."
      },
      {
        "zh": "先掌握基础解法即可，不必急着记忆优化解法。随着练习积累，你会逐渐自然领悟这些优化。",
        "en": "Focus on mastering the basic method first. There is no need to memorize the optimized methods yet; these improvements will become intuitive with practice."
      },
      {
        "zh": "(R U R′)(R U R′) 和 R U2 R′ 实际上等效，消除了冗余步骤，是一个很好的优化例子。",
        "en": "(R U R′)(R U R′) is equivalent to R U2 R′. Removing the redundant moves is a good example of optimization."
      },
      {
        "zh": "非标到标态的转化非常灵活，熟练后就不必拘泥于特定解法。",
        "en": "There are many ways to turn a non-standard case into a standard one. With practice, you will no longer need to stick to a particular method."
      },
      {
        "zh": "适合自己的解法才是最好的。",
        "en": "The best method is the one that works for you."
      },
      {
        "zh": "两种方法都只演示取出，不要求最后得到完全相同的顶层位置。",
        "en": "Both methods only demonstrate extraction; they do not need to leave the pieces in exactly the same top-layer positions."
      }
    ]
  },
  {
    "id": "lesson-8",
    "title": {
      "zh": "学习 F2L 公式（一）",
      "en": "Learn F2L algorithms (1)"
    },
    "question": {
      "zh": "这次不是我熟悉的四种图案了。我能不能把它变成已经会的三步标态，再还原呢？",
      "en": "This is not one of the four patterns I know. Can I turn it into a familiar three-move case and solve it from there?"
    },
    "answer": [
      {
        "zh": "把新的情况转化成已经熟悉的三步标态，再完成最后三步。",
        "en": "Turn each new case into a familiar three-move case, then finish the last three moves."
      }
    ],
    "tips": [
      {
        "zh": "本教程优先采用便于理解的逐步转化解法，有些 case 的优秀解法并不经过这些中间状态。",
        "en": "This tutorial favors step-by-step transformations that are easy to understand. Some effective algorithms do not pass through these intermediate cases."
      },
      {
        "zh": "在练习阶段，也可以自由发挥，尝试用自己冗长的解法进行转换，这并不是坏事。",
        "en": "While practicing, feel free to experiment with your own transformations, even if they take more moves. That is a useful part of learning."
      },
      {
        "zh": "熟悉本教程的方法后，可以对照本站 F2L 公式库，学习更高效或更顺手的解法。",
        "en": "Once these methods feel familiar, explore the F2L algorithm library for more efficient or comfortable alternatives."
      },
      {
        "zh": "点击查看本站 F2L 公式库。",
        "en": "Click to view the F2L algorithm library.",
        "href": "/alg/3x3/f2l"
      }
    ]
  },
  {
    "id": "lesson-9",
    "title": {
      "zh": "学习 F2L 公式（二）",
      "en": "Learn F2L algorithms (2)"
    },
    "question": {
      "zh": "这个情况好像更复杂了！我能不能先把它变成上一章学过的样子，再接着做下去？",
      "en": "This case looks more complicated! Can I first turn it into one from the last chapter, then carry on with what I already know?"
    },
    "answer": [
      {
        "zh": "更复杂的情况可以先转化成上一章学过的情况，再到三步标态，最后还原。按括号分段观察每次转化。",
        "en": "More complex cases can first become a case from the previous chapter, then a three-move case, and finally a solved pair. Follow each transformation using the parenthesized sections."
      }
    ],
    "tips": [
      {
        "zh": "本教程优先采用便于理解的逐步转化解法，有些 case 的优秀解法并不经过这些中间状态。",
        "en": "This tutorial favors step-by-step transformations that are easy to understand. Some effective algorithms do not pass through these intermediate cases."
      },
      {
        "zh": "在练习阶段，也可以自由发挥，尝试用自己冗长的解法进行转换，这并不是坏事。",
        "en": "While practicing, feel free to experiment with your own transformations, even if they take more moves. That is a useful part of learning."
      },
      {
        "zh": "熟悉本教程的方法后，可以对照本站 F2L 公式库，学习更高效或更顺手的解法。",
        "en": "Once these methods feel familiar, explore the F2L algorithm library for more efficient or comfortable alternatives."
      },
      {
        "zh": "点击查看本站 F2L 公式库。",
        "en": "Click to view the F2L algorithm library.",
        "href": "/alg/3x3/f2l"
      }
    ]
  },
  {
    "id": "lesson-10",
    "title": {
      "zh": "自由练习",
      "en": "Free practice"
    },
    "question": {
      "zh": "我在练习了，快助我一臂之力！",
      "en": "I’m practicing now—give me a hand!"
    },
    "answer": [
      {
        "zh": "如你所愿，点击棱角摆放需要练习的case。",
        "en": "You got it! Click the edge and corner positions to set up the case you want to practice."
      }
    ],
    "tips": [
      {
        "zh": "点击顶层或 FR槽的棱、角来选择位置，再次点击同一块切换朝向。",
        "en": "Click an edge or corner on the top layer or in the FR slot to choose its position. Click the same piece again to change its orientation."
      },
      {
        "zh": "拖动魔方可调整视角。",
        "en": "Drag the cube to adjust the view."
      },
      {
        "zh": "如果目标棱或角位于其他槽，请先按第 7 章的方法转化为标态。",
        "en": "If the target edge or corner is in another slot, first use the method in Chapter 7 to turn it into a standard case."
      },
      {
        "zh": "点击“重新摆放”可返回刚才设置的情况。",
        "en": "Choose “Edit the case” to return to the position you set."
      },
      {
        "zh": "先复原前两层，再按上方所选朝向执行打乱。",
        "en": "Solve the first two layers, then apply the scramble with the orientation selected above."
      }
    ]
  }
] as const satisfies readonly ChapterContent[];

export type ChapterId = typeof F2L_CHAPTERS[number]['id'];
