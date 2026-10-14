import axios from 'axios';
import dayjs from 'dayjs';
import { Firestore, Timestamp } from 'firebase-admin/firestore';

import { NYC_TIMEZONE } from '../config/constants';
import { ASPDataService, ParsedASPDay, parseASPRows } from '../services/asp-data.service';
import { ASPDay } from '../types';
import { parseASPDate } from '../utils/date';
import fixture from './fixtures/nyc-asp-sample.json';

jest.mock('axios');
jest.mock('firebase-functions/v2', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

// Real GetCalendar response for 2025-10-24..2025-11-12, captured 2026-10-14 with
// GET https://api.nyc.gov/public/api/GetCalendar?fromdate=2025-10-24&todate=2025-11-12 (weekends, three holiday
// suspensions and the 2025-11-02 DST change). Re-capture the same range if the API shape changes and keep GOLDEN in sync.
const days = fixture.days as ASPDay[];

const IN_EFFECT = 'Alternate side parking and meters are in effect.';

const inEffect = (id: string, date: string): ParsedASPDay => ({
  id,
  feed: { active: true, date: new Date(date), id, metered: true, reason: undefined, text: IN_EFFECT, type: 'NYC' }
});

const suspended = (id: string, date: string, holiday: string): ParsedASPDay => ({
  id,
  feed: {
    active: false,
    date: new Date(date),
    id,
    metered: true,
    reason: `${holiday} 2025`,
    text: `Alternate side parking is suspended for ${holiday}. Meters are in effect.`,
    type: 'NYC'
  }
});

const deleted = (id: string): ParsedASPDay => ({ id, feed: null });

const GOLDEN: ParsedASPDay[] = [
  inEffect('20251024', '2025-10-24T05:00:00.000Z'),
  inEffect('20251025', '2025-10-25T05:00:00.000Z'),
  deleted('20251026'),
  inEffect('20251027', '2025-10-27T05:00:00.000Z'),
  inEffect('20251028', '2025-10-28T05:00:00.000Z'),
  inEffect('20251029', '2025-10-29T05:00:00.000Z'),
  inEffect('20251030', '2025-10-30T05:00:00.000Z'),
  inEffect('20251031', '2025-10-31T05:00:00.000Z'),
  suspended('20251101', '2025-11-01T05:00:00.000Z', "All Saints' Day"),
  deleted('20251102'),
  inEffect('20251103', '2025-11-03T05:00:00.000Z'),
  suspended('20251104', '2025-11-04T05:00:00.000Z', 'Election Day'),
  inEffect('20251105', '2025-11-05T05:00:00.000Z'),
  inEffect('20251106', '2025-11-06T05:00:00.000Z'),
  inEffect('20251107', '2025-11-07T05:00:00.000Z'),
  inEffect('20251108', '2025-11-08T05:00:00.000Z'),
  deleted('20251109'),
  inEffect('20251110', '2025-11-10T05:00:00.000Z'),
  suspended('20251111', '2025-11-11T05:00:00.000Z', 'Veterans Day'),
  inEffect('20251112', '2025-11-12T05:00:00.000Z')
];

const nycDay = (date: Date) => dayjs(date).tz(NYC_TIMEZONE).format('YYYYMMDD');

const parseDay = (id: string) => parseASPRows(days).find(day => day.id === id);

describe('parseASPRows', () => {
  it('parses the recorded response into the exact feed docs', () => {
    expect(parseASPRows(days)).toEqual(GOLDEN);
  });

  it('stores every date on its NYC calendar day', () => {
    for (const { id, feed } of parseASPRows(days)) {
      if (feed) {
        expect(nycDay(feed.date)).toBe(id);
      }
    }
  });

  it('marks a holiday suspension inactive with the exception name as reason', () => {
    expect(parseDay('20251104')?.feed).toMatchObject({
      active: false,
      metered: true,
      reason: 'Election Day 2025'
    });
  });

  it('keeps Saturday rules and deletes the Sunday doc', () => {
    expect(parseDay('20251025')?.feed).toMatchObject({ active: true, metered: true });
    expect(parseDay('20251026')?.feed).toBeNull();
  });

  it('keeps the days around the DST change on their NYC calendar day', () => {
    const saturday = parseDay('20251101')?.feed;
    const monday = parseDay('20251103')?.feed;

    expect(parseDay('20251102')?.feed).toBeNull();
    expect(saturday && dayjs(saturday.date).tz(NYC_TIMEZONE).format('YYYY-MM-DD HH:mm Z')).toBe(
      '2025-11-01 01:00 -04:00'
    );
    expect(monday && dayjs(monday.date).tz(NYC_TIMEZONE).format('YYYY-MM-DD HH:mm Z')).toBe('2025-11-03 00:00 -05:00');
  });

  it('skips malformed rows and finds the ASP item among other items', () => {
    const collections = { type: 'Collections', details: 'Trash collections are on schedule.', status: 'ON SCHEDULE' };
    const rows = [
      { today_id: '20251201', items: [] },
      { today_id: '20251202', items: [collections] },
      {
        today_id: '20251203',
        items: [
          {
            type: 'Alternate Side Parking',
            exceptionName: 'Information Not Available',
            details: 'Information not available.',
            status: 'SUSPENDED'
          }
        ]
      },
      {
        today_id: '20251204',
        items: [collections, { type: 'Alternate Side Parking', details: IN_EFFECT, status: 'IN EFFECT' }]
      }
    ] as ASPDay[];

    expect(parseASPRows(rows)).toEqual([
      deleted('20251201'),
      deleted('20251202'),
      deleted('20251203'),
      inEffect('20251204', '2025-12-04T05:00:00.000Z')
    ]);
  });

  // Known bug: isMetered only matches "meters are/will not be in effect", so this real holiday wording
  // (Christmas, New Year's Day, Memorial Day, ...) is stored as metered. Switch to it() once fixed.
  it.failing('stores "Alternate side parking and meters are suspended" days as unmetered', () => {
    const [christmas] = parseASPRows([
      {
        today_id: '20251225',
        items: [
          {
            type: 'Alternate Side Parking',
            exceptionName: 'Christmas Day 2025',
            details: 'Alternate side parking and meters are suspended for Christmas.',
            status: 'SUSPENDED'
          }
        ]
      }
    ] as ASPDay[]);

    expect(christmas?.feed?.metered).toBe(false);
  });
});

describe('ASPDataService.getASPData', () => {
  it('writes each parsed feed doc with a created stamp and deletes days without an ASP item', async () => {
    jest.mocked(axios.get).mockResolvedValue({ data: fixture });
    const batch = { set: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
    const db = { batch: () => batch, doc: (path: string) => ({ path }) } as unknown as Firestore;

    await new ASPDataService(db).getASPData('2025-10-24', '2025-11-12', 'api-key');

    expect(batch.set.mock.calls).toEqual(
      GOLDEN.filter(({ feed }) => feed).map(({ id, feed }) => [
        { path: `feed/${id}` },
        { ...feed, created: expect.any(Timestamp) }
      ])
    );
    expect(batch.delete.mock.calls).toEqual(GOLDEN.filter(({ feed }) => !feed).map(({ id }) => [{ path: `feed/${id}` }]));
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

describe('parseASPDate', () => {
  it.each(['20250309', '20251102', '20260308', '20261101'])('keeps DST change day %s on its NYC calendar day', id => {
    expect(nycDay(parseASPDate(id))).toBe(id);
  });
});
