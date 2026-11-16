import {useCallback,useEffect,useState} from "react";
import {Link,Route,Routes,useParams} from "react-router-dom";
import {CalendarDays} from "lucide-react";
import {ClientBooking} from "./ClientBooking";
import type {ClientBookingRequest} from "./ClientBooking";
import {ClientAppointments} from "./ClientAppointments";
import {createMyBookingRequest,createPublicBooking,fetchMyBookings,fetchPublicSalon,getStoredAccess} from "../services/public-api";
import type {MyBookings,PublicSalon} from "../services/public-api";
import type {ClientAppointmentRequest} from "../types";

const Notice=({title,message}:{title:string;message:string})=><div className="loading">{title}<span>{message}</span></div>;
const messageOf=(error:unknown)=>error instanceof Error?error.message:"Something went wrong. Please try again.";

/** Routes that work without a salon account: the public booking page and a client's own bookings. */
export function PublicApp(){
  return <Routes><Route path="/book/:slug" element={<PublicBooking/>}/><Route path="/my-bookings" element={<MyBookingsPage/>}/></Routes>;
}

function PublicBooking(){
  const {slug=""}=useParams();
  const [salon,setSalon]=useState<PublicSalon|null>(null),[error,setError]=useState("");
  const load=useCallback(async()=>{try{setSalon(await fetchPublicSalon(slug));setError("");}catch(err){setError(messageOf(err));}},[slug]);
  useEffect(()=>{setSalon(null);void load();},[load]);
  if(error&&!salon)return <Notice title="Salon not found" message={error}/>;
  if(!salon)return <div className="loading">salon<span>Loading booking page…</span></div>;
  const submit=async(request:ClientBookingRequest)=>{await createPublicBooking(slug,request);void load();};
  return <ClientBooking business={salon.business} services={salon.services} employees={salon.employees} appointments={salon.appointments} onSubmit={submit} publicPage/>;
}

function MyBookingsPage(){
  const access=getStoredAccess();
  const [data,setData]=useState<MyBookings|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(Boolean(access));
  const load=useCallback(async()=>{if(!access)return;try{setData(await fetchMyBookings(access.token));setError("");}catch(err){setError(messageOf(err));}finally{setLoading(false);}},[access?.token]);
  useEffect(()=>{void load();},[load]);
  if(loading)return <div className="loading">salon<span>Loading your bookings…</span></div>;
  if(!access||!data)return <div className="client-booking-success"><span><CalendarDays size={30}/></span><small>YOUR BOOKINGS</small><h1>Book with us to get started.</h1><p>{error||"Bookings you make from this browser will appear here."}</p>{access&&<Link className="client-book-link" to={"/book/"+access.slug}>Browse services &amp; book</Link>}</div>;
  const customer={id:"me",name:data.displayName,phone:"",email:"",visits:0,lastVisit:""};
  const request=async(input:ClientAppointmentRequest)=>{await createMyBookingRequest(access.token,{appointmentId:input.appointmentId,kind:input.kind,requestedStartsAt:input.requestedStartsAt});await load();};
  return <ClientAppointments data={{business:data.business,services:data.services,employees:data.employees,customers:[customer],appointments:data.appointments,clientRequests:data.clientRequests}} clientId="me" onRequest={request}/>;
}
