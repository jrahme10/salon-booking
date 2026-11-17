import {useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {ArrowDownRight,ArrowRight,ArrowUpRight,Bell,Minus,Plus} from "lucide-react";
import type {Appointment,Business,CommissionEntry,Customer,Employee,Expense,Payment,PayrollPayment,Service} from "../types";
import {buildBusinessDashboardReport,type DashboardPeriod} from "../domain/business-dashboard";
import {buildEmployeePerformanceReport} from "../domain/employee-performance";
import {buildServicePerformanceReport} from "../domain/service-performance";
import {getAuthSession} from "../services/auth";

type Props={
 business:Business;
 appointments:Appointment[];
 payments:Payment[];
 expenses:Expense[];
 payroll:PayrollPayment[];
 employees:Employee[];
 services:Service[];
 commissions:CommissionEntry[];
 customers:Customer[];
 pendingRequests?:number;
 onNew:()=>void;
 onEdit:(appointment:Appointment)=>void;
};
const money=(value:number,currency:Business["currency"])=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:currency==="LBP"?0:2}).format(value);
const monthLabel=(key:string)=>new Date(Number(key.slice(0,4)),Number(key.slice(5,7))-1,1).toLocaleDateString("en-US",{month:"short"});
const timeOf=(value:string)=>new Date(value).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
const initialsOf=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("");
const greeting=(hour:number)=>hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";

export function BusinessDashboard({business,appointments,payments,expenses,payroll,employees,services,commissions,customers,pendingRequests=0,onNew,onEdit}:Props){
 const [period,setPeriod]=useState<DashboardPeriod>("30");
 const report=useMemo(()=>buildBusinessDashboardReport({appointments,payments,expenses,payroll,period}),[appointments,payments,expenses,payroll,period]);
 const team=useMemo(()=>buildEmployeePerformanceReport({employees:employees.filter(row=>row.active),appointments,services,payments,commissions,payroll,period}),[employees,appointments,services,payments,commissions,payroll,period]);
 const serviceRows=useMemo(()=>buildServicePerformanceReport({services,appointments,payments,period}),[services,appointments,payments,period]);
 const maxServiceCollected=Math.max(1,...serviceRows.map(row=>row.collected));
 const maxTeamValue=Math.max(1,...team.rows.map(row=>row.serviceValue));
 const maxTrend=Math.max(1,...report.trend.flatMap(row=>[row.revenue,row.expenses]));
 const today=new Date();
 const todayAppointments=appointments.filter(row=>{const date=new Date(row.startsAt);return date.getFullYear()===today.getFullYear()&&date.getMonth()===today.getMonth()&&date.getDate()===today.getDate();}).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
 const pendingToday=todayAppointments.filter(row=>row.status==="pending").length;
 const pendingConfirmations=appointments.filter(row=>row.status==="pending").length;
 const attentionCount=pendingConfirmations+pendingRequests;
 const topTeam=team.rows.slice(0,3);
 const revenueChange=report.revenueChange;
 const firstName=(getAuthSession()?.user.displayName??"").split(/\s+/)[0];
 const name=(id:string,list:{id:string;name:string}[],fallback:string)=>list.find(row=>row.id===id)?.name??fallback;

 return <div className="wd">
  <header className="wd-top">
   <div>
    <span className="wd-kicker">{today.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} · {business.name}</span>
    <h1>{greeting(today.getHours())}{firstName?`, ${firstName}`:""}.</h1>
    <p>{todayAppointments.length
     ?`${todayAppointments.length} appointment${todayAppointments.length===1?"":"s"} on the schedule today${pendingToday?`, ${pendingToday} awaiting confirmation`:""}.`
     :"No appointments are scheduled today. A good moment to review your calendar or add a booking."}</p>
   </div>
   <div className="wd-tools">
    <div className="wd-switch" role="group" aria-label="Dashboard reporting period"><button type="button" className={period==="30"?"on":""} onClick={()=>setPeriod("30")}>30 days</button><button type="button" className={period==="90"?"on":""} onClick={()=>setPeriod("90")}>90 days</button></div>
    <button type="button" className="wd-new" onClick={onNew}><Plus size={16}/> New appointment</button>
   </div>
  </header>

  {attentionCount>0&&<Link className="wd-attention" to="/provider/bookings">
   <span className="wd-attention-icon"><Bell size={16}/></span>
   <span className="wd-attention-copy">
    <b>Needs attention</b>
    <small>
     {[pendingConfirmations?`${pendingConfirmations} pending confirmation${pendingConfirmations===1?"":"s"}`:"",pendingRequests?`${pendingRequests} client request${pendingRequests===1?"":"s"}`:""].filter(Boolean).join(" · ")}
    </small>
   </span>
   <span className="wd-attention-action">Open bookings <ArrowRight size={14}/></span>
  </Link>}

  <section className="wd-kpis" aria-label="Key figures">
   <article className="wd-card wd-hero">
    <small>Revenue collected</small>
    <b className="wd-num">{money(report.current.revenue,business.currency)}</b>
    <span className={"wd-delta"+(revenueChange===null||revenueChange===0?" flat":revenueChange<0?" down":"")}>
     {revenueChange===null?<>No previous baseline</>:<>{revenueChange>0?<ArrowUpRight size={13}/>:revenueChange<0?<ArrowDownRight size={13}/>:<Minus size={13}/>}{Math.abs(revenueChange).toFixed(1)}% vs previous {period} days</>}
    </span>
   </article>
   <article className="wd-card"><small>Appointments</small><b className="wd-num">{report.current.appointments}</b><span className="wd-sub">{report.current.completed} completed · {report.current.pending} pending</span></article>
   <article className="wd-card"><small>Completion rate</small><b className="wd-num">{report.current.completionRate}%</b><div className="wd-bar" role="img" aria-label={`${report.current.completionRate}% completed`}><i style={{width:report.current.completionRate+"%"}}/></div><span className="wd-sub" style={{marginTop:8}}>{report.current.cancelled} cancelled in this period</span></article>
   <article className="wd-card"><small>Net cash flow</small><b className="wd-num">{money(report.current.net,business.currency)}</b><span className="wd-sub">After recorded expenses and payroll</span></article>
  </section>

  <section className="wd-row wd-row-main">
   <article className="wd-panel wd-panel-wide">
    <div className="wd-head"><div><h2>Six-month cash trend</h2><p className="wd-lede">Money received compared with expenses and payroll paid.</p></div><div className="wd-legend"><span><i/>Revenue</span><span><i className="cost"/>Expenses + payroll</span></div></div>
    <div className="wd-chart">{report.trend.map(row=><div className="wd-col" key={row.key}><i style={{height:Math.max(2,row.revenue/maxTrend*100)+"%"}} title={"Revenue "+money(row.revenue,business.currency)}/><i className="cost" style={{height:Math.max(2,row.expenses/maxTrend*100)+"%"}} title={"Expenses "+money(row.expenses,business.currency)}/></div>)}</div>
    <div className="wd-months">{report.trend.map(row=><span key={row.key}>{monthLabel(row.key)}</span>)}</div>
    <div className="wd-foot"><span>Selected period net <b>{money(report.current.net,business.currency)}</b></span><span>Previous period <b>{money(report.previous.net,business.currency)}</b></span></div>
   </article>
   <article className="wd-panel wd-panel-side">
    <div className="wd-head"><div><h2>Today</h2><p className="wd-lede">{todayAppointments.length} {todayAppointments.length===1?"appointment":"appointments"}</p></div></div>
    {todayAppointments.length
     ?<ol className="wd-today">{todayAppointments.slice(0,5).map(row=><li key={row.id}>
       <button type="button" className="wd-today-row" onClick={()=>onEdit(row)} aria-label={`Edit ${name(row.customerId,customers,"client")} at ${timeOf(row.startsAt)}`}>
        <span className="wd-time">{timeOf(row.startsAt)}</span>
        <span className={"wd-slot "+row.status}><b>{name(row.serviceId,services,"Service")}</b><span>{name(row.customerId,customers,"Client")} · {name(row.employeeId,employees,"Team")}</span></span>
        <span className={"status "+row.status}>{row.status}</span>
       </button>
      </li>)}</ol>
     :<div className="wd-empty"><b>Your day is still open</b>New bookings will appear here with their time, service and team member.</div>}
   </article>
  </section>

  <section className="wd-row wd-row-cards">
   <article className="wd-panel wd-panel-card">
    <div className="wd-head"><div><h2>Top team members</h2><p className="wd-lede">By estimated service value · <Link to="/provider/analytics">Full team report</Link></p></div></div>
    {topTeam.length
     ?<div className="wd-list">{topTeam.map(row=><div className="wd-person" key={row.employee.id}>
       <span className="wd-avatar">{row.employee.initials||initialsOf(row.employee.name)}</span>
       <div><div className="wd-line"><b>{row.employee.name}</b><b>{money(row.serviceValue,business.currency)}</b></div><div className="wd-bar"><i style={{width:(row.serviceValue/maxTeamValue*100)+"%"}}/></div><div className="wd-line"><small>{row.completed} completed · {row.customers} clients</small><small>{money(row.collected,business.currency)} collected</small></div></div>
      </div>)}</div>
     :<div className="wd-empty"><b>Your team story starts here</b>Add active team members and complete appointments to see who is making the biggest impact.</div>}
   </article>
   <article className="wd-panel wd-panel-card">
    <div className="wd-head"><div><h2>Top services</h2><p className="wd-lede">Payments recorded for each service.</p></div></div>
    {serviceRows.length
     ?<div className="wd-list">{serviceRows.slice(0,5).map(row=><div key={row.service.id}><div className="wd-line"><b>{row.service.name}</b><b>{money(row.collected,business.currency)}</b></div><div className="wd-bar"><i style={{width:(row.collected/maxServiceCollected*100)+"%"}}/></div><div className="wd-line"><small>{row.bookings} bookings · {row.completed} completed</small><small>{row.completionRate}% completion</small></div></div>)}</div>
     :<div className="wd-empty"><b>Your best services will show here</b>Add services to start tracking bookings and collections.</div>}
   </article>
   <article className="wd-panel wd-panel-card wd-insight">
    <small>A LITTLE INSIGHT</small>
    <h2>{report.current.revenue>report.previous.revenue?"Revenue is ahead of the previous period.":report.current.revenue<report.previous.revenue?"Revenue is below the previous period.":"Revenue is holding steady."}</h2>
    <p>{revenueChange===null?"There is no previous-period revenue baseline yet.":`Recorded collections changed by ${Math.abs(revenueChange).toFixed(1)}% compared with the previous ${period} days.`} Keep an eye on booking completion and collections together.</p>
   </article>
  </section>

  <p className="wd-note">Financial figures use payment, expense and payroll ledgers by transaction date, and revenue comparisons use equal-length periods. Service value is an estimate based on current service prices; it is not historical invoiced revenue.</p>
 </div>;
}
