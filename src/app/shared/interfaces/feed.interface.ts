import type { Timestamp } from '@firebase/firestore-types';

export interface Feed {
  active: boolean;
  created: Timestamp;
  date: Timestamp;
  id: number;
  metered: boolean;
  reason: string;
  text: string;
  type: string;
}
