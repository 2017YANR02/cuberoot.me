import { describe, expect, it } from 'vitest';

import { pickTrainerLiveVisual } from '@/app/[lang]/alg/_trainer/trainer-live-view';

describe('trainer live smart-cube visual', () => {
  it('shows q2Look immediately when live facelets exist', () => {
    expect(pickTrainerLiveVisual('q2look', true, 0)).toBe('q2look');
  });

  it('keeps the recognition image only while a 3D rep has not started', () => {
    expect(pickTrainerLiveVisual('3d', true, 0)).toBe('idle');
    expect(pickTrainerLiveVisual('3d', true, 1)).toBe('3d');
  });

  it('does not invent q2Look without facelets', () => {
    expect(pickTrainerLiveVisual('q2look', false, 0)).toBe('idle');
  });
});
