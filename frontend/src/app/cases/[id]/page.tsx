"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, FileText, Lock, Paperclip, Send, User } from "lucide-react";
import { api, describeError, ApiError, type CaseMessage, type SendMessageResponse } from "@/lib/api";
import { LANGUAGES, STATUS_META, categoryLabel, consentKey, localDocsKey } from "@/lib/constants";
import { isMock } from "@/lib/config";
import { useAsync } from "@/lib/hooks/useAsync";
import { readJson, writeJson } from "@/lib/local/store";
import { appendToTranscript, loadTranscript } from "@/lib/local/transcripts";
import { cn, formatBytes, formatDate, timeAgo } from "@/lib/utils";
import { AssessmentView } from "@/components/AssessmentView";
import { Badge, Button, EmptyState, ErrorState, LoadingBlock, Notice, ProgressBar, Tabs, inputCls } from "@/components/ui";
import { ConsentCheckbox, MockAiBadge, VoiceRecorder } from "@/components/domain";
import { useApp } from "@/components/AppProvider";
import { CaseSupportPanel } from "@/components/CaseSupportPanel";

type Tab = "assessment" | "conversation" | "timeline" | "documents";
const REVIEW_PROMPT = "Please review my description and tell me what else you need to know.";
const NEXT_STEPS_PROMPT = "Based only on the facts I have shared in this case, give me a prioritised, practical action plan for what I should do next under Indian law. Separate immediate steps (today/next 48 hours), steps for the next 7 days, and later options. For each step, explain what to do, where or with whom to do it, what evidence or documents to preserve, and any important deadline or risk. Identify which facts are still missing. Use applicable verified legal sources where available, distinguish general information from legal advice, and do not invent procedures, deadlines, authorities or remedies.";

function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { prefs } = useApp();
  const c = useAsync(() => api.getCase(id), [id]);
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "assessment");
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice_transcription">("text");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const ranReview = useRef(false);
  const assessment = useAsync(() => api.getAssessment(id), [id, status]);
  const docs = useAsync(() => api.listCaseDocuments(id), [id]);

  useEffect(() => {
    setConsentLoaded(false);
    ranReview.current = false;
    setMessages(loadTranscript(id));
    const stored = readJson<{ consent?: boolean } | null>(consentKey(id), null, "session");
    setConsent(stored?.consent ?? prefs.defaultExternalAiConsent);
    setConsentLoaded(true);
  }, [id, prefs.defaultExternalAiConsent]);

  const send = useCallback(async (content: string, mode: "text" | "voice_transcription" = "text") => {
    if (!content.trim() || !c.data) return;
    setSending(true); setSendError(null);
    try {
      const lang = c.data.case.preferred_language;
      const r: SendMessageResponse = await api.sendMessage(id, { content: content.trim(), language: lang, input_mode: mode, external_ai_consent: consent });
      appendToTranscript(id, r.user_message, r.assistant_message);
      setMessages(loadTranscript(id));
      setStatus(r.case_status);
      writeJson(consentKey(id), { consent }, "session");
      c.reload();
      setDraft(""); setInputMode("text");
    } catch (e) { setSendError(e); }
    finally { setSending(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.data, consent, id]);

  // After intake, ask the assistant to review the description once. Consent was given on the intake form.
  useEffect(() => {
    if (sp.get("review") === "1" && c.data && consentLoaded && !ranReview.current) {
      ranReview.current = true;
      const hasReply = loadTranscript(id).some((m) => m.role === "assistant");
      if (!hasReply) void send(REVIEW_PROMPT);
      window.history.replaceState(null, "", `/cases/${id}?tab=conversation`);
    }
  }, [c.data, id, sp, send, consentLoaded]);

  const generateAssessment = useCallback(async () => {
    setAssessmentBusy(true); setAssessmentError(null);
    try {
      await api.generateAssessment(id, { external_ai_consent: consent });
      setStatus((value) => value === "assessment-refresh" ? "assessment-refresh-2" : "assessment-refresh");
      await assessment.reload();
    } catch (error) {
      setAssessmentError(describeError(error).hint);
    } finally {
      setAssessmentBusy(false);
    }
  }, [id, consent, assessment]);

  const localDocs = useMemo(() => (isMock ? readJson<Array<{ name: string; size: number; at: string }>>(localDocsKey(id), [], "session") : []), [id]);

  const toggleSensitiveCase = useCallback(async () => {
    if (!c.data) return;
    setPrivacyBusy(true);
    try {
      await api.updateCaseSensitivity(id, !Boolean(c.data.case.sensitive));
      await c.reload();
    } catch (error) {
      setAssessmentError(describeError(error).hint);
    } finally {
      setPrivacyBusy(false);
    }
  }, [c, id]);

  const togglePrivateConversation = useCallback(async () => {
    if (!c.data) return;
    setPrivacyBusy(true);
    try {
      await api.updateCasePrivacy(id, !Boolean(c.data.case.private_conversation));
      await c.reload();
    } catch (error) {
      setAssessmentError(describeError(error).hint);
    } finally {
      setPrivacyBusy(false);
    }
  }, [c, id]);

  if (c.loading && !c.data) return <LoadingBlock rows={3} />;
  if (c.error || !c.data) return <><BackLink /><ErrorState error={c.error} onRetry={c.reload} /></>;
  const cs = c.data.case;
  const meta = STATUS_META[cs.status];

  return (
    <>
      <BackLink />
      <header className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="mist">{categoryLabel(cs.category)}</Badge>
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {cs.sensitive ? <Badge tone="neutral" icon={Lock}>Sensitive</Badge> : null}
          <Badge tone="neutral">{LANGUAGES.find((l) => l.code === cs.preferred_language)?.label ?? cs.preferred_language}</Badge>
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{cs.title}</h1>
        <div className="max-w-md"><ProgressBar value={meta.progress} label={`Case progress: ${meta.label}`} /></div>
        <div className="rounded-xl border border-navy/10 bg-white p-4 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" aria-hidden />Sensitive case</p>
              <p className="mt-1 max-w-2xl text-xs text-navy/70">{cs.sensitive ? "On: no external AI provider will receive this case, even if message consent is selected." : "Off: external AI may be used only when you explicitly consent and backend safeguards allow it."}</p>
            </div>
            <Button size="sm" variant={cs.sensitive ? "primary" : "secondary"} loading={privacyBusy} onClick={toggleSensitiveCase}>{cs.sensitive ? "Mark as non-sensitive" : "Mark as sensitive"}</Button>
          </div>
          <div className="border-t border-navy/10 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" aria-hidden />Private conversation</p>
              <p className="mt-1 max-w-2xl text-xs text-navy/70">{cs.private_conversation ? "On: this case will not be sent to an external LLM or speech provider." : "Off: external AI is still blocked for sensitive cases. This setting adds an extra block for every case."}</p>
            </div>
            <Button size="sm" variant={cs.private_conversation ? "primary" : "secondary"} loading={privacyBusy} onClick={togglePrivateConversation}>{cs.private_conversation ? "Turn private mode off" : "Turn private mode on"}</Button>
          </div>
          </div>
        </div>
      </header>

      <Tabs<Tab> label="Case sections" value={tab} onChange={setTab} tabs={[
        { id: "assessment", label: "Assessment" }, { id: "conversation", label: "Conversation", count: messages.length || undefined },
        { id: "timeline", label: "Timeline" }, { id: "documents", label: "Documents", count: (docs.data?.items.length ?? 0) + localDocs.length || undefined }]} />

      <div className="mt-6" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "assessment" && <div className="mb-4 space-y-2"><Button onClick={generateAssessment} loading={assessmentBusy}>Generate detailed assessment</Button>{assessmentError && <Notice tone="danger" title="Assessment could not be generated">{assessmentError}</Notice>}<p className="text-xs text-navy/70">Uses the case conversation and any available verified legal sources. External processing remains subject to the case privacy setting and demo allowlist.</p></div>}
        {tab === "assessment" && (assessment.loading ? <LoadingBlock rows={4} /> :
          assessment.error instanceof ApiError && assessment.error.code === "ASSESSMENT_NOT_FOUND" ?
            <EmptyState title="No assessment yet" action={<Button onClick={() => setTab("conversation")}>Open the conversation</Button>}>The assistant prepares an assessment after reviewing your description. Send a message to begin.</EmptyState> :
          assessment.error ? <ErrorState error={assessment.error} onRetry={assessment.reload} /> :
          assessment.data && <AssessmentView c={cs} a={assessment.data.assessment} onAskMore={() => setTab("conversation")} />)}
        {tab === "assessment" && <CaseSupportPanel caseInfo={cs} />}

        {tab === "conversation" && (
          <Conversation messages={messages} draft={draft} setDraft={setDraft} send={() => send(draft, inputMode)} sendNextSteps={() => send(NEXT_STEPS_PROMPT)} sending={sending}
            sendError={sendError} consent={consent} setConsent={setConsent} sensitive={cs.sensitive} caseId={id}
            onVoice={(t) => { setDraft((d) => (d ? d + "\n" : "") + t); setInputMode("voice_transcription"); }}
            onReview={() => send(REVIEW_PROMPT)} />
        )}

        {tab === "timeline" && <Timeline createdAt={cs.created_at} messages={messages} assessmentAt={assessment.data?.assessment.generated_at} docs={docs.data?.items ?? []} />}

        {tab === "documents" && (
          <div className="space-y-4">
            {docs.loading ? <LoadingBlock rows={2} /> : docs.error ? <ErrorState error={docs.error} onRetry={docs.reload} /> : (
              <>
                {(docs.data?.items.length ?? 0) + localDocs.length === 0 ? <EmptyState icon={FileText} title="No documents on this case" action={<Button href={`/studio?case=${cs.id}`} variant="secondary">Draft a document</Button>}>Uploads you add appear here. They are stored privately and shared only with your consent.</EmptyState> : (
                  <ul className="space-y-2">
                    {docs.data?.items.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm shadow-card">
                        <span className="flex min-w-0 items-center gap-2"><Paperclip className="h-4 w-4 shrink-0 text-teal-700" aria-hidden /><span className="truncate font-medium">{d.file_name}</span><span className="text-xs text-navy/60">{formatBytes(d.size_bytes)} · {formatDate(d.created_at)}</span></span>
                        {d.download_url ? <a className="font-semibold text-teal-700 underline" href={d.download_url} target="_blank" rel="noopener noreferrer">Download</a> : <span className="text-xs text-navy/60">Link available in live mode</span>}
                      </li>))}
                    {localDocs.map((d, i) => (
                      <li key={`l${i}`} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm shadow-card"><span className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-teal-700" aria-hidden />{d.name}<span className="text-xs text-navy/60">{formatBytes(d.size)}</span></span><Badge tone="amber">Demo: name only</Badge></li>))}
                  </ul>)}
                <Notice tone="info">Generated drafts are preliminary and are never filed for you. <Link href={`/studio?case=${cs.id}`} className="font-semibold text-teal-700 underline">Open the Document studio</Link></Notice>
              </>)}
          </div>)}
      </div>
    </>
  );
}

const BackLink = () => <Link href="/cases" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" aria-hidden />My cases</Link>;

function Conversation(p: {
  messages: CaseMessage[]; draft: string; setDraft: (s: string) => void; send: () => void; sendNextSteps: () => void; sending: boolean; sendError: unknown;
  consent: boolean; setConsent: (b: boolean) => void; sensitive: boolean; caseId: string; onVoice: (t: string) => void; onReview: () => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [p.messages.length, p.sending]);
  const hasReply = p.messages.some((m) => m.role === "assistant");
  const err = p.sendError ? describeError(p.sendError) : null;
  return (
    <div className="space-y-4">
      <p className="text-xs text-navy/70">Showing the conversation from this browser tab. Earlier messages from other sessions can’t be loaded yet because the API has no message-history endpoint.</p>
      {p.messages.length === 0 && <EmptyState title="No messages in this session">Send a message to continue this case.</EmptyState>}
      <ol className="space-y-3" aria-live="polite" aria-label="Conversation">
        {p.messages.map((m) => (
          <li key={m.id} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
            <span className={cn("mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-navy text-white" : "bg-mist text-teal-700")}>{m.role === "user" ? <User className="h-4 w-4" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}</span>
            <div className={cn("max-w-[85%] rounded-xl2 p-3.5 text-sm", m.role === "user" ? "bg-navy text-white" : "bg-white shadow-card")}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              <p className={cn("mt-1.5 flex flex-wrap items-center gap-2 text-xs", m.role === "user" ? "text-white/70" : "text-navy/60")}>{timeAgo(m.created_at)}
                {m.role === "assistant" && m.ai_metadata && (m.ai_metadata.provider === "privacy_gate" ? <Badge tone="neutral" icon={Lock}>No AI used</Badge> : <MockAiBadge isMock={m.ai_metadata.is_mock} provider={m.ai_metadata.provider} model={m.ai_metadata.model} />)}</p>
            </div>
          </li>))}
        {p.sending && <li className="flex gap-2.5"><span className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-mist text-teal-700"><Bot className="h-4 w-4" aria-hidden /></span><div role="status" className="rounded-xl2 bg-white p-3.5 text-sm shadow-card text-navy/70">Reading your message…</div></li>}
      </ol>
      <div ref={bottom} />

      {!hasReply && p.messages.length > 0 && !p.sending && (
        <Notice tone="info" title="The assistant hasn’t reviewed your description yet"><Button size="sm" className="mt-2" onClick={p.onReview}>Get follow-up questions</Button></Notice>)}
      {hasReply && !p.sending && (
        <section className="rounded-xl2 border border-teal/25 bg-white p-4 shadow-card" aria-label="Quick actions">
          <p className="text-sm font-semibold">What would you like to do next?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={p.sendNextSteps} loading={p.sending}>Get next legal steps</Button>
            <Button size="sm" href="/lawyers" variant="secondary">Contact a lawyer · View profiles</Button>
            <Button size="sm" href={`/studio?case=${p.caseId}`} variant="secondary">Prepare a document</Button>
          </div>
        </section>
      )}
      {err && <Notice tone="danger" title={err.title}>{err.hint}</Notice>}

      <form onSubmit={(e) => { e.preventDefault(); p.send(); }} className="space-y-3 rounded-xl2 border border-navy/10 bg-white p-4 shadow-card">
        <label htmlFor="msg" className="text-sm font-semibold">Add details or answer a question</label>
        <textarea id="msg" rows={3} className={inputCls} value={p.draft} onChange={(e) => p.setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (p.draft.trim() && !p.sending) p.send(); } }} maxLength={12000} />
        <p className="text-xs text-navy/60">Press Enter to send · Shift + Enter for a new line</p>
        <VoiceRecorder caseId={p.caseId} consent={p.consent} onTranscript={p.onVoice} disabled={p.sending} />
        <ConsentCheckbox id="msg-consent" checked={p.consent} onChange={p.setConsent}>
          Allow an external AI service to process this message.{p.sensitive && <> This case is <strong>sensitive</strong>; no external AI provider will be contacted, even if you tick this.</>}
        </ConsentCheckbox>
        <div className="flex justify-end"><Button type="submit" icon={Send} loading={p.sending} disabled={!p.draft.trim()}>Send message</Button></div>
      </form>
    </div>
  );
}

function Timeline({ createdAt, messages, assessmentAt, docs }: { createdAt: string; messages: CaseMessage[]; assessmentAt?: string; docs: Array<{ file_name: string; created_at: string }> }) {
  const events = [
    { at: createdAt, label: "Case created", detail: "" },
    ...messages.filter((m) => m.role === "user").map((m) => ({ at: m.created_at, label: "You added details", detail: m.content.slice(0, 140) })),
    ...docs.map((d) => ({ at: d.created_at, label: "Document added", detail: d.file_name })),
    ...(assessmentAt ? [{ at: assessmentAt, label: "Assessment updated", detail: "" }] : []),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="space-y-4 border-l-2 border-teal/40 pl-5" aria-label="Case timeline">
      {events.map((e, i) => (
        <li key={i} className="relative"><span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-teal bg-white" />
          <p className="text-sm font-semibold">{e.label}</p><p className="text-xs text-navy/60">{formatDate(e.at, true)}</p>{e.detail && <p className="mt-0.5 text-sm text-navy/85">{e.detail}{e.detail.length >= 140 ? "…" : ""}</p>}</li>))}
    </ol>
  );
}

export default function CasePage() { return <Suspense fallback={<LoadingBlock />}><CaseDetail /></Suspense>; }
