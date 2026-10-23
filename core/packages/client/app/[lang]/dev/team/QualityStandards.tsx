'use client';

import { ArrowDown, ArrowRight, Check, Component, Database, FileCode2, Keyboard, LockKeyhole, Monitor, RotateCcw, Search, ShieldCheck, Smartphone, X } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useT } from '@/hooks/useT';
import SopUiStandards from './SopUiStandards';
import './sop.css';
import './quality-guide.css';

const CATEGORY_KEYS = ['ui', 'ux', 'content', 'frontend', 'backend'];
type Example = 'feedback' | 'preserve' | 'disclosure' | 'undo' | 'concise' | 'evidence' | 'terms' | 'reuse' | 'extract' | 'responsive' | 'accessible' | 'assets' | 'permission' | 'retry' | 'errors' | 'recovery';
type Rule = { kind: Example; title: string; text: string; bad: string; good: string };

function QualityExample({ kind, good }: { kind: Example; good: boolean }) {
  const t = useT();
  const arrow = <ArrowDown className="quality-diagram-arrow" size={16} />;
  return <div className={`quality-example quality-example-${kind} ${good ? 'is-good' : 'is-bad'}`} aria-hidden="true">
    {kind === 'feedback' && <>
      <span className="quality-example-eyebrow">{t('提交申请', 'Submit application')}</span>
      <span className="quality-example-heading">{good ? t('申请已提交', 'Application received') : t('处理中', 'Processing')}</span>
      {good ? <><span className="quality-example-detail">{t('审批结果将发送到你的邮箱', 'We’ll email the review result')}</span><span className="quality-example-action">{t('查看申请', 'View application')}<ArrowRight size={13} /></span></> : <><div className="quality-example-skeleton"><i /><i /></div><span className="quality-example-detail">{t('不知道是否成功，也没有下一步', 'No outcome or next step')}</span></>}
    </>}
    {kind === 'preserve' && <>
      <span className="quality-example-eyebrow">{t('联系信息', 'Contact details')}</span>
      <span className={`quality-example-input ${good ? '' : 'is-empty'}`}>{good ? t('晨宇', 'Chenyu') : t('姓名', 'Name')}</span>
      <span className="quality-example-input">{good ? 'chenyu@' : t('邮箱', 'Email')}</span>
      <span className="quality-example-error">{good ? t('请补全邮箱地址', 'Enter a complete email address') : t('提交失败，请重新填写', 'Submission failed. Start again.')}</span>
    </>}
    {kind === 'disclosure' && <>
      <span className="quality-example-heading">{t('创建项目', 'Create project')}</span>
      {good ? <><span className="quality-example-input">{t('项目名称', 'Project name')}</span><span className="quality-example-action">{t('创建', 'Create')}<ArrowRight size={13} /></span><span className="quality-example-detail quality-example-disclosure">{t('高级设置', 'Advanced settings')}<span>⌄</span></span></> : <><div className="quality-example-options">{[t('名称', 'Name'), t('颜色', 'Color'), t('模板', 'Template'), t('权限', 'Access'), t('通知', 'Alerts'), t('归档', 'Archive')].map(item => <span key={item}>{item}<span>⌄</span></span>)}</div><span className="quality-example-detail">{t('先填完六项，才能继续', 'Six decisions before you can continue')}</span></>}
    </>}
    {kind === 'undo' && <>
      <span className="quality-example-eyebrow">{t('删除草稿', 'Delete draft')}</span>
      <div className="quality-example-document"><FileCode2 size={28} /><span>{t('项目说明', 'Project brief')}</span></div>
      {good ? <span className="quality-example-toast">{t('草稿已删除', 'Draft deleted')}<span><RotateCcw size={12} />{t('撤销', 'Undo')}</span></span> : <span className="quality-example-error">{t('立即消失，无法找回', 'Gone immediately, with no recovery')}</span>}
    </>}
    {kind === 'concise' && <>
      <span className="quality-example-eyebrow">{t('上传失败', 'Upload failed')}</span>
      <span className={good ? 'quality-example-heading' : 'quality-example-prose'}>{good ? t('文件超过 10 MB', 'File exceeds 10 MB') : t('温馨提示：非常抱歉，当前暂时无法为您完成上传操作，给您带来的不便敬请谅解。', 'Friendly reminder: we sincerely apologize that we are currently unable to complete your upload. Thank you for your understanding.')}</span>
      {good && <><span className="quality-example-detail">{t('压缩文件后重试', 'Compress the file and try again')}</span><span className="quality-example-action">{t('重新选择文件', 'Choose another file')}</span></>}
    </>}
    {kind === 'evidence' && <>
      <span className="quality-example-eyebrow">{t('交付说明示例', 'Example delivery note')}</span>
      <span className="quality-example-heading">{good ? t('已验证手机端报名', 'Mobile registration verified') : t('全面优化，完美适配', 'Fully optimized. Works perfectly.')}</span>
      {good ? <div className="quality-example-evidence"><span><Check size={13} />iPhone / Safari</span><span><Check size={13} />{t('提交后收到确认邮件', 'Confirmation email received')}</span><span>{t('其他浏览器待确认', 'Other browsers not yet verified')}</span></div> : <div className="quality-example-claims"><span>100%</span><span>{t('没有范围，也没有验证记录', 'No scope or verification record')}</span></div>}
    </>}
    {kind === 'terms' && <>
      <span className="quality-example-eyebrow">{t('同一个操作', 'The same action')}</span>
      <div className="quality-example-terms">{(good ? [t('保存草稿', 'Save draft'), t('保存草稿', 'Save draft'), 'Save draft'] : [t('保存', 'Save'), t('提交', 'Submit'), 'Publish']).map((label, index) => <span key={index}>{label}<span className="quality-example-detail">{[t('页面', 'Page'), t('弹窗', 'Dialog'), t('英文版', 'English')][index]}</span></span>)}</div>
    </>}
    {kind === 'reuse' && <>
      {good ? <><div className="quality-diagram-node is-source"><Component size={18} /><strong>{t('共享组件', 'Shared component')}</strong></div>{arrow}<div className="quality-diagram-branches">{[t('页面 A', 'Page A'), t('页面 B', 'Page B'), t('页面 C', 'Page C')].map(label => <span key={label}>{label}</span>)}</div><span className="quality-example-detail">{t('修一处，所有页面同步', 'One fix reaches every consumer')}</span></> : <><div className="quality-diagram-duplicates">{['A', 'B', 'C'].map(label => <span key={label}><Component size={18} />{t('副本', 'Copy')} {label}</span>)}</div><span className="quality-example-error">{t('复制三份，就要分别维护三份', 'Three copies need three separate fixes')}</span></>}
    </>}
    {kind === 'extract' && <>
      {good ? <><div className="quality-diagram-node is-source"><FileCode2 size={17} /><strong>{t('公共逻辑', 'Shared logic')}</strong></div>{arrow}<div className="quality-diagram-branches"><span>{t('原页面', 'Original page')}</span><span>{t('新页面', 'New page')}</span></div><span className="quality-example-detail">{t('共同引用，原行为保持不变', 'Both import it; original behavior stays')}</span></> : <><div className="quality-diagram-node">{t('新页面', 'New page')}</div>{arrow}<div className="quality-diagram-node"><FileCode2 size={17} />{t('另一业务页面的私有实现', 'Another page’s private implementation')}</div><span className="quality-example-error">{t('页面之间互相牵连', 'Unrelated pages become coupled')}</span></>}
    </>}
    {kind === 'responsive' && <>
      <div className="quality-mini-devices"><Monitor size={19} /><Smartphone size={17} /></div>
      <div className="quality-example-viewport"><span className="quality-example-heading">{t('我的项目', 'My projects')}</span><div className="quality-responsive-row"><span>{t('入职页面', 'Onboarding')}</span><span>{t('进行中', 'In progress')}</span><span className="quality-example-action">{t('查看', 'View')}</span></div>{good && <span className="quality-example-detail">{t('按钮可点，软键盘不挡输入', 'Reachable controls; visible inputs')}</span>}</div>
    </>}
    {kind === 'accessible' && <>
      <Keyboard className="quality-example-symbol" size={28} />
      <span className={`quality-example-action ${good ? 'has-focus' : 'is-tiny'}`}>{good ? <>{t('继续', 'Continue')}<ArrowRight size={14} /></> : <ArrowRight size={9} />}</span>
      <span className="quality-example-detail">{good ? t('Tab 聚焦，Enter 确认，读屏能识别', 'Tab to focus, Enter to confirm, named for screen readers') : t('入口太小，键盘和读屏都找不到', 'Tiny target, no keyboard access or accessible name')}</span>
    </>}
    {kind === 'assets' && <>
      <div className="quality-example-photo"><span /><span /><span /></div>
      <div className="quality-asset-label"><strong>{good ? '48 KB' : '12 MB'}</strong><span>{t('缩略图示例', 'Example thumbnail')}</span></div>
      <span className="quality-example-detail">{good ? t('尺寸匹配，预留空间，进入视口再加载', 'Right size, reserved space, loaded near the viewport') : t('小图加载原片，加载后把内容挤开', 'A thumbnail loads the original and shifts content')}</span>
    </>}
    {kind === 'permission' && <>
      <div className="quality-diagram-node"><Monitor size={16} />{t('浏览器请求', 'Browser request')}</div>{arrow}
      {good ? <><div className="quality-diagram-node is-source"><ShieldCheck size={18} /><strong>{t('服务端校验', 'Server checks')}</strong></div><span className="quality-example-detail">{t('身份、权限、输入', 'Identity, permissions, input')}</span>{arrow}<Database className="quality-example-symbol" size={21} /></> : <><div className="quality-diagram-node"><LockKeyhole size={17} />{t('只隐藏前端按钮', 'Only hide the frontend button')}</div>{arrow}<span className="quality-example-error">{t('绕过页面，仍可直接请求', 'A direct request bypasses the UI')}</span></>}
    </>}
    {kind === 'retry' && <>
      <div className="quality-diagram-branches">{[1, 2, 3].map(index => <span key={index}>{t('请求', 'Request')} {index}</span>)}</div>{arrow}
      {good && <><div className="quality-diagram-node is-source">{t('服务端原子去重', 'Atomic deduplication on the server')}</div>{arrow}</>}
      <div className="quality-diagram-records">{Array.from({ length: good ? 1 : 3 }, (_, index) => <span key={index}><Database size={18} />{t('记录', 'Record')}</span>)}</div>
      <span className={good ? 'quality-example-detail' : 'quality-example-error'}>{good ? t('重试返回同一个结果', 'Retries return the same result') : t('一次操作，写出三条记录', 'One action creates three records')}</span>
    </>}
    {kind === 'errors' && <>
      <span className="quality-example-eyebrow">{t('请求失败', 'Request failed')}</span>
      <span className="quality-example-heading">{good ? t('服务暂时不可用', 'Service temporarily unavailable') : 'Error 500'}</span>
      <span className="quality-example-detail">{good ? t('内容已保留，请稍后重试', 'Your input is still here. Try again shortly.') : t('用户无从处理，日志无法定位', 'No recovery step or useful diagnostic log')}</span>
      {good && <div className="quality-example-log"><span>request_id: req_8f2</span><span>{t('记录原因，不记录密码或令牌', 'Log the cause, never passwords or tokens')}</span></div>}
    </>}
    {kind === 'recovery' && <>
      {(good ? [t('备份与恢复确认', 'Verify backup and restore'), t('执行迁移', 'Run migration'), t('检查结果', 'Verify the result')] : [t('直接修改线上数据', 'Edit production data'), t('发布失败', 'Release fails'), t('没有恢复办法', 'No recovery path')]).map((label, index) => <div className="quality-recovery-step" key={label}><span className="quality-diagram-node">{label}</span>{index < 2 && arrow}</div>)}
      {good && <span className="quality-example-rollback"><RotateCcw size={13} />{t('失败按预案回滚或恢复', 'Rollback or restore on failure')}</span>}
    </>}
  </div>;
}

export default function QualityStandards() {
  const t = useT();
  const [category, setCategory] = useQueryState('category', parseAsStringEnum(CATEGORY_KEYS).withDefault('ui').withOptions({ scroll: false }));
  const tabs = [t('界面 UI', 'UI'), t('交互 UX', 'UX'), t('内容文案', 'Content'), t('前端', 'Frontend'), t('后端', 'Backend')];
  const standards: Record<string, { title: string; summary: string; review: string; rules: Rule[] }> = {
    ux: { title: t('交互体验', 'Interaction design'), summary: t('用户每完成一步，都知道发生了什么、接下来做什么。', 'After each action, users know what happened and what to do next.'), review: t('走一遍成功、失败和重试：用户不需要猜，也不用重复劳动。', 'Check success, failure and retry: no guessing and no repeated work.'), rules: [
      { kind: 'feedback', title: t('每个操作都有反馈', 'Give every action a clear outcome'), text: t('加载、成功、失败和空状态都要交代清楚；主要操作容易找到，按钮直接说明结果。', 'Make loading, success, error and empty states clear. Keep the primary action easy to find and name its outcome.'), bad: t('提交后只剩等待，不知道是否成功。', 'An indefinite wait leaves the outcome unclear.'), good: t('说明结果，并给出下一步入口。', 'State the result and show the next action.') },
      { kind: 'preserve', title: t('出错不让用户重填', 'Preserve work when something fails'), text: t('保留已填写的内容，在出错位置说明原因与修改办法。', 'Keep entered information and explain how to fix the error beside the affected field.'), bad: t('一次错误，所有内容清空。', 'One error clears all the work.'), good: t('只修正有问题的字段。', 'Only the incorrect field needs attention.') },
      { kind: 'disclosure', title: t('先完成任务，再看细节', 'Keep the task ahead of the details'), text: t('必需信息直接展示，低频设置按需展开；删掉多余步骤和确认。', 'Show essentials directly, reveal infrequent settings on demand and remove unnecessary steps and confirmations.'), bad: t('次要选项阻挡主要任务。', 'Secondary decisions block the main task.'), good: t('先给必要输入，其余按需查看。', 'Start with the essentials; reveal more when needed.') },
      { kind: 'undo', title: t('高风险操作可以挽回', 'Make risky actions recoverable'), text: t('删除等操作提供撤销；无法撤销时，先说明后果并确认。', 'Offer undo for actions such as deletion. If an action is irreversible, explain its consequence and confirm first.'), bad: t('误触之后无法恢复。', 'An accidental action cannot be recovered.'), good: t('给出明确的恢复入口。', 'Provide an obvious recovery action.') },
    ] },
    content: { title: t('内容与文案', 'Content and wording'), summary: t('一句话讲清问题和办法，不让用户从套话里找答案。', 'Explain the problem and the solution without making users search through filler.'), review: t('删掉这句话，会不会少一条有用信息？不会，就删掉。', 'If removing a sentence loses no useful information, remove it.'), rules: [
      { kind: 'concise', title: t('直接说原因和办法', 'Say what happened and what to do'), text: t('同一信息只写一次，去掉套话、口号和重复标题，用自然、具体的语言解决用户的问题。', 'Say each thing once. Remove filler, slogans and duplicate headings; use natural, specific language that solves the user’s problem.'), bad: t('一大段道歉，没有可用信息。', 'A long apology gives no useful information.'), good: t('原因明确，用户知道怎么处理。', 'The cause and next step are clear.') },
      { kind: 'evidence', title: t('结论要有证据和范围', 'Support claims with evidence and scope'), text: t('AI 的回答先核实，再使用；猜测、未验证项和已确认事实要分清，不写“全部正常”等空泛结论。', 'Verify AI output before using it. Separate assumptions, unverified items and confirmed facts; avoid blanket claims such as “everything works”.'), bad: t('听起来完成了，却无法核对。', 'It sounds complete but cannot be checked.'), good: t('说明做了什么、看到了什么、还有什么未确认。', 'State what was checked, observed and remains unverified.') },
      { kind: 'terms', title: t('同一个意思，用同一个名称', 'Use one name for one meaning'), text: t('按钮、页面和帮助文档的术语保持一致，中英文表达同一含义；不用中点拼接信息。', 'Keep terminology consistent across controls, pages and help. Preserve meaning across languages and avoid middle-dot separators.'), bad: t('保存、提交和发布混用，用户不敢操作。', 'Mixing save, submit and publish makes the result uncertain.'), good: t('名称一致，结果可预期。', 'Consistent names make the outcome predictable.') },
    ] },
    frontend: { title: t('前端实现', 'Frontend implementation'), summary: t('先找已有实现，让同类界面共用同一份能力。', 'Find existing implementations first and give related interfaces one shared source.'), review: t('按改动风险检查关键路径；手机操作用真机确认，不为凑数量重复测试。', 'Check critical paths according to change risk. Verify mobile interactions on a real device; do not repeat tests just to increase the count.'), rules: [
      { kind: 'reuse', title: t('先搜索，再实现', 'Search before building'), text: t('新增功能前搜索组件、工具、数据源和交互契约；已有同职责实现就复用，不复制后改名。', 'Search existing components, utilities, data sources and interaction contracts before building. Reuse matching implementations instead of copying and renaming them.'), bad: t('相似组件各存一份，修复容易漏。', 'Separate copies drift and miss fixes.'), good: t('共享组件统一维护，页面只传差异。', 'Maintain one component and pass page-specific differences.') },
      { kind: 'extract', title: t('能共用的逻辑，抽到合适的位置', 'Extract shared logic where it belongs'), text: t('逻辑还嵌在页面里时，先抽到职责合适的公共模块，让原、新调用方共同引用；不为复用增加无用层级。', 'When reusable logic is embedded in a page, move it to an appropriate shared module and update both callers. Do not add layers without a real need.'), bad: t('新页面直接依赖另一业务页面。', 'One business page depends directly on another.'), good: t('抽取后共同引用，保留原来的行为。', 'Both consume the extracted logic without changing existing behavior.') },
      { kind: 'responsive', title: t('大小屏都能完成任务', 'Make the task work on every screen'), text: t('手机和电脑都能清楚阅读、准确操作；用真实手机检查触摸、滚动和软键盘遮挡。', 'Keep reading and interaction clear on phones and computers. Check touch, scrolling and keyboard obstruction on a real phone.'), bad: t('桌面布局硬塞进手机，内容溢出。', 'A desktop layout overflows a phone screen.'), good: t('按空间重排，关键操作始终可达。', 'Reflow content so key controls remain reachable.') },
      { kind: 'accessible', title: t('鼠标、键盘、读屏都能用', 'Support pointer, keyboard and screen readers'), text: t('使用正确的按钮和表单语义，保留清晰焦点与可访问名称，并确认目标浏览器中的关键流程。', 'Use semantic controls, visible focus and accessible names. Verify key flows in supported browsers.'), bad: t('外观像按钮，实际无法访问。', 'It looks like a button but cannot be accessed.'), good: t('同一操作支持不同输入方式。', 'The same action works with different input methods.') },
      { kind: 'assets', title: t('只加载当前需要的内容', 'Load what is needed now'), text: t('避免重复请求；图片匹配展示尺寸，提前预留空间，屏外内容按需加载。', 'Avoid duplicate requests. Match images to their display size, reserve their space and load offscreen content when needed.'), bad: t('文件过大，还把已显示的内容挤走。', 'An oversized asset also shifts visible content.'), good: t('资源轻，位置稳，当前内容优先。', 'Right-sized assets, stable layout and visible content first.') },
    ] },
    backend: { title: t('后端与数据', 'Backend and data'), summary: t('权限在服务端确认，数据在失败和重试后仍然可靠。', 'Enforce permissions on the server and keep data reliable through failures and retries.'), review: t('至少考虑无权限、重复请求和中途失败；按实际风险保留验证与恢复证据。', 'Consider unauthorized access, duplicate requests and partial failure. Keep verification and recovery evidence proportionate to the risk.'), rules: [
      { kind: 'permission', title: t('前端隐藏不等于权限控制', 'Hidden controls are not authorization'), text: t('服务端校验身份、权限和输入。AI 或浏览器发来的内容同样需要校验。', 'Validate identity, permissions and input on the server. Requests from AI tools or browsers need the same checks.'), bad: t('隐藏按钮后，直接请求仍能执行。', 'Hiding a button does not stop a direct request.'), good: t('每次请求都在服务端检查权限。', 'Check permissions on the server for every request.') },
      { kind: 'retry', title: t('重试不会重复写入', 'Retries must not duplicate writes'), text: t('重复提交和重试使用同一操作标识，由服务端原子去重；并发操作按明确规则保持数据一致。', 'Use the same operation key for repeated submissions and retries, with atomic deduplication on the server. Define concurrency rules that keep data consistent.'), bad: t('网络抖动，一次操作变成三次。', 'Network trouble turns one action into three writes.'), good: t('重复请求识别为同一操作。', 'Repeated requests are recognized as one operation.') },
      { kind: 'errors', title: t('用户能处理，开发者能定位', 'Make errors actionable and traceable'), text: t('接口给出清楚的错误和处理办法；日志保留定位线索，不记录密码、令牌等敏感信息。', 'Return clear errors and recovery steps. Keep diagnostic clues in logs without passwords, tokens or other secrets.'), bad: t('只有错误码，没有原因与后续办法。', 'An error code alone offers no recovery path.'), good: t('用户知道下一步，日志可关联到请求。', 'Users know what to do and logs identify the request.') },
      { kind: 'recovery', title: t('先想好失败后怎么恢复', 'Plan recovery before making changes'), text: t('重要数据有备份且能恢复；迁移和发布前明确失败处理方式，线上写入按已确认授权执行。', 'Keep restorable backups of important data. Plan failure handling before migrations and releases, and follow the confirmed authorization for production writes.'), bad: t('直接改线上，出错后再想办法。', 'Production changes happen before recovery is considered.'), good: t('按预案执行，失败有恢复路径。', 'Follow a plan with a clear recovery path.') },
    ] },
  };
  const selected = standards[category];
  return <section className="staff-sop quality-guide" aria-labelledby="sop-standards">
    <header className="quality-guide-header"><h2 id="sop-standards" className="staff-start-module-title">{t('质量标准', 'Quality standards')}</h2><p>{t('用正反例对齐做法，用实际结果验收。', 'Align on examples. Accept work based on actual results.')}</p></header>
    <div className="quality-tabs" role="tablist" aria-label={t('标准分类', 'Standards categories')}>
      {CATEGORY_KEYS.map((key, index) => <button key={key} className="quality-tab" type="button" role="tab" id={`quality-tab-${key}`} aria-controls="quality-panel" aria-selected={category === key} tabIndex={category === key ? 0 : -1} onClick={() => setCategory(key)} onKeyDown={event => {
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % CATEGORY_KEYS.length;
        else if (event.key === 'ArrowLeft') next = (index + CATEGORY_KEYS.length - 1) % CATEGORY_KEYS.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = CATEGORY_KEYS.length - 1;
        else return;
        event.preventDefault();
        void setCategory(CATEGORY_KEYS[next]);
        document.getElementById(`quality-tab-${CATEGORY_KEYS[next]}`)?.focus();
      }}>{tabs[index]}</button>)}
    </div>
    <div id="quality-panel" className="quality-panel" role="tabpanel" aria-labelledby={`quality-tab-${category}`} tabIndex={0}>
      {category === 'ui' ? <SopUiStandards /> : selected && <section className="quality-category" aria-labelledby={`quality-heading-${category}`}>
        <div className="quality-category-heading"><h3 id={`quality-heading-${category}`}>{selected.title}</h3><p>{selected.summary}</p></div>
        <div className="quality-rule-grid">{selected.rules.map(rule => <article className="quality-rule" data-site-surface="panel" key={rule.kind}>
          <div className="quality-rule-heading"><h4>{rule.title}</h4></div>
          <p className="quality-rule-description">{rule.text}</p>
          <div className="quality-pair">{[false, true].map(good => <figure key={String(good)}>
            <div className={`quality-verdict ${good ? 'is-good' : 'is-bad'}`}>{good ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}{good ? t('推荐', 'Do') : t('避免', 'Avoid')}</div>
            <QualityExample kind={rule.kind} good={good} /><figcaption>{good ? rule.good : rule.bad}</figcaption>
          </figure>)}</div>
        </article>)}</div>
        <aside className="quality-review"><Search size={18} aria-hidden="true" /><div><strong>{t('验收时看什么', 'What to check')}</strong><p>{selected.review}</p></div></aside>
      </section>}
    </div>
  </section>;
}
