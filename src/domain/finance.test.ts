import {describe,expect,it} from "vitest";
import type {Appointment,Expense,Payment,Service} from "../types";
import {validateExpense,validatePayment} from "./finance";

const appointment:Appointment={id:"a1",businessId:"b1",customerId:"c1",serviceId:"s1",employeeId:"e1",startsAt:"2026-11-10T10:00:00.000Z",status:"confirmed",paidAmount:10};
const service:Service={id:"s1",businessId:"b1",name:"Cut",category:"Hair",durationMinutes:60,price:50,active:true};
const payment=(overrides:Partial<Payment>={}):Payment=>({id:"p1",businessId:"b1",appointmentId:"a1",amount:20,method:"cash",paidAt:"2026-11-09T10:00:00.000Z",...overrides});
const expense=(overrides:Partial<Expense>={}):Expense=>({id:"x1",businessId:"b1",amount:25,category:"supplies",description:"Shampoo",incurredAt:"2026-11-09T10:00:00.000Z",paymentMethod:"cash",...overrides});

describe("validatePayment",()=>{
 it("accepts a valid partial payment",()=>expect(validatePayment(payment(),appointment,service)).toBeNull());
 it("rejects payments above the remaining balance",()=>expect(validatePayment(payment({amount:41}),appointment,service)).toContain("remaining appointment balance"));
 it("rejects zero, negative and non-finite amounts",()=>{
  expect(validatePayment(payment({amount:0}),appointment,service)).toContain("greater than zero");
  expect(validatePayment(payment({amount:-1}),appointment,service)).toContain("greater than zero");
  expect(validatePayment(payment({amount:Infinity}),appointment,service)).toContain("greater than zero");
 });
 it("rejects payments linked to another business or appointment",()=>{
  expect(validatePayment(payment({businessId:"b2"}),appointment,service)).toContain("business");
  expect(validatePayment(payment({appointmentId:"a2"}),appointment,service)).toContain("belong");
 });
 it("rejects invalid payment methods and dates",()=>{
  expect(validatePayment(payment({method:"crypto" as Payment["method"]}),appointment,service)).toContain("payment method");
  expect(validatePayment(payment({paidAt:"invalid"}),appointment,service)).toContain("payment date");
 });
});

describe("validateExpense",()=>{
 it("accepts a valid expense",()=>expect(validateExpense(expense(),"b1")).toBeNull());
 it("rejects another business",()=>expect(validateExpense(expense({businessId:"b2"}),"b1")).toContain("business"));
 it("rejects invalid amounts and missing descriptions",()=>{
  expect(validateExpense(expense({amount:0}),"b1")).toContain("greater than zero");
  expect(validateExpense(expense({description:"  "}),"b1")).toContain("description");
 });
 it("rejects invalid categories, payment methods and dates",()=>{
  expect(validateExpense(expense({category:"unlisted" as Expense["category"]}),"b1")).toContain("category");
  expect(validateExpense(expense({paymentMethod:"crypto" as Expense["paymentMethod"]}),"b1")).toContain("payment method");
  expect(validateExpense(expense({incurredAt:"invalid"}),"b1")).toContain("date");
 });
});
