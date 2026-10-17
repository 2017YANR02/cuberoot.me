'use client';

import { useMemo, useState } from 'react';
import { VisualCube } from '@/components/VisualCube';
import AlgPlayer from '@/components/AlgPlayer/AlgPlayer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from '@/components/AppLink';
import { tr, T } from '@/i18n/tr';
import { f2lPlaybackSections } from './content';
import { f2lCatalogCases, f2lCatalogDiagrams, f2lGroupName, f2lNonstandardExamples, f2lSmartExtraction, f2lTeachingPaths } from './curriculum';

const NO_STOPS: readonly number[] = [];
const EXTRACTION_TITLES = {
  edge: { zh: '棱在其他槽内', en: 'Edge in another slot' },
  corner: { zh: '角在其他槽内', en: 'Corner in another slot' },
  together: { zh: '棱角在同一个其他槽内', en: 'Both pieces in the same other slot' },
  apart: { zh: '棱角在不同槽内', en: 'Pieces in different slots' },
};

export default function LaterLessons({ stepId, orientation, pauseBetween }: { stepId: string; orientation: string; pauseBetween: boolean }) {
  const [caseName, setCaseName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [extractionKind, setExtractionKind] = useState<keyof typeof EXTRACTION_TITLES>('edge');
  const [extractionIndices, setExtractionIndices] = useState<Record<string, number>>({});
  const cases = useMemo(() => f2lCatalogCases(), []);
  const diagrams = useMemo(() => f2lCatalogDiagrams(cases, orientation), [cases, orientation]);
  const paths = useMemo(() => stepId === 'lesson-8' || stepId === 'lesson-9' ? f2lTeachingPaths(cases) : [], [cases, stepId]);
  const examples = useMemo(() => stepId === 'lesson-7' ? f2lNonstandardExamples(8) : [], [stepId]);
  const extractionChoices = examples.filter(example => example.kind === extractionKind);
  const extractionIndex = extractionIndices[extractionKind] ?? 0;
  const extraction = extractionChoices[extractionIndex];
  const smartExtraction = useMemo(() => extraction ? f2lSmartExtraction(extraction.setup) : '', [extraction]);
  const groups = [...new Set(diagrams.map(c => c.group))];
  const activeGroup = groups.includes(selectedGroup) ? selectedGroup : groups[0];

  if (stepId === 'lesson-7') return <>
    <p className="f2l-lead"><T zh="当前要还原的仍是 FR槽的棱角对。如果目标棱或角跑到了其他槽里，就叫作非标情况。先把它们取到顶层（或目标 FR槽），便能按标态继续学习。" en="The goal is still the pair belonging in FR. If its corner or edge is in another slot, it is a non-standard F2L case. Bring those pieces to the top layer or their FR slot before applying a standard case." /></p>
    <p><T zh="最直接的方法：整体转动魔方，把卡住目标块的槽转到右前方，执行 R U R′。如果另一块反而进入了这个槽，再执行一次，然后转回原来的朝向。目标槽由最初选择的中心颜色确定，不会因为转体而改变。" en="Use this simple method: rotate the whole cube to bring the trapped piece's slot to front-right, then do R U R′. If the other target piece enters that slot, repeat the trigger, then return to the original orientation. The target slot is still defined by your original center colors." /></p>
    <p><T zh="此处只练习取出，不接着复原整对。" en="These examples stop after extraction, before solving the pair." /></p>
    <div className="f2l-cases" role="group" aria-label={tr({ zh: '选择非标类型', en: 'Choose a non-standard case type' })}>
      {(Object.keys(EXTRACTION_TITLES) as (keyof typeof EXTRACTION_TITLES)[]).map(kind => <button key={kind} type="button"
        aria-pressed={extractionKind === kind} onClick={() => setExtractionKind(kind)}>{tr(EXTRACTION_TITLES[kind])}</button>)}
    </div>
    {extraction && <>
    <div className="f2l-extraction-comparison">{[
      { id: 'mechanical', title: tr({ zh: '基础解法', en: 'Basic method' }), alg: extraction.alg },
      { id: 'smart', title: tr({ zh: '优化解法', en: 'Optimized method' }), alg: smartExtraction },
    ].map(method => <section className="f2l-extraction" key={method.id} aria-label={method.title}>
      <h3>{method.title}</h3>
      <div className="f2l-cube"><AlgPlayer key={method.id + ':' + extraction.setup} puzzle="3x3" set="f2l-tutorial" engine="sim" setup={extraction.setup} alg={method.alg}
        orientation={orientation} fillPane moveDurationMs={850}
        sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? f2lPlaybackSections(method.alg).slice(0, -1).map(section => section.end) : NO_STOPS} /></div>
      <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{method.alg}</code>
    </section>)}</div>
    <div className="f2l-extraction-actions">
      <button type="button" className="f2l-restart" disabled={extractionChoices.length < 2} onClick={() => {
        const candidate = Math.floor(Math.random() * (extractionChoices.length - 1));
        setExtractionIndices(current => ({ ...current, [extractionKind]: candidate >= extractionIndex ? candidate + 1 : candidate }));
      }}><T zh="换一个例子" en="Try another example" /></button>
    </div></>}
    <p><T zh="先掌握“转到右前，再做 R U R′”这一种基础解法即可，不必急着记忆优化解法。随着练习积累，你会逐渐自然领悟这些优化。" en="For now, learning the basic method is enough: bring the slot to front-right, then do R U R′. There is no need to memorize the optimized method yet; these improvements will become intuitive with practice." /></p>
    <p><T zh="两种方法都只演示取出，不要求最后得到完全相同的顶层位置。" en="Both methods only extract the pieces; their final top-layer positions may differ." /></p>
  </>;

  if (stepId === 'lesson-6') return <>
    <p className="f2l-lead"><T zh="除去已经学过的四种三步标态，还有下面这些情况。先观察目标棱、角的位置和朝向，建立印象，不必立即记公式。点击图案可以放大。" en="These are the remaining standard cases after the four three-move cases. For now, observe the positions and orientations of the corner and edge; there is no need to learn their algorithms yet. Click a picture to enlarge it." /></p>
    <p><T zh="当其余三个槽都已还原，最后一组棱角不可能占据那三个槽，只会在顶层或自己的槽内。因此，把仅差顶层转动的情况视为同一种后，尚未完成的状态共分为 41 种，称为 F2L 标态。除去四种三步标态，其余 37 种如下。" en="With the other three slots solved, the last pair cannot be in those slots: its pieces must be on top or in their own slot. Treating top-layer rotations as the same case gives 41 unsolved standard F2L cases. The 37 cases other than the four three-move cases are shown below." /></p>
    <div className="f2l-cases f2l-group-options" role="group" aria-label={tr({ zh: '选择情况分组', en: 'Choose a case group' })}>
      {groups.map(group => <button key={group} type="button" aria-pressed={activeGroup === group} onClick={() => setSelectedGroup(group)}>
        <VisualCube view="iso" size={68} faceletColors={diagrams.find(c => c.group === group)!.facelets} alt="" />
        <span>{tr(f2lGroupName(group))}</span>
      </button>)}
    </div>
    <section className="f2l-catalog-group">
      <h3>{tr(f2lGroupName(activeGroup))}</h3>
      <div className="f2l-recognition">{diagrams.filter(c => c.group === activeGroup).map(c => <figure key={c.name}>
        <VisualCube view="iso" size={150} faceletColors={c.facelets} interactive enlargeable alt={c.name} />
        <figcaption>{c.name}</figcaption>
      </figure>)}</div>
    </section>
    <p><Link href="/alg/3x3/f2l" prefetch={false}><T zh="查看本站 F2L 公式库" en="View the F2L algorithm library" /></Link></p>
  </>;

  const chapter = stepId === 'lesson-8' ? 8 : 9;
  const lessons = paths.filter(c => c.chapter === chapter);
  const lesson = lessons.find(c => c.name === caseName) ?? lessons[0];
  const lessonGroups = [...new Set(lessons.map(c => c.group))];
  const visibleLessons = chapter === 8 ? lessons.filter(c => c.group === lesson?.group) : lessons;
  const lessonIndex = lessons.findIndex(c => c.name === lesson?.name);
  const groupIndex = lessonGroups.indexOf(lesson?.group ?? '');
  const caseIndex = visibleLessons.findIndex(c => c.name === lesson?.name);
  const pickerLabel = (name: string, label: string) => <span className="f2l-picker-value">
    <VisualCube view="iso" size={52} faceletColors={diagrams.find(c => c.name === name)!.facelets} alt="" />
    <span>{label}</span>
  </span>;
  return <>
    <p className="f2l-lead">{chapter === 8
      ? <T zh="把新的情况转化成已经熟悉的三步标态，再完成最后三步。观察转换过程中棱角的位置变化，不必一次记住整条公式。" en="Turn each new case into a familiar three-move case, then finish the insertion. Watch how the edge and corner move during the transformation before trying to remember the whole algorithm." />
      : <T zh="更复杂的情况可以先转化成上一章学过的情况，再到三步标态，最后还原。按括号分段观察每次转化。" en="More complex cases can first become a case from the previous chapter, then a three-move case, and finally a solved pair. Follow each transformation using the parenthesized sections." />}</p>
    {!lesson ? <p><T zh="本节教学案例待补充。" en="Teaching examples for this chapter are being prepared." /></p> : <>
      {chapter === 8 ? <div className="f2l-case-pickers">
        <div className="f2l-lesson-picker" role="group" aria-label={tr({ zh: '选择情况分组', en: 'Choose a case group' })}>
          <button type="button" className="f2l-picker-arrow" disabled={groupIndex === 0}
            aria-label={tr({ zh: '上一种类型', en: 'Previous case group' })}
            onClick={() => setCaseName(lessons.find(c => c.group === lessonGroups[groupIndex - 1])!.name)}><ChevronLeft size={20} /></button>
          {pickerLabel(lessons.find(c => c.group === lesson.group)!.name, tr(f2lGroupName(lesson.group)))}
          <button type="button" className="f2l-picker-arrow" disabled={groupIndex === lessonGroups.length - 1}
            aria-label={tr({ zh: '下一种类型', en: 'Next case group' })}
            onClick={() => setCaseName(lessons.find(c => c.group === lessonGroups[groupIndex + 1])!.name)}><ChevronRight size={20} /></button>
        </div>
        <div className="f2l-lesson-picker" role="group" aria-label={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}>
          <button type="button" className="f2l-picker-arrow" disabled={caseIndex === 0}
            aria-label={tr({ zh: '上一个 case', en: 'Previous case' })}
            onClick={() => setCaseName(visibleLessons[caseIndex - 1].name)}><ChevronLeft size={20} /></button>
          {pickerLabel(lesson.name, lesson.name)}
          <button type="button" className="f2l-picker-arrow" disabled={caseIndex === visibleLessons.length - 1}
            aria-label={tr({ zh: '下一个 case', en: 'Next case' })}
            onClick={() => setCaseName(visibleLessons[caseIndex + 1].name)}><ChevronRight size={20} /></button>
        </div>
      </div> : <div className="f2l-cases f2l-teaching-cases" role="group" aria-label={tr({ zh: '选择教学情况', en: 'Choose a teaching case' })}>
        {visibleLessons.map(c => <button key={c.name} type="button" aria-pressed={lesson.name === c.name} onClick={() => setCaseName(c.name)}>
          <VisualCube view="iso" size={82} faceletColors={diagrams.find(diagram => diagram.name === c.name)!.facelets} alt="" />
          <span>{c.name}</span>
        </button>)}
      </div>}
      <div className="f2l-lesson">
        <section className="f2l-demo">
          {chapter === 9 && <div className="f2l-case-navigation" role="group" aria-label={tr({ zh: '切换教学情况', en: 'Navigate teaching cases' })}>
            <button type="button" className="f2l-restart" disabled={lessonIndex === 0} onClick={() => setCaseName(lessons[lessonIndex - 1].name)}><T zh="上一个" en="Previous" /></button>
            <span>{lesson.name}</span>
            <button type="button" className="f2l-restart" disabled={lessonIndex === lessons.length - 1} onClick={() => setCaseName(lessons[lessonIndex + 1].name)}><T zh="下一个" en="Next" /></button>
          </div>}
          <div className="f2l-cube"><AlgPlayer key={lesson.name} puzzle="3x3" set="f2l-tutorial" engine="sim" setup={lesson.setup} alg={lesson.alg}
            orientation={orientation} fillPane moveDurationMs={850}
            sectionPauseMs={2000} pauseAfterSteps={pauseBetween ? lesson.sections.slice(0, -1).map(section => section.end) : NO_STOPS} /></div>
          <code className="f2l-alg f2l-player-alg" data-site-surface="panel">{lesson.alg}</code>
        </section>
        <section className="f2l-guidance f2l-teaching-guidance">
          <h3><T zh="打乱公式" en="Scramble" /></h3>
          <p><code className="f2l-alg f2l-player-alg f2l-scramble-alg" data-site-surface="panel">{lesson.setup}</code></p>
          <h3>{lesson.chain.join(' → ')} → <T zh="还原" en="Solved" /></h3>
          <ol>{lesson.sections.map((section, index) => <li key={section.start}>
            <code>{section.alg}</code> — {index === lesson.sections.length - 1
              ? <T zh="完成还原" en="Solve the pair" />
              : <><T zh="转化为 " en="Reach " />{lesson.chain[index + 1]}</>}
          </li>)}</ol>
        </section>
      </div>
    </>}
    <p className="f2l-curriculum-note"><T zh="本教程优先采用便于理解的逐步转化解法。有些 case 的优秀解法并不经过这些中间状态；熟悉本教程的方法后，可以对照本站 F2L 公式库，进一步学习更高效或更顺手的解法。" en="This tutorial favors step-by-step transformations that are easy to understand. Some effective algorithms take a different route without passing through these intermediate cases. Once you are comfortable with the methods here, explore the F2L algorithm library for alternatives that are more efficient or feel more natural to execute." /></p>
    <p className="f2l-library-link"><Link href="/alg/3x3/f2l" prefetch={false}><T zh="查看本站 F2L 公式库" en="View the F2L algorithm library" /></Link></p>
  </>;
}
