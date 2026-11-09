export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export interface WorkingDay { enabled:boolean; start:string; end:string }
export type WeeklySchedule = Record<Weekday,WorkingDay>;
export interface BusinessBookingRules { allowOnlineBooking:boolean; minimumNoticeHours:number; cancellationNoticeHours:number; slotIntervalMinutes:15|30|60 }
export interface Business { id:string; name:string; slug:string; category:string; city:string; address:string; currency:"USD"|"LBP"; phone?:string; email?:string; website?:string; description?:string; timezone?:string; workingHours?:WeeklySchedule; bookingRules?:BusinessBookingRules }
export interface Service { id:string; businessId:string; name:string; category:string; durationMinutes:number; price:number; active:boolean }
export interface Employee { id:string; businessId:string; name:string; role:string; initials:string; active:boolean; serviceIds?:string[]; workingHours?:WeeklySchedule; timeOff?:string[]; commissionType?:"percentage"|"fixed"; commissionValue?:number }
export interface Customer { id:string; name:string; phone:string; email:string; visits:number; lastVisit:string; businessId?:string; birthday?:string }
export type CustomerReminderStatus = "pending" | "completed" | "cancelled";
export interface CustomerReminder { id:string; businessId:string; customerId:string; dueAt:string; note:string; status:CustomerReminderStatus; createdAt:string }
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

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "other";
export interface Payment { id:string; businessId:string; appointmentId:string; amount:number; method:PaymentMethod; paidAt:string; note?:string }
export type ExpenseCategory = "rent" | "salary" | "supplies" | "utilities" | "maintenance" | "marketing" | "other";
export interface Expense { id:string; businessId:string; amount:number; category:ExpenseCategory; description:string; incurredAt:string; paymentMethod:PaymentMethod }
export interface CommissionEntry { id:string; businessId:string; appointmentId:string; employeeId:string; serviceName:string; baseAmount:number; commissionType:"percentage"|"fixed"; commissionValue:number; amount:number; earnedAt:string }
export interface PayrollPayment { id:string; businessId:string; employeeId:string; amount:number; method:PaymentMethod; paidAt:string; note?:string }
