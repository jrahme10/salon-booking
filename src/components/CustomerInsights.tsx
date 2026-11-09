import {useMemo,useState} from "react";
import {ArrowUpRight,CalendarClock,Heart,History,Repeat2,Search,Users,Wallet} from "lucide-react";
import type {Business,Customer,Employee,Payment,Service} from "../types";
import {buildCustomerBookingHistory,buildCustomerInsights,type CustomerInsightPeriod} from "../domain/customer-insights";
type Props={business:Business;customers:Customer[];appointments:Appointment[];payments:Payment[];services:Service[];employees:Employee[]};
const money=(value:number,currency:Business["currency"])=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:currency==="LBP"?0:2}).format(value);
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"No completed visits";
export function CustomerInsights({business,customers,appointments,payments,services,employees}:Props){
 const [period,setPeriod]=useState<CustomerInsightPeriod>("90"),[query,setQuery]=useState(""),[selectedId,setSelectedId]=useState<string|null>(null);
 const report=useMemo(()=>buildCustomerInsights({customers,appointments,payments,period}),[customers,appointments,payments,period]);
 const selected=report.rows.find(row=>row.customer.id===selectedId)??null;
 const history=useMemo(()=>selected?buildCustomerBookingHistory({customerId:selected.customer.id,appointments,services,employees,payments}):[],[selected,appointments,services,employees,payments]);
 const filtered=report.rows.filter(row=>(row.customer.name+" "+row.customer.phone+" "+row.customer.email).toLowerCase().includes(query.toLowerCase()));
 const loyal=report.loyalCustomers;
 return <div className="customer-insights">
  <div className="heading"><div><small>BUSINESS MANAGEMENT</small><h1>Customer insights</h1><p>Understand loyalty, spending habits and the clients who may need a reason to return.</p></div></div>
  <div className="customer-period" role="group" aria-label="Customer reporting period">{(["30","90","all"] as CustomerInsightPeriod[]).map(value=><button key={value} className={period===value?"active":""} onClick={()=>setPeriod(value)}>{value==="all"?"All time":value+" days"}</button>)}</div>
  <section className="customer-kpis">
   <article><span><Users size={18}/></span><small>Active customers</small><b>{report.totalActiveCustomers}</b><em>With a completed visit in this period</em></article>
   <article><span><Repeat2 size={18}/></span><small>Repeat-visit rate</small><b>{report.repeatVisitRate}%</b><em>Customers with 2+ visits in this period</em></article>
   <article><span><Wallet size={18}/></span><small>Average customer spend</small><b>{money(report.averageCustomerSpend,business.currency)}</b><em>Actual recorded payments per paying client</em></article>
   <article><span><Heart size={18}/></span><small>New vs returning</small><b>{report.newCustomers} / {report.returningCustomers}</b><em>New clients / clients seen before</em></article>
  </section>
  <section className="customer-insight-grid">
   <article className="panel customer-highlight-panel"><div className="customer-section-heading"><div><small>YOUR REGULARS</small><h2>Most loyal customers</h2><p>Ranked by completed visits over their full history.</p></div><Heart size={18}/></div>
    {loyal.length?loyal.map((row,index)=><button className="customer-rank-row" key={row.customer.id} onClick={()=>setSelectedId(row.customer.id)}><span className="customer-rank">{String(index+1).padStart(2,"0")}</span><span className="customer-avatar">{row.customer.name.trim().slice(0,1).toUpperCase()}</span><span className="customer-rank-name"><b>{row.customer.name}</b><small>{row.customer.phone}</small></span><strong>{row.lifetimeVisits}<small>visits</small></strong></button>):<div className="customer-empty">Completed appointments will reveal your most loyal clients.</div>}
   </article>
   <article className="panel customer-at-risk-panel"><div className="customer-section-heading"><div><small>RECONNECT</small><h2>Haven’t returned recently</h2><p>No completed visit in the last 60 days and no upcoming booking.</p></div><CalendarClock size={18}/></div>
    {report.inactiveCustomers.length?report.inactiveCustomers.slice(0,6).map(row=><button className="customer-risk-row" key={row.customer.id} onClick={()=>setSelectedId(row.customer.id)}><span className="customer-avatar muted">{row.customer.name.trim().slice(0,1).toUpperCase()}</span><span><b>{row.customer.name}</b><small>Last visit {dateLabel(row.lastVisit)}</small></span><ArrowUpRight size={15}/></button>):<div className="customer-empty">No lapsed customers right now. Your client relationships are looking healthy.</div>}
   </article>
  </section>
  <section className="panel customer-directory">
   <div className="customer-directory-head"><div><small>CLIENT RELATIONSHIPS</small><h2>All customers</h2><p>{report.newCustomers} new · {report.returningCustomers} returning in selected period · {money(report.collectedRevenue,business.currency)} collected</p></div><div className="customer-search"><Search size={15}/><input aria-label="Search customers" placeholder="Search name, phone or email" value={query} onChange={event=>setQuery(event.target.value)}/></div></div>
   <div className="customer-table-wrap"><table><thead><tr><th>CUSTOMER</th><th>VISITS</th><th>LAST VISIT</th><th>SPEND · PERIOD</th><th>RELATIONSHIP</th></tr></thead><tbody>{filtered.map(row=><tr key={row.customer.id} className={selectedId===row.customer.id?"selected":""} onClick={()=>setSelectedId(row.customer.id)}><td><b>{row.customer.name}</b><small>{row.customer.phone}{row.customer.email?" · "+row.customer.email:""}</small></td><td>{row.lifetimeVisits}</td><td>{dateLabel(row.lastVisit)}</td><td>{money(row.periodSpend,business.currency)}</td><td><span className={"customer-tag "+(row.isReturning?"returning":row.isNew?"new":"")}>{row.isReturning?"Returning":row.isNew?"New":"Existing"}</span></td></tr>)}</tbody></table>{filtered.length===0&&<div className="customer-empty">No customers match your search.</div>}</div>
  </section>
  {selected&&<section className="panel customer-history-panel" aria-label={"Booking history for "+selected.customer.name}>
   <div className="customer-history-head"><div><small>CLIENT PROFILE</small><h2>{selected.customer.name}</h2><p>{selected.customer.phone}{selected.customer.email?" · "+selected.customer.email:""}</p></div><button className="secondary" onClick={()=>setSelectedId(null)}>Close history</button></div>
   <div className="customer-profile-stats"><div><small>Lifetime visits</small><b>{selected.lifetimeVisits}</b></div><div><small>Lifetime collected</small><b>{money(selected.lifetimeSpend,business.currency)}</b></div><div><small>Upcoming bookings</small><b>{selected.upcomingBookings}</b></div><div><small>Last visit</small><b>{dateLabel(selected.lastVisit)}</b></div></div>
   <div className="customer-history-title"><History size={16}/><b>Booking history</b><span>{history.length} appointments</span></div>
   {history.length?history.map(row=><article className="customer-history-row" key={row.appointment.id}><div className="customer-history-date"><b>{new Date(row.appointment.startsAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</b><small>{new Date(row.appointment.startsAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</small></div><div className="customer-history-service"><b>{row.service?.name??"Service"}</b><small>{row.employee?.name??"Team member"} · {row.appointment.id}</small></div><span className={"status "+row.appointment.status}>{row.appointment.status}</span><strong>{money(row.collected,business.currency)}<small>collected</small></strong></article>):<div className="customer-empty">No booking history yet.</div>}
  </section>}
  <p className="customer-report-note">Visit counts use completed appointments. Spend and collected revenue use actual payment ledger records, not service list prices or the legacy paid amount field. “Haven’t returned recently” uses a fixed 60-day inactivity threshold and excludes customers with a future confirmed or pending booking. Customer metrics remain based on local demo data until shared backend storage is connected.</p>
 </div>;
}
