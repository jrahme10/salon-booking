import {describe,expect,it} from "vitest";
import type {Appointment,Customer,Payment} from "../types";
import {buildCustomerBookingHistory,buildCustomerInsights} from "./customer-insights";
const customers:Customer[]=[{id:"c1",name:"A",phone:"1",email:"",visits:0,lastVisit:""},{id:"c2",name:"B",phone:"2",email:"",visits:0,lastVisit:""},{id:"c3",name:"C",phone:"3",email:"",visits:0,lastVisit:""},{id:"c4",name:"D",phone:"4",email:"",visits:0,lastVisit:""}];
const appointments:Appointment[]=[
 {id:"a1",businessId:"b",customerId:"c1",serviceId:"s",employeeId:"e",startsAt:"2026-07-01T10:00:00Z",status:"completed",paidAmount:0},
 {id:"a2",businessId:"b",customerId:"c1",serviceId:"s",employeeId:"e",startsAt:"2026-11-01T10:00:00Z",status:"completed",paidAmount:0},
 {id:"a3",businessId:"b",customerId:"c2",serviceId:"s",employeeId:"e",startsAt:"2026-11-02T10:00:00Z",status:"completed",paidAmount:0},
 {id:"a4",businessId:"b",customerId:"c3",serviceId:"s",employeeId:"e",startsAt:"2026-07-01T10:00:00Z",status:"completed",paidAmount:0},
 {id:"a5",businessId:"b",customerId:"c3",serviceId:"s",employeeId:"e",startsAt:"2026-12-01T10:00:00Z",status:"confirmed",paidAmount:0},
 {id:"a6",businessId:"b",customerId:"c4",serviceId:"s",employeeId:"e",startsAt:"2026-08-01T10:00:00Z",status:"completed",paidAmount:0},
];
const payments:Payment[]=[
 {id:"p1",businessId:"b",appointmentId:"a1",amount:20,method:"cash",paidAt:"2026-07-01T11:00:00Z"},
 {id:"p2",businessId:"b",appointmentId:"a2",amount:30,method:"cash",paidAt:"2026-11-01T11:00:00Z"},
 {id:"p3",businessId:"b",appointmentId:"a3",amount:40,method:"card",paidAt:"2026-11-02T11:00:00Z"},
 {id:"p4",businessId:"b",appointmentId:"a4",amount:10,method:"cash",paidAt:"2026-07-01T11:00:00Z"},
];
const now=new Date("2026-11-09T12:00:00Z");
describe("customer insights",()=>{
 it("ranks loyal customers by completed lifetime visits, then spend",()=>{const report=buildCustomerInsights({customers,appointments,payments,period:"all",now});expect(report.loyalCustomers[0].customer.id).toBe("c1");expect(report.loyalCustomers[0].lifetimeVisits).toBe(2);});
 it("finds lapsed customers but excludes customers with a future booking",()=>{const report=buildCustomerInsights({customers,appointments,payments,period:"all",now,inactiveAfterDays:60});expect(report.inactiveCustomers.map(row=>row.customer.id)).toEqual(["c4"]);});
 it("calculates repeat rate and new versus returning in the selected period",()=>{const report=buildCustomerInsights({customers,appointments,payments,period:"90",now});expect(report.repeatVisitRate).toBe(0);expect(report.newCustomers).toBe(1);expect(report.returningCustomers).toBe(1);});
 it("uses actual recorded payments for average spend, not appointment prices or paidAmount",()=>{const report=buildCustomerInsights({customers,appointments,payments,period:"90",now});expect(report.averageCustomerSpend).toBe(35);expect(report.collectedRevenue).toBe(70);});
 it("shows zero-safe values when no completed appointments exist",()=>{const report=buildCustomerInsights({customers,appointments:[],payments:[],period:"30",now});expect(report.repeatVisitRate).toBe(0);expect(report.averageCustomerSpend).toBe(0);expect(report.loyalCustomers).toEqual([]);});
 it("builds newest-first history and sums partial payments",()=>{const history=buildCustomerBookingHistory({customerId:"c1",appointments,payments,services:[],employees:[]});expect(history.map(row=>row.appointment.id)).toEqual(["a2","a1"]);expect(history[0].collected).toBe(30);});
});
