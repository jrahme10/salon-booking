import {describe,expect,it} from "vitest";
import type {Business,Customer,CustomerConsentEvent,CustomerReminder} from "../types";
import {buildBirthdayMessage,buildFollowupMessage,buildWhatsAppUrl,getDueCustomerReminders,getLatestCustomerConsent,isEligibleForPromotionalMessaging,personalizeCustomerMessage} from "./customer-messaging";

const business:Business={id:"b1",name:"Olive Studio",slug:"olive",category:"Beauty",city:"Beirut",address:"",currency:"USD"};
const customer:Customer={id:"c1",name:"Maya Khoury",phone:"+961 3 123 456",email:"",visits:0,lastVisit:"",marketingOptIn:true};
const consent:CustomerConsentEvent={id:"ce1",businessId:"b1",customerId:"c1",action:"granted",channel:"all",source:"in_person",capturedAt:"2026-11-01T09:00:00.000Z",customerConfirmed:true};
const reminder:CustomerReminder={id:"r1",businessId:"b1",customerId:"c1",dueAt:"2026-11-09T09:00:00.000Z",note:"Ask how the haircut is holding up.",status:"pending",createdAt:"2026-11-01T09:00:00.000Z"};

describe("customer messaging",()=>{
 it("personalizes first name and business tokens",()=>expect(personalizeCustomerMessage("Hi {name} from {business}",customer,business)).toBe("Hi Maya from Olive Studio"));
 it("builds a birthday greeting",()=>expect(buildBirthdayMessage(customer,business)).toContain("Happy birthday, Maya!"));
 it("builds a follow-up from the reminder note",()=>expect(buildFollowupMessage(reminder,customer,business)).toContain("Ask how the haircut is holding up."));
 it("creates a WhatsApp click-to-chat URL with an encoded message",()=>expect(buildWhatsAppUrl(customer.phone,"Hi Maya!")).toBe("https://wa.me/9613123456?text=Hi%20Maya!"));
 it("rejects invalid WhatsApp phone numbers",()=>expect(()=>buildWhatsAppUrl("123","Hello")).toThrow());
 it("requires the latest consent event and respects channel scope",()=>{expect(isEligibleForPromotionalMessaging(customer,[consent],"whatsapp")).toBe(true);expect(isEligibleForPromotionalMessaging(customer,[consent],"email")).toBe(true);expect(isEligibleForPromotionalMessaging(customer,[{...consent,channel:"whatsapp"}],"email")).toBe(false);expect(isEligibleForPromotionalMessaging(customer,[],"whatsapp")).toBe(false);expect(isEligibleForPromotionalMessaging({...customer,marketingOptIn:false},[consent],"whatsapp")).toBe(false);});
 it("honors the latest opt-out event",()=>{const revoked={...consent,id:"ce2",action:"revoked" as const,capturedAt:"2026-11-02T09:00:00.000Z",customerConfirmed:false};expect(getLatestCustomerConsent("c1",[consent,revoked])?.action).toBe("revoked");expect(isEligibleForPromotionalMessaging({...customer,marketingOptIn:false},[consent,revoked],"whatsapp")).toBe(false);});
 it("returns only due pending reminders in chronological order",()=>{const rows=[reminder,{...reminder,id:"future",dueAt:"2026-11-10T09:00:00.000Z"},{...reminder,id:"done",status:"completed" as const,dueAt:"2026-11-08T09:00:00.000Z"},{...reminder,id:"older",dueAt:"2026-11-08T09:00:00.000Z"}];expect(getDueCustomerReminders(rows,new Date("2026-11-09T12:00:00.000Z")).map(row=>row.id)).toEqual(["older","r1"]);});
});
