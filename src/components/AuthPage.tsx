import {useState} from "react";
import type {FormEvent} from "react";
import {Eye,EyeOff,ArrowUpRight,Sparkles} from "lucide-react";
import {loginOwner,registerOwner} from "../services/auth";
import type {AuthSession} from "../services/auth";

function SalonLogo(){
 return <a className="auth-brand" href="/salon-booking/" aria-label="Salon Business Studio home">
  <span className="auth-brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 5.5c-2.7 6.8-10.8 9.2-10.8 17.1 0 5.8 4.8 9.1 10.8 9.1s10.8-3.3 10.8-9.1C34.8 14.7 26.7 12.3 24 5.5Z" stroke="currentColor" strokeWidth="1.55"/><path d="M24 31.7c-7.2 0-11.6 3.2-11.6 7.4M24 31.7c7.2 0 11.6 3.2 11.6 7.4M24 14.5v18.2M18.8 21.2c1.8 2.4 3.5 3.6 5.2 3.6s3.4-1.2 5.2-3.6" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round"/></svg></span>
  <span className="auth-brand-type"><b>salon</b><small>BUSINESS STUDIO</small></span>
 </a>;
}

export function AuthPage({onAuthenticated}:{onAuthenticated:(session:AuthSession)=>void}){
 const [mode,setMode]=useState<"login"|"register">("register");
 const [name,setName]=useState(""),[business,setBusiness]=useState(""),[city,setCity]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[showPassword,setShowPassword]=useState(false);
 const isRegister=mode==="register";
 const submit=async(event:FormEvent)=>{
  event.preventDefault();setBusy(true);setError("");
  try{
   const session=isRegister
    ?await registerOwner({displayName:name,email,password,businessName:business,city})
    :await loginOwner(email,password);
   onAuthenticated(session);
  }catch(e){setError(e instanceof Error?e.message:"Something went wrong.");}
  finally{setBusy(false);}
 };
 const changeMode=(next:"login"|"register")=>{setMode(next);setError("");setShowPassword(false);};
 return <main className="auth-screen">
  <section className="auth-shell">
   <aside className="auth-story">
    <SalonLogo/>
    <div className="auth-story-copy">
     <span className="auth-overline"><i/> THE SPACE BEHIND YOUR BEST WORK</span>
     <h1>Make room for<br/><em>beautiful work.</em></h1>
     <p>One calm place to manage your appointments, your team, and the little details that keep your salon running smoothly.</p>
    </div>
    <div className="auth-story-bottom">
     <div className="auth-orbit-art" aria-hidden="true"><Sparkles size={19}/><i/><b/></div>
     <div><strong>Everything in its place.</strong><small>Your salon, in sync.</small></div>
     <span className="auth-story-index">01 / 03</span>
    </div>
   </aside>
   <section className="auth-panel">
    <div className="auth-panel-top"><span>{isRegister?"GET STARTED":"WELCOME BACK"}</span><span className="auth-secure"><i/> SECURE OWNER ACCESS</span></div>
    <div className="auth-heading">
     <small>{isRegister?"START YOUR NEXT CHAPTER":"YOUR WORKSPACE AWAITS"}</small>
     <h2>{isRegister?"Create your account":"Good to see you again."}</h2>
     <p>{isRegister?"Set up your salon space in just a few steps.":"Sign in to pick up right where you left off."}</p>
    </div>
    <div className="auth-tabs" role="tablist" aria-label="Account access">
     <button type="button" role="tab" aria-selected={isRegister} className={isRegister?"active":""} onClick={()=>changeMode("register")}>Create account</button>
     <button type="button" role="tab" aria-selected={!isRegister} className={!isRegister?"active":""} onClick={()=>changeMode("login")}>Sign in</button>
    </div>
    <form className="auth-form" onSubmit={submit}>
     {isRegister&&<div className="auth-form-grid">
      <label>Your name<input autoComplete="name" required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label>
      <label>Salon name<input autoComplete="organization" required value={business} onChange={e=>setBusiness(e.target.value)} placeholder="e.g. Studio Belle"/></label>
      <label className="auth-full-field">City<input autoComplete="address-level2" required value={city} onChange={e=>setCity(e.target.value)} placeholder="e.g. Antelias"/></label>
     </div>}
     <label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
     <label>Password
      <span className="auth-password-wrap"><input type={showPassword?"text":"password"} autoComplete={isRegister?"new-password":"current-password"} minLength={isRegister?12:1} required value={password} onChange={e=>setPassword(e.target.value)} placeholder={isRegister?"At least 12 characters":"Enter your password"}/><button type="button" className="auth-password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} title={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>
      {isRegister&&<small className="auth-hint">Use at least 12 characters.</small>}
     </label>
     {error&&<p className="auth-error" role="alert">{error}</p>}
     <button className="auth-submit" disabled={busy}>{busy?"Please wait…":isRegister?"Create owner account":"Sign in to your salon"}<ArrowUpRight size={18}/></button>
    </form>
    <p className="auth-foot">{isRegister?"By creating an account, you can start organizing your salon in one place.":"Your salon workspace is ready when you are."}<br/><span className="auth-legal-links"><a href="/salon-booking/privacy-policy.html" target="_blank" rel="noreferrer">Privacy Policy</a><span aria-hidden="true">·</span><a href="/salon-booking/terms-and-conditions.html" target="_blank" rel="noreferrer">Terms &amp; Conditions</a></span></p>
   </section>
  </section>
 </main>;
}
