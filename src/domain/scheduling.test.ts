import {describe,expect,it} from "vitest";
import type {Appointment,Employee,Service,WeeklySchedule} from "../types";
import {DEFAULT_WORKING_HOURS,getAvailableSlots,validateBooking} from "./scheduling";

const businessId="business-1";
const service:Service={id:"service-1",businessId,name:"Cut",category:"Hair",durationMinutes:60,price:30,active:true};
const employee:Employee={id:"employee-1",businessId,name:"Alex",role:"Stylist",initials:"A",active:true,serviceIds:[service.id],workingHours:DEFAULT_WORKING_HOURS,timeOff:[]};
const now=new Date(2025,0,6,8,0,0);
const monday=(hour:number,minute=0)=>new Date(2025,0,6,hour,minute,0,0);
const appointment=(overrides:Partial<Appointment>={}):Appointment=>({
  id:"appointment-1",businessId,customerId:"customer-1",serviceId:service.id,employeeId:employee.id,
  startsAt:monday(10).toISOString(),status:"confirmed",paidAmount:0,...overrides
});
const validate=(overrides:Partial<Parameters<typeof validateBooking>[0]>={})=>validateBooking({
  service,employee,startsAt:monday(9),appointments:[],services:[service],now,...overrides
});

describe("validateBooking",()=>{
  it("accepts a valid appointment inside working hours",()=>expect(validate()).toBeNull());
  it("rejects an invalid date",()=>expect(validate({startsAt:new Date("not-a-date")})).toContain("valid appointment date"));
  it("rejects an appointment in the past",()=>expect(validate({startsAt:monday(7)})).toContain("future"));
  it("rejects an inactive service",()=>expect(validate({service:{...service,active:false}})).toContain("service is not currently available"));
  it("rejects an inactive employee",()=>expect(validate({employee:{...employee,active:false}})).toContain("team member is not currently available"));
  it("rejects a service and employee from different businesses",()=>expect(validate({employee:{...employee,businessId:"another-business"}})).toContain("same business"));
  it("rejects a service the employee is not assigned to",()=>expect(validate({employee:{...employee,serviceIds:[]}})).toContain("does not provide"));
  it("rejects an employee's date-specific day off",()=>expect(validate({employee:{...employee,timeOff:["2025-01-06"]}})).toContain("unavailable on the selected date"));
  it("rejects a weekday when the employee is not scheduled",()=>{
    const workingHours={...DEFAULT_WORKING_HOURS,mon:{...DEFAULT_WORKING_HOURS.mon,enabled:false}};
    expect(validate({employee:{...employee,workingHours}})).toContain("does not work on the selected day");
  });
  it("rejects malformed working hours rather than treating them as unlimited",()=>{
    const workingHours={...DEFAULT_WORKING_HOURS,mon:{enabled:true,start:"09:60",end:"18:00"}} as WeeklySchedule;
    expect(validate({employee:{...employee,workingHours}})).toContain("working hours are invalid");
  });
  it("rejects a closing time earlier than opening time",()=>{
    const workingHours={...DEFAULT_WORKING_HOURS,mon:{enabled:true,start:"18:00",end:"09:00"}};
    expect(validate({employee:{...employee,workingHours}})).toContain("working hours are invalid");
  });
  it("rejects a service with a non-positive or fractional duration",()=>{
    expect(validate({service:{...service,durationMinutes:0}})).toContain("duration is invalid");
    expect(validate({service:{...service,durationMinutes:30.5}})).toContain("duration is invalid");
  });
  it("rejects appointments that start before opening",()=>expect(validate({startsAt:monday(8,30)})).toContain("fit within"));
  it("rejects appointments that end after closing",()=>expect(validate({startsAt:monday(17,30)})).toContain("fit within"));
  it("rejects an overlapping appointment for the same employee",()=>{
    expect(validate({startsAt:monday(10),appointments:[appointment()]})).toContain("already has an appointment");
  });
  it("allows appointments that touch but do not overlap",()=>{
    expect(validate({startsAt:monday(11),appointments:[appointment()]})).toBeNull();
  });
  it("ignores cancelled appointments when checking conflicts",()=>{
    expect(validate({appointments:[appointment({status:"cancelled"})]})).toBeNull();
  });
  it("ignores appointments assigned to another employee",()=>{
    expect(validate({appointments:[appointment({employeeId:"employee-2"})]})).toBeNull();
  });
  it("can exclude the appointment being revalidated",()=>{
    expect(validate({appointments:[appointment()],excludeAppointmentId:"appointment-1"})).toBeNull();
  });
});

describe("getAvailableSlots",()=>{
  const slots=(overrides:Partial<Parameters<typeof getAvailableSlots>[0]>={})=>getAvailableSlots({
    date:"2025-01-06",service,employee,appointments:[],services:[service],now,...overrides
  });
  it("generates slots in the configured increments",()=>expect(slots()).toEqual(["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"]));
  it("removes slots that overlap an existing appointment",()=>{
    expect(slots({appointments:[appointment()]})).not.toContain("09:30");
    expect(slots({appointments:[appointment()]})).not.toContain("10:00");
    expect(slots({appointments:[appointment()]})).toContain("11:00");
  });
  it("does not return slots in the past",()=>{
    expect(slots({now:monday(9,15)})).toEqual(["09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"]);
  });
  it("returns no slots on a date-specific day off",()=>expect(slots({employee:{...employee,timeOff:["2025-01-06"]}})).toEqual([]));
  it("returns no slots when the weekday is disabled",()=>{
    const workingHours={...DEFAULT_WORKING_HOURS,mon:{...DEFAULT_WORKING_HOURS.mon,enabled:false}};
    expect(slots({employee:{...employee,workingHours}})).toEqual([]);
  });
  it("returns no slots for inactive services or employees",()=>{
    expect(slots({service:{...service,active:false}})).toEqual([]);
    expect(slots({employee:{...employee,active:false}})).toEqual([]);
  });
  it("returns no slots for invalid dates and malformed hours",()=>{
    expect(slots({date:"2025-02-30"})).toEqual([]);
    const workingHours={...DEFAULT_WORKING_HOURS,mon:{enabled:true,start:"09:99",end:"18:00"}} as WeeklySchedule;
    expect(slots({employee:{...employee,workingHours}})).toEqual([]);
  });
  it("returns no slots for invalid increments or service duration",()=>{
    expect(slots({stepMinutes:0})).toEqual([]);
    expect(slots({stepMinutes:15.5})).toEqual([]);
    expect(slots({service:{...service,durationMinutes:0}})).toEqual([]);
  });
});
