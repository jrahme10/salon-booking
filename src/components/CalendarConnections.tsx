import {useCallback,useEffect,useState} from "react";
import {apiRequest} from "../services/auth";

type Connection={id:string;provider:"google"|"apple";accountLabel:string|null;status:"pending"|"connected"|"attention_required"|"disconnected";lastSyncAt:string|null};
const resultMessages:Record<string,string>={
 google_connected:"Google Calendar connected.",
 google_setup_required:"Google Calendar setup is incomplete. Server credentials are required.",
 google_link_expired:"The Google connection link expired. Please try again.",
 google_token_failed:"Google did not return offline access. Please reconnect and approve access.",
 google_connection_failed:"Google Calendar could not be connected."
};
export function CalendarConnections(){
 const [connections,setConnections]=useState<Connection[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [appleGuideOpen,setAppleGuideOpen]=useState(false);
 const load=useCallback(async()=>{
  try{const result=await apiRequest<{connections:Connection[]}>("/provider/calendar/connections");setConnections(result.connections);}
  catch(e){setError(e instanceof Error?e.message:"Could not load calendar connections.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  void load();
  const params=new URLSearchParams(window.location.search);
  const result=params.get("calendar");
  if(result){
   if(window.opener){window.opener.postMessage({type:"salon-calendar-oauth-result",result},window.location.origin);window.close();return;}
   if(result==="google_connected")setNotice("Google Calendar connected. Refreshing your workspace…");
   else if(resultMessages[result])setError(resultMessages[result]);
   params.delete("calendar");const query=params.toString();
   window.history.replaceState({},"",window.location.pathname+(query?"?"+query:"")+window.location.hash);
  }
 },[load]);
 useEffect(()=>{
  const onMessage=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.data?.type!=="salon-calendar-oauth-result")return;
   if(event.data.result==="google_connected"){window.location.reload();return;}
   setError(resultMessages[event.data.result]??"Google Calendar could not be connected.");setBusy("");
  };
  window.addEventListener("message",onMessage);
  return()=>window.removeEventListener("message",onMessage);
 },[]);
 const googleConnection=connections.find(item=>item.provider==="google"&&item.status!=="disconnected");
 const connectGoogle=async()=>{
  const popup=window.open("about:blank","salon-google-calendar","popup=yes,width=560,height=720,left=200,top=80");
  setBusy("google");setError("");
  try{
   const result=await apiRequest<{authorizationUrl:string}>("/provider/calendar/google/start",{method:"POST"});
   if(popup){popup.location.href=result.authorizationUrl;popup.focus();}
   else window.location.assign(result.authorizationUrl);
  }catch(e){popup?.close();setError(e instanceof Error?e.message:"Could not start Google Calendar connection.");setBusy("");}
 };
 const disconnect=async(id:string)=>{
  setBusy(id);setError("");
  try{await apiRequest("/provider/calendar/connections/"+id,{method:"DELETE"});await load();}
  catch(e){setError(e instanceof Error?e.message:"Could not disconnect Google Calendar.");}
  finally{setBusy("");}
 };
 const statusText=(item?:Connection)=>!item?"Not connected":item.status==="connected"?"Connected":item.status==="attention_required"?"Needs attention":item.status==="pending"?"Connecting…":"Disconnected";
 return <>
  <div className="calendar-provider-grid calendar-provider-grid-bridge">
   <article className="calendar-provider-card">
    <div className="calendar-provider-brand google-calendar-mark">31</div>
    <div className="calendar-provider-copy"><b>Google Calendar</b><small>Connect your Google account to Salon Reservation</small><span className="calendar-connection-status"><i style={{background:googleConnection?.status==="connected"?"#533234":googleConnection?.status==="attention_required"?"#d49a36":undefined}}/>{statusText(googleConnection)}{googleConnection?.accountLabel?" · "+googleConnection.accountLabel:""}</span></div>
    {googleConnection?<button type="button" className="secondary" disabled={busy===googleConnection.id} onClick={()=>void disconnect(googleConnection.id)}>{busy===googleConnection.id?"…":"Disconnect"}</button>:<button type="button" className="secondary" disabled={loading||!!busy} onClick={()=>void connectGoogle()}>{busy==="google"?"Connecting…":"Connect"}</button>}
   </article>
   <article className="calendar-provider-card">
    <div className="calendar-provider-brand apple-calendar-mark"><small>CALENDAR</small><b></b></div>
    <div className="calendar-provider-copy"><b>Apple Calendar</b><small>Display the same Google account in the iPhone Calendar app</small><span className="calendar-connection-status"><i style={{background:googleConnection?.status==="connected"?"#533234":undefined}}/>{googleConnection?.status==="connected"?"Ready for iPhone setup":"Requires Google Calendar"}</span></div>
    <button type="button" className="secondary" onClick={()=>setAppleGuideOpen(value=>!value)}>{appleGuideOpen?"Close guide":"Setup guide"}</button>
   </article>
  </div>
  {appleGuideOpen&&<section className="calendar-apple-guide" aria-label="Set up Apple Calendar">
   <div className="calendar-apple-guide-heading"><div><small>APPLE CALENDAR SETUP</small><h3>Use your Google calendar on iPhone</h3></div><span></span></div>
   {!googleConnection&&<div className="calendar-apple-guide-first"><p>First connect Google Calendar to Salon Reservation. You will use that same Google account on your iPhone.</p><button type="button" className="primary" disabled={loading||!!busy} onClick={()=>void connectGoogle()}>{busy==="google"?"Connecting…":"Connect Google Calendar"}</button></div>}
   <ol>
    <li><b>Open Settings on your iPhone</b><span>Go to Settings → Apps → Calendar → Calendar Accounts.</span></li>
    <li><b>Add your Google account</b><span>Tap Add Account → Google, then sign in with the same Google account connected above.</span></li>
    <li><b>Enable Calendars</b><span>Make sure the Calendars switch is turned on, then open the Apple Calendar app.</span></li>
   </ol>
   <p className="calendar-apple-guide-note"><b>Important:</b> This makes calendars stored in your Google account visible in Apple Calendar. Salon Reservation's appointment-to-Google event synchronization is not enabled yet, so appointments created in Salon Reservation will not appear there until that backend sync is implemented.</p>
  </section>}
  {notice&&<p className="settings-success" role="status">{notice}</p>}
  {error&&<p className="dialog-error" role="alert">{error}</p>}
 </>;
}
