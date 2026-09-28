'use client';
import { WcaPersonPicker as SharedWcaPersonPicker, type WcaPersonPickerProps } from '@cuberoot/timer-ui/wca-person-picker';
import { searchPersons, getPerson } from '@/lib/wca-api';
export function WcaPersonPicker(props: WcaPersonPickerProps) {
  return <SharedWcaPersonPicker {...props} searchPersons={searchPersons} getPerson={getPerson} />;
}
