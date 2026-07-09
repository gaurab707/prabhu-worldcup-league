// Central date/time handling — everything the app displays is rendered in
// Nepal time (Asia/Kathmandu, UTC+05:45), regardless of the viewer's device
// timezone. Server timestamps are treated as UTC (naive ones included), so
// there is no accidental double-shift.
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const NEPAL_TZ = "Asia/Kathmandu";
dayjs.tz.setDefault(NEPAL_TZ);

type DateInput = string | number | Date | null | undefined;

/** Format a server value in Nepal time. Naive strings are treated as UTC. */
export function fmt(value: DateInput, format: string): string {
  if (value === null || value === undefined || value === "") return "—";
  return dayjs.utc(value).tz(NEPAL_TZ).format(format);
}

/** Server value -> Nepal wall-clock for a <input type="datetime-local">. */
export function toInput(value: DateInput): string {
  if (!value) return "";
  return dayjs.utc(value).tz(NEPAL_TZ).format("YYYY-MM-DDTHH:mm");
}

/** datetime-local value (read as Nepal wall-clock) -> ISO UTC string to send. */
export function fromInput(localValue: string): string {
  return dayjs.tz(localValue, NEPAL_TZ).toISOString();
}

/** Default value for a new datetime-local input, in Nepal time. */
export function nowInput(addDays = 0): string {
  return dayjs().tz(NEPAL_TZ).add(addDays, "day").format("YYYY-MM-DDTHH:mm");
}
