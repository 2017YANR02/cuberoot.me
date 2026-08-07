import { describe, expect, it } from 'vitest';

import { pickTrainerLiveVisual } from '@/app/[lang]/alg/_trainer/trainer-live-view';

describe('trainer live smart-cube visual', () => {
  it('shows each flat projection immediately when live facelets exist', () => {
    expect(pickTrainerLiveVisual('qcube', true)).toBe('qcube');
    expect(pickTrainerLiveVisual('qlast', true)).toBe('qlast');
    expect(pickTrainerLiveVisual('q2look', true)).toBe('q2look');
  });

  it('shows 3D immediately before the first turn', () => {
    expect(pickTrainerLiveVisual('3d', true)).toBe('3d');
    expect(pickTrainerLiveVisual('3d', false)).toBe('3d');
  });

  it('keeps the case image when None is selected', () => {
    expect(pickTrainerLiveVisual('none', true)).toBe('idle');
    expect(pickTrainerLiveVisual('none', false)).toBe('idle');
  });

  it('does not invent flat projections without facelets', () => {
    expect(pickTrainerLiveVisual('qcube', false)).toBe('idle');
    expect(pickTrainerLiveVisual('qlast', false)).toBe('idle');
    expect(pickTrainerLiveVisual('q2look', false)).toBe('idle');
  });
});
