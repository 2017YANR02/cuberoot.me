/** Brand geometry stays in the canonical SVG; hosts supply the asset URL. */
export function LoadingBrandMark({ src }: { src: string }) {
  return <span className="loading-brand-mark" aria-hidden="true">
    <img src={src} alt="" width={144} height={82} />
    <img className="loading-brand-colours" src={src} alt="" width={144} height={82} />
  </span>;
}
