import type {Appointment,Employee,Expense,PayrollPayment,Payment} from "../types";

export type DashboardPeriod="30"|"90";
export interface DashboardTotals {
 revenue:number;
 expenses:number;
 net:number;
 appointments:number;
 completed:number;
 pending:number;
 cancelled:number;
 completionRate:number;
 paymentCount:number;
}
export interface DashboardMonth { key:string; revenue:number; expenses:number }
export interface BusinessDashboardReport {
 current:DashboardTotals;
 previous:DashboardTotals;
 revenueChange:number|null;
 trend:DashboardMonth[];
}
const timestamp=(value:string)=>{const parsed=new Date(value).getTime();return Number.isFinite(parsed)?parsed:null;};
const inRange=(value:string,start:number,end:number)=>{const time=timestamp(value);return time!==null&&time>=start&&time<end;};
const monthKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
const totals=(input:{appointments:Appointment[];payments:Payment[];expenses:Expense[];payroll:PayrollPayment[]},start:number,end:number):DashboardTotals=>{
 const appointments=input.appointments.filter(row=>inRange(row.startsAt,start,end));
 const payments=input.payments.filter(row=>inRange(row.paidAt,start,end));
 const expenses=input.expenses.filter(row=>inRange(row.incurredAt,start,end));
 const payroll=input.payroll.filter(row=>inRange(row.paidAt,start,end));
 const revenue=payments.reduce((sum,row)=>sum+row.amount,0);
 const expenseTotal=expenses.reduce((sum,row)=>sum+row.amount,0)+payroll.reduce((sum,row)=>sum+row.amount,0);
 const completed=appointments.filter(row=>row.status==="completed").length;
 return {revenue,expenses:expenseTotal,net:revenue-expenseTotal,appointments:appointments.length,completed,pending:appointments.filter(row=>row.status==="pending").length,cancelled:appointments.filter(row=>row.status==="cancelled").length,completionRate:appointments.length?Math.round(completed/appointments.length*100):0,paymentCount:payments.length};
};
export function buildBusinessDashboardReport(input:{appointments:Appointment[];payments:Payment[];expenses:Expense[];payroll:PayrollPayment[];period:DashboardPeriod;now?:Date}):BusinessDashboardReport{
 const now=input.now??new Date();
 const end=now.getTime()+1;
 const days=Number(input.period);
 const duration=days*24*60*60*1000;
 const start=end-duration;
 const previousStart=start-duration;
 const current=totals(input,start,end);
 const previous=totals(input,previousStart,start);
 const revenueChange=previous.revenue===0?(current.revenue===0?0:null):(current.revenue-previous.revenue)/previous.revenue*100;
 const trend=Array.from({length:6},(_,index)=>{
  const date=new Date(now.getFullYear(),now.getMonth()-(5-index),1);
  const key=monthKey(date);
  const monthStart=date.getTime();
  const nextMonth=new Date(date.getFullYear(),date.getMonth()+1,1).getTime();
  const monthPayments=input.payments.filter(row=>inRange(row.paidAt,monthStart,nextMonth));
  const monthExpenses=input.expenses.filter(row=>inRange(row.incurredAt,monthStart,nextMonth));
  const monthPayroll=input.payroll.filter(row=>inRange(row.paidAt,monthStart,nextMonth));
  return {key,revenue:monthPayments.reduce((sum,row)=>sum+row.amount,0),expenses:monthExpenses.reduce((sum,row)=>sum+row.amount,0)+monthPayroll.reduce((sum,row)=>sum+row.amount,0)};
 });
 return {current,previous,revenueChange,trend};
}
