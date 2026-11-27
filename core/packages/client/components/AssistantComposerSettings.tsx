'use client';

import { CHAT_PROVIDERS, type AssistantThinkingMode, type ChatProvider } from '@cuberoot/shared/site-assistant';
import { CompactSelect } from './CompactSelect';
import LiquidGlassChips from './LiquidGlassChips';
import { tr } from '@/i18n/tr';

const modelNames = { openai: 'GPT-6 Luna', bailian: 'Qwen-3.8 Flash', deepseek: 'DeepSeek Flash' };
const thinkingModes = ['auto', 'fast', 'deep'] as const;
const modeNames = {
  auto: { zh: '自动', en: 'Auto thinking' },
  fast: { zh: '快速', en: 'Quick answer' },
  deep: { zh: '深入', en: 'Deep thinking' },
};

interface Props {
  provider: ChatProvider;
  thinking: AssistantThinkingMode;
  openaiAvailable: boolean;
  onProviderChange: (value: ChatProvider) => void;
  onThinkingChange: (value: AssistantThinkingMode) => void;
}

export default function AssistantComposerSettings({ provider, thinking, openaiAvailable, onProviderChange, onThinkingChange }: Props) {
  const providers = CHAT_PROVIDERS.filter(id => id !== 'openai' || openaiAvailable);
  const modelTitle = tr({ zh: '聊天模型', en: 'Chat model' });
  const modeTitle = tr({ zh: '思考模式', en: 'Thinking mode' });
  const model = modelNames[provider];
  const mode = tr(modeNames[thinking]);
  const combined = model + ' · ' + mode;
  const modelChips = (close?: () => void) => (
    <LiquidGlassChips items={providers} value={provider} getLabel={id => modelNames[id]}
      role="listbox" ariaLabel={modelTitle} onChange={onProviderChange} onCommit={close} />
  );
  const modeChips = (close?: () => void) => (
    <LiquidGlassChips items={thinkingModes} value={thinking} getLabel={id => tr(modeNames[id])}
      role="listbox" ariaLabel={modeTitle} onChange={onThinkingChange} onCommit={close} />
  );
  const menu = {
    items: [], onChange: () => {}, side: 'top', align: 'center', variant: 'plain',
    popupClassName: 'site-assistant-menu site-assistant-settings-menu', preserveFocus: true, keyboardListNavigation: true,
  } as const;

  return <>
    <CompactSelect {...menu} className="site-assistant-thinking site-assistant-provider" ariaLabel={modelTitle}
      label={model} valueText={model} triggerTooltip={tr({ zh: '切换模型', en: 'Switch model' })} panelContent={modelChips} />
    <CompactSelect {...menu} className="site-assistant-thinking site-assistant-thinking-mode" ariaLabel={modeTitle}
      label={mode} valueText={mode} triggerTooltip={tr({ zh: '切换模式', en: 'Switch mode' })} panelContent={modeChips} />
    <CompactSelect {...menu} className="site-assistant-mobile-settings" ariaLabel={tr({ zh: '模型和思考模式', en: 'Model and thinking mode' })}
      label={combined} valueText={combined} triggerTooltip={tr({ zh: '切换模型和模式', en: 'Switch model and mode' })}
      panelContent={<div className="site-assistant-settings-groups">
        <div><span>{modelTitle}</span>{modelChips()}</div>
        <div><span>{modeTitle}</span>{modeChips()}</div>
      </div>} />
  </>;
}
