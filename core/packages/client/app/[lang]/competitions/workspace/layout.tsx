import type { ReactNode } from 'react';
import { CompetitionHostShell } from './_components/CompetitionHostShell';
import '@/components/platform/platform.css';
import './workspace.css';

export default function Layout({ children }: { children: ReactNode }) {
  return <CompetitionHostShell>{children}</CompetitionHostShell>;
}
