import type {Appointment,Business,ClientAppointmentRequest,Employee,Service} from "../types";
import {API_URL} from "./auth";

/** Unauthenticated client for the Worker's /public/* routes (salon booking page and "my bookings"). */
export interface PublicSalon {business:Business;services:Service[];employees:Employee[];appointments:Appointment[]}
export interface MyBookings extends PublicSalon {displayName:string;clientRequests:ClientAppointmentRequest[]}
export interface PublicBookingInput {name:string;phone:string;email:string;serviceId:string;employeeId:string;startsAt:string}

const STORAGE_KEY="salon-booking-access-v1";
export interface StoredAccess {token:string;slug:string}
export function getStoredAccess():StoredAccess|null{
  try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return null;const value=JSON.parse(raw) as Partial<StoredAccess>;return typeof value.token==="string"&&typeof value.slug==="string"?{token:value.token,slug:value.slug}:null;}catch{return null;}
}
function storeAccess(access:StoredAccess){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(access));}catch{/* storage unavailable: bookings still succeed */}}

async function publicRequest<T>(path:string,init:{method?:string;body?:unknown}={}):Promise<T>{
  let response:Response;
  try{
    response=await fetch(API_URL+path,{method:init.method??"GET",...(init.body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(init.body)})});
  }catch{throw new Error("We couldn't reach the salon. Check your connection and try again.");}
  const data=await response.json().catch(()=>({error:"The server returned an invalid response."})) as T&{error?:string};
  if(!response.ok)throw new Error(data.error||"The request could not be completed.");
  return data;
}

export const fetchPublicSalon=(slug:string)=>publicRequest<PublicSalon>("/public/salons/"+encodeURIComponent(slug));

export async function createPublicBooking(slug:string,input:PublicBookingInput){
  const existing=getStoredAccess();
  const result=await publicRequest<{accessToken:string}>("/public/salons/"+encodeURIComponent(slug)+"/bookings",{method:"POST",body:{...input,...(existing?.slug===slug?{accessToken:existing.token}:{})}});
  storeAccess({token:result.accessToken,slug});
}

export const fetchMyBookings=(token:string)=>publicRequest<MyBookings>("/public/my-bookings",{method:"POST",body:{accessToken:token}});

export const createMyBookingRequest=(token:string,input:{appointmentId:string;kind:ClientAppointmentRequest["kind"];requestedStartsAt?:string})=>
  publicRequest<{request:ClientAppointmentRequest}>("/public/my-bookings/requests",{method:"POST",body:{accessToken:token,...input}});
