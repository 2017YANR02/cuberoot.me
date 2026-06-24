'use client';

// Faithful de-MUI port of roux-trainers/src/components/CaseVisualizer.tsx.
// No MUI in this file — it imperatively renders an SVG via sr-visualizer into a
// ref div inside a client-only useEffect (SSR-safe). Engine import path moved to
// the ported CubeLib. The local sr-visualizer exposes ICubeOptions (not a
// `CubeOptions` member), so we alias it to keep the upstream prop signature shape.

import React, { useEffect } from 'react';
import * as SRVisualizer from 'sr-visualizer';
import { MoveSeq } from '@/lib/roux/CubeLib';

// Upstream wrote `Partial<SRVisualizer.CubeOptions>`; the installed package's
// option type is `ICubeOptions`. Re-export under the upstream name so the prop
// signature reads identically.
export type CubeOptions = SRVisualizer.ICubeOptions;

function CaseVisualizer(props: {
  name: string;
  alg: string;
  size: number;
  mask?: string;
  color?: string[];
  cubeOptions: Partial<SRVisualizer.ICubeOptions>;
}) {
  const mount = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const dom = mount.current;
    if (dom) {
      const args: SRVisualizer.ICubeOptions = {
        width: props.size,
        height: props.size,
        view: 'plan',
        algorithm: new MoveSeq(props.alg).inv().toString(),
        mask: props.mask as SRVisualizer.Masking,
        ...props.cubeOptions,
      };
      const color = props.color;
      if (color) {
        // map our scheme (UDFBLR) to theirs (URFDLB)
        args.colorScheme = [
          color[0],
          color[5],
          color[2],
          color[1],
          color[4],
          color[3],
        ] as unknown as { [face: number]: string };
      }
      SRVisualizer.cubeSVG(dom, args);
    }
    return () => {
      if (dom) dom.innerHTML = '';
    };
  });
  return <div ref={mount}></div>;
}

export default CaseVisualizer;
