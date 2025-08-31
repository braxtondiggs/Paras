export interface Calendar {
  text: string;
  date: Date;
  month: {
    short: string;
    long: string;
  };
  day: {
    short: string;
    long: string;
    num: string;
  };
}
