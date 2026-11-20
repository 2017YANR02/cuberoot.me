import { TeX as InlineFormula, TeXBlock as DisplayFormula } from '@/components/math/Tex';

export function TeX({ src }: { src: string }) {
  return <InlineFormula src={src} withMathML />;
}

export function TeXBlock({ src }: { src: string }) {
  return <DisplayFormula src={src} withMathML />;
}

/** Compile only explicitly delimited math, leaving translated prose as normal text. */
export function MathProse({ children }: { children: string }) {
  return <>{children.split(/\\\(([\s\S]*?)\\\)/g).map((part, index) =>
    index % 2 ? <TeX key={index} src={part} /> : part
  )}</>;
}
