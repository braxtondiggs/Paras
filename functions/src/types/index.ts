interface Notification {
	exceptionOnly: boolean;
	nextDay: string;
	nextDayCustom: string;
	today: string;
	todayCustom: string;
	token: string;
	type: string;
}
  
  
interface Feed {
	active: boolean;
	created: Date;
	date: string;
	id: string;
	metered: boolean;
	reason: string;
	text: string;
	type: string;
}

enum Status {
	Suspended = 'SUSPENDED',
	Active = 'IN EFFECT'
}

interface IASPResponse {
	days: {
		today_id: string;
		items: {
			type: string;
			exceptionName?: string;
			details: string;
			status: Status;
		}[];
	}[];
}

export { Notification, Feed, Status, IASPResponse }