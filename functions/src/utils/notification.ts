/**
 * Notification utility functions following Firebase best practices
 */

import { MulticastMessage } from 'firebase-admin/messaging';
import { NOTIFICATION_TITLE } from '../config/constants';

/**
 * Create a properly configured multicast message for parking notifications
 */
export function createParkingNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): MulticastMessage {
  return {
    notification: {
      title,
      body
    },
    tokens,
    data,
    // FCM options for analytics and tracking
    fcmOptions: {
      analyticsLabel: 'asp_parking_notification'
    },
    // Android-specific configuration
    android: {
      priority: 'high',
      // Time to live: 1 hour for parking notifications
      ttl: 3600000,
      notification: {
        channelId: 'parking_alerts',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
        // Sticky for important parking alerts
        sticky: true,
        // Use notification tag to replace previous parking notifications
        tag: 'parking_alert'
      }
    },
    // iOS-specific configuration
    apns: {
      payload: {
        aps: {
          alert: {
            title,
            body
          },
          sound: 'default',
          badge: 1,
          // Content available for background processing
          contentAvailable: true
        }
      },
      headers: {
        // High priority for time-sensitive parking alerts
        'apns-priority': '10',
        // Expiration: 1 hour
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600)
      }
    },
    // Web push configuration
    webpush: {
      notification: {
        title,
        body,
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        requireInteraction: true,
        tag: 'parking_alert',
        // Actions for web notifications
        actions: [
          {
            action: 'view',
            title: 'View Details'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      },
      headers: {
        'Urgency': 'high'
      }
    }
  };
}

/**
 * Get notification channel configuration for Android
 */
export function getAndroidNotificationChannel() {
  return {
    channelId: 'parking_alerts',
    name: 'Parking Alerts',
    description: 'Notifications for alternate side parking rules',
    importance: 'high',
    enableSound: true,
    enableVibration: true,
    enableLights: true,
    lightColor: '#FF5722', // Material Design orange
    lockscreenVisibility: 'public'
  };
}

/**
 * Validate notification payload size
 */
export function validateNotificationPayload(
  title: string,
  body: string,
  data?: Record<string, string>
): boolean {
  // FCM limits: 4KB total payload, 1KB for notification
  const notificationSize = new TextEncoder().encode(
    JSON.stringify({ title, body })
  ).length;

  const dataSize = data
    ? new TextEncoder().encode(JSON.stringify(data)).length
    : 0;

  const totalSize = notificationSize + dataSize;

  // Conservative limits to avoid issues
  return notificationSize <= 1000 && totalSize <= 3000;
}

/**
 * Sanitize notification text for different platforms
 */
export function sanitizeNotificationText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Truncate if too long (conservative limit)
    .substring(0, 240)
    // Ensure it ends properly
    .replace(/[^\w\s.,!?]$/, '');
}