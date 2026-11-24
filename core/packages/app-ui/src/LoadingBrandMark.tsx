const brandMarkUrl = new URL('../../../assets/brand/CubeRoot-mark.svg', import.meta.url).href;

/** Hosts can reuse the same asset URL as their startup screen. */
export function LoadingBrandMark({ src = brandMarkUrl }: { src?: string }) {
  return <span className="loading-brand-mark" aria-hidden="true">
    <img src={src} alt="" width={144} height={82} />
    <img className="loading-brand-colours" src={src} alt="" width={144} height={82} />
  </span>;
}
