import {describe,expect,it} from "vitest";
import {calculateCommission} from "./commission";
describe("calculateCommission",()=>{
 it("calculates percentage commission",()=>expect(calculateCommission(120,"percentage",20)).toBe(24));
 it("rounds percentage commission to two decimals",()=>expect(calculateCommission(99.99,"percentage",12.5)).toBe(12.5));
 it("supports fixed commission per completed appointment",()=>expect(calculateCommission(80,"fixed",15)).toBe(15));
 it("allows zero commission",()=>expect(calculateCommission(80,"percentage",0)).toBe(0));
 it("rejects invalid rates and amounts",()=>{expect(()=>calculateCommission(80,"percentage",101)).toThrow();expect(()=>calculateCommission(-1,"fixed",2)).toThrow();expect(()=>calculateCommission(80,"fixed",-1)).toThrow();});
});
