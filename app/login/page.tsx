"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase environment variables are missing.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });
    setMessage(error ? error.message : "Check your email for a Marco sign-in link.");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-xl text-white">🧭</span>
          <div>
            <h1 className="font-display text-3xl font-bold">Marco</h1>
            <p className="text-sm text-slate-500">Private MVP sign in</p>
          </div>
        </div>
        <form onSubmit={signIn} className="space-y-4">
          <label className="block text-sm font-bold">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="mt-2 w-full rounded-lg border border-line px-3 py-2"
              placeholder="you@example.com"
            />
          </label>
          <button className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-black text-white">Send magic link</button>
          {message && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{message}</p>}
        </form>
      </section>
    </main>
  );
}
