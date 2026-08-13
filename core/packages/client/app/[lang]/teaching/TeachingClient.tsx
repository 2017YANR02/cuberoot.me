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
  TEACHING_COURSES,
  TEACHING_LESSON_COUNT,
  TEACHING_TOTAL_MINUTES,
} from './_data';
import './teaching.css';

function courseMinutes(course: (typeof TEACHING_COURSES)[number]) {
  return course.lessons.reduce((total, lesson) => total + lesson.minutes, 0);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} 小时 ${rest} 分钟`;
}

function ChineseTeachingPage() {
  const average = (TEACHING_TOTAL_MINUTES / TEACHING_LESSON_COUNT).toFixed(1);

  return (
    <main className="teaching-page">
      <header className="teaching-hero">
        <BackHome />
        <p className="teaching-eyebrow">儿童三阶魔方录播课</p>
        <h1>教学大纲与提词稿</h1>
        <p className="teaching-lead">
          一套可以直接进入录制的课程底稿：先用试听课让孩子获得第一次成功，再完成层先法复原，最后平稳过渡到 CFOP。
        </p>

        <div className="teaching-stats" aria-label="课程规模">
          <span><strong>{TEACHING_LESSON_COUNT}</strong> 节</span>
          <span><strong>5–15</strong> 分钟一节</span>
          <span><strong>{average}</strong> 分钟平均</span>
          <span><strong>{formatDuration(TEACHING_TOTAL_MINUTES)}</strong> 总时长</span>
        </div>

        <nav className="teaching-course-nav" aria-label="跳转到课程">
          {TEACHING_COURSES.map((course) => (
            <a key={course.id} href={`#${course.id}`}>
              <span>{course.label}</span>
              {course.title}
            </a>
          ))}
        </nav>
      </header>

      <section className="teaching-principles" aria-labelledby="recording-rules">
        <div className="teaching-section-heading">
          <p className="teaching-kicker">先定节奏</p>
          <h2 id="recording-rules">为什么不把每节都录成 10 分钟</h2>
        </div>
        <div className="teaching-principle-grid">
          <article>
            <Clock3 aria-hidden="true" />
            <h3>讲清一个小目标</h3>
            <p>概念和单个动作控制在 5–8 分钟；需要完整跟练、例解或阶段复习时，再延长到 10–15 分钟。</p>
          </article>
          <article>
            <Target aria-hidden="true" />
            <h3>每节必须能过关</h3>
            <p>结尾不只说“回去多练”，而是给出可以观察的标准，例如连续五次做对、能指出目标块或能说出判断理由。</p>
          </article>
          <article>
            <Video aria-hidden="true" />
            <h3>先看，再跟，再独立做</h3>
            <p>每个新动作至少录三个镜头：完整示范、慢动作拆解、孩子暂停后自行完成。公式画面始终保留拿法和方向。</p>
          </article>
          <article>
            <Mic2 aria-hidden="true" />
            <h3>提词稿说人话</h3>
            <p>一段只表达一个意思。方括号里的文字是镜头提示，不需要念；其余文字可以直接口播，再按自己的语气微调。</p>
          </article>
        </div>
      </section>

      {TEACHING_COURSES.map((course, courseIndex) => (
        <section key={course.id} id={course.id} className="teaching-course" aria-labelledby={`${course.id}-title`}>
          <div className="teaching-course-head">
            <div className="teaching-course-number" aria-hidden="true">0{courseIndex + 1}</div>
            <div>
              <p className="teaching-kicker">{course.label}</p>
              <h2 id={`${course.id}-title`}>{course.title}</h2>
              <p>{course.summary}</p>
              <dl className="teaching-course-meta">
                <div><dt>适合</dt><dd>{course.audience}</dd></div>
                <div><dt>规模</dt><dd>{course.lessons.length} 节，约 {courseMinutes(course)} 分钟</dd></div>
              </dl>
            </div>
          </div>

          <div className="teaching-lessons">
            {course.lessons.map((lesson, lessonIndex) => (
              <details key={lesson.id} className="teaching-lesson" open={courseIndex === 0 && lessonIndex === 0}>
                <summary>
                  <span className="teaching-lesson-index">{String(lessonIndex + 1).padStart(2, '0')}</span>
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
        </section>
      ))}

      <section className="teaching-production" aria-labelledby="production-title">
        <div className="teaching-section-heading">
          <p className="teaching-kicker">录制顺序</p>
          <h2 id="production-title">先录三节试听课，再决定整套语气</h2>
        </div>
        <ol>
          <li><strong>做一版最小成片。</strong>先录试听课三节，验证机位、手部特写、字幕字号和孩子能否跟上。</li>
          <li><strong>找 3–5 个目标年龄孩子试看。</strong>记录他们在哪句话走神、在哪个镜头需要暂停，不只问“喜欢吗”。</li>
          <li><strong>固定模板后批量录。</strong>统一片头、目标卡、公式卡和课后挑战，再按层先法、CFOP 的顺序录制。</li>
          <li><strong>引流只承诺真实下一步。</strong>试听课结尾展示完整学习地图，并邀请家长领取练习卡或进入完整课程，不制造虚假倒计时和焦虑。</li>
        </ol>
      </section>

      <footer className="teaching-references">
        <h2>编排参考</h2>
        <p>
          课程层级与颗粒度参考了{' '}
          <a href="https://cubeskills.com/categories/3x3" target="_blank" rel="noreferrer">CubeSkills 三阶课程目录</a>
          ，两步 OLL、PLL 的公式按{' '}
          <a href="https://jperm.net/algs/2look/oll" target="_blank" rel="noreferrer">J Perm 两步 OLL</a>
          {' '}和{' '}
          <a href="https://jperm.net/algs/2look/pll" target="_blank" rel="noreferrer">两步 PLL</a>
          逐项核对。正式录制前仍建议用实物按每个拿法完整跑一遍。
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
      <p>The syllabus and teleprompter scripts are written for a Chinese-language children’s course.</p>
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
