import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getRemoteConfig } from 'firebase-admin/remote-config';
import { log, error } from 'firebase-functions/logger';
import { onSchedule, ScheduleOptions } from 'firebase-functions/v2/scheduler';

import axios from 'axios';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat)

import { getImmediateNotifications, getCustomNotifications } from './fcm';
import { IASPResponse, Status } from './types';

const app = initializeApp();
const db = getFirestore();
const config = getRemoteConfig();
db.settings({ ignoreUndefinedProperties: true });

async function fetchASPData(fromDate: string, toDate: string, apiKey: string): Promise<IASPResponse> {
    const url = `https://api.nyc.gov/public/api/GetCalendar?fromdate=${fromDate}&todate=${toDate}`;
    const headers = { 'Cache-Control': 'no-cache', 'Ocp-Apim-Subscription-Key': apiKey };
    try {
        const { data } = await axios.get<IASPResponse>(url, { headers });
        return data;
    } catch (err) {
        error('Failed to fetch ASP data', err);
        throw err; // Rethrow to handle it in the calling function
    }
}

async function getASPData(from?: string, to?: string) {
	const fromDate = from ?? dayjs().format('YYYY-MM-DD');
	const toDate = to ?? dayjs().add(1, 'day').format('YYYY-MM-DD');
	log('Fetching ASP data', fromDate, toDate);

	const { parameters } = await config.getTemplate();
	const APIKEY = (parameters.ASPKEY.defaultValue as any).value;
	if (!APIKEY){
		error('Missing API key for ASP data fetching.');
		return;
	}

	try {
		const data = await fetchASPData(fromDate, toDate, APIKEY);
		const batch = db.batch();
		processASPData(data, batch);
		await batch.commit();
	} catch (err) {
		error('Error processing ASP data:', err);
	}
}

function processASPData(data: IASPResponse, batch: FirebaseFirestore.WriteBatch) {
	data.days.forEach(({ today_id, items }) => {
        const feedRef = db.doc(`feed/${today_id}`);
        const item = items.find(i => isValidItem(i));
        if (!item) return batch.delete(feedRef);

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

function isValidItem(item: any) {
    return item.type === 'Alternate Side Parking' && item.exceptionName !== 'Information Not Available' && !item.details.includes('Sundays');
}

const getASPMonth = async () => {
	log('getASPMonth');
	const dates = Array.from({ length: 7 }, (_, i) => {
		const start = dayjs().add(i * 2, 'month').startOf('month').format('YYYY-MM-DD');
		const end = dayjs(start).add(2, 'month').subtract(1, 'day').endOf('month').format('YYYY-MM-DD');
		return { start, end };
	});
	for (const { start, end } of dates) {
		await new Promise(resolve => setTimeout(resolve, 5000)); // wait 5 seconds between requests
		await getASPData(start, end);
	}
};

function isMetered(text: string): boolean {
	const neg = text.indexOf('meters are not in effect') !== -1 || text.indexOf('meters will not be in effect') !== -1;
	const pos = text.indexOf('meters will remain in effect') !== -1 || text.indexOf('meters are in effect') !== -1;
	return neg || pos ? pos : true;
}

function getReason(text: string): string | undefined {
	let keyword;
	if (text.includes('to ')) keyword = 'to ';
	if (text.includes('for ')) keyword = 'for ';
	if (text.includes('on ')) keyword = 'on ';
	if (typeof keyword === 'undefined') return keyword;
  
	const output = text.split(keyword).pop()?.split('.');
	if (!output) return;
	return upperFirst(output[0]);
}

const upperFirst = (text: string) => {
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

const getSchedule = (schedule: string): ScheduleOptions => ({  schedule, timeZone: 'America/New_York' });

exports.getASPData = onSchedule(getSchedule('every 4 hours'), async () => await getASPData())
exports.getASPMonth = onSchedule(getSchedule('30 19 1 * *'), async () => await getASPMonth())
exports.getCustomNotifications = onSchedule(getSchedule('every 15 minutes'), async () => await getCustomNotifications(db));
exports.getNotificationsToday = onSchedule(getSchedule('30 7 * * *'), async () => await getImmediateNotifications(db, 'today'));
exports.getNotificationsTomorrow = onSchedule(getSchedule('0 16 * * *'), async () => await getImmediateNotifications(db, 'nextDay'));
