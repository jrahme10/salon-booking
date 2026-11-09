export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export interface Service { id:string; name:string; category:string; description:string; durationMinutes:number; price:number; active:boolean; }
export interface TeamMember { id:string; name:string; role:string; initials:string; color:string; }
export interface Booking { id:string; client:string; service:string; staff:string; date:string; time:string; durationMinutes:number; price:number; status:BookingStatus; phone:string; }
export interface BusinessProfile { name:string; location:string; currency:string; timezone:string; }