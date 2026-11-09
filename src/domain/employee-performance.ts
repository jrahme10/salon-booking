import type {Appointment,CommissionEntry,Employee,Payment,PayrollPayment,Service} from "../types";
export type PerformancePeriod="30"|"90"|"all";
export interface EmployeePerformanceRow{
 employee:Employee;
 appointments:number;
 completed:number;
 cancelled:number;
 completionRate:number;
 customers:number;
 serviceValue:number;
 collected:number;
 commissionsEarned:number;
 payouts:number;
 outstanding:number;
}
export interface EmployeePerformanceReport{
 rows:EmployeePerformanceRow[];
 completed:number;
 collected:number;
 commissionsEarned:number;
 outstanding:number;
}
const within=(date:string,period:PerformancePeriod,now:Date)=>{
 if(period==="all")return true;
 const timestamp=new Date(date).getTime();
 if(!Number.isFinite(timestamp))return false;
 const start=new Date(now);start.setDate(start.getDate()-(Number(period)-1));start.setHours(0,0,0,0);
 return timestamp>=start.getTime()&&timestamp<=now.getTime();
};
export function buildEmployeePerformanceReport(input:{employees:Employee[];appointments:Appointment[];services:Service[];payments:Payment[];commissions:CommissionEntry[];payroll:PayrollPayment[];period:PerformancePeriod;now?:Date}):EmployeePerformanceReport{
 const now=input.now??new Date();
 const rows=input.employees.map(employee=>{
  const appointments=input.appointments.filter(row=>row.employeeId===employee.id&&within(row.startsAt,input.period,now));
  const completed=appointments.filter(row=>row.status==="completed");
  const cancelled=appointments.filter(row=>row.status==="cancelled");
  const customerIds=new Set(completed.map(row=>row.customerId));
  const serviceValue=completed.reduce((sum,row)=>sum+(input.services.find(service=>service.id===row.serviceId)?.price??0),0);
  const appointmentIds=new Set(appointments.map(row=>row.id));
  const collected=input.payments.filter(payment=>appointmentIds.has(payment.appointmentId)&&within(payment.paidAt,input.period,now)).reduce((sum,row)=>sum+row.amount,0);
  const commissionsEarned=input.commissions.filter(row=>row.employeeId===employee.id&&within(row.earnedAt,input.period,now)).reduce((sum,row)=>sum+row.amount,0);
  const payouts=input.payroll.filter(row=>row.employeeId===employee.id&&within(row.paidAt,input.period,now)).reduce((sum,row)=>sum+row.amount,0);
  const lifetimeEarned=input.commissions.filter(row=>row.employeeId===employee.id).reduce((sum,row)=>sum+row.amount,0);
  const lifetimePaid=input.payroll.filter(row=>row.employeeId===employee.id).reduce((sum,row)=>sum+row.amount,0);
  return {employee,appointments:appointments.length,completed:completed.length,cancelled:cancelled.length,completionRate:appointments.length?Math.round(completed.length/appointments.length*100):0,customers:customerIds.size,serviceValue,collected,commissionsEarned,payouts,outstanding:Math.max(0,lifetimeEarned-lifetimePaid)};
 }).sort((a,b)=>b.serviceValue-a.serviceValue||b.completed-a.completed);
 return {rows,completed:rows.reduce((sum,row)=>sum+row.completed,0),collected:rows.reduce((sum,row)=>sum+row.collected,0),commissionsEarned:rows.reduce((sum,row)=>sum+row.commissionsEarned,0),outstanding:rows.reduce((sum,row)=>sum+row.outstanding,0)};
}
