import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { BatchResponse } from 'firebase-admin/messaging';

import { NotificationService } from '../services/notification.service';
import { Notification } from '../types';

const sendEachForMulticast = jest.fn();

jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({ sendEachForMulticast }) }));
jest.mock('firebase-functions/v2', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// 2026-10-19 09:00 in New York (EDT)
const NOW = new Date('2026-10-19T13:00:00Z');

const user = (id: string, settings: Partial<Notification>) => ({
  id,
  data: () => ({ exceptionOnly: false, nextDay: 'none', today: 'none', token: `token-${id}`, type: 'NYC', ...settings }),
  ref: { update: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) }
});

type User = ReturnType<typeof user>;

function mockDb(users: User[]) {
  const where = jest.fn();
  const query = { where, get: jest.fn().mockResolvedValue({ forEach: (fn: (doc: User) => void) => users.forEach(fn) }) };
  where.mockReturnValue(query);

  const collection = jest.fn((name: string) =>
    name === 'feed'
      ? { doc: () => ({ get: async () => ({ exists: true, data: () => ({ active: true, text: 'Rules are in effect.' }) }) }) }
      : query
  );

  return { db: { collection } as unknown as Firestore, collection, where };
}

const sentTokens = () => sendEachForMulticast.mock.calls.flatMap(([message]) => message.tokens);

const ok = (count: number): BatchResponse => ({
  responses: Array.from({ length: count }, () => ({ success: true })),
  successCount: count,
  failureCount: 0
});

describe('NotificationService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    sendEachForMulticast.mockReset().mockImplementation(async ({ tokens }) => ok(tokens.length));
  });

  afterEach(() => jest.useRealTimers());

  it('queries users with the hour value and type NYC', async () => {
    const { db, collection, where } = mockDb([user('a', { today: '9:00' })]);

    await new NotificationService(db).sendNotifications('today', '9:00');

    expect(collection).toHaveBeenCalledWith('users');
    expect(collection).not.toHaveBeenCalledWith('notifications');
    expect(where).toHaveBeenCalledWith('today', '==', '9:00');
    expect(where).toHaveBeenCalledWith('type', '==', 'NYC');
    expect(sentTokens()).toEqual(['token-a']);
  });

  it('nextDay run matches any fixed hour', async () => {
    const { db, where } = mockDb([user('a', { nextDay: '7:00' }), user('b', { nextDay: '10:00' })]);

    await new NotificationService(db).sendNotifications('nextDay', 'any-hour');

    expect(where).toHaveBeenCalledWith('nextDay', 'in', ['7:00', '8:00', '9:00', '10:00']);
    expect(where).toHaveBeenCalledWith('type', '==', 'NYC');
    expect(sentTokens()).toEqual(['token-a', 'token-b']);
  });

  it('sends to custom users only when isCustomNotificationActive', async () => {
    const { db, where } = mockDb([
      user('due', { today: 'custom', todayCustom: '09:10' }),
      user('later', { today: 'custom', todayCustom: '11:00' }),
      user('earlier', { today: 'custom', todayCustom: '08:50' })
    ]);

    await new NotificationService(db).sendNotifications('today', 'custom');

    expect(where).toHaveBeenCalledWith('today', '==', 'custom');
    expect(sentTokens()).toEqual(['token-due']);
  });

  it('skips users without a token', async () => {
    const { db } = mockDb([user('a', { today: '9:00', token: '' })]);

    await new NotificationService(db).sendNotifications('today', '9:00');

    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('clears token on invalid-token error instead of deleting the document', async () => {
    // skipped is not due, so the failed index 1 must map to stale, not valid
    const skipped = user('skipped', { today: 'custom', todayCustom: '11:00' });
    const valid = user('valid', { today: 'custom', todayCustom: '09:05' });
    const stale = user('stale', { today: 'custom', todayCustom: '09:05' });
    const { db } = mockDb([skipped, valid, stale]);
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'gone' } }
      ],
      successCount: 1,
      failureCount: 1
    });

    await new NotificationService(db).sendNotifications('today', 'custom');

    expect(sentTokens()).toEqual(['token-valid', 'token-stale']);
    expect(stale.ref.update).toHaveBeenCalledWith({ token: FieldValue.delete() });
    expect(stale.ref.delete).not.toHaveBeenCalled();
    expect(skipped.ref.update).not.toHaveBeenCalled();
    expect(valid.ref.update).not.toHaveBeenCalled();
  });
});
