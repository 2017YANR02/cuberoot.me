import ColpiClient from './_components/ColpiClient';

/**
 * /memo/colpi — landing route. The client component reads useParams() which is
 * empty here, then redirects to /memo/colpi/<DEFAULT_PAIR> (default = first
 * letter in the active language's alphabet doubled, e.g. AA / ああ).
 */
export default function Page() {
  return <ColpiClient />;
}
