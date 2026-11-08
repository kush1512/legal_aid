"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileUp, Lock, Paperclip, X } from "lucide-react";
import { api, describeError, type CaseCategory } from "@/lib/api";
import { CATEGORIES, DRAFT_KEY, INDIAN_STATES, LANGUAGES, consentKey, localDocsKey } from "@/lib/constants";
import { isMock } from "@/lib/config";
import { readJson, removeKey, writeJson } from "@/lib/local/store";
import { appendToTranscript } from "@/lib/local/transcripts";
import { cn, formatBytes } from "@/lib/utils";
import { useApp } from "@/components/AppProvider";
import { Button, Field, Notice, PageHeader, PrivacyHint, Switch, inputCls } from "@/components/ui";
import { CategoryIcon, ConsentCheckbox, VoiceRecorder } from "@/components/domain";
import { SimilarCasesPanel } from "@/components/SimilarCasesPanel";

const MIN = 5, MAX = 12000;

function Intake() {
  const router = useRouter();
  const sp = useSearchParams();
  const { prefs, updatePrefs } = useApp();
  const [category, setCategory] = useState<CaseCategory | "">((sp.get("category") as CaseCategory) || "");
  const [mode, setMode] = useState<"text" | "voice">(sp.get("mode") === "voice" ? "voice" : "text");
  const [description, setDescription] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice_transcription">("text");
  const [language, setLanguage] = useState(prefs.language);
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [sensitive, setSensitive] = useState(prefs.defaultSensitive);
  const [consent, setConsent] = useState(prefs.defaultExternalAiConsent);
  const [syntheticDemo, setSyntheticDemo] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const d = readJson<string>(DRAFT_KEY, "", "session"); if (d) { setDescription(d); removeKey(DRAFT_KEY, "session"); } }, []);
  useEffect(() => setLanguage(prefs.language), [prefs.language]);

  const catErr = touched && !category ? "Choose the closest category." : undefined;
  const descErr = touched && description.trim().length < MIN ? `Describe what happened in at least ${MIN} characters.` : description.length > MAX ? `Keep it under ${MAX} characters; you can add more later.` : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true); setError(null);
    if (!category || description.trim().length < MIN || description.length > MAX) return;
    setBusy(true);
    try {
      const res = await api.createCase({
        category, description: description.trim(), preferred_language: language, sensitive,
        jurisdiction: { country: "IN", ...(state && { state }), ...(district.trim() && { district: district.trim() }) },
        external_ai_consent: consent,
        synthetic_demo: syntheticDemo,
      });
      appendToTranscript(res.case.id, res.initial_message);
      writeJson(consentKey(res.case.id), { consent, inputMode }, "session");
      if (isMock && files.length) writeJson(localDocsKey(res.case.id), files.map((f) => ({ name: f.name, size: f.size, type: f.type, at: new Date().toISOString() })), "session");
      updatePrefs({ language }, { scope: `case ${consent ? "external AI allowed" : "external AI not allowed"}`, granted: consent });
      router.push(`/cases/${res.case.id}?tab=conversation&review=1`);
    } catch (err) { setError(err); setBusy(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <PageHeader title="Start a new case" subtitle="Share as much or as little as you like. You can add details later." />
      {error != null && <Notice tone="danger" title={describeError(error).title}>{describeError(error).hint}</Notice>}

      <fieldset>
        <legend className="mb-2 text-base font-semibold">1. What is it about?</legend>
        <div role="radiogroup" aria-label="Category" className="grid gap-2.5 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <label key={c.value} className={cn("flex cursor-pointer items-start gap-3 rounded-xl2 border bg-white p-3.5", category === c.value ? "border-teal ring-2 ring-teal/40" : "border-navy/15 hover:border-teal/60")}>
              <input type="radio" name="category" value={c.value} checked={category === c.value} onChange={() => setCategory(c.value)} className="sr-only" />
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mist text-teal-700"><CategoryIcon name={c.icon} className="h-4 w-4" /></span>
              <span><span className="block text-sm font-semibold">{c.label}</span><span className="block text-xs text-navy/75">{c.blurb}</span></span>
            </label>
          ))}
        </div>
        {catErr && <p role="alert" className="mt-1.5 text-sm font-medium text-danger">{catErr}</p>}
        <SimilarCasesPanel category={category} />
      </fieldset>

      <section aria-labelledby="s2" className="space-y-4">
        <h2 id="s2" className="text-base font-semibold">2. What happened?</h2>
        <div role="group" aria-label="Input method" className="inline-flex rounded-xl bg-navy/5 p-1">
          {(["text", "voice"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold", mode === m ? "bg-white shadow-card" : "text-navy/70")}>{m === "text" ? "Type" : "Speak"}</button>
          ))}
        </div>
        {mode === "voice" && <VoiceRecorder consent={consent} onTranscript={(t) => { setDescription((d) => (d ? d + "\n" : "") + t); setInputMode("voice_transcription"); setMode("text"); }} />}
        <Field id="desc" label="Describe the situation in your own words" error={descErr} hint="Include what happened, when, and what you want to achieve. Avoid sharing others’ phone numbers or Aadhaar details.">
          <textarea id="desc" rows={7} value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={Boolean(descErr)} aria-describedby={descErr ? "desc-err" : "desc-hint"} className={inputCls} />
          <p className="mt-1 text-right text-xs text-navy/60">{description.length}/{MAX}</p>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="lang" label="Language">
            <select id="lang" className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}</select></Field>
          <Field id="state" label="State (optional)">
            <select id="state" className={inputCls} value={state} onChange={(e) => setState(e.target.value)}><option value="">Not specified</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field id="district" label="District (optional)"><input id="district" className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} maxLength={80} /></Field>
        </div>
      </section>

      <section aria-labelledby="s3" className="space-y-3">
        <h2 id="s3" className="text-base font-semibold">3. Documents (optional)</h2>
        {isMock ? (
          <>
            <input ref={fileRef} type="file" multiple className="sr-only" id="docs" aria-label="Attach documents"
              onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 10)); e.target.value = ""; }} />
            <Button type="button" variant="secondary" icon={FileUp} onClick={() => fileRef.current?.click()}>Choose files</Button>
            <PrivacyHint>Demo mode: only the file names are kept, in this browser tab. Files are not uploaded anywhere.</PrivacyHint>
            {files.length > 0 && <ul className="space-y-1.5">{files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><Paperclip className="h-4 w-4 shrink-0 text-teal-700" aria-hidden /><span className="truncate">{f.name}</span><span className="text-xs text-navy/60">{formatBytes(f.size)}</span></span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X className="h-4 w-4" aria-hidden /></button></li>))}</ul>}
          </>
        ) : (
          <Notice tone="info" title="Document upload is not available yet">The API contract (v1.0.0) has no upload endpoint, so files can’t be attached here. Keep your documents ready; you can list them in your description.</Notice>
        )}
      </section>

      <section aria-labelledby="s4" className="space-y-4">
        <h2 id="s4" className="flex items-center gap-2 text-base font-semibold"><Lock className="h-4 w-4 text-teal-700" aria-hidden />4. Privacy and consent</h2>
        <Switch id="sensitive" checked={sensitive} onChange={setSensitive} label="Treat this case as sensitive"
          description="Turn this on for personal, confidential, or otherwise sensitive details. Sensitive cases are blocked from external AI even if consent is selected." />
        <Switch id="synthetic-demo" checked={syntheticDemo} onChange={setSyntheticDemo} label="This is a fictional demonstration case" description="Only select this for made-up test facts. When enabled, an allowlisted development account may send this case to Groq after you grant consent. Never use real names, addresses, account numbers or actual disputes." />
        <ConsentCheckbox id="consent" checked={consent} onChange={setConsent}>
          <strong>Allow an external AI service to process this case.</strong> If ticked, your description and later messages may be sent to an AI provider to prepare follow-up questions and an assessment. External AI is available only for cases the backend classifies as non-sensitive. Personal Safety & Privacy cases start in Private mode. Cases you mark sensitive or that contain detected personal identifiers are blocked from external AI. Leave it unticked to keep everything off external services; the assistant will then offer limited help. You can change this per message.
        </ConsentCheckbox>
        <p className="text-xs text-navy/70">Your name and contact details are not part of this form and are never shown publicly. Cases are visible only to your account.</p>
      </section>

      <div className="sticky bottom-20 z-10 -mx-4 border-t border-navy/10 bg-ivory/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border lg:bottom-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-navy/75">Creating a case saves your description to your private account.</p>
          <Button type="submit" size="lg" loading={busy}>Create case</Button>
        </div>
      </div>
    </form>
  );
}

export default function NewCasePage() {
  return <Suspense fallback={<p className="text-sm">Loading…</p>}><Intake /></Suspense>;
}
