import { ScheduledEvent } from 'firebase-functions/v2/scheduler';

import { getNotificationsToday, getNotificationsTomorrow } from '../schedulers';
import { NotificationService } from '../services/notification.service';

jest.mock('../config/firebase', () => ({ getDb: () => ({}) }));
jest.mock('../services/notification.service');
jest.mock('firebase-functions/v2', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const sendNotifications = jest.mocked(NotificationService.prototype.sendNotifications);

const event = (scheduleTime: string): ScheduledEvent => ({ scheduleTime });

describe('getNotificationsToday', () => {
  beforeEach(() => sendNotifications.mockClear());

  afterEach(() => jest.useRealTimers());

  it.each([
    ['2026-10-19T11:00:00Z', '7:00'], // EDT
    ['2026-10-19T14:00:00Z', '10:00'],
    ['2026-12-01T14:00:00Z', '9:00'] // EST
  ])('sends today at %s to users with %s', async (scheduleTime, hour) => {
    jest.useFakeTimers({ now: new Date(scheduleTime) });

    await getNotificationsToday.run(event(scheduleTime));

    expect(sendNotifications).toHaveBeenCalledWith('today', hour);
  });

  it('uses the scheduled hour when the run starts late', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-19T12:00:30Z') });

    await getNotificationsToday.run(event('2026-10-19T11:00:00Z'));

    expect(sendNotifications).toHaveBeenCalledWith('today', '7:00');
  });

  it('sends nothing outside the notification hours', async () => {
    await getNotificationsToday.run(event('2026-10-19T17:00:00Z'));

    expect(sendNotifications).not.toHaveBeenCalled();
  });
});

describe('getNotificationsTomorrow', () => {
  it('sends nextDay to users with any fixed hour', async () => {
    await getNotificationsTomorrow.run(event('2026-10-19T20:00:00Z'));

    expect(sendNotifications).toHaveBeenCalledWith('nextDay', 'any-hour');
  });
});
