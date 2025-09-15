/**
 * Utility functions for text processing and parsing
 */

/**
 * Capitalize the first letter of a string
 */
export function upperFirst(text: string): string {
  if (!text) {
    return '';
  }
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/**
 * Determine if meters are in effect based on rule text
 */
export function isMetered(text: string): boolean {
  const negativeIndicators = [
    'meters are not in effect',
    'meters will not be in effect'
  ];

  const positiveIndicators = [
    'meters will remain in effect',
    'meters are in effect'
  ];

  const hasNegative = negativeIndicators.some(indicator =>
    text.toLowerCase().includes(indicator)
  );

  const hasPositive = positiveIndicators.some(indicator =>
    text.toLowerCase().includes(indicator)
  );

  // If both or neither are found, default to metered
  if (hasNegative || hasPositive) {
    return hasPositive;
  }

  return true; // Default to metered
}

/**
 * Extract reason from ASP rule text
 */
export function extractReason(text: string): string | undefined {
  const keywords = ['to ', 'for ', 'on '];

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      const parts = text.split(keyword);
      if (parts.length > 1) {
        const reasonPart = parts.pop();
        if (reasonPart) {
          const sentences = reasonPart.split('.');
          if (sentences[0]) {
            return upperFirst(sentences[0].trim());
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Process notification body text for different time contexts
 */
export function processNotificationBody(text: string, action: 'today' | 'nextDay'): string {
  if (action === 'nextDay') {
    return text.replaceAll(/\./g, ' tomorrow.');
  }
  return text;
}