import {describe,expect,it} from "vitest";
import type {Expense,Payment,PayrollPayment} from "../types";
import {buildMonthlyFinanceReport,previousMonth,recentMonths} from "./monthly-finance";
const payment=(id:string,paidAt:string,amount:number,method:Payment["method"]="cash"):Payment=>({id,businessId:"b1",appointmentId:"a1",amount,method,paidAt});
const expense=(id:string,incurredAt:string,amount:number,category:Expense["category"]="supplies"):Expense=>({id,businessId:"b1",amount,category,description:"Test expense",incurredAt,paymentMethod:"cash"});
const payroll=(id:string,paidAt:string,amount:number):PayrollPayment=>({id,businessId:"b1",employeeId:"emp1",amount,method:"cash",paidAt});

describe("buildMonthlyFinanceReport",()=>{
 it("totals only transactions in the selected month",()=>{
  const report=buildMonthlyFinanceReport([
   payment("p1","2026-11-02T10:00:00.000Z",100),
   payment("p2","2026-11-18T10:00:00.000Z",50,"card"),
   payment("p3","2026-10-31T22:00:00.000Z",900)
  ],[
   expense("e1","2026-11-04T10:00:00.000Z",30,"rent"),
   expense("e2","2026-10-20T10:00:00.000Z",200)
  ],"2026-11");
  expect(report.income).toBe(150);
  expect(report.expenses).toBe(30);
  expect(report.net).toBe(120);
  expect(report.paymentCount).toBe(2);
  expect(report.expenseCount).toBe(1);
 });
 it("groups income by payment method and costs by expense category",()=>{
  const report=buildMonthlyFinanceReport([payment("p1","2026-11-02T10:00:00.000Z",20),payment("p2","2026-11-03T10:00:00.000Z",30,"card")],[expense("e1","2026-11-04T10:00:00.000Z",10,"rent"),expense("e2","2026-11-05T10:00:00.000Z",15,"rent"),expense("e3","2026-11-06T10:00:00.000Z",5,"utilities")],"2026-11");
  expect(report.paymentsByMethod).toEqual({cash:20,card:30});
  expect(report.expensesByCategory).toEqual({rent:25,utilities:5});
 });
 it("includes payroll payouts as salary expenses without counting earned commissions",()=>{const report=buildMonthlyFinanceReport([payment("p1","2026-11-02T10:00:00.000Z",100)],[expense("e1","2026-11-04T10:00:00.000Z",20,"rent")],"2026-11",[payroll("pr1","2026-11-08T10:00:00.000Z",30)]);expect(report.income).toBe(100);expect(report.expenses).toBe(50);expect(report.net).toBe(50);expect(report.expensesByCategory).toEqual({rent:20,salary:30});expect(report.expenseCount).toBe(2);});
 it("returns zero totals when the month has no transactions",()=>{
  expect(buildMonthlyFinanceReport([],[],"2026-11")).toMatchObject({income:0,expenses:0,net:0,paymentCount:0,expenseCount:0});
 });
});
describe("month navigation",()=>{
 it("handles year boundaries when finding the previous month",()=>expect(previousMonth("2026-01")).toBe("2025-12"));
 it("returns ordered recent months across year boundaries",()=>expect(recentMonths("2026-02",4)).toEqual(["2025-11","2025-12","2026-01","2026-02"]));
});
