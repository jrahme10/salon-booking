import {useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {CalendarDays,Clock3,MapPin,RotateCcw,Scissors,XCircle} from "lucide-react";
import type {Appointment,Business,ClientAppointmentRequest,Customer,Employee,Service} from "../types";
import {getAvailableSlots,isWithinBusinessHours} from "../domain/scheduling";
import {brandThemeStyle} from "../domain/brand-theme";

type ClientData={business:Business;services:Service[];employees:Employee[];customers:Customer[];appointments:Appointment[];clientRequests:ClientAppointmentRequest[]};

export function ClientAppointments({data,clientId,onRequest}:{data:ClientData;clientId:string;onRequest:(request:ClientAppointmentRequest)=>Promise<void>}){
 const [editingId,setEditingId]=useState(""),[date,setDate]=useState(localToday()),[time,setTime]=useState(""),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const themed={style:brandThemeStyle(data.business.brandTheme)};
 const customer=data.customers.find(row=>row.id===clientId);
 const appointments=useMemo(()=>data.appointments.filter(row=>row.customerId===clientId).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)),[data.appointments,clientId]);
 const pendingFor=(id:string)=>data.clientRequests.find(row=>row.appointmentId===id&&row.status==="pending");

 const slotsFor=(appointment:Appointment)=>{
  const service=data.services.find(row=>row.id===appointment.serviceId),employee=data.employees.find(row=>row.id===appointment.employeeId);
  if(!service||!employee)return [];
  return getAvailableSlots({date,service,employee,appointments:data.appointments.filter(row=>row.id!==appointment.id),services:data.services,stepMinutes:data.business.bookingRules?.slotIntervalMinutes??30})
   .filter(slot=>{const [year,month,day]=date.split("-").map(Number),[hour,minute]=slot.split(":").map(Number);return isWithinBusinessHours(data.business,new Date(year,month-1,day,hour,minute),service.durationMinutes);});
 };

 const send=async(appointment:Appointment,kind:ClientAppointmentRequest["kind"])=>{
  setError("");
  if(kind==="reschedule"&&!time){setError("Choose an available time first.");return;}
  setSaving(true);
  try{
   await onRequest({id:"CR-"+Date.now(),businessId:appointment.businessId,appointmentId:appointment.id,customerId:appointment.customerId,kind,status:"pending",requestedStartsAt:kind==="reschedule"?new Date(date+"T"+time+":00").toISOString():undefined,createdAt:new Date().toISOString()});
   setEditingId("");setTime("");
  }catch(err){setError(err instanceof Error?err.message:"Your request could not be sent.");}
  finally{setSaving(false);}
 };

 if(!customer)return <div className="pb" {...themed}><div className="pb-notice"><div className="pb-notice-icon"><CalendarDays size={30}/></div><small className="pb-kicker">Your bookings</small><h1>Book with us to get started.</h1><p>Bookings you make from this browser will appear here after you submit an appointment request.</p><Link className="pb-btn pb-btn-gold" to={"/book/"+data.business.slug}>Browse services &amp; book</Link></div></div>;

 return <div className="pb" {...themed}>
  <header className="pb-hero pb-hero-slim">
   <div className="pb-ring pb-ring-a" aria-hidden="true"/><div className="pb-ring pb-ring-b" aria-hidden="true"/>
   <div className="pb-wrap">
    <nav className="pb-nav" aria-label="Salon">
     <span className="pb-brand">{data.business.logoDataUrl?<img src={data.business.logoDataUrl} alt={data.business.name+" logo"}/>:<><span className="pb-brand-mark" aria-hidden="true"><Scissors size={22}/></span>salon.</>}</span>
     <div className="pb-nav-links"><span className="pb-nav-city"><MapPin size={15}/>{data.business.city}</span><Link className="pb-pill-link" to={"/book/"+data.business.slug}>Book another visit</Link></div>
    </nav>
    <div className="pb-hero-copy" style={{paddingTop:24}}>
     <span className="pb-overline">Your personal space</span>
     <h1>My appointments</h1>
     <p className="pb-hero-lead">Keep track of your visits at {data.business.name}.</p>
    </div>
   </div>
  </header>

  <main className="pb-wrap pb-main">
   <section className="pb-card">
    <div className="pb-time-head" style={{marginBottom:24,flexWrap:"wrap"}}>
     <div><span className="pb-kicker">Welcome back</span><h2 style={{margin:"8px 0 6px",font:"500 clamp(26px,4vw,34px)/1.15 'Lora',Georgia,serif"}}>{customer.name}</h2><p className="pb-sub">Review upcoming visits and send a request if your plans change.</p></div>
     <small>{appointments.length} {appointments.length===1?"booking":"bookings"}</small>
    </div>
    {appointments.length===0
     ?<div className="pb-empty"><b style={{display:"block"}}>No appointments yet</b>Your upcoming appointments will appear here.</div>
     :<div className="pb-list">{appointments.map(appointment=>{
      const service=data.services.find(row=>row.id===appointment.serviceId),employee=data.employees.find(row=>row.id===appointment.employeeId),request=pendingFor(appointment.id);
      const latest=[...data.clientRequests].filter(row=>row.appointmentId===appointment.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
      const canChange=(appointment.status==="pending"||appointment.status==="confirmed")&&new Date(appointment.startsAt).getTime()>Date.now();
      const canCancel=canChange&&new Date(appointment.startsAt).getTime()>=Date.now()+(data.business.bookingRules?.cancellationNoticeHours??0)*3_600_000;
      const slots=slotsFor(appointment);
      return <article className="pb-appt" key={appointment.id}>
       <div className="pb-appt-top"><span className={"pb-status "+appointment.status}>{appointment.status}</span></div>
       <h3>{service?.name??"Appointment"}</h3>
       <p className="pb-appt-meta">{employee?.name??"Team member"} · {service?.durationMinutes??0} min</p>
       <div className="pb-appt-when"><span><CalendarDays size={17}/><b>{new Date(appointment.startsAt).toLocaleString("en-US",{weekday:"long",month:"short",day:"numeric"})}</b></span><span><Clock3 size={15}/>{new Date(appointment.startsAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span></div>
       {latest&&<div className="pb-req"><span style={{textTransform:"capitalize"}}>{latest.kind==="cancellation"?"Cancellation":"Reschedule"} request · {latest.status}</span>{latest.kind==="reschedule"&&latest.requestedStartsAt&&<small>Requested: {new Date(latest.requestedStartsAt).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</small>}</div>}
       {request
        ?<p className="pb-fine" style={{marginTop:14}}>Your request is waiting for the salon to review it.</p>
        :canChange&&<div className="pb-appt-actions">
          <button type="button" className="pb-btn pb-btn-ghost" onClick={()=>{setError("");setEditingId(editingId===appointment.id?"":appointment.id);setDate(localToday());setTime("");}}><RotateCcw size={15}/> Request new time</button>
          {canCancel&&<button type="button" className="pb-btn pb-btn-ghost" disabled={saving} onClick={()=>void send(appointment,"cancellation")}><XCircle size={15}/> Request cancellation</button>}
         </div>}
       {editingId===appointment.id&&!request&&<div className="pb-resched">
        <label className="pb-field" style={{maxWidth:260}}>New date<input type="date" min={localToday()} value={date} onChange={event=>{setDate(event.target.value);setTime("");}}/></label>
        <div className="pb-slots">{slots.map(slot=><button type="button" key={slot} className={"pb-slot"+(time===slot?" selected":"")} onClick={()=>setTime(slot)}>{formatTime(slot)}</button>)}</div>
        {slots.length===0&&<p className="pb-fine">No available times on this date. Try another day.</p>}
        <button type="button" className="pb-btn pb-btn-gold" style={{justifySelf:"start"}} disabled={!time||saving} onClick={()=>void send(appointment,"reschedule")}>{saving?"Sending…":"Send reschedule request"}</button>
       </div>}
       {canChange&&!canCancel&&<p className="pb-fine" style={{marginTop:14}}>The online cancellation notice period has passed. Please contact the salon.</p>}
       {!canChange&&<p className="pb-fine" style={{marginTop:14}}>This appointment can no longer be changed online.</p>}
      </article>;
     })}</div>}
    {error&&<p className="pb-error" role="alert" style={{marginTop:18}}>{error}</p>}
    <p className="pb-fine" style={{marginTop:24}}>Changes are requests, not automatic updates. The salon must approve them before your appointment changes. Your bookings are linked to this browser, so use the same browser to see them again.</p>
   </section>
  </main>
  <footer className="pb-footer"><b>salon.</b>Made for good days and great appointments.</footer>
 </div>;
}

function localToday(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60_000).toISOString().slice(0,10);}
function formatTime(value:string){return new Date(2000,0,1,Number(value.slice(0,2)),Number(value.slice(3))).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});}
