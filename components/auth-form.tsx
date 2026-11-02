"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function AuthForm({mode}:{mode:"login"|"signup"}) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase=createClient();
      const result= mode==="signup" ? await supabase.auth.signUp({email,password}) : await supabase.auth.signInWithPassword({email,password});
      if(result.error) throw result.error;
      setMessage(mode==="signup" ? "Account request submitted. Check your email if confirmation is enabled." : "Signed in. You can return to the dashboard.");
    } catch(err) { setMessage(err instanceof Error ? err.message : "Supabase configuration is missing."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="card" style={{display:"grid",gap:14,marginTop:24}}>
    <label className="muted">Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
    <label className="muted">Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
    <button className="btn primary" disabled={busy}>{busy?"Please wait…":mode==="signup"?"Create account":"Sign in"}</button>
    {message && <p className="muted" role="status">{message}</p>}
  </form>;
}
const field:React.CSSProperties={display:"block",width:"100%",marginTop:7,padding:12,borderRadius:10,border:"1px solid #354466",background:"#0b1220",color:"#fff"};

