import * as demo from "../data/mock";
import {DEFAULT_WORKING_HOURS,validateBooking} from "../domain/scheduling";
import type {Appointment,Business,Customer,Employee,Service} from "../types";

export interface SalonRepository {
  getBusiness():Promise<Business>;
  getServices():Promise<Service[]>;
  getEmployees():Promise<Employee[]>;
  getCustomers():Promise<Customer[]>;
  getAppointments():Promise<Appointment[]>;
  updateAppointmentStatus(id:string,status:Appointment["status"]):Promise<void>;
  createAppointment(appointment:Appointment):Promise<void>;
  createCustomer(customer:Customer):Promise<Customer>;
  createService(service:Service):Promise<void>;
  updateService(service:Service):Promise<void>;
  deleteService(id:string):Promise<void>;
  createEmployee(employee:Employee):Promise<void>;
  updateEmployee(employee:Employee):Promise<void>;
  deleteEmployee(id:string):Promise<void>;
}
type StoredState={appointments:Appointment[];services:Service[];employees:Employee[];customers:Customer[]};
const STORAGE_KEY="salon-reservation-demo-v1";
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const seed=():StoredState=>({appointments:copy(demo.appointments),services:copy(demo.services),employees:copy(demo.employees),customers:copy(demo.customers)});

class DemoRepository implements SalonRepository {
  private state:StoredState;
  constructor(){
    try {
      const saved=typeof localStorage!=="undefined"?localStorage.getItem(STORAGE_KEY):null;
      const parsed=saved?JSON.parse(saved) as Partial<StoredState>:{};
      const defaults=seed();
      const savedEmployees=Array.isArray(parsed.employees)?parsed.employees.map(employee=>{const fallback=defaults.employees.find(row=>row.id===employee.id);return {...fallback,...employee,serviceIds:employee.serviceIds??fallback?.serviceIds??[],workingHours:employee.workingHours??fallback?.workingHours??DEFAULT_WORKING_HOURS,timeOff:employee.timeOff??[]};}):defaults.employees;
      this.state={appointments:Array.isArray(parsed.appointments)?parsed.appointments:defaults.appointments,services:Array.isArray(parsed.services)?parsed.services:defaults.services,employees:savedEmployees,customers:Array.isArray(parsed.customers)?parsed.customers:defaults.customers};
    } catch { this.state=seed(); }
  }
  private persist(){
    try { if(typeof localStorage!=="undefined") localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state)); }
    catch { throw new Error("Your browser could not save the changes. Check available storage and try again."); }
  }
  private commit(next:StoredState){const previous=this.state;this.state=next;try{this.persist();}catch(error){this.state=previous;throw error;}}
  async getBusiness(){return copy(demo.business);}
  async getServices(){return copy(this.state.services);}
  async getEmployees(){return copy(this.state.employees);}
  async getCustomers(){return copy(this.state.customers);}
  async getAppointments(){return copy(this.state.appointments);}
  async updateAppointmentStatus(id:string,status:Appointment["status"]){
    const current=this.state.appointments.find(row=>row.id===id);
    if(!current) throw new Error("Appointment was not found.");
    const allowed:Record<Appointment["status"],Appointment["status"][]>={pending:["confirmed","cancelled"],confirmed:["completed","cancelled"],completed:[],cancelled:[]};
    if(!allowed[current.status].includes(status)) throw new Error("This appointment status cannot be changed in that way.");
    this.commit({...this.state,appointments:this.state.appointments.map(row=>row.id===id?{...row,status}:row)});
  }
  async createAppointment(appointment:Appointment){
    if(this.state.appointments.some(row=>row.id===appointment.id)) throw new Error("Appointment already exists.");
    const service=this.state.services.find(row=>row.id===appointment.serviceId);
    const employee=this.state.employees.find(row=>row.id===appointment.employeeId);
    const customer=this.state.customers.find(row=>row.id===appointment.customerId);
    if(!service||!employee||!customer) throw new Error("Choose an existing customer, service and team member.");
    if(customer.businessId&&customer.businessId!==appointment.businessId) throw new Error("The selected customer belongs to another business.");
    if(appointment.status!=="pending"&&appointment.status!=="confirmed") throw new Error("New appointments must be pending or confirmed.");
    if(appointment.businessId!==demo.business.id) throw new Error("Invalid business for this appointment.");
    const reason=validateBooking({service,employee,startsAt:new Date(appointment.startsAt),appointments:this.state.appointments,services:this.state.services});
    if(reason) throw new Error(reason);
    this.commit({...this.state,appointments:[...this.state.appointments,copy(appointment)].sort((a,b)=>a.startsAt.localeCompare(b.startsAt))});
  }
  async createCustomer(customer:Customer):Promise<Customer>{
    const phone=customer.phone.replace(/\D/g,"");
    const existing=this.state.customers.find(row=>row.phone.replace(/\D/g,"")===phone&&phone.length>=6);
    if(existing) return copy(existing);
    if(!customer.name.trim()||phone.length<6) throw new Error("Enter a name and a valid phone number.");
    this.commit({...this.state,customers:[...this.state.customers,{...copy(customer),phone:customer.phone.trim()}]});
    return copy(customer);
  }
  async createService(service:Service){
    this.assertService(service);
    if(this.state.services.some(row=>row.id===service.id)) throw new Error("Service already exists.");
    this.commit({...this.state,services:[...this.state.services,copy(service)]});
  }
  async updateService(service:Service){
    this.assertService(service);
    if(!this.state.services.some(row=>row.id===service.id)) throw new Error("Service was not found.");
    const nextServices=this.state.services.map(row=>row.id===service.id?copy(service):row);if(service.durationMinutes!==this.state.services.find(row=>row.id===service.id)?.durationMinutes){for(const appointment of this.state.appointments.filter(row=>row.serviceId===service.id&&(row.status==="pending"||row.status==="confirmed")&&new Date(row.startsAt).getTime()>Date.now())){const employee=this.state.employees.find(row=>row.id===appointment.employeeId);if(employee){const reason=validateBooking({service:{...service,active:true},employee,startsAt:new Date(appointment.startsAt),appointments:this.state.appointments,services:nextServices,excludeAppointmentId:appointment.id});if(reason)throw new Error("This duration change conflicts with an existing booking: "+reason);}}}this.commit({...this.state,services:nextServices});
  }
  async deleteService(id:string){
    if(this.state.appointments.some(row=>row.serviceId===id&&row.status!=="cancelled")) throw new Error("This service is linked to appointments. Deactivate it instead.");
    this.commit({...this.state,services:this.state.services.filter(row=>row.id!==id),employees:this.state.employees.map(row=>({...row,serviceIds:row.serviceIds?.filter(serviceId=>serviceId!==id)}))});
  }
  async createEmployee(employee:Employee){
    this.assertEmployee(employee);
    if(this.state.employees.some(row=>row.id===employee.id)) throw new Error("Team member already exists.");
    this.commit({...this.state,employees:[...this.state.employees,copy(employee)]});
  }
  async updateEmployee(employee:Employee){
    this.assertEmployee(employee);
    if(!this.state.employees.some(row=>row.id===employee.id)) throw new Error("Team member was not found.");
    for(const appointment of this.state.appointments.filter(row=>row.employeeId===employee.id&&(row.status==="pending"||row.status==="confirmed")&&new Date(row.startsAt).getTime()>Date.now())){const service=this.state.services.find(row=>row.id===appointment.serviceId);if(service){const reason=validateBooking({service:{...service,active:true},employee,startsAt:new Date(appointment.startsAt),appointments:this.state.appointments,services:this.state.services,excludeAppointmentId:appointment.id});if(reason)throw new Error("This change conflicts with an existing booking: "+reason);}}this.commit({...this.state,employees:this.state.employees.map(row=>row.id===employee.id?copy(employee):row)});
  }
  async deleteEmployee(id:string){
    if(this.state.appointments.some(row=>row.employeeId===id&&row.status!=="cancelled")) throw new Error("This team member is linked to appointments. Deactivate them instead.");
    this.commit({...this.state,employees:this.state.employees.filter(row=>row.id!==id)});
  }
  private assertService(service:Service){
    if(service.businessId!==demo.business.id||!service.name.trim()||!service.category.trim()||!Number.isInteger(service.durationMinutes)||service.durationMinutes<5||service.durationMinutes>720||!Number.isFinite(service.price)||service.price<0) throw new Error("Enter a valid service name, category, duration and non-negative price.");
  }
  private assertEmployee(employee:Employee){
    if(employee.businessId!==demo.business.id||!employee.name.trim()||!employee.role.trim()) throw new Error("Enter a team member name and role.");
    if(employee.serviceIds?.some(id=>!this.state.services.some(service=>service.id===id))) throw new Error("Choose services that exist in this business.");
    for(const [day,hours] of Object.entries(employee.workingHours??{})){if(hours.enabled&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.end)||hours.start>=hours.end)) throw new Error(`Check the working hours for ${day}.`);}
  }
}

/** UI pages depend on this contract, not on a database SDK. Supabase can replace this adapter later. */
export const salonRepository:SalonRepository=new DemoRepository();
