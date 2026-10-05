'use client';
import { StackmatModal as SharedModal, type StackmatModalProps } from '@cuberoot/timer-ui/external';
import { tr } from '@/i18n/tr';
import { useIsMobile } from '@/hooks/useIsMobile';
export default function StackmatModal(props: Omit<StackmatModalProps, 'localize' | 'compact'>) {
return <SharedModal {...props} localize={tr} compact={useIsMobile(480)} />;
}
