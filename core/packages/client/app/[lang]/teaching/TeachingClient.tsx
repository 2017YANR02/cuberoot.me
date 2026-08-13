'use client';

import { useEffect, useState } from 'react';
import { Clock3, Mic2, Target, Video } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import LangToggle from '@/components/LangToggle';
import { T } from '@/i18n/tr';
import { nextQuery, useIsAdmin } from '@/lib/auth-store';
import {
  courseLessons,
  lessonMinutes,
  stageLessons,
  TEACHING_COURSES,
  TEACHING_LESSON_COUNT,
  TEACHING_TOTAL_MINUTES,
} from './_data';
import type { LessonKind, MicroCourse, Module } from './_data/types';
import './teaching.css';

const KIND_LABELS: Record<LessonKind, string> = {
  concept: '概念',
  case: '案例',
  drill: '跟练',
  example: '例解',
  resource: '资料',
  milestone: '过关',
};

function courseMinutes(course: MicroCourse) {
  return lessonMinutes(courseLessons(course));
}

function moduleMinutes(module: Module) {
  return lessonMinutes(module.lessons);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function ChineseTeachingPage() {
  const average = (TEACHING_TOTAL_MINUTES / TEACHING_LESSON_COUNT).toFixed(1);

  return (
    <main className="teaching-page">
      <header className="teaching-hero">
        <BackHome />
        <p className="teaching-eyebrow">儿童三阶魔方录播微课</p>
        <h1>课程树与提词稿</h1>
        <p className="teaching-lead">
          先用试听课获得第一次成功，再用层先法独立复原，最后按案例系统学习 CFOP。每节只讲一个目标，适合暂停、跟练和反复复习。
        </p>

        <div className="teaching-stats" aria-label="课程规模">
          <span><strong>{TEACHING_LESSON_COUNT}</strong> 节微课</span>
          <span><strong>1–5</strong> 分钟一节</span>
          <span><strong>{average}</strong> 分钟平均</span>
          <span><strong>{formatDuration(TEACHING_TOTAL_MINUTES)}</strong> 总时长</span>
        </div>

        <nav className="teaching-course-nav" aria-label="跳转到课程">
          {TEACHING_COURSES.map((course) => {
            const lessons = courseLessons(course);
            return (
              <a key={course.id} href={`#${course.id}`}>
                <span>{course.label}</span>
                {lessons.length} 节：{course.title}
              </a>
            );
          })}
        </nav>
      </header>

      <section className="teaching-principles" aria-labelledby="recording-rules">
        <div className="teaching-section-heading">
          <p className="teaching-kicker">微课规则</p>
          <h2 id="recording-rules">一节一件事，看完马上练</h2>
        </div>
        <div className="teaching-principle-grid">
          <article>
            <Clock3 aria-hidden="true" />
            <h3>1–5 分钟</h3>
            <p>单个案例通常 2–3 分钟；需要完整跟练、阶段过关或例解时才延长到 4–5 分钟。</p>
          </article>
          <article>
            <Target aria-hidden="true" />
            <h3>一个过关标准</h3>
            <p>结尾必须能判断是否学会，例如连续五次做对、说出判断理由，或完整完成一个阶段。</p>
          </article>
          <article>
            <Video aria-hidden="true" />
            <h3>三个固定镜头</h3>
            <p>标准形状、慢速执行、正常速度结果。孩子随时暂停，也能看清拿法和目标块的位置。</p>
          </article>
          <article>
            <Mic2 aria-hidden="true" />
            <h3>儿童口语提词</h3>
            <p>方括号里是镜头提示，不需要念；其余内容可以直接口播，再按录制时的自然语气微调。</p>
          </article>
        </div>
      </section>

      {TEACHING_COURSES.map((course, courseIndex) => {
        const lessons = courseLessons(course);
        const moduleCount = course.stages.reduce((total, stage) => total + stage.modules.length, 0);

        return (
          <section key={course.id} id={course.id} className="teaching-course" aria-labelledby={`${course.id}-title`}>
            <div className="teaching-course-head">
              <div className="teaching-course-number" aria-hidden="true">0{courseIndex + 1}</div>
              <div>
                <p className="teaching-kicker">{course.label}</p>
                <h2 id={`${course.id}-title`}>{course.title}</h2>
                <p>{course.summary}</p>
                <dl className="teaching-course-meta">
                  <div><dt>适合</dt><dd>{course.audience}</dd></div>
                  <div><dt>结构</dt><dd>{course.stages.length} 个阶段，{moduleCount} 个模块，{lessons.length} 节</dd></div>
                  <div><dt>时长</dt><dd>约 {formatDuration(courseMinutes(course))}</dd></div>
                </dl>
              </div>
            </div>

            <div className="teaching-stages">
              {course.stages.map((stage, stageIndex) => {
                const lessonsInStage = stageLessons(stage);
                return (
                  <details key={stage.id} className="teaching-stage" open={courseIndex < 2 || stageIndex === 0}>
                    <summary>
                      <span className="teaching-stage-index">阶段 {stageIndex + 1}</span>
                      <span className="teaching-stage-title">{stage.title}</span>
                      <span className="teaching-stage-summary">{stage.summary}</span>
                      <span className="teaching-stage-count">{lessonsInStage.length} 节</span>
                    </summary>

                    <div className="teaching-modules">
                      {stage.modules.map((module, moduleIndex) => (
                        <details key={module.id} id={module.id} className="teaching-module" open={courseIndex === 0 || (courseIndex === 1 && moduleIndex === 0)}>
                          <summary>
                            <span className="teaching-module-index">{String(moduleIndex + 1).padStart(2, '0')}</span>
                            <span className="teaching-module-title">{module.title}</span>
                            <span className="teaching-module-summary">{module.summary}</span>
                            <span className="teaching-module-count">{module.lessons.length} 节，{moduleMinutes(module)} 分钟</span>
                          </summary>

                          <div className="teaching-module-body">
                            {module.resource && (
                              <Link href={module.resource.href} className="teaching-module-resource" prefetch={false}>
                                {module.resource.label}
                              </Link>
                            )}

                            <div className="teaching-lessons">
                              {module.lessons.map((lesson, lessonIndex) => (
                                <details key={lesson.id} className="teaching-lesson" open={courseIndex === 0 && moduleIndex === 0 && lessonIndex === 0}>
                                  <summary>
                                    <span className="teaching-lesson-index">{String(lessonIndex + 1).padStart(2, '0')}</span>
                                    <span className="teaching-lesson-kind">{KIND_LABELS[lesson.kind]}</span>
                                    <span className="teaching-lesson-title">{lesson.title}</span>
                                    <span className="teaching-lesson-outcome">{lesson.outcome}</span>
                                    <span className="teaching-lesson-time">{lesson.minutes} 分钟</span>
                                  </summary>

                                  <div className="teaching-lesson-body">
                                    <aside className="teaching-shot-list">
                                      <h3>拍摄清单</h3>
                                      <ol>
                                        {lesson.shots.map((shot) => <li key={shot}>{shot}</li>)}
                                      </ol>
                                      {lesson.formulas && (
                                        <div className="teaching-formulas">
                                          <h3>本节公式卡</h3>
                                          {lesson.formulas.map((formula) => (
                                            <div key={formula.name} className="teaching-formula">
                                              <strong>{formula.name}</strong>
                                              <code>{formula.alg}</code>
                                              <p>{formula.note}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </aside>

                                    <article className="teaching-script">
                                      <h3>提词稿</h3>
                                      {lesson.script.map((line, lineIndex) => (
                                        <p key={`${lesson.id}-${lineIndex}`} className={line.startsWith('【') ? 'teaching-stage-direction' : undefined}>
                                          {line}
                                        </p>
                                      ))}
                                    </article>
                                  </div>
                                </details>
                              ))}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="teaching-production" aria-labelledby="production-title">
        <div className="teaching-section-heading">
          <p className="teaching-kicker">录制顺序</p>
          <h2 id="production-title">按模块批量录，不按整门课硬撑</h2>
        </div>
        <ol>
          <li><strong>先录五节试听微课。</strong>验证机位、手部特写、字幕字号和孩子是否能在每节结尾完成挑战。</li>
          <li><strong>再录层先法前八节。</strong>找 3–5 个目标年龄孩子试看，记录他们在哪个判断停住，而不只问“喜欢吗”。</li>
          <li><strong>固定模板后按模块录制。</strong>同一天集中拍同类案例，统一起始角度、公式卡和过关提示，减少反复布置机位。</li>
          <li><strong>引流只承诺真实下一步。</strong>试听结尾展示 24 节层先法地图，并邀请家长领取练习清单或进入完整课程，不制造虚假倒计时。</li>
        </ol>
      </section>

      <footer className="teaching-references">
        <h2>编排参考与原创边界</h2>
        <p>
          CFOP 的阶段划分和案例覆盖参考了{' '}
          <a href="https://app.cubing.gg/my/view/course?id=edhm7vue" target="_blank" rel="noreferrer">Tymon’s CFOP Course</a>
          {' '}与{' '}
          <a href="https://cubeskills.com/categories/3x3" target="_blank" rel="noreferrer">CubeSkills 三阶目录</a>
          。案例编号采用通用魔方分类；中文教学顺序、镜头清单和提词稿均为本站重新编写。公式在正式录制前需与站内公式库逐项核对。
        </p>
      </footer>
    </main>
  );
}

function EnglishFallback() {
  return (
    <main className="teaching-page teaching-language-fallback">
      <BackHome />
      <p className="teaching-eyebrow">Recorded course plan</p>
      <h1>This page is currently available in Simplified Chinese only</h1>
      <p>The curriculum and teleprompter scripts are written for a Chinese-language children’s course.</p>
      <LangToggle className="teaching-language-toggle" />
    </main>
  );
}

function TeachingAccessNotice() {
  const pathname = usePathname();

  return (
    <main className="teaching-page teaching-language-fallback">
      <BackHome />
      <p className="teaching-eyebrow"><T zh="课程筹备中" en="Coming soon" /></p>
      <h1><T zh="教学页面暂未公开" en="This teaching page is not public yet" /></h1>
      <p><T zh="目前仅供管理员预览课程内容，正式课程准备好后再向所有人开放。" en="For now, only administrators can preview the course content." /></p>
      <Link href={`/account${nextQuery(pathname)}`} className="teaching-admin-login" prefetch={false}>
        <T zh="登录管理员账号" en="Administrator sign in" />
      </Link>
    </main>
  );
}

export default function TeachingClient({ lang }: { lang: string }) {
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;
  if (!isAdmin) return <TeachingAccessNotice />;
  if (lang !== 'zh') return <EnglishFallback />;
  return <ChineseTeachingPage />;
}
