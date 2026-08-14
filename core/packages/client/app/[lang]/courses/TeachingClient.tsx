'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Clock3, Mic2, Target, Video } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { T, tr } from '@/i18n/tr';
import { nextQuery, useIsAdmin } from '@/lib/auth-store';
import {
  courseLessons,
  lessonMinutes,
  stageLessons,
  TEACHING_COURSES,
  TEACHING_LESSON_COUNT,
  TEACHING_TOTAL_MINUTES,
} from './_data';
import type { LessonKind, LocalizedText, MicroCourse, Module } from './_data/types';
import AdvancedCourseSection from './AdvancedCourseSection';
import './teaching.css';

const KIND_LABELS: Record<LessonKind, LocalizedText> = {
  concept: { zh: '概念', en: 'Concept' },
  case: { zh: '案例', en: 'Case' },
  drill: { zh: '跟练', en: 'Drill' },
  example: { zh: '例解', en: 'Example' },
  resource: { zh: '资料', en: 'Sheet' },
  milestone: { zh: '过关', en: 'Checkpoint' },
};

const TEACHING_ACCESS_KEY = 'teaching-preview-access';
const TEACHING_PASSWORD_HASH = '94ddc9c97aff29f4c52486f4d2124a5c839a3a25af08d9d1b07f464a212ecbe2';

async function matchesTeachingPassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') === TEACHING_PASSWORD_HASH;
}

function courseMinutes(course: MicroCourse) {
  return lessonMinutes(courseLessons(course));
}

function moduleMinutes(module: Module) {
  return lessonMinutes(module.lessons);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return tr({ zh: `${rest} 分钟`, en: `${rest} min` });
  if (rest === 0) return tr({ zh: `${hours} 小时`, en: `${hours} hr` });
  return tr({ zh: `${hours} 小时 ${rest} 分钟`, en: `${hours} hr ${rest} min` });
}

function TeachingPage({ isAdmin }: { isAdmin: boolean }) {
  const average = (TEACHING_TOTAL_MINUTES / TEACHING_LESSON_COUNT).toFixed(1);

  return (
    <main className="teaching-page">
      <header className="teaching-hero">
        <BackHome />
        <p className="teaching-eyebrow"><T zh="三阶魔方录播课" en="Recorded 3×3 lessons" /></p>
        <h1><T zh="课程" en="Courses" /></h1>
        <p className="teaching-lead">
          <T
            zh="先用试听课获得第一次成功，再用层先法独立复原，按案例系统学习 CFOP，之后继续拓展三阶与二阶进阶内容。每节只讲一个目标，适合暂停、跟练和反复复习。"
            en="Begin with a first win in the trial, learn an independent solve with the beginner method, study CFOP case by case, then continue into advanced 3×3 and 2×2 topics. Every lesson has one goal and is designed for pausing and practice."
          />
        </p>

        <div className="teaching-stats" aria-label={tr({ zh: '课程规模', en: 'Course scale' })}>
          <span><strong>{TEACHING_LESSON_COUNT}</strong> <T zh="节课" en="lessons" /></span>
          <span><strong>1–5</strong> <T zh="分钟一节" en="minutes each" /></span>
          <span><strong>{average}</strong> <T zh="分钟平均" en="minutes average" /></span>
          <span><strong>{formatDuration(TEACHING_TOTAL_MINUTES)}</strong> <T zh="总时长" en="total" /></span>
        </div>

        <nav className="teaching-course-nav" aria-label={tr({ zh: '跳转到课程', en: 'Jump to course' })}>
          {TEACHING_COURSES.map((course) => {
            const lessons = courseLessons(course);
            return (
              <a key={course.id} href={`#${course.id}`}>
                <span>{tr(course.label)}</span>
                {lessons.length} <T zh="节：" en="lessons: " />{tr(course.title)}
              </a>
            );
          })}
          <a href="#advanced">
            <span><T zh="后续课程" en="Further courses" /></span>
            <T zh="两条路线：三阶与二阶进阶" en="Two tracks: advanced 3×3 and 2×2" />
          </a>
        </nav>
      </header>

      <section className="teaching-principles" aria-labelledby="recording-rules">
        <div className="teaching-section-heading">
          <p className="teaching-kicker"><T zh="课程规则" en="Lesson rules" /></p>
          <h2 id="recording-rules"><T zh="一节一件事，看完马上练" en="One goal per lesson, then practise immediately" /></h2>
        </div>
        <div className="teaching-principle-grid">
          <article>
            <Clock3 aria-hidden="true" />
            <h3><T zh="1–5 分钟" en="1–5 minutes" /></h3>
            <p><T zh="单个案例通常 2–3 分钟；完整跟练、阶段过关或例解才延长到 4–5 分钟。" en="A single case usually takes 2–3 minutes; drills, checkpoints, and examples may take 4–5." /></p>
          </article>
          <article>
            <Target aria-hidden="true" />
            <h3><T zh="一个过关标准" en="One pass target" /></h3>
            <p><T zh="结尾必须能判断是否学会，例如连续做对、说出判断理由，或完整完成一个阶段。" en="Every ending has a test: repeat accurately, explain the recognition clue, or complete a stage." /></p>
          </article>
          <article>
            <Video aria-hidden="true" />
            <h3><T zh="三个固定镜头" en="Three fixed shots" /></h3>
            <p><T zh="标准形状、慢速执行、正常速度结果。学员暂停视频也能看清拿法和目标块。" en="Standard case, slow execution, and normal-speed result so grips and target pieces remain clear." /></p>
          </article>
          <article>
            <Mic2 aria-hidden="true" />
            <h3><T zh="口语化提词" en="Natural narration" /></h3>
            <p><T zh="方括号里是镜头提示，不需要念；其余内容可直接口播，再按录制语气微调。" en="Bracketed lines are production directions. Everything else can be read aloud and adjusted naturally while recording." /></p>
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
                <p className="teaching-kicker">{tr(course.label)}</p>
                <h2 id={`${course.id}-title`}>{tr(course.title)}</h2>
                <p>{tr(course.summary)}</p>
                <dl className="teaching-course-meta">
                  <div><dt><T zh="适合" en="For" /></dt><dd>{tr(course.audience)}</dd></div>
                  <div><dt><T zh="结构" en="Structure" /></dt><dd>{course.stages.length} <T zh="个阶段，" en="stages, " />{moduleCount} <T zh="个模块，" en="modules, " />{lessons.length} <T zh="节" en="lessons" /></dd></div>
                  <div><dt><T zh="时长" en="Duration" /></dt><dd><T zh="约 " en="About " />{formatDuration(courseMinutes(course))}</dd></div>
                </dl>
              </div>
            </div>

            <div className="teaching-stages">
              {course.stages.map((stage, stageIndex) => {
                const lessonsInStage = stageLessons(stage);
                return (
                  <details key={stage.id} className="teaching-stage" open={courseIndex < 2 || stageIndex === 0}>
                    <summary>
                      <span className="teaching-stage-index"><T zh="阶段 " en="Stage " />{stageIndex + 1}</span>
                      <span className="teaching-stage-title">{tr(stage.title)}</span>
                      <span className="teaching-stage-summary">{tr(stage.summary)}</span>
                      <span className="teaching-stage-count">{lessonsInStage.length} <T zh="节" en="lessons" /></span>
                    </summary>

                    <div className="teaching-modules">
                      {stage.modules.map((courseModule, moduleIndex) => (
                        <details key={courseModule.id} id={courseModule.id} className="teaching-module" open={courseIndex === 0 || (courseIndex === 1 && moduleIndex === 0)}>
                          <summary>
                            <span className="teaching-module-index">{String(moduleIndex + 1).padStart(2, '0')}</span>
                            <span className="teaching-module-title">{tr(courseModule.title)}</span>
                            <span className="teaching-module-summary">{tr(courseModule.summary)}</span>
                            <span className="teaching-module-count">{courseModule.lessons.length} <T zh="节，" en="lessons, " />{formatDuration(moduleMinutes(courseModule))}</span>
                          </summary>

                          <div className="teaching-module-body">
                            {courseModule.resource && (
                              <Link href={courseModule.resource.href} className="teaching-module-resource" prefetch={false}>
                                {tr(courseModule.resource.label)}
                              </Link>
                            )}

                            <div className="teaching-lessons">
                              {courseModule.lessons.map((lesson, lessonIndex) => (
                                <details key={lesson.id} className="teaching-lesson" open={courseIndex === 0 && moduleIndex === 0 && lessonIndex === 0}>
                                  <summary>
                                    <span className="teaching-lesson-index">{String(lessonIndex + 1).padStart(2, '0')}</span>
                                    <span className="teaching-lesson-kind">{tr(KIND_LABELS[lesson.kind])}</span>
                                    <span className="teaching-lesson-title">{tr(lesson.title)}</span>
                                    <span className="teaching-lesson-outcome">{tr(lesson.outcome)}</span>
                                    <span className="teaching-lesson-time">{lesson.minutes} <T zh="分钟" en="min" /></span>
                                  </summary>

                                  <div className="teaching-lesson-body">
                                    <aside className="teaching-shot-list">
                                      <h3><T zh="拍摄清单" en="Shot list" /></h3>
                                      <ol>
                                        {lesson.shots.map((shot, shotIndex) => <li key={shotIndex}>{tr(shot)}</li>)}
                                      </ol>
                                      {lesson.formulas && (
                                        <div className="teaching-formulas">
                                          <h3><T zh="本节公式卡" en="Algorithm card" /></h3>
                                          {lesson.formulas.map((formula, formulaIndex) => (
                                            <div key={formulaIndex} className="teaching-formula">
                                              <strong>{tr(formula.name)}</strong>
                                              <code>{formula.alg}</code>
                                              <p>{tr(formula.note)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </aside>

                                    <article className="teaching-script">
                                      <h3><T zh="完整口播" en="Complete narration" /></h3>
                                      {lesson.script.map((line, lineIndex) => (
                                        <p key={`${lesson.id}-${lineIndex}`} className={line.zh.startsWith('【') ? 'teaching-stage-direction' : undefined}>
                                          {tr(line)}
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

      <AdvancedCourseSection isAdmin={isAdmin} />

      <section className="teaching-production" aria-labelledby="production-title">
        <div className="teaching-section-heading">
          <p className="teaching-kicker"><T zh="录制顺序" en="Recording order" /></p>
          <h2 id="production-title"><T zh="按模块批量录，不按整门课硬撑" en="Record in module batches, not one huge course" /></h2>
        </div>
        <ol>
          <li><strong><T zh="先录五节试听课。" en="Record the five trial lessons first. " /></strong><T zh="验证机位、手部特写、字幕字号和学员能否完成结尾挑战。" en="Validate camera angles, hand close-ups, subtitle size, and whether learners can pass each final challenge." /></li>
          <li><strong><T zh="再录层先法前八节。" en="Then record the first eight beginner lessons. " /></strong><T zh="让 3–5 位目标学员试看，记录他们在哪个判断停住。" en="Test with three to five target learners and record where their decisions stop." /></li>
          <li><strong><T zh="模板稳定后按模块录。" en="Batch by module once the template is stable. " /></strong><T zh="同类案例统一起始角度、公式卡和过关提示。" en="Keep starting angles, algorithm cards, and pass prompts consistent across related cases." /></li>
          <li><strong><T zh="试听结尾明确引导购买。" en="End the trial with a clear purchase path. " /></strong><T zh="不会独立复原的学员选择 26 节层先法正式课；已经会复原并想提速的学员选择 CFOP 正式课；零基础且希望继续提速的学员先学层先法，再进入 CFOP。" en="Learners who cannot solve independently choose the 26-lesson beginner-method course; learners who can solve and want more speed choose CFOP; complete beginners who want to progress further take the beginner method first, then CFOP." /></li>
          <li><strong><T zh="CFOP 稳定后再录后续课程。" en="Record further courses after CFOP is stable. " /></strong><T zh="三阶路线继续补足高级 CFOP、其他解法、预判、公式原理与复盘；二阶路线逐步进入 CLL、EG、LEG 与 TCLL。" en="The 3×3 track continues through advanced CFOP, other methods, lookahead, algorithm theory, and solve review; the 2×2 track progresses into CLL, EG, LEG, and TCLL." /></li>
        </ol>
      </section>

      <footer className="teaching-references">
        <h2><T zh="编排参考与原创边界" en="Curriculum references and original-writing boundary" /></h2>
        <p>
          <T zh="课程范围参考了 " en="The curriculum scope was informed by " />
          <a href="https://app.cubing.gg/my/view/course?id=edhm7vue" target="_blank" rel="noreferrer">Tymon&apos;s CFOP Course</a>
          <T zh=" 与 " en=" and " />
          <a href="https://cubeskills.com/categories/3x3" target="_blank" rel="noreferrer">CubeSkills 3x3</a>
          <T zh="。案例编号采用通用魔方分类；中英文教学顺序、镜头清单和完整口播均为本站重新编写。正式录制前请与站内公式库逐项核对公式。" en=". Case numbers use standard cubing classifications. The bilingual sequence, shot lists, and complete narration are original to this site. Verify every algorithm against the site library before recording." />
        </p>
      </footer>
    </main>
  );
}

function TeachingAccessNotice({ onUnlock }: { onUnlock: () => void }) {
  const pathname = usePathname();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    const matches = await matchesTeachingPassword(password);
    setChecking(false);
    if (!matches) {
      setError(true);
      return;
    }
    try { sessionStorage.setItem(TEACHING_ACCESS_KEY, 'granted'); } catch { /* Storage may be unavailable in privacy mode. */ }
    onUnlock();
  }

  return (
    <main className="teaching-page teaching-language-fallback">
      <BackHome />
      <p className="teaching-eyebrow"><T zh="课程筹备中" en="Coming soon" /></p>
      <h1><T zh="教学页面暂未公开" en="This teaching page is not public yet" /></h1>
      <p><T zh="管理员或持有预览密码的学员可以查看课程内容。" en="Administrators and learners with the preview password can view the course content." /></p>
      <form className="teaching-access-form" onSubmit={submitPassword}>
        <label htmlFor="teaching-password"><T zh="预览密码" en="Preview password" /></label>
        <div className="teaching-access-row">
          <input
            className="teaching-access-input"
            id="teaching-password"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(false);
            }}
            aria-invalid={error}
            aria-describedby={error ? 'teaching-password-error' : undefined}
            required
          />
          <button className="teaching-access-submit" type="submit" disabled={checking}>
            {checking ? <T zh="验证中" en="Checking" /> : <T zh="查看课程" en="View course" />}
          </button>
        </div>
        {error && <p id="teaching-password-error" role="alert"><T zh="密码不正确，请重新输入。" en="Incorrect password. Please try again." /></p>}
      </form>
      <Link href={`/account${nextQuery(pathname)}`} className="teaching-admin-login" prefetch={false}>
        <T zh="登录管理员账号" en="Administrator sign in" />
      </Link>
    </main>
  );
}

export default function TeachingClient({ lang: _lang }: { lang: string }) {
  const isAdmin = useIsAdmin();
  const [mounted, setMounted] = useState(false);
  const [previewAccess, setPreviewAccess] = useState(false);
  useEffect(() => {
    try { setPreviewAccess(sessionStorage.getItem(TEACHING_ACCESS_KEY) === 'granted'); } catch { /* Storage may be unavailable in privacy mode. */ }
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!isAdmin && !previewAccess) return <TeachingAccessNotice onUnlock={() => setPreviewAccess(true)} />;
  return <TeachingPage isAdmin={isAdmin} />;
}
