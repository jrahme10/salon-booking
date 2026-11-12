import {useCallback,useEffect,useState} from "react";
import type {FormEvent} from "react";
import {apiRequest} from "../services/auth";

type Connection={id:string;provider:"google"|"apple";accountLabel:string|null;status:"pending"|"connected"|"attention_required"|"disconnected";lastSyncAt:string|null};
export function CalendarConnections(){
 const [connections,setConnections]=useState<Connection[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [appleOpen,setAppleOpen]=useState(false);
 const [appleId,setAppleId]=useState("");
 const [appPassword,setAppPassword]=useState("");
 const load=useCallback(async()=>{try{const result=await apiRequest<{connections:Connection[]}>("/provider/calendar/connections");setConnections(result.connections);}catch(e){setError(e instanceof Error?e.message:"Could not load calendar connections.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();const params=new URLSearchParams(window.location.search);const result=params.get("calendar");if(result){const messages:Record<string,string>={google_connected:"Google Calendar connected. Initial synchronization will begin shortly.",google_setup_required:"Google Calendar setup is incomplete. Server credentials are required.",google_link_expired:"The Google connection link expired. Please try again.",google_token_failed:"Google did not return offline access. Please reconnect and approve access.",google_connection_failed:"Google Calendar could not be connected."};if(messages[result])setError(messages[result]);if(result==="google_connected")void load();params.delete("calendar");const query=params.toString();window.history.replaceState({}, "",window.location.pathname+(query?"?"+query:"")+window.location.hash);}},[load]);
 const connectGoogle=async()=>{setBusy("google");setError("");try{const result=await apiRequest<{authorizationUrl:string}>("/provider/calendar/google/start",{method:"POST"});window.location.assign(result.authorizationUrl);}catch(e){setError(e instanceof Error?e.message:"Could not start Google Calendar connection.");setBusy("");}};
 const connectApple=async(event:FormEvent)=>{event.preventDefault();setBusy("apple");setError("");try{await apiRequest("/provider/calendar/apple",{method:"POST",body:JSON.stringify({appleId,appSpecificPassword:appPassword})});setAppleId("");setAppPassword("");setAppleOpen(false);await load();}catch(e){setError(e instanceof Error?e.message:"Could not connect Apple Calendar.");}finally{setBusy("");}};
 const disconnect=async(id:string)=>{setBusy(id);setError("");try{await apiRequest("/provider/calendar/connections/"+id,{method:"DELETE"});await load();}catch(e){setError(e instanceof Error?e.message:"Could not disconnect calendar.");}finally{setBusy("");}};
 const connection=(provider:"google"|"apple")=>connections.find(item=>item.provider===provider&&item.status!=="disconnected");
 const statusText=(item?:Connection)=>!item?"Not connected":item.status==="connected"?"Connected":item.status==="attention_required"?"Needs attention":item.status==="pending"?"Connecting…":"Disconnected";
 return <><div className="calendar-provider-grid">
  {(["google","apple"] as const).map(provider=>{const item=connection(provider);return <article className="calendar-provider-card" key={provider}>
   <div className={"calendar-provider-brand "+(provider==="google"?"google-calendar-mark":"apple-calendar-mark")}>{provider==="google"?"31":<><small>WED</small><b>11</b></>}</div>
   <div className="calendar-provider-copy"><b>{provider==="google"?"Google Calendar":"Apple Calendar"}</b><small>{provider==="google"?"Google account · events and busy times":"iCloud account · CalDAV calendar sync"}</small><span className="calendar-connection-status"><i style={{background:item?.status==="connected"?"#39966a":item?.status==="attention_required"?"#d49a36":undefined}}/>{statusText(item)}{item?.accountLabel?" · "+item.accountLabel:""}</span></div>
   {item?<button type="button" className="secondary" disabled={busy===item.id} onClick={()=>void disconnect(item.id)}>{busy===item.id?"…":"Disconnect"}</button>:<button type="button" className="secondary" disabled={loading||!!busy} onClick={()=>provider==="google"?void connectGoogle():setAppleOpen(true)}>{busy===provider?"Connecting…":"Connect"}</button>}
  </article>;})}
 </div>
 {appleOpen&&<form className="calendar-apple-form" onSubmit={connectApple}>
  <label>Apple Account email<input type="email" required autoComplete="username" value={appleId} onChange={e=>setAppleId(e.target.value)} placeholder="you@example.com"/></label>
  <label>App-specific password<input type="password" required autoComplete="new-password" value={appPassword} onChange={e=>setAppPassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx"/></label>
  <small>Create an app-specific password at account.apple.com under Sign-In and Security. Your password is sent only to the secure salon API and is encrypted before storage.</small>
  <div><button type="submit" className="primary" disabled={busy==="apple"}>{busy==="apple"?"Connecting…":"Connect Apple Calendar"}</button><button type="button" className="secondary" onClick={()=>setAppleOpen(false)}>Cancel</button></div>
 </form>}
 {error&&<p className="dialog-error" role="alert">{error}</p>}
 </>;
}
