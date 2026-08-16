// LLM section landing-card meta. Same StackToolMeta shape as /dev/stack —
// these two tools were moved out of stack into /dev/llm. Full detail lives in
// ../_tools/<slug>.tsx (lazy, via llm_data.ts). Fable 5 is a bespoke page
// (../fable), not a shell-rendered tool, so it is not listed here.
import type { StackToolMeta } from '../../stack/_lib/stack_meta';

export const LLM_TOOLS_META: StackToolMeta[] = [
  { slug: 'claude', name: "Claude", version: 'Opus 4.7', since: '2023-03', group: 'dev', accent: '#D97757', bright: '#E89578', glyph: "✦",
    zh: { tagline: "Anthropic 的对话/工具/代码 LLM", role: "cuberoot.me 迁移到 Codex 前的主要历史协作模型。" },
    en: { tagline: "Anthropic's chat / tool-use / coding LLM", role: "The main historical collaborator on cuberoot.me before the project migrated to Codex." } },
  { slug: 'claude-code', name: "Claude Code", version: '2.x', since: '2025-02', group: 'dev', accent: '#D97757', bright: '#E89578', glyph: ">_",
    zh: { tagline: "Anthropic 官方 CLI agent", role: "本项目曾经的主维护环境;现已完全迁移到 Codex。" },
    en: { tagline: "Anthropic's official CLI agent", role: "This project's former primary maintenance environment; it has now fully migrated to Codex." } },
];
