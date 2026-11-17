import type {Appointment,Business,ClientAppointmentRequest,CommissionEntry,Customer,CustomerConsentEvent,CustomerReminder,CustomerReminderStatus,Employee,Expense,PayrollPayment,Payment,Service} from "../types";
import {apiRequest} from "./auth";
import {DemoRepository} from "./demo-repository";

export interface SalonRepository {
  getBusiness():Promise<Business>;
  updateBusiness(business:Business):Promise<void>;
  getServices():Promise<Service[]>;
  getEmployees():Promise<Employee[]>;
  getCustomers():Promise<Customer[]>;
  updateCustomer(customer:Customer):Promise<void>;
  getCustomerConsentEvents():Promise<CustomerConsentEvent[]>;
  recordCustomerConsent(event:CustomerConsentEvent):Promise<void>;
  getCustomerReminders():Promise<CustomerReminder[]>;
  createCustomerReminder(reminder:CustomerReminder):Promise<void>;
  updateCustomerReminder(id:string,status:CustomerReminderStatus):Promise<void>;
  getAppointments():Promise<Appointment[]>;
  getPayments():Promise<Payment[]>;
  getExpenses():Promise<Expense[]>;
  getCommissionEntries():Promise<CommissionEntry[]>;
  getPayrollPayments():Promise<PayrollPayment[]>;
  createPayrollPayment(payment:PayrollPayment):Promise<void>;
  createPayment(payment:Payment):Promise<void>;
  createExpense(expense:Expense):Promise<void>;
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

class ApiRepository implements SalonRepository {
  private snapshot:Promise<Record<string,any>>|null=null;
  private async load(){if(!this.snapshot)this.snapshot=apiRequest<Record<string,any>>("/provider/bootstrap");try{return await this.snapshot;}catch(error){this.snapshot=null;throw error;}}
  private invalidate(){this.snapshot=null;}
  private async write<T>(path:string,method:string,body?:unknown):Promise<T>{
    const result=await apiRequest<T>(path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
    this.invalidate();return result;
  }
  async getBusiness(){return (await this.load()).business as Business;}
  async updateBusiness(business:Business){await this.write("/provider/business","PATCH",business);}
  async getServices(){return (await this.load()).services as Service[];}
  async getEmployees(){return (await this.load()).employees as Employee[];}
  async getCustomers(){return (await this.load()).customers as Customer[];}
  async updateCustomer(customer:Customer){await this.write("/provider/customers/"+customer.id,"PATCH",customer);}
  async getCustomerConsentEvents(){return (await this.load()).customerConsentEvents as CustomerConsentEvent[];}
  async recordCustomerConsent(event:CustomerConsentEvent){await this.write("/provider/customer-consent","POST",event);}
  async getCustomerReminders(){return (await this.load()).customerReminders as CustomerReminder[];}
  async createCustomerReminder(reminder:CustomerReminder){await this.write("/provider/customer-reminders","POST",reminder);}
  async updateCustomerReminder(id:string,status:CustomerReminderStatus){await this.write("/provider/customer-reminders/"+id,"PATCH",{status});}
  async getAppointments(){return (await this.load()).appointments as Appointment[];}
  async getPayments(){return (await this.load()).payments as Payment[];}
  async getExpenses(){return (await this.load()).expenses as Expense[];}
  async getCommissionEntries(){return (await this.load()).commissionEntries as CommissionEntry[];}
  async getPayrollPayments(){return (await this.load()).payrollPayments as PayrollPayment[];}
  async createPayrollPayment(payment:PayrollPayment){await this.write("/provider/payroll","POST",payment);}
  async createPayment(payment:Payment){await this.write("/provider/payments","POST",payment);}
  async createExpense(expense:Expense){await this.write("/provider/expenses","POST",expense);}
  async updateAppointmentStatus(id:string,status:Appointment["status"]){
    await apiRequest("/provider/appointments/"+id+"/status",{method:"PATCH",body:JSON.stringify({status})});
    // Completing can create commission rows, so clear the cache. Other status changes can patch locally.
    if(status==="completed"||!this.snapshot){this.invalidate();return;}
    try{
      const snap=await this.snapshot;
      if(Array.isArray(snap.appointments))snap.appointments=snap.appointments.map((row:Appointment)=>row.id===id?{...row,status}:row);
    }catch{this.invalidate();}
  }
  async updateAppointment(appointment:Appointment){await this.write("/provider/appointments/"+appointment.id,"PATCH",appointment);}
  async getClientAppointmentRequests(){return (await this.load()).clientRequests as ClientAppointmentRequest[];}
  async createClientAppointmentRequest(request:ClientAppointmentRequest){await this.write("/provider/client-requests","POST",request);}
  async updateClientAppointmentRequest(id:string,status:ClientAppointmentRequest["status"]){await this.write("/provider/client-requests/"+id,"PATCH",{status});}
  async createAppointment(appointment:Appointment){await this.write("/provider/appointments","POST",appointment);}
  async createCustomer(customer:Customer):Promise<Customer>{
    const result=await this.write<{customer:Customer}>("/provider/customers","POST",customer);
    return {...result.customer,visits:0,lastVisit:""};
  }
  async createService(service:Service){await this.write("/provider/services","POST",service);}
  async updateService(service:Service){await this.write("/provider/services/"+service.id,"PATCH",service);}
  async deleteService(id:string){await this.write("/provider/services/"+id,"DELETE");}
  async createEmployee(employee:Employee){await this.write("/provider/employees","POST",employee);}
  async updateEmployee(employee:Employee){await this.write("/provider/employees/"+employee.id,"PATCH",employee);}
  async deleteEmployee(id:string){await this.write("/provider/employees/"+id,"DELETE");}
}

/** UI pages depend on this contract, not on a database SDK.
 *  Production always uses the API. The localStorage demo is only available in dev builds with VITE_USE_DEMO=true. */
const useDemo=import.meta.env.DEV&&import.meta.env.VITE_USE_DEMO==="true";
export const salonRepository:SalonRepository=useDemo?new DemoRepository():new ApiRepository();
