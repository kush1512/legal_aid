"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Download, Printer, Sparkles } from "lucide-react";
import { api, describeError, type DocumentType, type GeneratedDraft } from "@/lib/api";
import { DOCUMENT_TYPES, LANGUAGES, categoryShort, consentKey } from "@/lib/constants";
import { useAsync } from "@/lib/hooks/useAsync";
import { readJson } from "@/lib/local/store";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Field, Notice, PageHeader, PrivacyHint, inputCls } from "@/components/ui";
import { ConsentCheckbox, MockAiBadge } from "@/components/domain";

const STEPS = ["Gathering your case details", "Drafting the document", "Marking details you must fill in", "Ready for your review"];

function Studio() {
  const sp = useSearchParams();
  const { prefs } = useApp();
  const cases = useAsync(() => api.listCases({ limit: 50 }), []);
  const [type, setType] = useState<DocumentType>("legal_notice");
  const [caseId, setCaseId] = useState(sp.get("case") ?? "");
  const [instructions, setInstructions] = useState("");
  const [language, setLanguage] = useState(prefs.language);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const selected = cases.data?.items.find((c) => c.id === caseId);
  useEffect(() => { if (caseId) setConsent(readJson<{ consent?: boolean } | null>(consentKey(caseId), null, "session")?.consent ?? false); }, [caseId]);
  useEffect(() => setLanguage(prefs.language), [prefs.language]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setDraft(null); setStep(0);
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 2)), 1100);
    try {
      const r = await api.generateDocument({ document_type: type, case_id: caseId || undefined, instructions: instructions.trim() || undefined, language, external_ai_consent: consent });
      setDraft(r.draft); setText(r.draft.content); setStep(STEPS.length - 1);
    } catch (err) { setError(err); setStep(-1); } finally { clearInterval(tick); setBusy(false); }
  }

  const remaining = Array.from(new Set(text.match(/\[[^\]\n]{2,60}\]/g) ?? []));
  const filename = `${(draft?.document_type ?? "draft")}.txt`;
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click(); URL.revokeObjectURL(url);
  }
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Document studio" subtitle="Create a first draft you can edit. Drafts are preliminary and are never filed or sent for you." />
        <form onSubmit={generate} className="space-y-5">
          <fieldset><legend className="mb-2 text-sm font-semibold">Document type</legend>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {DOCUMENT_TYPES.map((d) => (
                <label key={d.value} className={cn("cursor-pointer rounded-xl border bg-white p-3", type === d.value ? "border-teal ring-2 ring-teal/40" : "border-navy/15 hover:border-teal/60")}>
                  <input type="radio" name="dtype" className="sr-only" checked={type === d.value} onChange={() => setType(d.value)} />
                  <span className="block text-sm font-semibold">{d.label}</span><span className="block text-xs text-navy/75">{d.blurb}</span>
                </label>))}
            </div></fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="dcase" label="Base it on a case (optional)" hint="Without a case, the draft has blanks for you to fill in.">
              <select id="dcase" className={inputCls} value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">No case: blank template</option>
                {cases.data?.items.map((c) => <option key={c.id} value={c.id}>{categoryShort(c.category)}: {c.title.slice(0, 50)}</option>)}</select></Field>
            <Field id="dlang" label="Language"><select id="dlang" className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></Field>
          </div>
          <Field id="dins" label="What should it ask for? (optional)"><textarea id="dins" rows={3} maxLength={4000} className={inputCls} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Request delivery of vacant possession within a reasonable period." /></Field>
          <ConsentCheckbox id="dconsent" checked={consent} onChange={setConsent}>
            Allow an external AI service to use {selected ? "this case’s details" : "what I type here"} to write the draft.{selected?.sensitive && <> This case is <strong>sensitive</strong>; without consent the draft may be blocked.</>}
          </ConsentCheckbox>
          <Button type="submit" size="lg" icon={Sparkles} loading={busy}>Generate draft</Button>
        </form>

        {busy && (
          <div role="status" aria-live="polite" className="mt-6 rounded-xl2 border border-navy/10 bg-white p-5">
            <p className="mb-3 text-sm font-semibold">Working on your draft</p>
            <ol className="space-y-2">{STEPS.slice(0, -1).map((s, i) => <li key={s} className={cn("flex items-center gap-2 text-sm", i > step ? "text-navy/40" : i === step ? "font-semibold" : "text-navy/70")}>
              {i < step ? <CheckCircle2 className="h-4 w-4 text-teal-700" aria-hidden /> : <span className={cn("h-4 w-4 rounded-full border-2", i === step ? "animate-pulse border-teal" : "border-navy/20")} />}{s}</li>)}</ol>
          </div>)}
        {error != null && <Notice tone="danger" className="mt-6" title={describeError(error).title}>{describeError(error).hint}</Notice>}

        {draft && !busy && (
          <section aria-labelledby="draft-h" className="mt-8 space-y-4">
            <Notice tone="warn" title="Review required before you use this">This is a preliminary AI-assisted draft. It has not been checked by a lawyer, filed, signed or approved. Replace every bracketed detail and have it reviewed.</Notice>
            <div className="flex flex-wrap items-center gap-2"><h2 id="draft-h" className="text-xl font-semibold">{draft.title}</h2><MockAiBadge isMock={draft.model.is_mock} provider={draft.model.provider} model={draft.model.name} /></div>
            <label htmlFor="draft-text" className="sr-only">Edit your draft</label>
            <textarea id="draft-text" rows={18} value={text} onChange={(e) => setText(e.target.value)} className={cn(inputCls, "font-mono leading-relaxed")} spellCheck />
            <div aria-live="polite">{remaining.length > 0 ? <><p className="mb-1.5 text-sm font-semibold">{remaining.length} detail{remaining.length === 1 ? "" : "s"} still to fill in</p><div className="flex flex-wrap gap-1.5">{remaining.map((r) => <Badge key={r} tone="amber">{r}</Badge>)}</div></> : <Badge tone="teal" icon={CheckCircle2}>No placeholders left. Read it once more before use.</Badge>}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={Download} onClick={download}>Download .txt</Button>
              <Button variant="secondary" icon={Copy} onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print or save as PDF</Button>
            </div>
            <PrivacyHint>Edits stay in your browser. Nothing is sent anywhere when you download, copy or print.</PrivacyHint>
          </section>)}
      </div>
      {draft && <pre className="hidden whitespace-pre-wrap font-sans text-base print:block">{text}</pre>}
    </>
  );
}
export default function StudioPage() { return <Suspense fallback={<p className="text-sm">Loading…</p>}><Studio /></Suspense>; }
