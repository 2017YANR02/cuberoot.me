'use client';

import { ArrowRight, BookOpen, GraduationCap, UserRound, Wallet } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery } from '@/lib/auth-store';

export const INSTRUCTOR_APPLICATION_START = '/platform/teachers/apply/start';

export function InstructorAdmissionIntro({ signedIn }: { signedIn: boolean }) {
  const t=useT(), lang=useLang();
  const benefits=[
    {icon:BookOpen,title:t('发布自己的课程','Publish your courses'),body:t('自主安排课程内容、课时和定价，将教学经验沉淀为系统化课程。','Organize lessons, content and pricing to turn your experience into structured courses.')},
    {icon:UserRound,title:t('建立讲师个人主页','Create your teaching profile'),body:t('展示擅长方向与教学简介，自主决定是否加入公开讲师名录。','Show your expertise and biography, and choose whether to appear in the public directory.')},
    {icon:GraduationCap,title:t('管理学员与学习进度','Support your learners'),body:t('在讲师工作台查看有效学员、学习进度和结课证书。','Track enrolled learners, their progress and completion certificates in your workspace.')},
    {icon:Wallet,title:t('获得课程收益','Earn from your courses'),body:t('查看真实交易与课程分成，按平台结算规则配置收款和申请提现。','Review transactions and revenue share, then set up payouts under the platform’s settlement rules.')},
  ];
  const steps=[
    [t('填写申请','Apply'),t('介绍你的教学方向、经验和公开资料。','Tell us about your expertise, experience and public profile.')],
    [t('等待审核','Get reviewed'),t('管理员审核后，通过站内消息通知结果。','Our team reviews your application and sends the result in-site.')],
    [t('开始教学','Start teaching'),t('通过后进入讲师工作台，完善主页并创建课程。','Once approved, access your instructor workspace to complete your profile and create courses.')],
  ];
  const href=signedIn?INSTRUCTOR_APPLICATION_START:`/account${nextQuery(`${lang==='zh'?'/zh':''}${INSTRUCTOR_APPLICATION_START}`)}`;
  return <div className="platform-admission-intro">
    <section className="platform-admission-hero" data-site-surface="panel">
      <div className="platform-admission-hero-copy"><span className="platform-admission-eyebrow">{t('魔方根讲师计划','CubeRoot Instructor Program')}</span><h2>{t('让你的魔方经验，成为别人的进步。','Turn your cubing experience into someone else’s progress.')}</h2><p>{t('分享教学经验，建立自己的课程与教学品牌。','Share your expertise and build your own courses and teaching presence on CubeRoot.')}</p><AppLink className="platform-button platform-button-primary platform-admission-start" href={href} prefetch={false}>{t('申请成为讲师','Apply as an instructor')}<ArrowRight aria-hidden size={18}/></AppLink></div>
    </section>
    <section className="platform-admission-benefits"><h2>{t('成为讲师后，你可以','What you can do as an instructor')}</h2><div className="platform-admission-benefit-grid">{benefits.map(({icon:Icon,title,body})=><article key={title}><span className="platform-admission-benefit-icon"><Icon size={25} aria-hidden /></span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="platform-admission-process"><h2>{t('从申请到开课','From application to your first course')}</h2><ol>{steps.map(([title,description],index)=><li key={title}><span className="platform-admission-step-number">{index+1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol></section>
  </div>;
}
