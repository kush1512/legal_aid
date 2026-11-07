"use client";
import { useState } from "react";
import { Activity, EyeOff, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { api, describeError, type HealthStatus } from "@/lib/api";
import { LANGUAGES } from "@/lib/constants";
import { config, isMock } from "@/lib/config";
import { DEFAULT_PREFS } from "@/lib/local/prefs";
import { resetMockData } from "@/lib/mock/api";
import { formatDate } from "@/lib/utils";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Field, Notice, PageHeader, Switch, inputCls } from "@/components/ui";

export default function ProfilePage() {
  const { prefs, updatePrefs, session, signOut } = useApp();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [hErr, setHErr] = useState<unknown>(null); const [checking, setChecking] = useState(false);
  const [cleared, setCleared] = useState(false);

  async function check() { setChecking(true); setHErr(null); try { setHealth(await api.health()); } catch (e) { setHErr(e); setHealth(null); } finally { setChecking(false); } }
  function clearLocal() {
    try { Object.keys(localStorage).filter((k) => k.startsWith("la.")).forEach((k) => localStorage.removeItem(k)); Object.keys(sessionStorage).filter((k) => k.startsWith("la.")).forEach((k) => sessionStorage.removeItem(k)); } catch {}
    if (isMock) resetMockData();
    updatePrefs({ ...DEFAULT_PREFS }); setCleared(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile and privacy" subtitle="Control what is shared, with whom, and when." />

      <Card as="section" aria-labelledby="id-h"><h2 id="id-h" className="mb-3 flex items-center gap-2 text-lg font-semibold"><EyeOff className="h-5 w-5 text-teal-700" aria-hidden />Identity: private vs public</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-mist/60 p-3 text-sm"><p className="font-semibold">Account (private)</p><p className="text-navy/85">{isMock ? "Demo user" : session?.email ?? "Not signed in"}</p><p className="mt-1 text-xs text-navy/70">Used only to keep your cases yours. Never shown in community or to lawyers unless you choose.</p></div>
          <div className="rounded-xl bg-ivory-200 p-3 text-sm"><p className="font-semibold">Public name</p><p className="text-navy/85">{prefs.defaultAnonymousPosting ? "Anonymous" : "Community member"}</p><p className="mt-1 text-xs text-navy/70">What others see on your posts and comments. Anonymity is a display option, not a guarantee.</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{session ? <Button variant="secondary" icon={LogOut} onClick={signOut}>Sign out</Button> : !isMock && <Button href="/login" variant="secondary">Sign in</Button>}</div>
      </Card>

      <Card as="section" aria-labelledby="lang-h" className="space-y-3"><h2 id="lang-h" className="text-lg font-semibold">Language</h2>
        <Field id="plang" label="Preferred language for cases and drafts" hint="Used when you start cases and generate documents. The app interface is currently in English."><select id="plang" className={inputCls} value={prefs.language} onChange={(e) => updatePrefs({ language: e.target.value })}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}</select></Field></Card>

      <Card as="section" aria-labelledby="priv-h" className="space-y-5"><h2 id="priv-h" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden />Privacy controls</h2>
        <Switch id="p-sens" checked={prefs.defaultSensitive} onChange={(v) => updatePrefs({ defaultSensitive: v })} label="Mark new cases as sensitive by default" description="Sensitive cases are kept away from external AI unless you allow it." />
        <Switch id="p-anon" checked={prefs.defaultAnonymousPosting} onChange={(v) => updatePrefs({ defaultAnonymousPosting: v })} label="Post anonymously by default" description="You can still change this on each post or comment." />
        <Switch id="p-agg" checked={prefs.shareAggregateInsights} onChange={(v) => updatePrefs({ shareAggregateInsights: v }, { scope: "aggregate insights", granted: v })} label="Contribute to anonymous aggregate insights" description="Preference saved on this device. It has no effect until the backend supports it." />
      </Card>

      <Card as="section" aria-labelledby="cons-h" className="space-y-4"><h2 id="cons-h" className="text-lg font-semibold">Consent management</h2>
        <Switch id="p-ai" checked={prefs.defaultExternalAiConsent} onChange={(v) => updatePrefs({ defaultExternalAiConsent: v }, { scope: "default: external AI processing", granted: v })} label="Pre-tick “allow external AI” on new messages" description="Off by default. Even when on, every case and message shows the checkbox so you can untick it." />
        <div><p className="mb-1.5 text-sm font-semibold">Consent history on this device</p>
          {prefs.consentLog.length === 0 ? <p className="text-sm text-navy/70">No consent choices recorded yet.</p> : <ul className="space-y-1 text-sm">{prefs.consentLog.slice(0, 8).map((c, i) => <li key={i} className="flex items-center gap-2"><Badge tone={c.granted ? "amber" : "teal"}>{c.granted ? "Allowed" : "Declined"}</Badge>{c.scope}<span className="text-xs text-navy/60">{formatDate(c.at, true)}</span></li>)}</ul>}</div>
        <Button variant="secondary" size="sm" onClick={() => updatePrefs({ defaultExternalAiConsent: false, consentLog: [] }, { scope: "all defaults withdrawn", granted: false })}>Withdraw default consent</Button>
      </Card>

      <Card as="section" aria-labelledby="acc-h" className="space-y-4"><h2 id="acc-h" className="text-lg font-semibold">Account and data</h2>
        {cleared && <Notice tone="info">Local data on this device was cleared.</Notice>}
        <Button variant="danger" icon={Trash2} onClick={clearLocal}>Clear data stored on this device</Button>
        <p className="text-xs text-navy/70">Clears preferences, local community activity and session transcripts{isMock ? ", and resets the demo cases" : ""}. Cases saved on the server are not affected, and the API has no account-deletion endpoint yet.</p></Card>

      <Card as="section" aria-labelledby="conn-h" className="space-y-3"><h2 id="conn-h" className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-teal-700" aria-hidden />Connection</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-navy/60">Mode</dt><dd className="font-medium">{isMock ? "Demo (mock API)" : "Live API"}</dd></div><div><dt className="text-navy/60">API address</dt><dd className="break-all font-medium">{isMock ? "Not used in demo mode" : `${config.apiBaseUrl}${config.apiPrefix}`}</dd></div></dl>
        <Button variant="secondary" size="sm" loading={checking} onClick={check}>Check connection</Button>
        {health && <Notice tone="info" title={`Status: ${health.status}`}>Version {health.version} · {health.environment} · database {health.dependencies.database} · AI {health.dependencies.llm} · embeddings {health.dependencies.embeddings}</Notice>}
        {hErr != null && <Notice tone="danger" title={describeError(hErr).title}>{describeError(hErr).hint}</Notice>}
      </Card>
    </div>
  );
}
