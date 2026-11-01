'use client';
import PageBackLink from './PageBackLink';
/** Default home return, overridden only by an explicit account-entry continuation. */
export default function BackHome(props: { className?: string; prefetch?: false; miniProgramTarget?: 'tools' | 'account' }) {
  return <PageBackLink {...props} />;
}
