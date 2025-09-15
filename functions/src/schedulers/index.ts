import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

import { getDb } from '../config/firebase';
import { createScheduleOptions, SCHEDULES } from '../config/constants';
import { ASPDataService } from '../services/asp-data.service';
import { NotificationService } from '../services/notification.service';

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
 * Scheduled function to send today's notifications at 7:30 AM
 */
export const getNotificationsToday = onSchedule(
  createScheduleOptions(SCHEDULES.TODAY_NOTIFICATIONS),
  async () => {
    const db = getDb();
    const notificationService = new NotificationService(db);
    await notificationService.sendImmediateNotifications('today');
  }
);

/**
 * Scheduled function to send tomorrow's notifications at 4:00 PM
 */
export const getNotificationsTomorrow = onSchedule(
  createScheduleOptions(SCHEDULES.TOMORROW_NOTIFICATIONS),
  async () => {
    const db = getDb();
    const notificationService = new NotificationService(db);
    await notificationService.sendImmediateNotifications('nextDay');
  }
);