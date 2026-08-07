import { describe, expect, it } from 'vitest';

import { pickTrainerLiveVisual } from '@/app/[lang]/alg/_trainer/trainer-live-view';

describe('trainer live smart-cube visual', () => {
  it('shows q2Look immediately when live facelets exist', () => {
    expect(pickTrainerLiveVisual('q2look', true)).toBe('q2look');
  });

  it('shows 3D immediately before the first turn', () => {
    expect(pickTrainerLiveVisual('3d', true)).toBe('3d');
    expect(pickTrainerLiveVisual('3d', false)).toBe('3d');
  });

  it('does not invent q2Look without facelets', () => {
    expect(pickTrainerLiveVisual('q2look', false)).toBe('idle');
  });
});
