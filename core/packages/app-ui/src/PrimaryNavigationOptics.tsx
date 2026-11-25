'use client';

import { GlassOptics, SiteGlassOptics } from '@app-foundation/ui-controls/glass-optics';
import type { RefObject } from 'react';

type OpticsTarget =
  | { navigation: RefObject<HTMLElement | null>; siteWide?: never }
  | { siteWide: true; navigation?: never };

export function PrimaryNavigationOptics({ navigation, displacementScale }: OpticsTarget & { displacementScale?: number }) {
  return navigation
    ? <GlassOptics targetRef={navigation} cssVariable="--app-nav-lens-optics" displacementScale={displacementScale} />
    : <SiteGlassOptics />;
}
