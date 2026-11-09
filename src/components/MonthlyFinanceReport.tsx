import {useMemo,useState} from "react";
import {ArrowDownLeft,ArrowUpRight,CalendarDays,Wallet} from "lucide-react";
import type {Business,Expense,Payment} from "../types";
import {buildMonthlyFinanceReport,previousMonth,recentMonths} from "../domain/monthly-finance";

type Props={business:Business;payments:Payment[];expenses:Expense[]};
const money=(value:number,currency:Business["currency"])=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:currency==="LBP"?0:2}).format(value);
const currentMonth=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;};
const monthLabel=(month:string,style:"long"|"short"="long")=>new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1).toLocaleDateString(undefined,{month:style,year:"numeric"});
const categoryNames:Record<string,string>={rent:"Rent",salary:"Salaries",supplies:"Supplies",utilities:"Utilities",maintenance:"Maintenance",marketing:"Marketing",other:"Other"};
const methodNames:Record<string,string>={cash:"Cash",card:"Card",bank_transfer:"Bank transfer",other:"Other"};

export function MonthlyFinanceReport({business,payments,expenses}:Props){
 const [month,setMonth]=useState(currentMonth());
 const report=useMemo(()=>buildMonthlyFinanceReport(payments,expenses,month),[payments,expenses,month]);
 const previous=useMemo(()=>buildMonthlyFinanceReport(payments,expenses,previousMonth(month)),[payments,expenses,month]);
 const trend=useMemo(()=>recentMonths(month,6).map(key=>({key,...buildMonthlyFinanceReport(payments,expenses,key)})),[payments,expenses,month]);
 const maxTrend=Math.max(1,...trend.map(row=>Math.max(row.income,row.expenses)));
 const maxExpense=Math.max(1,...Object.values(report.expensesByCategory));
 const maxMethod=Math.max(1,...Object.values(report.paymentsByMethod));
 const difference=report.net-previous.net;
 const changeLabel=previous.net===0?(difference===0?"No change":"No previous net balance"):`${difference>0?"+":""}${(difference/Math.abs(previous.net)*100).toFixed(1)}% vs previous month`;
 return <div className="monthly-report">
  <div className="monthly-report-toolbar"><div><h2>Monthly performance</h2><p>Income and expenses based on individually recorded transactions.</p></div><label><CalendarDays size={15}/><input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></div>
  <div className="metrics monthly-metrics">
   <div className="metric"><span><Wallet size={18}/></span><small>Income received</small><b>{money(report.income,business.currency)}</b><em>{report.paymentCount} recorded payments</em></div>
   <div className="metric"><span><ArrowDownLeft size={18}/></span><small>Expenses</small><b>{money(report.expenses,business.currency)}</b><em>{report.expenseCount} expense records</em></div>
   <div className="metric"><span><ArrowUpRight size={18}/></span><small>Net cash flow</small><b>{money(report.net,business.currency)}</b><em>{changeLabel}</em></div>
  </div>
  <section className="panel monthly-trend"><div className="monthly-section-heading"><div><h3>Six-month overview</h3><p>Monthly recorded income compared with expenses</p></div></div><div className="monthly-bars">{trend.map(row=><div className="monthly-bar-column" key={row.key}><div className="monthly-bar-pair"><span className="monthly-bar income" style={{height:`${Math.max(3,row.income/maxTrend*100)}%`}} title={`Income: ${money(row.income,business.currency)}`}/><span className="monthly-bar expense" style={{height:`${Math.max(3,row.expenses/maxTrend*100)}%`}} title={`Expenses: ${money(row.expenses,business.currency)}`}/></div><small>{monthLabel(row.key,"short")}</small></div>)}</div><div className="monthly-legend"><span><i className="income"/>Income</span><span><i className="expense"/>Expenses</span></div></section>
  <div className="monthly-breakdowns">
   <section className="panel"><div className="monthly-section-heading"><div><h3>Expenses by category</h3><p>{monthLabel(month)} breakdown</p></div></div>{Object.entries(report.expensesByCategory).sort((a,b)=>b[1]-a[1]).length?Object.entries(report.expensesByCategory).sort((a,b)=>b[1]-a[1]).map(([category,amount])=><div className="monthly-breakdown-row" key={category}><div><span>{categoryNames[category]??category}</span><b>{money(amount,business.currency)}</b></div><div className="monthly-progress"><i style={{width:`${amount/maxExpense*100}%`}}/></div></div>):<div className="finance-empty">No expenses recorded for this month.</div>}</section>
   <section className="panel"><div className="monthly-section-heading"><div><h3>Payments by method</h3><p>{monthLabel(month)} breakdown</p></div></div>{Object.entries(report.paymentsByMethod).sort((a,b)=>b[1]-a[1]).length?Object.entries(report.paymentsByMethod).sort((a,b)=>b[1]-a[1]).map(([method,amount])=><div className="monthly-breakdown-row" key={method}><div><span>{methodNames[method]??method}</span><b>{money(amount,business.currency)}</b></div><div className="monthly-progress"><i className="payment-progress" style={{width:`${amount/maxMethod*100}%`}}/></div></div>):<div className="finance-empty">No payments recorded for this month.</div>}</section>
  </div>
  <p className="monthly-report-note">Report period: {monthLabel(month)}. Only transactions recorded in the payment and expense history are included; older appointment balances without payment records are not backfilled.</p>
 </div>;
}
