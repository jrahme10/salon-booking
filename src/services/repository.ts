import * as demo from "../data/mock";
import type {Appointment,Business,Customer,Employee,Service} from "../types";

export interface SalonRepository {
  getBusiness():Promise<Business>;
  getServices():Promise<Service[]>;
  getEmployees():Promise<Employee[]>;
  getCustomers():Promise<Customer[]>;
  getAppointments():Promise<Appointment[]>;
  updateAppointmentStatus(id:string,status:Appointment["status"]):Promise<void>;
  createAppointment(appointment:Appointment):Promise<void>;
}
type StoredState={appointments:Appointment[];services:Service[];employees:Employee[];customers:Customer[]};
const STORAGE_KEY="salon-reservation-demo-v1";
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const seed=():StoredState=>({appointments:copy(demo.appointments),services:copy(demo.services),employees:copy(demo.employees),customers:copy(demo.customers)});

class DemoRepository implements SalonRepository {
  private state:StoredState;
  constructor(){
    try {
      const saved=localStorage.getItem(STORAGE_KEY);
      this.state=saved?{...seed(),...JSON.parse(saved) as Partial<StoredState>}:seed();
    } catch { this.state=seed(); }
  }
  private persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state));}catch(error){console.warn("Could not persist salon demo data",error);}}
  async getBusiness(){return copy(demo.business);}
  async getServices(){return copy(this.state.services);}
  async getEmployees(){return copy(this.state.employees);}
  async getCustomers(){return copy(this.state.customers);}
  async getAppointments(){return copy(this.state.appointments);}
  async updateAppointmentStatus(id:string,status:Appointment["status"]){
    this.state.appointments=this.state.appointments.map(row=>row.id===id?{...row,status}:row);
    this.persist();
  }
  async createAppointment(appointment:Appointment){
    if(this.state.appointments.some(row=>row.id===appointment.id)) throw new Error("Appointment already exists.");
    this.state.appointments=[...this.state.appointments,copy(appointment)].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
    this.persist();
  }
}

/** Pages depend on this contract, not on a database SDK. Replace with Supabase adapter when project access is ready. */
export const salonRepository:SalonRepository=new DemoRepository();