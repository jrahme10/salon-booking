export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export interface Business { id:string; name:string; slug:string; category:string; city:string; address:string; currency:"USD"|"LBP" }
export interface Service { id:string; businessId:string; name:string; category:string; durationMinutes:number; price:number; active:boolean }
export interface Employee { id:string; businessId:string; name:string; role:string; initials:string; active:boolean }
export interface Customer { id:string; name:string; phone:string; email:string; visits:number; lastVisit:string }
export interface Appointment { id:string; businessId:string; customerId:string; serviceId:string; employeeId:string; startsAt:string; status:BookingStatus; paidAmount:number }