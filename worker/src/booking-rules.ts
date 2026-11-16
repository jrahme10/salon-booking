// Server-side booking rules for public (unauthenticated) bookings.
// Pure functions only so they can be unit tested without a database.
// Overlap with other appointments is enforced separately by the
// appointments_employee_no_overlap exclusion constraint.

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export interface WorkingDay { enabled: boolean; start: string; end: string }
export type Schedule = Partial<Record<Weekday, WorkingDay>>;

export interface RuleBusiness {
  timezone: string;
  workingHours: Schedule;
  bookingRules: { allowOnlineBooking?: boolean; minimumNoticeHours?: number; cancellationNoticeHours?: number };
}
export interface RuleService { id: string; active: boolean; durationMinutes: number }
export interface RuleEmployee { active: boolean; serviceIds: string[] | null; workingHours: Schedule; timeOff: string[] }

export const MAX_BOOKING_HORIZON_DAYS = 180;
const isTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };

export function isValidTimeZone(timeZone: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date()); return true; } catch { return false; }
}

/** Calendar date, weekday and minute-of-day of an instant in the given IANA time zone. */
export function localParts(date: Date, timeZone: string): { dateKey: string; weekday: Weekday; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday").toLowerCase().slice(0, 3) as Weekday,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function fits(day: WorkingDay | undefined, startMinute: number, endMinute: number): boolean {
  if (!day || !day.enabled || !isTime(day.start) || !isTime(day.end) || day.start >= day.end) return false;
  return startMinute >= toMinutes(day.start) && endMinute <= toMinutes(day.end);
}

/** Returns a customer-facing reason the slot cannot be booked, or null when it is allowed. */
export function validatePublicBooking(input: {
  business: RuleBusiness; service: RuleService; employee: RuleEmployee; startsAt: Date; now?: Date; ignoreNotice?: boolean;
}): string | null {
  const { business, service, employee, startsAt } = input;
  const now = input.now ?? new Date();
  if (business.bookingRules.allowOnlineBooking === false) return "Online booking is currently unavailable. Please contact the salon.";
  if (!Number.isFinite(startsAt.getTime())) return "Choose a valid appointment date and time.";
  if (startsAt.getTime() < now.getTime() - 60_000) return "Appointments must be scheduled in the future.";
  const notice = business.bookingRules.minimumNoticeHours ?? 0;
  if (!input.ignoreNotice && startsAt.getTime() < now.getTime() + notice * 3_600_000 - 60_000)
    return "This time does not meet the salon's minimum booking notice.";
  if (startsAt.getTime() > now.getTime() + MAX_BOOKING_HORIZON_DAYS * 86_400_000) return "Choose a date within the next six months.";
  if (!service.active) return "This service is not currently available.";
  if (!employee.active) return "This team member is not currently available.";
  if (employee.serviceIds && !employee.serviceIds.includes(service.id)) return "This team member does not provide the selected service.";
  if (!Number.isInteger(service.durationMinutes) || service.durationMinutes <= 0) return "The service duration is invalid.";

  const start = localParts(startsAt, business.timezone);
  const end = localParts(new Date(startsAt.getTime() + service.durationMinutes * 60_000 - 1), business.timezone);
  if (start.dateKey !== end.dateKey) return "The appointment must finish within a single day.";
  if (employee.timeOff.includes(start.dateKey)) return "This team member is unavailable on the selected date.";
  const startMinute = start.minute, endMinute = end.minute + 1;
  if (!fits(business.workingHours[start.weekday], startMinute, endMinute)) return "Choose a time within the salon's opening hours.";
  const employeeDay = employee.workingHours[start.weekday] ?? business.workingHours[start.weekday];
  if (!fits(employeeDay, startMinute, endMinute)) return "This team member is not working at the selected time.";
  return null;
}
