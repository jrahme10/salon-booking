import {describe,expect,it} from "vitest";
import type {Appointment,CommissionEntry,Employee,Payment,PayrollPayment,Service} from "../types";
import {buildEmployeePerformanceReport} from "./employee-performance";
const employee:Employee={id:"e1",businessId:"b1",name:"Maya",role:"Stylist",initials:"M",active:true};
const service:Service={id:"s1",businessId:"b1",name:"Cut",category:"Hair",durationMinutes:60,price:50,active:true};
const appointment=(overrides:Partial<Appointment>={}):Appointment=>({id:"a1",businessId:"b1",customerId:"c1",serviceId:"s1",employeeId:"e1",startsAt:"2026-11-05T10:00:00.000Z",status:"completed",paidAmount:30,...overrides});
const payment:Payment={id:"p1",businessId:"b1",appointmentId:"a1",amount:30,method:"cash",paidAt:"2026-11-05T12:00:00.000Z"};
const commission:CommissionEntry={id:"c1",businessId:"b1",appointmentId:"a1",employeeId:"e1",serviceName:"Cut",baseAmount:50,commissionType:"percentage",commissionValue:20,amount:10,earnedAt:"2026-11-05T12:00:00.000Z"};
const payroll:PayrollPayment={id:"pr1",businessId:"b1",employeeId:"e1",amount:4,method:"cash",paidAt:"2026-11-06T12:00:00.000Z"};
const base={employees:[employee],appointments:[appointment()],services:[service],payments:[payment],commissions:[commission],payroll:[payroll],period:"30" as const,now:new Date("2026-11-10T18:00:00.000Z")};
describe("buildEmployeePerformanceReport",()=>{
 it("calculates appointment, collection, commission and lifetime outstanding metrics",()=>{const report=buildEmployeePerformanceReport(base);expect(report.rows[0]).toMatchObject({appointments:1,completed:1,cancelled:0,completionRate:100,customers:1,serviceValue:50,collected:30,commissionsEarned:10,payouts:4,outstanding:6});expect(report.collected).toBe(30);expect(report.outstanding).toBe(6);});
 it("filters appointment activity and ledger transactions by selected period",()=>{const report=buildEmployeePerformanceReport({...base,period:"30",appointments:[appointment({startsAt:"2026-09-01T10:00:00.000Z"})]});expect(report.rows[0].appointments).toBe(0);expect(report.rows[0].collected).toBe(0);expect(report.rows[0].commissionsEarned).toBe(10);});
 it("uses service value estimate from current service price and excludes non-completed appointments",()=>{const report=buildEmployeePerformanceReport({...base,appointments:[appointment(),appointment({id:"a2",status:"cancelled",customerId:"c2"})]});expect(report.rows[0].serviceValue).toBe(50);expect(report.rows[0].cancelled).toBe(1);expect(report.rows[0].completionRate).toBe(50);});
 it("returns zero-safe metrics for employees without appointments",()=>{const report=buildEmployeePerformanceReport({...base,appointments:[],payments:[],commissions:[],payroll:[]});expect(report.rows[0]).toMatchObject({appointments:0,completed:0,completionRate:0,customers:0,serviceValue:0,collected:0,outstanding:0});});
});
