import { MessagingPayload, getMessaging } from 'firebase-admin/messaging';
import { Firestore, QueryDocumentSnapshot, WriteResult } from 'firebase-admin/firestore';
import { Feed, Notification } from './types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc'
import tz from 'dayjs/plugin/timezone'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const basePayload: MessagingPayload = {
  notification: {
    title: 'Alternate Side Parking'
  }
};

async function sendToDevices(tokens: string[], body: string, snapshots: QueryDocumentSnapshot[]) {
  const messaging = getMessaging();
  const payload = { ...basePayload, notification: { ...basePayload.notification, body } };
  const messages = tokens.map(token => ({ ...payload, token }));

  try {
    const response = await messaging.sendAll(messages);
    const deadTokens: Promise<WriteResult>[] = [];
    response.responses.forEach((result, index) => {
      if (!result.success) {
        const error = result.error;
        console.error(`Failure sending notification to token ${tokens[index]}:`, error);
        
        // Handle invalid or unregistered tokens
        if (error && error.code === 'messaging/invalid-registration-token' || 
            error && error.code === 'messaging/registration-token-not-registered') {
          console.log(`Deleting token: ${tokens[index]}`);
          deadTokens.push(snapshots[index].ref.delete());
        }
      }
    });

    // Await deletion of all invalid tokens
    if (deadTokens.length > 0) {
      await Promise.all(deadTokens);
      console.log(`${deadTokens.length} dead tokens were deleted.`);
    }
  } catch (error) {
    console.error("An error occurred while sending notifications:", error);
  }
}

// Function to process and send notifications
async function sendNotifications(db: Firestore, action: string, type: string) {
  const id = getFormattedDateID(action);
  const feedSnap = await db.collection('feed').doc(id).get();
  if (!feedSnap.exists) return;
  
  const { active, text } = feedSnap.data() as Feed;
  const notificationBody = action === 'today' ? text : text.replaceAll(/\./g, ' tomorrow.');
  const tokens: string[] = [];
  const promise: QueryDocumentSnapshot[] = [];
  const querySnapshot = await db.collection('notifications')
                                 .where(action, '==', type)
                                 .where('type', '==', 'NYC').get();
  
  querySnapshot.forEach(doc => {
    promise.push(doc);
    const data = doc.data();
    const { exceptionOnly, token } = data as Notification;
    const customType = data[`${action}Custom`];
    if (token && shouldNotify(exceptionOnly, active)) {
      if (type === 'custom') {
        const date = dayjs.tz(`${dayjs().format('MM/DD/YYYY')} ${customType}`, "America/New_York");
        const today = dayjs().tz("America/New_York");
        const isCustomActive = date.isSameOrAfter(today) && date.isSameOrBefore(today.add(15, 'minute'));
        if (isCustomActive) tokens.push(token);
      } else {
        tokens.push(token);
      }
    }
  });

  if (tokens.length > 0) {
    // const uniqueTokens = Array.from(new Set(tokens));
    await sendToDevices(tokens, notificationBody, promise);
  }
}

// Function to check exceptions and active status
function shouldNotify(exceptionOnly: boolean, active: boolean): boolean {
  return exceptionOnly && active ? false: true;
}

// Utility function to format date ID based on action
function getFormattedDateID(action: string): string {
  return dayjs().add(action === 'today' ? 0 : 1, 'day').format('YYYYMMDD');
}

// Exported functions with adjusted parameters to match usage
async function getImmediateNotifications(db: Firestore, action: string) {
  await sendNotifications(db, action, 'immediately');
}

async function getCustomNotifications(db: Firestore) {
  for (const action of ['today', 'nextDay']) {
    await sendNotifications(db, action, 'custom');
  }
}

export { getImmediateNotifications, getCustomNotifications}
