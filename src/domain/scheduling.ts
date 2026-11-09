import type {Appointment,Employee,Service,Weekday,WorkingDay,WeeklySchedule} from "../types";

export const WEEKDAYS:Weekday[]=["sun","mon","tue","wed","thu","fri","sat"];
export const DEFAULT_WORKING_HOURS:WeeklySchedule={
  sun:{enabled:false,start:"09:00",end:"18:00"},
  mon:{enabled:true,start:"09:00",end:"18:00"},
  tue:{enabled:true,start:"09:00",end:"18:00"},
  wed:{enabled:true,start:"09:00",end:"18:00"},
  thu:{enabled:true,start:"09:00",end:"18:00"},
  fri:{enabled:true,start:"09:00",end:"18:00"},
  sat:{enabled:true,start:"09:00",end:"18:00"}
};
export const getWorkingDay=(employee:Employee,day:Weekday):WorkingDay=>employee.workingHours?.[day]??DEFAULT_WORKING_HOURS[day];
const isTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes=(value:string)=>{const [hours,mins]=value.split(":").map(Number);return hours*60+mins;};
const localDateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const overlaps=(start:number,end:number,otherStart:number,otherEnd:number)=>start<otherEnd&&end>otherStart;

export function validateBooking(input:{service:Service;employee:Employee;startsAt:Date;appointments:Appointment[];services:Service[];excludeAppointmentId?:string;now?:Date}):string|null {
  const {service,employee,startsAt,appointments,services,excludeAppointmentId}=input;
  const now=input.now??new Date();
  if(!Number.isFinite(startsAt.getTime())) return "Choose a valid appointment date and time.";
  if(startsAt.getTime()<now.getTime()-60_000) return "Appointments must be scheduled in the future.";
  if(!service.active) return "This service is not currently available.";
  if(!employee.active) return "This team member is not currently available.";
  if(service.businessId!==employee.businessId) return "The selected service and team member do not belong to the same business.";
  if(employee.serviceIds&&!employee.serviceIds.includes(service.id)) return "This team member does not provide the selected service.";
  if(!Number.isInteger(service.durationMinutes)||service.durationMinutes<=0) return "The service duration is invalid.";
  const dateKey=localDateKey(startsAt);
  if(employee.timeOff?.includes(dateKey)) return "This team member is unavailable on the selected date.";
  const day=getWorkingDay(employee,WEEKDAYS[startsAt.getDay()]);
  if(!day.enabled) return "This team member does not work on the selected day.";
  if(!isTime(day.start)||!isTime(day.end)||day.start>=day.end) return "This team member's working hours are invalid.";
  const startMinute=startsAt.getHours()*60+startsAt.getMinutes();
  const endMinute=startMinute+service.durationMinutes;
  if(startMinute<minutes(day.start)||endMinute>minutes(day.end)) return "The appointment must fit within the team member's working hours.";
  const startAt=startsAt.getTime(),endAt=startAt+service.durationMinutes*60_000;
  const conflict=appointments.some(item=>{
    if(item.id===excludeAppointmentId||item.status==="cancelled"||item.employeeId!==employee.id) return false;
    const existingStart=new Date(item.startsAt).getTime();
    const existingService=services.find(row=>row.id===item.serviceId);
    const existingDuration=existingService?.durationMinutes??60;
    return Number.isFinite(existingStart)&&overlaps(startAt,endAt,existingStart,existingStart+existingDuration*60_000);
  });
  if(conflict) return "This team member already has an appointment during that time.";
  return null;
}

export function getAvailableSlots(input:{date:string;service:Service;employee:Employee;appointments:Appointment[];services:Service[];stepMinutes?:number;now?:Date}):string[] {
  const {date,service,employee,appointments,services}=input;
  const step=input.stepMinutes??30;
  if(!date||!service.active||!employee.active||!Number.isInteger(step)||step<=0||!Number.isInteger(service.durationMinutes)||service.durationMinutes<=0) return [];
  const [year,month,dayNumber]=date.split("-").map(Number);
  const dayDate=new Date(year,month-1,dayNumber,12,0,0,0);
  if(!Number.isFinite(dayDate.getTime())||localDateKey(dayDate)!==date) return [];
  const working=getWorkingDay(employee,WEEKDAYS[dayDate.getDay()]);
  if(!working.enabled||employee.timeOff?.includes(date)||!isTime(working.start)||!isTime(working.end)||working.start>=working.end) return [];
  const open=minutes(working.start),close=minutes(working.end),slots:string[]=[];
  for(let start=open;start+service.durationMinutes<=close;start+=step){
    const hours=Math.floor(start/60),mins=start%60;
    const label=`${String(hours).padStart(2,"0")}:${String(mins).padStart(2,"0")}`;
    const candidate=new Date(year,month-1,dayNumber,hours,mins,0,0);
    if(!validateBooking({service,employee,startsAt:candidate,appointments,services,now:input.now})) slots.push(label);
  }
  return slots;
}
