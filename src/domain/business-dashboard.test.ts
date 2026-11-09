import {describe,expect,it} from "vitest";
import type {Appointment,Expense,Payment,PayrollPayment} from "../types";
import {buildBusinessDashboardReport} from "./business-dashboard";
const appointment=(overrides:Partial<Appointment>={}):Appointment=>({id:"a1",businessId:"b1",customerId:"c1",serviceId:"s1",employeeId:"e1",startsAt:"2026-11-10T10:00:00.000Z",status:"completed",paidAmount:40,...overrides});
const payment=(id:string,paidAt:string,amount:number):Payment=>({id,businessId:"b1",appointmentId:"a1",amount,method:"cash",paidAt});
const expense=(id:string,incurredAt:string,amount:number):Expense=>({id,businessId:"b1",amount,category:"supplies",description:"Test",incurredAt,paymentMethod:"cash"});
const payroll=(id:string,paidAt:string,amount:number):PayrollPayment=>({id,businessId:"b1",employeeId:"e1",amount,method:"cash",paidAt});
const base={appointments:[appointment()],payments:[payment("p1","2026-11-10T12:00:00.000Z",100)],expenses:[expense("x1","2026-11-10T12:00:00.000Z",20)],payroll:[payroll("pr1","2026-11-10T12:00:00.000Z",10)],period:"30" as const,now:new Date("2026-11-15T12:00:00.000Z")};
describe("buildBusinessDashboardReport",()=>{
 it("compares the selected period with the immediately preceding equal period",()=>{const report=buildBusinessDashboardReport({...base,payments:[...base.payments,payment("p2","2026-10-20T12:00:00.000Z",50)]});expect(report.current.revenue).toBe(100);expect(report.previous.revenue).toBe(50);expect(report.revenueChange).toBe(100);});
 it("includes recorded payroll payouts in expenses and calculates net cash flow",()=>{const report=buildBusinessDashboardReport(base);expect(report.current).toMatchObject({revenue:100,expenses:30,net:70,paymentCount:1});});
 it("summarizes appointment statuses and completion rate",()=>{const report=buildBusinessDashboardReport({...base,appointments:[appointment(),appointment({id:"a2",status:"pending"}),appointment({id:"a3",status:"cancelled"})]});expect(report.current).toMatchObject({appointments:3,completed:1,pending:1,cancelled:1,completionRate:33});});
 it("returns a null revenue change when the previous period has no revenue to compare",()=>{expect(buildBusinessDashboardReport(base).revenueChange).toBeNull();});
 it("builds six chronological monthly cash trends across year boundaries",()=>{const report=buildBusinessDashboardReport({...base,now:new Date("2026-02-15T12:00:00.000Z"),payments:[payment("p1","2025-11-10T12:00:00.000Z",5)]});expect(report.trend.map(row=>row.key)).toEqual(["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02"]);expect(report.trend[2].revenue).toBe(5);});
});
