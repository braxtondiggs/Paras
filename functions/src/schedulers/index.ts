import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';

import { getDb } from '../config/firebase';
import { createScheduleOptions, SCHEDULES } from '../config/constants';
import { ASPDataService } from '../services/asp-data.service';
import { NotificationService } from '../services/notification.service';
import { getNYCHour } from '../utils/date';
import { isNotificationHour } from '../utils/validation';

// Define secrets
const aspApiKey = defineSecret('ASP_API_KEY');

/**
 * Scheduled function to fetch ASP data every 4 hours
 */
export const getASPDataScheduled = onSchedule(
  {
    ...createScheduleOptions(SCHEDULES.ASP_DATA_SYNC),
    secrets: [aspApiKey]
  },
  async () => {
    const db = getDb();
    const aspDataService = new ASPDataService(db);
    await aspDataService.getASPData(undefined, undefined, aspApiKey.value());
  }
);

/**
 * Scheduled function to fetch monthly ASP data on the 1st of each month
 */
export const getASPMonthScheduled = onSchedule(
  {
    ...createScheduleOptions(SCHEDULES.ASP_MONTH_SYNC),
    secrets: [aspApiKey]
  },
  async () => {
    const db = getDb();
    const aspDataService = new ASPDataService(db);
    await aspDataService.getASPMonthData(aspApiKey.value());
  }
);

/**
 * Scheduled function to send custom notifications every 15 minutes
 */
export const getCustomNotificationsScheduled = onSchedule(
  createScheduleOptions(SCHEDULES.CUSTOM_NOTIFICATIONS),
  async () => {
    const db = getDb();
    const notificationService = new NotificationService(db);
    await notificationService.sendCustomNotifications();
  }
);

/**
 * Scheduled function to send today's notifications hourly 7:00-10:00 AM to users who picked that hour
 */
export const getNotificationsToday = onSchedule(
  createScheduleOptions(SCHEDULES.TODAY_NOTIFICATIONS),
  async (event) => {
    // The scheduled hour, not the clock, so a late start still matches the hour this run is for
    const hour = getNYCHour(event.scheduleTime);
    if (!isNotificationHour(hour)) {
      logger.info(`No today notifications for hour ${hour}`);
      return;
    }

    const db = getDb();
    const notificationService = new NotificationService(db);
    await notificationService.sendNotifications('today', hour);
  }
);

/**
 * Scheduled function to send tomorrow's notifications at 4:00 PM to users with any fixed hour
 * (interim until the nextDay evening hours are settled on #182)
 */
export const getNotificationsTomorrow = onSchedule(
  createScheduleOptions(SCHEDULES.TOMORROW_NOTIFICATIONS),
  async () => {
    const db = getDb();
    const notificationService = new NotificationService(db);
    await notificationService.sendNotifications('nextDay', 'any-hour');
  }
);