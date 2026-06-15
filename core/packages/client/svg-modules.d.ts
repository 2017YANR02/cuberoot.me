// Ambient declaration so `import icon from './x.svg'` typechecks under tsgo in
// CI, where Next's generated next-env.d.ts (which pulls in
// next/image-types/global) is absent. Matches Next's StaticImageData type so it
// agrees with that declaration when both are present (local / after a build).
declare module '*.svg' {
  import type { StaticImageData } from 'next/image';
  const content: StaticImageData;
  export default content;
}
