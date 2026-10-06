import { createContext, useContext } from 'react';
export const TimerWorkspaceLanguage = createContext<'en' | 'zh'>('en');
export function useWorkspaceText() { const language = useContext(TimerWorkspaceLanguage); return <T,>(copy: {en: T; zh: T}): T => copy[language]; }
