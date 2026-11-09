export type CommissionType="percentage"|"fixed";
export function calculateCommission(servicePrice:number,type:CommissionType,value:number):number{
 if(!Number.isFinite(servicePrice)||servicePrice<0||!Number.isFinite(value)||value<0||(type==="percentage"&&value>100))throw new Error("Invalid commission inputs.");
 const amount=type==="percentage"?servicePrice*value/100:value;
 return Number(amount.toFixed(2));
}
