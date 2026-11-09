import { beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type Practice from '../app/[lang]/tutorial/lbl/Practice';
const state = vi.hoisted(() => ({
  route: { view: 'practice', step: 'corners', case: '2' },
  setRoute: vi.fn(), props: null as null | Parameters<typeof Practice>[0],
}));
vi.mock('nuqs', () => ({ parseAsString: {}, useQueryStates: () => [state.route, state.setRoute] }));
vi.mock('../app/[lang]/tutorial/lbl/Practice', () => ({ default: (props: Parameters<typeof Practice>[0]) => { state.props = props; return null; } }));
import PracticeRoute from '../app/[lang]/tutorial/lbl/PracticeRoute';
beforeEach(() => { state.setRoute.mockClear(); state.route = { view: 'practice', step: 'corners', case: '2' }; });
const render = () => { renderToString(createElement(PracticeRoute)); return state.props!; };
it('restores the shared chapter and displayed exercise number', () => {
  const props = render();
  expect(props.step.id).toBe('corners');
  expect(props.initialIndex).toBe(props.exampleOrder![1]);
  props.onIndexChange!(2);
  expect(state.setRoute).toHaveBeenCalledWith({ step: 'corners', case: '3' });
});
it('crosses chapter boundaries into the first or last exercise', () => {
  const props = render();
  props.onNextChapter!();
  expect(state.setRoute).toHaveBeenLastCalledWith({ step: 'middle', case: '1' });
  props.onPreviousChapter!();
  expect(state.setRoute).toHaveBeenLastCalledWith({ step: 'cross', case: '1' });
});
it('restores the extra white-edge exercise and then enters the normal order', () => {
  state.route = { view: 'practice', step: 'cross', case: 'white-edge' };
  const props = render();
  expect(props.extraExample?.title.zh).toBe('白棱归位');
  props.onIndexChange!(1);
  expect(state.setRoute).toHaveBeenLastCalledWith({ step: 'cross', case: '1' });
});
it('falls back for invalid parameters and disables the global previous action', () => {
  state.route = { view: 'practice', step: 'invalid', case: '-1' };
  const props = render();
  expect(props.step.id).toBe('daisy');
  expect(props.initialIndex).toBe(props.exampleOrder![0]);
  expect(props.onPreviousChapter).toBeUndefined();
});
