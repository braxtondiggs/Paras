import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onSchedule, ScheduleOptions } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

import axios from 'axios';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import { getImmediateNotifications, getCustomNotifications } from './fcm';
import { IASPResponse, Status } from './types';

// Extend dayjs with plugins
dayjs.extend(customParseFormat);

// Define secret for API key
const aspApiKey = defineSecret('ASP_API_KEY');

// Initialize Firebase
initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

async function fetchASPData(fromDate: string, toDate: string, apiKey: string): Promise<IASPResponse> {
    const url = `https://api.nyc.gov/public/api/GetCalendar?fromdate=${fromDate}&todate=${toDate}`;
    const headers = { 'Cache-Control': 'no-cache', 'Ocp-Apim-Subscription-Key': apiKey };
    try {
        const { data } = await axios.get<IASPResponse>(url, { headers });
        return data;
    } catch (err) {
        logger.error('Failed to fetch ASP data', err);
        throw err; // Rethrow to handle it in the calling function
    }
}

async function getASPData(from?: string, to?: string, apiKey?: string): Promise<void> {
	const fromDate = from ?? dayjs().format('YYYY-MM-DD');
	const toDate = to ?? dayjs().add(1, 'day').format('YYYY-MM-DD');
	logger.info('Fetching ASP data', { fromDate, toDate });

	if (!apiKey) {
		logger.error('Missing API key for ASP data fetching.');
		return;
	}

	try {
		const data = await fetchASPData(fromDate, toDate, apiKey);
		const batch = db.batch();
		processASPData(data, batch);
		await batch.commit();
		logger.info('Successfully processed ASP data', { fromDate, toDate });
	} catch (err) {
		logger.error('Error processing ASP data:', err);
		throw err;
	}
}

function processASPData(data: IASPResponse, batch: FirebaseFirestore.WriteBatch): void {
	data.days.forEach(({ today_id, items }) => {
        const feedRef = db.doc(`feed/${today_id}`);
        const item = items.find(i => isValidItem(i));
        if (!item) {
            batch.delete(feedRef);
            return;
        }

        const { exceptionName, details, status } = item;
        batch.set(feedRef, {
            active: status === Status.Active,
            created: Timestamp.now(),
            date: dayjs(today_id, 'YYYYMMDD').startOf('day').add(5, 'hours').toDate(),
            id: today_id,
            metered: isMetered(details),
            reason: exceptionName || getReason(details),
            text: details,
            type: 'NYC'
        });
    });
}

interface ASPItem {
    type: string;
    exceptionName?: string;
    details: string;
}

function isValidItem(item: ASPItem): boolean {
    return item.type === 'Alternate Side Parking' && 
           item.exceptionName !== 'Information Not Available' && 
           !item.details.includes('Sundays');
}

const getASPMonth = async (apiKey: string): Promise<void> => {
	logger.info('Starting ASP month data fetch');
	const dates = Array.from({ length: 7 }, (_, i) => {
		const start = dayjs().add(i * 2, 'month').startOf('month').format('YYYY-MM-DD');
		const end = dayjs(start).add(2, 'month').subtract(1, 'day').endOf('month').format('YYYY-MM-DD');
		return { start, end };
	});
	
	for (const { start, end } of dates) {
		await new Promise(resolve => setTimeout(resolve, 5000)); // Rate limiting: wait 5 seconds between requests
		await getASPData(start, end, apiKey);
	}
	
	logger.info('Completed ASP month data fetch');
};

function isMetered(text: string): boolean {
	const neg = text.indexOf('meters are not in effect') !== -1 || text.indexOf('meters will not be in effect') !== -1;
	const pos = text.indexOf('meters will remain in effect') !== -1 || text.indexOf('meters are in effect') !== -1;
	return neg || pos ? pos : true;
}

function getReason(text: string): string | undefined {
	let keyword: string | undefined;
	if (text.includes('to ')) {
        keyword = 'to ';
    }
	if (text.includes('for ')) {
        keyword = 'for ';
    }
	if (text.includes('on ')) {
        keyword = 'on ';
    }
	if (typeof keyword === 'undefined') {
        return undefined;
    }
  
	const output = text.split(keyword).pop()?.split('.');
	if (!output || !output[0]) {
        return undefined;
    }
	return upperFirst(output[0]);
}

const upperFirst = (text: string): string => {
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

// Helper function to create schedule options
const createScheduleOptions = (schedule: string): ScheduleOptions => ({ 
    schedule, 
    timeZone: 'America/New_York' 
});

// 2nd gen Cloud Functions with proper secret handling
export const getASPDataScheduled = onSchedule(
    { 
        ...createScheduleOptions('every 4 hours'),
        secrets: [aspApiKey]
    }, 
    async () => {
        await getASPData(undefined, undefined, aspApiKey.value());
    }
);

export const getASPMonthScheduled = onSchedule(
    { 
        ...createScheduleOptions('30 19 1 * *'),
        secrets: [aspApiKey]
    }, 
    async () => {
        await getASPMonth(aspApiKey.value());
    }
);

export const getCustomNotificationsScheduled = onSchedule(
    createScheduleOptions('every 15 minutes'), 
    async () => {
        await getCustomNotifications(db);
    }
);

export const getNotificationsToday = onSchedule(
    createScheduleOptions('30 7 * * *'), 
    async () => {
        await getImmediateNotifications(db, 'today');
    }
);

export const getNotificationsTomorrow = onSchedule(
    createScheduleOptions('0 16 * * *'), 
    async () => {
        await getImmediateNotifications(db, 'nextDay');
    }
);
