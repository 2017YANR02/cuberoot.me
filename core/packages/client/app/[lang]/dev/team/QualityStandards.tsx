'use client';

import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useT } from '@/hooks/useT';
import SopUiStandards from './SopUiStandards';
import './sop.css';

export default function QualityStandards() {
  const t = useT();
  const keys = ['ui', 'ux', 'content', 'frontend', 'backend'];
  const [category, setCategory] = useQueryState('category', parseAsStringEnum(keys).withDefault('ui').withOptions({ scroll: false }));
  const tabs = [t('界面 UI', 'UI'), t('交互 UX', 'UX'), t('内容文案', 'Content'), t('前端', 'Frontend'), t('后端', 'Backend')];
  const standards = [
    { title: t("交互体验（UX）", "Interaction design (UX)"), items: [
      t("主要操作容易找到，按钮含义明确，减少不必要的步骤和确认。", "Make primary actions easy to find, label buttons clearly and remove unnecessary steps and confirmations."),
      t("加载、成功、失败和空状态都有清楚的反馈，出错时提供处理办法。", "Provide clear loading, success, error and empty states, with recovery steps when something fails."),
      t("保留用户已填写的内容；删除等高风险操作提供确认或撤销。", "Preserve user input; provide confirmation or undo for high-risk actions such as deletion."),
      t("完成操作必需的信息直接展示，详细说明按需查看。", "Show information needed for the task directly, with further detail available on demand."),
    ] },
    { title: t("内容与文案", "Content and wording"), items: [
      t("信息不重复，表达简明，删去无实际内容的套话。", "Keep information concise, avoid repetition and remove filler."),
      t("用自然、具体的语言说明如何解决用户的问题，避免空泛口号和模板化表达。", "Explain how to solve users’ problems in natural, specific language; avoid vague slogans and formulaic wording."),
      t("事实有依据，不夸大效果，不把猜测写成定论。", "Support facts with evidence, avoid exaggerated claims and distinguish guesses from conclusions."),
      t("同一概念使用统一名称，中英文含义一致。", "Use consistent terminology and preserve meaning across Chinese and English."),
    ] },
    { title: t("前端实现", "Frontend implementation"), items: [
      t("手机和电脑上均能清晰阅读、准确操作，内容不溢出。", "Keep content readable and controls usable on phones and computers without overflow."),
      t("关键流程在目标浏览器中可用，支持键盘和辅助工具操作。", "Ensure key flows work in supported browsers and with keyboards and assistive technology."),
      t("优先加载当前需要的内容，避免重复请求。", "Load what is needed first and avoid duplicate requests."),
      t("图片加载前预留位置，避免内容突然移动。", "Reserve space for images before they load to prevent content from shifting."),
      t("图片尺寸与展示用途匹配，避免小图加载大文件。", "Match image dimensions to their display size; avoid loading large files for thumbnails."),
      t("关键操作在真实手机上完成一遍，检查触摸操作和软键盘遮挡。", "Complete key actions on a real phone, checking touch interactions and content obscured by the on-screen keyboard."),
      t("复用现有组件和样式，按改动风险验证关键流程。", "Reuse existing components and styles, and verify key flows according to the risks of the change."),
    ] },
    { title: t("后端与数据", "Backend and data"), items: [
      t("在服务端校验身份、权限和输入，不依赖前端限制。", "Validate identity, permissions and input on the server rather than relying on frontend restrictions."),
      t("重复提交、并发操作和失败重试不得造成重复写入或数据不一致。", "Prevent duplicate writes and inconsistent data during repeated submissions, concurrent actions and retries."),
      t("接口失败有明确错误，日志可定位问题且不记录密码等敏感信息。", "Return clear API errors and keep useful diagnostic logs without passwords or other sensitive data."),
      t("重要数据有备份和恢复办法，数据迁移与发布有失败处理方案。", "Provide backup and recovery for important data, with failure handling for migrations and releases."),
    ] },
  ];
  return <section className="staff-sop">
      <article className="staff-sop-section" aria-labelledby="sop-standards">
        <div className="staff-start-module-heading">
          <h2 id="sop-standards" className="staff-start-module-title">{t('质量标准', 'Quality standards')}</h2>
        </div>
        <div className="quality-tabs" role="tablist" aria-label={t('标准分类', 'Standards categories')}>
          {keys.map((key, index) => <button key={key} type="button" role="tab" id={`quality-tab-${key}`} aria-controls="quality-panel" aria-selected={category === key} tabIndex={category === key ? 0 : -1} onClick={() => setCategory(key)} onKeyDown={event => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % keys.length;
            else if (event.key === 'ArrowLeft') next = (index + keys.length - 1) % keys.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = keys.length - 1;
            else return;
            event.preventDefault();
            void setCategory(keys[next]);
            document.getElementById(`quality-tab-${keys[next]}`)?.focus();
          }}>{tabs[index]}</button>)}
        </div>
        <div id="quality-panel" role="tabpanel" aria-labelledby={`quality-tab-${category}`} tabIndex={0}>
          {category === 'ui' ? <SopUiStandards /> : standards.filter((_, index) => keys[index + 1] === category).map(({ title, items }) => <section key={title} className="staff-sop-standard-group" data-site-surface="panel">
            <h3>{title}</h3>
            <ul className="staff-start-knowledge">{items.map(text => <li key={text}><p>{text}</p></li>)}</ul>
          </section>)}
        </div>
      </article>
  </section>;
}
