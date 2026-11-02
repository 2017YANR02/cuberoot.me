import { ChevronRight } from '@app-foundation/icons/lucide';
import Link from '@/components/AppLink';
import { T } from '@/i18n/tr';

export default function ContinueButton({ href, onClick }: { href?: string; onClick?: () => void }) {
  const label = <><T zh="继续" en="Continue" /><ChevronRight size={16} aria-hidden="true" /></>;
  return href
    ? <Link className="lbl-continue" href={href} prefetch={false}>{label}</Link>
    : <button className="lbl-continue" type="button" onClick={onClick}>{label}</button>;
}
