import { getMessaging, Message, BatchResponse } from 'firebase-admin/messaging';
import { Firestore, QueryDocumentSnapshot, WriteResult } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { Feed, Notification } from './types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

async function sendToDevices(tokens: string[], body: string, snapshots: QueryDocumentSnapshot[]): Promise<void> {
  const messaging = getMessaging();
  const messages: Message[] = tokens.map(token => ({
    notification: {
      title: 'Alternate Side Parking',
      body
    },
    token
  }));

  try {
    const response: BatchResponse = await messaging.sendEach(messages);
    const deadTokens: Promise<WriteResult>[] = [];
    
    response.responses.forEach((result, index) => {
      if (!result.success && result.error) {
        const error = result.error;
        logger.error(`Failure sending notification to token ${tokens[index]}:`, error);
        
        // Handle invalid or unregistered tokens
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          logger.info(`Deleting invalid token: ${tokens[index]}`);
          if (snapshots[index]) {
            deadTokens.push(snapshots[index].ref.delete());
          }
        }
      }
    });

    // Await deletion of all invalid tokens
    if (deadTokens.length > 0) {
      await Promise.all(deadTokens);
      logger.info(`${deadTokens.length} invalid tokens were deleted.`);
    }

    logger.info(`Successfully sent ${response.successCount} notifications, ${response.failureCount} failed`);
  } catch (error) {
    logger.error('An error occurred while sending notifications:', error);
    throw error;
  }
}

// Function to process and send notifications
async function sendNotifications(db: Firestore, action: string, type: string): Promise<void> {
  const id = getFormattedDateID(action);
  const feedSnap = await db.collection('feed').doc(id).get();
  if (!feedSnap.exists) {
    logger.info(`No feed data found for ${action} (${id})`);
    return;
  }
  
  const { active, text } = feedSnap.data() as Feed;
  const notificationBody = action === 'today' ? text : text.replaceAll(/\./g, ' tomorrow.');
  const tokens: string[] = [];
  const snapshots: QueryDocumentSnapshot[] = [];
  
  const querySnapshot = await db.collection('notifications')
                                 .where(action, '==', type)
                                 .where('type', '==', 'NYC').get();
  
  querySnapshot.forEach(doc => {
    snapshots.push(doc);
    const data = doc.data();
    const { exceptionOnly, token } = data as Notification;
    const customType = data[`${action}Custom`];
    
    if (token && shouldNotify(exceptionOnly, active)) {
      if (type === 'custom') {
        const date = dayjs.tz(`${dayjs().format('MM/DD/YYYY')} ${customType}`, 'MM/DD/YYYY HH:mm', 'America/New_York');
        const today = dayjs().tz('America/New_York');
        const isCustomActive = date.isSameOrAfter(today) && date.isSameOrBefore(today.add(15, 'minute'));
        if (isCustomActive) {
            tokens.push(token);
        }
      } else {
        tokens.push(token);
      }
    }
  });

  if (tokens.length > 0) {
    const uniqueTokens = Array.from(new Set(tokens));
    logger.info(`Sending ${uniqueTokens.length} notifications for ${action} (${type})`);
    await sendToDevices(uniqueTokens, notificationBody, snapshots);
  } else {
    logger.info(`No notifications to send for ${action} (${type})`);
  }
}

// Function to check exceptions and active status
function shouldNotify(exceptionOnly: boolean, active: boolean): boolean {
  return !(exceptionOnly && active);
}

// Utility function to format date ID based on action
function getFormattedDateID(action: string): string {
  return dayjs().add(action === 'today' ? 0 : 1, 'day').format('YYYYMMDD');
}

// Exported functions with adjusted parameters to match usage
export async function getImmediateNotifications(db: Firestore, action: string): Promise<void> {
  logger.info(`Processing immediate notifications for ${action}`);
  await sendNotifications(db, action, 'immediately');
}

export async function getCustomNotifications(db: Firestore): Promise<void> {
  logger.info('Processing custom notifications');
  for (const action of ['today', 'nextDay']) {
    await sendNotifications(db, action, 'custom');
  }
}
