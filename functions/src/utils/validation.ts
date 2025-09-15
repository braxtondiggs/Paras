import { ASPItem } from '../types';

/**
 * Validation utilities for ASP data processing
 */

/**
 * Check if an ASP item is valid for processing
 */
export function isValidASPItem(item: ASPItem): boolean {
  return (
    item.type === 'Alternate Side Parking' &&
    item.exceptionName !== 'Information Not Available' &&
    !item.details.includes('Sundays')
  );
}

/**
 * Validate API key presence
 */
export function validateAPIKey(apiKey?: string): boolean {
  return Boolean(apiKey && apiKey.trim().length > 0);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date) && !isNaN(Date.parse(date));
}

/**
 * Validate notification token format
 */
export function isValidNotificationToken(token: string): boolean {
  return Boolean(token && token.trim().length > 0);
}

/**
 * Check if notification should be sent based on user preferences
 */
export function shouldSendNotification(
  exceptionOnly: boolean,
  isRuleActive: boolean
): boolean {
  // If user wants exceptions only, don't notify when rules are active
  return !(exceptionOnly && isRuleActive);
}