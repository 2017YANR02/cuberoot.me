import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));

import { wcaTeacherRoutes } from '../src/routes/wca_teachers';

const app = new Hono().route('/v1', wcaTeacherRoutes);

describe('GET /v1/wca/teachers', () => {
  beforeEach(() => mocks.query.mockReset());

  it('looks up every student relation for one teacher without requiring events', async () => {
    mocks.query.mockResolvedValueOnce([{
      student_wca_id: '2026FANG02',
      student_name: 'Leede Fang',
      event_id: '333',
      teacher_wca_id: '2017YANR02',
      teacher_name: 'Ruimin Yan (颜瑞民)',
    }]);

    const response = await app.request('/v1/wca/teachers?teachers=2017yanr02');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ teachers: [{
      studentWcaId: '2026FANG02',
      studentName: 'Leede Fang',
      eventId: '333',
      teacherWcaId: '2017YANR02',
      teacherName: 'Ruimin Yan (颜瑞民)',
    }] });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE wt.teacher_wca_id IN (?)'),
      ['2017YANR02'],
    );
    expect(mocks.query.mock.calls[0][0]).not.toContain('wt.event_id IN');
  });

  it('preserves the existing student-and-event lookup contract', async () => {
    mocks.query.mockResolvedValueOnce([]);

    const response = await app.request('/v1/wca/teachers?students=2026FANG02&events=333');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ teachers: [] });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE wt.student_wca_id IN (?) AND wt.event_id IN (?)'),
      ['2026FANG02', '333'],
    );
  });

  it('rejects ambiguous forward and reverse filters', async () => {
    const response = await app.request(
      '/v1/wca/teachers?students=2026FANG02&teachers=2017YANR02&events=333',
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'use either students or teachers' });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
