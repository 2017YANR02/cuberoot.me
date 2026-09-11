'use client';
import SharedBoolToggle, { type BoolToggleProps } from '@cuberoot/timer-ui/BoolToggle';
import PillToggle from './PillToggle/PillToggle';
export default function BoolToggle(props: BoolToggleProps) {
  return <SharedBoolToggle {...props} renderSwitch={(switchProps) => <PillToggle {...switchProps} />} />;
}
