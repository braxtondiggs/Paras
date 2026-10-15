import dayjs, { type Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import type { Feed } from '@core/services';
import type { Calendar } from '@shared/interfaces';

dayjs.extend(isSameOrBefore);

// Constants for better maintainability
export const CALENDAR_CONFIG = {
  INITIAL_SLIDE: 6,
  SLIDES_PER_VIEW: 7,
  SPACE_BETWEEN: 4,
  PRELOAD_DAYS_BEFORE: 6,
  PRELOAD_DAYS_AFTER: 6,
  LOAD_MORE_THRESHOLD: 3,
  ADD_DAYS_ON_SCROLL: 10,
  MAX_DATE_ITERATIONS: 365,
  SLIDE_ANIMATION_DURATION: 250,
  DEBOUNCE_DELAY: 16, // ~1 frame at 60fps
  DATA_LOAD_DELAY: 250
} as const;

/**
 * Receives errors the helpers swallow, so callers can log them
 */
export type CalendarErrorHandler = (message: string, error: unknown) => void;

const ignoreError: CalendarErrorHandler = () => undefined;

/**
 * Create a calendar item from a dayjs date
 */
export function createCalendarItem(date: Dayjs): Calendar {
  if (!date?.isValid?.()) {
    throw new Error('Invalid date provided to createCalendarItem');
  }

  return {
    text: date.format(),
    date: date.toDate(),
    month: {
      short: date.format('MMM'),
      long: date.format('MMMM')
    },
    day: {
      short: date.format('ddd'),
      long: date.format('dddd'),
      num: date.format('DD')
    }
  };
}

/**
 * Generate calendar dates between start and end dates (inclusive), defaulting to the initial preload range
 */
export function getDatesBetween(
  startDate?: Dayjs,
  endDate?: Dayjs,
  onError: CalendarErrorHandler = ignoreError,
  createItem: (date: Dayjs) => Calendar = createCalendarItem
): Calendar[] {
  try {
    let start = startDate ?? dayjs().subtract(CALENDAR_CONFIG.PRELOAD_DAYS_BEFORE, 'days');
    const end = endDate ?? dayjs().add(CALENDAR_CONFIG.PRELOAD_DAYS_AFTER, 'days');
    const dates: Calendar[] = [];

    // Safety check to prevent infinite loops
    let iterations = 0;

    while (start.isSameOrBefore(end) && iterations < CALENDAR_CONFIG.MAX_DATE_ITERATIONS) {
      dates.push(createItem(start));
      start = start.add(1, 'day');
      iterations++;
    }

    return dates;
  } catch (error) {
    onError('Failed to generate date range:', error);
    return [];
  }
}

/**
 * First and last dates of the loaded calendar items, or null when there are none
 */
export function getDateRange(items: Calendar[]): { start: Dayjs; end: Dayjs } | null {
  if (items.length === 0) return null;

  const start = items[0];
  const end = items[items.length - 1];
  return start && end
    ? {
        start: dayjs(start.date),
        end: dayjs(end.date)
      }
    : null;
}

/**
 * Get the feed item for a specific calendar date
 */
export function getSelectedItem(
  calendar: Calendar,
  feeds: Feed[],
  onError: CalendarErrorHandler = ignoreError
): Feed | undefined {
  if (!calendar?.date || !Array.isArray(feeds)) return undefined;

  try {
    return feeds.find(item => {
      if (!item?.date) return false;
      return dayjs(item.date.toDate()).isSame(calendar.date, 'day');
    });
  } catch (error) {
    onError('Failed to get selected item:', error);
    return undefined;
  }
}

/**
 * Check if a calendar date has a notice/alert
 */
export function hasNotice(
  calendar: Calendar,
  feeds: Feed[] | undefined,
  onError: CalendarErrorHandler = ignoreError
): boolean {
  if (!feeds || !calendar?.date) return false;

  try {
    const item = getSelectedItem(calendar, feeds, onError);
    return item ? !item.active : false;
  } catch (error) {
    onError('Failed to check notice status:', error);
    return false;
  }
}

/**
 * Accessible label for a day cell, including the parking suspension when there is one
 */
export function dayLabel(calendar: Calendar, hasNotice: boolean): string {
  const notice = hasNotice ? ', parking suspended' : '';
  return `Select ${calendar.day.long} ${calendar.day.num}${notice}`;
}

/**
 * Check if a calendar date is the active (selected) day
 */
export function isSelected(calendar: Calendar, active: Calendar | undefined): boolean {
  return active?.text === calendar.text;
}

/**
 * Check if a calendar date is today
 */
export function isToday(calendar: Calendar, onError: CalendarErrorHandler = ignoreError): boolean {
  if (!calendar?.date) return false;

  try {
    return dayjs(calendar.date).isSame(dayjs(), 'day');
  } catch (error) {
    onError('Failed to check if date is today:', error);
    return false;
  }
}
