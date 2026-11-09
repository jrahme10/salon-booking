import type {Appointment,Payment,Service} from "../types";
export type ServicePerformancePeriod="30"|"90";
export interface ServicePerformanceRow { service:Service; bookings:number; completed:number; cancelled:number; completionRate:number; estimatedValue:number; collected:number; averageCollectedPerCompleted:number }
const dateValue=(value:string)=>{const parsed=new Date(value).getTime();return Number.isFinite(parsed)?parsed:null;};
const inRange=(value:string,start:number,end:number)=>{const parsed=dateValue(value);return parsed!==null&&parsed>=start&&parsed<end;};
export function buildServicePerformanceReport(input:{services:Service[];appointments:Appointment[];payments:Payment[];period:ServicePerformancePeriod;now?:Date}):ServicePerformanceRow[]{
 const now=input.now??new Date(); const end=now.getTime()+1; const start=end-Number(input.period)*24*60*60*1000;
 const appointments=input.appointments.filter(row=>inRange(row.startsAt,start,end));
 const appointmentById=new Map(input.appointments.map(row=>[row.id,row])); const collectedByService=new Map<string,number>();
 for(const payment of input.payments){if(!inRange(payment.paidAt,start,end))continue;const appointment=appointmentById.get(payment.appointmentId);if(!appointment)continue;collectedByService.set(appointment.serviceId,(collectedByService.get(appointment.serviceId)??0)+payment.amount);}
 return input.services.filter(service=>service.active).map(service=>{const serviceAppointments=appointments.filter(row=>row.serviceId===service.id);const completed=serviceAppointments.filter(row=>row.status==="completed").length;const cancelled=serviceAppointments.filter(row=>row.status==="cancelled").length;const bookings=serviceAppointments.length;const collected=collectedByService.get(service.id)??0;return {service,bookings,completed,cancelled,completionRate:bookings?Math.round(completed/bookings*100):0,estimatedValue:completed*service.price,collected,averageCollectedPerCompleted:completed?collected/completed:0};}).sort((a,b)=>b.collected-a.collected||b.completed-a.completed||a.service.name.localeCompare(b.service.name));
}