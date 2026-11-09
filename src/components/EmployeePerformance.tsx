import {useMemo,useState} from "react";
import {Award,CalendarCheck,ChartNoAxesCombined,Coins,Wallet,Users} from "lucide-react";
import type {Appointment,Business,CommissionEntry,Employee,Payment,PayrollPayment,Service} from "../types";
import {buildEmployeePerformanceReport,type PerformancePeriod} from "../domain/employee-performance";
import {Heading} from "./shared";
type Props={business:Business;employees:Employee[];appointments:Appointment[];services:Service[];payments:Payment[];commissions:CommissionEntry[];payroll:PayrollPayment[]};
const money=(amount:number,currency:Business["currency"])=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:currency==="LBP"?0:2}).format(amount);
export function EmployeePerformance({business,employees,appointments,services,payments,commissions,payroll}:Props){
 const [period,setPeriod]=useState<PerformancePeriod>("30");
 const report=useMemo(()=>buildEmployeePerformanceReport({employees,appointments,services,payments,commissions,payroll,period}),[employees,appointments,services,payments,commissions,payroll,period]);
 const maxValue=Math.max(1,...report.rows.map(row=>row.serviceValue));
 return <div className="performance-page">
  <div className="performance-toolbar"><div><span className="performance-live-dot"/> PERFORMANCE OVERVIEW</div><select aria-label="Performance date range" value={period} onChange={event=>setPeriod(event.target.value as PerformancePeriod)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></div>
  <div className="metrics performance-metrics">
   <div className="metric"><span><CalendarCheck size={18}/></span><small>Completed appointments</small><b>{report.completed}</b><em>Across your team</em></div>
   <div className="metric"><span><Wallet size={18}/></span><small>Payments collected</small><b>{money(report.collected,business.currency)}</b><em>Recorded payment ledger</em></div>
   <div className="metric"><span><Coins size={18}/></span><small>Commission earned</small><b>{money(report.commissionsEarned,business.currency)}</b><em>Within selected period</em></div>
   <div className="metric"><span><Award size={18}/></span><small>Commission outstanding</small><b>{money(report.outstanding,business.currency)}</b><em>Lifetime unpaid balance</em></div>
  </div>
  <section className="panel performance-ranking"><div className="performance-section-head"><div><small>TEAM COMPARISON</small><h2>Service value by team member</h2><p>Completed appointments multiplied by current service prices. Historical price changes may affect this estimate.</p></div><ChartNoAxesCombined size={21}/></div>
   {report.rows.length?report.rows.map((row,index)=><article className="performance-rank" key={row.employee.id}><span className="performance-rank-number">{String(index+1).padStart(2,"0")}</span><span className="team-avatar">{row.employee.initials||row.employee.name.slice(0,1)}</span><div className="performance-rank-main"><div><b>{row.employee.name}</b><small>{row.completed} completed · {row.customers} clients served</small></div><div className="performance-bar"><span style={{width:(row.serviceValue/maxValue*100)+"%"}}/></div></div><strong>{money(row.serviceValue,business.currency)}<small>Service value est.</small></strong></article>):<div className="finance-empty">Add team members to start comparing performance.</div>}
  </section>
  <section className="panel performance-details"><div className="performance-section-head"><div><small>INDIVIDUAL RESULTS</small><h2>Team performance</h2><p>Operational and financial metrics for the selected period.</p></div><Users size={21}/></div>
   {report.rows.length?<div className="performance-table-wrap"><table><thead><tr><th>Team member</th><th>Appointments</th><th>Completion</th><th>Collected</th><th>Commission earned</th><th>Commission unpaid</th></tr></thead><tbody>{report.rows.map(row=><tr key={row.employee.id}><td><div className="performance-person"><span className="team-avatar">{row.employee.initials||row.employee.name.slice(0,1)}</span><div><b>{row.employee.name}</b><small>{row.employee.role}</small></div></div></td><td><b>{row.completed}</b><small>{row.cancelled} cancelled</small></td><td><span className="performance-rate">{row.completionRate}%</span></td><td>{money(row.collected,business.currency)}</td><td>{money(row.commissionsEarned,business.currency)}</td><td><b>{money(row.outstanding,business.currency)}</b></td></tr>)}</tbody></table></div>:<div className="finance-empty">No team performance data yet.</div>}
  </section>
  <div className="performance-footnote">Collected amounts use recorded payments linked to each employee’s appointments. Commission outstanding is a lifetime balance; other activity metrics follow the selected date range.</div>
 </div>;
}
