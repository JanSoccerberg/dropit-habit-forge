import { format, isSameDay, addDays, differenceInCalendarDays, isBefore, parseISO } from "date-fns";

export const today = () => new Date();
export const todayStr = () => format(today(), "yyyy-MM-dd");

export const toISODate = (d: Date) => format(d, "yyyy-MM-dd");
export const isSameDate = (a: string | Date, b: string | Date) => {
  const da = typeof a === "string" ? parseISO(a) : a;
  const db = typeof b === "string" ? parseISO(b) : b;
  return isSameDay(da, db);
};

export const daysBetween = (startISO: string, endISO: string) => {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const days: Date[] = [];
  for (let d = start; !isBefore(end, d); d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
};

export const totalDays = (startISO: string, endISO: string) =>
  differenceInCalendarDays(parseISO(endISO), parseISO(startISO)) + 1;

export const daysElapsed = (startISO: string) =>
  Math.max(0, differenceInCalendarDays(today(), parseISO(startISO)) + 1);

export const percent = (value: number, max: number) =>
  max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
