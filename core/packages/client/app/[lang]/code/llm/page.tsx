'use client';

// /code/llm — the "大模型 / LLMs" hub. Collects every large-language-model
// page on the site: the Claude chat model, the Claude Code CLI agent, and the
// bespoke Claude Fable 5 page. Reuses the /code index card styling.
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import '../code_index.css';
import { tr } from '@/i18n/tr';

interface Card {
  href: string;
  glyph: string;
  accent: string;
  zh: { title: string; sub: string; tagline: string; meta: string };
  en: { title: string; sub: string; tagline: string; meta: string };
}

const CARDS: Card[] = [
  {
    href: '/code/llm/claude',
    glyph: '✦',
    accent: '#D97757',
    zh: {
      title: 'Claude',
      sub: 'Anthropic LLM',
      tagline: 'Anthropic 的对话 / 工具 / 代码大模型。本项目迁移到 Codex 前的主要历史协作模型。',
      meta: 'Anthropic · Opus 4.7',
    },
    en: {
      title: 'Claude',
      sub: 'Anthropic LLM',
      tagline: 'Anthropic’s chat / tool-use / coding LLM. The project’s main historical collaborator before the migration to Codex.',
      meta: 'Anthropic · Opus 4.7',
    },
  },
  {
    href: '/code/llm/claude-code',
    glyph: '>_',
    accent: '#D97757',
    zh: {
      title: 'Claude Code',
      sub: 'CLI Agent',
      tagline: 'Anthropic 官方 CLI agent。本项目曾经的主维护环境,现已完全迁移到 Codex。',
      meta: 'Anthropic · v2',
    },
    en: {
      title: 'Claude Code',
      sub: 'CLI Agent',
      tagline: 'Anthropic’s official CLI agent. The project’s former primary maintenance environment, now fully migrated to Codex.',
      meta: 'Anthropic · v2',
    },
  },
  {
    href: '/code/llm/sonnet-5',
    glyph: '◐',
    accent: '#D97757',
    zh: {
      title: 'Claude Sonnet 5',
      sub: 'Agentic Sonnet',
      tagline: '迄今最具自主智能体能力的 Sonnet 模型。代理式编码、工具调用、终端自主操作全面逼近 Opus 4.8,价格却只是零头。',
      meta: 'Anthropic · 2026-06-30',
    },
    en: {
      title: 'Claude Sonnet 5',
      sub: 'Agentic Sonnet',
      tagline: 'The most agentic Sonnet model yet. Agentic coding, tool use and terminal autonomy close in on Opus 4.8, at a fraction of the price.',
      meta: 'Anthropic · 2026-06-30',
    },
  },
  {
    href: '/code/llm/fable',
    glyph: '✶',
    accent: '#D97757',
    zh: {
      title: 'Claude Fable 5',
      sub: 'Mythos-class',
      tagline: 'Anthropic 最强的 Claude,首个公开可用的 Mythos 级模型。软件工程 / 知识工作 / 视觉 / 科研几乎全面 SOTA,为长程自主工作而生。',
      meta: 'Anthropic · 2026-06-09',
    },
    en: {
      title: 'Claude Fable 5',
      sub: 'Mythos-class',
      tagline: 'Anthropic’s most capable Claude — the first generally available Mythos-class model. SOTA across software engineering, knowledge work, vision and science, built for long-horizon autonomy.',
      meta: 'Anthropic · 2026-06-09',
    },
  },
];

export default function CodeLlmPage() {
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = (i18n.language.startsWith('zh') ? 'zh' : 'en');

  return (
    <div className="code-index">
      <div className="code-index-bg" />

      <header className="code-index-head">
        <div className="code-index-topbar">
          <Link href="/code" className="code-index-back">
            ← /code
          </Link>
        </div>
        <h1 className="code-index-title">
          <span className="code-index-prefix">/</span>llm
          <span className="code-index-cursor">_</span>
        </h1>
        <p className="code-index-sub">
          {tr({
            zh: '记录 cuberoot.me 与大语言模型协作历史的档案。从对话模型 Claude、官方 CLI agent Claude Code,到 Claude Sonnet 5 与 Claude Fable 5;当前项目维护环境已迁移到 Codex。',
            en: 'An archive of cuberoot.me’s collaboration history with large language models, from Claude and the Claude Code CLI agent to Claude Sonnet 5 and Claude Fable 5. The project’s current maintenance environment is Codex.'
          })}
        </p>
      </header>

      <main className="code-index-grid">
        {CARDS.map((c) => {
          const t = c[lang];
          return (
            <Link
              key={c.href}
              href={c.href}
              className="code-index-card"
              style={{ ['--accent' as string]: c.accent }}
            >
              <div className="code-index-card-top">
                <div className="code-index-card-glyph">{c.glyph}</div>
                <div className="code-index-card-route">{c.href}</div>
              </div>
              <div className="code-index-card-title">{t.title}</div>
              <div className="code-index-card-sub">{t.sub}</div>
              <p className="code-index-card-tagline">{t.tagline}</p>
              <div className="code-index-card-foot">
                <span className="code-index-card-meta">{t.meta}</span>
                <span className="code-index-card-arrow">→</span>
              </div>
            </Link>
          );
        })}
      </main>

      <footer className="code-index-foot">
        <div className="code-index-foot-line">
          <Link href="/code">/code</Link>
        </div>
      </footer>
    </div>
  );
}
