// LLM section landing-card meta. Same StackToolMeta shape as /code/stack —
// these two tools were moved out of stack into /code/llm. Full detail lives in
// ../_tools/<slug>.tsx (lazy, via llm_data.ts). Fable 5 is a bespoke page
// (../fable), not a shell-rendered tool, so it is not listed here.
import type { StackToolMeta } from '../../stack/_lib/stack_meta';

export const LLM_TOOLS_META: StackToolMeta[] = [
  { slug: 'claude', name: "Claude", version: 'Opus 4.7', since: '2023-03', group: 'dev', accent: '#D97757', bright: '#E89578', glyph: "✦",
    zh: { tagline: "Anthropic 的对话/工具/代码 LLM", role: "cuberoot.me 几乎每一行新代码的合写者。Opus 4.7 是每日驾驶, 1M 上下文整仓库能塞进一次会话。" },
    en: { tagline: "Anthropic's chat / tool-use / coding LLM", role: "Co-author of nearly every new line of code on cuberoot.me. Opus 4.7 is the daily driver — the whole repo fits in one conversation at 1M context." } },
  { slug: 'claude-code', name: "Claude Code", version: '2.x', since: '2025-02', group: 'dev', accent: '#D97757', bright: '#E89578', glyph: ">_",
    zh: { tagline: "Anthropic 官方 CLI agent", role: "cuberoot.me 100% 在 Claude Code 里写。Read / Edit / Bash / Grep + 子 agent + skill + memory 的组合替代了 IDE 大半交互。" },
    en: { tagline: "Anthropic's official CLI agent", role: "100% of this codebase is maintained inside Claude Code. Read / Edit / Bash / Grep + subagents + skills + memory replace most of an IDE." } },
];
