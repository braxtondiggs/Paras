import { ScheduleOptions } from 'firebase-functions/v2/scheduler';

// API Configuration
export const ASP_API_BASE_URL = 'https://api.nyc.gov/public/api/GetCalendar';

// Time zone configuration
export const NYC_TIMEZONE = 'America/New_York';

// Rate limiting
export const API_RATE_LIMIT_DELAY = 5000; // 5 seconds between requests

// Schedule configurations
export const SCHEDULES = {
  ASP_DATA_SYNC: 'every 4 hours',
  ASP_MONTH_SYNC: '30 19 1 * *', // Monthly at 7:30 PM on 1st day
  CUSTOM_NOTIFICATIONS: 'every 15 minutes',
  TODAY_NOTIFICATIONS: '30 7 * * *', // Daily at 7:30 AM
  TOMORROW_NOTIFICATIONS: '0 16 * * *', // Daily at 4:00 PM
} as const;

// Helper function to create schedule options
export const createScheduleOptions = (schedule: string): ScheduleOptions => ({
  schedule,
  timeZone: NYC_TIMEZONE,
});

// Notification constants
export const NOTIFICATION_TITLE = 'Alternate Side Parking';

// Collection names
export const COLLECTIONS = {
  FEED: 'feed',
  NOTIFICATIONS: 'notifications',
} as const;