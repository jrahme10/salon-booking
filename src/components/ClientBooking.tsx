import {useMemo,useState} from "react";
import {Link} from "react-router-dom";
import type {FormEvent} from "react";
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,MapPin,Scissors,Sparkles,Star,UserRound} from "lucide-react";
import type {Appointment,Business,Employee,Service} from "../types";
import {getAvailableSlots,isWithinBusinessHours} from "../domain/scheduling";
import {brandThemeStyle} from "../domain/brand-theme";

const formatMoney=(amount:number,business:Business)=>new Intl.NumberFormat("en-US",{style:"currency",currency:business.currency,maximumFractionDigits:business.currency==="LBP"?0:2}).format(amount);
const steps=["Category","Service","Stylist","Time","Details"];
const dateKey=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,10);
const toLocal=(date:string,time:string)=>{const [year,month,day]=date.split("-").map(Number),[hour,minute]=time.split(":").map(Number);return new Date(year,month-1,day,hour,minute,0,0);};
const clock=(time:string)=>new Date(2000,0,1,Number(time.slice(0,2)),Number(time.slice(3))).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
const initialsOf=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("");

export interface ClientBookingRequest {name:string;phone:string;email:string;serviceId:string;employeeId:string;startsAt:string}

export function ClientBooking({business,services,employees,appointments,onSubmit,publicPage=false,embedded=false}:{business:Business;services:Service[];employees:Employee[];appointments:Appointment[];onSubmit:(request:ClientBookingRequest)=>Promise<void>;publicPage?:boolean;embedded?:boolean}){
 const activeServices=services.filter(s=>s.active);
 const categories=Array.from(new Set(activeServices.map(s=>s.category).filter(Boolean)));
 const stepMinutes=business.bookingRules?.slotIntervalMinutes??30;
 const [step,setStep]=useState(1);
 const [category,setCategory]=useState(activeServices[0]?.category??"");
 const [serviceId,setServiceId]=useState(activeServices[0]?.id??"");
 const [employeeId,setEmployeeId]=useState("any");
 const [date,setDate]=useState(dateKey(new Date())),[selectedSlotKey,setSelectedSlotKey]=useState("");
 const [name,setName]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState("");
 const [error,setError]=useState(""),[saving,setSaving]=useState(false),[success,setSuccess]=useState(false);
 const service=activeServices.find(s=>s.id===serviceId);
 const categoryServices=activeServices.filter(s=>s.category===category);
 const eligible=employees.filter(e=>e.active&&(!e.serviceIds||e.serviceIds.includes(serviceId)));
 const slotsOn=(day:string,forService:Service,people:Employee[])=>people.flatMap(employee=>getAvailableSlots({date:day,service:forService,employee,appointments,services,stepMinutes})
  .filter(slot=>isWithinBusinessHours(business,toLocal(day,slot),forService.durationMinutes))
  .map(slot=>({employeeId:employee.id,time:slot})));
 const slotOptions=service?slotsOn(date,service,eligible):[];
 const visibleSlots=slotOptions.filter(slot=>employeeId==="any"||slot.employeeId===employeeId);
 const selected=visibleSlots.find(slot=>slot.employeeId+"|"+slot.time===selectedSlotKey);
 const chosenEmployee=selected?employees.find(e=>e.id===selected.employeeId):employees.find(e=>e.id===employeeId);
 const dateMin=dateKey(new Date());
 const quickDays=Array.from({length:6},(_,index)=>{const d=new Date();d.setDate(d.getDate()+index);return {key:dateKey(d),dow:d.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase(),num:d.getDate()};});

 // Earliest opening across the next two weeks, shown in the hero.
 const nextAvailable=useMemo(()=>{
  const base=activeServices[0];
  if(!base)return null;
  const people=employees.filter(e=>e.active&&(!e.serviceIds||e.serviceIds.includes(base.id)));
  for(let offset=0;offset<14;offset++){
   const d=new Date();d.setDate(d.getDate()+offset);
   const day=dateKey(d);
   const options=people.flatMap(employee=>getAvailableSlots({date:day,service:base,employee,appointments,services,stepMinutes})
    .filter(slot=>isWithinBusinessHours(business,toLocal(day,slot),base.durationMinutes))
    .map(slot=>({employee,when:toLocal(day,slot)})))
    .sort((a,b)=>a.when.getTime()-b.when.getTime());
   if(options.length)return {...options[0],service:base,offset};
  }
  return null;
 },[business,services,employees,appointments]); // eslint-disable-line react-hooks/exhaustive-deps

 const goTo=(next:number)=>{setError("");setStep(Math.max(1,Math.min(5,next)));};
 const chooseCategory=(value:string)=>{setCategory(value);const first=activeServices.find(s=>s.category===value);if(first)setServiceId(first.id);goTo(2);};
 const chooseService=(value:string)=>{setServiceId(value);setEmployeeId("any");setSelectedSlotKey("");goTo(3);};
 const chooseEmployee=(value:string)=>{setEmployeeId(value);setSelectedSlotKey("");goTo(4);};
 const chooseDate=(value:string)=>{setDate(value);setSelectedSlotKey("");};
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setError("");
  if(business.bookingRules?.allowOnlineBooking===false){setError("Online booking is currently unavailable. Please contact the salon.");return;}
  if(!service||!selected||!chosenEmployee){setError("Choose an available time before continuing.");goTo(4);return;}
  if(!name.trim()||phone.replace(/\D/g,"").length<6){setError("Enter your name and a valid phone number.");return;}
  const startsAt=toLocal(date,selected.time);
  if(startsAt.getTime()<Date.now()-60_000){setError("Choose a future appointment time.");goTo(4);return;}
  setSaving(true);
  try{await onSubmit({name:name.trim(),phone:phone.trim(),email:email.trim(),serviceId:service.id,employeeId:chosenEmployee.id,startsAt:startsAt.toISOString()});setSuccess(true);}
  catch(err){setError(err instanceof Error?err.message:"We couldn't send your request. Please try again.");}
  finally{setSaving(false);}
 };

 const themed={style:brandThemeStyle(business.brandTheme)};
 const brand=business.logoDataUrl
  ?<img src={business.logoDataUrl} alt={business.name+" logo"}/>
  :<><span className="pb-brand-mark" aria-hidden="true"><Scissors size={22}/></span>salon.</>;

 if(success)return <div className="pb" {...themed}><div className="pb-notice"><div className="pb-notice-icon"><CheckCircle2 size={32}/></div><small className="pb-kicker">Request sent</small><h1>You're one step closer to a little time for you.</h1><p>Your request has been sent to {business.name}. The salon will confirm your appointment with you.</p><button type="button" className="pb-btn pb-btn-gold" onClick={()=>{setSuccess(false);setSelectedSlotKey("");setStep(1);}}>Make another request</button>{publicPage&&<Link className="pb-btn pb-btn-ghost" to="/my-bookings">View my bookings</Link>}</div></div>;

 if(business.bookingRules?.allowOnlineBooking===false)return <div className="pb" {...themed}><div className="pb-notice"><div className="pb-notice-icon"><Clock3 size={30}/></div><small className="pb-kicker">Online booking paused</small><h1>We would love to hear from you.</h1><p>{business.name} is not accepting online booking requests right now. Please contact the salon directly to arrange your visit.</p>{business.phone&&<a className="pb-btn pb-btn-gold" href={"tel:"+business.phone}>Call {business.phone}</a>}</div></div>;

 return <div className={"pb"+(embedded?" pb-embedded":"")} {...themed}>
  {!embedded&&<header className="pb-hero">
   <div className="pb-ring pb-ring-a" aria-hidden="true"/><div className="pb-ring pb-ring-b" aria-hidden="true"/>
   <div className="pb-wrap">
    <nav className="pb-nav" aria-label="Salon">
     <span className="pb-brand">{brand}</span>
     <div className="pb-nav-links">
      <span className="pb-nav-city"><MapPin size={15}/>{business.city}</span>
      {publicPage&&<Link to="/my-bookings">My bookings</Link>}
      <a className="pb-pill-link" href="#book">Book now</a>
     </div>
    </nav>
    <div className="pb-hero-grid">
     <div className="pb-hero-copy">
      <span className="pb-overline">{business.category} · {business.address}</span>
      <h1>{business.name}</h1>
      {business.description&&<p className="pb-hero-lead">{business.description}</p>}
      <div className="pb-hero-actions">
       <a className="pb-btn pb-btn-gold" href="#book">Reserve your time</a>
       <span className="pb-rating"><span aria-hidden="true">{[0,1,2,3,4].map(i=><Star key={i} size={16} fill="currentColor"/>)}</span>A little time, just for you</span>
      </div>
     </div>
     {nextAvailable&&<div className="pb-glass">
      <small>NEXT AVAILABLE</small>
      <strong>{nextAvailable.offset===0?"Today":nextAvailable.offset===1?"Tomorrow":nextAvailable.when.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}, {clock(nextAvailable.when.toTimeString().slice(0,5))}</strong>
      <p>{nextAvailable.service.name}</p>
      <hr/>
      <div className="pb-person"><span className="pb-avatar">{initialsOf(nextAvailable.employee.name)}</span><span><b>{nextAvailable.employee.name}</b>{nextAvailable.employee.role}</span></div>
     </div>}
    </div>
   </div>
  </header>}

  <main id={embedded?undefined:"book"} className="pb-wrap pb-main">
   <section className="pb-card">
    <ol className="pb-steps" aria-label="Booking progress">{steps.map((label,index)=><li key={label}><button type="button" className={"pb-step"+(step===index+1?" active":"")+(step>index+1?" done":"")} disabled={index+1>=step} onClick={()=>goTo(index+1)} aria-current={step===index+1?"step":undefined}><i>{step>index+1?<Check size={14}/>:index+1}</i>{label}</button></li>)}</ol>
    <div className="pb-layout">
     <form className="pb-form" onSubmit={submit}>
      {step===1&&<section><span className="pb-kicker">Step 01</span><h2>Choose a category</h2><p className="pb-sub">Start with the kind of appointment you have in mind.</p>
       <div className="pb-grid" style={{marginTop:22}}>{categories.map(value=><button type="button" key={value} className={"pb-choice"+(category===value?" selected":"")} onClick={()=>chooseCategory(value)}><span className="pb-choice-icon"><Scissors size={20}/></span><b>{value}</b><small>{activeServices.filter(s=>s.category===value).length} services</small></button>)}</div>
       {categories.length===0&&<p className="pb-empty">No services are available yet.</p>}</section>}
      {step===2&&<section><span className="pb-kicker">Step 02</span><h2>Choose your treatment</h2><p className="pb-sub">Select the service that suits you best.</p>
       {categories.length>1&&<div className="pb-pills" style={{margin:"22px 0 6px"}}>{categories.map(value=><button type="button" key={value} className={"pb-pill"+(category===value?" on":"")} onClick={()=>setCategory(value)}>{value}</button>)}</div>}
       <div className="pb-grid" style={{marginTop:18}}>{categoryServices.map(item=><button type="button" key={item.id} className={"pb-choice"+(serviceId===item.id?" selected":"")} onClick={()=>chooseService(item.id)}>{serviceId===item.id&&<span className="pb-check"><Check size={14}/></span>}<small>{item.category} · {item.durationMinutes} min</small><b>{item.name}</b><strong>{formatMoney(item.price,business)}</strong></button>)}</div></section>}
      {step===3&&<section><span className="pb-kicker">Step 03</span><h2>Choose your stylist</h2><p className="pb-sub">Pick a team member or let us find the first available match.</p>
       <div className="pb-grid pb-grid-3" style={{marginTop:22}}>
        <button type="button" className={"pb-choice pb-person-card"+(employeeId==="any"?" selected":"")} onClick={()=>chooseEmployee("any")}><span className="pb-avatar" style={{background:"transparent",border:"1.5px dashed var(--pb-accent)",color:"var(--pb-primary)"}}><Sparkles size={22}/></span><b>Any available</b><small>First available team member</small></button>
        {eligible.map(person=><button type="button" key={person.id} className={"pb-choice pb-person-card"+(employeeId===person.id?" selected":"")} onClick={()=>chooseEmployee(person.id)}><span className="pb-avatar">{initialsOf(person.name)||<UserRound size={20}/>}</span><b>{person.name}</b><small>{person.role||"Stylist"}</small></button>)}
       </div>
       {eligible.length===0&&<p className="pb-empty" style={{marginTop:16}}>No team members are currently available for this service.</p>}</section>}
      {step===4&&<section><span className="pb-kicker">Step 04</span><h2>Choose a date &amp; time</h2><p className="pb-sub">Available appointment times are updated for your selection.</p>
       <div className="pb-days" style={{margin:"22px 0 14px"}}>{quickDays.map(day=><button type="button" key={day.key} className={"pb-day"+(date===day.key?" on":"")} onClick={()=>chooseDate(day.key)}><small>{day.dow}</small><b>{day.num}</b></button>)}</div>
       <label className="pb-field" style={{maxWidth:260,marginBottom:24}}>Or pick another date<input type="date" min={dateMin} value={date} onChange={e=>chooseDate(e.target.value)} required/></label>
       <div className="pb-time-head" style={{marginBottom:12}}><b>Available times</b><small>{visibleSlots.length} available</small></div>
       <div className="pb-slots">{visibleSlots.map(slot=><button type="button" key={slot.employeeId+slot.time} className={"pb-slot"+(selectedSlotKey===slot.employeeId+"|"+slot.time?" selected":"")} onClick={()=>setSelectedSlotKey(slot.employeeId+"|"+slot.time)}>{clock(slot.time)}{employeeId==="any"&&<small>{employees.find(e=>e.id===slot.employeeId)?.name}</small>}</button>)}</div>
       {visibleSlots.length===0&&<p className="pb-empty">No available times for this selection. Try another date or team member.</p>}</section>}
      {step===5&&<section><span className="pb-kicker">Step 05</span><h2>Your details</h2><p className="pb-sub">Just a few details so the salon can confirm your appointment.</p>
       <div className="pb-contact" style={{marginTop:22}}>
        <label className="pb-field">Full name<input autoComplete="name" required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>
        <label className="pb-field">Phone number<input autoComplete="tel" type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+961 …"/></label>
        <label className="pb-field">Email (optional)<input autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
       </div></section>}
      {error&&<p className="pb-error" role="alert">{error}</p>}
      <div className="pb-actions">
       {step>1?<button type="button" className="pb-btn pb-btn-ghost" onClick={()=>goTo(step-1)}><ArrowLeft size={16}/> Back</button>:<span/>}
       {step<5
        ?<button type="button" className="pb-btn pb-btn-gold" disabled={step===4&&!selected} onClick={()=>goTo(step+1)}>Continue <ArrowRight size={16}/></button>
        :<button className="pb-btn pb-btn-gold" disabled={saving||!name.trim()||phone.replace(/\D/g,"").length<6}>{saving?"Sending request…":"Request appointment"}</button>}
      </div>
      {step===5&&<p className="pb-fine">No payment is required now. Your appointment remains pending until the salon confirms it.</p>}
     </form>

     <aside className="pb-aside" aria-label="Your visit">
      <div className="pb-summary">
       <small>YOUR VISIT</small>
       <h3>{service?.name??"Choose a service"}</h3>
       <p>{chosenEmployee?chosenEmployee.name:employeeId==="any"?"Any available team member":"Team member"}{service?` · ${service.durationMinutes} min`:""}</p>
       <hr/>
       <div className="pb-summary-row"><span>{selected?toLocal(date,selected.time).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}):"Date & time"}</span><span>{selected?clock(selected.time):"Not chosen"}</span></div>
       <div className="pb-summary-total"><span>Total</span><b>{formatMoney(service?.price??0,business)}</b></div>
       <p className="pb-summary-note">No payment now. The salon confirms your appointment.</p>
      </div>
     </aside>
    </div>
   </section>
  </main>
  {!embedded&&<footer className="pb-footer"><b>salon.</b>Made for good days and great appointments.{business.phone&&<> · {business.phone}</>}{business.email&&<> · {business.email}</>}</footer>}
 </div>;
}
