import {Plus} from "lucide-react";
export function Heading({kicker,title,desc,action,onAction}:{kicker:string;title:string;desc:string;action?:string;onAction?:()=>void}){return <div className="heading"><div><small>{kicker}</small><h1>{title}</h1><p>{desc}</p></div>{action&&<button className="primary" onClick={onAction}><Plus size={16}/>{action}</button>}</div>}
