'use client';

import { type ReactNode } from 'react';

/** A stable viewport; individual shots reflow without scaling their text. */
export default function VideoStage({ children }: { children: ReactNode }) {
  return <div className="f2l-video-viewport"><div className="f2l-video-stage">{children}</div></div>;
}
