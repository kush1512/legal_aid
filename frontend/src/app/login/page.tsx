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
        <div className="space-y-3">
          <Notice tone="warn" title="Sign-in isn’t configured">
            Supabase sign-in is not enabled for this prototype. You can continue as a guest for the demo; no email or password is required.
          </Notice>
          {config.apiMode === "real" && config.devUserId ? (
            <Card className="space-y-3">
              <div>
                <h2 className="font-semibold text-navy">Continue as guest</h2>
                <p className="mt-1 text-sm text-navy/75">
                  This local demo uses a shared development identity. Do not use it for private or real legal matters.
                </p>
              </div>
              <Button type="button" className="w-full" onClick={() => router.replace("/")}>
                Continue as guest
              </Button>
              <p className="text-xs text-navy/60">
                Guest access works only when the backend has development authentication bypass enabled. It must never be enabled in production.
              </p>
            </Card>
          ) : (
            <Notice tone="info">
              Guest access is unavailable because no development identity is configured. Use demo mode or configure Supabase Auth.
            </Notice>
          )}
        </div>
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
