import type { Booking, BookingStatus, Service, TeamMember } from "../domain/types";
import { bookings as seedBookings, services as seedServices, team as seedTeam } from "./demo";
const KEY="salon-reservation-demo-v1";
interface DemoState { bookings:Booking[]; services:Service[]; team:TeamMember[] }
const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const initial=():DemoState=>({bookings:clone(seedBookings),services:clone(seedServices),team:clone(seedTeam)});
export interface SalonRepository { getBookings():Promise<Booking[]>; getServices():Promise<Service[]>; getTeam():Promise<TeamMember[]>; updateBookingStatus(id:string,status:BookingStatus):Promise<void>; }
class LocalDemoRepository implements SalonRepository { private state:DemoState; constructor(){try{this.state=JSON.parse(localStorage.getItem(KEY)||"null")||initial()}catch{this.state=initial()}} private persist(){localStorage.setItem(KEY,JSON.stringify(this.state))} async getBookings(){return clone(this.state.bookings)} async getServices(){return clone(this.state.services)} async getTeam(){return clone(this.state.team)} async updateBookingStatus(id:string,status:BookingStatus){this.state.bookings=this.state.bookings.map(b=>b.id===id?{...b,status}:b);this.persist()} }
// Replace this adapter with Supabase later; UI pages remain provider-agnostic.
export const salonRepository:SalonRepository=new LocalDemoRepository();