import { Firestore, QueryDocumentSnapshot, WriteResult } from 'firebase-admin/firestore';
import {
  BatchResponse,
  FirebaseMessagingError,
  getMessaging,
  SendResponse
} from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';

import { COLLECTIONS, NOTIFICATION_TITLE } from '../config/constants';
import { Feed, Notification, NotificationAction, NotificationType } from '../types';
import { getFormattedDateID, isCustomNotificationActive } from '../utils/date';
import { createParkingNotification, sanitizeNotificationText, validateNotificationPayload } from '../utils/notification';
import { processNotificationBody } from '../utils/text';
import { isValidNotificationToken, shouldSendNotification } from '../utils/validation';

/**
 * Extended Firebase Messaging Error that may include pending batch responses
 */
interface ExtendedFirebaseMessagingError extends FirebaseMessagingError {
  pendingBatchResponse?: Promise<BatchResponse>;
}

/**
 * Type guard to check if error has pending batch response
 */
function hasPendingBatchResponse(error: FirebaseMessagingError): error is ExtendedFirebaseMessagingError {
  return 'pendingBatchResponse' in error;
}

/**
 * Service for managing push notifications via Firebase Cloud Messaging
 */
export class NotificationService {
  private messaging = getMessaging();

  constructor(private db: Firestore) {}

  /**
   * Send notifications to multiple devices using Firebase Admin SDK best practices
   */
  private async sendToDevices(
    tokens: string[],
    body: string,
    snapshots: QueryDocumentSnapshot[]
  ): Promise<void> {
    if (tokens.length === 0) {
      logger.info('No tokens to send notifications to');
      return;
    }

    // Sanitize and validate notification content
    const sanitizedTitle = sanitizeNotificationText(NOTIFICATION_TITLE);
    const sanitizedBody = sanitizeNotificationText(body);

    if (!validateNotificationPayload(sanitizedTitle, sanitizedBody)) {
      logger.error('Notification payload validation failed', {
        titleLength: sanitizedTitle.length,
        bodyLength: sanitizedBody.length
      });
      throw new Error('Notification payload exceeds size limits');
    }

    // Create optimized multicast message using utility function
    const multicastMessage = createParkingNotification(
      tokens,
      sanitizedTitle,
      sanitizedBody,
      {
        timestamp: new Date().toISOString(),
        type: 'parking_alert'
      }
    );

    try {
      const response: BatchResponse = await this.messaging.sendEachForMulticast(multicastMessage);
      await this.handleBatchResponse(response, tokens, snapshots);
    } catch (error) {
      await this.handleMessagingError(error as FirebaseMessagingError, tokens, snapshots);
    }
  }

  /**
   * Handle batch response and clean up invalid tokens
   */
  private async handleBatchResponse(
    response: BatchResponse,
    tokens: string[],
    snapshots: QueryDocumentSnapshot[]
  ): Promise<void> {
    const invalidTokenDeletions: Promise<WriteResult>[] = [];
    const retryableErrors: string[] = [];

    response.responses.forEach((result: SendResponse, index: number) => {
      if (!result.success && result.error) {
        const errorCode = result.error.code;
        const token = tokens[index];

        logger.error(`Failed to send notification to token ${token}:`, {
          code: errorCode,
          message: result.error.message
        });

        // Handle different error types according to Firebase best practices
        if (this.isInvalidToken(errorCode)) {
          logger.info(`Marking invalid token for deletion: ${token}`);
          if (snapshots[index]) {
            invalidTokenDeletions.push(snapshots[index].ref.delete());
          }
        } else if (this.isRetryableError(errorCode)) {
          retryableErrors.push(token);
        }
      }
    });

    // Clean up invalid tokens
    if (invalidTokenDeletions.length > 0) {
      await Promise.all(invalidTokenDeletions);
      logger.info(`${invalidTokenDeletions.length} invalid tokens were deleted`);
    }

    // Log retry candidates for monitoring
    if (retryableErrors.length > 0) {
      logger.warn(`${retryableErrors.length} notifications failed with retryable errors`, {
        retryableTokens: retryableErrors.length
      });
    }

    logger.info(`Notification batch completed`, {
      successful: response.successCount,
      failed: response.failureCount,
      invalidTokens: invalidTokenDeletions.length,
      retryable: retryableErrors.length
    });
  }

  /**
   * Handle messaging session errors
   */
  private async handleMessagingError(
    error: FirebaseMessagingError,
    tokens: string[],
    snapshots: QueryDocumentSnapshot[]
  ): Promise<void> {
    logger.error('Firebase Messaging error occurred:', {
      code: error.code,
      message: error.message,
      tokenCount: tokens.length
    });

    // Check if it's a session error with pending responses
    if (hasPendingBatchResponse(error)) {
      logger.info('Processing pending batch response from session error');
      try {
        const pendingResponse = await error.pendingBatchResponse;
        if (pendingResponse) {
          await this.handleBatchResponse(pendingResponse, tokens, snapshots);
        }
      } catch (pendingError) {
        logger.error('Failed to process pending batch response:', pendingError);
      }
    }

    throw error;
  }

  /**
   * Check if error code indicates an invalid token that should be deleted
   */
  private isInvalidToken(errorCode: string): boolean {
    return errorCode === 'messaging/invalid-registration-token' ||
           errorCode === 'messaging/registration-token-not-registered';
  }

  /**
   * Check if error is retryable according to Firebase best practices
   */
  private isRetryableError(errorCode: string): boolean {
    const retryableErrors = [
      'messaging/internal-error',
      'messaging/server-unavailable',
      'messaging/message-rate-exceeded',
      'messaging/device-message-rate-exceeded',
      'messaging/topics-message-rate-exceeded'
    ];
    return retryableErrors.includes(errorCode);
  }

  /**
   * Get users who should receive notifications for a specific action and type
   */
  private async getNotificationRecipients(
    action: NotificationAction,
    type: NotificationType
  ): Promise<{ tokens: string[]; snapshots: QueryDocumentSnapshot[] }> {
    const tokens: string[] = [];
    const snapshots: QueryDocumentSnapshot[] = [];

    const querySnapshot = await this.db
      .collection(COLLECTIONS.NOTIFICATIONS)
      .where(action, '==', type)
      .where('type', '==', 'NYC')
      .get();

    querySnapshot.forEach(doc => {
      snapshots.push(doc);
      const data = doc.data() as Notification;
      const { token } = data;
      const customType = data[`${action}Custom`];

      if (!isValidNotificationToken(token)) {
        return;
      }

      // For custom notifications, check if it's time to send
      if (type === 'custom') {
        if (customType && isCustomNotificationActive(customType)) {
          tokens.push(token);
        }
      } else {
        tokens.push(token);
      }
    });

    return { tokens: Array.from(new Set(tokens)), snapshots };
  }

  /**
   * Process and send notifications for a specific action and type
   */
  async sendNotifications(action: NotificationAction, type: NotificationType): Promise<void> {
    const dateId = getFormattedDateID(action);

    // Get feed data for the target date
    const feedSnapshot = await this.db.collection(COLLECTIONS.FEED).doc(dateId).get();

    if (!feedSnapshot.exists) {
      logger.info(`No feed data found for ${action} (${dateId})`);
      return;
    }

    const feedData = feedSnapshot.data() as Feed;
    const { active, text } = feedData;

    // Get notification recipients
    const { tokens, snapshots } = await this.getNotificationRecipients(action, type);

    if (tokens.length === 0) {
      logger.info(`No recipients found for ${action} (${type})`);
      return;
    }

    // Filter tokens based on user preferences
    const filteredData = this.filterByUserPreferences(tokens, snapshots, active);

    if (filteredData.tokens.length === 0) {
      logger.info(`No notifications to send for ${action} (${type}) after filtering`);
      return;
    }

    // Process notification body
    const notificationBody = processNotificationBody(text, action);

    logger.info(`Sending ${filteredData.tokens.length} notifications for ${action} (${type})`);

    await this.sendToDevices(filteredData.tokens, notificationBody, filteredData.snapshots);
  }

  /**
   * Filter tokens based on user notification preferences
   */
  private filterByUserPreferences(
    tokens: string[],
    snapshots: QueryDocumentSnapshot[],
    isRuleActive: boolean
  ): { tokens: string[]; snapshots: QueryDocumentSnapshot[] } {
    const filteredTokens: string[] = [];
    const filteredSnapshots: QueryDocumentSnapshot[] = [];

    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data() as Notification;
      const { exceptionOnly } = data;

      if (shouldSendNotification(exceptionOnly, isRuleActive)) {
        const token = tokens[index];
        if (typeof token === 'string') {
          filteredTokens.push(token);
          filteredSnapshots.push(snapshot);
        }
      }
    });

    return { tokens: filteredTokens, snapshots: filteredSnapshots };
  }

  /**
   * Send immediate notifications (today/tomorrow)
   */
  async sendImmediateNotifications(action: NotificationAction): Promise<void> {
    logger.info(`Processing immediate notifications for ${action}`);
    await this.sendNotifications(action, 'immediately');
  }

  /**
   * Send custom-timed notifications
   */
  async sendCustomNotifications(): Promise<void> {
    logger.info('Processing custom notifications');

    for (const action of ['today', 'nextDay'] as NotificationAction[]) {
      await this.sendNotifications(action, 'custom');
    }
  }
}