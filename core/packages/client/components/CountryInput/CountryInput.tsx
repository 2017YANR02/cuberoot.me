'use client';
import { CountryInput as SharedCountryInput, type CountryInputProps } from '@cuberoot/timer-ui/country-input';
import { useTranslation } from 'react-i18next';
import { usePinnedCountries } from '@/hooks/usePinnedCountries';
import { CountryPinButton } from '@/components/CountryPinButton';
export function CountryInput(props: CountryInputProps) {
  const { i18n } = useTranslation();
  const [pins, toggle] = usePinnedCountries();
  return <SharedCountryInput {...props} host={{ language: i18n.language.startsWith('zh') ? 'zh' : 'en', pins, renderPin: (iso2, name, pinned) => <CountryPinButton name={name} pinned={pinned} onToggle={() => toggle(iso2)} /> }} />;
}
