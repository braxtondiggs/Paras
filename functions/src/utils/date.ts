import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

import { NYC_TIMEZONE } from '../config/constants';
import { DateRange } from '../types';

// Initialize dayjs plugins
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/**
 * Get formatted date ID for ASP data (YYYYMMDD format)
 */
export function getFormattedDateID(action: 'today' | 'nextDay'): string {
  const daysToAdd = action === 'today' ? 0 : 1;
  return dayjs().add(daysToAdd, 'day').format('YYYYMMDD');
}

/**
 * Parse ASP date ID to a standardized date
 */
export function parseASPDate(dateId: string): Date {
  return dayjs(dateId, 'YYYYMMDD')
    .startOf('day')
    .add(5, 'hours') // EST/EDT offset
    .toDate();
}

/**
 * Generate date ranges for monthly ASP data fetching
 */
export function generateMonthlyDateRanges(): DateRange[] {
  return Array.from({ length: 7 }, (_, i) => {
    const start = dayjs()
      .add(i * 2, 'month')
      .startOf('month')
      .format('YYYY-MM-DD');

    const end = dayjs(start)
      .add(2, 'month')
      .subtract(1, 'day')
      .endOf('month')
      .format('YYYY-MM-DD');

    return { start, end };
  });
}

/**
 * Check if custom notification time is currently active
 */
export function isCustomNotificationActive(customTime: string): boolean {
  const notificationTime = dayjs.tz(
    `${dayjs().format('MM/DD/YYYY')} ${customTime}`,
    'MM/DD/YYYY HH:mm',
    NYC_TIMEZONE
  );

  const now = dayjs().tz(NYC_TIMEZONE);
  const windowEnd = now.add(15, 'minute');

  return notificationTime.isSameOrAfter(now) &&
         notificationTime.isSameOrBefore(windowEnd);
}

/**
 * Get current date in NYC timezone
 */
export function getNYCDate(): dayjs.Dayjs {
  return dayjs().tz(NYC_TIMEZONE);
}

/**
 * Format date for API requests
 */
export function formatDateForAPI(date?: string): string {
  return date ?? dayjs().format('YYYY-MM-DD');
}