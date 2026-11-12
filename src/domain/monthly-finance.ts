import type {Expense,Payment,PayrollPayment} from "../types";

export interface MonthlyFinanceReport {
  month:string;
  income:number;
  expenses:number;
  net:number;
  paymentCount:number;
  expenseCount:number;
  paymentsByMethod:Record<string,number>;
  expensesByCategory:Record<string,number>;
}
const inMonth=(date:string,month:string)=>date.slice(0,7)===month;

export function buildMonthlyFinanceReport(payments:Payment[],expenses:Expense[],month:string,payrollPayments:PayrollPayment[]=[]):MonthlyFinanceReport{
  const monthPayments=payments.filter(row=>inMonth(row.paidAt,month));
  const monthExpenses=expenses.filter(row=>inMonth(row.incurredAt,month));
  const monthPayroll=payrollPayments.filter(row=>inMonth(row.paidAt,month));
  const income=monthPayments.reduce((sum,row)=>sum+row.amount,0);
  const expenseTotal=monthExpenses.reduce((sum,row)=>sum+row.amount,0)+monthPayroll.reduce((sum,row)=>sum+row.amount,0);
  const paymentsByMethod:Record<string,number>={};
  const expensesByCategory:Record<string,number>={};
  for(const row of monthPayments)paymentsByMethod[row.method]=(paymentsByMethod[row.method]??0)+row.amount;
  for(const row of monthExpenses)expensesByCategory[row.category]=(expensesByCategory[row.category]??0)+row.amount;
  for(const row of monthPayroll)expensesByCategory.salary=(expensesByCategory.salary??0)+row.amount;
  return {month,income,expenses:expenseTotal,net:income-expenseTotal,paymentCount:monthPayments.length,expenseCount:monthExpenses.length+monthPayroll.length,paymentsByMethod,expensesByCategory};
}

export function previousMonth(month:string):string{
  const [year,monthNumber]=month.split("-").map(Number);
  const date=new Date(year,monthNumber-2,1);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}

export function recentMonths(month:string,count=6):string[]{
  const [year,monthNumber]=month.split("-").map(Number);
  return Array.from({length:count},(_,index)=>{
    const date=new Date(year,monthNumber-1-(count-1-index),1);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
  });
}
