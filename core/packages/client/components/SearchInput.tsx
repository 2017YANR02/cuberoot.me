'use client';
import { SearchInput as SharedSearchInput, type SearchInputProps } from '@cuberoot/timer-ui/search-input';
import { tr } from '@/i18n/tr';
export function SearchInput(props: Omit<SearchInputProps, 'clearLabel'>) {
  return <SharedSearchInput {...props} clearLabel={tr({ en: 'Clear', zh: '清除' })} />;
}
export default SearchInput;
