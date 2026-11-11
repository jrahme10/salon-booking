export interface AuthSession {
  token:string;
  expiresAt:string;
  user:{id:string;displayName:string;email:string};
  business:{id:string;name:string;slug:string};
  role:"owner"|"admin"|"employee";
}
const API_URL=(import.meta.env.VITE_API_URL as string|undefined)?.replace(/\/$/,"")||"https://salon-booking.jrahme10.workers.dev";
const TOKEN_KEY="salon-reservation-session";
let current:AuthSession|null=null;
export function getAuthSession(){return current;}
export function setAuthSession(session:AuthSession|null){
  current=session;
  if(typeof sessionStorage!=="undefined"){
    if(session)sessionStorage.setItem(TOKEN_KEY,JSON.stringify(session));
    else sessionStorage.removeItem(TOKEN_KEY);
  }
}
export async function restoreAuthSession():Promise<AuthSession|null>{
  if(typeof sessionStorage==="undefined")return null;
  const raw=sessionStorage.getItem(TOKEN_KEY);
  if(!raw)return null;
  try{
    const saved=JSON.parse(raw) as AuthSession;
    if(!saved.token||new Date(saved.expiresAt).getTime()<=Date.now()){setAuthSession(null);return null;}
    const response=await fetch(API_URL+"/auth/me",{headers:{Authorization:"Bearer "+saved.token}});
    if(!response.ok){setAuthSession(null);return null;}
    const data=await response.json() as Omit<AuthSession,"token"|"expiresAt">;
    current={...saved,...data};
    return current;
  }catch{setAuthSession(null);return null;}
}
async function authRequest(path:string,body:Record<string,string>):Promise<AuthSession>{
  const response=await fetch(API_URL+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json() as AuthSession&{error?:string};
  if(!response.ok)throw new Error(data.error||"Authentication failed. Please try again.");
  setAuthSession(data);
  return data;
}
export function registerOwner(input:{displayName:string;email:string;password:string;businessName:string;city:string}){
  return authRequest("/auth/register",input);
}
export function loginOwner(email:string,password:string){return authRequest("/auth/login",{email,password});}
export async function logout(){
  const token=current?.token;
  if(token)try{await fetch(API_URL+"/auth/logout",{method:"POST",headers:{Authorization:"Bearer "+token}});}catch{/* Local logout must still work offline. */}
  setAuthSession(null);
}

export async function apiRequest<T>(path:string,init:RequestInit={}):Promise<T>{
  const token=current?.token;
  if(!token)throw new Error("Your session has expired. Please sign in again.");
  const headers=new Headers(init.headers);
  headers.set("Authorization","Bearer "+token);
  if(init.body&&!headers.has("Content-Type"))headers.set("Content-Type","application/json");
  const response=await fetch(API_URL+path,{...init,headers});
  const data=await response.json().catch(()=>({error:"The server returned an invalid response."})) as T&{error?:string};
  if(!response.ok)throw new Error(data.error||"The request could not be completed.");
  return data;
}
