import { describe, expect, it } from "vitest";
import { validatePublicBooking, type RuleBusiness, type RuleEmployee, type RuleService } from "./booking-rules";

const day = { enabled: true, start: "09:00", end: "18:00" };
const business: RuleBusiness = {
  timezone: "Asia/Beirut",
  workingHours: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: { ...day, enabled: false } },
  bookingRules: { allowOnlineBooking: true, minimumNoticeHours: 2 },
};
const service: RuleService = { id: "svc", active: true, durationMinutes: 60 };
const employee: RuleEmployee = { active: true, serviceIds: ["svc"], workingHours: {}, timeOff: [] };
// 2026-11-16 is a Monday; Beirut is UTC+2 in winter.
const now = new Date("2026-11-16T05:00:00Z");
const at = (iso: string) => new Date(iso);
const check = (overrides: Partial<Parameters<typeof validatePublicBooking>[0]> = {}) =>
  validatePublicBooking({ business, service, employee, startsAt: at("2026-11-17T10:00:00+02:00"), now, ...overrides });

describe("validatePublicBooking", () => {
  it("accepts a valid slot", () => expect(check()).toBeNull());
  it("accepts a slot ending exactly at closing time", () => expect(check({ startsAt: at("2026-11-17T17:00:00+02:00") })).toBeNull());
  it("rejects a slot that runs past closing time", () => expect(check({ startsAt: at("2026-11-17T17:30:00+02:00") })).toMatch(/opening hours/));
  it("rejects a slot before opening", () => expect(check({ startsAt: at("2026-11-17T08:30:00+02:00") })).toMatch(/opening hours/));
  it("rejects closed days", () => expect(check({ startsAt: at("2026-11-22T10:00:00+02:00") })).toMatch(/opening hours/));
  it("uses the business time zone, not UTC", () => expect(check({ startsAt: at("2026-11-17T07:30:00Z") })).toBeNull());
  it("rejects past times", () => expect(check({ startsAt: at("2026-11-15T10:00:00+02:00") })).toMatch(/future/));
  it("enforces minimum notice", () => expect(check({ startsAt: at("2026-11-16T08:00:00+02:00") })).toMatch(/notice/));
  it("rejects bookings beyond the horizon", () => expect(check({ startsAt: at("2027-07-01T10:00:00+03:00") })).toMatch(/six months/));
  it("blocks when online booking is paused", () =>
    expect(check({ business: { ...business, bookingRules: { allowOnlineBooking: false } } })).toMatch(/unavailable/));
  it("rejects inactive services and staff", () => {
    expect(check({ service: { ...service, active: false } })).toMatch(/service/);
    expect(check({ employee: { ...employee, active: false } })).toMatch(/team member/);
  });
  it("requires the employee to offer the service", () => expect(check({ employee: { ...employee, serviceIds: ["other"] } })).toMatch(/does not provide/));
  it("honours time off", () => expect(check({ employee: { ...employee, timeOff: ["2026-11-17"] } })).toMatch(/unavailable/));
  it("honours the employee's own working hours", () =>
    expect(check({ employee: { ...employee, workingHours: { tue: { enabled: true, start: "12:00", end: "18:00" } } } })).toMatch(/not working/));
  it("rejects days the employee does not work", () =>
    expect(check({ employee: { ...employee, workingHours: { tue: { ...day, enabled: false } } } })).toMatch(/not working/));
});
