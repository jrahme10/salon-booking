import type {Appointment,Customer,Employee,Payment,Service} from "../types";

export type CustomerInsightPeriod="30"|"90"|"all";
export interface CustomerInsightRow {
 customer:Customer;
 completedVisits:number;
 lifetimeVisits:number;
 lifetimeSpend:number;
 periodSpend:number;
 lastVisit:string|null;
 firstVisit:string|null;
 upcomingBookings:number;
 isNew:boolean;
 isReturning:boolean;
 isInactive:boolean;
}
export interface CustomerBookingHistoryRow {
 appointment:Appointment;
 service:Service|undefined;
 employee:Employee|undefined;
 collected:number;
}
export interface CustomerInsightsReport {
 rows:CustomerInsightRow[];
 loyalCustomers:CustomerInsightRow[];
 inactiveCustomers:CustomerInsightRow[];
 totalActiveCustomers:number;
 repeatVisitRate:number;
 averageCustomerSpend:number;
 newCustomers:number;
 returningCustomers:number;
 totalCompletedVisits:number;
 collectedRevenue:number;
}
const time=(value:string)=>{const parsed=new Date(value).getTime();return Number.isFinite(parsed)?parsed:null;};
const periodStart=(period:CustomerInsightPeriod,now:Date)=>{if(period==="all")return Number.NEGATIVE_INFINITY;const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-Number(period)+1);return start.getTime();};
export function buildCustomerInsights(input:{customers:Customer[];appointments:Appointment[];payments:Payment[];period:CustomerInsightPeriod;now?:Date;inactiveAfterDays?:number}):CustomerInsightsReport{
 const now=input.now??new Date(),start=periodStart(input.period,now),inactiveBefore=now.getTime()-(input.inactiveAfterDays??60)*86400000;
 const appointmentById=new Map(input.appointments.map(row=>[row.id,row]));
 const paymentsByAppointment=new Map<string,number>();
 const periodSpendByCustomer=new Map<string,number>();
 for(const payment of input.payments){const appointment=appointmentById.get(payment.appointmentId);if(!appointment)continue;paymentsByAppointment.set(payment.appointmentId,(paymentsByAppointment.get(payment.appointmentId)??0)+payment.amount);const paidAt=time(payment.paidAt);if(paidAt!==null&&paidAt>=start&&paidAt<=now.getTime())periodSpendByCustomer.set(appointment.customerId,(periodSpendByCustomer.get(appointment.customerId)??0)+payment.amount);}
 const rows=input.customers.map(customer=>{
  const customerAppointments=input.appointments.filter(row=>row.customerId===customer.id);
  const completed=customerAppointments.filter(row=>row.status==="completed").sort((a,b)=>(time(a.startsAt)??0)-(time(b.startsAt)??0));
  const inPeriod=completed.filter(row=>{const value=time(row.startsAt);return value!==null&&value>=start&&value<=now.getTime();});
  const lifetimeSpend=customerAppointments.reduce((sum,row)=>sum+(paymentsByAppointment.get(row.id)??0),0);
  const periodSpend=periodSpendByCustomer.get(customer.id)??0;
  const lastVisit=completed.length?completed[completed.length-1].startsAt:null;
  const firstVisit=completed[0]?.startsAt??null;
  const upcomingBookings=customerAppointments.filter(row=>(row.status==="pending"||row.status==="confirmed")&&(time(row.startsAt)??0)>now.getTime()).length;
  const isNew=input.period==="all"?completed.length===1:!!firstVisit&&(time(firstVisit)??0)>=start;
  const isReturning=inPeriod.length>0&&!isNew;
  return {customer,completedVisits:inPeriod.length,lifetimeVisits:completed.length,lifetimeSpend,periodSpend,lastVisit,firstVisit,upcomingBookings,isNew,isReturning,isInactive:!!lastVisit&&(time(lastVisit)??now.getTime())<inactiveBefore&&upcomingBookings===0};
 }).sort((a,b)=>b.lifetimeVisits-a.lifetimeVisits||b.lifetimeSpend-a.lifetimeSpend||a.customer.name.localeCompare(b.customer.name));
 const activeRows=rows.filter(row=>row.completedVisits>0);
 const repeatCustomers=activeRows.filter(row=>row.completedVisits>=2).length;
 const spenders=rows.filter(row=>row.periodSpend>0);
 const loyalCustomers=[...rows].filter(row=>row.lifetimeVisits>0).sort((a,b)=>b.lifetimeVisits-a.lifetimeVisits||b.lifetimeSpend-a.lifetimeSpend).slice(0,5);
 const inactiveCustomers=rows.filter(row=>row.isInactive).sort((a,b)=>(time(a.lastVisit??"")??0)-(time(b.lastVisit??"")??0));
 return {rows,loyalCustomers,inactiveCustomers,totalActiveCustomers:activeRows.length,repeatVisitRate:activeRows.length?Math.round(repeatCustomers/activeRows.length*100):0,averageCustomerSpend:spenders.length?spenders.reduce((sum,row)=>sum+row.periodSpend,0)/spenders.length:0,newCustomers:activeRows.filter(row=>row.isNew).length,returningCustomers:activeRows.filter(row=>row.isReturning).length,totalCompletedVisits:activeRows.reduce((sum,row)=>sum+row.completedVisits,0),collectedRevenue:rows.reduce((sum,row)=>sum+row.periodSpend,0)};
}
export function buildCustomerBookingHistory(input:{customerId:string;appointments:Appointment[];services:Service[];employees:Employee[];payments:Payment[]}):CustomerBookingHistoryRow[]{
 const serviceById=new Map(input.services.map(row=>[row.id,row]));
 const employeeById=new Map(input.employees.map(row=>[row.id,row]));
 const collectedByAppointment=new Map<string,number>();
 for(const payment of input.payments)collectedByAppointment.set(payment.appointmentId,(collectedByAppointment.get(payment.appointmentId)??0)+payment.amount);
 return input.appointments.filter(row=>row.customerId===input.customerId).sort((a,b)=>(time(b.startsAt)??0)-(time(a.startsAt)??0)).map(appointment=>({appointment,service:serviceById.get(appointment.serviceId),employee:employeeById.get(appointment.employeeId),collected:collectedByAppointment.get(appointment.id)??0}));
}
