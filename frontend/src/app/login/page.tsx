"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { config, isMock } from "@/lib/config";
import { isAuthConfigured, signInWithPassword } from "@/lib/auth";
import { Button, Card, Field, Notice, PageHeader, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await signInWithPassword(email.trim(), password); router.push("/"); }
    catch (x) { setErr(x instanceof Error ? x.message : "Sign-in failed."); } finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Sign in" subtitle="Your account identity is private and is never shown in public areas." />
      {isMock && <Notice tone="mock" className="mb-4">Demo mode is on, so no sign-in is needed.</Notice>}
      {!isAuthConfigured() ? (
        <Notice tone="warn" title="Sign-in isn’t configured">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable Supabase sign-in.{config.devUserId ? " A development user ID is configured and will be sent instead." : " For local development against a backend with DEV_AUTH_BYPASS, set NEXT_PUBLIC_DEV_USER_ID."}</Notice>
      ) : (
        <Card><form onSubmit={submit} className="space-y-4">
          {err && <Notice tone="danger">{err}</Notice>}
          <Field id="em" label="Email"><input id="em" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field id="pw" label="Password"><input id="pw" type="password" autoComplete="current-password" required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" loading={busy} className="w-full">Sign in</Button>
        </form></Card>)}
    </div>
  );
}
