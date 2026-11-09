import * as demo from "../data/mock";
import {DEFAULT_WORKING_HOURS,validateBooking} from "../domain/scheduling";
import type {Appointment,Business,BusinessBookingRules,ClientAppointmentRequest,Customer,Employee,Service,WeeklySchedule} from "../types";

export interface SalonRepository {
  getBusiness():Promise<Business>;
  updateBusiness(business:Business):Promise<void>;
  getServices():Promise<Service[]>;
  getEmployees():Promise<Employee[]>;
  getCustomers():Promise<Customer[]>;
  getAppointments():Promise<Appointment[]>;
  updateAppointmentStatus(id:string,status:Appointment["status"]):Promise<void>;
  updateAppointment(appointment:Appointment):Promise<void>;
  getClientAppointmentRequests():Promise<ClientAppointmentRequest[]>;
  createClientAppointmentRequest(request:ClientAppointmentRequest):Promise<void>;
  updateClientAppointmentRequest(id:string,status:ClientAppointmentRequest["status"]):Promise<void>;
  createAppointment(appointment:Appointment):Promise<void>;
  createCustomer(customer:Customer):Promise<Customer>;
  createService(service:Service):Promise<void>;
  updateService(service:Service):Promise<void>;
  deleteService(id:string):Promise<void>;
  createEmployee(employee:Employee):Promise<void>;
  updateEmployee(employee:Employee):Promise<void>;
  deleteEmployee(id:string):Promise<void>;
}
type StoredState={business:Business;appointments:Appointment[];services:Service[];employees:Employee[];customers:Customer[];clientRequests:ClientAppointmentRequest[]};
const STORAGE_KEY="salon-reservation-demo-v1";
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const seed=():StoredState=>({business:copy(demo.business),appointments:copy(demo.appointments),services:copy(demo.services),employees:copy(demo.employees),customers:copy(demo.customers),clientRequests:[]});

class DemoRepository implements SalonRepository {
  private state:StoredState;
  constructor(){
    try {
      const saved=typeof localStorage!=="undefined"?localStorage.getItem(STORAGE_KEY):null;
      const parsed=saved?JSON.parse(saved) as Partial<StoredState>:{};
      const defaults=seed();
      const savedEmployees=Array.isArray(parsed.employees)?parsed.employees.map(employee=>{const fallback=defaults.employees.find(row=>row.id===employee.id);return {...fallback,...employee,serviceIds:employee.serviceIds??fallback?.serviceIds??[],workingHours:employee.workingHours??fallback?.workingHours??DEFAULT_WORKING_HOURS,timeOff:employee.timeOff??[]};}):defaults.employees;
      this.state={business:{...defaults.business,...parsed.business,workingHours:parsed.business?.workingHours??defaults.business.workingHours,bookingRules:{...defaults.business.bookingRules,...parsed.business?.bookingRules}},appointments:Array.isArray(parsed.appointments)?parsed.appointments:defaults.appointments,services:Array.isArray(parsed.services)?parsed.services:defaults.services,employees:savedEmployees,customers:Array.isArray(parsed.customers)?parsed.customers:defaults.customers,clientRequests:Array.isArray(parsed.clientRequests)?parsed.clientRequests:defaults.clientRequests};
    } catch { this.state=seed(); }
  }
  private persist(){
    try { if(typeof localStorage!=="undefined") localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state)); }
    catch { throw new Error("Your browser could not save the changes. Check available storage and try again."); }
  }
  private commit(next:StoredState){const previous=this.state;this.state=next;try{this.persist();}catch(error){this.state=previous;throw error;}}
  async getBusiness(){return copy(this.state.business);}
  async updateBusiness(business:Business){
    this.assertBusiness(business);
    const future=this.state.appointments.filter(row=>(row.status==="pending"||row.status==="confirmed")&&new Date(row.startsAt).getTime()>Date.now());
    for(const appointment of future){const service=this.state.services.find(row=>row.id===appointment.serviceId);if(service){const reason=validateBusinessWindow(business,new Date(appointment.startsAt),service.durationMinutes);if(reason)throw new Error("These hours would affect an existing appointment ("+appointment.id+"): "+reason);}}
    this.commit({...this.state,business:copy(business)});
  }
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
  async getClientAppointmentRequests(){return copy(this.state.clientRequests);}
  async createClientAppointmentRequest(request:ClientAppointmentRequest){
    if(request.businessId!==demo.business.id) throw new Error("Invalid business for this request.");
    const appointment=this.state.appointments.find(row=>row.id===request.appointmentId);
    if(!appointment||appointment.businessId!==request.businessId||appointment.customerId!==request.customerId) throw new Error("This appointment could not be found for this client.");
    if(appointment.status!=="pending"&&appointment.status!=="confirmed") throw new Error("Only active appointments can be changed.");
    if(new Date(appointment.startsAt).getTime()<=Date.now()) throw new Error("Requests are only available for future appointments.");
    if(this.state.clientRequests.some(row=>row.appointmentId===request.appointmentId&&row.status==="pending")) throw new Error("There is already a request waiting for this appointment.");
    if(request.kind==="cancellation"&&new Date(appointment.startsAt).getTime()<Date.now()+(this.state.business.bookingRules?.cancellationNoticeHours??0)*3_600_000)throw new Error("The cancellation notice period has passed. Please contact the salon directly.");\n    if(request.kind==="reschedule"){
      if(!request.requestedStartsAt) throw new Error("Choose a new date and time.");
      const service=this.state.services.find(row=>row.id===appointment.serviceId);
      const employee=this.state.employees.find(row=>row.id===appointment.employeeId);
      if(!service||!employee) throw new Error("The appointment service or team member is no longer available.");
      const businessReason=validateBusinessWindow(this.state.business,new Date(request.requestedStartsAt),service.durationMinutes,true);if(businessReason)throw new Error(businessReason);\n      const reason=validateBooking({service,employee,startsAt:new Date(request.requestedStartsAt),appointments:this.state.appointments,services:this.state.services,excludeAppointmentId:appointment.id});
      if(reason) throw new Error(reason);
    }
    this.commit({...this.state,clientRequests:[...this.state.clientRequests,copy(request)]});
  }
  async updateClientAppointmentRequest(id:string,status:ClientAppointmentRequest["status"]){
    const request=this.state.clientRequests.find(row=>row.id===id);
    if(!request) throw new Error("Client request was not found.");
    if(request.status!=="pending") throw new Error("This request has already been reviewed.");
    let appointments=this.state.appointments;
    if(status==="approved"){
      const appointment=appointments.find(row=>row.id===request.appointmentId);
      if(!appointment||appointment.customerId!==request.customerId||appointment.businessId!==request.businessId) throw new Error("The linked appointment could not be found.");
      if(appointment.status!=="pending"&&appointment.status!=="confirmed") throw new Error("This appointment is no longer active.");
      if(request.kind==="cancellation"){
        appointments=appointments.map(row=>row.id===appointment.id?{...row,status:"cancelled" as const}:row);
      }else{
        if(!request.requestedStartsAt) throw new Error("The requested date and time is missing.");
        const service=this.state.services.find(row=>row.id===appointment.serviceId);
        const employee=this.state.employees.find(row=>row.id===appointment.employeeId);
        if(!service||!employee) throw new Error("The appointment service or team member is no longer available.");
        const businessReason=validateBusinessWindow(this.state.business,new Date(request.requestedStartsAt),service.durationMinutes,true);if(businessReason)throw new Error(businessReason);\n        const reason=validateBooking({service,employee,startsAt:new Date(request.requestedStartsAt),appointments,services:this.state.services,excludeAppointmentId:appointment.id});
        if(reason) throw new Error("Cannot approve this time: "+reason);
        appointments=appointments.map(row=>row.id===appointment.id?{...row,startsAt:request.requestedStartsAt!}:row).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
      }
    }
    this.commit({...this.state,appointments,clientRequests:this.state.clientRequests.map(row=>row.id===id?{...row,status}:row)});
  }
  async updateAppointment(appointment:Appointment){
    const current=this.state.appointments.find(row=>row.id===appointment.id);
    if(!current) throw new Error("Appointment was not found.");
    if(current.status!=="pending"&&current.status!=="confirmed") throw new Error("Only pending or confirmed appointments can be edited.");
    if(appointment.status!==current.status) throw new Error("Appointment status cannot be changed while editing.");
    if(appointment.businessId!==current.businessId||appointment.businessId!==demo.business.id) throw new Error("Invalid business for this appointment.");
    const service=this.state.services.find(row=>row.id===appointment.serviceId);
    const employee=this.state.employees.find(row=>row.id===appointment.employeeId);
    const customer=this.state.customers.find(row=>row.id===appointment.customerId);
    if(!service||!employee||!customer) throw new Error("Choose an existing customer, service and team member.");
    if(service.businessId!==appointment.businessId||employee.businessId!==appointment.businessId) throw new Error("The selected service and team member must belong to this business.");
    if(customer.businessId&&customer.businessId!==appointment.businessId) throw new Error("The selected customer belongs to another business.");
    const reason=validateBooking({service,employee,startsAt:new Date(appointment.startsAt),appointments:this.state.appointments,services:this.state.services,excludeAppointmentId:appointment.id});
    if(reason) throw new Error(reason);
    const updated={...current,customerId:appointment.customerId,serviceId:appointment.serviceId,employeeId:appointment.employeeId,startsAt:appointment.startsAt};
    this.commit({...this.state,appointments:this.state.appointments.map(row=>row.id===appointment.id?updated:row).sort((a,b)=>a.startsAt.localeCompare(b.startsAt))});
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
    const businessReason=validateBusinessWindow(this.state.business,new Date(appointment.startsAt),service.durationMinutes,true);if(businessReason)throw new Error(businessReason);\n    const reason=validateBooking({service,employee,startsAt:new Date(appointment.startsAt),appointments:this.state.appointments,services:this.state.services});
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
  private assertBusiness(business:Business){\n    if(business.id!==this.state.business.id||!business.name.trim()||!business.slug.trim()||!business.category.trim()||!business.city.trim()||!business.address.trim())throw new Error("Complete the required business profile fields.");\n    if(business.phone&&!/^[+0-9() .-]{6,25}$/.test(business.phone))throw new Error("Enter a valid business phone number.");\n    if(business.email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(business.email))throw new Error("Enter a valid business email address.");\n    try{new Intl.DateTimeFormat("en-US",{timeZone:business.timezone??"Asia/Beirut"}).format(new Date());}catch{throw new Error("Choose a valid IANA timezone.");}\n    for(const [day,hours] of Object.entries(business.workingHours??{})){if(hours.enabled&&(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(hours.start)||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(hours.end)||hours.start>=hours.end))throw new Error("Check the business hours for "+day+".");}\n    const rules=business.bookingRules as BusinessBookingRules|undefined;if(!rules||![15,30,60].includes(rules.slotIntervalMinutes)||!Number.isInteger(rules.minimumNoticeHours)||rules.minimumNoticeHours<0||rules.minimumNoticeHours>720||!Number.isInteger(rules.cancellationNoticeHours)||rules.cancellationNoticeHours<0||rules.cancellationNoticeHours>720)throw new Error("Check your booking rules.");\n  }\n  private assertService(service:Service){
    if(service.businessId!==demo.business.id||!service.name.trim()||!service.category.trim()||!Number.isInteger(service.durationMinutes)||service.durationMinutes<5||service.durationMinutes>720||!Number.isFinite(service.price)||service.price<0) throw new Error("Enter a valid service name, category, duration and non-negative price.");
  }
  private assertEmployee(employee:Employee){
    if(employee.businessId!==demo.business.id||!employee.name.trim()||!employee.role.trim()) throw new Error("Enter a team member name and role.");
    if(employee.serviceIds?.some(id=>!this.state.services.some(service=>service.id===id))) throw new Error("Choose services that exist in this business.");
    for(const [day,hours] of Object.entries(employee.workingHours??{})){if(hours.enabled&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.end)||hours.start>=hours.end)) throw new Error(`Check the working hours for ${day}.`);}
  }
}


function validateBusinessWindow(business:Business,startsAt:Date,durationMinutes:number,checkNotice=false):string|null{
  if(!Number.isFinite(startsAt.getTime()))return "Choose a valid appointment time.";
  const timezone=business.timezone??"Asia/Beirut";
  const rules=business.bookingRules??{allowOnlineBooking:true,minimumNoticeHours:0,cancellationNoticeHours:24,slotIntervalMinutes:30};
  if(checkNotice&&startsAt.getTime()<Date.now()+rules.minimumNoticeHours*3_600_000-60_000)return "This appointment does not meet the business minimum booking notice.";
  const format=(date:Date)=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);const value=(key:string)=>parts.find(part=>part.type===key)?.value??"";return {weekday:value("weekday").toLowerCase().slice(0,3),minute:Number(value("hour"))*60+Number(value("minute"))};};
  const days=["sun","mon","tue","wed","thu","fri","sat"];
  const end=new Date(startsAt.getTime()+durationMinutes*60_000-1);
  const startParts=format(startsAt),endParts=format(end);
  if(startParts.weekday!==endParts.weekday)return "The service must finish before the business closes.";
  const hours=business.workingHours?.[days.indexOf(startParts.weekday) as keyof WeeklySchedule];
  if(!hours||!hours.enabled)return "The business is closed on the selected day.";
  const toMinutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m;};
  if(startParts.minute<toMinutes(hours.start)||endParts.minute>=toMinutes(hours.end))return "Choose a time within the business opening hours.";
  return null;
}
\n/** UI pages depend on this contract, not on a database SDK. Supabase can replace this adapter later. */
export const salonRepository:SalonRepository=new DemoRepository();
