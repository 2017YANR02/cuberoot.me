import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  requireAuth: vi.fn(),
  hasActiveMembership: vi.fn(),
}));

vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  ADMIN_WCA_IDS: ['2017YANR02'],
  requireAuth: mocks.requireAuth,
}));
vi.mock('../src/utils/membership.js', () => ({
  hasActiveMembership: mocks.hasActiveMembership,
}));

import { wcaTeacherRoutes } from '../src/routes/wca_teachers';

const app = new Hono().route('/v1', wcaTeacherRoutes);

describe('GET /v1/wca/teachers', () => {
  beforeEach(() => mocks.query.mockReset());

  it('looks up every student relation for one teacher without requiring events', async () => {
    mocks.query.mockResolvedValueOnce([{
      student_wca_id: '2026FANG02',
      student_name: 'Leede Fang',
      student_333_average: 1234,
      event_id: '333',
      teacher_wca_id: '2017YANR02',
      teacher_name: 'Ruimin Yan (颜瑞民)',
      teacher_country_iso2: 'CN',
    }]);

    const response = await app.request('/v1/wca/teachers?teachers=2017yanr02');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ teachers: [{
      studentWcaId: '2026FANG02',
      studentName: 'Leede Fang',
      student333Average: 1234,
      eventId: '333',
      teacherWcaId: '2017YANR02',
      teacherName: 'Ruimin Yan (颜瑞民)',
      teacherCountryIso2: 'CN',
    }] });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE wt.teacher_wca_id IN (?)'),
      ['2017YANR02'],
    );
    const sql = mocks.query.mock.calls[0][0];
    expect(sql).toContain(
      'LEFT JOIN wca_countries teacher_country ON teacher_country.id = teacher.country_id',
    );
    expect(sql).toContain('teacher_country.iso2 AS teacher_country_iso2');
    expect(sql).toContain('MIN(result.average) AS best_average');
    expect(sql).toContain("result.event_id = '333'");
    expect(sql).toContain('result.average > 0');
    expect(sql).not.toContain('teacher.country_iso2');
    expect(sql).not.toContain('wt.event_id IN');
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

describe('GET /v1/wca/teachers/:teacherId/named-students', () => {
  beforeEach(() => mocks.query.mockReset());

  it('returns roster students without fabricating WCA IDs', async () => {
    mocks.query.mockResolvedValueOnce([{
      id: '550e8400-e29b-41d4-a716-446655440000',
      teacher_wca_id: '2017YANR02',
      student_name: '小明',
      country_iso2: 'CN',
      event_ids: ['333', 'pyram'],
    }]);

    const response = await app.request('/v1/wca/teachers/2017yanr02/named-students');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ students: [{
      id: '550e8400-e29b-41d4-a716-446655440000',
      teacherWcaId: '2017YANR02',
      studentName: '小明',
      countryIso2: 'CN',
      eventIds: ['333', 'pyram'],
    }] });
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM wca_teacher_named_students student'),
      ['2017YANR02'],
    );
  });

  it('rejects an invalid teacher ID before querying the roster', async () => {
    const response = await app.request('/v1/wca/teachers/not-an-id/named-students');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid teacher WCA ID' });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe('POST /v1/wca/teachers/:teacherId/named-students', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.requireAuth.mockReset();
    mocks.hasActiveMembership.mockReset();
  });

  it('lets an administrator add a named student for any teacher', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2017YANR02' });
    mocks.query
      .mockResolvedValueOnce([{ wca_id: '2020TENG01', country_exists: true }])
      .mockResolvedValueOnce([{
        id: '550e8400-e29b-41d4-a716-446655440000',
        teacher_wca_id: '2020TENG01',
        student_name: '小明',
        country_iso2: 'CN',
        event_ids: ['333', 'pyram'],
      }]);

    const response = await app.request('/v1/wca/teachers/2020teng01/named-students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentName: '  小明  ', countryIso2: 'cn', eventIds: ['333', 'pyram'] }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ student: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      teacherWcaId: '2020TENG01',
      studentName: '小明',
      countryIso2: 'CN',
      eventIds: ['333', 'pyram'],
    } });
    expect(mocks.hasActiveMembership).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('EXISTS (SELECT 1 FROM wca_countries'),
      ['CN', '2020TENG01'],
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/INSERT INTO wca_teacher_named_students[\s\S]+ON CONFLICT DO NOTHING/),
      expect.arrayContaining(['2020TENG01', '小明', 'CN', '2017YANR02', '333', 'pyram']),
    );
  });

  it('returns a conflict when the named student is already on the roster', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2017YANR02' });
    mocks.query
      .mockResolvedValueOnce([{ wca_id: '2020TENG01', country_exists: true }])
      .mockResolvedValueOnce([]);

    const response = await app.request('/v1/wca/teachers/2020teng01/named-students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentName: '小明', countryIso2: 'CN', eventIds: ['333'] }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'student already exists' });
  });

  it('rejects a country code that is not in the WCA country list', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2017YANR02' });
    mocks.query.mockResolvedValueOnce([{ wca_id: '2020TENG01', country_exists: false }]);

    const response = await app.request('/v1/wca/teachers/2020teng01/named-students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentName: '小明', countryIso2: 'ZZ', eventIds: ['333'] }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid country' });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it('prevents a member from adding students to another teacher roster', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2020TENG01' });

    const response = await app.request('/v1/wca/teachers/2017yanr02/named-students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentName: '小明', countryIso2: 'CN', eventIds: ['333'] }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'only the teacher can manage this roster' });
    expect(mocks.hasActiveMembership).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe('PUT /v1/wca/teachers/:teacherId/named-students/:namedStudentId', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.requireAuth.mockReset();
    mocks.hasActiveMembership.mockReset();
  });

  it('updates a named student nationality together with taught events', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2017YANR02' });
    mocks.query
      .mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440000', country_exists: true }])
      .mockResolvedValueOnce([]);

    const response = await app.request(
      '/v1/wca/teachers/2020teng01/named-students/550e8400-e29b-41d4-a716-446655440000',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentName: '小明', countryIso2: 'de', eventIds: ['333'] }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ student: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      teacherWcaId: '2020TENG01',
      studentName: '小明',
      countryIso2: 'DE',
      eventIds: ['333'],
    } });
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('country_iso2 = ?'),
      expect.arrayContaining(['小明', 'DE', '2017YANR02', '333']),
    );
  });
});

describe('PUT /v1/wca/teachers/:studentId/:eventId', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.requireAuth.mockReset();
    mocks.hasActiveMembership.mockReset();
  });

  it('allows an active member student to choose and replace their own teacher', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2026GANR02' });
    mocks.hasActiveMembership.mockResolvedValueOnce(true);
    mocks.query
      .mockResolvedValueOnce([
        { wca_id: '2026GANR02', name: 'Student', country_iso2: 'AU' },
        { wca_id: '2017YANR02', name: 'Teacher', country_iso2: 'CN' },
      ])
      .mockResolvedValueOnce([{ teacher_wca_id: '2020TENG01' }])
      .mockResolvedValueOnce([{
        student_wca_id: '2026GANR02',
        student_name: 'Student',
        event_id: '333',
        teacher_wca_id: '2017YANR02',
        teacher_name: 'Teacher',
      }]);

    const response = await app.request('/v1/wca/teachers/2026ganr02/333', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teacherWcaId: '2017yanr02' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ teacher: {
      studentWcaId: '2026GANR02',
      studentName: 'Student',
      eventId: '333',
      teacherWcaId: '2017YANR02',
      teacherName: 'Teacher',
      teacherCountryIso2: 'CN',
    } });
    expect(mocks.hasActiveMembership).toHaveBeenCalledWith('2026GANR02');
    expect(mocks.query.mock.calls[0][0]).toContain(
      'LEFT JOIN wca_countries country ON country.id = person.country_id',
    );
    expect(mocks.query.mock.calls[0][0]).not.toContain('FROM wca_persons WHERE');
    expect(mocks.query).toHaveBeenNthCalledWith(
      3,
      expect.not.stringContaining('WHERE wca_teachers.teacher_wca_id = EXCLUDED.teacher_wca_id'),
      expect.arrayContaining(['2026GANR02', '333', '2017YANR02']),
    );
  });

  it('rejects a non-member student before changing their own teacher', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2026GANR02' });
    mocks.hasActiveMembership.mockResolvedValueOnce(false);

    const response = await app.request('/v1/wca/teachers/2026ganr02/333', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teacherWcaId: '2017yanr02' }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'active membership required' });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});

describe('DELETE /v1/wca/teachers/:studentId/:eventId', () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.requireAuth.mockReset();
    mocks.hasActiveMembership.mockReset();
  });

  it('allows an active member student to remove their own teacher relation', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2026GANR02' });
    mocks.hasActiveMembership.mockResolvedValueOnce(true);
    mocks.query
      .mockResolvedValueOnce([{ teacher_wca_id: '2017YANR02' }])
      .mockResolvedValueOnce([]);

    const response = await app.request('/v1/wca/teachers/2026ganr02/333', { method: 'DELETE' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.hasActiveMembership).toHaveBeenCalledWith('2026GANR02');
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM wca_teachers WHERE student_wca_id = ? AND event_id = ?',
      ['2026GANR02', '333'],
    );
  });

  it('keeps removal of a student-owned relation behind membership', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ wcaId: '2026GANR02' });
    mocks.hasActiveMembership.mockResolvedValueOnce(false);
    mocks.query.mockResolvedValueOnce([{ teacher_wca_id: '2017YANR02' }]);

    const response = await app.request('/v1/wca/teachers/2026ganr02/333', { method: 'DELETE' });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'active membership required' });
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
