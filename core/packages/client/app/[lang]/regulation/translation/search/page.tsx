import TranslationSearch from './TranslationSearch';
import { Suspense } from 'react';
import '../../regulation.css';
import './search.css';

export default function TranslationSearchPage() {
  return <div className="reg-page"><div className="reg-wrap"><Suspense><TranslationSearch /></Suspense></div></div>;
}
