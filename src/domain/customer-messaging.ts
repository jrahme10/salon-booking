import type {Business,Customer,CustomerReminder} from "../types";

export function isEligibleForPromotionalMessaging(customer:Customer):boolean {
  return customer.marketingOptIn===true;
}

export function personalizeCustomerMessage(template:string,customer:Customer,business:Business):string {
  return template
    .replace(/\{name\}/gi,customer.name.trim().split(/\s+/)[0]||customer.name)
    .replace(/\{business\}/gi,business.name);
}

export function buildBirthdayMessage(customer:Customer,business:Business):string {
  return personalizeCustomerMessage("Happy birthday, {name}! 🎂 Wishing you a wonderful day from {business}. We hope to see you soon!",customer,business);
}

export function buildFollowupMessage(reminder:CustomerReminder,customer:Customer,business:Business):string {
  return personalizeCustomerMessage("Hi {name}! A quick follow-up from {business}: "+reminder.note+" Reply here if you would like help booking your next visit.",customer,business);
}

export function buildWhatsAppUrl(phone:string,message:string):string {
  const digits=phone.replace(/\D/g,"");
  if(digits.length<6) throw new Error("A valid customer phone number is required.");
  return "https://wa.me/"+digits+"?text="+encodeURIComponent(message);
}

export function getDueCustomerReminders(reminders:CustomerReminder[],now:Date=new Date()):CustomerReminder[] {
  const timestamp=now.getTime();
  return reminders
    .filter(reminder=>reminder.status==="pending"&&new Date(reminder.dueAt).getTime()<=timestamp)
    .sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
}
