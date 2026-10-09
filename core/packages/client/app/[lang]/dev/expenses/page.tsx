'use client';

import Image from 'next/image';
import { UserRound } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import { useLang } from '@/i18n/tr';
import { RMB_PER_USD, EXPENSES, ANNUAL_RECURRING_CNY, EQUIPMENT_GROUPS, ONE_TIME_EXPENSES, ONE_TIME_TOTAL, type RecurringAmount, type EquipmentAmount } from '@/lib/infrastructure-costs';
import '../infrastructure/infrastructure.css';

type Lang = 'zh' | 'en';

const EXPENSE_LOGOS: Record<string, { file: string; lightFile?: string; wide?: boolean; appIcon?: boolean }> = {
  'Alibaba Cloud server': { file: 'aliyun.svg', wide: true },
  'Codex Pro': { file: 'openai.svg', lightFile: 'openai-light.svg' },
  'Apple Developer Program': { file: 'apple-developer.jpg', appIcon: true },
  'Vercel Pro': { file: 'vercel.svg', lightFile: 'vercel-light.svg' },
  'WeChat Open Platform verification': { file: 'wechat.png', appIcon: true },
  'CapCut Chinese version': { file: 'jianying.jpg', appIcon: true },
  'Business online banking service fee': { file: 'cmb.png' },
};

function localize<T>(lang: Lang, value: { zh: T; en: T }): T {
  return value[lang];
}

function formatYuan(lang: Lang, value: number): string {
  return `${lang === 'zh' ? '¥' : 'CN¥'}${value.toLocaleString('en-US')}`;
}

function formatRecurringAmount(lang: Lang, amount: RecurringAmount): string {
  const currency = amount.currency === 'CNY' ? (lang === 'zh' ? '¥' : 'CN¥') : 'US$';
  const price = `${currency}${amount.displayValue ?? amount.value.toLocaleString('en-US')}`;
  const period = localize(lang, amount.period === 'month'
    ? { zh: '/月', en: '/month' }
    : { zh: '/年', en: '/year' });
  return `${price}${amount.plusUsage ? '+' : ''}${period}`;
}

function formatEquipmentAmount(lang: Lang, amount: EquipmentAmount): string {
  if (typeof amount === 'number') return formatYuan(lang, amount);
  if ('label' in amount) return localize(lang, amount.label);
  const formatted = formatYuan(lang, amount.value);
  if (amount.qualifier === 'approx') return localize(lang, { zh: `约 ${formatted}`, en: `Approx. ${formatted}` });
  return localize(lang, { zh: `首发 ${formatted} 起`, en: `Launched from ${formatted}` });
}

export default function ExpensesPage() {
  const lang = useLang();
  return (
    <main className="infra-page">
      <div className="infra-shell">
        <HomeLink />
        <header className="infra-hero">
          <p className="infra-kicker">CubeRoot / Expenses & Equipment</p>
          <h1>{localize(lang, { zh: '支出与设备', en: 'Expenses & Equipment' })}</h1>
          <p className="infra-lead">{localize(lang, {
            zh: 'CubeRoot 的投入概览：设备、工位、人员及服务订阅。金额包含实际订单、设备发售价与可退押金，并非全部都是已消耗的费用；持续支出按当前计划估算。',
            en: 'An overview of CubeRoot investment in equipment, workspace, people and subscriptions. Figures include order amounts, equipment launch prices and refundable deposits, rather than only consumed expenses. Recurring costs are estimates based on current plans.',
          })}</p>
          <div className="infra-hero-links">
            <AppLink href="/dev/infrastructure" prefetch={false}>{localize(lang, { zh: '查看基础设施与运维', en: 'View infrastructure & operations' })}</AppLink>
          </div>
        </header>
        <section className="infra-section" aria-labelledby="infra-expenses-title">
          <div className="infra-section-heading">
            <span>01</span>
            <div>
              <h2 id="infra-expenses-title">{localize(lang, { zh: '支出总览', en: 'Expense overview' })}</h2>
              <p>
                {localize(lang, {
                  zh: '设备、一次性工位租赁与预计年度持续支出分开统计。',
                  en: 'One-off equipment and workspace investment is tracked separately from recurring staffing and service costs.',
                })}
              </p>
            </div>
          </div>
          <dl className="infra-specs infra-cost-summary">
            <div>
              <dt>{localize(lang, { zh: '一次性投入合计', en: 'One-time investment' })}</dt>
              <dd>{localize(lang, { zh: `${formatYuan('zh', ONE_TIME_TOTAL)} 起`, en: `From ${formatYuan('en', ONE_TIME_TOTAL)}` })}</dd>
            </div>
            <div>
              <dt>{localize(lang, { zh: '预计年度持续支出', en: 'Estimated annual recurring total' })}</dt>
              <dd>{localize(lang, {
                zh: `约 ${formatYuan('zh', Math.round(ANNUAL_RECURRING_CNY))}/年`,
                en: `Approx. US$${Math.round(ANNUAL_RECURRING_CNY / RMB_PER_USD).toLocaleString('en-US')}/year`,
              })}</dd>
            </div>
          </dl>
          <h3 className="infra-expense-detail-title">
            {localize(lang, { zh: '持续支出明细', en: 'Recurring expense details' })}
          </h3>
          <div className="infra-equipment-groups">
          <dl className="infra-expenses infra-equipment-list">
            {EXPENSES.map((expense) => {
              const logo = EXPENSE_LOGOS[expense.name.en];
              return <div key={`${expense.name.en}-${expense.amount.value}`} className="infra-equipment-featured" data-site-surface="panel">
                {expense.name.en === 'Internship' && <div className="infra-equipment-art infra-brand-art" aria-hidden="true">
                  <UserRound className="infra-brand-logo" strokeWidth={1.5} />
                </div>}
                {logo && <div className="infra-equipment-art infra-brand-art" aria-hidden="true">
                  <Image
                    className={`infra-brand-logo${logo.wide ? ' infra-brand-logo-wide' : ''}${logo.lightFile ? ' infra-brand-logo-dark' : ''}${logo.appIcon ? ' infra-brand-app-icon' : ''}`}
                    src={`/images/dev/infrastructure/brands/${logo.file}`}
                    alt="" width={220} height={128} unoptimized
                  />
                  {logo.lightFile && <Image
                    className="infra-brand-logo infra-brand-logo-light"
                    src={`/images/dev/infrastructure/brands/${logo.lightFile}`}
                    alt="" width={220} height={128} unoptimized
                  />}
                </div>}
                <dt>
                  <span>{localize(lang, expense.name)}</span>
                  <small>{localize(lang, expense.purpose)}</small>
                </dt>
                <dd>{formatRecurringAmount(lang, expense.amount)}</dd>
              </div>;
            })}
          </dl>
          </div>
          <p className="infra-expense-note">
            {localize(lang, {
              zh: `一次性投入合计包含下方所有已标价设备（含曾用 Canon EOS R6 与 Mac mini）及一年工位租赁订单总额；工位不计入持续年度费用。MacBook Pro 按同配置 512GB 基础机型首发价计入；截图未显示存储容量，因此总额为最低值。两台 iPhone 按对应容量的中国大陆发售价计入，免费软件不计入。实习生按 ¥300/天、每周 3 天、每月约 12 天估算为 ¥3,600/月，年度按 12 个月折算。年度费用按 2026-08-27 人民币汇率中间价 1 美元 = ${RMB_PER_USD.toFixed(4)} 元换算，实际支出会随汇率变动，不含用量计费与税费。`,
              en: `The one-time total includes all priced equipment below (including the former Canon EOS R6 and Mac mini) and the one-year workspace order total; the workspace is excluded from recurring annual expenses. The MacBook Pro is counted at the launch price of the 512GB base configuration; because the screenshot does not show its storage capacity, this is a minimum total. Both iPhones are counted at the mainland China launch prices for their storage capacities; free software is excluded. The internship budget is CN¥300/day, three days/week and approximately 12 days/month, or CN¥3,600/month, annualized over 12 months. Annual costs use the 2026-08-27 RMB central parity rate of US$1 = CN¥${RMB_PER_USD.toFixed(4)} and vary with exchange rates; usage charges and taxes are excluded.`,
            })}
          </p>
        </section>

        <section className="infra-section" aria-labelledby="infra-equipment-title">
          <div className="infra-section-heading">
            <span>02</span>
            <div>
              <h2 id="infra-equipment-title">{localize(lang, { zh: '一次性投入', en: 'One-time investment details' })}</h2>
              <p>
                {localize(lang, {
                  zh: '包含仅租一年的公司注册工位，以及拍摄、收音、剪辑与日常开发设备。价格按现有记录展示；“约”表示近似金额，未标价项目不据此推算。',
                  en: 'Includes the single-year company registration workspace lease and equipment for filming, audio capture, editing, and day-to-day development. Prices follow the available records; “approx.” marks estimates, and missing prices are not inferred.',
                })}
              </p>
            </div>
          </div>
          <h3 className="infra-expense-detail-title">
            {localize(lang, { zh: '一次性工位租赁', en: 'One-off workspace lease' })}
          </h3>
          <div className="infra-equipment-groups">
            <dl className="infra-expenses infra-equipment-list">
              {ONE_TIME_EXPENSES.map(expense => (
                <div key={expense.name.en} className="infra-equipment-featured" data-site-surface="panel">
                  <dt>
                    <span>{localize(lang, expense.name)}</span>
                    <small>{localize(lang, expense.detail)}</small>
                  </dt>
                  <dd>{formatYuan(lang, expense.amount)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="infra-equipment-groups">
            {EQUIPMENT_GROUPS.map((group) => (
              <section className="infra-equipment-group" key={group.category.en} aria-label={localize(lang, group.category)}>
                <h3>{localize(lang, group.category)}</h3>
                <dl className="infra-expenses infra-equipment-list">
                  {group.items.map((item) => (
                    <div key={item.name.en} className="infra-equipment-featured" data-site-surface="panel">
                      <div className="infra-equipment-art">
                        <Image
                          className="infra-equipment-image"
                          style={item.imageScale ? { transform: `scale(${item.imageScale})` } : undefined}
                          src={item.imageSrc}
                          alt={localize(lang, item.name)}
                          width={180}
                          height={180}
                          sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                          unoptimized
                        />
                      </div>
                      <dt>
                        <span>
                          {item.href ? (
                            <a href={item.href} target="_blank" rel="noreferrer">
                              {localize(lang, item.name)}
                            </a>
                          ) : (
                            localize(lang, item.name)
                          )}
                        </span>
                        <small>{localize(lang, item.detail)}</small>
                      </dt>
                      <dd>{formatEquipmentAmount(lang, item.amount)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
