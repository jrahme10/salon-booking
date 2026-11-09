export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export interface WorkingDay { enabled:boolean; start:string; end:string }
export type WeeklySchedule = Record<Weekday,WorkingDay>;
export interface BusinessBookingRules { allowOnlineBooking:boolean; minimumNoticeHours:number; cancellationNoticeHours:number; slotIntervalMinutes:15|30|60 }
export interface Business { id:string; name:string; slug:string; category:string; city:string; address:string; currency:"USD"|"LBP"; phone?:string; email?:string; website?:string; description?:string; timezone?:string; workingHours?:WeeklySchedule; bookingRules?:BusinessBookingRules }
export interface Service { id:string; businessId:string; name:string; category:string; durationMinutes:number; price:number; active:boolean }
export interface Employee { id:string; businessId:string; name:string; role:string; initials:string; active:boolean; serviceIds?:string[]; workingHours?:WeeklySchedule; timeOff?:string[] }
export interface Customer { id:string; name:string; phone:string; email:string; visits:number; lastVisit:string; businessId?:string }
export interface Appointment { id:string; businessId:string; customerId:string; serviceId:string; employeeId:string; startsAt:string; status:BookingStatus; paidAmount:number; source?:"provider"|"client" }

export type ClientRequestKind = "cancellation" | "reschedule";
export type ClientRequestStatus = "pending" | "approved" | "declined";
export interface ClientAppointmentRequest {
  id:string;
  businessId:string;
  appointmentId:string;
  customerId:string;
  kind:ClientRequestKind;
  status:ClientRequestStatus;
  requestedStartsAt?:string;
  createdAt:string;
}
