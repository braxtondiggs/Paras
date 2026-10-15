import { Timestamp } from '@angular/fire/firestore';
import type { Feed } from '@core/services';
import type { Calendar } from '@shared/interfaces';
import dayjs from 'dayjs';
import {
  CALENDAR_CONFIG,
  createCalendarItem,
  dayLabel,
  getDateRange,
  getDatesBetween,
  getSelectedItem,
  hasNotice,
  isSelected,
  isToday
} from './calendar.utils';

describe('calendar.utils', () => {
  const day = dayjs('2026-03-10T12:00:00');

  const feedOn = (date: dayjs.Dayjs, active: boolean): Feed => ({
    id: `feed-${date.format('YYYY-MM-DD')}`,
    active,
    created: Timestamp.fromDate(date.toDate()),
    date: Timestamp.fromDate(date.toDate()),
    metered: false,
    reason: active ? 'Regular parking' : 'Holiday',
    text: active ? 'Alternate side parking in effect' : 'Alternate side parking suspended',
    type: 'NYC'
  });

  describe('createCalendarItem', () => {
    it('formats the date parts', () => {
      expect(createCalendarItem(day)).toEqual({
        text: day.format(),
        date: day.toDate(),
        month: { short: 'Mar', long: 'March' },
        day: { short: 'Tue', long: 'Tuesday', num: '10' }
      });
    });

    it('throws on an invalid date', () => {
      expect(() => createCalendarItem(dayjs('invalid date'))).toThrow('Invalid date');
    });
  });

  describe('getDatesBetween', () => {
    it('returns every day in the range, inclusive', () => {
      const dates = getDatesBetween(day, day.add(2, 'day'));

      expect(dates.map(d => d.day.num)).toEqual(['10', '11', '12']);
    });

    it('returns an empty array when start is after end', () => {
      expect(getDatesBetween(day.add(1, 'day'), day)).toEqual([]);
    });

    it('defaults to the preload range around today', () => {
      const dates = getDatesBetween();

      expect(dates).toHaveLength(CALENDAR_CONFIG.PRELOAD_DAYS_BEFORE + CALENDAR_CONFIG.PRELOAD_DAYS_AFTER + 1);
      expect(dayjs(dates[CALENDAR_CONFIG.INITIAL_SLIDE].date).isSame(dayjs(), 'day')).toBe(true);
    });

    it('stops at MAX_DATE_ITERATIONS', () => {
      const dates = getDatesBetween(day, day.add(5, 'year'));

      expect(dates).toHaveLength(CALENDAR_CONFIG.MAX_DATE_ITERATIONS);
    });

    it('reports the error and returns an empty array when item creation fails', () => {
      const onError = jest.fn();
      const error = new Error('creation failed');

      const dates = getDatesBetween(day, day.add(1, 'day'), onError, () => {
        throw error;
      });

      expect(dates).toEqual([]);
      expect(onError).toHaveBeenCalledWith('Failed to generate date range:', error);
    });
  });

  describe('getDateRange', () => {
    it('returns null for no items', () => {
      expect(getDateRange([])).toBeNull();
    });

    it('returns the first and last item dates', () => {
      const range = getDateRange(getDatesBetween(day, day.add(3, 'day')));

      expect(range?.start.isSame(day, 'day')).toBe(true);
      expect(range?.end.isSame(day.add(3, 'day'), 'day')).toBe(true);
    });
  });

  describe('getSelectedItem', () => {
    const calendar = createCalendarItem(day);

    it('returns the feed on the same day', () => {
      const match = feedOn(day.hour(8), true);

      expect(getSelectedItem(calendar, [feedOn(day.add(1, 'day'), true), match])).toBe(match);
    });

    it('returns undefined when no feed is on that day', () => {
      expect(getSelectedItem(calendar, [feedOn(day.subtract(1, 'day'), false)])).toBeUndefined();
    });

    it('reports the error and returns undefined when a feed date cannot be read', () => {
      const onError = jest.fn();
      const broken = {
        ...feedOn(day, false),
        date: {
          toDate: () => {
            throw new Error('bad date');
          }
        }
      } as unknown as Feed;

      expect(getSelectedItem(calendar, [broken], onError)).toBeUndefined();
      expect(onError).toHaveBeenCalledWith('Failed to get selected item:', expect.any(Error));
    });
  });

  describe('hasNotice', () => {
    const calendar = createCalendarItem(day);

    it('is true when the feed for that day is inactive (rules suspended)', () => {
      expect(hasNotice(calendar, [feedOn(day, false)])).toBe(true);
    });

    it('is false when the feed for that day is active', () => {
      expect(hasNotice(calendar, [feedOn(day, true)])).toBe(false);
    });

    it('is false when there is no feed for that day', () => {
      expect(hasNotice(calendar, [feedOn(day.add(1, 'day'), false)])).toBe(false);
      expect(hasNotice(calendar, [])).toBe(false);
      expect(hasNotice(calendar, undefined)).toBe(false);
    });

    it('is false for a calendar item without a date', () => {
      expect(hasNotice({ date: null } as unknown as Calendar, [feedOn(day, false)])).toBe(false);
    });
  });

  describe('dayLabel', () => {
    const calendar = createCalendarItem(day);

    it('labels a day without a notice', () => {
      expect(dayLabel(calendar, false)).toBe('Select Tuesday 10');
    });

    it('mentions the suspension when there is a notice', () => {
      expect(dayLabel(calendar, true)).toBe('Select Tuesday 10, parking suspended');
    });
  });

  describe('isSelected', () => {
    const calendar = createCalendarItem(day);

    it('is true for the active item', () => {
      expect(isSelected(calendar, createCalendarItem(day))).toBe(true);
    });

    it('is false for another day or no active item', () => {
      expect(isSelected(calendar, createCalendarItem(day.add(1, 'day')))).toBe(false);
      expect(isSelected(calendar, undefined)).toBe(false);
    });
  });

  describe('isToday', () => {
    it('is true for today', () => {
      expect(isToday(createCalendarItem(dayjs()))).toBe(true);
    });

    it('is false for another day', () => {
      expect(isToday(createCalendarItem(dayjs().subtract(1, 'day')))).toBe(false);
    });

    it('is false for a calendar item without a date', () => {
      expect(isToday({ date: null } as unknown as Calendar)).toBe(false);
    });
  });
});
