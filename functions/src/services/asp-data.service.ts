import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import axios from 'axios';

import { IASPResponse, Status, ASPError } from '../types';
import { ASP_API_BASE_URL, API_RATE_LIMIT_DELAY, COLLECTIONS } from '../config/constants';
import { isValidASPItem, validateAPIKey } from '../utils/validation';
import { isMetered, extractReason } from '../utils/text';
import { parseASPDate, formatDateForAPI, generateMonthlyDateRanges } from '../utils/date';

/**
 * Service for managing ASP (Alternate Side Parking) data operations
 */
export class ASPDataService {
  constructor(private db: Firestore) {}

  /**
   * Fetch ASP data from NYC API
   */
  private async fetchASPData(fromDate: string, toDate: string, apiKey: string): Promise<IASPResponse> {
    const url = `${ASP_API_BASE_URL}?fromdate=${fromDate}&todate=${toDate}`;
    const headers = {
      'Cache-Control': 'no-cache',
      'Ocp-Apim-Subscription-Key': apiKey
    };

    try {
      const { data } = await axios.get<IASPResponse>(url, { headers });
      return data;
    } catch (error) {
      const aspError: ASPError = error as ASPError;
      logger.error('Failed to fetch ASP data', {
        url,
        error: aspError.message,
        statusCode: aspError.statusCode
      });
      throw aspError;
    }
  }

  /**
   * Process ASP data and save to Firestore
   */
  private processASPData(data: IASPResponse, batch: FirebaseFirestore.WriteBatch): void {
    data.days.forEach(({ today_id, items }) => {
      const feedRef = this.db.doc(`${COLLECTIONS.FEED}/${today_id}`);
      const validItem = items.find(item => isValidASPItem(item));

      if (!validItem) {
        batch.delete(feedRef);
        return;
      }

      const { exceptionName, details, status } = validItem;
      const feedData = {
        active: status === Status.Active,
        created: Timestamp.now(),
        date: parseASPDate(today_id),
        id: today_id,
        metered: isMetered(details),
        reason: exceptionName || extractReason(details),
        text: details,
        type: 'NYC'
      };

      batch.set(feedRef, feedData);
    });
  }

  /**
   * Get ASP data for a specific date range
   */
  async getASPData(from?: string, to?: string, apiKey?: string): Promise<void> {
    if (!validateAPIKey(apiKey)) {
      logger.error('Missing or invalid API key for ASP data fetching');
      throw new Error('API key is required');
    }

    const fromDate = formatDateForAPI(from);
    const toDate = formatDateForAPI(to);

    logger.info('Fetching ASP data', { fromDate, toDate });

    try {
      const data = await this.fetchASPData(fromDate, toDate, apiKey!);
      const batch = this.db.batch();

      this.processASPData(data, batch);

      await batch.commit();
      logger.info('Successfully processed ASP data', { fromDate, toDate });
    } catch (error) {
      logger.error('Error processing ASP data', error);
      throw error;
    }
  }

  /**
   * Get ASP data for multiple months (used for bulk data loading)
   */
  async getASPMonthData(apiKey: string): Promise<void> {
    if (!validateAPIKey(apiKey)) {
      throw new Error('API key is required for monthly data fetch');
    }

    logger.info('Starting ASP monthly data fetch');

    const dateRanges = generateMonthlyDateRanges();

    for (const { start, end } of dateRanges) {
      // Rate limiting: wait between requests
      await new Promise(resolve => setTimeout(resolve, API_RATE_LIMIT_DELAY));

      try {
        await this.getASPData(start, end, apiKey);
      } catch (error) {
        logger.error('Failed to fetch data for range', { start, end, error });
        // Continue with other ranges even if one fails
      }
    }

    logger.info('Completed ASP monthly data fetch');
  }
}