import type {Appointment,Expense,Payment,Service} from "../types";

export function validatePayment(payment:Payment,appointment:Appointment,service:Service,existing:Payment[]):string|null{
  if(!payment.id.trim()||!payment.businessId.trim()||payment.businessId!==appointment.businessId)return "Payment business does not match the appointment.";
  if(payment.appointmentId!==appointment.id)return "Payment must belong to the selected appointment.";
  if(!Number.isFinite(payment.amount)||payment.amount<=0)return "Enter a payment amount greater than zero.";
  if(!["cash","card","bank_transfer","other"].includes(payment.method))return "Choose a valid payment method.";
  if(!Number.isFinite(new Date(payment.paidAt).getTime()))return "Choose a valid payment date.";
  const alreadyRecorded=existing.filter(row=>row.appointmentId===appointment.id).reduce((sum,row)=>sum+row.amount,0);
  const remaining=Math.max(0,service.price-appointment.paidAmount-alreadyRecorded);
  if(payment.amount>remaining+0.000001)return "Payment exceeds the remaining appointment balance.";
  return null;
}

export function validateExpense(expense:Expense,businessId:string):string|null{
  if(!expense.id.trim()||expense.businessId!==businessId)return "Expense business is invalid.";
  if(!Number.isFinite(expense.amount)||expense.amount<=0)return "Enter an expense amount greater than zero.";
  if(!expense.description.trim())return "Add a description for this expense.";
  if(!["rent","salary","supplies","utilities","maintenance","marketing","other"].includes(expense.category))return "Choose a valid expense category.";
  if(!["cash","card","bank_transfer","other"].includes(expense.paymentMethod))return "Choose a valid payment method.";
  if(!Number.isFinite(new Date(expense.incurredAt).getTime()))return "Choose a valid expense date.";
  return null;
}
