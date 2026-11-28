'use client';

import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { CompCuberPicker } from '@/components/CompCuberPicker';
import { RegionPicker } from '@/components/RegionPicker';
import { tr } from '@/i18n/tr';
import './competition-search-filters.css';

export function CompetitionSearchFilters({ isZh, search, countries, countryOptions, onCountriesChange }: {
  isZh: boolean;
  search: Omit<ComponentProps<typeof CompCuberPicker>, 'isZh' | 'className' | 'placeholder'>;
  countries: string[];
  countryOptions: string[];
  onCountriesChange: (countries: string[]) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <CompCuberPicker
        {...search}
        className="search-box-comp"
        isZh={isZh}
        placeholder={tr({ zh: '搜比赛或选手', en: 'Search comps or cubers' })}
      />
      <RegionPicker
        className="country-filter"
        multi
        isZh={isZh}
        value={countries}
        onChange={onCountriesChange}
        restrictTo={countryOptions}
        allLabel={t('upcoming.allCountries')}
      />
    </>
  );
}
